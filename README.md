# Mi Tune

Mi Tune adalah aplikasi musik dan podcast untuk web/PWA, dengan APK Android sebagai pelengkap. Katalog lagu, metadata, pencarian, dan audio memakai integrasi YouTube Music yang sudah ada; podcast punya katalog, kreator, dan episode terpisah. Spotify hanya dipakai sebagai referensi urutan chart, bukan sumber audio.

Aplikasi ini tidak memakai login/cookies akun YouTube dan tidak melewati DRM atau login wall.

## Demo

- Web/PWA: <https://mi-tune.vercel.app>
- Pencarian, chart, akun, playlist, podcast, dan PWA berjalan di Vercel.
- Streaming audio dari YouTube dapat gagal di Vercel karena YouTube memblokir IP datacenter. Detail dan solusinya ada di [Catatan penting deployment Vercel](#catatan-penting-deployment-vercel).

## Fitur

- Pencarian lagu YouTube Music dengan validasi `songs`, bukan video acak.
- Pemutar penuh: play/pause, seek, volume, previous/next, shuffle, repeat, queue.
- Chart global yang mengikuti referensi Top 50 Spotify, lalu dicocokkan ke hasil YouTube Music.
- Lirik dari LRCLIB, sinkron dengan audio clock, plus impor LRC pribadi.
- Koleksi: favorit, playlist public/private, cover playlist, profil publik.
- Akun Mi Tune, sesi HttpOnly, pertemanan, dan SSE untuk pembaruan.
- Podcast: discovery, kreator, show, episode, transkrip, resume, dan player yang sama.
- PWA: manifest, service worker, instal, dan koleksi unduhan offline.
- APK Android dengan Media3/ExoPlayer untuk pemutaran background.

## Teknologi

React 19, Vite 8, Tailwind CSS v4, Framer Motion, Node.js 24, SQLite (`node:sqlite`), Python (`ytmusicapi`), `yt-dlp`, dan FFmpeg.

## Menjalankan di lokal

Prasyarat:

- Node.js 24+
- pnpm 11+
- Python 3.10+
- `yt-dlp` dan `ffmpeg` tersedia di `PATH`

Langkah:

```bash
pnpm install
pnpm setup:music          # membuat .venv dan memasang ytmusicapi
cp .env.example .env      # opsional; ubah APP_ORIGIN bila perlu
pnpm build
pnpm start
```

Buka <http://127.0.0.1:5173>.

Mode development memakai dua terminal:

```bash
pnpm server   # backend di 127.0.0.1:5173
pnpm dev      # frontend di 127.0.0.1:5174, proxy /api ke backend
```

Service worker hanya aktif pada build produksi, bukan mode dev. PWA di HP memerlukan origin HTTPS; `localhost` desktop dikecualikan oleh browser.

## Environment variables

Salin `.env.example` menjadi `.env`. Jangan commit `.env`.

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `APP_ORIGIN` | Production | Origin publik aplikasi, mis. `https://mi-tune.vercel.app`. Dipakai untuk cookie `Secure` dan redirect OAuth. |
| `GOOGLE_CLIENT_ID` | Tidak | Client ID OAuth Google bertipe **Web application**. |
| `GOOGLE_CLIENT_SECRET` | Tidak | Client secret OAuth Google. Jangan taruh di frontend. |
| `GOOGLE_OAUTH_FILE` | Tidak | Path JSON client OAuth (`web`), alternatif dari dua variabel di atas. |
| `MI_TUNE_DATA_DIR` | Tidak | Direktori data. Default `./data`. Di Vercel diarahkan ke `/tmp/mi-tune`. |
| `HOST` / `PORT` | Tidak | Default `127.0.0.1:5173`. Container memakai `0.0.0.0:8080` atau `$PORT`. |
| `CATALOG_REFRESH_MS` | Tidak | Interval refresh chart. Default 300000 (5 menit). |
| `YT_DLP_BINARY` | Tidak | Path binary `yt-dlp` bila tidak ada di `PATH`. |
| `YT_DLP_PLAYER_CLIENT` | Tidak | Daftar client `yt-dlp`, mis. `visionos` atau `web`. Kosong = default `yt-dlp`. |
| `INVIDIOUS_INSTANCES` | Tidak | Daftar instance Invidious dipisah koma untuk fallback audio, mis. `https://invidious.example`. Kosong = fallback nonaktif. |
| `MI_TUNE_AUDIO_HOSTS` | Tidak | Daftar domain tambahan yang boleh dipakai sebagai sumber audio (selain `*.googlevideo.com`). Default `chocolatemoo53.com`. |
| `MUSIC_PYTHON` | Tidak | Path Python yang punya `ytmusicapi`. Default `.venv/bin/python`. |
| `BLOB_READ_WRITE_TOKEN` | Vercel | Token Vercel Blob untuk menyimpan snapshot SQLite. Biasanya diisi otomatis saat store dihubungkan. |
| `BLOB_STORE_ID` | Vercel | ID Blob store; dipakai bersama OIDC Vercel. |

Google login bersifat opsional. Tanpa kredensial OAuth, halaman login Google tidak aktif, tetapi akun Mi Tune dengan username/password tetap berfungsi.

## Deploy ke Vercel

Repo ini sudah menyertakan `Dockerfile.vercel` dan `vercel.json`. Vercel menjalankan aplikasi sebagai **Container Runtime** (beta) karena backend membutuhkan Python, `yt-dlp`, dan FFmpeg. Jangan mengubah project menjadi static site: API, SQLite, SSE, dan streaming audio akan hilang.

### 1. Login dan hubungkan project

```bash
vercel login
vercel link          # buat project baru, framework: container
```

Atau hubungkan repo GitHub lewat dashboard Vercel. Jika Vercel salah mendeteksi framework, set:

```bash
vercel project update --framework container --yes
```

### 2. Buat Blob store untuk data

Vercel Functions memakai filesystem sementara. Agar akun, playlist, favorit, dan session tidak hilang saat instance scale-down, aplikasi menyimpan snapshot SQLite ke Vercel Blob secara berkala.

```bash
vercel blob create-store mi-tune-data --access private --yes
```

Perintah ini menghubungkan store ke project dan menambahkan kredensial Blob. Aplikasi membaca `BLOB_READ_WRITE_TOKEN` atau pasangan `BLOB_STORE_ID` + OIDC.

### 3. Set origin

Setelah project punya domain produksi:

```bash
vercel env add APP_ORIGIN production
# isi: https://<project>.vercel.app
```

`APP_ORIGIN` harus sama dengan origin yang dibuka pengguna. Untuk Google OAuth, daftarkan juga redirect URI:

```text
https://<project>.vercel.app/api/auth/google/callback
```

### 4. Deploy

```bash
vercel --prod
```

Build dilakukan di Vercel: frontend di-build, dependency Python dipasang, lalu image dijalankan sebagai Function. Cek kesehatan:

```bash
curl https://<project>.vercel.app/api/health
```

### Catatan penting deployment Vercel

- Container Runtime masih **beta**. Perilakunya bisa berubah.
- Filesystem hanya `/tmp` dan hilang saat instance berhenti. Snapshot SQLite disinkronkan ke Vercel Blob, tetapi ini dirancang untuk penggunaan personal/single-instance. Jika beberapa instance menulis bersamaan, perubahan terakhir bisa menimpa yang lain.
- Function memiliki batas durasi (Hobby 300 detik). Lagu normal selesai dalam batas ini; podcast atau audio yang lebih panjang dari 5 menit bisa terputus di tengah streaming.
- `yt-dlp` berjalan dari IP datacenter Vercel. YouTube sering membalas **429 / “Sign in to confirm you’re not a bot”** untuk IP seperti ini, sehingga **streaming audio bisa gagal** meskipun pencarian, chart, akun, dan playlist tetap berjalan. Ini batasan IP, bukan bug aplikasi.
- Fallback `INVIDIOUS_INSTANCES` bisa dicoba, tetapi instance publik sering ikut memblokir IP datacenter. Solusi yang stabil: jalankan backend di VPS/host dengan IP non-datacenter, atau gunakan proxy/cookies YouTube di server. Jangan commit cookies atau kredensial ke repo.
- Vercel Hobby ditujukan untuk proyek personal non-komersial. Tinjau ketentuan Vercel dan hak konten sebelum memakai aplikasi secara publik.

## Google OAuth (opsional)

1. Buat OAuth Client bertipe **Web application** di Google Cloud Console.
2. Daftarkan redirect URI development: `http://127.0.0.1:5173/api/auth/google/callback`.
3. Daftarkan redirect URI production: `https://<domain>/api/auth/google/callback`.
4. Isi `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` di `.env` lokal atau Environment Variables Vercel.
5. Restart/redeploy.

Jangan pernah mengirim client secret ke chat, commit ke repo, atau memasukkannya ke kode frontend. Endpoint `/api/auth/google/config` hanya mengembalikan status kesiapan dan URL, bukan secret.

## Android

APK debug berada di `android/app/build/outputs/apk/debug/app-debug.apk` setelah build. Wrapper Android memuat aplikasi dari alamat server yang dipilih di layar awal; alamat harus bisa diakses HP (bukan `localhost` desktop).

Build dengan Android SDK 36 dan Gradle 9.1:

```bash
cd android
gradle --no-daemon --max-workers=1 :app:assembleDebug :app:testDebugUnitTest
```

Pengujian perangkat fisik tetap diperlukan untuk memastikan audio background, notifikasi, dan pembatasan baterai OEM berjalan sesuai perangkat.

## Struktur proyek

```text
server/            Backend HTTP, SQLite, auth, musik, podcast, lirik
src/               React app, komponen, halaman, library frontend
public/            Manifest, ikon, service worker helper, artwork
scripts/           Build service worker, verifikasi, utilitas container
android/           Wrapper Android/Media3
tests/             Tes Node dan Playwright
Dockerfile         Image produksi umum
Dockerfile.vercel  Image untuk Vercel Container Runtime
vercel.json        Konfigurasi project Vercel
```

## API ringkas

Semua endpoint same-origin di `/api`. Respons sukses `{ "data": ... }`; error `{ "error": { "code", "message" } }`. Session memakai cookie HttpOnly; tidak ada token/password di `localStorage`.

- `GET /api/health`
- `GET /api/auth/me`, `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- `GET/PATCH /api/profile`, `POST /api/auth/password`
- `GET /api/discover`, `GET /api/trending`, `GET /api/search?q=...`
- `GET /api/tracks/:trackId`, `.../cover`, `.../stream`, `.../lyrics`, `.../download`
- `POST /api/media/jobs`, `GET /api/media/jobs/:id`
- `GET /api/library`, `POST /api/playlists`, `PATCH/DELETE /api/playlists/:id`, `PUT /api/playlists/:id/tracks`
- `PUT /api/favorites/:trackId`
- `GET /api/friends`, `POST /api/friend-requests`, `PATCH/DELETE /api/friend-requests/:id`
- `GET /api/podcasts/discover`, `GET /api/podcasts/search`, `.../creators/:id`, `.../shows/:id`, `.../episodes/:id`
- `GET /api/events` (SSE)

## Keamanan dan data

- `.env`, `.env.local`, `data/`, database SQLite, token, dan file kredensial sudah di-ignore oleh Git.
- Jangan commit `.env` atau JSON client OAuth. Gunakan `.env.example` sebagai template.
- File yang sengaja **tidak** di-commit: `.env`, `.env.local`, file OAuth/cookies/token, `data/` (SQLite + cache media), `dist/`, `node_modules/`, `.venv/`, `.vercel/`, hasil test (`test-results/`, `playwright-report/`, `coverage/`), dan artefak build Android (`*.apk`, `*.aab`, `android/build/`).
- File yang **di-commit** adalah source, konfigurasi, dokumentasi, aset publik, serta `Dockerfile`/`Dockerfile.vercel`/`vercel.json` yang dibutuhkan untuk build dan deploy.
- Di Vercel, data pengguna disimpan di SQLite sementara dan disinkronkan ke Blob store private. Backup rutin tetap disarankan.
- Integrasi YouTube Music/`yt-dlp` bersifat tidak resmi. Gunakan hanya untuk konten yang kamu miliki atau punya izin, dan patuhi ketentuan layanan penyedia.

## Lisensi

Belum ada lisensi open source yang ditetapkan. Tambahkan `LICENSE` sebelum mendistribusikan ulang.
