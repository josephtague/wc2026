# World Cup 2026 Teletext Dashboard — Claude Code Context

## Project Overview
A retro BBC Ceefax / Teletext-styled World Cup 2026 live dashboard. Built as a Vite + React 18 + TypeScript SPA with a pixel-perfect old-TV chassis aesthetic, live scores from football-data.org, and BBC Sport RSS news.

## Stack
- **Framework:** Vite + React 18
- **Language:** TypeScript (strict mode)
- **Styling:** `teletext.css` — single flat CSS file, no Tailwind, no CSS modules
- **Live data:** football-data.org (scores) + BBC Sport RSS (news headlines)
- **Package Manager:** npm
- **Dev server:** `npm run dev` → http://localhost:5173

## Commands
```
npm run dev      # local dev server (port 5173)
npm run build    # production build
npx tsc --noEmit # type-check only
```

## Project Structure
```
/public/data/matches.json    # 104 WC2026 fixtures (generated from xlsx)
/src
  /components
    TeletextApp.tsx          # TV chassis, remote control, page router, all app state
    TeletextViews.tsx        # Page components: News, Fixtures, Results, Groups, GroupDetail, MatchReview
  /lib
    types.ts                 # All shared TypeScript interfaces
    dataUtils.ts             # Match loading, timezone helpers, time formatting
    liveData.ts              # football-data.org scores + BBC RSS fetch + TTL cache
    teletextData.ts          # Derived data: standings, headlines, scorers, match narratives
  teletext.css               # All styles — TV chassis, CRT effects, remote, page content, mobile
  main.tsx                   # React entry point
  vite-env.d.ts              # Vite type reference
```

## API Keys — Security Critical
- `VITE_FD_KEY` lives in `.env.local` (gitignored) — **NEVER commit, never expose in browser bundle**
- In dev: Vite server proxy injects the key server-side (`vite.config.ts`)
- In prod: direct request with key (short-term); long-term: serverless proxy

## Pages (Ceefax page numbers)
| Page | ID | Description |
|------|----|-------------|
| P100 | `news` | BBC Sport headlines + next kick-off countdown |
| P140 | `fixtures` | Upcoming fixtures, paginated, timezone-aware |
| P141 | `results` | Final scores, most recent first |
| P150 | `groups` | All 12 group tables |
| P151 | `groupdet` | Single group detail — table + head-to-head |
| P160 | `review` | Match report — score, stats, pick any match |

## Key Design Decisions
- **No fake/demo data** — `resolveScore()` returns `null` (shows `—`) when no confirmed result exists
- **Real clock always** — `now = Date.now()` — no demo offset
- **8 timezones:** PT · ET · BRT · ART · LDN · PAR · MUM · SYD
- **Mobile:** stacked layout ≤767px — screen portrait (3/4 aspect ratio) on top, compact remote bar below
- **News drawer:** tapping a BBC headline slides up an overlay with full text + BBC Sport link
- **Live ticker:** remote footer rotates every 4s — live count → top scorer → last updated

## CSS Conventions
- All teletext colors via CSS custom properties (`--tt-red`, `--tt-yellow`, etc.)
- Color utility classes: `.c-r` `.c-g` `.c-y` `.c-c` `.c-w` `.c-m` `.c-dim`
- Mobile overrides are all in a single `@media (max-width: 767px)` block at the bottom of `teletext.css`
- No changes to the mobile block without also verifying on a 375px viewport

## Behaviour Rules
- Never use `any` type in TypeScript
- Keep components under 200 lines — split if longer
- All score/standings logic in `teletextData.ts` or `liveData.ts` — never in components
- BBC RSS proxy: `/api/rss` in dev, `codetabs.com` CORS proxy in prod
- football-data.org proxy: `/api/fd` in dev (key injected by Vite), direct in prod
