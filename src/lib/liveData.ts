// liveData.ts — live scores (football-data.org) + news headlines (BBC Sport RSS).
// All functions return empty data gracefully when keys are absent or network fails.
// The rest of the app treats live data as an optional enhancement over the fake fallback.

import { fakeResult } from './dataUtils';
import type { Match, LiveScore, MatchStatus, NewsItem } from './types';

// ── Config ─────────────────────────────────────────────────────────────────
// In dev: requests go via Vite proxy (/api/fd) — key added server-side, never in browser.
// In prod: direct football-data.org request — needs a serverless proxy for full security
//          (or set VITE_FD_KEY as an acceptable short-term alternative).
const WC_COMP = 'WC';   // football-data.org competition code for FIFA World Cup
const WC_YEAR = '2026';

const FD_SCORES_URL = import.meta.env.DEV
  ? `/api/fd/competitions/${WC_COMP}/matches?season=${WC_YEAR}`
  : (() => {
      const key = (import.meta.env.VITE_FD_KEY as string | undefined) ?? '';
      return key
        ? `https://api.football-data.org/v4/competitions/${WC_COMP}/matches?season=${WC_YEAR}`
        : null;  // no key in prod → graceful fallback to fake data
    })();

// Retain FD_KEY for non-dev direct requests
const FD_KEY = import.meta.env.DEV ? '' : ((import.meta.env.VITE_FD_KEY as string | undefined) ?? '');

// BBC Sport RSS endpoint
const BBC_FEED = 'https://feeds.bbci.co.uk/sport/football/rss.xml';
// Dev: use Vite server proxy (vite.config.ts routes /api/rss → BBC endpoint, no CORS issue).
// Prod: codetabs.com free CORS proxy — returns raw XML directly, no auth needed.
const RSS_URL = import.meta.env.DEV
  ? '/api/rss'
  : `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(BBC_FEED)}`;

// ── In-memory TTL cache ────────────────────────────────────────────────────
interface CacheEntry<T> { data: T; ts: number }
const _cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string, ttlMs: number): T | null {
  const e = _cache.get(key) as CacheEntry<T> | undefined;
  if (!e || Date.now() - e.ts > ttlMs) { _cache.delete(key); return null; }
  return e.data;
}
function setCached<T>(key: string, data: T): void {
  _cache.set(key, { data, ts: Date.now() });
}

// ── football-data.org types ────────────────────────────────────────────────
interface FDScore { fullTime: { home: number | null; away: number | null } }
interface FDMatch {
  utcDate:  string;
  status:   string;
  minute?:  number;
  score:    FDScore;
  homeTeam: { tla: string };
  awayTeam: { tla: string };
}
interface FDResponse { matches: FDMatch[] }

/**
 * Map football-data.org matches → our internal match numbers (1–104).
 * We match on kick-off UTC time (within 2 min) since both sources derive from the same schedule.
 */
function buildScoreMap(fdMatches: FDMatch[], localMatches: Match[]): Map<number, LiveScore> {
  const out = new Map<number, LiveScore>();
  for (const fd of fdMatches) {
    const fdMs   = new Date(fd.utcDate).getTime();
    const local  = localMatches.find(m => Math.abs(m.kickoffUTC - fdMs) < 2 * 60 * 1000);
    if (!local) continue;
    out.set(local.num, {
      home:   fd.score.fullTime.home ?? 0,
      away:   fd.score.fullTime.away ?? 0,
      status: fd.status as MatchStatus,
      minute: fd.minute,
    });
  }
  return out;
}

/**
 * Fetch live/final scores for WC2026 from football-data.org.
 * Requires VITE_FD_KEY env var (free tier: 10 req/min).
 * Returns empty Map when key is absent or request fails — app falls back to fake data.
 * Results are cached for 5 minutes.
 */
export async function fetchLiveScores(localMatches: Match[]): Promise<Map<number, LiveScore>> {
  const SCORE_TTL = 5 * 60 * 1000;
  const cached = getCached<Map<number, LiveScore>>('scores', SCORE_TTL);
  if (cached) return cached;

  if (!FD_SCORES_URL) {
    console.info('[liveData] No FD key configured — live scores disabled, using demo data');
    return new Map();
  }

  try {
    // In dev: key is injected by Vite proxy, no header needed here
    // In prod: attach key directly (until a serverless proxy is in place)
    const headers: HeadersInit = FD_KEY ? { 'X-Auth-Token': FD_KEY } : {};
    const res = await fetch(FD_SCORES_URL, { headers });
    if (!res.ok) throw new Error(`football-data.org ${res.status}: ${res.statusText}`);
    const json  = await res.json() as FDResponse;
    const map   = buildScoreMap(json.matches, localMatches);
    setCached('scores', map);
    console.info(`[liveData] ✓ scores — ${map.size} matches synced`);
    return map;
  } catch (err) {
    console.warn('[liveData] fetchLiveScores failed:', err);
    return new Map();
  }
}

// ── BBC Sport RSS ──────────────────────────────────────────────────────────
function parseRSS(xml: string): NewsItem[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return Array.from(doc.querySelectorAll('item'))
    .slice(0, 12)
    .map(el => ({
      title:       el.querySelector('title')?.textContent?.trim() ?? '',
      description: el.querySelector('description')?.textContent?.replace(/<[^>]+>/g, '').trim() ?? '',
      link:        el.querySelector('link')?.textContent?.trim() ?? '',
      pubDate:     el.querySelector('pubDate')?.textContent?.trim() ?? '',
    }))
    .filter(item => item.title.length > 0);
}

/**
 * Fetch latest BBC Sport football headlines.
 * Dev: via Vite server proxy (/api/rss). Prod: via codetabs.com CORS proxy.
 * Both return raw RSS XML. Results cached for 15 min. Returns [] on failure.
 */
export async function fetchNewsHeadlines(): Promise<NewsItem[]> {
  const NEWS_TTL = 15 * 60 * 1000;
  const cached = getCached<NewsItem[]>('news', NEWS_TTL);
  if (cached) return cached;

  try {
    const res = await fetch(RSS_URL);
    if (!res.ok) throw new Error(`RSS fetch ${res.status}`);
    const xml   = await res.text();
    const items = parseRSS(xml);
    setCached('news', items);
    console.info(`[liveData] ✓ news — ${items.length} items from BBC Sport`);
    return items;
  } catch (err) {
    console.warn('[liveData] fetchNewsHeadlines failed:', err);
    return [];
  }
}

// ── Score resolver ─────────────────────────────────────────────────────────
/**
 * Returns the best available score for a match:
 * - Live API data when the match is IN_PLAY, PAUSED, or FINISHED
 * - Deterministic fake score as fallback (keeps the demo looking alive)
 */
export function resolveScore(
  matchNum: number,
  liveScores: Map<number, LiveScore>
): { home: number; away: number } {
  const live = liveScores.get(matchNum);
  if (live && (live.status === 'FINISHED' || live.status === 'IN_PLAY' || live.status === 'PAUSED')) {
    return { home: live.home, away: live.away };
  }
  return fakeResult(matchNum);
}

// ── Match state helpers ────────────────────────────────────────────────────
/** True when a match has ended — uses API status if available, else the 110-min heuristic. */
export function isMatchFinished(
  matchNum: number,
  kickoffUTC: number,
  nowMs: number,
  liveScores: Map<number, LiveScore>
): boolean {
  const live = liveScores.get(matchNum);
  if (live) return live.status === 'FINISHED';
  return kickoffUTC + 110 * 60 * 1000 <= nowMs;
}

/** True when a match is currently in progress. */
export function isMatchLive(
  matchNum: number,
  kickoffUTC: number,
  nowMs: number,
  liveScores: Map<number, LiveScore>
): boolean {
  const live = liveScores.get(matchNum);
  if (live) return live.status === 'IN_PLAY' || live.status === 'PAUSED';
  return kickoffUTC <= nowMs && !isMatchFinished(matchNum, kickoffUTC, nowMs, liveScores);
}
