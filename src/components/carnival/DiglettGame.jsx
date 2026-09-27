import React, { useRef, useState } from 'react';
import { createWhack, stepWhack, whack, whackStars, timeLeft, HOLES, DURATION } from '../../utils/carnival/diglett';
import { sounds } from '../../utils/soundEffects';
import { useLoop, useLater } from '../sports/sportsKit';
import { CarnivalShell, CarnivalResult, Countdown, HudBar } from './CarnivalCommon';

function Diglett({ golden }) {
  return (
    <svg viewBox="0 0 60 70" className="w-full h-full drop-shadow-lg" aria-hidden="true">
      <defs>
        <radialGradient id={golden ? 'dg-gold' : 'dg-brown'} cx="35%" cy="25%" r="80%">
          <stop offset="0" stopColor={golden ? '#fef9c3' : '#d6a26b'} />
          <stop offset="0.6" stopColor={golden ? '#facc15' : '#a16207'} />
          <stop offset="1" stopColor={golden ? '#ca8a04' : '#78350f'} />
        </radialGradient>
      </defs>
      <path d="M6 70V34a24 24 0 0 1 48 0v36z" fill={`url(#${golden ? 'dg-gold' : 'dg-brown'})`} stroke={golden ? '#a16207' : '#451a03'} strokeWidth="2" />
      <ellipse cx="22" cy="30" rx="3.2" ry="5" fill="#111827" />
      <ellipse cx="38" cy="30" rx="3.2" ry="5" fill="#111827" />
      <circle cx="21" cy="28" r="1.2" fill="#fff" />
      <circle cx="37" cy="28" r="1.2" fill="#fff" />
      <ellipse cx="30" cy="42" rx="9" ry="6" fill="#f9a8d4" stroke="#be185d" strokeWidth="1.2" />
      {golden && <path d="M18 12l3 4 4-6 5 6 5-6 4 6 3-4-2 9H20z" fill="#fde047" stroke="#a16207" strokeWidth="1.2" />}
    </svg>
  );
}

function Voltorb() {
  return (
    <svg viewBox="0 0 60 70" className="w-full h-full drop-shadow-lg" aria-hidden="true">
      <circle cx="30" cy="40" r="26" fill="#ffffff" stroke="#111827" strokeWidth="2.5" />
      <path d="M4 40a26 26 0 0 1 52 0z" fill="#ef4444" stroke="#111827" strokeWidth="2.5" />
      <path d="M14 32l10 5M46 32l-10 5" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="21" cy="40" rx="3.5" ry="3" fill="#111827" />
      <ellipse cx="39" cy="40" rx="3.5" ry="3" fill="#111827" />
      <path d="M22 16l2-5M38 16l-2-5M30 13v-6" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** How far out of the hole a Diglett is (0 hidden .. 1 fully up). */
function rise(h) {
  if (!h) return 0;
  const end = h.hit ? h.hitAt + 0.35 : h.life;
  const up = Math.min(1, h.t / 0.12);
  const down = Math.min(1, Math.max(0, (end - h.t) / 0.14));
  return Math.min(up, down);
}

// What the screen draws, copied from the game each frame
const snap = (s) => ({
  score: s.score,
  combo: s.combo,
  best: s.best,
  hits: s.hits,
  bombs: s.bombs,
  left: timeLeft(s),
  stars: whackStars(s),
  holes: s.holes.map((h) => (h ? { kind: h.kind, hit: h.hit, k: rise(h) } : null)),
});

/**
 * "Đập Diglett": tap the Diglett popping out of 9 holes before they hide. Golden ones are
 * worth 30; Voltorb explode (don't tap them!). 40 seconds, faster and faster.
 */
export function DiglettGame({ player, onClose, onGold, random = Math.random }) {
  const [phase, setPhase] = useState('ready'); // ready | play | done
  const [first] = useState(() => createWhack({ random }));
  const game = useRef(first);
  const [ui, setUi] = useState(() => snap(first));
  const [pops, setPops] = useState([]); // floating "+10"
  const [swing, setSwing] = useState(null); // hammer at a hole
  const [shake, setShake] = useState(null);
  const later = useLater();
  const idRef = useRef(0);

  useLoop((dt) => {
    const s = game.current;
    stepWhack(s, dt);
    for (const e of s.events.splice(0)) {
      if (e.type === 'up') sounds.playPop();
      if (e.type === 'end') {
        sounds.playWhoosh();
        later(() => setPhase('done'), 600);
      }
    }
    setUi(snap(s));
  }, phase === 'play');

  const tap = (i) => {
    if (phase !== 'play') return;
    const s = game.current;
    const out = whack(s, i);
    setUi(snap(s));
    const id = ++idRef.current;
    setSwing({ hole: i, id });
    later(() => setSwing((w) => (w?.id === id ? null : w)), 260);
    if (out.result === 'hit') {
      sounds.playCoin();
      setPops((list) => [...list, { id, hole: i, text: `+${out.points}`, gold: s.combo >= 5 || out.points >= 30 }]);
    } else if (out.result === 'boom') {
      sounds.playOops();
      setShake({ hole: i, id });
      setPops((list) => [...list, { id, hole: i, text: `${out.points}`, bad: true }]);
      later(() => setShake((x) => (x?.id === id ? null : x)), 450);
    } else return;
    later(() => setPops((list) => list.filter((p) => p.id !== id)), 800);
  };

  const replay = () => {
    game.current = createWhack({ random });
    setUi(snap(game.current));
    setPops([]);
    setPhase('ready');
  };

  const s = ui;
  const left = Math.ceil(ui.left);
  const stars = ui.stars;

  return (
    <CarnivalShell
      title="🔨 Đập Diglett"
      label="Đập Diglett"
      onClose={onClose}
      background="bg-gradient-to-b from-sky-400 via-lime-500 to-green-700"
      dataAttrs={{ 'data-phase': phase, 'data-score': s.score, 'data-combo': s.combo }}
      hud={
        <>
          <HudBar items={[{ icon: '⭐', label: 'Điểm', value: s.score, testId: 'whack-score' }, { icon: '🔥', label: 'Combo', value: s.combo }, { icon: '⏱', label: 'Còn', value: `${left}s`, warn: left <= 8 && phase === 'play' }]} />
          <div className="mt-1 h-2 rounded-full bg-black/30 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-300 to-rose-500 transition-[width] duration-200" style={{ width: `${(ui.left / DURATION) * 100}%` }} />
          </div>
        </>
      }
    >
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-3">
        {/* The stall sign: a wooden board with chasing bulbs, the child's Pokemon holding the hammer */}
        <div className="relative mb-4 w-full max-w-[330px] rounded-2xl border-4 border-amber-900 bg-gradient-to-b from-amber-600 to-amber-800 px-3 pt-3 pb-2 shadow-xl">
          <div className="absolute inset-x-2 -top-2 flex justify-between" aria-hidden="true">
            {Array.from({ length: 11 }, (_, i) => (
              <span key={i} className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(253,224,71,0.9)] hint-pulse" style={{ background: ['#fde047', '#f472b6', '#38bdf8'][i % 3], animationDelay: `${(i % 3) * 0.25}s` }} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="relative shrink-0">
              <img src={player.image} alt={player.name} className="w-16 h-16 object-contain sport-bob drop-shadow-lg" />
              <span className="absolute -right-2 -top-1 text-2xl" aria-hidden="true">🔨</span>
            </span>
            <div className="flex-1">
              <p className="text-2xl font-black text-yellow-200 drop-shadow tracking-wide">ĐẬP DIGLETT!</p>
              <p className="text-xs font-black text-amber-100">Đập Diglett, né Voltorb nhé! ⚡ Diglett vàng được 30 điểm</p>
            </div>
          </div>
          <span className="absolute -bottom-5 left-6 w-3 h-5 bg-amber-900" />
          <span className="absolute -bottom-5 right-6 w-3 h-5 bg-amber-900" />
        </div>
        <div className="grid grid-cols-3 gap-3 w-full max-w-[330px]" data-testid="whack-board">
          {Array.from({ length: HOLES }, (_, i) => {
            const h = s.holes[i];
            const k = h ? h.k : 0;
            return (
              <button
                key={i}
                onPointerDown={() => tap(i)}
                aria-label={`Lỗ ${i + 1}`}
                data-kind={h ? h.kind : ''}
                className={`relative aspect-square touch-none ${shake?.hole === i ? 'wrong-shake' : ''}`}
              >
                {/* Mound and hole */}
                <span className="absolute inset-x-0 bottom-0 h-[46%] rounded-[50%] bg-gradient-to-b from-amber-700 to-amber-950 shadow-[inset_0_6px_10px_rgba(0,0,0,0.5)]" />
                <span className="absolute inset-0 overflow-hidden rounded-b-[45%]" style={{ clipPath: 'inset(0 0 22% 0)' }}>
                  <span className="absolute left-[14%] right-[14%] bottom-0 h-[86%] transition-none" style={{ transform: `translateY(${(1 - k) * 100}%)` }}>
                    {h && (h.kind === 'voltorb' ? <Voltorb /> : <Diglett golden={h.kind === 'golden'} />)}
                    {h?.hit && h.kind !== 'voltorb' && <span className="absolute -top-1 inset-x-0 text-center text-lg animate-spin">💫</span>}
                  </span>
                </span>
                <span className="absolute inset-x-[6%] bottom-[6%] h-[20%] rounded-[50%] bg-gradient-to-b from-lime-600 to-green-800 shadow" />
                {h?.kind === 'golden' && !h.hit && <span className="absolute inset-0 rounded-full shiny-twinkle pointer-events-none" />}
                {shake?.hole === i && <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle,#fff7ae,#fb923c_40%,transparent_70%)] flash-fade pointer-events-none" />}
                {swing?.hole === i && (
                  <span key={swing.id} className="absolute -top-2 right-0 text-4xl origin-bottom-right hammer-swing pointer-events-none" aria-hidden="true">
                    🔨
                  </span>
                )}
                {pops
                  .filter((p) => p.hole === i)
                  .map((p) => (
                    <span key={p.id} className={`damage-float absolute left-1/2 top-0 text-2xl font-black drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] pointer-events-none ${p.bad ? 'text-rose-400' : p.gold ? 'text-yellow-300' : 'text-white'}`}>
                      {p.text}
                    </span>
                  ))}
              </button>
            );
          })}
        </div>
        {s.combo >= 5 && phase === 'play' && (
          <p key={s.combo} className="chain-pop mt-3 text-3xl font-black text-yellow-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]">
            {s.combo} COMBO!
          </p>
        )}
        {phase === 'ready' && <Countdown onDone={() => setPhase('play')} />}
        {phase === 'done' && (
          <CarnivalResult
            title={stars === 3 ? 'Tay búa vàng! 🏆' : 'Giỏi lắm! 🔨'}
            stars={stars}
            detail={`${s.score} điểm · đập trúng ${s.hits} · combo cao nhất ${s.best}${s.bombs ? ` · lỡ đập ${s.bombs} Voltorb` : ''}`}
            onReplay={replay}
            onClose={onClose}
            onGold={onGold}
          />
        )}
      </div>
    </CarnivalShell>
  );
}
