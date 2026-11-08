# Playback and production architecture

## Request flow

Music metadata comes from the existing YouTube Music catalogue adapter. Browser playback assigns the same-origin stream URL and calls the shared audio element from the user's interaction, rather than waiting for a download job and losing the mobile playback gesture.

The Node endpoint resolves an audio-only source for that request, validates its host/path/content type, forwards supported byte ranges and refreshes an expired source on a bounded retry. If direct audio is unavailable, conversion can finish while that HTTP request remains active. Explicit downloads also prepare and serve the completed file in one request; the PWA does not depend on polling a process-local job on another server instance.

The container includes Node 24, FFmpeg/FFprobe and the pinned `yt-dlp[default]` installation with bundled EJS dependencies. Extractor calls explicitly enable the packaged Node JavaScript runtime. This fixes packaging prerequisites; it does not grant access to blocked or licensed content.

## Stateless metadata transfer

Vercel may route search, cover, lyrics and playback requests to different container instances. An in-memory catalogue registration on the search instance is not a reliable prerequisite for a later stream request.

The backend therefore signs its verified public song metadata using the server-only `MI_TUNE_MEDIA_SIGNING_KEY`. API responses carry a public metadata proof. Media requests include that proof; another instance checks its signature, exact track identity and catalogue constraints before hydrating its local registration. The key is never sent to the browser, committed to Git or embedded in a bundle.

Proofs contain public song metadata, not account/session credentials or an upstream signed media URL. They are not permission to bypass provider restrictions. The actual source is resolved separately. Keep the private key stable across production and preview deployments; rotating it invalidates old proofs until clients refresh their song metadata.

Vercel overwrites its forwarded client-IP headers. Rate limiting uses a validated platform-provided address only on Vercel, not a caller-supplied proxy header on a conventional host. Music responses use `private, no-store`; immutable hashed app assets can be cached independently.

## Database boundary

SQLite on Vercel is local to an instance. Private Blob snapshots provide recovery and backup, not a transactional multi-writer database. Restore rejects unreadable, empty or incorrectly formatted snapshots rather than starting a blank database and overwriting the remote copy. Private mutations await a serialized snapshot write before a successful JSON response.

These safeguards do not remove cross-instance write races. Google OAuth's in-memory pending state and legacy SSE/job coordination have similar deployment boundaries. A transactional shared account store and durable coordination are required before the entire application can honestly be labelled safe for concurrent multi-user production. No database migration or paid infrastructure is provisioned automatically.

## Diagnostics and provider limitations

Inspect the actual deployed backend/runtime logs and response error codes. Possible causes include missing EJS/Node dependencies, unregistered instance-local metadata, origin checks, codec/range handling, source expiration, networking, rate limits and upstream 403/429/bot checks. Do not attribute every failure to YouTube without evidence.

`SOURCE_DEBUG=1` enables bounded server-side extractor diagnostics. Keep it off normally and review logs before sharing them. Do not configure random public proxies, export user cookies, conceal a video player or claim unrestricted playback. Audio-only extraction is unofficial; a reliable licensed provider remains the appropriate alternative if the host is refused by the upstream service.

Production playback, provider access, console behaviour and physical-device acceptance remain explicit release gates. A local build, a metadata startup check or a deployment marked READY is not a production playback test.
