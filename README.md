# Mi Tune

Mi Tune is a warm, terracotta-toned music and podcast application built with React and a Node/Python backend. It includes discovery, search, a shared audio-only player, lyrics, personal libraries and playlists, public profiles, friends, podcast episodes and a mobile-installable PWA.

Production URL: https://mi-tune.vercel.app

The music catalogue uses YouTube Music metadata through `ytmusicapi`. Audio extraction uses `yt-dlp`; this is an unofficial integration, not an official YouTube audio API. Spotify charts are used for ranking references only, never as an audio provider. Production playback and device installation must be checked on the deployed build; a successful build does not prove that the upstream audio provider accepts the host.

## Technologies

React 19, Vite 8, Tailwind CSS 4, Framer Motion, Lucide, Node.js 24 with `node:sqlite`, Python 3.10+, `ytmusicapi`, pinned `yt-dlp` with its EJS dependencies, FFmpeg/FFprobe, optional Google OAuth and private Vercel Blob snapshots.

## Requirements and installation

Install Node.js 24, pnpm 11.10.0, Python with venv support, and FFmpeg/FFprobe. Node 24 is also the JavaScript runtime used by the YouTube extractor. Linux system packages commonly include `python3-venv` and `ffmpeg`; install them with your distribution's package manager.

```sh
pnpm install --frozen-lockfile
pnpm setup:music
cp .env.example .env
pnpm build
pnpm start
```

Open http://127.0.0.1:5173. The Python setup now installs both catalogue and extractor dependencies in `.venv`; the environment example points `YT_DLP_BINARY` there. Do not commit your real `.env`.

For development, use two terminals:

```sh
pnpm server
pnpm dev
```

The backend listens on 5173; Vite listens on 5174 and proxies `/api` to it. The service worker is only registered for production builds on HTTPS or a browser-trusted localhost origin.

## Environment configuration

Configure runtime values in the hosting dashboard, not in client-side `VITE_` variables or committed files. Blank optional settings in `.env.example` are intentional.

| Variable | Purpose |
| --- | --- |
| `APP_ORIGIN` | Exact public origin, production `https://mi-tune.vercel.app`; used for trusted writes, secure cookies and OAuth redirects. |
| `APP_ALLOWED_ORIGINS` | Comma-separated additional trusted HTTPS origins; no wildcard. Leave empty unless needed. |
| `HOST`, `PORT` | Local defaults `127.0.0.1:5173`; the container exposes `0.0.0.0:8080`. |
| `MI_TUNE_DATA_DIR` | Local `./data`; the container uses `/var/lib/mi-tune` on a persistent host and `/tmp/mi-tune` on Vercel. |
| `MUSIC_PYTHON` | Python containing catalogue dependencies; container `/app/.venv/bin/python`. |
| `YT_DLP_BINARY` | Extractor executable; local `./.venv/bin/yt-dlp`, container uses PATH. |
| `YT_DLP_PLAYER_CLIENT` | Optional operator override. Empty uses the maintained extractor defaults. Do not assume a particular client bypasses restrictions. |
| `INVIDIOUS_INSTANCES` | Optional explicitly trusted HTTPS fallback instances, comma-separated; disabled by default. |
| `MI_TUNE_AUDIO_HOSTS` | Explicit additional audio-host allowlist; empty by default. Googlevideo hosts are validated separately. |
| `SOURCE_DEBUG` | `1` enables bounded server-side extractor diagnostics. Keep `0` normally. Never publish logs without checking for private data. |
| `CATALOG_REFRESH_MS` | Catalogue refresh interval, default 300000. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional server-only Google Web OAuth client. Local `GOOGLE_OAUTH_FILE` can refer to an owner-only JSON file instead. |
| `BLOB_READ_WRITE_TOKEN` | Optional private Blob snapshot credential; use Vercel's environment configuration, never Git. |
| `BLOB_STORE_ID`, `VERCEL_OIDC_TOKEN` | Alternative provider-managed Blob authentication; do not commit or manually copy deployment OIDC tokens. |
| `MI_TUNE_BLOB_RESTORE` | `1` explicitly enables restoring a missing local database from Blob outside Vercel. Vercel restore is automatic. |
| `MI_TUNE_MEDIA_SIGNING_KEY` | Required on Vercel: a private 32-byte base64url key, identical across production/preview, for verified song metadata across instances. Never put it in a `VITE_` variable or commit its value. |

Without Google credentials, username/password accounts remain available; Google sign-in is disabled. Google Cloud must list the actual HTTPS origin and `https://your-domain/api/auth/google/callback` as an authorized redirect URI. Do not send credentials in chat.

## Deployment

### Vercel

The root `Dockerfile` is the authoritative image. Set the Vercel framework to `container` and use `vercel.json`; a static frontend deployment cannot run the Python catalogue, extractor, SQLite backend, SSE or audio pipeline. The image installs pinned Python/EJS dependencies, Node 24 and FFmpeg, then builds the frontend with the frozen pnpm lockfile.

Link the existing project using the Vercel CLI or dashboard, configure the production environment, and deploy:

```sh
vercel link
vercel --prod
```

Set `APP_ORIGIN=https://mi-tune.vercel.app`. Any other production alias that users open must be explicitly listed in `APP_ALLOWED_ORIGINS`. Development-only HTTP origins are not accepted in production. Attach a private Blob store if retaining the current SQLite snapshot mechanism.
Configure `MI_TUNE_MEDIA_SIGNING_KEY` as an encrypted runtime variable before deploying. Generate it privately with Node's `crypto.randomBytes(32).toString('base64url')`; do not paste its value into chat or documentation. Local single-instance development can leave it empty.

Important limitations:

- Container Runtime is beta; instances can scale down and have bounded request duration. Long podcast streams and in-memory job/SSE state need a persistent backend for dependable operation.
- Vercel's local database and audio cache are ephemeral. Blob restores/snapshots are a personal single-writer workaround, not a transactional shared database. Concurrent instances can overwrite each other's changes. Independent backups and a real shared database are required before multi-user production use is considered safe.
- Source availability depends on extractor compatibility, EJS/Node support, source formats, expiring URLs, networking and provider restrictions. A 403, 429 or bot-check response is an upstream restriction, not something a new deployment can guarantee to fix.
- Moving to another cloud host alone does not guarantee YouTube access. Do not add cookies, hide an official video player or use random public proxies as a promised reliability fix.
- Respect Vercel plan terms and provider/content rights. No guarantee of unrestricted full-catalogue streaming is implied.

### Persistent container hosting

The same image supports a conventional container host with a durable disk mounted at `/var/lib/mi-tune`. Run a single backend writer, preserve that volume across releases, configure HTTPS and the real `APP_ORIGIN`, and proxy the exposed port. Do not migrate onto an ephemeral disk or publicly expose a development laptop as a shortcut. Rehosting requires the owner's chosen service and authorization; this repository does not provision paid resources.

## Mobile and PWA

The mobile interface retains Mi Tune's ivory/clay identity and uses a compact bottom-navigation/player layout, intentional content rails, touch-sized controls and mobile-specific page composition. Desktop remains the existing sidebar-oriented application.

The manifest, application icons and service worker provide a standalone installable shell. Android browsers that support `beforeinstallprompt` can show the in-app installation action. On iPhone/iPad, use Safari's Share menu and Add to Home Screen where supported. Installation is only confirmed by the browser's actual installed/standalone state, not by dismissing or accepting a guide.

Offline support caches application resources and permits reopening the shell. API requests, source streams and third-party provider data are not automatically cached. Explicit authorized downloads are separate from PWA shell caching. Search and uncached playback require a connection. Background audio and lock-screen behaviour in a PWA depend on browser/OS policy; the existing Android wrapper is a separate native option, not a guarantee for iOS.
See [mobile/PWA details](docs/PWA.md) and [playback/deployment architecture](docs/ARCHITECTURE.md) for cache policy, icon regeneration, metadata transfer and the remaining production boundaries.

## Project layout

```text
src/                 React pages, player, navigation and browser libraries
server/              HTTP API, accounts, migrations, catalogue, audio and podcasts
public/              Local artwork, manifest, application icons and registration
docs/                Mobile/PWA and production architecture notes
scripts/             Build/icon/container tools
tests/               Maintained unit/integration and opt-in Playwright regressions
android/             Optional Android/Media3 wrapper source
.github/workflows/   Build and syntax checks
Dockerfile           Single production image for Vercel and persistent hosts
vercel.json          Container framework and deployment region
.env.example         Empty/safe configuration template
```

Generated bundles, virtual environments, node_modules, user databases/cache, real environment files, signing keys, credentials, APKs and test reports do not belong in Git or the Docker context. Maintained tests belong in Git; one-off browser probes and generated reports do not.

## Development checks

```sh
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

The GitHub workflow performs a frozen install, build and backend syntax checks. Browser tests remain opt-in and may need local fixture services. The commands above are available to contributors; they are not evidence of tests being run on a release. Device installation, mobile layout, desktop regression and actual production music playback need user/device verification.

## API and troubleshooting

API routes are same-origin `/api` and use `{ "data": ... }` responses or `{ "error": { "code", "message" } }`. Sessions use HttpOnly cookies. Principal routes include health, auth/profile, discover/trending/search, tracks/stream/lyrics, media jobs, library/playlists/favorites, friends, podcasts and `/api/events`.

For audio failures, distinguish runtime dependencies, `SOURCE_RESTRICTED`, source format errors, expired upstream URLs and provider/network timeouts. The player must not report a generic success for a failed stream. Use bounded server diagnostics and the existing deployment logs without posting tokens or private database contents.

See [SECURITY.md](SECURITY.md) for secret handling, snapshot risks and responsible reporting. The repository does not yet declare an open-source license; public visibility alone does not grant redistribution rights.
