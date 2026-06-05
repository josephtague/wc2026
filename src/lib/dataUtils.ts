// dataUtils.ts — match loading + all date/time/scoring helpers.
// TypeScript port of data-utils.js from the design prototype.

import type { TZKey, TZInfo, StageInfo, RawMatch, Match, TeamInfo, DateParts, FakeResult } from './types';

// ── Timezones — all 8 markets from the schedule spreadsheet ───────────────
// Offsets are fixed for the June/July 2026 tournament window (no DST surprises).
// IST uses 5.5 (UTC+5:30) — the fractional offset works fine with the ms math.
export const TZ: Record<TZKey, TZInfo> = {
  PT:  { key: 'PT',  label: 'Los Angeles',  code: 'PDT',  offsetHrs: -7   },
  CDM: { key: 'CDM', label: 'Mexico City',  code: 'CST',  offsetHrs: -6   },
  ET:  { key: 'ET',  label: 'New York',     code: 'EDT',  offsetHrs: -4   },
  BRT: { key: 'BRT', label: 'São Paulo',    code: 'BRT',  offsetHrs: -3   },
  LDN: { key: 'LDN', label: 'London',       code: 'BST',  offsetHrs:  1   },
  PAR: { key: 'PAR', label: 'Madrid/Paris', code: 'CEST', offsetHrs:  2   },
  DXB: { key: 'DXB', label: 'Dubai',        code: 'GST',  offsetHrs:  4   },
  SHA: { key: 'SHA', label: 'Shanghai',     code: 'CST',  offsetHrs:  8   },
  TYO: { key: 'TYO', label: 'Tokyo',        code: 'JST',  offsetHrs:  9   },
  SYD: { key: 'SYD', label: 'Sydney',       code: 'AEST', offsetHrs: 10   },
};
export const TZ_ORDER: TZKey[] = ['PT', 'CDM', 'ET', 'BRT', 'LDN', 'PAR', 'DXB', 'SHA', 'TYO', 'SYD'];

/** Short city labels for TZ buttons — consistent city names, west→east */
export const TZ_CITY: Record<TZKey, string> = {
  PT: 'LA', CDM: 'CDMX', ET: 'NY', BRT: 'SAO',
  LDN: 'LON', PAR: 'PAR', DXB: 'DXB', SHA: 'SHA', TYO: 'TYO', SYD: 'SYD',
};

// ── Stage metadata ─────────────────────────────────────────────────────────
const STAGES_BY_NAME: Record<string, StageInfo> = {
  'Group Stage':         { id: 'group',  short: 'GROUP', color: '#2D6FE0', tone: 'on-dark', importance: 1 },
  'Round of 32':         { id: 'r32',    short: 'R32',   color: '#FFCB16', tone: 'on-dark', importance: 2 },
  'Round of 16':         { id: 'r16',    short: 'R16',   color: '#FB961F', tone: 'on-dark', importance: 3 },
  'Quarter-final':       { id: 'qf',     short: 'QF',    color: '#FF245B', tone: 'on-dark', importance: 4 },
  'Semi-final':          { id: 'sf',     short: 'SF',    color: '#9B5BFF', tone: 'on-dark', importance: 5 },
  'Third Place Playoff': { id: '3rd',    short: '3RD',   color: '#4DBAC1', tone: 'on-dark', importance: 6 },
  'Final':               { id: 'final',  short: 'FINAL', color: '#00DC7C', tone: 'on-dark', importance: 7 },
};
const MUST_WATCH_IDS = new Set(['r16', 'qf', 'sf', '3rd', 'final']);

// ── Date parsing ───────────────────────────────────────────────────────────
// "Fri 12 Jun" + "8:00 pm" (BST column) → UTC milliseconds
function parseToUTC(dayStr: string, timeStr: string): number {
  const parts = dayStr.split(' ');
  const dayNum = parseInt(parts[1], 10);
  const monthStr = parts[2];
  const month = monthStr === 'Jun' ? 5 : 6;
  const [hm, ampm] = timeStr.toLowerCase().split(' ');
  let [h, m] = hm.split(':').map(Number) as [number, number];
  if (ampm === 'pm' && h !== 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  // BST = UTC+1 → UTC = BST − 1
  return Date.UTC(2026, month, dayNum, h - 1, m);
}

// ── Timezone conversion ────────────────────────────────────────────────────
export function inTz(utcMs: number, tzKey: TZKey): DateParts {
  const offMs = TZ[tzKey].offsetHrs * 3600 * 1000;
  const d = new Date(utcMs + offMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    date: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
    ymd: `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`,
    ms: utcMs,
  };
}

// ── Formatting ─────────────────────────────────────────────────────────────
export const WK = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export const MO  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function pad(n: number): string { return String(n).padStart(2, '0'); }

export function formatTime(utcMs: number, tzKey: TZKey): string {
  const d = inTz(utcMs, tzKey);
  return `${pad(d.hour)}:${pad(d.minute)}`;
}
export function formatDay(utcMs: number, tzKey: TZKey): string {
  const d = inTz(utcMs, tzKey);
  return `${WK[d.weekday]} ${d.date} ${MO[d.month]}`;
}
export function formatDayShort(utcMs: number, tzKey: TZKey): string {
  const d = inTz(utcMs, tzKey);
  return `${d.date} ${MO[d.month]}`;
}

// ── Team code shortener ────────────────────────────────────────────────────
const TEAM_SHORT: Record<string, string> = {
  'England':'ENG','Algeria':'ALG','Mexico':'MEX','South Africa':'RSA',
  'South Korea':'KOR','Czech Republic':'CZE','Canada':'CAN',
  'Bosnia & Herzegovina':'BIH','USA':'USA','United States':'USA',
  'Australia':'AUS','Italy':'ITA','Brazil':'BRA','Iran':'IRN',
  'France':'FRA','Senegal':'SEN','Germany':'GER','Japan':'JPN',
  'Argentina':'ARG','Egypt':'EGY','Spain':'ESP','Cameroon':'CMR',
  'Portugal':'POR','Ecuador':'ECU','Netherlands':'NED','Ghana':'GHA',
  'Belgium':'BEL','Costa Rica':'CRC','UAE':'UAE','Croatia':'CRO',
  'Switzerland':'SUI','Uruguay':'URU','Colombia':'COL','Morocco':'MAR',
  'Norway':'NOR','Saudi Arabia':'SAU','Poland':'POL',
  'Denmark':'DEN','Serbia':'SRB','Tunisia':'TUN','Iceland':'ISL',
  'Wales':'WAL','Scotland':'SCO','Nigeria':'NGA','Ivory Coast':'CIV',
  'Paraguay':'PAR','Chile':'CHI','Sweden':'SWE','Austria':'AUT',
  'Qatar':'QAT','New Zealand':'NZL','Turkey':'TUR','Ireland':'IRL',
  'Guatemala':'GUA','Panama':'PAN','Jamaica':'JAM',
  'Cape Verde':'CPV','DR Congo':'COD','Curacao':'CUW',
  'Uzbekistan':'UZB','Jordan':'JOR','Haiti':'HAI','Iraq':'IRQ',
};
export function teamShort(name: string): string {
  if (TEAM_SHORT[name]) return TEAM_SHORT[name];
  const cleaned = name.replace(/[^A-Za-z ]/g, '');
  if (cleaned.length <= 3) return cleaned.toUpperCase();
  return cleaned.slice(0, 3).toUpperCase();
}

// ── Deterministic fake results ─────────────────────────────────────────────
export function fakeResult(matchNum: number): FakeResult {
  let s = matchNum * 1103515245 + 12345;
  s = (s ^ (s >>> 13)) >>> 0;
  let t = s * 22695477 + 1;
  t = (t ^ (t >>> 17)) >>> 0;
  const r = [0, 0, 0, 1, 1, 1, 2, 2, 3, 4];
  return { home: r[s % r.length], away: r[t % r.length] };
}

// ── Default "now" anchor (mid-group-stage demo moment) ────────────────────
export function defaultNow(): number {
  // Sat 20 Jun 2026, 09:00 AEST = Fri 19 Jun 23:00 UTC
  return Date.UTC(2026, 5, 19, 23, 0);
}

// ── Load + enrich match data ───────────────────────────────────────────────
export async function loadMatches(): Promise<Match[]> {
  const res = await fetch('/data/matches.json');
  const raw: RawMatch[] = await res.json() as RawMatch[];
  return raw.map(m => {
    const utc = parseToUTC(m.bstDay, m.bstTime);
    const teamsRaw = m.fixture.split(' vs ').map(s => s.trim());
    const stage = STAGES_BY_NAME[m.stage] ?? STAGES_BY_NAME['Group Stage']!;
    const makeTeam = (name: string): TeamInfo => ({
      name,
      short: teamShort(name),
      placeholder: /^(W|RU|L|3rd|Match )/i.test(name) || (/\d/.test(name) && name.length <= 4),
    });
    const teams: [TeamInfo, TeamInfo] = [
      makeTeam(teamsRaw[0] ?? ''),
      makeTeam(teamsRaw[1] ?? ''),
    ];
    return {
      num: m.num,
      stage: m.stage,
      stageId: stage.id,
      stageShort: stage.short,
      stageColor: stage.color,
      group: m.group,
      fixture: m.fixture,
      venue: m.venue,
      city: m.venue.split(',')[0]?.trim() ?? m.venue,
      country: m.venue.split(',')[1]?.trim() ?? '',
      kickoffUTC: utc,
      teams,
      mustWatch: MUST_WATCH_IDS.has(stage.id),
    };
  }).sort((a, b) => a.kickoffUTC - b.kickoffUTC);
}
