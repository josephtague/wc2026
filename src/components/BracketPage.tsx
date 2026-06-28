// BracketPage.tsx — P170 Knockout bracket. Desktop = rounds as left→right columns
// (horizontal scroll, like Fixtures); mobile = one round per screen with ◄/► paging.
import { useMemo, useState } from 'react';
import type { Match, LiveScore } from '../lib/types';
import { buildBracket, BRACKET_ORDER, BRACKET_LABEL, type BracketTie, type BracketStageId } from '../lib/bracketData';

interface BracketPageProps {
  matches: Match[];
  now: number;
  liveScores: Map<number, LiveScore>;
  isMobile: boolean;
}

function Tie({ tie }: { tie: BracketTie }) {
  const row = (team: string, score: number | null, side: 'home' | 'away') => (
    <div className={`brk-slot${tie.winner === side ? ' brk-slot--win' : ''}`}>
      <span className="brk-slot__team">{team}</span>
      <span className="brk-slot__score">{score ?? ''}</span>
    </div>
  );
  return (
    <div className="brk-tie">
      {row(tie.home, tie.homeScore, 'home')}
      {row(tie.away, tie.awayScore, 'away')}
    </div>
  );
}

function Column({ sid, ties }: { sid: BracketStageId; ties: BracketTie[] }) {
  return (
    <div className={`brk-col brk-col--${sid}`}>
      <div className="brk-col__lbl c-c">{BRACKET_LABEL[sid]}</div>
      <div className="brk-col__ties">{ties.map(t => <Tie key={t.num} tie={t} />)}</div>
    </div>
  );
}

export function BracketPage({ matches, now, liveScores, isMobile }: BracketPageProps) {
  const bracket = useMemo(() => buildBracket(matches, now, liveScores), [matches, now, liveScores]);
  const rounds = BRACKET_ORDER.filter(sid => bracket[sid].length > 0);
  const [roundIdx, setRoundIdx] = useState(0);

  if (!rounds.length) {
    return <div className="tt__body" style={{ display: 'grid', placeItems: 'center' }}>
      <div className="c-y" style={{ fontSize: 28 }}>KNOCKOUT BRACKET AVAILABLE ONCE THE GROUP STAGE ENDS.</div>
    </div>;
  }

  if (isMobile) {
    const idx = Math.min(roundIdx, rounds.length - 1);
    const sid = rounds[idx]!;
    const prev = () => setRoundIdx((idx - 1 + rounds.length) % rounds.length);
    const next = () => setRoundIdx((idx + 1) % rounds.length);
    return (
      <div className="tt__body brk">
        <div className="brk-mnav">
          <button className="tt__sub__navbtn" onClick={prev}>◄</button>
          <span className="c-y">{BRACKET_LABEL[sid]}</span>
          <button className="tt__sub__navbtn" onClick={next}>►</button>
        </div>
        <div className="brk-col__ties brk-col__ties--mobile">{bracket[sid].map(t => <Tie key={t.num} tie={t} />)}</div>
      </div>
    );
  }

  return (
    <div className="tt__body brk">
      <div className="brk-cols">
        {rounds.map(sid => <Column key={sid} sid={sid} ties={bracket[sid]} />)}
      </div>
    </div>
  );
}
