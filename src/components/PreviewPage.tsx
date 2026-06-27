// PreviewPage.tsx — P161 Match Preview. Line-up pitch + prediction + odds + H2H,
// sourced from ESPN via src/lib/previewData.ts. Desktop uses sub-tabs (fixed CRT
// height); mobile stacks every section and scrolls.
import { useEffect, useMemo, useState } from 'react';
import type { Match, TZKey, LiveScore } from '../lib/types';
import { formatTime, formatDay } from '../lib/dataUtils';
import { isMatchFinished, resolveScore } from '../lib/liveData';
import { fetchPreview, type MatchPreview, type TeamLineup, type LineupPlayer } from '../lib/previewData';

interface PreviewPageProps {
  matches: Match[];
  now: number;
  viewer: TZKey;
  liveScores: Map<number, LiveScore>;
  selectedPreviewNum: number | null;
  isMobile: boolean;
}

// Each team's results so far this tournament, computed from our own match data
// (ESPN provides no WC2026 form). Result is from the given team's perspective.
interface TeamFormLocal { teamShort: string; last: ('W' | 'D' | 'L')[]; w: number; d: number; l: number; }
function teamForm(teamShort: string, matches: Match[], liveScores: Map<number, LiveScore>, now: number): TeamFormLocal {
  const played = matches
    .filter(m => (m.teams[0].short === teamShort || m.teams[1].short === teamShort)
      && isMatchFinished(m.num, m.kickoffUTC, now, liveScores))
    .sort((a, b) => a.kickoffUTC - b.kickoffUTC);
  const last: ('W' | 'D' | 'L')[] = [];
  let w = 0, d = 0, l = 0;
  for (const m of played) {
    const r = resolveScore(m.num, liveScores);
    if (!r) continue;
    const isHome = m.teams[0].short === teamShort;
    const gf = isHome ? r.home : r.away, ga = isHome ? r.away : r.home;
    const res: 'W' | 'D' | 'L' = gf > ga ? 'W' : gf < ga ? 'L' : 'D';
    if (res === 'W') w++; else if (res === 'D') d++; else l++;
    last.push(res);
  }
  return { teamShort, last: last.slice(-5), w, d, l };
}

const LINE_ORDER_AWAY: LineupPlayer['line'][] = ['GK', 'DEF', 'MID', 'FWD'];
const LINE_ORDER_HOME: LineupPlayer['line'][] = ['FWD', 'MID', 'DEF', 'GK'];
const LINE_CLASS: Record<LineupPlayer['line'], string> = { GK: 'pv-gk', DEF: 'pv-def', MID: 'pv-mid', FWD: 'pv-fwd' };

function surname(name: string): string { const p = name.trim().split(' '); return (p[p.length - 1] ?? name).toUpperCase(); }

// 2–3 sentence summary woven from the real preview data (prediction, H2H, venue).
function previewSummary(match: Match, p: MatchPreview): string {
  const home = match.teams[0], away = match.teams[1];
  const stage = match.stageId === 'group' ? match.group : match.stage;
  const venue = p.venue ?? match.city;
  const out: string[] = [];

  if (p.prediction) {
    const { homePct, drawPct, awayPct } = p.prediction;
    if (drawPct >= homePct && drawPct >= awayPct) {
      out.push(`The market can barely separate ${home.name} and ${away.name} (${homePct}-${drawPct}-${awayPct}) in this ${stage} tie at ${venue}.`);
    } else if (Math.abs(homePct - awayPct) <= 8) {
      out.push(`A tight ${stage} contest is expected between ${home.name} and ${away.name} at ${venue}, with the bookmakers favouring neither (${homePct}-${drawPct}-${awayPct}).`);
    } else {
      const fav = homePct > awayPct ? home : away;
      const pct = Math.max(homePct, awayPct);
      out.push(`${fav.name} start as ${pct >= 60 ? 'clear' : 'slight'} favourites (${pct}%) for this ${stage} fixture at ${venue}.`);
    }
  } else {
    out.push(`${home.name} face ${away.name} in this ${stage} fixture at ${venue}.`);
  }

  if (p.h2h && p.h2h.played > 0) {
    out.push(`The two have met ${p.h2h.played} time${p.h2h.played === 1 ? '' : 's'} in recent records — ${home.short} ${p.h2h.homeWins}, ${away.short} ${p.h2h.awayWins}, drawn ${p.h2h.draws}.`);
  }

  out.push(p.lineups ? `Confirmed line-ups are in.` : `Probable XIs land around an hour before kick-off.`);
  return out.join(' ');
}

function PitchHalf({ team, side }: { team: TeamLineup; side: 'home' | 'away' }) {
  const order = side === 'home' ? LINE_ORDER_HOME : LINE_ORDER_AWAY;
  return (
    <div className={`pv-pitch__half pv-pitch__half--${side}`}>
      {order.map(line => {
        const players = team.starters.filter(p => p.line === line);
        if (!players.length) return null;
        return (
          <div className="pv-pitch__line" key={line}>
            {players.map((p, i) => (
              <div className="pv-player" key={`${line}-${i}`}>
                <span className={`pv-dot ${LINE_CLASS[p.line]}`}>{p.number ?? ''}</span>
                <span className="pv-player__name">{surname(p.name)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function LineupPitch({ home, away }: { home: TeamLineup; away: TeamLineup }) {
  return (
    <div className="pv-pitch">
      <div className="pv-pitch__badge pv-pitch__badge--away">{away.teamShort} {away.formation ?? ''}</div>
      <PitchHalf team={away} side="away" />
      <div className="pv-pitch__halfway" />
      <PitchHalf team={home} side="home" />
      <div className="pv-pitch__badge pv-pitch__badge--home">{home.teamShort} {home.formation ?? ''}</div>
    </div>
  );
}

function Bench({ team }: { team: TeamLineup }) {
  if (!team.bench.length) return null;
  return (
    <div className="pv-bench">
      <span className="pv-bench__lbl c-dim">SUBS</span>{' '}
      {team.bench.slice(0, 9).map((p, i) => (
        <span key={i} className="pv-bench__name">{p.number ?? '–'} {surname(p.name)}{i < Math.min(8, team.bench.length - 1) ? ' · ' : ''}</span>
      ))}
    </div>
  );
}

function LineupsSection({ preview, match }: { preview: MatchPreview; match: Match }) {
  if (!preview.lineups) {
    return (
      <div className="pv-empty c-y">
        ► PREDICTED XI UNAVAILABLE<br />
        <span className="c-dim">Confirmed line-ups land ~1 hour before kick-off.</span>
      </div>
    );
  }
  const [home, away] = preview.lineups;
  return (
    <div className="pv-lineups">
      <LineupPitch home={home} away={away} />
      <div className="pv-benches">
        <div><span className="c-c">{match.teams[0].short}</span> <Bench team={home} /></div>
        <div><span className="c-c">{match.teams[1].short}</span> <Bench team={away} /></div>
      </div>
    </div>
  );
}

function FormPills({ f }: { f: TeamFormLocal }) {
  if (!f.last.length) return <span className="c-dim">no games yet</span>;
  return <>{f.last.map((r, i) => <span key={i} className={`pv-formpill pv-formpill--${r}`}>{r}</span>)}</>;
}

function FormOddsSection({ preview, match, form }: { preview: MatchPreview; match: Match; form: [TeamFormLocal, TeamFormLocal] }) {
  const p = preview.prediction;
  const anyForm = form[0].last.length > 0 || form[1].last.length > 0;
  return (
    <div className="pv-formodds">
      {anyForm && (
        <div className="pv-block">
          <div className="pv-block__lbl c-g">► FORM <span className="c-dim">· this tournament</span></div>
          <div className="pv-form">
            <div className="pv-form__row"><span className="c-w">{match.teams[0].short}</span> <FormPills f={form[0]} /></div>
            <div className="pv-form__row"><span className="c-w">{match.teams[1].short}</span> <FormPills f={form[1]} /></div>
          </div>
        </div>
      )}

      <div className="pv-block">
        <div className="pv-block__lbl c-g">► PREDICTION</div>
        {p ? (
          <>
            <div className="pv-predbar">
              <i className="pv-predbar__h" style={{ width: `${p.homePct}%` }} />
              <i className="pv-predbar__d" style={{ width: `${p.drawPct}%` }} />
              <i className="pv-predbar__a" style={{ width: `${p.awayPct}%` }} />
            </div>
            <div className="pv-predrow">
              <span className="c-y">{match.teams[0].short} {p.homePct}%</span>
              <span className="c-dim">DRAW {p.drawPct}%</span>
              <span className="c-c">{match.teams[1].short} {p.awayPct}%</span>
            </div>
            <div className="pv-predsrc c-dim">Implied by market odds</div>
          </>
        ) : <div className="c-dim">— UNAVAILABLE —</div>}
      </div>

      <div className="pv-block">
        <div className="pv-block__lbl c-g">► ODDS {preview.odds ? <span className="c-dim">· {preview.odds.bookmaker}</span> : null}</div>
        {preview.odds ? (
          <div className="pv-odds">
            <div><span className="c-w">{match.teams[0].short}</span><span className="c-y">{preview.odds.home.toFixed(2)}</span></div>
            <div><span className="c-w">DRAW</span><span className="c-y">{preview.odds.draw.toFixed(2)}</span></div>
            <div><span className="c-w">{match.teams[1].short}</span><span className="c-y">{preview.odds.away.toFixed(2)}</span></div>
          </div>
        ) : <div className="c-dim">— UNAVAILABLE —</div>}
      </div>

      {preview.h2h && (
        <div className="pv-block">
          <div className="pv-block__lbl c-g">► HEAD TO HEAD <span className="c-dim">· last {preview.h2h.played}</span></div>
          <div className="pv-odds">
            <div><span className="c-w">{match.teams[0].short}</span><span className="c-y">{preview.h2h.homeWins}</span></div>
            <div><span className="c-w">DRAW</span><span className="c-y">{preview.h2h.draws}</span></div>
            <div><span className="c-w">{match.teams[1].short}</span><span className="c-y">{preview.h2h.awayWins}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PreviewPage({ matches, now, viewer, liveScores, selectedPreviewNum, isMobile }: PreviewPageProps) {
  const upcoming = useMemo(() => matches.filter(m => m.kickoffUTC > now).sort((a, b) => a.kickoffUTC - b.kickoffUTC), [matches, now]);
  const match = useMemo(
    () => matches.find(m => m.num === selectedPreviewNum) ?? upcoming[0],
    [matches, selectedPreviewNum, upcoming],
  );
  const form = useMemo<[TeamFormLocal, TeamFormLocal] | null>(
    () => match ? [teamForm(match.teams[0].short, matches, liveScores, now), teamForm(match.teams[1].short, matches, liveScores, now)] : null,
    [match, matches, liveScores, now],
  );
  const [preview, setPreview] = useState<MatchPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'lineups' | 'formodds'>('lineups');

  useEffect(() => {
    if (!match) return;
    let live = true;
    setLoading(true);
    setPreview(null);
    fetchPreview(match).then(p => { if (live) { setPreview(p); setLoading(false); } });
    return () => { live = false; };
  }, [match]);

  if (!match) {
    return <div className="tt__body" style={{ display: 'grid', placeItems: 'center' }}>
      <div className="c-y" style={{ fontSize: 28 }}>NO UPCOMING FIXTURES TO PREVIEW.</div>
    </div>;
  }

  const stage = match.stageId === 'group' ? match.group.toUpperCase() : match.stage.toUpperCase();
  const venue = preview?.venue ?? match.venue;

  const lineups = preview ? <LineupsSection preview={preview} match={match} /> : null;
  const formodds = preview && form ? <FormOddsSection preview={preview} match={match} form={form} /> : null;

  return (
    <div className="tt__body pv">
      <div className="pv__head">
        <span className="c-y">{match.teams[0].name.toUpperCase()}</span>
        <span className="c-dim"> v </span>
        <span className="c-c">{match.teams[1].name.toUpperCase()}</span>
        <div className="pv__meta c-w">
          KO {formatTime(match.kickoffUTC, viewer)} · {formatDay(match.kickoffUTC, viewer).toUpperCase()}
          <span className="c-dim"> · </span>{venue}<span className="c-dim"> · </span>{stage}
        </div>
      </div>

      {!loading && preview && <div className="pv__summary c-c">{previewSummary(match, preview)}</div>}

      {loading && <div className="pv-empty c-dim">LOADING PREVIEW…</div>}

      {!loading && preview && (
        isMobile ? (
          <>{lineups}{formodds}</>
        ) : (
          <>
            <div className="pv__tabs">
              <button className={`pv__tab${tab === 'lineups' ? ' on' : ''}`} onClick={() => setTab('lineups')}>LINE-UPS</button>
              <button className={`pv__tab${tab === 'formodds' ? ' on' : ''}`} onClick={() => setTab('formodds')}>PREDICTION &amp; ODDS</button>
            </div>
            <div className="pv__tabbody">{tab === 'lineups' ? lineups : formodds}</div>
          </>
        )
      )}
    </div>
  );
}
