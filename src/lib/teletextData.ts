// teletextData.ts — group standings, scorers, narratives, headlines.
// TypeScript port of teletext-data.js from the design prototype.

import { resolveScore, isMatchFinished, isMatchLive } from './liveData';
import type {
  Match, StandingRow, GroupResult, QualNote,
  TopScorer, Headline, FullResult, LiveScore, NewsItem,
} from './types';

// ── Full result ──────────────────────────────────────────────────────────────
export function fullResult(m: Match, liveScores: Map<number, LiveScore> = new Map()): FullResult {
  // Use the real confirmed score; 0-0 only as a null-safety guard.
  // The free football-data.org tier does not expose per-match goal events or
  // statistics, so we surface ONLY the real score — no fabricated scorers, stats,
  // or attendance. (Richer detail could later come from API-Football match events.)
  const r = resolveScore(m.num, liveScores) ?? { home: 0, away: 0 };
  return {
    score: r,
    scorers: { home: [], away: [] },
    stats: null,
    attendance: null,
  };
}

// ── Match narrative blurb ──────────────────────────────────────────────────
export function narrative(m: Match, result: FullResult): string {
  const A = m.teams[0].name, B = m.teams[1].name;
  const sH = result.score.home, sA = result.score.away;
  const total = sH + sA;
  const margin = sH - sA;
  const headlineStar = (margin > 0 ? result.scorers.home : result.scorers.away)[0];
  const venue = m.city;

  const flavor = (): string => {
    if (total === 0) return `A cagey, attritional ${m.stageShort} affair at ${venue} that promised more than it delivered — the front pages will lead with the table, not the football.`;
    if (margin === 0 && total >= 4) return `A ${sH}-${sA} thriller in ${venue}: two sides who clearly only know one gear, and that gear is "forwards".`;
    if (margin === 0) return `Honours even in ${venue}. ${A} and ${B} traded the lead like neighbours swapping ladders — politely, and to no one's lasting advantage.`;
    if (Math.abs(margin) >= 3) return `A statement performance in ${venue}. ${margin > 0 ? A : B} were rampant, ${margin > 0 ? B : A} were rattled, and the group table just rearranged itself in 90 minutes.`;
    return `${margin > 0 ? A : B} edged it in ${venue} — not pretty, not particularly fair, but the only number that mattered ended in their favour.`;
  };
  const star = (): string => headlineStar
    ? ` ${headlineStar.name} opened the scoring on ${headlineStar.minute}' and the visiting bench never quite stopped twitching after that.`
    : '';
  const closer = (): string => {
    if (m.stageId === 'group') return ` Next up: another group date, and another night of nervously checking the other fixture.`;
    if (m.stageId === 'final') return ` World Champions. The trophy goes home with ${margin > 0 ? A : B}.`;
    return ` They march on. The bracket gets meaner from here.`;
  };
  return flavor() + star() + closer();
}

// ── Group standings ────────────────────────────────────────────────────────
export function groupStandings(
  matches: Match[],
  nowMs: number,
  liveScores: Map<number, LiveScore> = new Map(),
): Record<string, StandingRow[]> {
  const groups: Record<string, Record<string, StandingRow>> = {};
  matches.filter(m => m.stageId === 'group').forEach(m => {
    const g = m.group;
    if (!groups[g]) groups[g] = {};
    m.teams.forEach(t => {
      if (!groups[g][t.name]) groups[g][t.name] = { name: t.name, short: t.short, p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0 };
    });
    if (isMatchFinished(m.num, m.kickoffUTC, nowMs, liveScores)) {
      const r = resolveScore(m.num, liveScores);
      if (!r) return; // no confirmed score — skip rather than fabricate
      const A = groups[g][m.teams[0].name]!;
      const B = groups[g][m.teams[1].name]!;
      A.p++; B.p++; A.gf += r.home; A.ga += r.away; B.gf += r.away; B.ga += r.home;
      if      (r.home > r.away) { A.w++; B.l++; A.pts += 3; }
      else if (r.home < r.away) { B.w++; A.l++; B.pts += 3; }
      else                      { A.d++; B.d++; A.pts++;    B.pts++; }
    }
  });
  const out: Record<string, StandingRow[]> = {};
  Object.keys(groups).sort().forEach(g => {
    out[g] = Object.values(groups[g]!)
      .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name));
  });
  return out;
}

// ── Group head-to-head results ─────────────────────────────────────────────
export function groupResults(
  matches: Match[],
  groupName: string,
  nowMs: number,
  liveScores: Map<number, LiveScore> = new Map(),
): GroupResult[] {
  return matches
    .filter(m => m.group === groupName && m.stageId === 'group')
    .map(m => {
      const finished = isMatchFinished(m.num, m.kickoffUTC, nowMs, liveScores);
      const live     = isMatchLive(m.num, m.kickoffUTC, nowMs, liveScores);
      return { m, finished, live, score: resolveScore(m.num, liveScores) };
    });
}

// ── Qualification scenarios (top-2) ────────────────────────────────────────
// v1: conservative, mathematically-safe top-2 notes — only claims a team is
// THROUGH or OUT when it is guaranteed regardless of remaining results. The
// granular "needs a win/draw vs Z" per-fixture maths (and best-3rd seeding
// across groups) is deferred to v2.
const GROUP_TEAM_GAMES = 3;   // each team plays 3 group matches

export function qualificationNotes(
  matches: Match[],
  groupName: string,
  nowMs: number,
  liveScores: Map<number, LiveScore> = new Map(),
): QualNote[] {
  const rows = groupStandings(matches, nowMs, liveScores)[groupName];
  if (!rows || rows.length === 0) return [];
  const playedTotal = rows.reduce((a, r) => a + r.p, 0) / 2;
  const totalGames  = (rows.length * GROUP_TEAM_GAMES) / 2;   // 4 teams → 6

  if (playedTotal >= totalGames) {
    return [
      { text: 'GROUP DECIDED', tone: 'info' },
      { text: `${rows[0]!.short} & ${rows[1]!.short} ADVANCE`, tone: 'qual' },
    ];
  }

  const maxPts = (r: StandingRow) => r.pts + 3 * (GROUP_TEAM_GAMES - r.p);
  const notes: QualNote[] = [];

  for (const r of rows) {
    // Clinched top-2: at most one other team can even draw level on points (a
    // level team could overtake on GD, so a tie still counts against the clinch).
    const canReach = rows.filter(o => o !== r && maxPts(o) >= r.pts).length;
    if (canReach <= 1) { notes.push({ text: `${r.short} THROUGH`, tone: 'qual' }); continue; }
    // Eliminated: at least two teams already sit above this team's best possible finish.
    const above = rows.filter(o => o !== r && o.pts > maxPts(r)).length;
    if (above >= 2) notes.push({ text: `${r.short} OUT`, tone: 'elim' });
  }

  if (notes.length === 0) {
    notes.push({ text: `ALL TO PLAY FOR · ${totalGames - playedTotal} TO COME`, tone: 'info' });
  }
  return notes;
}

// ── News headlines ─────────────────────────────────────────────────────────
export function headlines(
  matches: Match[],
  nowMs: number,
  liveScores: Map<number, LiveScore> = new Map(),
  newsItems: NewsItem[] = [],
  scorers: TopScorer[] = [],
): Headline[] {
  const played   = matches.filter(m => isMatchFinished(m.num, m.kickoffUTC, nowMs, liveScores));
  const result: Headline[] = [];

  // 1. Top headline — real BBC news if available, else most decisive recent result
  if (newsItems.length > 0) {
    const item = newsItems[0]!;
    result.push({
      kind: 'news', kicker: 'LATEST NEWS',
      title: item.title.toUpperCase().slice(0, 72),
      body:  item.description.slice(0, 180),
      link:  item.link,
    });
  } else {
    const recent  = played.slice().reverse();
    const biggest = recent.find(m => {
      const r = resolveScore(m.num, liveScores);
      return r !== null && Math.abs(r.home - r.away) >= 2;
    }) ?? recent[0];
    if (biggest) {
      const r = resolveScore(biggest.num, liveScores);
      if (r) {
        const winner = r.home > r.away ? biggest.teams[0] : biggest.teams[1];
        const loser  = r.home > r.away ? biggest.teams[1] : biggest.teams[0];
        const margin = Math.abs(r.home - r.away);
        result.push({
          kind: 'result', kicker: 'HEADLINE',
          title: `${winner.name.toUpperCase()} ${margin >= 3 ? 'ROUT' : 'BEAT'} ${loser.name.toUpperCase()} ${Math.max(r.home,r.away)}-${Math.min(r.home,r.away)}`,
          body:  `${biggest.city} witnessed ${margin >= 3 ? 'a statement' : 'a steady'} performance from ${winner.name} as they ${margin >= 3 ? 'tore through' : 'edged past'} ${loser.name} in ${biggest.stage.toLowerCase()} action.`,
          match: biggest,
        });
      }
    }
  }

  // 2. Tightest group
  const standings = groupStandings(matches, nowMs, liveScores);
  let tightest: string | null = null, tightestSpread = 99;
  for (const [g, rows] of Object.entries(standings)) {
    if (rows[0]!.p < 2 || rows.length < 4) continue;
    const spread = rows[0]!.pts - rows[3]!.pts;
    if (spread < tightestSpread) { tightestSpread = spread; tightest = g; }
  }
  if (tightest) {
    const rows = standings[tightest]!;
    result.push({
      kind: 'group', kicker: 'GROUPS',
      title: `${tightest.toUpperCase()} ON A KNIFE EDGE`,
      body:  `Just ${tightestSpread} points separate top and bottom in ${tightest}. ${rows[0]!.short} lead with ${rows[0]!.pts} pts, but ${rows[3]!.short} are not out of it yet.`,
      groupName: tightest,
    });
  }

  // 4. Golden Boot leader (real scorers from football-data.org)
  if (scorers.length && scorers[0]!.goals > 0) {
    const s = scorers[0]!;
    result.push({
      kind: 'scorer', kicker: 'GOLDEN BOOT',
      title: `${s.name.toUpperCase()} (${s.team}) LEADS THE RACE`,
      body:  `${s.goals} goal${s.goals === 1 ? '' : 's'} so far — front of the queue for the Golden Boot, with the knockout rounds still to come.`,
    });
  }

  // Fill any remaining grid slots with additional BBC news items.
  // Pre-tournament: GROUPS and GOLDEN BOOT slots are empty — real news fills them.
  // During tournament: only fills if <3 grid items were generated from match data.
  const usedNewsItems = result[0]?.kind === 'news' ? 1 : 0;
  let newsIdx = usedNewsItems;
  while (result.length < 4 && newsIdx < newsItems.length) {
    const item = newsItems[newsIdx++]!;
    result.push({
      kind: 'news', kicker: 'IN THE NEWS',
      title: item.title.toUpperCase().slice(0, 72),
      body:  item.description.slice(0, 110),
      link:  item.link,
    });
  }

  return result;
}
