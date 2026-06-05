// previewData.ts — Match Preview data, sourced from ESPN's free hidden API.
// Aggregated client-side through the same-origin /api/espn proxy (no key needed):
//   1) scoreboard for the match date → find the ESPN event for our fixture
//   2) summary for that event → line-ups, odds, head-to-head, venue
// Normalised to the interfaces below. Line-ups publish ~1h pre-kickoff; before that
// the preview still shows odds + an odds-derived prediction. Cached per match.

import type { Match } from './types';
import { getCached, setCached } from './liveData';

// ── Public interfaces ────────────────────────────────────────────────────────
export interface LineupPlayer { number: number | null; name: string; pos: string; line: 'GK' | 'DEF' | 'MID' | 'FWD'; }
export interface TeamLineup { teamShort: string; formation: string | null; starters: LineupPlayer[]; bench: LineupPlayer[]; }
export interface MatchPrediction { homePct: number; drawPct: number; awayPct: number; }
export interface MatchOdds { bookmaker: string; home: number; draw: number; away: number; }  // decimal odds
export interface H2HSummary { played: number; homeWins: number; awayWins: number; draws: number; }
export interface MatchPreview {
  matchNum: number;
  status: 'ok' | 'lineups-pending' | 'no-data' | 'error';
  lineups: [TeamLineup, TeamLineup] | null;   // null until published ~1h pre-KO
  prediction: MatchPrediction | null;
  odds: MatchOdds | null;
  h2h: H2HSummary | null;
  venue: string | null;
  fetchedAt: number;
}

// ── Team-name normalisation (our names ⇄ ESPN names) ─────────────────────────
function normName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
}
const ALIASES: Record<string, string> = {
  czechrepublic: 'czechia', czechia: 'czechia',
  unitedstates: 'usa', usa: 'usa',
  southkorea: 'southkorea', korearepublic: 'southkorea',
  ivorycoast: 'ivorycoast', cotedivoire: 'ivorycoast',
  capeverde: 'capeverde', caboverde: 'capeverde',
  iran: 'iran', iriran: 'iran',
  bosniaherzegovina: 'bosnia', bosniaandherzegovina: 'bosnia',
  drcongo: 'drcongo', democraticrepublicofthecongo: 'drcongo', congodr: 'drcongo',
};
function canon(name: string): string { const n = normName(name); return ALIASES[n] ?? n; }

// ── ESPN response shapes (only the fields we read) ───────────────────────────
interface EspnCompetitor { homeAway?: string; team?: { displayName?: string } }
interface EspnEvent { id: string; competitions?: { competitors?: EspnCompetitor[] }[] }
interface EspnScoreboard { events?: EspnEvent[] }

const ESPN = '/api/espn/apis/site/v2/sports/soccer/fifa.world';

function yyyymmdd(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
}

/** Find the ESPN event id whose two teams match our fixture (date ± 1 day). */
async function findEventId(match: Match): Promise<string | null> {
  const want = new Set([canon(match.teams[0].name), canon(match.teams[1].name)]);
  const base = match.kickoffUTC;
  const dates = [yyyymmdd(base), yyyymmdd(base - 864e5), yyyymmdd(base + 864e5)];
  for (const date of dates) {
    try {
      const res = await fetch(`${ESPN}/scoreboard?dates=${date}`);
      if (!res.ok) continue;
      const json = await res.json() as EspnScoreboard;
      for (const ev of json.events ?? []) {
        const comps = ev.competitions?.[0]?.competitors ?? [];
        const names = comps.map(c => canon(c.team?.displayName ?? ''));
        if (names.length === 2 && want.has(names[0]!) && want.has(names[1]!)) return ev.id;
      }
    } catch { /* try next date */ }
  }
  return null;
}

// ── Odds → decimal + de-vigged prediction ────────────────────────────────────
function americanToProb(a: number): number { return a < 0 ? -a / (-a + 100) : 100 / (a + 100); }
function americanToDecimal(a: number): number { return a < 0 ? 100 / -a + 1 : a / 100 + 1; }
function parseOdds(v: unknown): number | null {
  const n = typeof v === 'string' ? parseInt(v, 10) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

// ── Line-up normalisation ────────────────────────────────────────────────────
// ESPN soccer position codes look like 'G', 'CD-L', 'LB', 'CM', 'AM-R', 'LF'.
// Strip the side suffix ('-L'/'-R') and bucket the base into a pitch line.
const DEF_POS = new Set(['D', 'CD', 'CB', 'RCB', 'LCB', 'LB', 'RB', 'WB', 'LWB', 'RWB', 'SW']);
const FWD_POS = new Set(['F', 'CF', 'ST', 'SS', 'LF', 'RF', 'LW', 'RW', 'W']);
function lineFor(posAbbr: string): LineupPlayer['line'] {
  const base = posAbbr.toUpperCase().split('-')[0] ?? '';
  if (base === 'G' || base === 'GK') return 'GK';
  if (DEF_POS.has(base)) return 'DEF';
  if (FWD_POS.has(base)) return 'FWD';
  return 'MID';   // CM, DM, AM, CDM, CAM, LM, RM, M…
}

interface EspnRosterPlayer { starter?: boolean; jersey?: string; athlete?: { displayName?: string }; position?: { abbreviation?: string } }
interface EspnRoster { team?: { abbreviation?: string; displayName?: string }; formation?: string; roster?: EspnRosterPlayer[] }

function normalizeLineup(r: EspnRoster): TeamLineup {
  const all = (r.roster ?? []).map(p => {
    const pos = p.position?.abbreviation ?? '';
    const player: LineupPlayer = {
      number: p.jersey ? parseInt(p.jersey, 10) : null,
      name: p.athlete?.displayName ?? '',
      pos,
      line: lineFor(pos),
    };
    return { player, starter: p.starter === true };
  });
  return {
    teamShort: r.team?.abbreviation ?? r.team?.displayName?.slice(0, 3).toUpperCase() ?? '',
    formation: r.formation ?? null,
    starters: all.filter(x => x.starter).map(x => x.player),
    bench:    all.filter(x => !x.starter).map(x => x.player),
  };
}

// ── Summary → MatchPreview ───────────────────────────────────────────────────
interface EspnSummary {
  rosters?: EspnRoster[];
  odds?: { provider?: { name?: string }; moneyline?: { home?: { close?: { odds?: string } }; away?: { close?: { odds?: string } }; draw?: { close?: { odds?: string } } } }[];
  headToHeadGames?: { events?: { gameResult?: string }[] }[];
  gameInfo?: { venue?: { fullName?: string } };
}

function buildPreview(matchNum: number, summary: EspnSummary): MatchPreview {
  // Line-ups (null until published)
  const rosters = summary.rosters ?? [];
  const lineupsReady = rosters.length === 2 && rosters.every(r => (r.roster ?? []).some(p => p.starter));
  const lineups = lineupsReady ? [normalizeLineup(rosters[0]!), normalizeLineup(rosters[1]!)] as [TeamLineup, TeamLineup] : null;

  // Odds + de-vigged prediction
  const ml = summary.odds?.[0]?.moneyline;
  const h = parseOdds(ml?.home?.close?.odds), d = parseOdds(ml?.draw?.close?.odds), a = parseOdds(ml?.away?.close?.odds);
  let odds: MatchOdds | null = null;
  let prediction: MatchPrediction | null = null;
  if (h !== null && d !== null && a !== null) {
    odds = {
      bookmaker: summary.odds?.[0]?.provider?.name ?? 'Bookmaker',
      home: Math.round(americanToDecimal(h) * 100) / 100,
      draw: Math.round(americanToDecimal(d) * 100) / 100,
      away: Math.round(americanToDecimal(a) * 100) / 100,
    };
    const ph = americanToProb(h), pd = americanToProb(d), pa = americanToProb(a);
    const sum = ph + pd + pa;
    prediction = {
      homePct: Math.round((ph / sum) * 100),
      drawPct: Math.round((pd / sum) * 100),
      awayPct: Math.round((pa / sum) * 100),
    };
  }

  // Head-to-head tally (events carry a gameResult of 'win'/'loss'/'draw' from group[0]'s perspective)
  let h2h: H2HSummary | null = null;
  const h2hEvents = summary.headToHeadGames?.[0]?.events ?? [];
  if (h2hEvents.length) {
    let hw = 0, aw = 0, dr = 0;
    for (const e of h2hEvents) {
      if (e.gameResult === 'W') hw++; else if (e.gameResult === 'L') aw++; else dr++;
    }
    h2h = { played: h2hEvents.length, homeWins: hw, awayWins: aw, draws: dr };
  }

  return {
    matchNum,
    status: lineups ? 'ok' : (odds || h2h ? 'lineups-pending' : 'no-data'),
    lineups,
    prediction,
    odds,
    h2h,
    venue: summary.gameInfo?.venue?.fullName ?? null,
    fetchedAt: Date.now(),
  };
}

/**
 * Fetch the Match Preview for a fixture. Cached per match for 5 minutes.
 * Returns a `no-data` preview (never throws) when the fixture can't be mapped or
 * ESPN is unreachable — the UI renders a graceful empty state from this.
 */
export async function fetchPreview(match: Match): Promise<MatchPreview> {
  const key = `preview:${match.num}`;
  const cached = getCached<MatchPreview>(key, 5 * 60 * 1000);
  if (cached) return cached;

  const empty = (status: MatchPreview['status']): MatchPreview => ({
    matchNum: match.num, status, lineups: null, prediction: null, odds: null, h2h: null, venue: null, fetchedAt: Date.now(),
  });

  try {
    const eventId = await findEventId(match);
    if (!eventId) return empty('no-data');
    const res = await fetch(`${ESPN}/summary?event=${eventId}`);
    if (!res.ok) return empty('error');
    const summary = await res.json() as EspnSummary;
    const preview = buildPreview(match.num, summary);
    setCached(key, preview);
    return preview;
  } catch (err) {
    console.warn('[previewData] fetchPreview failed:', err);
    return empty('error');
  }
}
