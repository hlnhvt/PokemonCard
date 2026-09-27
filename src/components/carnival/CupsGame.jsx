import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { createCups, stepCups, pickCup, cupLayout, ballSlot, cupsStars, ROUNDS } from '../../utils/carnival/cups';
import { sounds } from '../../utils/soundEffects';
import { useLoop, useLater } from '../sports/sportsKit';
import { CarnivalShell, CarnivalResult, Countdown, HudBar } from './CarnivalCommon';

const CUP_COLORS = [
  { name: 'đỏ', light: '#fca5a5', mid: '#ef4444', dark: '#991b1b', band: '#fde047' },
  { name: 'xanh', light: '#93c5fd', mid: '#3b82f6', dark: '#1e3a8a', band: '#ffffff' },
  { name: 'vàng', light: '#fef08a', mid: '#facc15', dark: '#a16207', band: '#ef4444' },
  { name: 'lá', light: '#86efac', mid: '#22c55e', dark: '#14532d', band: '#fde047' },
];

function Cup({ color, id }) {
  const g = `cups-grad-${id}`;
  return (
    <svg viewBox="0 0 80 92" className="w-full h-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={color.dark} />
          <stop offset="0.3" stopColor={color.mid} />
          <stop offset="0.55" stopColor={color.light} />
          <stop offset="1" stopColor={color.dark} />
        </linearGradient>
      </defs>
      {/* Body: an upside-down cup, wide at the mouth */}
      <path d="M18 6h44a6 6 0 0 1 6 5l9 70a4 4 0 0 1-4 5H7a4 4 0 0 1-4-5l9-70a6 6 0 0 1 6-5z" fill={`url(#${g})`} stroke={color.dark} strokeWidth="2.5" />
      <ellipse cx="40" cy="7" rx="22" ry="4" fill={color.light} stroke={color.dark} strokeWidth="2" />
      {/* Stripe with a Pokeball badge */}
      <path d="M8.5 56h63l1.3 10H7.2z" fill={color.band} opacity="0.95" />
      <g transform="translate(40 36)">
        <circle r="11" fill="#fff" stroke="#1e293b" strokeWidth="2" />
        <path d="M-11 0a11 11 0 0 1 22 0z" fill={color.mid} stroke="#1e293b" strokeWidth="2" />
        <circle r="3.6" fill="#fff" stroke="#1e293b" strokeWidth="2" />
      </g>
      {/* Shine */}
      <path d="M22 12l-6 58" stroke="#fff" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" />
      <path d="M28 12l-2 18" stroke="#fff" strokeOpacity="0.35" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function PokeBall({ shine }) {
  return (
    <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
      <circle cx="20" cy="20" r="17" fill="#f8fafc" stroke="#1e293b" strokeWidth="2.5" />
      <path d="M3 20a17 17 0 0 1 34 0z" fill="#ef4444" stroke="#1e293b" strokeWidth="2.5" />
      <path d="M3 20h34" stroke="#1e293b" strokeWidth="3" />
      <circle cx="20" cy="20" r="5.5" fill="#f8fafc" stroke="#1e293b" strokeWidth="2.5" />
      <ellipse cx="13" cy="11" rx="4" ry="2.2" fill="#fff" opacity="0.7" transform="rotate(-30 13 11)" />
      {shine && <path className="cups-ball-shine" d="M20 -6v8M20 38v8M-6 20h8M38 20h8M2 2l5 5M38 2l-5 5" stroke="#fde047" strokeWidth="3" strokeLinecap="round" />}
    </svg>
  );
}

const snap = (s) => ({
  phase: s.phase,
  round: s.round,
  n: s.n,
  cups: cupLayout(s),
  ballSlot: ballSlot(s),
  ball: s.ball,
  picked: s.picked,
  last: s.last,
  score: s.score,
  streak: s.streak,
  correct: s.correct,
  best: s.best,
  stars: cupsStars(s),
  status: s.status,
  t: s.t,
});

const spacing = (n) => (n >= 4 ? 23.5 : 30);
const slotLeft = (x, n) => 50 + (x - (n - 1) / 2) * spacing(n);

const HINTS = {
  show: 'Nhìn kỹ quả bóng nhé! 👀',
  cover: 'Úp cốc lại nào…',
  wait: 'Chuẩn bị tráo!',
  shuffle: 'Dõi theo cốc có bóng! 🌀',
  pick: 'Bóng ở cốc nào? Chạm vào cốc nhé!',
};

/**
 * "Đoán cốc": a Pokeball goes under a cup, the cups swap along arcs, the child taps the cup
 * with the ball. 6 rounds, more and faster swaps, a 4th cup from round 4.
 */
export function CupsGame({ player, onClose, onGold, random = Math.random }) {
  const [phase, setPhase] = useState('ready'); // ready | play | done
  const [first] = useState(() => createCups({ random }));
  const game = useRef(first);
  const [ui, setUi] = useState(() => snap(first));
  const [banner, setBanner] = useState(null);
  const [pops, setPops] = useState([]);
  const [cheer, setCheer] = useState(null); // 'happy' | 'sad'
  const [fresh, setFresh] = useState(null); // a cup that just joined
  const later = useLater();
  const idRef = useRef(0);

  const say = (text, tone, ms = 1500) => {
    const id = ++idRef.current;
    setBanner({ text, tone, id });
    later(() => setBanner((b) => (b?.id === id ? null : b)), ms);
  };

  useLoop((dt) => {
    const s = game.current;
    stepCups(s, dt);
    for (const e of s.events.splice(0)) {
      if (e.type === 'round') {
        setCheer(null);
        if (e.added) {
          setFresh(e.cups - 1);
          later(() => setFresh(null), 900);
          say(`Vòng ${e.round + 1}: thêm 1 cốc nữa! 🥤`, 'blue', 1600);
          sounds.playPop();
        } else if (e.round > 0) say(`Vòng ${e.round + 1} – nhanh hơn nè!`, 'blue', 1300);
      } else if (e.type === 'cover') sounds.playNote(392, { duration: 0.2, volume: 0.18 });
      else if (e.type === 'covered') sounds.playPop();
      else if (e.type === 'swap') sounds.playWhoosh();
      else if (e.type === 'pick-now') sounds.playNote(784, { duration: 0.18, volume: 0.16 });
      else if (e.type === 'end') later(() => setPhase('done'), 400);
    }
    setUi(snap(s));
  }, phase === 'play');

  const tap = (id) => {
    if (phase !== 'play') return;
    const s = game.current;
    const out = pickCup(s, id);
    if (out.result === 'wait') return;
    setUi(snap(s));
    const pid = ++idRef.current;
    if (out.result === 'right') {
      sounds.playCoin();
      [523, 659, 784, 1047].forEach((f, i) => sounds.playNote(f, { duration: 0.25, delay: 0.08 + i * 0.09, volume: 0.2 }));
      setCheer('happy');
      setPops((list) => [...list, { id: pid, cup: id, text: `+${out.points}` }]);
      later(() => setPops((list) => list.filter((p) => p.id !== pid)), 1100);
      say(out.streak >= 2 ? `Đúng rồi! Chuỗi ${out.streak} 🔥` : 'Đúng rồi! Giỏi quá! 🎉', 'gold');
      try {
        const left = slotLeft(s.order.indexOf(id), s.n) / 100;
        confetti({ particleCount: 50 + out.streak * 15, spread: 70, startVelocity: 35, origin: { x: 0.5 + (left - 0.5) * 0.6, y: 0.6 }, zIndex: 9999, colors: ['#ef4444', '#facc15', '#38bdf8', '#f472b6', '#ffffff'] });
      } catch {
        // decoration
      }
    } else {
      sounds.playOops();
      setCheer('sad');
      say('Sai rồi, bóng ở đây nè! 👉', 'soft', 1700);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 4) {
        const s = game.current;
        const id = s.order[n - 1];
        if (id != null) tap(id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const replay = () => {
    game.current = createCups({ random });
    setUi(snap(game.current));
    setPops([]);
    setBanner(null);
    setCheer(null);
    setPhase('ready');
  };

  const n = ui.n;
  const picking = ui.phase === 'pick' && phase === 'play';
  const ballVisible = ui.phase === 'show' || ui.phase === 'cover' || ui.phase === 'reveal';
  const rightNow = ui.phase === 'reveal' && ui.last?.result === 'right';
  const ballCup = ui.cups.find((c) => c.id === ui.ball);
  const hint = phase === 'play' ? (ui.phase === 'reveal' ? null : HINTS[ui.phase]) : null;
  const moving = ui.phase === 'shuffle';

  return (
    <CarnivalShell
      title="🥤 Đoán cốc"
      label="Đoán cốc"
      onClose={onClose}
      background="bg-gradient-to-b from-rose-800 via-red-900 to-amber-950"
      dataAttrs={{ 'data-phase': phase, 'data-step': ui.phase, 'data-round': ui.round + 1, 'data-score': ui.score, 'data-streak': ui.streak, 'data-correct': ui.correct }}
      hud={
        <HudBar
          items={[
            { icon: '🎯', label: 'Vòng', value: `${Math.min(ui.round + 1, ROUNDS.length)}/${ROUNDS.length}` },
            { icon: '⭐', label: 'Điểm', value: ui.score, testId: 'cups-score' },
            { icon: '🔥', label: 'Chuỗi', value: ui.streak },
          ]}
        />
      }
    >
      <div className="relative flex-1 flex flex-col items-center justify-center pb-10 overflow-hidden">
        {/* Booth: curtains and a light garland */}
        <div className="absolute inset-x-0 top-0 h-full pointer-events-none" aria-hidden="true">
          <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-red-700 to-red-500 cups-curtain" style={{ clipPath: 'polygon(0 0,100% 0,60% 100%,0 100%)' }} />
          <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-red-700 to-red-500 cups-curtain" style={{ clipPath: 'polygon(0 0,100% 0,100% 100%,40% 100%)' }} />
          <div className="absolute inset-x-6 top-2 flex justify-between">
            {Array.from({ length: 11 }, (_, i) => (
              <span key={i} className="w-2.5 h-2.5 rounded-full cups-bulb" style={{ background: ['#fde047', '#f472b6', '#38bdf8'][i % 3], animationDelay: `${(i % 3) * 0.25}s` }} />
            ))}
          </div>
        </div>
        {/* The child's Pokemon watching, with a speech bubble */}
        <div className="relative z-10 flex items-end gap-2 w-full max-w-[360px] px-4 mb-2">
          <img
            key={cheer || 'idle'}
            src={player.image}
            alt={player.name}
            className={`w-20 h-20 object-contain drop-shadow-xl ${cheer === 'happy' ? 'battle-victory' : cheer === 'sad' ? 'wrong-shake' : 'sport-bob'}`}
          />
          {hint && (
            <p key={ui.phase} className={`pop-in mb-4 px-3 py-2 rounded-2xl rounded-bl-none bg-white/95 text-sm font-black text-rose-800 shadow-lg ${picking ? 'hint-pulse' : ''}`} data-testid="cups-hint">
              {hint}
            </p>
          )}
        </div>
        {/* Table */}
        <div className="relative z-10 w-full max-w-[380px] h-[250px] mb-4" data-testid="cups-stage">
          <div className="absolute inset-x-2 bottom-0 h-[120px] rounded-[40%/30%] bg-gradient-to-b from-emerald-600 to-emerald-900 shadow-[0_18px_30px_rgba(0,0,0,0.5)] border-4 border-amber-700" />
          <div className="absolute inset-x-6 bottom-6 h-[80px] rounded-[40%/35%] bg-emerald-500/40" style={{ backgroundImage: 'radial-gradient(circle at 50% 40%, rgba(255,255,255,0.25), transparent 60%)' }} />
          {/* Cup shadows */}
          {ui.cups.map((c) => (
            <span
              key={`sh${c.id}`}
              className="absolute bottom-[58px] h-4 rounded-[50%] bg-black/35 blur-[2px]"
              style={{ left: `${slotLeft(c.x, n)}%`, width: `${70 - c.lift * 20}px`, transform: `translate(-50%, ${c.arc * 20}px)`, opacity: 1 - c.lift * 0.5 }}
            />
          ))}
          {/* The Pokeball on the table */}
          {ballVisible && ballCup && (
            <span className="absolute bottom-[58px] w-11 h-11" style={{ left: `${slotLeft(ballCup.x, n)}%`, transform: 'translateX(-50%)', zIndex: 2 }} data-testid="cups-ball">
              <span className={`block w-full h-full ${rightNow ? 'cups-ball-win' : ''}`}>
                <PokeBall shine={rightNow} />
              </span>
            </span>
          )}
          {/* Cups */}
          {ui.cups.map((c) => {
            const color = CUP_COLORS[c.id];
            const z = c.arc < 0 ? 1 : c.arc > 0 ? 4 : 3;
            const scale = 1 + c.arc * 0.1;
            const tilt = c.lift * (c.id % 2 ? 8 : -8);
            return (
              <button
                key={c.id}
                type="button"
                onPointerDown={() => tap(c.id)}
                aria-label={`Cốc ${color.name}`}
                data-cup={c.id}
                className={`absolute bottom-[54px] w-[78px] h-[92px] touch-none ${picking ? 'cups-pickable' : ''} ${fresh === c.id ? 'cups-new' : ''} ${ui.phase === 'reveal' && c.id === ui.picked && ui.last?.result === 'wrong' ? 'cups-wrong' : ''}`}
                style={{
                  left: `${slotLeft(c.x, n)}%`,
                  zIndex: z,
                  transform: `translate(-50%, ${c.arc * 22 - c.lift * 84}px) scale(${scale}) rotate(${tilt}deg)`,
                  filter: moving && c.arc !== 0 ? 'drop-shadow(0 6px 6px rgba(0,0,0,0.45))' : 'drop-shadow(0 4px 3px rgba(0,0,0,0.35))',
                  transition: moving ? 'none' : 'left 0.35s ease-out',
                }}
              >
                <span className={`block w-full h-full ${picking ? 'cups-wiggle' : ''}`} style={{ animationDelay: `${c.id * 0.12}s` }}>
                  <Cup color={color} id={c.id} />
                </span>
                {pops
                  .filter((p) => p.cup === c.id)
                  .map((p) => (
                    <span key={p.id} className="damage-float absolute left-1/2 -top-6 text-3xl font-black text-yellow-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] pointer-events-none">
                      {p.text}
                    </span>
                  ))}
              </button>
            );
          })}
        </div>
        {banner && (
          <p
            key={banner.id}
            className={`banner-slam absolute top-[14%] inset-x-8 z-20 text-center text-xl font-black px-3 py-2 rounded-2xl shadow-xl pointer-events-none ${banner.tone === 'gold' ? 'bg-yellow-300 text-rose-800' : banner.tone === 'blue' ? 'bg-sky-400 text-white' : 'bg-white/90 text-slate-700'}`}
            data-testid="cups-banner"
          >
            {banner.text}
          </p>
        )}
        {phase === 'ready' && <Countdown onDone={() => setPhase('play')} />}
        {phase === 'done' && (
          <CarnivalResult
            title={ui.stars === 3 ? 'Mắt thần! 🏆' : ui.correct >= 3 ? 'Tinh mắt lắm! 👀' : 'Cố lên lần sau nhé! 💪'}
            stars={ui.stars}
            detail={`${ui.score} điểm · đoán đúng ${ui.correct}/${ROUNDS.length} · chuỗi dài nhất ${ui.best}`}
            onReplay={replay}
            onClose={onClose}
            onGold={onGold}
          />
        )}
      </div>
    </CarnivalShell>
  );
}
