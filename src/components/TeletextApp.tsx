// TeletextApp.tsx — TV chassis, remote control, page router, keyboard handling
import { useState, useEffect, useRef, useCallback } from 'react';
import { loadMatches, TZ, TZ_ORDER } from '../lib/dataUtils';
import { fetchLiveScores, fetchNewsHeadlines } from '../lib/liveData';
import type { Match, TZKey, PageId, PageConfig, LiveScore, NewsItem } from '../lib/types';
import {
  NewsPage, FixturesPage, ResultsPage,
  GroupsPage, GroupDetailPage, MatchReviewPage,
} from './TeletextViews';
import { groupStandings } from '../lib/teletextData';

// ── Page registry ──────────────────────────────────────────────────────────
const PAGES: Record<string, PageConfig> = {
  '100': { id: 'news',     no: '100', title: 'NEWS',     titleColor: 'is-yellow', subRight: 'WORLD CUP 2026',
    fastext: [{ c: 'r', label: 'INDEX',        to: 'news' },{ c: 'g', label: 'FIXTURES',     to: 'fixtures' },{ c: 'y', label: 'RESULTS',      to: 'results' },{ c: 'c', label: 'GROUP TABLES', to: 'groups' }] },
  '140': { id: 'fixtures', no: '140', title: 'FIXTURES', titleColor: 'is-yellow', subRight: 'WORLD CUP 2026',
    fastext: [{ c: 'r', label: 'NEWS',         to: 'news' },{ c: 'g', label: 'RESULTS',      to: 'results' },{ c: 'y', label: 'GROUP TABLES', to: 'groups' },{ c: 'c', label: 'MATCH REPORT', to: 'review' }] },
  '141': { id: 'results',  no: '141', title: 'RESULTS',  titleColor: '',          subRight: 'WORLD CUP 2026',
    fastext: [{ c: 'r', label: 'NEWS',         to: 'news' },{ c: 'g', label: 'FIXTURES',     to: 'fixtures' },{ c: 'y', label: 'GROUP TABLES', to: 'groups' },{ c: 'c', label: 'MATCH REPORT', to: 'review' }] },
  '150': { id: 'groups',   no: '150', title: 'GROUPS',   titleColor: '',          subRight: 'WORLD CUP 2026',
    fastext: [{ c: 'r', label: 'NEWS',         to: 'news' },{ c: 'g', label: 'FIXTURES',     to: 'fixtures' },{ c: 'y', label: 'RESULTS',      to: 'results' },{ c: 'c', label: 'GROUP DETAIL', to: 'groupdet' }] },
  '151': { id: 'groupdet', no: '151', title: 'GROUP',    titleColor: 'is-yellow', subRight: 'WORLD CUP 2026',
    fastext: [{ c: 'r', label: 'NEWS',         to: 'news' },{ c: 'g', label: 'BACK TO GROUPS',to: 'groups'},{ c: 'y', label: 'FIXTURES',     to: 'fixtures' },{ c: 'c', label: 'MATCH REPORT', to: 'review' }] },
  '160': { id: 'review',   no: '160', title: 'REPORT',   titleColor: 'is-white',  subRight: 'WORLD CUP 2026',
    fastext: [{ c: 'r', label: 'NEWS',         to: 'news' },{ c: 'g', label: 'FIXTURES',     to: 'fixtures' },{ c: 'y', label: 'RESULTS',      to: 'results' },{ c: 'c', label: 'GROUP TABLES', to: 'groups' }] },
};
const ID_TO_NO: Record<PageId, string> = { news:'100',fixtures:'140',results:'141',groups:'150',groupdet:'151',review:'160' };

// ── Main App ───────────────────────────────────────────────────────────────
export default function TeletextApp() {
  const [matches,          setMatches]          = useState<Match[] | null>(null);
  const [pageId,           setPageId]           = useState<PageId>('news');
  const [tuning,           setTuning]           = useState(false);
  const [now,              setNow]              = useState<number>(Date.now);
  const [viewer,           setViewer]           = useState<TZKey>('LDN');  // default London
  const [fixturesPage,     setFixturesPage]     = useState(0);
  const [resultsPage,      setResultsPage]      = useState(0);
  const [focusedGroup,     setFocusedGroup]     = useState('Group A');
  const [selectedMatchNum, setSelectedMatchNum] = useState<number | null>(null);
  const [clockTick,        setClockTick]        = useState(0);
  const [typed,            setTyped]            = useState('');
  const [liveScores,       setLiveScores]       = useState<Map<number, LiveScore>>(new Map());
  const [newsItems,        setNewsItems]        = useState<NewsItem[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);

  // Load matches then immediately fetch live scores
  useEffect(() => {
    loadMatches().then(m => {
      setMatches(m);
      fetchLiveScores(m).then(setLiveScores);
    });
  }, []);

  // Poll live scores every 5 min
  useEffect(() => {
    if (!matches) return;
    const id = setInterval(() => fetchLiveScores(matches).then(setLiveScores), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [matches]);

  // Fetch + poll news headlines every 15 min
  useEffect(() => {
    fetchNewsHeadlines().then(setNewsItems);
    const id = setInterval(() => fetchNewsHeadlines().then(setNewsItems), 15 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Tick clock every second
  useEffect(() => {
    const id = setInterval(() => setClockTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Keep "now" in sync with real time
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Scale TV stage to fit viewport
  useEffect(() => {
    const fit = () => {
      const el = stageRef.current;
      if (!el) return;
      const s = Math.min(window.innerWidth / 1640, window.innerHeight / 1020);
      el.style.setProperty('--scale', String(s));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [matches]);

  // Channel-switch with brief noise burst
  const switchPage = useCallback((id: PageId) => {
    if (id === pageId || tuning) return;
    setTuning(true);
    setTimeout(() => {
      setPageId(id);
      setTimeout(() => setTuning(false), 140);
    }, 240);
  }, [pageId, tuning]);

  // Type a digit on the remote
  const typeDigit = useCallback((d: string) => {
    setTyped(t => {
      const next = (t + d).slice(-3);
      const found = Object.values(PAGES).find(p => p.no === next);
      if (found) { switchPage(found.id); return ''; }
      return next;
    });
  }, [switchPage]);
  const clearTyped = useCallback(() => setTyped(''), []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) { typeDigit(e.key); return; }
      const page = PAGES[ID_TO_NO[pageId]];
      const fxKey = (['r','g','y','c'] as const).find(k => k === e.key.toLowerCase());
      if (fxKey && page) { const fx = page.fastext.find(f => f.c === fxKey); if (fx) switchPage(fx.to); return; }
      if (e.key === 'ArrowRight') {
        if (pageId === 'fixtures') setFixturesPage(p => p + 1);
        if (pageId === 'results')  setResultsPage(p => p + 1);
      }
      if (e.key === 'ArrowLeft') {
        if (pageId === 'fixtures') setFixturesPage(p => Math.max(0, p - 1));
        if (pageId === 'results')  setResultsPage(p => Math.max(0, p - 1));
      }
      if (e.key === 'Escape') clearTyped();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pageId, switchPage, typeDigit, clearTyped]);

  const page = PAGES[ID_TO_NO[pageId]]!;

  // Shared props for page components
  const pageProps = {
    matches: matches ?? [],
    now, viewer,
    liveScores, newsItems,
    switchPage,
    focusedGroup, setFocusedGroup,
    selectedMatchNum, setSelectedMatchNum,
  };

  return (
    <div className="app">
      <div className="tv-stage" ref={stageRef}>
        <div className="tv">

          {/* ── Screen bay ── */}
          <div className="tv__screen-bay">
            <div className="tv__bezel">
              <div className={`crt${tuning ? ' is-tuning' : ''}`}>
                {matches ? (
                  <div className="tt">
                    <StatusBar page={page} clockTick={clockTick} viewer={viewer} setViewer={setViewer} />
                    <Masthead page={page} />
                    <SubHeader pageId={pageId} matches={matches} now={now} focusedGroup={focusedGroup} viewer={viewer} liveScores={liveScores} />

                    {/* Page content */}
                    {pageId === 'news'     && <NewsPage     {...pageProps} />}
                    {pageId === 'fixtures' && <FixturesPage {...pageProps} page={fixturesPage} setPage={setFixturesPage as (fn: (p: number) => number) => void} />}
                    {pageId === 'results'  && <ResultsPage  {...pageProps} page={resultsPage}  setPage={setResultsPage  as (fn: (p: number) => number) => void} />}
                    {pageId === 'groups'   && <GroupsPage   {...pageProps} />}
                    {pageId === 'groupdet' && <GroupDetailPage {...pageProps} />}
                    {pageId === 'review'   && <MatchReviewPage {...pageProps} />}

                    <FastextBar page={page} switchPage={switchPage} />
                  </div>
                ) : (
                  <div className="tt">
                    <div className="tt__loading">TUNING IN</div>
                  </div>
                )}
                {/* CRT overlays */}
                <div className="crt__noise"></div>
                <div className="crt__flicker"></div>
                <div className="crt__scan"></div>
                <div className="crt__glare"></div>
                <div className="crt__vignette"></div>
              </div>
            </div>
          </div>

          {/* ── Remote control ── */}
          <Remote
            page={page}
            typed={typed}
            typeDigit={typeDigit}
            clearTyped={clearTyped}
            switchPage={switchPage}
            viewer={viewer}
            setViewer={setViewer}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Status bar ────────────────────────────────────────────────────────────
function StatusBar({ page, clockTick: _tick, viewer, setViewer }: {
  page: PageConfig; clockTick: number; viewer: TZKey; setViewer: (z: TZKey) => void;
}) {
  const d   = new Date();
  const wk  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
  const mo  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="tt__bar">
      <span className="pno">P{page.no}</span>
      <span className="src">CEEFAX {page.no}</span>
      <span className="tz">
        <span className="c-dim">TZ ▸</span>
        {TZ_ORDER.map(zk => (
          <button key={zk} className={`tz__btn${viewer === zk ? ' on' : ''}`} onClick={() => setViewer(zk)}>{zk}</button>
        ))}
      </span>
      <span className="when">
        <span className="c-w">{wk} {pad(d.getDate())} {mo} </span>
        <span className="clock">{pad(d.getHours())}:{pad(d.getMinutes())}/{pad(d.getSeconds())}</span>
      </span>
    </div>
  );
}

// ─── Masthead ──────────────────────────────────────────────────────────────
function Masthead({ page }: { page: PageConfig }) {
  return (
    <div className="tt__head">
      <div className="tt__brand">
        <div className="tt__logo"><TrophyMosaic /></div>
        <div className={`tt__title ${page.titleColor}`}>{page.title}</div>
        <div className="tt__head-tag c-r">WORLD CUP<br />2026</div>
      </div>
    </div>
  );
}

// ─── Sub-header ────────────────────────────────────────────────────────────
function SubHeader({ pageId, matches, now, focusedGroup, viewer, liveScores }: {
  pageId: PageId; matches: Match[]; now: number; focusedGroup: string; viewer: TZKey;
  liveScores: Map<number, LiveScore>;
}) {
  const t = TZ[viewer]?.code ?? '';
  let node: React.ReactNode = null;
  if (pageId === 'news')     node = <><span className="em">— DAILY HEADLINES —</span> ALL TIMES IN {t}</>;
  if (pageId === 'fixtures') node = <><span className="em">— UPCOMING —</span> KICK-OFF TIMES SHOWN IN {t}</>;
  if (pageId === 'results')  node = <><span className="em">— FINAL SCORES —</span> MOST RECENT FIRST</>;
  if (pageId === 'groups') {
    const count = Object.keys(groupStandings(matches, now, liveScores)).length;
    node = <>{count} GROUPS <span className="em">·</span> 48 NATIONS <span className="em">·</span> TOP 2 ADVANCE</>;
  }
  if (pageId === 'groupdet') node = <>{focusedGroup.toUpperCase()} <span className="em">· FULL TABLE · MATCH-BY-MATCH</span></>;
  if (pageId === 'review')   node = <><span className="em">— MOST RECENT RESULTS —</span> PICK BELOW TO DRILL IN</>;
  return <div className="tt__sub">{node}</div>;
}

// ─── Fastext color bar ─────────────────────────────────────────────────────
function FastextBar({ page, switchPage }: { page: PageConfig; switchPage: (id: PageId) => void }) {
  return (
    <div className="tt__fastext">
      {page.fastext.map(f => (
        <button key={f.c} className={`fx-${f.c}`} onClick={() => switchPage(f.to)}>{f.label}</button>
      ))}
    </div>
  );
}

// ─── Trophy mosaic sprite ──────────────────────────────────────────────────
function TrophyMosaic() {
  const grid = [
    [0,1,1,1,1,1,0],
    [1,2,2,3,2,2,1],
    [1,2,3,3,3,2,1],
    [0,1,3,3,3,1,0],
    [0,0,1,3,1,0,0],
    [0,1,1,3,1,1,0],
    [1,1,1,3,1,1,1],
  ];
  const palette: Record<number, string> = { 1:'var(--tt-cyan)', 2:'var(--tt-white)', 3:'var(--tt-yellow)' };
  return (
    <svg viewBox="0 0 7 7" preserveAspectRatio="none">
      {grid.flatMap((row, y) => row.map((v, x) => v ? (
        <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={palette[v]} />
      ) : null))}
    </svg>
  );
}

// ─── Remote control ────────────────────────────────────────────────────────
function Remote({ page, typed, typeDigit, clearTyped, switchPage, viewer, setViewer }: {
  page: PageConfig;
  typed: string;
  typeDigit: (d: string) => void;
  clearTyped: () => void;
  switchPage: (id: PageId) => void;
  viewer: TZKey;
  setViewer: (z: TZKey) => void;
}) {
  return (
    <div className="rmt">
      {/* Brand panel */}
      <div className="rmt__brand">
        <span className="rmt__arrow">▾</span>
        <span className="rmt__model">5311</span>
        <span className="rmt__role">REMOTE CONTROL</span>
      </div>

      {/* Channel display */}
      <div className="rmt__display">
        <div className="rmt__display__row">
          <span className="c-dim">CH</span>
          <span className="rmt__display__val">
            {(typed || page.no).split('').map((c, i) => (
              <span key={i} className={typed ? 'is-typed' : ''}>{c}</span>
            ))}
            {typed && <span className="rmt__caret">_</span>}
          </span>
        </div>
        <div className="rmt__display__lbl c-y">{page.title}</div>
      </div>

      {/* Number keypad */}
      <div className="rmt__keypad">
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} className="rmt__key" onClick={() => typeDigit(String(n))}>{n}</button>
        ))}
        <button className="rmt__key rmt__key--alt" onClick={clearTyped} title="Clear">C</button>
        <button className="rmt__key" onClick={() => typeDigit('0')}>0</button>
        <button className="rmt__key rmt__key--alt" onClick={() => switchPage('news')} title="Index">i</button>
      </div>

      {/* Fastext color buttons */}
      <div className="rmt__fastext">
        <div className="rmt__fastext__lbl c-dim">FASTEXT</div>
        <div className="rmt__fastext__row">
          {page.fastext.map(f => (
            <button key={f.c} className={`rmt__fxbtn rmt__fxbtn--${f.c}`} onClick={() => switchPage(f.to)} title={f.label}>
              <span className="dot"></span>
            </button>
          ))}
        </div>
      </div>

      {/* Time zone selector */}
      <div className="rmt__tz">
        <div className="rmt__tz__lbl c-dim">TIME ZONE</div>
        <div className="rmt__tz__row">
          {TZ_ORDER.map(zk => (
            <button key={zk} className={`rmt__tzbtn${viewer === zk ? ' on' : ''}`} onClick={() => setViewer(zk)}>{zk}</button>
          ))}
        </div>
      </div>

      {/* Transport */}
      <div className="rmt__transport">
        <button className="rmt__sm">◄◄</button>
        <button className="rmt__sm rmt__sm--play">▶</button>
        <button className="rmt__sm">►►</button>
      </div>

      {/* Brand foot */}
      <div className="rmt__foot">
        <span>.monks</span>
        <span className="rmt__pwr"></span>
      </div>
    </div>
  );
}
