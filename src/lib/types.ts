// types.ts — shared TypeScript interfaces for the WC2026 Teletext app

export type TZKey = 'PT' | 'CDM' | 'ET' | 'BRT' | 'LDN' | 'PAR' | 'DXB' | 'SHA' | 'TYO' | 'SYD';

export interface TZInfo {
  key: TZKey;
  label: string;
  code: string;
  offsetHrs: number;
}

export interface StageInfo {
  id: string;
  short: string;
  color: string;
  tone: string;
  importance: number;
}

export interface RawMatch {
  num: number;
  stage: string;
  group: string;
  fixture: string;
  venue: string;
  // All 8 timezone columns from the schedule spreadsheet
  ptDay: string;   ptTime: string;   // Los Angeles (PT)
  etDay: string;   etTime: string;   // New York (ET)
  brtDay: string;  brtTime: string;  // São Paulo (BRT)
  artDay: string;  artTime: string;  // Buenos Aires (ART)
  bstDay: string;  bstTime: string;  // London (BST) — UTC anchor
  cestDay: string; cestTime: string; // Madrid/Paris (CEST)
  istDay: string;  istTime: string;  // Mumbai (IST)
  aestDay: string; aestTime: string; // Sydney (AEST)
}

export interface TeamInfo {
  name: string;
  short: string;
  placeholder: boolean;
}

export interface Match {
  num: number;
  stage: string;
  stageId: string;
  stageShort: string;
  stageColor: string;
  group: string;
  fixture: string;
  venue: string;
  city: string;
  country: string;
  kickoffUTC: number;
  teams: [TeamInfo, TeamInfo];
  mustWatch: boolean;
}

export interface DateParts {
  year: number;
  month: number;
  date: number;
  hour: number;
  minute: number;
  weekday: number;
  ymd: string;
  ms: number;
}

export interface FakeResult {
  home: number;
  away: number;
}

export interface ScorerEntry {
  name: string;
  minute: number;
}

export interface FullResult {
  score: FakeResult;
  scorers: { home: ScorerEntry[]; away: ScorerEntry[] };
  // null when the data source doesn't expose match detail (free tier) — UI shows "—".
  stats: {
    possession: [number, number];
    shots: [number, number];
    corners: [number, number];
    yellow: [number, number];
  } | null;
  attendance: number | null;
}

export interface StandingRow {
  name: string;
  short: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

export interface GroupResult {
  m: Match;
  finished: boolean;
  live: boolean;
  score: { home: number; away: number } | null;
}

export interface TopScorer {
  name: string;
  team: string;
  goals: number;
}

export interface Headline {
  kind: string;
  kicker: string;
  title: string;
  body: string;
  match?: Match;
  groupName?: string;
  link?: string;       // external URL (BBC Sport articles only)
}

export type PageId = 'news' | 'fixtures' | 'results' | 'groups' | 'groupdet' | 'review' | 'preview';

// ── Live data ──────────────────────────────────────────────────────────────
// football-data.org status values (plus a few extras for safety)
export type MatchStatus =
  | 'SCHEDULED' | 'TIMED'
  | 'IN_PLAY'   | 'PAUSED'
  | 'FINISHED'
  | 'POSTPONED' | 'CANCELLED' | 'SUSPENDED';

export interface LiveScore {
  home:    number;
  away:    number;
  status:  MatchStatus;
  minute?: number;       // populated during IN_PLAY / PAUSED
}

export interface NewsItem {
  title:       string;
  description: string;
  link:        string;
  pubDate:     string;
}

export interface FastextItem {
  c: 'r' | 'g' | 'y' | 'c';
  label: string;
  to: PageId;
}

export interface PageConfig {
  id: PageId;
  no: string;
  title: string;
  titleColor: string;
  subRight: string;
  fastext: FastextItem[];
}
