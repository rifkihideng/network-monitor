export interface SpeedTestResult {
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number | null;
  jitterMs: number | null;
}

export interface PingResult {
  host: string;
  online: boolean;
  latencyMs: number | null;
  packetLoss: number; // 0-100 (%)
}

export interface ScannedDevice {
  ip: string;
  mac: string | null;
  hostname: string | null;
}

export interface WifiQuality {
  latencyMs: number | null;
  jitterMs: number | null;
  packetLoss: number;
  stabilityScore: number | null;
}
