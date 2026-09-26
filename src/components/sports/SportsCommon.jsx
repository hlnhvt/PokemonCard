import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, RotateCcw } from 'lucide-react';
import { BerryIcon } from '../BerryIcon';
import { MATCH_REWARDS, RESULT_TEXT } from '../../utils/sports/common';
import { sounds } from '../../utils/soundEffects';
import { goldForMatch } from '../../utils/gold';
import { GoldReward } from '../kidgames/Common';

function Avatar({ side, image, name, score, active }) {
  return (
    <div className={`flex items-center gap-2 min-w-0 ${side === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <div className={`relative shrink-0 w-12 h-12 rounded-full bg-white/90 border-4 transition-all duration-300 ${active ? 'border-amber-300 scale-110 shadow-[0_0_14px_rgba(252,211,77,0.9)]' : 'border-white/50 opacity-80'}`}>
        <img src={image} alt="" draggable={false} className={`w-full h-full object-contain ${side === 'left' ? 'scale-x-[-1]' : ''}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-wide text-white/85 truncate max-w-[84px]">{name}</p>
        {score != null && (
          <p key={score} className="score-bump text-3xl leading-none font-black text-white drop-shadow" data-testid={`score-${side}`}>
            {score}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Full-screen frame for the sports matches: close button, title, and a scoreboard with the
 * child's Pokemon on the left and the opponent on the right.
 */
export function SportsShell({ title, label, player, opponent, scores, active, onClose, children, footer, background, dataAttrs = {} }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 select-none" role="dialog" aria-label={label} {...dataAttrs}>
      <div className={`relative flex flex-col w-full h-full sm:h-auto sm:max-h-full max-w-md overflow-hidden sm:rounded-3xl sm:border-4 border-white/70 shadow-2xl ${background}`}>
        <div className="relative z-30 flex items-center justify-between gap-2 px-3 pt-2.5 pb-2 bg-black/35 backdrop-blur">
          {opponent ? (
            <>
              <Avatar side="left" image={player.image} name={player.name} score={scores?.[0]} active={active === 'player'} />
              <div className="flex flex-col items-center shrink-0">
                <span className="text-[11px] font-black text-amber-200 whitespace-nowrap">{title}</span>
                <span className="text-lg font-black italic text-white/90">VS</span>
              </div>
              <Avatar side="right" image={opponent.image} name={opponent.name} score={scores?.[1]} active={active === 'opponent'} />
            </>
          ) : (
            <span className="text-lg font-black text-white">{title}</span>
          )}
          <button onClick={onClose} aria-label="Đóng trò chơi" className="absolute right-1.5 top-1.5 p-1.5 rounded-full bg-white/90 text-slate-700 hover:bg-white shadow">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="relative flex-1 min-h-0 flex flex-col">{children}</div>
        {footer}
      </div>
    </div>,
    document.body
  );
}

/** Big slamming words (STRIKE!, VÀO!!!). Re-keyed by `banner.id` so each one animates. */
export function Banner({ banner }) {
  if (!banner) return null;
  const tones = {
    gold: 'from-amber-200 via-yellow-300 to-orange-400',
    green: 'from-lime-200 via-emerald-300 to-teal-400',
    blue: 'from-sky-200 via-cyan-300 to-blue-400',
    red: 'from-rose-200 via-red-300 to-pink-400',
  };
  const [, words, emoji] = banner.text.match(/^(.*?)([\s\p{Extended_Pictographic}\u{FE0F}\u{200D}]*)$/u);
  return (
    <div
      key={banner.id}
      className={`banner-slam sport-banner absolute left-1/2 top-[38%] z-20 pointer-events-none whitespace-nowrap text-5xl sm:text-6xl font-black italic bg-gradient-to-b ${tones[banner.tone] || tones.gold} bg-clip-text text-transparent`}
      data-testid="sport-banner"
    >
      {words}
      {/* Emoji keep their own colours instead of the gradient fill */}
      {emoji && <span style={{ color: '#fff', WebkitTextFillColor: '#fff', WebkitTextStroke: 0 }}>{emoji}</span>}
    </div>
  );
}

/** "Pikachu VS Eevee" splash before a match. Tap to skip. */
export function VsIntro({ player, opponent, subtitle, onDone }) {
  const done = useRef(onDone);
  useLayoutEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const t = setTimeout(() => done.current(), 2200);
    return () => clearTimeout(t);
  }, []);
  return (
    <button type="button" onClick={() => done.current()} className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-indigo-950/90 via-purple-900/85 to-rose-900/90 overflow-hidden" aria-label="Bắt đầu">
      <div className="vs-rays absolute inset-0 opacity-40" />
      <div className="relative flex items-center justify-center w-full gap-2 px-2">
        <div className="vs-left flex flex-col items-center w-[42%]">
          <img src={player.image} alt={player.name} draggable={false} className="w-32 h-32 object-contain scale-x-[-1] drop-shadow-[0_0_18px_rgba(96,165,250,0.9)]" />
          <span className="mt-1 text-lg font-black text-white truncate max-w-full">{player.name}</span>
        </div>
        <span className="vs-pop text-6xl font-black italic text-amber-300 drop-shadow-[0_4px_0_rgba(0,0,0,0.5)]">VS</span>
        <div className="vs-right flex flex-col items-center w-[42%]">
          <img src={opponent.image} alt={opponent.name} draggable={false} className="w-32 h-32 object-contain drop-shadow-[0_0_18px_rgba(248,113,113,0.9)]" />
          <span className="mt-1 text-lg font-black text-white truncate max-w-full">{opponent.name}</span>
        </div>
      </div>
      {subtitle && <p className="vs-sub relative mt-3 px-6 text-center text-base font-bold text-white/90">{subtitle}</p>}
    </button>
  );
}

/**
 * End of a match: who won, the score and the berries (every child gets some).
 * `headline` / `detail` override the default texts (racing shows the place instead).
 */
export function MatchResult({ result, player, opponent, scores, headline, detail, onReplay, onClose, onBerries, onGold }) {
  const reward = MATCH_REWARDS[result];
  const given = useRef(false);
  useEffect(() => {
    if (given.current) return;
    given.current = true;
    onBerries?.(reward);
    onGold?.(goldForMatch(result));
    if (result === 'win') {
      sounds.playSuccessFanfare();
      try {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.55 }, zIndex: 9999 });
      } catch {
        // confetti is decoration only
      }
    } else {
      sounds.playPop();
    }
  }, [result, reward, onBerries, onGold]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 px-6 bg-gradient-to-b from-slate-950/92 via-indigo-950/92 to-slate-950/95 text-center" data-testid="match-result" data-result={result}>
      <p className="result-rise text-4xl font-black text-white drop-shadow">{headline || RESULT_TEXT[result]}</p>
      <div className="result-rise flex items-end justify-center gap-6" style={{ animationDelay: '120ms' }}>
        <div className="flex flex-col items-center">
          <img src={player.image} alt={player.name} className={`w-24 h-24 object-contain scale-x-[-1] ${result === 'win' ? 'battle-victory' : result === 'lose' ? 'opacity-70' : ''}`} />
          {scores && <span className="text-4xl font-black text-white">{scores[0]}</span>}
        </div>
        {scores && <span className="pb-2 text-2xl font-black text-white/60">–</span>}
        {opponent && (
          <div className="flex flex-col items-center">
            <img src={opponent.image} alt={opponent.name} className={`w-24 h-24 object-contain ${result === 'lose' ? 'battle-victory' : result === 'win' ? 'opacity-70' : ''}`} />
            {scores && <span className="text-4xl font-black text-white">{scores[1]}</span>}
          </div>
        )}
      </div>
      {detail && <p className="result-rise text-base font-bold text-white/85" style={{ animationDelay: '220ms' }}>{detail}</p>}
      <p className="result-rise flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/15 text-lg font-black text-emerald-200" style={{ animationDelay: '320ms' }}>
        Phần thưởng:
        {Object.entries(reward).map(([type, n]) => (
          <span key={type} className="flex items-center gap-1">
            <BerryIcon type={type} className="w-6 h-6" /> ×{n}
          </span>
        ))}
      </p>
      <div className="result-rise" style={{ animationDelay: '370ms' }}>
        <GoldReward amount={goldForMatch(result)} dark />
      </div>
      <div className="result-rise flex gap-3 mt-2" style={{ animationDelay: '420ms' }}>
        <button onClick={onReplay} className="px-6 py-3 rounded-2xl bg-red-500 hover:bg-red-400 text-white text-lg font-black flex items-center gap-2 shadow-lg active:scale-95">
          <RotateCcw className="w-5 h-5" /> Chơi lại
        </button>
        <button onClick={onClose} className="px-6 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-lg font-black shadow-lg active:scale-95">
          Xong
        </button>
      </div>
    </div>
  );
}
