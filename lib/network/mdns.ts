import Bonjour from "bonjour-service";
import type { ScannedDevice } from "./types";

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

interface MdnsServiceInfo {
  name?: string;
  host?: string;
  fqdn?: string;
  addresses?: string[];
  referer?: { address: string };
}

interface MdnsBrowser {
  stop(): void;
  on(event: "up", cb: (service: MdnsServiceInfo) => void): void;
}

/**
 * Temukan perangkat lewat mDNS/Bonjour (HP, TV, printer, Chromecast, dst.)
 * dengan browsing semua service type (_services._dns-sd._udp).
 * Return perangkat dengan IP + hostname (tanpa MAC).
 */
export async function discoverMdnsDevices(
  timeoutMs = 4000,
): Promise<ScannedDevice[]> {
  let bonjour: Bonjour | null = null;
  try {
    bonjour = new Bonjour();
  } catch {
    return [];
  }

  const found = new Map<string, ScannedDevice>();

  return new Promise<ScannedDevice[]>((resolve) => {
    let browser: MdnsBrowser | null = null;
    try {
      browser = bonjour!.find(null) as unknown as MdnsBrowser;
    } catch {
      resolve([]);
      return;
    }

    browser.on("up", (service) => {
      const name = service.name || service.host || service.fqdn || null;
      const ips = (service.addresses ?? []).filter((a) => IPV4.test(a));
      const addresses =
        ips.length > 0
          ? ips
          : service.referer && IPV4.test(service.referer.address)
            ? [service.referer.address]
            : [];

      for (const ip of addresses) {
        const existing = found.get(ip);
        if (existing) {
          if (!existing.hostname && name) existing.hostname = name;
        } else {
          found.set(ip, { ip, mac: null, hostname: name });
        }
      }
    });

    const finish = () => {
      try {
        browser!.stop();
      } catch {
        // abaikan
      }
      try {
        bonjour!.destroy();
      } catch {
        // abaikan
      }
      resolve(Array.from(found.values()));
    };

    setTimeout(finish, timeoutMs);
  });
}
