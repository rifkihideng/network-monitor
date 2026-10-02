import { execFile } from "node:child_process";
import { networkInterfaces } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface Subnet {
  start: number; // uint32, alamat host pertama
  end: number; // uint32, alamat host terakhir
}

function ipv4ToInt(ip: string): number {
  return (
    ip
      .split(".")
      .reduce((acc, octet) => ((acc << 8) + Number(octet)) >>> 0, 0) >>> 0
  );
}

function intToIpv4(value: number): string {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join(".");
}

// Adapter virtual yang subnet-nya tidak perlu di-sweep.
const VIRTUAL_INTERFACE =
  /vmware|virtualbox|hyper-v|vethernet|wsl|docker|loopback|bluetooth|tailscale|wireguard|openvpn|zerotier|tun\d|tap\d/i;

/** Deteksi subnet lokal dari network interfaces mesin ini. */
export function getLocalSubnets(): Subnet[] {
  const subnets: Subnet[] = [];
  const interfaces = networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    if (VIRTUAL_INTERFACE.test(name)) continue;
    for (const iface of interfaces[name] ?? []) {
      if (iface.family !== "IPv4" || iface.internal) continue;
      const { address, netmask } = iface;
      if (!address || !netmask) continue;
      if (address.startsWith("169.254.")) continue; // APIPA/link-local

      const ipInt = ipv4ToInt(address);
      const maskInt = ipv4ToInt(netmask);
      const network = (ipInt & maskInt) >>> 0;
      const broadcast = (network | (~maskInt >>> 0)) >>> 0;
      const hostCount = broadcast - network - 1;

      // Lewati /31-/32 dan subnet besar (> /21) supaya sweep tetap cepat.
      if (hostCount < 2 || hostCount > 2048) continue;

      subnets.push({ start: network + 1, end: broadcast - 1 });
    }
  }

  return subnets;
}

async function getDefaultRouteIp(): Promise<string | null> {
  try {
    if (process.platform === "win32") {
      const { stdout } = await execFileAsync("route", ["print", "0.0.0.0"], {
        timeout: 5000,
      });
      let best: { ip: string; metric: number } | null = null;
      for (const line of stdout.split(/\r?\n/)) {
        const m = line.match(
          /^\s*0\.0\.0\.0\s+0\.0\.0\.0\s+\S+\s+(\d{1,3}(?:\.\d{1,3}){3})\s+(\d+)\s*$/,
        );
        if (m) {
          const metric = Number(m[2]);
          if (!best || metric < best.metric) best = { ip: m[1], metric };
        }
      }
      return best?.ip ?? null;
    } else {
      const { stdout } = await execFileAsync(
        "ip",
        ["route", "show", "default"],
        { timeout: 5000 },
      );
      const ifaceName = stdout.match(/dev\s+(\S+)/)?.[1];
      if (ifaceName) {
        const ifaces = networkInterfaces()[ifaceName] ?? [];
        const v4 = ifaces.find((i) => i.family === "IPv4" && !i.internal);
        return v4?.address ?? null;
      }
    }
  } catch {
    // abaikan
  }
  return null;
}

/** Subnet yang di-sweep: hanya subnet default route, fallback ke semua subnet lokal. */
export async function getSweepSubnets(): Promise<Subnet[]> {
  const all = getLocalSubnets();
  if (all.length === 0) return all;
  const defaultIp = await getDefaultRouteIp();
  if (!defaultIp) return all;
  const ipInt = ipv4ToInt(defaultIp);
  const primary = all.find((s) => ipInt >= s.start && ipInt <= s.end);
  return primary ? [primary] : all;
}

async function pingOnce(ip: string, timeoutMs: number): Promise<boolean> {
  const isWin = process.platform === "win32";
  const args = isWin
    ? ["-n", "1", "-w", String(timeoutMs), ip]
    : ["-c", "1", "-W", "1", ip];
  try {
    await execFileAsync("ping", args, { timeout: timeoutMs + 500 });
    return true;
  } catch {
    return false;
  }
}

async function sweepSubnetWindows(subnet: Subnet): Promise<void> {
  const base = intToIpv4(subnet.start).split(".").slice(0, 3).join(".");
  const first = subnet.start & 255;
  const last = subnet.end & 255;
  // Ping in-process lewat .NET Ping.SendPingAsync (satu objek per IP, paralel).
  const script = [
    "$pings = @()",
    `$t = ${first}..${last} | ForEach-Object { $p = New-Object System.Net.NetworkInformation.Ping; $pings += $p; $p.SendPingAsync('${base}.' + $_, 400) }`,
    "[System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]$t)",
    "$pings | ForEach-Object { $_.Dispose() }",
  ].join("; ");
  await execFileAsync("powershell", ["-NoProfile", "-Command", script], {
    timeout: 15000,
    windowsHide: true,
  });
}

async function sweepSubnetWithPing(
  subnet: Subnet,
  concurrency: number,
  timeoutMs: number,
): Promise<string[]> {
  const ips: string[] = [];
  for (let i = subnet.start; i <= subnet.end; i++) {
    ips.push(intToIpv4(i));
  }
  const alive: string[] = [];
  let index = 0;

  const worker = async () => {
    while (index < ips.length) {
      const ip = ips[index++];
      if (await pingOnce(ip, timeoutMs)) alive.push(ip);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, ips.length) }, () => worker()),
  );
  return alive;
}

/**
 * Ping semua IP di subnet untuk mengisi ARP table.
 * Return daftar IP yang merespons (hanya non-Windows; di Windows pemanggil
 * cukup membaca ARP table setelah sweep).
 */
export async function pingSweep(
  subnets: Subnet[],
  options?: { concurrency?: number; timeoutMs?: number },
): Promise<string[]> {
  const concurrency = options?.concurrency ?? 64;
  const timeoutMs = options?.timeoutMs ?? 300;

  if (process.platform === "win32") {
    for (const subnet of subnets) {
      try {
        await sweepSubnetWindows(subnet);
        continue; // ARP table sudah terisi
      } catch {
        // fallback ke ping per-IP
      }
      await sweepSubnetWithPing(subnet, concurrency, timeoutMs);
    }
    return [];
  }

  const alive: string[] = [];
  for (const subnet of subnets) {
    alive.push(...(await sweepSubnetWithPing(subnet, concurrency, timeoutMs)));
  }
  return alive;
}
