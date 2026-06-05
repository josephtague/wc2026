// liveData.ts — live scores (football-data.org) + news headlines (BBC Sport RSS).
// Score data is real-only: resolveScore returns null when no confirmed result is available.
// All network functions return empty data gracefully on failure — no fake fallback.

import type { Match, LiveScore, MatchStatus, NewsItem, TopScorer } from './types';

// ── Config ─────────────────────────────────────────────────────────────────
// All live data is fetched through same-origin /api/* endpoints so API keys stay
// server-side. In dev these are handled by the Vite proxy (vite.config.ts); in
// prod by the Vercel serverless functions in /api. No key ever reaches the browser.
const WC_COMP = 'WC';   // football-data.org competition code for FIFA World Cup
const WC_YEAR = '2026';

const FD_BASE          = `/api/fd/competitions/${WC_COMP}`;
const FD_SCORES_URL    = `${FD_BASE}/matches?season=${WC_YEAR}`;
const FD_SCORERS_URL   = `${FD_BASE}/scorers`;
const FD_STANDINGS_URL = `${FD_BASE}/standings`;
const RSS_URL          = '/api/rss';

// ── In-memory TTL cache ────────────────────────────────────────────────────
interface CacheEntry<T> { data: T; ts: number }
const _cache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string, ttlMs: number): T | null {
  const e = _cache.get(key) as CacheEntry<T> | undefined;
  if (!e || Date.now() - e.ts > ttlMs) { _cache.delete(key); return null; }
  return e.data;
}
export function setCached<T>(key: string, data: T): void {
  _cache.set(key, { data, ts: Date.now() });
}

// ── football-data.org types ────────────────────────────────────────────────
interface FDScore { fullTime: { home: number | null; away: number | null } }
interface FDMatch {
  id:       number;     // football-data.org match id — needed to cross-link providers
  utcDate:  string;
  status:   string;
  minute?:  number;
  score:    FDScore;
  homeTeam: { tla: string };
  awayTeam: { tla: string };
}
interface FDResponse { matches: FDMatch[] }

// internal match num (1–104) → football-data.org match id, built during buildScoreMap
const _fdIdByNum = new Map<number, number>();
/** football-data.org match id for our internal match number, if known. */
export function fdIdForMatch(num: number): number | undefined { return _fdIdByNum.get(num); }

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
    _fdIdByNum.set(local.num, fd.id);
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
 * Fetch live/final scores for WC2026 via the same-origin /api/fd proxy
 * (key injected server-side). Returns an empty Map on failure — never fake data.
 * Results are cached for 5 minutes.
 */
export async function fetchLiveScores(localMatches: Match[]): Promise<Map<number, LiveScore>> {
  const SCORE_TTL = 5 * 60 * 1000;
  const cached = getCached<Map<number, LiveScore>>('scores', SCORE_TTL);
  if (cached) return cached;

  try {
    const res = await fetch(FD_SCORES_URL);
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

// ── football-data.org top scorers (real Golden Boot) ─────────────────────────
interface FDScorer {
  player: { name: string };
  team:   { tla?: string; shortName?: string; name: string };
  goals:  number | null;
}
interface FDScorersResponse { scorers: FDScorer[] }

/**
 * Fetch the real tournament top scorers from football-data.org.
 * Returns [] when unavailable (pre-tournament, no goals yet, or request failure).
 * Cached for 15 minutes.
 */
export async function fetchScorers(limit = 8): Promise<TopScorer[]> {
  const TTL = 15 * 60 * 1000;
  const cached = getCached<TopScorer[]>('scorers', TTL);
  if (cached) return cached;

  try {
    const res = await fetch(FD_SCORERS_URL);
    if (!res.ok) throw new Error(`scorers ${res.status}`);
    const json = await res.json() as FDScorersResponse;
    const out: TopScorer[] = (json.scorers ?? [])
      .map(s => ({ name: s.player.name, team: s.team.tla ?? s.team.shortName ?? s.team.name, goals: s.goals ?? 0 }))
      .slice(0, limit);
    setCached('scorers', out);
    return out;
  } catch (err) {
    console.warn('[liveData] fetchScorers failed:', err);
    return [];
  }
}

// ── football-data.org standings (real group tables) ──────────────────────────
export interface FDStandingRow {
  position: number;
  team: { tla?: string; name: string };
  playedGames: number; won: number; draw: number; lost: number;
  points: number; goalsFor: number; goalsAgainst: number; goalDifference: number;
}
interface FDStandingsResponse { standings: { group: string | null; table: FDStandingRow[] }[] }

/**
 * Fetch official group standings from football-data.org, keyed by group name
 * (e.g. "GROUP A"). Returns null when unavailable. Cached for 15 minutes.
 * Not yet wired into the UI — reserved for qualification scenarios.
 */
export async function fetchStandings(): Promise<Record<string, FDStandingRow[]> | null> {
  const TTL = 15 * 60 * 1000;
  const cached = getCached<Record<string, FDStandingRow[]>>('standings', TTL);
  if (cached) return cached;

  try {
    const res = await fetch(FD_STANDINGS_URL);
    if (!res.ok) throw new Error(`standings ${res.status}`);
    const json = await res.json() as FDStandingsResponse;
    const out: Record<string, FDStandingRow[]> = {};
    for (const s of json.standings ?? []) {
      if (s.group) out[s.group.toUpperCase()] = s.table;
    }
    setCached('standings', out);
    return out;
  } catch (err) {
    console.warn('[liveData] fetchStandings failed:', err);
    return null;
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
 * Fetch latest BBC Sport football headlines via the same-origin /api/rss proxy
 * (Vite dev proxy / Vercel edge function). Returns raw RSS XML, parsed to items.
 * Cached for 15 min. Returns [] on failure.
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
 * Returns the confirmed score from the live API, or null if no real result exists.
 * Only returns a score when the match is IN_PLAY, PAUSED, or FINISHED.
 * Never falls back to fake/synthetic data.
 */
export function resolveScore(
  matchNum: number,
  liveScores: Map<number, LiveScore>
): { home: number; away: number } | null {
  const live = liveScores.get(matchNum);
  if (live && (live.status === 'FINISHED' || live.status === 'IN_PLAY' || live.status === 'PAUSED')) {
    return { home: live.home, away: live.away };
  }
  return null;
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
