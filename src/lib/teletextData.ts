// teletextData.ts — group standings, scorers, narratives, headlines.
// TypeScript port of teletext-data.js from the design prototype.

import { TZ, formatTime, formatDay } from './dataUtils';
import { resolveScore, isMatchFinished, isMatchLive } from './liveData';
import type {
  Match, StandingRow, GroupResult,
  TopScorer, Headline, FullResult, ScorerEntry, TZKey, LiveScore, NewsItem,
} from './types';

// ── Player surname pools by nation ─────────────────────────────────────────
const SURNAMES: Record<string, string[]> = {
  'Mexico':        ['Lozano','Gimenez','Alvarez','Vasquez','Antuna'],
  'South Africa':  ['Mokoena','Foster','Williams','Ntcham','Zwane'],
  'South Korea':   ['Son','Hwang','Lee','Kim','Cho'],
  'Czech Republic':['Schick','Soucek','Kuchta','Chytil','Hlozek'],
  'Canada':        ['David','Davies','Larin','Buchanan','Eustaquio'],
  'USA':           ['Pulisic','Reyna','Pepi','Balogun','Weah'],
  'United States': ['Pulisic','Reyna','Pepi','Balogun','Weah'],
  'England':       ['Kane','Bellingham','Saka','Foden','Palmer'],
  'France':        ['Mbappé','Dembélé','Coman','Thuram','Olise'],
  'Spain':         ['Yamal','Williams','Olmo','Morata','Pedri'],
  'Brazil':        ['Vinicius','Rodrygo','Endrick','Raphinha','Neymar'],
  'Argentina':     ['Messi','Alvarez','Garnacho','Lautaro','Lo Celso'],
  'Germany':       ['Wirtz','Musiala','Kane','Havertz','Sané'],
  'Portugal':      ['Ronaldo','Félix','Leão','Bruno F.','Bernardo'],
  'Netherlands':   ['Gakpo','Depay','Xavi S.','Reijnders','Malen'],
  'Italy':         ['Retegui','Chiesa','Pellegrini','Frattesi','Scamacca'],
  'Belgium':       ['Lukaku','De Bruyne','Doku','Trossard','Openda'],
  'Croatia':       ['Modrić','Kramarić','Petković','Sucic','Pasalic'],
  'Uruguay':       ['Núñez','Pellistri','Araújo','De Arrascaeta','Valverde'],
  'Colombia':      ['Díaz','James','Borja','Cuadrado','Lerma'],
  'Morocco':       ['Hakimi','Ziyech','En-Nesyri','Ounahi','Diaz'],
  'Senegal':       ['Sarr','Mané','Dia','Diatta','Jackson'],
  'Japan':         ['Kubo','Mitoma','Ueda','Endo','Doan'],
  'Switzerland':   ['Embolo','Vargas','Shaqiri','Freuler','Akanji'],
  'Denmark':       ['Hojlund','Eriksen','Wind','Damsgaard','Bah'],
  'Australia':     ['Duke','Boyle','Irvine','Goodwin','Mooy'],
  'Iran':          ['Taremi','Azmoun','Jahanbakhsh','Ghoddos','Ezatolahi'],
  'Saudi Arabia':  ['Al-Dawsari','Al-Brikan','Al-Buraikan','Kanno','Al-Faraj'],
  'Ecuador':       ['Caicedo','Sarmiento','Estrada','Plata','Estupiñán'],
  'Ghana':         ['Kudus','Ayew','Williams','Sulemana','Antoine S.'],
  'Cameroon':      ['Aboubakar','Choupo-Moting','Anguissa','Onana','Mbeumo'],
  'Norway':        ['Haaland','Ødegaard','Sørloth','Nusa','Bobb'],
  'Poland':        ['Lewandowski','Zalewski','Świderski','Frankowski','Buksa'],
  'Serbia':        ['Mitrović','Vlahović','Tadić','Milinković-S.','Lukić'],
  'Tunisia':       ['Khazri','Msakni','Slimane','Jebali','Talbi'],
  'Wales':         ['James','Wilson','Johnson','Moore','Brooks'],
  'Scotland':      ['McGinn','McTominay','Adams','Christie','Robertson'],
  'Nigeria':       ['Osimhen','Lookman','Boniface','Chukwueze','Iwobi'],
  'Ivory Coast':   ['Haller','Krasso','Boga','Pépé','Diakité'],
  'Paraguay':      ['Sanabria','Almirón','Bareiro','Enciso','González'],
  'Chile':         ['Sánchez','Vargas','Brereton D.','Aravena','Núñez'],
  'Sweden':        ['Isak','Gyökeres','Forsberg','Olsson','Karlsson'],
  'Austria':       ['Arnautović','Sabitzer','Baumgartner','Gregoritsch','Laimer'],
  'Qatar':         ['Afif','Ali','Muntari','Boudiaf','Madibo'],
  'New Zealand':   ['Wood','Stamenić','Bell','Garbett','Cacace'],
  'Turkey':        ['Yilmaz','Akturkoglu','Güler','Yildiz','Yokuslu'],
  'Algeria':       ['Mahrez','Belaïli','Slimani','Bounedjah','Aouar'],
  'Egypt':         ['Salah','Mostafa M.','Trezeguet','Marmoush','Hamdi F.'],
  'Bosnia & Herzegovina': ['Džeko','Demirović','Krunić','Pjanić','Tabaković'],
  'Panama':        ['Fajardo','Carrasquilla','Yoel B.','Yanis','Murillo'],
  'Jamaica':       ['Antonio','Bailey','Lowe','Gray','Decordova-R.'],
  'Cape Verde':    ['Tavares','Andrade','Fortes','Lopes','Mendes'],
  'DR Congo':      ['Bakambu','Bongonda','Kayembe','Kibango','Luyindama'],
  'Curacao':       ['Bonevacia','Cijntje','Doran','Koeiman','Martina'],
  'Uzbekistan':    ['Shomurodov','Tursunov','Jaloliddinov','Boymurodov','Nishonov'],
  'Jordan':        ['Al-Taamari','Bani-Yaseen','Nasib','Al-Rawabdeh','Abu Zema'],
  'Haiti':         ['Nazon','Bazile','Dorsainvil','Joseph','Pierre'],
  'Iraq':          ['Ameen','Al-Buhara','Al-Hamdani','Jasim','Tariq'],
};

// ── Deterministic hash ─────────────────────────────────────────────────────
function h32(n: number, salt: number): number {
  let x = (n * 2654435761 + salt * 374761393) >>> 0;
  x ^= x >>> 16; x = (x * 2246822507) >>> 0;
  x ^= x >>> 13; x = (x * 3266489909) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

function teamScorers(teamName: string, count: number, matchNum: number): ScorerEntry[] {
  const pool = SURNAMES[teamName] ?? [teamName.slice(0, 8)];
  const out: ScorerEntry[] = [];
  for (let i = 0; i < count; i++) {
    const idx = h32(matchNum, i + 1) % pool.length;
    const minute = (h32(matchNum, i * 7 + 3) % 89) + 1;
    out.push({ name: pool[idx] ?? teamName.slice(0, 8), minute });
  }
  return out.sort((a, b) => a.minute - b.minute);
}

function syntheticAttendance(matchNum: number): number {
  return 45000 + (h32(matchNum, 99) % 35000);
}

// ── Full result with stats ─────────────────────────────────────────────────
export function fullResult(m: Match, liveScores: Map<number, LiveScore> = new Map()): FullResult {
  // Use real score; fall back to 0-0 only as a null-safety guard (network failure edge case)
  const r = resolveScore(m.num, liveScores) ?? { home: 0, away: 0 };
  const home = teamScorers(m.teams[0].name, r.home, m.num);
  const away = teamScorers(m.teams[1].name, r.away, m.num * 7 + 13);
  const possH = 35 + (h32(m.num, 11) % 30);
  return {
    score: r,
    scorers: { home, away },
    stats: {
      possession: [possH, 100 - possH],
      shots:      [6 + (h32(m.num, 17) % 14), 5 + (h32(m.num, 23) % 12)],
      corners:    [2 + (h32(m.num, 29) % 8),  2 + (h32(m.num, 31) % 8)],
      yellow:     [h32(m.num, 37) % 5,         h32(m.num, 41) % 5],
    },
    attendance: syntheticAttendance(m.num),
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

// ── Tournament-wide top scorers ────────────────────────────────────────────
export function topScorers(
  matches: Match[],
  nowMs: number,
  limit = 8,
  liveScores: Map<number, LiveScore> = new Map(),
): TopScorer[] {
  const tally = new Map<string, TopScorer>();
  const bump = (name: string, team: string) => {
    const k = `${name}|${team}`;
    if (!tally.has(k)) tally.set(k, { name, team, goals: 0 });
    tally.get(k)!.goals++;
  };
  matches.forEach(m => {
    if (!isMatchFinished(m.num, m.kickoffUTC, nowMs, liveScores)) return;
    const r = fullResult(m, liveScores);
    r.scorers.home.forEach(s => bump(s.name, m.teams[0].short));
    r.scorers.away.forEach(s => bump(s.name, m.teams[1].short));
  });
  return [...tally.values()]
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name))
    .slice(0, limit);
}

// ── News headlines ─────────────────────────────────────────────────────────
export function headlines(
  matches: Match[],
  nowMs: number,
  viewer: TZKey,
  liveScores: Map<number, LiveScore> = new Map(),
  newsItems: NewsItem[] = [],
): Headline[] {
  const played   = matches.filter(m => isMatchFinished(m.num, m.kickoffUTC, nowMs, liveScores));
  const upcoming = matches.filter(m => m.kickoffUTC > nowMs).slice(0, 12);
  const result: Headline[] = [];

  // 1. Top headline — real BBC news if available, else most decisive recent result
  if (newsItems.length > 0) {
    const item = newsItems[0]!;
    result.push({
      kind: 'news', kicker: 'LATEST NEWS',
      title: item.title.toUpperCase().slice(0, 72),
      body:  item.description.slice(0, 180),
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

  // 2. Next big match
  const nextBig = upcoming.find(m => m.stageId !== 'group') ?? upcoming[0];
  if (nextBig) {
    result.push({
      kind: 'preview', kicker: 'COMING UP',
      title: `${nextBig.teams[0].name.toUpperCase()} v ${nextBig.teams[1].name.toUpperCase()}`,
      body:  `${nextBig.stage} at ${nextBig.venue}. Kick-off ${formatTime(nextBig.kickoffUTC, viewer)} ${TZ[viewer]?.code ?? ''}, ${formatDay(nextBig.kickoffUTC, viewer)}.`,
      match: nextBig,
    });
  }

  // 3. Tightest group
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

  // 4. Golden Boot leader
  const scorers = topScorers(matches, nowMs, 1, liveScores);
  if (scorers.length) {
    const s = scorers[0]!;
    result.push({
      kind: 'scorer', kicker: 'GOLDEN BOOT',
      title: `${s.name.toUpperCase()} (${s.team}) LEADS THE RACE`,
      body:  `${s.goals} goal${s.goals === 1 ? '' : 's'} so far — front of the queue for the Golden Boot, with the knockout rounds still to come.`,
    });
  }

  return result;
}
