import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { SEGMENTS, SEG_ANGLE, createWheel, startSpin, stepWheel, spinSpeed } from '../../utils/carnival/wheel';
import { getTickets, addTickets, spendTicket } from '../../utils/carnival/tickets';
import { sounds } from '../../utils/soundEffects';
import { Ball } from '../icons/PokeIcons';
import { BerryIcon } from '../BerryIcon';
import { GoldReward } from '../kidgames/Common';
import { useLoop, useLater } from '../sports/sportsKit';
import { CarnivalShell, Ticket } from './CarnivalCommon';

const R = 140; // wheel radius (SVG units, the view is 340 wide)
const BULBS = SEGMENTS.length * 2;
const rad = (deg) => (deg * Math.PI) / 180;
const at = (deg, r) => [r * Math.sin(rad(deg)), -r * Math.cos(rad(deg))];
const mod = (a, n) => ((a % n) + n) % n;

function slicePath(i) {
  const [x0, y0] = at(i * SEG_ANGLE, R);
  const [x1, y1] = at((i + 1) * SEG_ANGLE, R);
  return `M0 0L${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}z`;
}

/** The picture on a segment, drawn upright at (0, 0), about 44 units tall. */
function SegIcon({ seg }) {
  if (seg.kind === 'gold' || seg.kind === 'jackpot') {
    const big = seg.kind === 'jackpot';
    return (
      <g>
        {big && <path d="M-16 -30l6 8 10-12 10 12 6-8-3 14h-26z" fill="#fde047" stroke="#a16207" strokeWidth="1.5" />}
        <circle r={big ? 15 : 13} fill="#fde047" stroke="#a16207" strokeWidth="2.5" />
        <circle r={big ? 10.5 : 9} fill="none" stroke="#ca8a04" strokeWidth="1.5" />
        <text y="4.5" textAnchor="middle" fontSize={seg.amount >= 100 ? 11 : seg.amount >= 10 ? 12 : 13} fontWeight="900" fill="#854d0e">
          {seg.amount}
        </text>
      </g>
    );
  }
  if (seg.kind === 'berry') {
    const oran = seg.berry === 'oran';
    return (
      <g>
        <circle r="13" fill={oran ? '#2563eb' : '#e11d48'} stroke={oran ? '#1e3a8a' : '#881337'} strokeWidth="2" />
        {!oran && [-6, 0, 6].map((x) => <circle key={x} cx={x} cy={x === 0 ? 5 : 1} r="1.4" fill="#fecdd3" />)}
        <circle cx="-4.5" cy="-4.5" r="3.5" fill="#fff" opacity="0.55" />
        <path d="M1 -12c4-8 11-8 14-6-3 5-9 7-14 6z" fill="#22c55e" stroke="#15803d" strokeWidth="1.2" />
      </g>
    );
  }
  if (seg.kind === 'ticket') {
    return (
      <g transform="translate(-17 -11) scale(1.07)">
        <path d="M2 2h28v5a3 3 0 0 0 0 6v5H2v-5a3 3 0 0 0 0-6z" fill="#fff1f2" stroke="#9f1239" strokeWidth="1.8" />
        <circle cx="19.5" cy="10" r="4.2" fill="#ffffff" stroke="#9f1239" strokeWidth="1.2" />
        <path d="M15.3 10a4.2 4.2 0 0 1 8.4 0z" fill="#ef4444" stroke="#9f1239" strokeWidth="1.2" />
        <text x="8" y="13" textAnchor="middle" fontSize="9" fontWeight="900" fill="#9f1239">
          +1
        </text>
      </g>
    );
  }
  // "Better luck next time": a sleepy Pokeball
  return (
    <g>
      <Ball x={0} y={0} r={13} />
      <path d="M-5 5q2 2 4 0M1 5q2 2 4 0" stroke="#1f2937" strokeWidth="1.3" fill="none" />
      <text x="12" y="-10" fontSize="9" fontWeight="900" fill="#e2e8f0">
        z
      </text>
    </g>
  );
}

const SHORT = { gold: (s) => `${s.amount} vàng`, berry: (s) => (s.berry === 'oran' ? 'Oran' : 'Razz'), ticket: () => '+1 vé', jackpot: () => 'JACKPOT', miss: () => 'Lần sau' };

function WheelFace({ rotation, fast, winner }) {
  return (
    <g transform={`rotate(${rotation.toFixed(2)})`}>
      <circle r={R + 3} fill="#7f1d1d" />
      {SEGMENTS.map((seg, i) => (
        <path
          key={seg.id}
          d={slicePath(i)}
          fill={seg.kind === 'jackpot' ? 'url(#wh-jackpot)' : seg.color}
          stroke="#fff7ed"
          strokeWidth="2.5"
          className={winner === i ? 'wheel-win-slice' : undefined}
        />
      ))}
      <circle r={R} fill="url(#wh-shine)" pointerEvents="none" />
      {SEGMENTS.map((seg, i) => {
        const mid = (i + 0.5) * SEG_ANGLE;
        return (
          <g key={seg.id} transform={`rotate(${mid}) translate(0 -${R * 0.64})`} opacity={fast ? 0.75 : 1}>
            <SegIcon seg={seg} />
            <text y="-27" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff" stroke="rgba(0,0,0,0.35)" strokeWidth="2.5" paintOrder="stroke">
              {SHORT[seg.kind](seg)}
            </text>
          </g>
        );
      })}
      {/* Pegs on the segment lines */}
      {SEGMENTS.map((seg, i) => {
        const [x, y] = at(i * SEG_ANGLE, R - 7);
        return <circle key={seg.id} cx={x} cy={y} r="4.5" fill="#fef3c7" stroke="#92400e" strokeWidth="1.5" />;
      })}
    </g>
  );
}

function Rim({ spinning, flash }) {
  return (
    <g>
      <circle r={R + 12} fill="none" stroke="url(#wh-rim)" strokeWidth="20" />
      {Array.from({ length: BULBS }, (_, i) => {
        const [x, y] = at((i * 360) / BULBS, R + 12);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="4.8"
            className={flash ? 'wheel-bulb-flash' : 'wheel-bulb'}
            style={{ animationDuration: spinning ? '0.3s' : flash ? '0.25s' : '1.2s', animationDelay: `${-((i % 4) * (spinning ? 0.075 : 0.3))}s` }}
          />
        );
      })}
    </g>
  );
}

/** Pointer at the top with a flapper that a passing peg knocks aside. */
function Pointer({ rotation, spinning }) {
  const phase = mod(rotation, SEG_ANGLE);
  // The next peg pushes the flapper while it comes (last 7 degrees), then it springs back
  const push = !spinning ? 0 : phase > SEG_ANGLE - 7 ? (phase - (SEG_ANGLE - 7)) / 7 : phase < 3 ? 1 - phase / 3 : 0;
  return (
    <g transform={`translate(0 ${-R - 16})`}>
      <g transform={`rotate(${(-push * 28).toFixed(1)})`}>
        <path d="M-13 -6c0-10 26-10 26 0L0 30z" fill="url(#wh-pointer)" stroke="#7f1d1d" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cy="-3" r="4" fill="#fef9c3" stroke="#7f1d1d" strokeWidth="1.5" />
      </g>
    </g>
  );
}

function PrizeCard({ seg, tickets, onAgain, onClose }) {
  const jackpot = seg.kind === 'jackpot';
  const title = {
    gold: `Bé được ${seg.amount} vàng!`,
    berry: `Bé được 1 quả ${seg.berry === 'oran' ? 'Oran' : 'Razz'}!`,
    ticket: 'Thêm 1 vé nữa!',
    jackpot: 'JACKPOT!!!',
    miss: 'Chúc may mắn lần sau!',
  }[seg.kind];
  const sub = {
    gold: 'Dùng vàng để mua quà ở cửa hàng nhé 🛍️',
    berry: 'Cho Pokémon của bé ăn cho vui nhé 🍓',
    ticket: 'Quay thêm một lần miễn phí! 🎟️',
    jackpot: '100 vàng! Bé là nhà vô địch may mắn! 🏆',
    miss: 'Không sao đâu, lần sau sẽ may mắn hơn 😊',
  }[seg.kind];
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 px-5" data-testid="wheel-prize" data-kind={seg.kind}>
      {jackpot && <div className="wheel-rays absolute left-1/2 top-1/2 w-[640px] h-[640px] -ml-[320px] -mt-[320px] pointer-events-none" aria-hidden="true" />}
      <div
        className={`relative w-full max-w-[320px] rounded-3xl border-4 px-5 py-6 text-center shadow-2xl pop-in ${jackpot ? 'bg-gradient-to-b from-yellow-200 via-amber-300 to-orange-400 border-yellow-100' : 'bg-gradient-to-b from-white to-amber-50 border-amber-300'}`}
      >
        <div className={`mx-auto w-28 h-28 flex items-center justify-center ${seg.kind === 'miss' ? 'wheel-wobble' : 'wheel-prize-bounce'}`}>
          {seg.kind === 'berry' ? (
            <BerryIcon type={seg.berry} className="w-20 h-20" />
          ) : seg.kind === 'ticket' ? (
            <Ticket className="w-28 h-20" />
          ) : (
            <svg viewBox="-30 -36 60 66" className="w-28 h-28" aria-hidden="true">
              <SegIcon seg={seg} />
            </svg>
          )}
        </div>
        <p className={`mt-2 font-black ${jackpot ? 'text-4xl text-red-600 banner-slam' : 'text-2xl text-slate-800'}`}>{title}</p>
        <p className="mt-1 text-sm font-bold text-slate-600">{sub}</p>
        {(seg.kind === 'gold' || jackpot) && (
          <div className="mt-3 flex justify-center">
            <GoldReward amount={seg.amount} />
          </div>
        )}
        {tickets <= 0 && <p className="mt-3 text-sm font-black text-rose-600">Hết vé rồi! Chơi các trò khác trong Hội chợ để nhận thêm vé nhé 🎪</p>}
        <div className="mt-4 flex gap-3 justify-center">
          <button
            onClick={onAgain}
            disabled={tickets <= 0}
            className="px-5 py-3 rounded-2xl bg-gradient-to-b from-rose-500 to-red-600 text-white text-lg font-black shadow-lg active:scale-95 disabled:opacity-40 flex items-center gap-2"
          >
            🎡 Quay tiếp
          </button>
          <button onClick={onClose} className="px-5 py-3 rounded-2xl bg-sky-600 text-white text-lg font-black shadow-lg active:scale-95">
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}

const snap = (s) => ({ rotation: s.rotation, spinning: !!s.spin, speed: spinSpeed(s), spins: s.spins });

/**
 * "Vòng quay may mắn": spend a carnival ticket to spin the prize wheel (swipe it or tap QUAY!).
 * Gold, berries, an extra ticket or the 100 gold jackpot. No tickets: go play the other games.
 */
export function WheelGame({ player, onClose, onGold, onBerries, random = Math.random }) {
  const [first] = useState(() => createWheel({ random }));
  const wheel = useRef(first);
  const [ui, setUi] = useState(() => snap(first));
  const [tickets, setTickets] = useState(getTickets);
  const [prize, setPrize] = useState(null); // { index, seg }
  const [nudge, setNudge] = useState(0); // "no tickets" shake
  const [flash, setFlash] = useState(false);
  const later = useLater();
  const swipe = useRef(null);
  const tickAt = useRef(0);

  const pay = (seg) => {
    if (seg.kind === 'gold' || seg.kind === 'jackpot') onGold?.(seg.amount);
    else if (seg.kind === 'berry') onBerries?.({ [seg.berry]: 1 });
    else if (seg.kind === 'ticket') setTickets(addTickets(seg.amount));
  };

  useLoop((dt) => {
    const s = wheel.current;
    stepWheel(s, dt);
    tickAt.current += dt;
    for (const e of s.events.splice(0)) {
      if (e.type === 'tick' && tickAt.current > 0.035) {
        tickAt.current = 0;
        sounds.playNote(1400 + e.speed * 600, { duration: 0.04, volume: 0.08 + (1 - e.speed) * 0.06 });
      } else if (e.type === 'stop') {
        const seg = e.segment;
        pay(seg);
        setPrize({ index: e.index, seg });
        setFlash(true);
        later(() => setFlash(false), 1600);
        if (seg.kind === 'miss') sounds.playOops();
        else {
          if (seg.kind === 'gold' || seg.kind === 'jackpot') sounds.playCoin();
          sounds.playSuccessFanfare();
          const shots = seg.kind === 'jackpot' ? 5 : 1;
          for (let k = 0; k < shots; k++) {
            later(() => {
              try {
                confetti({
                  particleCount: seg.kind === 'jackpot' ? 140 : 70,
                  spread: 110,
                  startVelocity: 45,
                  origin: { x: shots > 1 ? 0.15 + (k % 3) * 0.35 : 0.5, y: 0.35 },
                  zIndex: 9999,
                  colors: ['#facc15', '#fde047', '#ef4444', '#ffffff', '#38bdf8', '#f472b6'],
                });
              } catch {
                // decoration
              }
            }, k * 280);
          }
        }
      }
    }
    setUi(snap(s));
  }, ui.spinning);

  const spin = (power = 1) => {
    if (!prize) spinNow(power);
  };

  const spinNow = (power) => {
    const s = wheel.current;
    if (s.spin) return;
    const left = spendTicket();
    if (left < 0) {
      setTickets(0);
      setNudge((n) => n + 1);
      sounds.playOops();
      return;
    }
    setTickets(left);
    startSpin(s, { power });
    sounds.playWhoosh();
    setUi(snap(s));
  };

  const again = () => {
    setPrize(null);
    spinNow(1);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!prize) spin(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Swipe (or flick) the wheel to spin it; a faster flick spins it harder
  const onDown = (e) => {
    swipe.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onUp = (e) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || e.clientX == null) return;
    const d = Math.hypot(e.clientX - s.x, e.clientY - s.y);
    if (d < 40) return;
    const v = d / Math.max(60, performance.now() - s.t); // px per ms
    spin(0.5 + Math.min(1, v / 1.5));
  };

  const empty = tickets <= 0 && !ui.spinning && !prize;
  const winner = prize && !ui.spinning ? prize.index : -1;

  return (
    <CarnivalShell
      tickets={tickets}
      title="🎡 Vòng quay may mắn"
      label="Vòng quay may mắn"
      onClose={onClose}
      background="bg-gradient-to-b from-fuchsia-900 via-purple-900 to-indigo-950"
      dataAttrs={{ 'data-spinning': ui.spinning ? 'true' : 'false', 'data-tickets': tickets, 'data-spins': ui.spins, 'data-prize': prize ? prize.seg.id : '' }}
      hud={
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-black/35 px-3 py-1 text-white text-sm font-black">
          <Ticket className="w-7 h-5" />
          <span data-testid="wheel-tickets">Bé có {tickets} vé</span>
          <span className="text-white/60">· mỗi lần quay 1 vé</span>
        </div>
      }
    >
      <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center gap-3 px-3 pb-4 overflow-hidden">
        {/* Spotlights */}
        <div className="wheel-spot absolute -top-20 left-1/2 w-[520px] h-[520px] -ml-[260px] pointer-events-none" aria-hidden="true" />
        <div className="relative w-full max-w-[340px] aspect-square">
          <svg
            viewBox="-170 -175 340 345"
            className="relative w-full h-full touch-none drop-shadow-[0_12px_20px_rgba(0,0,0,0.5)]"
            onPointerDown={onDown}
            onPointerUp={onUp}
            onPointerCancel={() => (swipe.current = null)}
            data-testid="wheel-disc"
            role="img"
            aria-label="Vòng quay"
          >
            <defs>
              <radialGradient id="wh-shine" cx="0" cy="0" r={R} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
                <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.92" stopColor="#000" stopOpacity="0.08" />
                <stop offset="1" stopColor="#000" stopOpacity="0.25" />
              </radialGradient>
              <linearGradient id="wh-rim" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#fde68a" />
                <stop offset="0.5" stopColor="#d97706" />
                <stop offset="1" stopColor="#92400e" />
              </linearGradient>
              <linearGradient id="wh-jackpot" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#ef4444" />
                <stop offset="0.5" stopColor="#f59e0b" />
                <stop offset="1" stopColor="#dc2626" />
              </linearGradient>
              <linearGradient id="wh-pointer" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#fca5a5" />
                <stop offset="1" stopColor="#dc2626" />
              </linearGradient>
            </defs>
            <circle r={R + 26} fill="#1e1b4b" opacity="0.6" />
            <Rim spinning={ui.spinning} flash={flash && winner >= 0} />
            <WheelFace rotation={ui.rotation} fast={ui.speed > 500} winner={winner} />
            {/* Hub */}
            <circle r="30" fill="#fef3c7" stroke="#92400e" strokeWidth="3" />
            <Ball x={0} y={0} r={22} />
            <Pointer rotation={ui.rotation} spinning={ui.spinning} />
          </svg>
          <img src={player.image} alt={player.name} className={`absolute -right-1 bottom-0 w-20 h-20 object-contain drop-shadow-xl pointer-events-none ${ui.spinning ? 'dance-bob' : 'sport-bob'}`} />
        </div>
        {empty ? (
          <p
            key={nudge}
            className={`w-full max-w-[320px] px-4 py-3 rounded-2xl bg-white/95 text-center text-sm font-black text-purple-800 shadow-lg ${nudge ? 'wrong-shake' : 'pop-in'}`}
            data-testid="wheel-empty"
          >
            Bé chưa có vé 🎟️ Hãy chơi các trò khác trong Hội chợ để nhận vé rồi quay lại nhé! 🎪
          </p>
        ) : (
          <p className="text-sm font-bold text-white/80">{ui.spinning ? 'Đang quay... hồi hộp quá! 🤩' : 'Vuốt mạnh vòng quay hoặc bấm QUAY!'}</p>
        )}
        <button
          onClick={() => spin(1)}
          disabled={tickets <= 0 || ui.spinning || !!prize}
          className={`w-[78%] max-w-[300px] py-4 rounded-3xl text-2xl font-black text-white shadow-xl border-b-8 transition-transform active:scale-95 active:border-b-2 flex items-center justify-center gap-2 ${tickets > 0 && !ui.spinning && !prize ? 'bg-gradient-to-b from-amber-400 to-orange-600 border-orange-800 hint-pulse' : 'bg-slate-500 border-slate-700 opacity-60'}`}
          data-testid="wheel-spin"
        >
          🎡 QUAY!{' '}
          <span className="flex items-center gap-1 text-base bg-black/20 rounded-full px-2 py-0.5">
            −1 <Ticket className="w-6 h-4" />
          </span>
        </button>
        {prize && !ui.spinning && <PrizeCard seg={prize.seg} tickets={tickets} onAgain={again} onClose={onClose} />}
      </div>
    </CarnivalShell>
  );
}
