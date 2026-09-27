import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, RotateCcw } from '../icons/PokeIcons';
import { addTickets, getTickets, ticketsForStars } from '../../utils/carnival/tickets';
import { goldForStars } from '../../utils/gold';
import { sounds } from '../../utils/soundEffects';
import { StarRow, GoldReward } from '../kidgames/Common';

/** A carnival ticket (drawn, so it looks the same everywhere). */
export function Ticket({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 32 20" className={className} aria-hidden="true">
      <path d="M2 2h28v5a3 3 0 0 0 0 6v5H2v-5a3 3 0 0 0 0-6z" fill="#f43f5e" stroke="#9f1239" strokeWidth="1.5" />
      <path d="M9 3v14" stroke="#fecdd3" strokeWidth="1.2" strokeDasharray="1.5 1.5" />
      <circle cx="19.5" cy="10" r="4.2" fill="#ffffff" stroke="#9f1239" strokeWidth="1.2" />
      <path d="M15.3 10a4.2 4.2 0 0 1 8.4 0z" fill="#ef4444" stroke="#9f1239" strokeWidth="1.2" />
    </svg>
  );
}

export function TicketCount({ value, bump }) {
  return (
    <span key={bump} className="score-bump inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 text-rose-600 text-sm font-black shadow" data-testid="ticket-count">
      <Ticket className="w-6 h-4" /> {value}
    </span>
  );
}

/**
 * Full-screen carnival frame: striped tent top with bunting, title, tickets, close button.
 * `hud` sits under the title (score, time...).
 */
export function CarnivalShell({ title, label, onClose, children, hud, background = 'bg-gradient-to-b from-indigo-900 via-purple-900 to-rose-900', dataAttrs = {}, tickets: liveTickets }) {
  // `tickets`: pass the live count when the game changes it (the lucky wheel)
  const [startTickets] = useState(getTickets);
  const tickets = liveTickets ?? startTickets;
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 select-none" role="dialog" aria-label={label} {...dataAttrs}>
      <div className={`relative flex flex-col w-full h-full sm:h-auto sm:max-h-full max-w-md overflow-hidden sm:rounded-3xl sm:border-4 border-amber-200 shadow-2xl ${background}`}>
        {/* Tent stripes and bunting */}
        <div className="relative z-30 h-3 w-full" style={{ background: 'repeating-linear-gradient(90deg,#ef4444 0 22px,#fef3c7 22px 44px)' }} />
        <svg viewBox="0 0 400 18" className="relative z-30 w-full h-4 -mt-px" preserveAspectRatio="none" aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => (
            <path key={i} d={`M${i * 25} 0h25l-12.5 16z`} fill={['#facc15', '#38bdf8', '#f472b6', '#4ade80'][i % 4]} />
          ))}
        </svg>
        <div className="relative z-30 flex items-center gap-2 px-3 py-1.5">
          <span className="text-lg font-black text-amber-200 drop-shadow">{title}</span>
          <span className="ml-auto" />
          <TicketCount value={tickets} bump={tickets} />
          <button onClick={onClose} aria-label="Đóng trò chơi" className="p-1.5 rounded-full bg-white/90 text-slate-700 shadow">
            <X className="w-4 h-4" />
          </button>
        </div>
        {hud && <div className="relative z-20 px-3 pb-1">{hud}</div>}
        <div className="relative flex-1 min-h-0 flex flex-col">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/** A small score / time / tries bar for the HUD. */
export function HudBar({ items }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-black/35 px-3 py-1 text-white text-sm font-black">
      {items.map((it) => (
        <span key={it.label} className={`tabular-nums ${it.warn ? 'text-rose-300 hint-pulse' : ''}`} data-testid={it.testId}>
          {it.icon} {it.label}: {it.value}
        </span>
      ))}
    </div>
  );
}

/**
 * End of a carnival game: stars, the score, tickets and gold (paid once).
 * Tickets and gold are given when this appears.
 */
export function CarnivalResult({ title, stars, detail, onReplay, onClose, onGold }) {
  const paid = useRef(false);
  const [tickets, setTickets] = useState(null);
  const earned = ticketsForStars(stars);
  const gold = goldForStars(stars);
  useEffect(() => {
    if (paid.current) return;
    paid.current = true;
    setTickets(addTickets(earned));
    onGold?.(gold);
    sounds.playSuccessFanfare();
    try {
      confetti({ particleCount: 60 + stars * 40, spread: 90, origin: { y: 0.45 }, zIndex: 9999, colors: ['#ef4444', '#facc15', '#38bdf8', '#f472b6', '#ffffff'] });
    } catch {
      // decoration
    }
  }, [earned, gold, onGold, stars]);
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 px-6 bg-gradient-to-b from-slate-950/92 via-purple-950/92 to-rose-950/95 text-center" data-testid="carnival-result" data-stars={stars}>
      <p className="result-rise text-3xl font-black text-white drop-shadow">{title}</p>
      <div className="result-rise" style={{ animationDelay: '100ms' }}>
        <StarRow stars={stars} size="w-12 h-12" animate />
      </div>
      {detail && (
        <p className="result-rise text-base font-bold text-white/85" style={{ animationDelay: '180ms' }}>
          {detail}
        </p>
      )}
      <div className="result-rise flex items-center gap-3" style={{ animationDelay: '260ms' }}>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/15 text-lg font-black text-rose-200" data-testid="tickets-earned">
          <Ticket className="w-8 h-5" /> +{earned} vé
        </span>
        <GoldReward amount={gold} dark />
      </div>
      {tickets != null && <p className="text-xs font-bold text-white/60">Bé có {tickets} vé – dùng để quay Vòng quay may mắn nhé! 🎡</p>}
      <div className="result-rise flex gap-3 mt-1" style={{ animationDelay: '340ms' }}>
        <button onClick={onReplay} className="px-6 py-3 rounded-2xl bg-red-500 text-white text-lg font-black flex items-center gap-2 shadow-lg active:scale-95">
          <RotateCcw className="w-5 h-5" /> Chơi lại
        </button>
        <button onClick={onClose} className="px-6 py-3 rounded-2xl bg-sky-600 text-white text-lg font-black shadow-lg active:scale-95">
          Xong
        </button>
      </div>
    </div>
  );
}

/** "3, 2, 1, BẮT ĐẦU!" overlay; calls onDone at the end. Tap to skip. */
export function Countdown({ onDone, text = 'BẮT ĐẦU!' }) {
  const [n, setN] = useState(3);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (n <= 0) {
      const t = setTimeout(() => done.current(), 450);
      return () => clearTimeout(t);
    }
    sounds.playScanBeep?.();
    const t = setTimeout(() => setN((v) => v - 1), 650);
    return () => clearTimeout(t);
  }, [n]);
  return (
    <button type="button" onClick={() => done.current()} className="absolute inset-0 z-30 flex items-center justify-center bg-black/30" aria-label="Bắt đầu" data-testid="carnival-countdown">
      <span key={n} className="count-pop text-8xl font-black text-white sport-banner">{n > 0 ? n : text}</span>
    </button>
  );
}
