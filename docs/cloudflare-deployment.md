# LANDSAFE — Cloudflare Deployment Guide

Panduan resmi deployment platform LANDSAFE ke infrastruktur **Cloudflare** menggunakan **Cloudflare Workers**, **Workers Static Assets**, **Cloudflare Hyperdrive**, dan **Cloudflare Tunnel**.

---

## 1. Arsitektur Deployment (Hybrid Edge + Core)

LANDSAFE dirancang untuk keandalan maksimal dalam skenario bencana melalui pendekatan **Hybrid Edge-to-Core**:

```
[Pengguna Publik & Operator BPBD]
          │  HTTPS / HTTP3
          ▼
┌─────────────────────────────────────────────────────────────┐
│             CLOUDFLARE GLOBAL EDGE NETWORK                  │
│                                                             │
│  ┌───────────────────────┐   ┌───────────────────────────┐  │
│  │ Workers Static Assets │   │   Edge Router Worker      │  │
│  │ (SPA Frontend HTML,   │   │   (Security Headers,      │  │
│  │  Vite Chunks, Leaflet)│   │    Edge Health, Caching)  │  │
│  └───────────────────────┘   └─────────────┬─────────────┘  │
│                                            │                │
│                                            │ Proxy /api/*   │
└────────────────────────────────────────────┼────────────────┘
                                             │
                       ┌─────────────────────┴────────────────────┐
                       │ Cloudflare Tunnel / Secure Origin HTTPS  │
                       ▼                                          ▼
┌──────────────────────────────────────┐     ┌────────────────────────────────────┐
│      LANDSAFE Core API Server        │     │       PostgreSQL Database          │
│   - Node.js ESM + Express v5         │     │   - Drizzle ORM Schema             │
│   - JWT Auth & RoleGuard (BPBD)      │◄───►│   - Telemetri Sensor IoT           │
│   - XGBoost ML Risk Engine           │     │   - Cloudflare Hyperdrive Pooling  │
│   - LIA Assistant Engine             │     └────────────────────────────────────┘
└──────────────────────────────────────┘
```

### Mengapa Arsitektur Hybrid?
1. **Frontend di Edge**: Frontend SPA dilayani langsung dari 300+ data center Cloudflare melalui Workers Static Assets dengan waktu respon sub-50ms di seluruh Indonesia.
2. **Keamanan & Header di Edge**: CSP (*Content Security Policy*), HSTS, `X-Frame-Options`, dan `nosniff` disuntikkan langsung di edge.
3. **Database & ML Integrity**: Backend Express v5 menjalankan model prediksi XGBoost Python (`scripts/ml`) dan driver PostgreSQL TCP. Arsitektur hybrid menjamin 0% risiko regresi terhadap kalkulasi risiko longsor dan kestabilan database operasional BPBD.

---

## 2. Prasyarat Deployment

- **Node.js**: `v24.18.0` (sesuai `.node-version`)
- **pnpm**: `v11.11.0`
- **Cloudflare Account**: Akun Cloudflare aktif dengan domain terdaftar (opsional jika menggunakan `*.workers.dev`)
- **Wrangler CLI**: Terpasang atau dijalankan melalui `pnpm dlx wrangler` / `npx wrangler`

---

## 3. Konfigurasi File (`wrangler.jsonc`)

File konfigurasi utama terletak di root proyek: [`wrangler.jsonc`](../wrangler.jsonc).

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "landsafe",
  "main": "cloudflare/worker.ts",
  "compatibility_date": "2025-02-01",
  "compatibility_flags": [
    "nodejs_compat"
  ],
  "assets": {
    "directory": "./artifacts/landsafe/dist/public",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "html_handling": "auto-trailing-slash"
  },
  "vars": {
    "ENVIRONMENT": "production",
    "APP_NAME": "LANDSAFE",
    "API_ORIGIN": "http://127.0.0.1:5000"
  },
  "observability": {
    "enabled": true
  }
}
```

---

## 4. Langkah-Langkah Deployment

### Langkah 1: Login ke Cloudflare
```bash
npx wrangler login
```
Perintah ini akan membuka browser untuk mengautentikasi terminal Anda dengan akun Cloudflare.

### Langkah 2: Build Proyek Frontend & Backend
Pastikan seluruh paket lulus uji tipe dan terkompilasi bersih:
```bash
pnpm run build:cf
```
Perintah ini mengeksekusi:
1. `tsc --build` untuk pustaka internal (`@workspace/db`, `@workspace/api-client-react`, `@workspace/api-zod`)
2. `typecheck` untuk aplikasi web dan server
3. `vite build` yang menghasilkan bundle SPA di `artifacts/landsafe/dist/public`

### Langkah 3: Menentukan Secret & Variabel Environment
Tetapkan URL backend API yang aman (misalnya domain API server BPBD atau Cloudflare Tunnel endpoint):
```bash
npx wrangler secret put API_ORIGIN
# Masukkan nilai: https://api.landsafe.bpbd.go.id
```

Jika menggunakan Cloudflare Workers AI untuk akselerasi LIA Assistant di edge:
```bash
npx wrangler secret put CLOUDFLARE_API_TOKEN
```

### Langkah 4: Uji Coba Lokal (Wrangler Preview)
Jalankan emulasi edge lokal sebelum publish ke Cloudflare:
```bash
pnpm run preview:cf
```
Akses `http://localhost:8787` untuk memverifikasi routing SPA, header keamanan, dan health check edge di `http://localhost:8787/edge-health`.

### Langkah 5: Deploy ke Cloudflare Global Network
```bash
pnpm run deploy:cf
```
Wrangler akan mengunggah aset statis ke CDN Cloudflare dan menerbitkan Worker Edge. Output terminal akan menampilkan URL publik Worker Anda:
`https://landsafe.<subdomain>.workers.dev` atau domain kustom Anda.

---

## 5. Menghubungkan Backend Melalui Cloudflare Tunnel (Rekomendasi BPBD)

Jika server backend LANDSAFE berada di infrastruktur lokal BPBD atau private cloud:
1. Install `cloudflared` di server backend:
   ```bash
   # Linux Ubuntu/Debian
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared.deb
   ```
2. Buat tunnel aman:
   ```bash
   cloudflared tunnel create landsafe-backend-tunnel
   ```
3. Arahkan rute ke service Express lokal (port 5000):
   ```yaml
   # ~/.cloudflared/config.yml
   tunnel: <TUNNEL_UUID>
   credentials-file: /etc/cloudflared/<TUNNEL_UUID>.json
   ingress:
     - hostname: api.landsafe.bpbd.go.id
       service: http://localhost:5000
     - service: http_status:404
   ```
4. Jalankan tunnel:
   ```bash
   cloudflared tunnel run landsafe-backend-tunnel
   ```
Keuntungan: Server backend tidak perlu membuka port publik (zero open inbound ports), terlindung dari serangan DDoS oleh Cloudflare.

---

## 6. Opsi Akselerasi Database: Cloudflare Hyperdrive

Jika Anda ingin mengakses PostgreSQL langsung dari Edge Worker dengan pooling cerdas:
1. Buat konfigurasi Hyperdrive:
   ```bash
   npx wrangler hyperdrive create landsafe-db --connection-string="postgresql://landsafe_user:password@db-host:5432/landsafe"
   ```
2. Salin ID Hyperdrive yang dihasilkan ke dalam `wrangler.jsonc`:
   ```jsonc
   "hyperdrive": [
     {
       "binding": "HYPERDRIVE",
       "id": "abc12345def67890"
     }
   ]
   ```
3. Hyperdrive secara otomatis memelihara pool koneksi TCP tetap hangat dan memotong latensi TLS/handshake hingga 80%.

---

## 7. Verifikasi Pasca-Deployment

Periksa endpoint berikut setelah deployment selesai:
| Endpoint | Ekspektasi | Fungsi |
|---|---|---|
| `/edge-health` | HTTP 200 JSON `{ status: "ok", edge: "cloudflare-worker" }` | Verifikasi operasional Edge Worker |
| `/` | HTTP 200 HTML | Tampilan Portal Publik / Login BPBD |
| `/dashboard` | HTTP 200 SPA | Dashboard Pemantauan Bencana |
| `/api/health` | HTTP 200 JSON `{ status: "ok" }` | Verifikasi proxy ke Core Backend |
| Header `Content-Security-Policy` | Hadir di respons | Proteksi injeksi script berbahaya |
| Header `Strict-Transport-Security` | Hadir di respons HTTPS | Pemaksaan enkripsi TLS |

---

## 8. Rollback & Troubleshooting

- **Rollback Versi Deployment**:
  Cloudflare Workers mendukung rollback instan tanpa downtime:
  ```bash
  npx wrangler rollback [DEPLOYMENT_ID]
  ```
- **Error 502 Bad Gateway**:
  Edge Worker tidak dapat menghubungi origin backend. Periksa apakah server Express berjalan dan variabel `API_ORIGIN` terkonfigurasi dengan benar.
- **Log Realtime**:
  Pantau log interaksi dan error secara langsung melalui:
  ```bash
  npx wrangler tail
  ```
