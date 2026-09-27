import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { createHammer, stepHammer, strike, hammerAngle, hammerStars, SWINGS, BELL_AT, STRIKE_TIME } from '../../utils/carnival/hammer';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { useLoop, useLater } from '../sports/sportsKit';
import { CarnivalShell, CarnivalResult, Countdown, HudBar } from './CarnivalCommon';

// Scene coordinates (px) inside a 360 x 440 box
const PAD_Y = 372; // puck resting centre
const BELL_Y = 72; // puck centre when it rings the bell
const LIGHTS = 12;
const MACHOP = artworkUrl(66);

/** Tower height for a power (the bell is reached at BELL_AT). */
const puckY = (p) => PAD_Y - Math.min(1, p / BELL_AT) * (PAD_Y - BELL_Y);

const WORDS = [
  [BELL_AT, 'SIÊU MẠNH! 💪', 'text-yellow-300'],
  [0.75, 'Mạnh lắm!', 'text-orange-300'],
  [0.5, 'Khá lắm!', 'text-lime-300'],
  [0, 'Cố lên nào!', 'text-sky-300'],
];
const wordFor = (p) => WORDS.find(([min]) => p >= min);
const lightColor = (k) => (k > 0.8 ? '#f43f5e' : k > 0.55 ? '#fb923c' : k > 0.3 ? '#facc15' : '#4ade80');

const snap = (s) => ({
  stage: s.stage,
  swing: s.swing,
  meter: s.meter,
  puck: s.puck,
  power: s.power,
  t: s.t,
  score: s.score,
  best: s.best,
  bells: s.bells,
  angle: hammerAngle(s),
  results: s.results.map((r) => ({ bell: r.bell, points: r.points, power: r.power })),
  stars: hammerStars(s),
});

function Tower({ puck, best, lit, flash, ring }) {
  const marks = [
    [0.25, '25'],
    [0.5, '50'],
    [0.75, '75'],
  ];
  return (
    <svg viewBox="0 0 120 400" className="absolute left-1/2 top-0 -translate-x-1/2 w-[120px] h-[400px] overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="hm-pole" x1="0" x2="1">
          <stop offset="0" stopColor="#7c2d12" />
          <stop offset="0.35" stopColor="#f59e0b" />
          <stop offset="0.6" stopColor="#fde68a" />
          <stop offset="1" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id="hm-bell" x1="0" x2="1">
          <stop offset="0" stopColor="#a16207" />
          <stop offset="0.4" stopColor="#fef08a" />
          <stop offset="1" stopColor="#ca8a04" />
        </linearGradient>
        <radialGradient id="hm-glow">
          <stop offset="0" stopColor="#fde047" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fde047" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Board */}
      <rect x="30" y="58" width="60" height="330" rx="10" fill="#1e1b4b" stroke="#fbbf24" strokeWidth="3" />
      <rect x="52" y="64" width="16" height="318" rx="8" fill="url(#hm-pole)" />
      {/* Marks */}
      {marks.map(([p, label]) => (
        <g key={label}>
          <line x1="36" x2="50" y1={puckY(p)} y2={puckY(p)} stroke="#fde68a" strokeWidth="2" />
          <line x1="70" x2="84" y1={puckY(p)} y2={puckY(p)} stroke="#fde68a" strokeWidth="2" />
          <text x="18" y={puckY(p) + 4} textAnchor="middle" fontSize="11" fontWeight="900" fill="#fef3c7">
            {label}
          </text>
        </g>
      ))}
      {/* Lights along both sides */}
      {Array.from({ length: LIGHTS }, (_, i) => {
        const k = (i + 0.5) / LIGHTS;
        const y = puckY(k * BELL_AT);
        const on = lit >= k * BELL_AT - 0.001;
        return [40, 80].map((x) => (
          <circle
            key={`${i}-${x}`}
            cx={x}
            cy={y}
            r="3.6"
            fill={on || flash ? lightColor(k) : '#475569'}
            className={flash ? 'hammer-light-chase' : undefined}
            style={flash ? { animationDelay: `${(LIGHTS - i) * 45}ms` } : on ? { filter: `drop-shadow(0 0 4px ${lightColor(k)})` } : undefined}
          />
        ));
      })}
      {/* Best height so far */}
      {best > 0 && (
        <g transform={`translate(0 ${puckY(best)})`} className="transition-transform duration-500" data-testid="hammer-best">
          <line x1="86" x2="104" y1="0" y2="0" stroke="#f472b6" strokeWidth="2.5" />
          <path d="M104 0v-14l12 5-12 5z" fill="#f472b6" />
          <text x="110" y="12" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#fbcfe8">
            Kỷ lục
          </text>
        </g>
      )}
      {/* Bell */}
      <g key={ring} className={ring ? 'hammer-bell-ring' : undefined} style={{ transformOrigin: '60px 6px' }}>
        {ring > 0 && <circle cx="60" cy="34" r="46" fill="url(#hm-glow)" className="hammer-bell-glow" />}
        <rect x="56" y="0" width="8" height="10" rx="3" fill="#78350f" />
        <path d="M34 50c0-26 10-42 26-42s26 16 26 42c4 2 6 4 6 7H28c0-3 2-5 6-7z" fill="url(#hm-bell)" stroke="#854d0e" strokeWidth="2.5" />
        <circle cx="60" cy="61" r="5" fill="#854d0e" />
        <path d="M46 22c3-6 7-8 10-8" stroke="#fff" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
      {/* The puck: a Pokeball riding the pole */}
      <g transform={`translate(60 ${puckY(puck)})`}>
        {puck > 0.02 && <rect x="-5" y="4" width="10" height={Math.min(60, 12 + puck * 70)} rx="5" fill="url(#hm-glow)" opacity="0.8" />}
        <circle r="11" fill="#f8fafc" stroke="#111827" strokeWidth="2" />
        <path d="M-11 0a11 11 0 0 1 22 0z" fill="#ef4444" stroke="#111827" strokeWidth="2" />
        <circle r="3.5" fill="#fff" stroke="#111827" strokeWidth="2" />
      </g>
    </svg>
  );
}

function Hammer({ angle }) {
  return (
    <div className="absolute pointer-events-none" style={{ left: 98, top: 357, width: 0, height: 0, transform: `rotate(${angle}rad)` }} data-testid="hammer-tool">
      <svg viewBox="0 0 110 50" className="absolute overflow-visible" style={{ left: -6, top: -25, width: 110, height: 50 }} aria-hidden="true">
        <rect x="0" y="21" width="70" height="8" rx="4" fill="#92400e" stroke="#451a03" strokeWidth="1.5" />
        <rect x="6" y="20" width="14" height="10" rx="3" fill="#dc2626" />
        <rect x="62" y="2" width="44" height="46" rx="9" fill="#ef4444" stroke="#7f1d1d" strokeWidth="2.5" />
        <rect x="62" y="2" width="10" height="46" rx="4" fill="#fca5a5" opacity="0.6" />
        <rect x="98" y="2" width="8" height="46" rx="3" fill="#991b1b" opacity="0.6" />
        <circle cx="84" cy="25" r="8" fill="#fef08a" stroke="#7f1d1d" strokeWidth="2" />
        <path d="M80 25h8M84 21v8" stroke="#b91c1c" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function PowerMeter({ value, active, speedUp }) {
  return (
    <div className="absolute left-3 top-6 w-11 h-[250px]" data-testid="hammer-meter" data-value={value.toFixed(2)}>
      <div className="absolute inset-0 rounded-full bg-slate-900/80 border-4 border-amber-200 shadow-xl overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-lime-400 via-yellow-300 to-rose-500" style={{ height: `${value * 100}%` }} />
        <div className="absolute inset-x-0 top-0 h-[5%] bg-yellow-200/40 border-b-2 border-dashed border-yellow-200" />
        {[0.25, 0.5, 0.75].map((k) => (
          <div key={k} className="absolute inset-x-1 h-0.5 bg-white/40" style={{ bottom: `${k * 100}%` }} />
        ))}
      </div>
      <span className="absolute -right-5 -top-2 text-lg" aria-hidden="true">
        🔔
      </span>
      {/* Pointer */}
      <div className="absolute -left-2 -right-2 h-2 rounded-full bg-white shadow-[0_0_12px_#fff]" style={{ bottom: `calc(${value * 100}% - 4px)` }} />
      {active && value >= BELL_AT && <div className="absolute -inset-2 rounded-full ring-4 ring-yellow-300 hint-pulse" />}
      {speedUp && (
        <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-black text-rose-200" aria-hidden="true">
          ⚡ nhanh hơn!
        </span>
      )}
    </div>
  );
}

/**
 * "Búa sức mạnh Machop": stop the swinging power meter at the top; Machop slams the hammer
 * and the puck flies up the tower. Ring the bell (95%+) for a big bonus. 5 swings.
 */
export function HammerGame({ player, onClose, onGold, random = Math.random }) {
  const [phase, setPhase] = useState('ready'); // ready | play | done
  const [first] = useState(() => createHammer({ random }));
  const game = useRef(first);
  const [ui, setUi] = useState(() => snap(first));
  const [hits, setHits] = useState([]); // impact rings, sparks, "+95"
  const [ring, setRing] = useState(0); // bell rings (key for the animation)
  const [flash, setFlash] = useState(false);
  const [shake, setShake] = useState(0); // strength of the screen shake, 0 = none
  const [fit, setFit] = useState(1);
  const boxRef = useRef(null);
  const later = useLater();
  const idRef = useRef(0);

  useLoop((dt) => {
    const s = game.current;
    stepHammer(s, dt);
    for (const e of s.events.splice(0)) {
      if (e.type === 'hit') {
        const id = ++idRef.current;
        sounds.playPop();
        sounds.playWhoosh();
        setShake(2 + e.power * 6);
        later(() => setShake(0), 320);
        setHits((list) => [
          ...list,
          { id, power: e.power, sparks: Array.from({ length: 10 }, (_, i) => ({ a: (i / 10) * Math.PI * 2 + Math.random() * 0.4, d: 40 + Math.random() * 50 * (0.5 + e.power) })) },
        ]);
        later(() => setHits((list) => list.filter((h) => h.id !== id)), 1200);
      } else if (e.type === 'bell') {
        sounds.playNote(1318, { duration: 1.3, volume: 0.3 });
        sounds.playNote(1760, { duration: 1.1, volume: 0.18, delay: 0.05 });
        sounds.playCoin();
        setRing((r) => r + 1);
        setFlash(true);
        later(() => setFlash(false), 1500);
        try {
          confetti({ particleCount: 110, spread: 100, startVelocity: 40, origin: { x: 0.5, y: 0.2 }, zIndex: 9999, colors: ['#facc15', '#fde047', '#ef4444', '#ffffff', '#38bdf8'] });
        } catch {
          // decoration
        }
      } else if (e.type === 'top') {
        sounds.playNote(440 + e.power * 440, { duration: 0.3, volume: 0.16 });
      } else if (e.type === 'next') {
        sounds.playScanBeep();
      } else if (e.type === 'end') {
        later(() => setPhase('done'), 500);
      }
    }
    setUi(snap(s));
  }, phase === 'play');

  const hit = () => {
    if (phase !== 'play') return;
    const s = game.current;
    if (strike(s) == null) return;
    sounds.playNote(220, { duration: 0.15, volume: 0.12 });
    setUi(snap(s));
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        hit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Scale the 360 x 440 scene down on small screens
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      if (width && height) setFit(Math.min(1, width / 360, height / 440));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const replay = () => {
    game.current = createHammer({ random });
    setUi(snap(game.current));
    setHits([]);
    setRing(0);
    setFlash(false);
    setPhase('ready');
  };

  const s = ui;
  const aiming = phase === 'play' && s.stage === 'aim';
  const showWord = (s.stage === 'hang' || s.stage === 'fall') && s.results.length > 0;
  const last = s.results[s.results.length - 1];
  const word = last && wordFor(last.power);
  // Squash and stretch for Machop: stretch while winding up, squash on the hit
  const k = s.stage === 'strike' ? s.t / STRIKE_TIME : 0;
  const machop =
    s.stage === 'strike' ? (k < 0.45 ? 'scale(0.96, 1.08) translateY(-4px)' : 'scale(1.1, 0.9) translateY(4px)') : s.stage === 'fly' && s.t < 0.18 ? 'scale(1.12, 0.86) translateY(6px)' : 'scale(1)';
  const pad = s.stage === 'fly' && s.t < 0.16 ? 'scaleY(0.45)' : 'scaleY(1)';
  const cheering = s.stage === 'fly' || s.stage === 'hang' || flash;

  return (
    <CarnivalShell
      title="💪 Búa sức mạnh"
      label="Búa sức mạnh Machop"
      onClose={onClose}
      background="bg-gradient-to-b from-indigo-950 via-purple-900 to-rose-900"
      dataAttrs={{ 'data-phase': phase, 'data-score': s.score, 'data-stage': s.stage, 'data-swing': s.swing + 1, 'data-bells': s.bells }}
      hud={
        <HudBar
          items={[
            { icon: '🔨', label: 'Lượt', value: `${Math.min(SWINGS, s.swing + 1)}/${SWINGS}` },
            { icon: '⭐', label: 'Điểm', value: s.score, testId: 'hammer-score' },
            { icon: '🏅', label: 'Kỷ lục', value: `${Math.round(s.best * 100)}%` },
          ]}
        />
      }
    >
      <div className="relative flex-1 min-h-0 flex flex-col items-center justify-between overflow-hidden px-2 pb-3" data-testid="hammer-stage">
        {/* Carnival string lights */}
        <div className="absolute inset-x-0 top-1 flex justify-around pointer-events-none" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className={`w-2.5 h-2.5 rounded-full ${['bg-yellow-300', 'bg-pink-400', 'bg-sky-300', 'bg-lime-300'][i % 4]} ${flash ? 'hammer-light-chase' : 'hint-pulse'}`}
              style={{ animationDelay: `${i * 90}ms` }}
            />
          ))}
        </div>
        <div ref={boxRef} className="relative w-full flex-1 min-h-[220px] mt-3">
          <div
            className={`absolute left-1/2 top-1/2 w-[360px] h-[440px] origin-center ${shake ? 'hammer-shake' : ''}`}
            style={{ transform: `translate(-50%, -50%) scale(${fit})`, '--hammer-shake': `${shake}px` }}
          >
            <Tower puck={s.puck} best={s.best} lit={s.stage === 'aim' || s.stage === 'rest' ? 0 : s.puck} flash={flash} ring={ring} />
            {ring > 0 && flash && (
              <span
                key={`ding-${ring}`}
                className="hammer-ding absolute left-1/2 top-2 -translate-x-1/2 text-5xl font-black text-yellow-300 sport-banner pointer-events-none"
                data-testid="hammer-ding"
              >
                DING!
              </span>
            )}
            {/* Pad */}
            <div
              className="absolute left-[150px] top-[384px] w-[60px] h-[14px] rounded-t-xl bg-gradient-to-b from-rose-400 to-rose-700 border-2 border-rose-900 origin-bottom transition-transform duration-100"
              style={{ transform: pad }}
            />
            <div className="absolute left-[132px] top-[396px] w-[96px] h-[22px] rounded-lg bg-gradient-to-b from-slate-500 to-slate-800 border-2 border-slate-900" />
            {/* Machop and the hammer */}
            <img
              src={MACHOP}
              alt="Machop"
              className="absolute left-[8px] top-[296px] w-[104px] h-[104px] object-contain drop-shadow-xl origin-bottom transition-transform duration-75"
              style={{ transform: machop }}
            />
            <Hammer angle={s.angle} />
            {/* The child's Pokemon cheering */}
            <div className="absolute right-[6px] top-[300px] w-[92px] flex flex-col items-center">
              <div className={cheering ? 'dance-bob' : 'sport-bob'}>
                <img src={player.image} alt={player.name} className="w-[84px] h-[84px] object-contain drop-shadow-xl scale-x-[-1]" />
              </div>
              {cheering && (
                <span className="absolute -top-5 text-2xl pop-in" aria-hidden="true">
                  {flash ? '🎉' : '👏'}
                </span>
              )}
            </div>
            {/* Impact: rings, sparks, POW */}
            {hits.map((h) => (
              <div key={`hit-${h.id}`} className="absolute left-[180px] top-[384px] w-0 h-0 pointer-events-none">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="hammer-ring absolute rounded-full border-4 border-yellow-200"
                    style={{ left: -30, top: -30, width: 60, height: 60, animationDelay: `${i * 90}ms`, '--hammer-ring': 2 + h.power * 2.5 }}
                  />
                ))}
                {h.sparks.map((p, i) => (
                  <span
                    key={i}
                    className="hammer-spark absolute w-2.5 h-2.5 -ml-1 -mt-1 rounded-full bg-yellow-300 shadow-[0_0_8px_#fde047]"
                    style={{ '--dx': `${Math.cos(p.a) * p.d}px`, '--dy': `${Math.sin(p.a) * p.d * 0.6 - 20}px` }}
                  />
                ))}
                <span className="hammer-pow absolute -left-10 -top-16 w-20 text-center text-3xl font-black text-white sport-banner">POW!</span>
              </div>
            ))}
            {showWord && word && (
              <div key={`word-${s.results.length}`} className="absolute right-2 top-[120px] w-[120px] text-center pointer-events-none" data-testid="hammer-word">
                <p className={`pop-in text-2xl font-black sport-banner leading-tight ${word[2]}`}>{word[1]}</p>
                <p className="pop-in text-xl font-black text-white" style={{ animationDelay: '120ms' }}>
                  +{last.points}
                </p>
              </div>
            )}
            <PowerMeter value={s.stage === 'aim' ? s.meter : s.power} active={aiming} speedUp={aiming && s.swing === SWINGS - 1} />
          </div>
        </div>
        {/* Swing record */}
        <div className="flex gap-2 mt-1" aria-label="Kết quả các lượt">
          {Array.from({ length: SWINGS }, (_, i) => {
            const r = s.results[i];
            return (
              <span
                key={i}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black border-2 ${r ? (r.bell ? 'bg-yellow-300 border-yellow-100 text-amber-900 star-pop' : 'bg-white/90 border-white text-purple-800 star-pop') : i === s.results.length && phase === 'play' ? 'border-yellow-300 text-yellow-200 hint-pulse' : 'border-white/30 text-white/40'}`}
              >
                {r ? (r.bell ? '🔔' : Math.round(r.power * 100)) : i + 1}
              </span>
            );
          })}
        </div>
        <button
          onPointerDown={hit}
          disabled={!aiming}
          className={`mt-2 w-[80%] max-w-[300px] py-4 rounded-3xl text-2xl font-black text-white shadow-xl border-b-8 transition-transform active:scale-95 active:border-b-2 ${aiming ? 'bg-gradient-to-b from-rose-500 to-red-600 border-red-800 hint-pulse' : 'bg-slate-500 border-slate-700 opacity-70'}`}
          data-testid="hammer-hit"
        >
          🔨 ĐẬP!
        </button>
        {phase === 'ready' && (
          <>
            <p className="absolute bottom-28 left-1/2 -translate-x-1/2 w-[88%] px-3 py-2 rounded-2xl bg-black/60 text-center text-white text-sm font-black pointer-events-none z-40">
              Bấm ĐẬP khi thanh sức mạnh lên cao nhất để rung chuông! 🔔
            </p>
            <Countdown onDone={() => setPhase('play')} />
          </>
        )}
        {phase === 'done' && (
          <CarnivalResult
            title={s.stars === 3 ? 'Lực sĩ vô địch! 🏆' : s.stars === 2 ? 'Khỏe quá! 💪' : 'Giỏi lắm! 🔨'}
            stars={s.stars}
            detail={`${s.score} điểm · rung chuông ${s.bells} lần · cao nhất ${Math.round(s.best * 100)}%`}
            onReplay={replay}
            onClose={onClose}
            onGold={onGold}
          />
        )}
      </div>
    </CarnivalShell>
  );
}
