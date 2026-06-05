// PreviewPage.tsx — P161 Match Preview. Line-up pitch + prediction + odds + H2H,
// sourced from ESPN via src/lib/previewData.ts. Desktop uses sub-tabs (fixed CRT
// height); mobile stacks every section and scrolls.
import { useEffect, useMemo, useState } from 'react';
import type { Match, TZKey } from '../lib/types';
import { formatTime, formatDay } from '../lib/dataUtils';
import { fetchPreview, type MatchPreview, type TeamLineup, type LineupPlayer } from '../lib/previewData';

interface PreviewPageProps {
  matches: Match[];
  now: number;
  viewer: TZKey;
  selectedPreviewNum: number | null;
  isMobile: boolean;
}

const LINE_ORDER_AWAY: LineupPlayer['line'][] = ['GK', 'DEF', 'MID', 'FWD'];
const LINE_ORDER_HOME: LineupPlayer['line'][] = ['FWD', 'MID', 'DEF', 'GK'];
const LINE_CLASS: Record<LineupPlayer['line'], string> = { GK: 'pv-gk', DEF: 'pv-def', MID: 'pv-mid', FWD: 'pv-fwd' };

function surname(name: string): string { const p = name.trim().split(' '); return (p[p.length - 1] ?? name).toUpperCase(); }

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

function FormOddsSection({ preview, match }: { preview: MatchPreview; match: Match }) {
  const p = preview.prediction;
  return (
    <div className="pv-formodds">
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

export function PreviewPage({ matches, now, viewer, selectedPreviewNum, isMobile }: PreviewPageProps) {
  const upcoming = useMemo(() => matches.filter(m => m.kickoffUTC > now).sort((a, b) => a.kickoffUTC - b.kickoffUTC), [matches, now]);
  const match = useMemo(
    () => matches.find(m => m.num === selectedPreviewNum) ?? upcoming[0],
    [matches, selectedPreviewNum, upcoming],
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
  const formodds = preview ? <FormOddsSection preview={preview} match={match} /> : null;

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
