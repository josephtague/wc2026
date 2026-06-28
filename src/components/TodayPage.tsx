// TodayPage.tsx — P142 Today / Live. Matches kicking off today (viewer TZ) plus
// anything live right now, with KO time / LIVE+minute / FT score. Reuses the
// .fix__card layout from Fixtures/Results so it reads as the same teletext list.
import { useMemo } from 'react';
import { formatTime, inTz } from '../lib/dataUtils';
import { resolveScore, isMatchFinished, isMatchLive } from '../lib/liveData';
import { resolveTeamCodes } from '../lib/bracketData';
import type { Match, TZKey, LiveScore } from '../lib/types';

interface TodayPageProps {
  matches: Match[];
  now: number;
  viewer: TZKey;
  liveScores: Map<number, LiveScore>;
}

export function TodayPage({ matches, now, viewer, liveScores }: TodayPageProps) {
  const teamCodes = useMemo(() => resolveTeamCodes(matches, now, liveScores), [matches, now, liveScores]);

  const todays = useMemo(() => {
    const t = inTz(now, viewer);
    const todayKey = `${t.year}-${t.month}-${t.date}`;
    return matches
      .filter(m => {
        const d = inTz(m.kickoffUTC, viewer);
        const live = isMatchLive(m.num, m.kickoffUTC, now, liveScores);
        return live || `${d.year}-${d.month}-${d.date}` === todayKey;
      })
      .sort((a, b) => a.kickoffUTC - b.kickoffUTC);
  }, [matches, now, viewer, liveScores]);

  if (!todays.length) {
    const next = matches.find(m => m.kickoffUTC > now);
    return (
      <div className="tt__body" style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="c-y" style={{ fontSize: 28 }}>NO MATCHES TODAY.</div>
          {next && (
            <div className="c-c" style={{ fontSize: 20, marginTop: 12 }}>
              NEXT: {teamCodes.get(next.num)?.home ?? next.teams[0].short} v {teamCodes.get(next.num)?.away ?? next.teams[1].short}
              {' · '}{formatTime(next.kickoffUTC, viewer)}
            </div>
          )}
        </div>
      </div>
    );
  }

  const renderRow = (m: Match) => {
    const finished = isMatchFinished(m.num, m.kickoffUTC, now, liveScores);
    const live     = isMatchLive(m.num, m.kickoffUTC, now, liveScores);
    const r        = resolveScore(m.num, liveScores);
    const minute   = liveScores.get(m.num)?.minute;
    const codes    = teamCodes.get(m.num);
    const stageShort = m.stageId === 'group' ? m.group.replace('Group ', 'GP ') : m.stageShort;
    const cls      = finished ? 'is-result' : live ? 'is-live' : '';
    const score    = r ? `${r.home}–${r.away}` : null;
    // Time column: FT / LIVE+min / kick-off time
    const timeNode = finished ? 'FT' : live ? (minute != null ? `${minute}'` : 'LIVE') : formatTime(m.kickoffUTC, viewer);
    // Centre token: score when we have one, else "v"
    const vsLabel  = score ?? (finished ? '—' : 'v');
    return (
      <div className={`fix__card${cls ? ` ${cls}` : ''}`} key={m.num}>
        <div className="fix__card__time">{timeNode}</div>
        <div className="fix__card__match">
          <span className="fix__card__home c-w">{codes?.home ?? m.teams[0].short}</span>
          <span className={`fix__card__vs${score ? ' sc' : ''}`}>{vsLabel}</span>
          <span className="fix__card__away c-w">{codes?.away ?? m.teams[1].short}</span>
        </div>
        <div className="fix__card__meta">
          {stageShort}{m.city ? ` · ${m.city}` : ''}
        </div>
      </div>
    );
  };

  return (
    <div className="tt__body">
      <div className="fix__cols">
        <div className="fix__day">
          {todays.map(renderRow)}
        </div>
      </div>
    </div>
  );
}
