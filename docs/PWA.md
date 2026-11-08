# Mobile and PWA

Mi Tune uses a separate mobile Home composition below 1024px. The desktop record-stack hero is not mounted on small screens. Navigation is organised around Home, Search, Library and Podcasts; the header menu keeps Downloads, Friends, Favorites, playlist creation, profile, settings and installation accessible without crowding the bottom bar.

The mini player shares the same global audio element as the full song/episode pages. It is hidden when the active track's full player is open, not unmounted with page navigation. Safe-area insets and player/navigation clearance are handled for portrait, narrow phones, tablets and standalone mode. Forms use mobile-safe input sizes; song actions open a focus-managed native dialog sheet.

## Installation

Use the HTTPS production origin. Android Chrome/Edge can use the in-app install action when `beforeinstallprompt` is available. On supported iPhone/iPad versions, open Safari, choose Share, then Add to Home Screen. Browser policy controls availability; an accepted guide is not proof of installation.

The manifest supplies separate regular and maskable 192/512px icons. A 180px Apple touch icon and portrait/landscape startup artwork for common iPhone/iPad dimensions are included. Status-bar settings, theme-color updates and `viewport-fit=cover` work with the safe-area layout. Device-specific behaviour must still be checked on a physical phone.

Regenerate brand icons and startup artwork with:

```sh
pnpm install --frozen-lockfile
node scripts/render-icon.mjs
```

The renderer uses the existing SVG and a pinned development-only SVG renderer; it does not start a browser or require a user-specific executable path. If device media rules change, keep the startup links in `index.html` consistent with the emitted files.

## Cache policy

The generated worker precaches local application resources: HTML, JavaScript, CSS, fonts, icons and local artwork. It does not write API responses, authentication data, third-party URLs or music streams to cache. API/media failures are not replaced with successful synthetic responses.

Previously confirmed, user-requested downloads are a separate feature. Only complete audio files and their covers are stored by the download module after the user confirms appropriate rights; the worker can serve those existing files, including byte ranges. Ordinary listening does not create offline copies. Provider terms and content permissions still apply.

Navigation uses a bounded network request with the precached app shell as its offline fallback. A new worker retains the previous shell cache so already-open tabs can still load their older hashed chunks. Updates show a dismissible notice and never automatically reload an active player.

Offline installation does not provide an offline catalogue. Search, unsaved audio and fresh provider data still require internet. iOS background playback, lock-screen controls, installation and splash behaviour depend on browser/OS policy and are not guaranteed by a manifest alone.

## Release gate

Build output and valid icon dimensions are technical checks, not device acceptance. The owner must check installation, standalone launch, navigation while playing, safe areas, search, seeking, next/previous, library actions, offline reopening and desktop regressions on the deployed version. No Android/iOS device or browser playback pass is implied by this documentation.
