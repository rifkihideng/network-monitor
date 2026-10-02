# Network Monitor

Dashboard monitoring jaringan: **Internet Speed Test**, **Device Monitor**, **Wi-Fi Quality**, dan **Internet History**.

## Fitur

- **Internet Speed Test** — download, upload, ping, jitter + grafik riwayat (Recharts). Pilihan provider: Fast.com/Netflix (default) atau Ookla/speedtest.net (butuh Ookla CLI: `winget install Ookla.Speedtest.CLI`).
- **Device Monitor** — scan perangkat via ARP + ping sweep + mDNS/Bonjour, identifikasi vendor (OUI lookup), status online/offline, last seen, rename label manual, dan riwayat online/offline per perangkat.
- **Wi-Fi Quality** — latency, jitter, packet loss, connection stability + grafik.
- **Internet History** — deteksi outage otomatis, downtime hari ini & 7 hari terakhir.
- **Autentikasi GitHub** + monitoring otomatis (loop lokal / Vercel Cron).

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Database:** Turso (libsql) — fallback otomatis ke SQLite lokal (`data/local.db`)
- **Chart:** Recharts
- **Discovery perangkat:** bonjour-service (mDNS)
- **UI:** dark theme responsif (mobile & desktop)

## Menjalankan

1. `npm install`
2. Salin `.env.example` → `.env`, lalu isi:
   - Wajib login: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `AUTH_SECRET`.
   - Opsional DB: `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` (kalau kosong, otomatis pakai SQLite lokal `data/local.db`).
3. `npm run dev` → buka http://localhost:3000
4. Produksi: `npm run build` lalu `npm start`.

## Struktur Folder

```
project-fix-5/
├── app/
│   ├── layout.tsx                  # Root layout (navbar + UserNav)
│   ├── page.tsx                    # Dashboard ringkasan
│   ├── globals.css
│   ├── login/                      # Halaman login GitHub
│   ├── speed-test/                 # 1. Internet Speed Test
│   ├── devices/                    # 2. Device Monitor
│   ├── wifi-quality/               # 3. Wi-Fi Quality
│   ├── history/                    # 4. Internet History
│   │
│   └── api/
│       ├── speed-test/route.ts
│       ├── devices/route.ts
│       ├── devices/refresh/route.ts       # polling ringan status (ARP + ping)
│       ├── devices/[id]/route.ts
│       ├── devices/[id]/history/route.ts  # riwayat online/offline perangkat
│       ├── wifi-quality/route.ts
│       ├── wifi-quality/history/route.ts  # data grafik latency
│       ├── history/route.ts
│       ├── history/daily/route.ts         # agregasi downtime 7 hari
│       ├── status/route.ts                # ringkasan dashboard
│       ├── monitor/route.ts               # tick monitoring (Vercel Cron)
│       └── auth/                           # login / callback / logout / session
│
├── components/
│   ├── ui/                         # UserNav, NavLinks, dsb.
│   ├── speed-test/SpeedHistoryChart.tsx
│   ├── devices/
│   ├── wifi-quality/LatencyChart.tsx
│   └── history/DowntimeChart.tsx
│
├── lib/
│   ├── auth.ts                     # Token sesi HMAC (login)
│   ├── db/
│   │   ├── client.ts               # Koneksi Turso (@libsql/client)
│   │   └── schema.sql              # DDL tabel
│   ├── network/
│   │   ├── speedtest.ts            # Speed test (Fast.com/Netflix CDN)
│   │   ├── scan.ts                 # Scan perangkat (ARP)
│   │   ├── sweep.ts                # Ping sweep subnet lokal
│   │   ├── mdns.ts                 # Discovery mDNS/Bonjour
│   │   ├── oui.ts                  # OUI lookup → nama vendor
│   │   ├── ping.ts                 # Ping, ukur latency & packet loss
│   │   └── types.ts
│   ├── devices.ts                  # Snapshot status + apply online/offline
│   ├── monitor.ts                  # Deteksi down/up + simpan sampel
│   ├── monitor-loop.ts             # Scheduler lokal (self-hosted)
│   └── utils.ts
│
├── scripts/
│   ├── start-network-monitor.ps1   # Launcher produksi (Task Scheduler)
│   └── start-network-monitor.vbs   # Auto-start tersembunyi saat login
├── proxy.ts                        # Proteksi route (auth)
├── instrumentation.ts              # Start monitor-loop saat server start
├── next.config.mjs
├── .env.example
└── .gitignore
```

## Mapping Fitur → Folder

| Fitur | UI (Page) | API Route | Logic | Data (Turso) |
|---|---|---|---|---|
| 1. Internet Speed Test | `app/speed-test` | `app/api/speed-test` | `lib/network/speedtest.ts` | `speed_tests` |
| 2. Device Monitor | `app/devices` | `app/api/devices` | `lib/network/scan.ts`, `ping.ts` | `devices` |
| 3. Wi-Fi Quality | `app/wifi-quality` | `app/api/wifi-quality` | `lib/network/ping.ts` | `latency_samples` |
| 4. Internet History | `app/history` | `app/api/history` | `lib/db` (agregasi) | `outages` |

## Skema Database (Turso)

```sql
-- speed_tests: hasil speed test
CREATE TABLE speed_tests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  download    REAL,            -- Mbps
  upload      REAL,            -- Mbps
  ping        REAL,            -- ms
  jitter      REAL,            -- ms
  created_at  TEXT DEFAULT (datetime('now'))
);

-- devices: perangkat di jaringan
CREATE TABLE devices (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip         TEXT NOT NULL UNIQUE,
  hostname   TEXT,
  mac        TEXT,
  vendor     TEXT,                     -- hasil OUI lookup
  label      TEXT,                     -- nama manual (rename oleh user)
  status     TEXT DEFAULT 'offline',   -- online | offline
  last_seen  TEXT
);

-- device_events: riwayat transisi online/offline perangkat
CREATE TABLE device_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id   INTEGER NOT NULL,        -- FK -> devices.id
  status      TEXT NOT NULL,           -- online | offline
  created_at  TEXT DEFAULT (datetime('now'))
);

-- latency_samples: probe Wi-Fi quality
CREATE TABLE latency_samples (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  latency_ms   REAL,
  packet_loss  REAL,             -- persen
  jitter_ms    REAL,
  created_at   TEXT DEFAULT (datetime('now'))
);

-- outages: kejadian internet down
CREATE TABLE outages (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at        TEXT,
  ended_at          TEXT,
  duration_seconds  INTEGER
);
```

## Variabel Environment

Salin `.env.example` ke `.env` lalu isi kredensial Turso:

| Variabel | Keterangan |
|---|---|
| `TURSO_DATABASE_URL` | URL database libsql (mis. `libsql://nama-db.turso.io`) |
| `TURSO_AUTH_TOKEN` | Auth token dari dashboard Turso |
| `MONITOR_HOST` | Host yang di-ping untuk deteksi outage (default `1.1.1.1`) |
| `MONITOR_INTERVAL_MS` | Interval tick monitoring dalam ms (default `60000`) |
| `MONITOR_ENABLED` | `false` untuk menonaktifkan scheduler lokal |
| `CRON_SECRET` | Proteksi endpoint `/api/monitor` saat dipanggil Vercel Cron |
| `GITHUB_CLIENT_ID` | Client ID dari GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | Client Secret dari GitHub OAuth App |
| `AUTH_SECRET` | Secret untuk menandatangani cookie sesi login |
| `GITHUB_REDIRECT_URI` | (Opsional) override callback URL (default `<origin>/api/auth/callback`) |

## Monitoring Otomatis

Monitoring otomatis memakai logika di `lib/monitor.ts` (`runMonitorTick`) dan berjalan **self-hosted** — `instrumentation.ts` memanggil `startMonitorLoop()` saat server start, lalu tick berjalan tiap `MONITOR_INTERVAL_MS` (default 1 menit). Aktif otomatis di `next dev` dan `next start`; nonaktifkan dengan `MONITOR_ENABLED=false`.

> Monitoring berbasis ping **tidak berfungsi di Vercel** karena runtime serverless memblokir ICMP. Endpoint `GET /api/monitor` tetap tersedia (dilindungi `CRON_SECRET`), tapi hanya berguna saat app dijalankan di mesin lokal.

Setiap tick: ping host → simpan sampel ke `latency_samples` → deteksi transisi:
- Online tetapi ada outage terbuka → outage ditutup (`ended_at`, `duration_seconds`).
- Offline tanpa outage terbuka → outage baru dibuka (`started_at`).

Halaman **History** otomatis menampilkan "Internet down X kali hari ini" + total downtime dari data `outages`.

## Autentikasi GitHub

Seluruh halaman & API (kecuali `/login`, `/api/auth/*`, dan `/api/monitor`) dilindungi `proxy.ts` — tanpa sesi valid akan diarahkan ke `/login`.

Alur login:
1. Buat OAuth App di https://github.com/settings/developers → dapatkan `GITHUB_CLIENT_ID` & `GITHUB_CLIENT_SECRET`.
2. Set **Authorization callback URL** ke `http://localhost:3000/api/auth/callback` (lokal) dan `https://<domain>.vercel.app/api/auth/callback` (Vercel).
3. Isi `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, dan `AUTH_SECRET` di `.env` (lokal) + Environment Variables di Vercel.
4. Klik "Login dengan GitHub" di `/login` → callback membuat cookie `auth_session` (HTTP-only, HMAC-signed) → redirect kembali ke halaman yang semula diminta (`next`), atau ke dashboard bila tidak ada.

Endpoint auth: `GET /api/auth/login` (redirect ke GitHub), `GET /api/auth/callback`, `GET /api/auth/logout`, `GET /api/auth/session`.

> Saat pengguna belum login mengunjungi halaman terproteksi, `proxy.ts` menyimpan path asal di cookie `auth_next` (httpOnly, 10 menit). Callback lalu memakainya untuk mengembalikan pengguna ke halaman tersebut — dengan validasi anti open-redirect (path harus diawali `/` dan bukan `//`).

## Identifikasi Vendor (OUI Lookup)

Saat scan perangkat, `lib/network/oui.ts` memanggil API `maclookup.app` untuk menerjemahkan MAC → nama vendor (mis. "Samsung", "TP-Link") dan menyimpannya di kolom `devices.vendor`. Gagal lookup tidak menghentikan scan (vendor jadi `null`).

## Grafik (Chart)

Menggunakan Recharts:
- **Wi-Fi Quality** — `GET /api/wifi-quality/history` → line chart latency + packet loss (`components/wifi-quality/LatencyChart.tsx`).
- **History** — `GET /api/history/daily` → bar chart downtime per hari, 7 hari terakhir (`components/history/DowntimeChart.tsx`).
- **Speed Test** — line chart download vs upload dari riwayat hasil (`components/speed-test/SpeedHistoryChart.tsx`).

## Catatan Deployment

- **Self-hosted** (laptop/server di jaringan lokal): semua fitur aktif penuh — scan perangkat, ping sweep, mDNS, dan monitoring otomatis.
- **Vercel**: dashboard, speed test, autentikasi, dan penyimpanan Turso berjalan normal. **Fitur berbasis ping/scan (monitor outage, Wi-Fi Quality, scan perangkat) tidak bisa dijalankan dari Vercel** — runtime serverless memblokir ICMP dan tidak punya akses ke jaringan lokalmu, jadi fitur itu harus dijalankan di mesin di jaringan lokal. Endpoint `POST /api/devices` dan `POST /api/devices/refresh` otomatis melewati ping sweep/mDNS saat berjalan di Vercel (hanya membaca data dari Turso) demi menghemat memori serverless.

## Riwayat Perubahan (Changelog)

- **2026-10-02 — Hemat memori Vercel**: `POST /api/devices` dan `POST /api/devices/refresh` kini mendeteksi `process.env.VERCEL` dan langsung membaca data dari Turso tanpa menjalankan ping sweep/mDNS (sebelumnya memicu ~128 proses `ping` bersamaan di serverless). Concurrency sweep default diturunkan `128 → 64`.
- **2026-10-02 — Scan perangkat lebih akurat**: perangkat yang terlihat pada scan (ARP/mDNS) ditandai `online` — tidak lagi mengandalkan ICMP ping (banyak HP memblokir ICMP). Adapter virtual (VMware/VirtualBox/WSL/dst.) disaring di `lib/network/scan.ts`.
- **2026-10-02 — Riwayat perangkat**: kolom `devices.label` (rename manual), tabel `device_events` (riwayat online/offline), helper `lib/devices.ts` (`snapshotDevices` + `applyOnlineStatuses`), endpoint `POST /api/devices/refresh` (polling ringan 30 dtk) dan `GET /api/devices/[id]/history`.
- **2026-10-02 — Retry koneksi DB**: `lib/db/client.ts` menambahkan retry otomatis untuk error koneksi Turso (`ConnectTimeout`/`fetch failed`).

## Self-host & Auto-start (Windows)

Untuk menjalankan permanen di mesin lokal (semua fitur aktif):

1. Build produksi: `npm run build`.
2. Jalankan `scripts\start-network-monitor.ps1` — atau double-click `scripts\start-network-monitor.vbs` untuk berjalan **tanpa jendela konsol**.
3. **Auto-start saat login**: salin `scripts\start-network-monitor.vbs` ke folder Startup (`Win+R` → `shell:startup`).

Server produksi berjalan di `http://localhost:3000`. Log: `logs\network-monitor.out.log` dan `.err.log`.

> Auto-start saat **boot sebelum login** (bukan saat login) butuh Task Scheduler + hak admin:
> ```powershell
> $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "D:\project fix 5\scripts\start-network-monitor.ps1"'
> $trigger = New-ScheduledTaskTrigger -AtStartup
> Register-ScheduledTask -TaskName 'NetworkMonitor' -Action $action -Trigger $trigger -RunLevel Highest -Force
> ```
