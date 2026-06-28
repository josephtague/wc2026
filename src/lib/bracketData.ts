// bracketData.ts — resolve the knockout bracket from the fixture placeholders.
// matches.json encodes the whole tree in the fixture strings: R32 slots reference
// group positions ("Group A RU"), and R16→Final reference match winners/losers
// ("Match 73 W", "Match 101 L"). We resolve each slot progressively — group
// winners/runners-up from live standings, knockout winners as those ties are played.

import type { Match, LiveScore } from './types';
import { resolveScore, isMatchFinished } from './liveData';
import { groupStandings } from './teletextData';

export type BracketStageId = 'r32' | 'r16' | 'qf' | 'sf' | '3rd' | 'final';
export const BRACKET_ORDER: BracketStageId[] = ['r32', 'r16', 'qf', 'sf', 'final', '3rd'];
export const BRACKET_LABEL: Record<BracketStageId, string> = {
  r32: 'ROUND OF 32', r16: 'ROUND OF 16', qf: 'QUARTER-FINALS', sf: 'SEMI-FINALS', final: 'FINAL', '3rd': '3RD PLACE',
};

export interface BracketTie {
  num: number;
  home: string;            // resolved label: real 3-letter team code, or slot ("1A"/"2B"/"3RD"/"W73")
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  winner: 'home' | 'away' | null;
}

const GROUP_GAMES = 6;     // 4 teams → 6 matches; group decided once all are played

// Shared slot resolver: turns a fixture placeholder ("Group A RU", "Match 73 W")
// into a real team code when known, else a short slot code ("2A", "W73").
function makeResolver(matches: Match[], now: number, liveScores: Map<number, LiveScore>) {
  const standings = groupStandings(matches, now, liveScores);
  const byNum = new Map(matches.map(m => [m.num, m]));
  const decided = (g: string): boolean => {
    const rows = standings[g];
    return !!rows && rows.length > 0 && rows.reduce((a, r) => a + r.p, 0) / 2 >= GROUP_GAMES;
  };

  function slot(label: string): string {
    let m: RegExpExecArray | null;
    if ((m = /^Group ([A-L]) W$/.exec(label)))  { const g = `Group ${m[1]}`; return decided(g) ? standings[g]![0]!.short : `1${m[1]}`; }
    if ((m = /^Group ([A-L]) RU$/.exec(label))) { const g = `Group ${m[1]}`; return decided(g) ? standings[g]![1]!.short : `2${m[1]}`; }
    if (/3rd$/.test(label)) return '3RD';
    if ((m = /^Match (\d+) W$/.exec(label))) return outcomeOf(+m[1]!, 'W') ?? `W${m[1]}`;
    if ((m = /^Match (\d+) L$/.exec(label))) return outcomeOf(+m[1]!, 'L') ?? `L${m[1]}`;
    return label.slice(0, 3).toUpperCase();
  }

  function outcomeOf(num: number, which: 'W' | 'L'): string | null {
    const m = byNum.get(num);
    if (!m) return null;
    const r = resolveScore(num, liveScores);
    if (!r || r.home === r.away) return null;          // not played / drawn (no ET data)
    const homeWon = r.home > r.away;
    return slot(which === 'W' ? (homeWon ? m.teams[0]!.name : m.teams[1]!.name)
                              : (homeWon ? m.teams[1]!.name : m.teams[0]!.name));
  }

  return { slot };
}

/**
 * Display codes for every match's two teams, with knockout placeholders resolved
 * to real teams where known. Group matches pass through their real `short` codes.
 */
export function resolveTeamCodes(matches: Match[], now: number, liveScores: Map<number, LiveScore>): Map<number, { home: string; away: string }> {
  const { slot } = makeResolver(matches, now, liveScores);
  const out = new Map<number, { home: string; away: string }>();
  for (const m of matches) {
    out.set(m.num, m.stageId === 'group'
      ? { home: m.teams[0]!.short, away: m.teams[1]!.short }
      : { home: slot(m.teams[0]!.name), away: slot(m.teams[1]!.name) });
  }
  return out;
}

export function buildBracket(matches: Match[], now: number, liveScores: Map<number, LiveScore>): Record<BracketStageId, BracketTie[]> {
  const { slot } = makeResolver(matches, now, liveScores);
  const out = { r32: [], r16: [], qf: [], sf: [], final: [], '3rd': [] } as Record<BracketStageId, BracketTie[]>;
  for (const mt of matches) {
    if (mt.stageId === 'group') continue;
    const sid = mt.stageId as BracketStageId;
    if (!(sid in out)) continue;
    const r = resolveScore(mt.num, liveScores);
    const finished = isMatchFinished(mt.num, mt.kickoffUTC, now, liveScores);
    out[sid].push({
      num: mt.num,
      home: slot(mt.teams[0]!.name),
      away: slot(mt.teams[1]!.name),
      homeScore: r ? r.home : null,
      awayScore: r ? r.away : null,
      winner: r && finished ? (r.home > r.away ? 'home' : r.away > r.home ? 'away' : null) : null,
    });
  }
  return out;
}
