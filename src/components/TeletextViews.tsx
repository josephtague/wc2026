// TeletextViews.tsx — P100 News · P140 Fixtures · P141 Results · P150 Groups · P151 Group Detail · P160 Match Review
import { useMemo, useState } from 'react';
import {
  formatTime, formatDay, formatDayShort,
  inTz, sleepScore, SLEEP_QUIP, WK, MO,
} from '../lib/dataUtils';
import { resolveScore, isMatchFinished, isMatchLive } from '../lib/liveData';
import { fullResult, narrative, groupStandings, groupResults, topScorers, headlines } from '../lib/teletextData';
import type { Match, TZKey, PageId, LiveScore, NewsItem, Headline } from '../lib/types';

// ── Shared props types ─────────────────────────────────────────────────────
interface BaseProps {
  matches: Match[];
  now: number;
  viewer: TZKey;
  liveScores: Map<number, LiveScore>;
  newsItems: NewsItem[];
  switchPage: (id: PageId) => void;
  setSelectedMatchNum: (n: number) => void;
  setFocusedGroup: (g: string) => void;
  focusedGroup: string;
}

// ─────────────────────────────────────────────────────────────────────
// P100  NEWS HEADLINES
// ─────────────────────────────────────────────────────────────────────
export function NewsPage({ matches, now, viewer, liveScores, newsItems, switchPage, setSelectedMatchNum, setFocusedGroup }: BaseProps) {
  const hl      = useMemo(() => headlines(matches, now, viewer, liveScores, newsItems), [matches, now, viewer, liveScores, newsItems]);
  const scorers = useMemo(() => topScorers(matches, now, 6, liveScores), [matches, now, liveScores]);
  const nextMatch = useMemo(() => matches.find(m => m.kickoffUTC > now), [matches, now]);
  const [drawerItem, setDrawerItem] = useState<Headline | null>(null);

  const trim = (s: string, n: number) => s.length <= n ? s : s.slice(0, n - 1).replace(/\s\S*$/, '') + '…';

  const handleHeadlineClick = (h: Headline) => {
    if (h.kind === 'news')   { setDrawerItem(h); return; }
    if (h.match)             { setSelectedMatchNum(h.match.num); switchPage('review'); }
    if (h.groupName)         { setFocusedGroup(h.groupName);     switchPage('groupdet'); }
  };

  return (
    <div className="tt__body news">
      <div className="news__grid">
        <div className="news__col">
          <div className="news__hero"
            onClick={() => hl[0] && handleHeadlineClick(hl[0])}
            style={{ cursor: hl[0]?.kind === 'news' ? 'pointer' : 'default' }}>
            <span className="news__kick c-r">★ HEADLINE</span>
            {hl[0] && (
              <>
                <div className="news__title c-y">{hl[0].title}</div>
                <div className="news__body c-c">{trim(hl[0].body, 180)}</div>
                {hl[0].kind === 'news' && <div className="news__read-more c-g">▸ TAP TO READ MORE</div>}
              </>
            )}
          </div>
          {hl.slice(1).map((h, i) => (
            <div key={i} className="news__item"
              onClick={() => handleHeadlineClick(h)}
              style={{ cursor: (h.kind === 'news' || h.match || h.groupName) ? 'pointer' : 'default' }}>
              <div className="news__kick c-g">▸ {h.kicker}</div>
              <div className="news__sub c-y">{h.title}</div>
              <div className="news__body c-w">{trim(h.body, 110)}</div>
            </div>
          ))}
        </div>

        <div className="news__col">
          {nextMatch && (
            <div className="news__nextup">
              <div className="news__kick c-m">► NEXT KICK-OFF</div>
              <div className="news__nextmatch">
                <span className="c-y">{nextMatch.teams[0].short}</span>
                <span className="c-dim"> v </span>
                <span className="c-y">{nextMatch.teams[1].short}</span>
              </div>
              <div className="news__countdown">
                <Countdown to={nextMatch.kickoffUTC} now={now} />
              </div>
              <div className="news__nextmeta c-c">
                {formatTime(nextMatch.kickoffUTC, viewer)} · {nextMatch.city}
              </div>
            </div>
          )}

          <div className="news__scorers">
            <div className="news__kick c-y">► GOLDEN BOOT RACE</div>
            {scorers.length === 0 && <div className="c-dim">No goals yet.</div>}
            {scorers.map((s, i) => (
              <div key={i} className="news__scorerrow">
                <span className="c-w">{String(i + 1).padStart(2, '0')}.</span>
                <span className="c-y">{s.name}</span>
                <span className="c-c">({s.team})</span>
                <span className="c-w" style={{ textAlign: 'right' }}>{s.goals}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

        <NewsDrawer item={drawerItem} onClose={() => setDrawerItem(null)} />
    </div>
  );
}

// ── News article drawer ────────────────────────────────────────────────────
function NewsDrawer({ item, onClose }: { item: Headline | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <div className="news__drawer" onClick={onClose}>
      <div className="news__drawer__panel" onClick={e => e.stopPropagation()}>
        <div className="news__drawer__kicker c-g">▸ {item.kicker}</div>
        <div className="news__drawer__title c-y">{item.title}</div>
        <div className="news__drawer__body c-w">{item.body}</div>
        {item.link && (
          <a className="news__drawer__link c-c" href={item.link} target="_blank" rel="noreferrer">
            ► READ FULL STORY ON BBC SPORT
          </a>
        )}
        <button className="news__drawer__close c-r" onClick={onClose}>✕ CLOSE</button>
      </div>
    </div>
  );
}

function Countdown({ to, now }: { to: number; now: number }) {
  const ms     = Math.max(0, to - now);
  const totalS = Math.floor(ms / 1000);
  const days   = Math.floor(totalS / 86400);
  const hours  = Math.floor((totalS % 86400) / 3600);
  const mins   = Math.floor((totalS % 3600) / 60);
  const secs   = totalS % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return days > 0
    ? <span>{days}d {p(hours)}:{p(mins)}:{p(secs)}</span>
    : <span>{p(hours)}:{p(mins)}:{p(secs)}</span>;
}

// ─────────────────────────────────────────────────────────────────────
// P140  UPCOMING FIXTURES
// ─────────────────────────────────────────────────────────────────────
interface PaginatedProps extends BaseProps {
  page: number;
  setPage: (fn: (p: number) => number) => void;
}

export function FixturesPage({ matches, now, viewer, liveScores, page, setPage }: PaginatedProps) {
  const upcoming = useMemo(
    () => matches.filter(m => !isMatchFinished(m.num, m.kickoffUTC, now, liveScores)),
    [matches, now, liveScores],
  );
  return <FixturesOrResults rows={upcoming} viewer={viewer} liveScores={liveScores} page={page} setPage={setPage} showResults={false} showSleep now={now} />;
}

// ─────────────────────────────────────────────────────────────────────
// P141  RESULTS
// ─────────────────────────────────────────────────────────────────────
export function ResultsPage({ matches, now, viewer, liveScores, page, setPage }: PaginatedProps) {
  const played = useMemo(
    () => matches.filter(m => isMatchFinished(m.num, m.kickoffUTC, now, liveScores)).slice().reverse(),
    [matches, now, liveScores],
  );
  return <FixturesOrResults rows={played} viewer={viewer} liveScores={liveScores} page={page} setPage={setPage} showResults showSleep={false} now={now} />;
}

// Shared list renderer
interface FORProps {
  rows: Match[];
  viewer: TZKey;
  liveScores: Map<number, LiveScore>;
  page: number;
  setPage: (fn: (p: number) => number) => void;
  showResults: boolean;
  showSleep: boolean;
  now: number;
}
function FixturesOrResults({ rows, viewer, liveScores, page, setPage, showResults, showSleep, now }: FORProps) {
  const days = useMemo(() => {
    const map = new Map<string, { key: string; label: string; matches: Match[] }>();
    rows.forEach(m => {
      const d   = inTz(m.kickoffUTC, viewer);
      const key = `${d.year}-${d.month}-${d.date}`;
      if (!map.has(key)) map.set(key, {
        key,
        label: `${WK[d.weekday]} ${d.date} ${MO[d.month]}`.toUpperCase(),
        matches: [],
      });
      map.get(key)!.matches.push(m);
    });
    return [...map.values()];
  }, [rows, viewer]);

  const colA = days.slice(0, Math.ceil(days.length / 2));
  const colB = days.slice(Math.ceil(days.length / 2));

  const renderRow = (m: Match) => {
    const t          = formatTime(m.kickoffUTC, viewer);
    const finished   = isMatchFinished(m.num, m.kickoffUTC, now, liveScores);
    const live       = isMatchLive(m.num, m.kickoffUTC, now, liveScores);
    const stageShort = m.stageId === 'group' ? m.group.replace('Group ', 'GP ') : m.stageShort;
    const r          = (showResults && finished) ? resolveScore(m.num, liveScores) : null;
    const cls        = finished ? 'is-result' : live ? 'is-live' : '';
    const vsLabel    = finished ? (r ? `${r.home}–${r.away}` : '—') : live ? 'LIVE' : 'v';
    const local      = inTz(m.kickoffUTC, viewer);
    const sleep      = sleepScore(local.hour);
    return (
      <div className={`fix__card${cls ? ` ${cls}` : ''}`} key={m.num}>
        <div className="fix__card__time">{t}</div>
        <div className="fix__card__match">
          <span className="fix__card__home c-w">{m.teams[0].short}</span>
          <span className={`fix__card__vs${finished ? ' sc' : ''}`}>{vsLabel}</span>
          <span className="fix__card__away c-w">{m.teams[1].short}</span>
        </div>
        <div className="fix__card__meta">
          {stageShort}{m.city ? ` · ${m.city}` : ''}
        </div>
      </div>
    );
  };

  const renderCol = (col: typeof colA) => col.map(day => (
    <div className="fix__day" key={day.key}>
      <div className="dayhead">─── <span className="c-c">{day.label}</span> ───</div>
      {day.matches.map(renderRow)}
    </div>
  ));

  return (
    <div className="tt__body">
      <div className="fix__cols">
        <div>{renderCol(colA)}</div>
        <div>{renderCol(colB)}</div>
      </div>
    </div>
  );
}

function SleepDot({ s }: { s: number }) {
  const color = s >= 5 ? 'var(--tt-red)' : s >= 4 ? 'var(--tt-magenta)' : s >= 3 ? 'var(--tt-yellow)' : 'var(--tt-green)';
  const label = s >= 5 ? 'ZZ' : s >= 4 ? 'Z!' : s >= 3 ? '··' : 'OK';
  return (
    <span style={{ color, fontSize: 18, marginRight: 6, letterSpacing: 0 }} title={SLEEP_QUIP[s]}>{label}</span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// P150  GROUP TABLES
// ─────────────────────────────────────────────────────────────────────
export function GroupsPage({ matches, now, liveScores, focusedGroup, setFocusedGroup, switchPage }: BaseProps) {
  const standings    = useMemo(() => groupStandings(matches, now, liveScores), [matches, now, liveScores]);
  const groupNames   = Object.keys(standings);
  const focus        = focusedGroup || groupNames[0] || 'Group A';
  const focusResults = useMemo(() => groupResults(matches, focus, now, liveScores), [matches, focus, now, liveScores]);

  return (
    <div className="tt__body">
      <div className="grp__layout">
        <div>
          <div className="grp__grid">
            {groupNames.map(g => {
              const rows    = standings[g]!;
              const letter  = g.replace('Group ', '');
              const isFocus = g === focus;
              const played  = Math.floor(rows.reduce((acc, r) => acc + r.p, 0) / 2);
              return (
                <div key={g} className="grp__card"
                  onClick={() => { setFocusedGroup(g); switchPage('groupdet'); }}
                  style={{ cursor: 'pointer', outline: isFocus ? '1px dashed var(--tt-yellow)' : 'none', outlineOffset: 4 }}>
                  <div className="grp__title">
                    <span className="grp__letter">GP {letter}</span>
                    <span className="badge">{played}/6</span>
                  </div>
                  <div className="grp__table">
                    <div className="grp__th">
                      <span></span>
                      <span>P</span><span>W</span><span>D</span><span>L</span><span>Pts</span>
                    </div>
                    {rows.map((r, idx) => {
                      const cls = idx < 2 ? 'qual' : (r.p === 0 ? '' : 'elim');
                      return (
                        <div key={r.name} className={`grp__tr ${cls}`}>
                          <span className="nm">{r.short}</span>
                          <span>{r.p}</span><span>{r.w}</span><span>{r.d}</span><span>{r.l}</span><span>{r.pts}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grp__h2h">
          <h4>► {focus.toUpperCase()} — HEAD TO HEAD</h4>
          {focusResults.map(({ m, finished, live, score }) => (
            <div key={m.num} className={`grp__h2h__row${finished ? '' : ' pend'}`}>
              <span className="l">{m.teams[0].short}</span>
              <span className="s">{finished ? (score ? `${score.home}-${score.away}` : '—') : (live ? 'LIVE' : '— v —')}</span>
              <span className="r">{m.teams[1].short}</span>
            </div>
          ))}
          <button className="grp__drill" onClick={() => switchPage('groupdet')}>
            ► DRILL INTO {focus.toUpperCase()}  (P151)
          </button>
          <div style={{ marginTop: 8, fontSize: 16 }} className="c-dim">
            Click a group to focus · Double-click to drill in.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// P151  GROUP DETAIL
// ─────────────────────────────────────────────────────────────────────
const ALL_GROUPS = ['Group A','Group B','Group C','Group D','Group E','Group F',
                    'Group G','Group H','Group I','Group J','Group K','Group L'];

export function GroupDetailPage({ matches, now, viewer, liveScores, focusedGroup, setFocusedGroup, setSelectedMatchNum, switchPage }: BaseProps) {
  const g        = focusedGroup || 'Group A';
  const standings = useMemo(() => groupStandings(matches, now, liveScores)[g] ?? [], [matches, now, liveScores, g]);
  const fixtures  = useMemo(() => groupResults(matches, g, now, liveScores), [matches, g, now, liveScores]);
  const letter    = g.replace('Group ', '');
  const idx       = ALL_GROUPS.indexOf(g);
  const prevGroup = () => setFocusedGroup(ALL_GROUPS[(idx - 1 + ALL_GROUPS.length) % ALL_GROUPS.length]);
  const nextGroup = () => setFocusedGroup(ALL_GROUPS[(idx + 1) % ALL_GROUPS.length]);

  return (
    <div className="tt__body">
      <div className="gd">
        <div className="gd__head">
          <div className="gd__letter__wrap">
            <button className="gd__nav__btn" onClick={prevGroup}>◄</button>
            <div className="gd__letter">{letter}</div>
            <button className="gd__nav__btn" onClick={nextGroup}>►</button>
          </div>
          <div>
            <div className="gd__title c-y">GROUP {letter}</div>
            <div className="gd__teams c-c">{standings.map(t => t.short).join(' · ')}</div>
          </div>
        </div>

        <div className="gd__stand">
          <div className="gd__stand__head">
            <span></span>
            <span className="c-c">TEAM</span>
            <span>P</span><span>W</span><span>D</span><span>L</span>
            <span>GF</span><span>GA</span><span>GD</span><span>Pts</span>
          </div>
          {standings.map((r, i) => {
            const cls = i < 2 ? 'qual' : (r.p === 0 ? '' : 'elim');
            return (
              <div key={r.name} className={`gd__stand__row ${cls}`}>
                <span className="pos">{i + 1}.</span>
                <span className="nm">{r.name}</span>
                <span>{r.p}</span><span>{r.w}</span><span>{r.d}</span><span>{r.l}</span>
                <span>{r.gf}</span><span>{r.ga}</span>
                <span>{r.gf - r.ga >= 0 ? '+' : ''}{r.gf - r.ga}</span>
                <span className="pts">{r.pts}</span>
              </div>
            );
          })}
        </div>

        <div className="gd__fix">
          <div className="gd__fix__hd">
            <button className="gd__nav__btn" onClick={prevGroup}>◄</button>
            <span className="c-g">► MATCH-BY-MATCH</span>
            <button className="gd__nav__btn" onClick={nextGroup}>►</button>
          </div>
          {fixtures.map(({ m, finished, live, score }) => (
            <div key={m.num} className="gd__fix__row"
              onClick={() => { if (finished) { setSelectedMatchNum(m.num); switchPage('review'); } }}
              style={{ cursor: finished ? 'pointer' : 'default' }}>
              <span className="c-y">{formatDayShort(m.kickoffUTC, viewer).toUpperCase()}</span>
              <span className="c-y">{formatTime(m.kickoffUTC, viewer)}</span>
              <span className={finished ? 'c-c' : 'c-w'} style={{ textAlign: 'right' }}>{m.teams[0].short}</span>
              <span className={finished ? 'sc c-y' : 'c-dim'} style={{ textAlign: 'center' }}>
                {finished ? (score ? `${score.home}-${score.away}` : '—') : (live ? 'LIVE' : 'v')}
              </span>
              <span className={finished ? 'c-c' : 'c-w'}>{m.teams[1].short}</span>
              <span className="c-dim">{m.city}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// P160  MATCH REVIEW
// ─────────────────────────────────────────────────────────────────────
interface ReviewProps extends BaseProps {
  selectedMatchNum: number | null;
}

export function MatchReviewPage({ matches, now, viewer, liveScores, selectedMatchNum, setSelectedMatchNum }: ReviewProps) {
  const played  = useMemo(() => matches.filter(m => isMatchFinished(m.num, m.kickoffUTC, now, liveScores)), [matches, now, liveScores]);
  const recent5 = played.slice(-5).reverse();

  const match = useMemo(() => {
    if (selectedMatchNum) return matches.find(m => m.num === selectedMatchNum);
    return recent5[0];
  }, [matches, selectedMatchNum, recent5]);

  if (!match) {
    return (
      <div className="tt__body" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="c-y" style={{ fontSize: 32 }}>NO MATCHES PLAYED YET. CHECK BACK AFTER KICK-OFF.</div>
      </div>
    );
  }

  const r    = fullResult(match, liveScores);
  const blurb = narrative(match, r);
  const day  = formatDay(match.kickoffUTC, viewer);
  const time = formatTime(match.kickoffUTC, viewer);

  return (
    <div className="tt__body">
      <div className="mr">
        <div className="mr__head">
          {match.stageId === 'group' ? match.group.toUpperCase() : match.stage.toUpperCase()}
          <span className="c-dim"> · </span>
          <span className="c-y">{match.city.toUpperCase()}</span>
          <span className="c-dim"> · </span>
          <span className="c-w">{day.toUpperCase()} {time}</span>
        </div>

        <div className="mr__score">
          <div className="mr__team">{match.teams[0].name.toUpperCase()}</div>
          <div className="mr__nums">{r.score.home}-{r.score.away}</div>
          <div className="mr__team away">{match.teams[1].name.toUpperCase()}</div>
        </div>

        <div className="mr__scorers">
          <div>
            <div className="lbl">► GOALS</div>
            {r.scorers.home.length === 0 && <div className="c-dim">—</div>}
            {r.scorers.home.map((s, i) => (
              <div key={i}><span className="c-w">{s.name}</span> <span className="c-y">{s.minute}'</span></div>
            ))}
          </div>
          <div className="away">
            <div className="lbl">GOALS ◄</div>
            {r.scorers.away.length === 0 && <div className="c-dim">—</div>}
            {r.scorers.away.map((s, i) => (
              <div key={i}><span className="c-y">{s.minute}'</span> <span className="c-w">{s.name}</span></div>
            ))}
          </div>
        </div>

        <div className="mr__body">
          {blurb.split(/(\b[A-Z][a-zé]+(?:\s[A-Z]\.|\sF\.)?\b)/).map((chunk, i) => {
            if (chunk === match.teams[0].name || chunk === match.teams[1].name)
              return <span key={i} className="key">{chunk}</span>;
            return <span key={i}>{chunk}</span>;
          })}
        </div>

        <div className="mr__stats">
          <Stat label="POSSESSION" h={`${r.stats.possession[0]}%`} a={`${r.stats.possession[1]}%`} barPct={r.stats.possession[0]} />
          <Stat label="SHOTS"   h={r.stats.shots[0]}   a={r.stats.shots[1]} />
          <Stat label="CORNERS" h={r.stats.corners[0]} a={r.stats.corners[1]} />
          <Stat label="YELLOWS" h={r.stats.yellow[0]}  a={r.stats.yellow[1]} />
          <Stat label="ATT." h={r.attendance.toLocaleString()} a="" wide />
        </div>

        <div className="mr__picker">
          {recent5.map(m => {
            const rr = resolveScore(m.num, liveScores) ?? { home: 0, away: 0 };
            const on = m.num === match.num;
            return (
              <button key={m.num} className={`mr__pickbtn${on ? ' on' : ''}`}
                onClick={() => setSelectedMatchNum(m.num)}>
                {m.teams[0].short} <span className="sc">{rr.home}-{rr.away}</span> {m.teams[1].short}
                <br /><span className="c-dim" style={{ fontSize: 16 }}>M{m.num} · {m.stageShort}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface StatProps {
  label: string;
  h: number | string;
  a: number | string;
  barPct?: number;
  wide?: boolean;
}
function Stat({ label, h, a, barPct, wide }: StatProps) {
  if (wide) {
    return (
      <div className="mr__stat">
        <div className="lbl">{label}</div>
        <div className="v" style={{ gridTemplateColumns: '1fr' }}>
          <span className="h" style={{ textAlign: 'left' }}>{h}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="mr__stat">
      <div className="lbl">{label}</div>
      <div className="v"><span className="h">{h}</span><span className="a">{a}</span></div>
      {barPct != null && (
        <div className="bar" style={{ '--p': `${barPct}%` } as React.CSSProperties}>
          <i></i><i></i>
        </div>
      )}
    </div>
  );
}

// ── useState re-export for convenience ─────────────────────────────────────
export { useState };
