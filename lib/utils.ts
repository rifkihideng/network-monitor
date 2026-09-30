export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} detik`;
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  if (minutes < 60) {
    return seconds > 0 ? `${minutes} menit ${seconds} detik` : `${minutes} menit`;
  }
  const hours = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${hours} jam ${m} menit`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayStartIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
