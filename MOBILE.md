# WC26 Ceefax — Native App (iOS + Android via Capacitor)

Capacitor wraps the **existing web build** (`dist/`) in native iOS + Android shells.
There is **one codebase**: the same `src/` powers both the Vercel website and the
apps. The website is unaffected — these are additive native targets.

## How it works
- The native app bundles the web build and loads it from `localhost` (offline-capable).
- Because the WebView origin is `localhost`, the app must call the **deployed** `/api`
  proxy. This is controlled by **`VITE_API_BASE`** at build time:
  - Web / dev → unset → `''` → same-origin (`/api/...`), unchanged.
  - **Native build → must set** `VITE_API_BASE=https://<your-vercel-domain>` so the app
    hits the live proxy. The edge functions already send `Access-Control-Allow-Origin: *`.
- `public/data/matches.json` and the fonts in `public/fonts/` are bundled → fixtures,
  groups, results and the retro fonts all work **offline**; live scores/preview show
  last-known when offline.
- Kick-off reminders are scheduled **on-device** (`src/lib/notifications.ts`,
  `@capacitor/local-notifications`) from `matches.json` — no backend required.

## Prerequisites
- Node (as for the web app).
- **iOS:** macOS + Xcode (or a cloud Mac CI: Codemagic / Ionic Appflow / EAS / GitHub macOS runners).
- **Android:** Android Studio (JDK + Android SDK).
- Accounts to publish: Apple Developer ($99/yr), Google Play ($25 once).

## Build & run locally
```bash
# build web with the prod API base, then copy into the native projects
VITE_API_BASE=https://<your-vercel-domain> npm run build:app

npx cap open ios        # opens Xcode      → Run on Simulator/device
npx cap open android    # opens Android Studio → Run on emulator/device
# or: npx cap run ios | npx cap run android
```
Re-run `npm run build:app` (which does `vite build && cap sync`) after any web change.

## App icons & splash (needs a source image)
Provide a `1024×1024` icon (and optional splash) PNG, then:
```bash
npm i -D @capacitor/assets
npx capacitor-assets generate            # writes all icon/splash sizes into ios/ + android/
```
(The in-app trophy is a CSS mosaic, not an asset — supply a real icon image for the stores.)

## Publishing
**iOS → App Store:** register the bundle id `app.wc2026.ceefax` + create the app in
App Store Connect → in Xcode set signing (your team) → **Product ▸ Archive ▸ Distribute ▸
App Store Connect** → test via **TestFlight** → fill listing + privacy nutrition label →
**Submit for review**.

**Android → Play:** create the app in Play Console (Data safety form, content rating,
privacy policy URL) → in Android Studio build a **signed AAB** (use Play App Signing) →
upload to **Internal testing** → promote to **Production**.

## Still to do (you / fast-follow)
- **Privacy policy URL** — required by both stores (host a page on the Vercel site).
- **App icon/splash** source image (above).
- **Remote push** (goal/live alerts): `@capacitor/push-notifications` + Firebase
  (`google-services.json` + APNs key) + a small sender (e.g. a Vercel cron). Local
  kick-off reminders already work without any of this.
- **ESPN ToS:** the preview uses ESPN's *unofficial* API — review acceptability for a
  *published* store app (consider an official/paid source for the store build).
