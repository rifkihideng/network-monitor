const OUI_API = "https://api.maclookup.app/v2/macs";

/**
 * Cari nama vendor dari MAC address lewat OUI lookup (maclookup.app).
 * Return null jika gagal/tidak ditemukan (jangan sampai gagalkan scan).
 */
export async function lookupVendor(mac: string): Promise<string | null> {
  const cleaned = mac.trim();
  if (!cleaned) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${OUI_API}/${encodeURIComponent(cleaned)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success?: boolean;
      found?: boolean;
      company?: string;
    };
    if (!data.success || !data.found || !data.company) return null;
    return data.company;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
