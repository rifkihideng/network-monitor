import { execFile } from "node:child_process";
import { promisify } from "node:util";
import dns from "node:dns/promises";
import { getSweepSubnets, pingSweep, getLocalSubnets, type Subnet } from "./sweep";
import type { ScannedDevice } from "./types";

const execFileAsync = promisify(execFile);

function isJunkIp(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  const [a, , , d] = parts;
  if (a >= 224) return true; // multicast / reserved
  if (d === 0 || d === 255) return true; // network / broadcast
  return false;
}

function isJunkMac(mac: string): boolean {
  const m = mac.toLowerCase().replace(/[:-]/g, "");
  if (m === "ffffffffffff") return true; // broadcast
  if (m.startsWith("01005e")) return true; // IPv4 multicast MAC
  if (m.startsWith("3333")) return true; // IPv6 multicast MAC
  return false;
}

function ipv4ToInt(ip: string): number {
  return (
    ip
      .split(".")
      .reduce((acc, octet) => ((acc << 8) + Number(octet)) >>> 0, 0) >>> 0
  );
}

function ipInSubnets(ip: string, subnets: Subnet[]): boolean {
  if (subnets.length === 0) return true; // tanpa info subnet, jangan difilter
  const value = ipv4ToInt(ip);
  return subnets.some((s) => value >= s.start && value <= s.end);
}

function parseArp(output: string): ScannedDevice[] {
  const devices: ScannedDevice[] = [];
  const seen = new Set<string>();
  // IP lalu MAC 6 oktet (dipisah "-" atau ":"), lalu tipe (dynamic/static).
  const regex =
    /(\d{1,3}(?:\.\d{1,3}){3})\s+((?:[0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2})\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(output)) !== null) {
    const ip = match[1];
    const mac = match[2];
    if (isJunkIp(ip) || isJunkMac(mac) || seen.has(ip)) continue;
    seen.add(ip);
    devices.push({ ip, mac, hostname: null });
  }
  return devices;
}

export async function scanNetwork(): Promise<ScannedDevice[]> {
  const isWin = process.platform === "win32";
  let devices: ScannedDevice[] = [];
  try {
    if (isWin) {
      const { stdout } = await execFileAsync("arp", ["-a"], { timeout: 10000 });
      devices = parseArp(stdout);
    } else {
      // Linux: coba `ip neigh`, fallback ke `arp -a`.
      const { stdout } = await execFileAsync("ip", ["neigh"], { timeout: 10000 });
      const regex = /(\d{1,3}(?:\.\d{1,3}){3})\s+dev\s+\S+\s+lladdr\s+((?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2})/g;
      const seen = new Set<string>();
      let match: RegExpExecArray | null;
      while ((match = regex.exec(stdout)) !== null) {
        const ip = match[1];
        const mac = match[2];
        if (isJunkIp(ip) || isJunkMac(mac) || seen.has(ip)) continue;
        seen.add(ip);
        devices.push({ ip, mac, hostname: null });
      }
    }
  } catch {
    const { stdout } = await execFileAsync("arp", ["-a"], { timeout: 10000 });
    devices = parseArp(stdout);
  }

  // Buang IP dari adapter virtual (VMware/VirtualBox/WSL/dst.) agar daftar
  // perangkat hanya berisi perangkat di subnet fisik (Wi-Fi/LAN) yang relevan.
  const localSubnets = getLocalSubnets();
  return devices.filter((d) => ipInSubnets(d.ip, localSubnets));
}

/**
 * Ping sweep seluruh subnet lokal untuk mengisi ARP table,
 * lalu baca ARP agar daftar perangkat lebih lengkap (tidak hanya yang
 * baru-baru ini berkomunikasi dengan mesin ini).
 */
export async function fullScan(): Promise<ScannedDevice[]> {
  const subnets = await getSweepSubnets();
  // Sweep beberapa kali agar perangkat yang bangun sebentar ikut tertangkap.
  for (let pass = 0; pass < 2; pass++) {
    await pingSweep(subnets);
    if (pass === 0) await new Promise((r) => setTimeout(r, 800));
  }
  return scanNetwork();
}

export async function resolveHostname(
  ip: string,
  timeoutMs = 1500,
): Promise<string | null> {
  try {
    const names = await Promise.race([
      dns.reverse(ip),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("dns timeout")), timeoutMs),
      ),
    ]);
    return names[0] ?? null;
  } catch {
    return null;
  }
}
