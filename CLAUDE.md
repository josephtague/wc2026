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
npm run dev                          # local dev server (port 5173)
npm run build                        # production build
npx tsc --noEmit                     # type-check only
python3 scripts/convert-schedule.py  # regenerate matches.json from xlsx
```

## Project Structure
```
/data/World_Cup_2026_Schedule.xlsx   # source schedule (do not edit matches.json directly)
/scripts/convert-schedule.py         # xlsx → public/data/matches.json
/public/data/matches.json            # 104 WC2026 fixtures (generated)
/src
  /components
    TeletextApp.tsx     # TV chassis, remote, page router, SubHeader, LiveTicker, all app state
    TeletextViews.tsx   # Page components: News, Fixtures, Results, Groups, GroupDetail, MatchReview
  /lib
    types.ts            # All shared TypeScript interfaces (inc. TZKey union)
    dataUtils.ts        # Match loading, TZ_ZONES, TZ_ORDER, TZ_CITY, timezone helpers
    liveData.ts         # football-data.org scores + BBC RSS fetch + TTL cache
    teletextData.ts     # Derived data: standings, headlines, scorers, match narratives
  teletext.css          # All styles — TV chassis, CRT effects, remote, page content, mobile
  main.tsx              # React entry point
  vite-env.d.ts         # Vite type reference
```

## API Keys — Security Critical
- `VITE_FD_KEY` lives in `.env.local` (gitignored) — **NEVER commit, never expose in browser bundle**
- In dev: Vite server proxy injects the key server-side (`vite.config.ts`)
- BBC RSS proxy: `/api/rss` in dev (User-Agent header required), `codetabs.com` CORS proxy in prod
- football-data.org proxy: `/api/fd` in dev (key injected by Vite), direct in prod

## Pages (Ceefax page numbers)
| Page | ID | Description |
|------|----|-------------|
| P100 | `news` | BBC Sport headlines · next kick-off (2/3) + golden boot (1/3) · scrollable |
| P140 | `fixtures` | Upcoming match cards (time · teams · stage/city) · scrollable, no pagination |
| P141 | `results` | Final scores, most recent first |
| P150 | `groups` | All 12 group tables in 2-col grid · tap card → Group Detail |
| P151 | `groupdet` | Single group — standings + match-by-match · ◄/► in subtitle bar to cycle groups |
| P160 | `review` | Match report — score, stats · accessible by tapping a result row |

## Navigation Model (Fastext bar)
The fastext bar at the bottom of the CRT always shows 4 buttons. Labels change contextually:

| Page | Red | Green | Yellow | Cyan |
|------|-----|-------|--------|------|
| News / Fixtures | NEWS | FIXTURES | RESULTS | GROUPS |
| Results | NEWS | FIXTURES | MATCH REPORT | GROUPS |
| Match Report | NEWS | FIXTURES | RESULTS | GROUPS |
| Groups | NEWS | FIXTURES | RESULTS | GROUP DETAIL |
| Group Detail | NEWS | FIXTURES | RESULTS | GROUPS |

Drill-down pages (Group Detail, Match Report) are only reachable by tapping into them from their parent page — not via direct fastext links from News/Fixtures.

## Timezones (11 cities, west → east)
`TZ_ORDER` in `dataUtils.ts`: `PT · CDM · ET · BRT · ART · LDN · PAR · DXB · SHA · TYO · SYD`

Display labels (`TZ_CITY`): `LA · CDMX · NY · SAO · BUE · LON · PAR · DXB · SHA · TYO · SYD`

Internal keys are stable (match JSON field names where applicable). Mexico permanently on CST (UTC−6, no DST since 2023).

## Key Design Decisions
- **No fake/demo data** — `resolveScore()` returns `null` (shows `—`) when no confirmed result exists
- **Real clock always** — `now = Date.now()` — no demo offset
- **Mobile layout** ≤767px — screen portrait (`aspect-ratio: 4/7`, max-height capped to fit viewport) on top; compact remote bar below with fastext dots, TZ row (11 buttons, `repeat(11,1fr)`), and ticker
- **CRT scroll** — `.tt__body` has `overflow-y: auto` on mobile (hidden scrollbar) so all page content is reachable by scrolling; no pagination
- **News page order** (mobile) — countdown + golden boot side-by-side at top, then ★ HEADLINE, then IN THE NEWS items
- **News drawer** — tapping a BBC headline slides up an overlay with full text + BBC Sport link
- **Live ticker** — remote footer rotates every 4s: next match / live count → top scorer → BBC headline → last updated
- **Fixtures** — match card layout (time badge · home v away · stage/city sub-line); no pagination
- **Group Detail** — ◄ / ► inline with subtitle "GROUP A · FULL TABLE · MATCH-BY-MATCH" to cycle all 12 groups
- **SubHeader** — `SubHeader` component in `TeletextApp.tsx` renders all page subtitles; group detail navigation buttons live here

## CSS Conventions
- All teletext colors via CSS custom properties (`--tt-red`, `--tt-yellow`, etc.)
- Color utility classes: `.c-r` `.c-g` `.c-y` `.c-c` `.c-w` `.c-m` `.c-dim`
- Mobile overrides are all in a single `@media (max-width: 767px)` block at the bottom of `teletext.css`
- No changes to the mobile block without also verifying on a 375px viewport

## Behaviour Rules
- Never use `any` type in TypeScript
- Keep components under 200 lines — split if longer
- All score/standings logic in `teletextData.ts` or `liveData.ts` — never in components
- The `TZKey` union type in `types.ts` must stay in sync with `TZ` and `TZ_CITY` in `dataUtils.ts`
