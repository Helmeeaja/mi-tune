# Security

Do not open a public issue containing secrets, cookies, database snapshots, passwords or personally identifiable account data. Use GitHub private vulnerability reporting when enabled; otherwise contact the repository owner privately without attaching secrets.

## Configuration

- Keep actual environment files, OAuth JSON, signing keys, provider tokens and SQLite databases outside Git and the Docker context.
- `.env.example` contains empty placeholders only. Browser bundles must never contain `GOOGLE_CLIENT_SECRET`, Blob tokens or server credentials. A `VITE_` variable is public.
- Use HTTPS and an exact `APP_ORIGIN`. Allow additional trusted HTTPS aliases explicitly with `APP_ALLOWED_ORIGINS`; never use a wildcard.
- Keep `MI_TUNE_MEDIA_SIGNING_KEY` server-only and encrypted in the host environment. Public metadata proofs are scoped to an exact verified track, not account authentication; never trust unsigned client metadata on a fresh instance.
- Keep the Blob store private. Snapshots contain account/session data and need access control, retention and independent backups.
- Restore errors must fail closed rather than starting a blank database and overwriting an existing snapshot.
- Blob snapshots are not a multi-writer database. For concurrent production instances, move the account store to a transactional shared database before calling the application production-ready.
- Only configure an additional audio host or Invidious instance that you operate or explicitly trust. No third-party proxy is trusted by default. Do not add YouTube cookies or mechanisms for bypassing DRM, account checks or provider restrictions.
- Keep the pinned extractor/EJS runtime current and review provider terms and content permissions. Audio-only extraction is unofficial and availability is not guaranteed.

## Browser caching

The service worker caches the application shell and static resources, not API responses, private account data or music streams. Explicit downloads are separate, user-initiated operations and require appropriate content rights.
