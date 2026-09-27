import React, { useEffect, useRef, useState } from 'react';
import {
  createWeigh,
  stepWeigh,
  choose,
  nextRound,
  current,
  answerOf,
  pokemon,
  weighStars,
  QUESTION,
  ROUNDS,
  REVEAL_TIME,
} from '../../utils/carnival/weigh';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { useLoop, useLater } from '../sports/sportsKit';
import { CarnivalShell, CarnivalResult, Countdown, HudBar } from './CarnivalCommon';

// Stage in logical units (the SVG viewBox); HTML bits are placed in % of it
const VW = 360;
const VH = 400;
const PIVOT = { x: 180, y: 158 };
const ARM = 124;
const CHAIN = 84;
const DROP = 0.42; // seconds for the fall onto the pans
const BUBBLE_Y = 70;
const PAIR_X = [78, 282];
const TRIO_X = [62, 180, 298];
const DIAL_Y = 282;
const SNORLAX = 143;

const pct = (x, y) => ({ left: `${(x / VW) * 100}%`, top: `${(y / VH) * 100}%` });
const fmtKg = (kg) => `${String(kg).replace('.', ',')} kg`;
const fmtTimes = (r) => (r >= 3 ? String(Math.round(r)) : String(Math.round(r * 10) / 10).replace('.', ','));
const easeOut = (k) => 1 - (1 - k) ** 3;
function bounce(k) {
  // Falls, then two little bounces
  if (k < 0.62) return (k / 0.62) ** 2;
  if (k < 0.86) {
    const u = (k - 0.74) / 0.12;
    return 1 - 0.1 * (1 - u * u);
  }
  const u = (k - 0.93) / 0.07;
  return 1 - 0.03 * (1 - u * u);
}

/** Where the pans hang for a beam angle (radians, + = right side down). */
function pans(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    { x: PIVOT.x - ARM * c, y: PIVOT.y - ARM * s + CHAIN },
    { x: PIVOT.x + ARM * c, y: PIVOT.y + ARM * s + CHAIN },
  ];
}

const snap = (s) => {
  const r = current(s);
  return {
    step: s.phase,
    round: s.round,
    mode: r.mode,
    dex: r.dex,
    picks: s.picks,
    choice: s.choice,
    correct: s.correct,
    results: [...s.results],
    reveal: s.reveal,
    springs: s.springs.map((x) => x.x),
    stars: weighStars(s),
  };
};

function Scale({ angle, glow }) {
  const [l, r] = pans(angle);
  const deg = (angle * 180) / Math.PI;
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id="weigh-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fef08a" />
          <stop offset="0.5" stopColor="#facc15" />
          <stop offset="1" stopColor="#a16207" />
        </linearGradient>
        <linearGradient id="weigh-pan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
        <pattern id="weigh-stripes" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
          <rect width="11" height="22" fill="#ef4444" />
          <rect x="11" width="11" height="22" fill="#fff7ed" />
        </pattern>
      </defs>
      {/* Stand: striped drum, gold post */}
      <ellipse cx="180" cy="392" rx="96" ry="10" fill="rgba(0,0,0,0.3)" />
      <path d="M112 330h136l-12 60H124z" fill="url(#weigh-stripes)" stroke="#7f1d1d" strokeWidth="3" />
      <rect x="104" y="320" width="152" height="16" rx="6" fill="url(#weigh-gold)" stroke="#78350f" strokeWidth="2.5" />
      <path d="M180 346l5 10 11 1-8 7 3 11-11-6-11 6 3-11-8-7 11-1z" fill="#fde047" stroke="#a16207" strokeWidth="1.5" />
      <rect x="171" y={PIVOT.y} width="18" height={322 - PIVOT.y} rx="5" fill="url(#weigh-gold)" stroke="#78350f" strokeWidth="2.5" />
      {Array.from({ length: 6 }, (_, i) => (
        <circle key={i} cx="180" cy={PIVOT.y + 26 + i * 25} r="3.2" fill={['#f472b6', '#38bdf8', '#fde047'][i % 3]} className="weigh-bulb" style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
      {/* Chains and pans */}
      {[l, r].map((p, i) => (
        <g key={i}>
          <path d={`M${p.x} ${p.y - CHAIN}L${p.x - 44} ${p.y}M${p.x} ${p.y - CHAIN}L${p.x + 44} ${p.y}`} stroke="#fde68a" strokeWidth="2.5" strokeDasharray="4 3" />
          <path d={`M${p.x - 54} ${p.y}h108a54 22 0 0 1 -108 0z`} fill="url(#weigh-pan)" stroke="#78350f" strokeWidth="3" />
          <ellipse cx={p.x} cy={p.y} rx="54" ry="7" fill={glow === i ? '#fef9c3' : '#fcd34d'} stroke="#78350f" strokeWidth="2.5" />
        </g>
      ))}
      {/* Beam */}
      <g transform={`rotate(${deg} ${PIVOT.x} ${PIVOT.y})`}>
        <rect x={PIVOT.x - ARM - 8} y={PIVOT.y - 7} width={ARM * 2 + 16} height="14" rx="7" fill="url(#weigh-gold)" stroke="#78350f" strokeWidth="2.5" />
        {Array.from({ length: 9 }, (_, i) => (
          <circle key={i} cx={PIVOT.x - ARM + 12 + i * ((ARM * 2 - 24) / 8)} cy={PIVOT.y} r="2.6" fill={i % 2 ? '#fff7ed' : '#fb7185'} />
        ))}
        <circle cx={PIVOT.x - ARM} cy={PIVOT.y} r="6" fill="#fde047" stroke="#78350f" strokeWidth="2" />
        <circle cx={PIVOT.x + ARM} cy={PIVOT.y} r="6" fill="#fde047" stroke="#78350f" strokeWidth="2" />
      </g>
      {/* The pivot is a big Pokeball, and the needle shows which way it tips */}
      <path d={`M${PIVOT.x} ${PIVOT.y - 44}l-7 -12h14z`} fill="#b91c1c" transform={`rotate(${deg} ${PIVOT.x} ${PIVOT.y})`} />
      <g transform={`translate(${PIVOT.x} ${PIVOT.y})`} stroke="#1e293b" strokeWidth="3">
        <circle r="17" fill="#f8fafc" />
        <path d="M-17 0a17 17 0 0 1 34 0z" fill="#ef4444" />
        <path d="M-17 0h34" />
        <circle r="6" fill="#f8fafc" />
      </g>
    </svg>
  );
}

function Dials({ values }) {
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id="weigh-box" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f472b6" />
          <stop offset="1" stopColor="#9d174d" />
        </linearGradient>
      </defs>
      {TRIO_X.map((x, i) => {
        const v = Math.max(-0.05, Math.min(1.05, values[i] ?? 0));
        const a = -120 + v * 240;
        const press = Math.max(0, Math.min(1, v)) * 7;
        return (
          <g key={i}>
            <ellipse cx={x} cy={DIAL_Y + 118} rx="50" ry="7" fill="rgba(0,0,0,0.3)" />
            <rect x={x - 46} y={DIAL_Y - 20 + press} width="92" height="10" rx="4" fill="#fde047" stroke="#78350f" strokeWidth="2.5" />
            <rect x={x - 5} y={DIAL_Y - 10 + press} width="10" height={14 - press} fill="#a16207" />
            <rect x={x - 42} y={DIAL_Y + 2} width="84" height="114" rx="14" fill="url(#weigh-box)" stroke="#500724" strokeWidth="3" />
            <circle cx={x} cy={DIAL_Y + 44} r="32" fill="#fff7ed" stroke="#500724" strokeWidth="3" />
            {Array.from({ length: 9 }, (_, k) => {
              const t = ((-120 + k * 30) * Math.PI) / 180;
              return <line key={k} x1={x + Math.sin(t) * 24} y1={DIAL_Y + 44 - Math.cos(t) * 24} x2={x + Math.sin(t) * 29} y2={DIAL_Y + 44 - Math.cos(t) * 29} stroke="#9d174d" strokeWidth={k % 4 === 0 ? 3 : 1.5} />;
            })}
            <g transform={`rotate(${a} ${x} ${DIAL_Y + 44})`}>
              <path d={`M${x - 3} ${DIAL_Y + 46}L${x} ${DIAL_Y + 18}L${x + 3} ${DIAL_Y + 46}z`} fill="#dc2626" />
            </g>
            <circle cx={x} cy={DIAL_Y + 44} r="5" fill="#1e293b" />
          </g>
        );
      })}
    </svg>
  );
}

/** Sparks flying out of a point (CSS animated, each with its own direction). */
function Burst({ x, y, color = '#fde047', count = 10, big }) {
  return (
    <div className="absolute pointer-events-none" style={pct(x, y)} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2;
        const d = (big ? 90 : 56) * (0.7 + ((i * 37) % 10) / 20);
        return (
          <span
            key={i}
            className="weigh-spark absolute left-0 top-0"
            style={{ '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d}px`, color: i % 3 === 0 ? '#ffffff' : color, animationDelay: `${(i % 3) * 30}ms` }}
          >
            {i % 2 ? '★' : '●'}
          </span>
        );
      })}
    </div>
  );
}

/**
 * "Đoán cân nặng Snorlax": which Pokemon is heavier (lighter, or put three in order)? Then they
 * drop onto a big carnival scale that tips on a spring, showing their real weights. 10 rounds.
 */
export function WeighGame({ player, onClose, onGold, random = Math.random }) {
  const [phase, setPhase] = useState('ready'); // ready | play | done
  const [first] = useState(() => createWeigh({ random }));
  const game = useRef(first);
  const [ui, setUi] = useState(() => snap(first));
  const [cheer, setCheer] = useState(0);
  const later = useLater();

  const handle = (s) => {
    for (const e of s.events.splice(0)) {
      if (e.type === 'right') {
        sounds.playCoin();
        [659, 784, 1047, 1319].forEach((f, i) => sounds.playNote(f, { duration: 0.2, delay: 0.45 + i * 0.08, volume: 0.18 }));
      } else if (e.type === 'wrong') {
        sounds.playWhoosh();
        later(() => sounds.playOops(), 480);
      } else if (e.type === 'land') {
        sounds.playNote(98, { duration: 0.25, volume: 0.35 });
        sounds.playPop();
        setCheer((c) => c + 1);
      } else if (e.type === 'pick') {
        sounds.playNote([523, 659, 784][e.n - 1] || 784, { duration: 0.16, volume: 0.22 });
      } else if (e.type === 'unpick') {
        sounds.playNote(392, { duration: 0.12, volume: 0.16 });
      } else if (e.type === 'round') {
        sounds.playPop();
      } else if (e.type === 'end') {
        later(() => setPhase('done'), 300);
      }
    }
  };

  useLoop((dt) => {
    const s = game.current;
    stepWeigh(s, dt);
    handle(s);
    setUi(snap(s));
  }, phase === 'play');

  const tap = (dex) => {
    if (phase !== 'play') return;
    const s = game.current;
    choose(s, dex);
    handle(s);
    setUi(snap(s));
  };

  const skip = () => {
    const s = game.current;
    if (phase !== 'play' || s.phase !== 'reveal' || s.reveal < 0.9) return;
    nextRound(s);
    handle(s);
    setUi(snap(s));
  };

  useEffect(() => {
    const onKey = (e) => {
      if (phase !== 'play') return;
      const s = game.current;
      const r = current(s);
      if (s.phase === 'reveal' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        skip();
        return;
      }
      const i = { Digit1: 0, Digit2: 1, Digit3: 2, ArrowLeft: 0, ArrowRight: r.dex.length - 1, ArrowUp: 1 }[e.code];
      if (i != null && r.dex[i] != null && (e.code !== 'ArrowUp' || r.dex.length === 3)) {
        e.preventDefault();
        tap(r.dex[i]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const replay = () => {
    game.current = createWeigh({ random });
    setUi(snap(game.current));
    setPhase('ready');
  };

  const r = { mode: ui.mode, dex: ui.dex };
  const order = ui.mode === 'order';
  const revealing = ui.step === 'reveal';
  const k = revealing ? Math.min(1, ui.reveal / DROP) : 0;
  const landed = revealing && k >= 1;
  const answer = answerOf(r);
  const ok = revealing ? ui.results[ui.results.length - 1] : null;
  const angle = order ? 0 : ui.springs[0] || 0;
  const panAt = pans(angle);
  const xs = order ? TRIO_X : PAIR_X;
  const size = order ? 88 : 104;
  const list = ui.dex.map((d) => pokemon(d));
  const heavy = [...list].sort((a, b) => b.kg - a.kg)[0];
  const light = [...list].sort((a, b) => a.kg - b.kg)[0];
  const fact = order ? `Nhẹ nhất: ${light.name} · Nặng nhất: ${heavy.name}` : `${heavy.name} nặng gấp ${fmtTimes(heavy.kg / light.kg)} lần ${light.name}!`;
  const rankOf = (dex) => (order ? answer.indexOf(dex) : -1);

  // Where each Pokemon is: in its bubble, falling, or sitting on its pan / dial
  const placeOf = (i) => {
    const from = { x: xs[i], y: BUBBLE_Y };
    const to = order ? { x: TRIO_X[i], y: DIAL_Y - 20 - size * 0.4 } : { x: panAt[i].x, y: panAt[i].y - size * 0.42 };
    if (!revealing) return from;
    return { x: from.x + (to.x - from.x) * easeOut(k), y: from.y + (to.y - from.y) * bounce(k) };
  };

  return (
    <CarnivalShell
      title="⚖️ Đoán cân nặng"
      label="Đoán cân nặng Snorlax"
      onClose={onClose}
      background="bg-gradient-to-b from-violet-600 via-fuchsia-700 to-rose-800"
      dataAttrs={{ 'data-phase': phase, 'data-round': ui.round, 'data-correct': ui.correct, 'data-mode': ui.mode, 'data-step': ui.step, 'data-score': ui.correct }}
      hud={
        <>
          <HudBar
            items={[
              { icon: '✅', label: 'Đúng', value: `${ui.correct}/${ROUNDS}`, testId: 'weigh-score' },
              { icon: '🎯', label: 'Câu', value: `${Math.min(ROUNDS, ui.round + 1)}/${ROUNDS}` },
            ]}
          />
          <div className="mt-1 flex justify-center gap-1.5" aria-hidden="true">
            {Array.from({ length: ROUNDS }, (_, i) => {
              const res = ui.results[i];
              return (
                <span
                  key={i}
                  className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black shadow ${res === true ? 'bg-emerald-400 text-white pop-in' : res === false ? 'bg-rose-400 text-white pop-in' : i === ui.round ? 'bg-yellow-300 text-amber-800 hint-pulse' : 'bg-white/25 text-white/70'}`}
                >
                  {res === true ? '✓' : res === false ? '✗' : i + 1}
                </span>
              );
            })}
          </div>
        </>
      }
    >
      <div className="relative flex-1 min-h-0 flex flex-col items-center px-3 pt-1 pb-1 overflow-hidden">
        {/* Spotlight glow behind the scale */}
        <div className="absolute inset-x-0 top-10 h-72 bg-[radial-gradient(ellipse_at_center,rgba(254,240,138,0.35),transparent_65%)] pointer-events-none" aria-hidden="true" />
        {/* Question board */}
        <div key={`q${ui.round}`} className="weigh-board relative z-10 w-full max-w-[340px] rounded-2xl border-4 border-amber-300 bg-gradient-to-b from-amber-50 to-amber-200 px-3 py-1.5 text-center shadow-xl" data-testid="weigh-question">
          <p className="text-[11px] font-black uppercase tracking-wider text-rose-500">Câu {Math.min(ROUNDS, ui.round + 1)} {order ? '· Chạm lần lượt' : ''}</p>
          <p className="text-2xl font-black text-slate-800 leading-tight">
            {order ? (
              <>
                Xếp từ <span className="text-sky-600">nhẹ</span> đến <span className="text-rose-600">nặng</span>
              </>
            ) : ui.mode === 'heavy' ? (
              <>
                Bạn nào <span className="text-rose-600">nặng hơn</span>?
              </>
            ) : (
              <>
                Bạn nào <span className="text-sky-600">nhẹ hơn</span>?
              </>
            )}
          </p>
          <span className="sr-only">{QUESTION[ui.mode]}</span>
        </div>

        {/* Stage */}
        {/* The stage keeps its shape and fits both the width and the height left */}
        <div className="relative z-10 flex-1 min-h-0 w-full flex items-center justify-center [container-type:size]">
        <div className="relative w-[min(100cqw,90cqh)] max-w-[360px]" style={{ aspectRatio: `${VW} / ${VH}` }} data-testid="weigh-stage">
          {order ? <Dials values={revealing ? ui.springs : []} /> : <Scale angle={angle} glow={landed && !order ? ui.dex.indexOf(ui.choice) : -1} />}
          {ui.dex.map((dex, i) => {
            const p = pokemon(dex);
            const at = placeOf(i);
            const pickN = ui.picks.indexOf(dex);
            const chosen = order ? pickN >= 0 : ui.choice === dex;
            const rank = rankOf(dex);
            const rightOne = order ? ui.picks[rank] === dex : dex === answer;
            return (
              <div key={`${ui.round}-${dex}`} className="absolute z-10" style={{ ...pct(at.x, at.y), width: `${(size / VW) * 100}%`, transform: 'translate(-50%, -50%)' }}>
                <button
                  type="button"
                  onClick={() => tap(dex)}
                  disabled={revealing}
                  aria-label={p.name}
                  data-testid={`weigh-pick-${dex}`}
                  data-dex={dex}
                  className={`group relative block w-full aspect-square ${revealing ? '' : 'weigh-float cursor-pointer'}`}
                  style={{ animationDelay: `${i * 0.35}s` }}
                >
                  {/* Soap bubble while waiting */}
                  {!revealing && (
                    <span className={`absolute -inset-1 rounded-full border-4 shadow-[inset_0_0_18px_rgba(255,255,255,0.6),0_6px_14px_rgba(0,0,0,0.25)] transition-transform group-active:scale-90 ${chosen ? 'border-yellow-300 bg-yellow-200/40' : 'border-white/70 bg-white/20'}`}>
                      <span className="absolute left-[18%] top-[12%] w-[22%] h-[12%] rounded-full bg-white/70 rotate-[-30deg]" />
                    </span>
                  )}
                  <span key={landed ? 'land' : 'fly'} className={`relative block w-full h-full ${landed ? 'weigh-squash' : ''}`}>
                    <img src={artworkUrl(dex)} alt="" className="w-full h-full object-contain drop-shadow-[0_6px_6px_rgba(0,0,0,0.4)]" draggable={false} />
                  </span>
                  {!revealing && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900/70 px-2 py-0.5 text-[11px] font-black text-white">{p.name}</span>}
                  {order && pickN >= 0 && (
                    <span key={`n${pickN}`} className="pop-in absolute -top-1 -right-1 w-8 h-8 rounded-full bg-yellow-300 border-2 border-amber-700 text-lg font-black text-amber-900 flex items-center justify-center shadow-lg">
                      {pickN + 1}
                    </span>
                  )}
                </button>
                {/* Weight tag after the landing (on the pan; order rounds show it under the dial) */}
                {landed && !order && (
                  <div className="absolute left-1/2 top-full -translate-x-1/2 mt-0.5 flex flex-col items-center" style={{ minWidth: '100%' }}>
                    <span className="weigh-tag whitespace-nowrap rounded-xl border-2 border-amber-700 bg-white px-2 py-0.5 text-base font-black text-slate-800 shadow-lg" data-testid={`weigh-kg-${dex}`}>
                      {fmtKg(p.kg)}
                    </span>
                  </div>
                )}
                {landed && chosen && !order && (
                  <span className={`weigh-mark absolute -top-2 -right-1 w-9 h-9 rounded-full border-2 text-xl font-black flex items-center justify-center shadow-lg ${rightOne ? 'bg-emerald-400 border-emerald-800 text-white' : 'bg-rose-400 border-rose-800 text-white'}`}>{rightOne ? '✓' : '✗'}</span>
                )}
                {landed && order && (
                  <span className={`weigh-mark absolute -top-2 -right-1 w-9 h-9 rounded-full border-2 text-lg font-black flex items-center justify-center shadow-lg ${rightOne ? 'bg-emerald-400 border-emerald-800 text-white' : 'bg-amber-300 border-amber-800 text-amber-900'}`}>{rank + 1}</span>
                )}
              </div>
            );
          })}
          {landed &&
            order &&
            ui.dex.map((dex, i) => (
              <div key={`t${ui.round}-${dex}`} className="absolute z-10" style={{ ...pct(TRIO_X[i], DIAL_Y + 100), transform: 'translate(-50%, -50%)' }}>
                <span className="weigh-tag block whitespace-nowrap rounded-xl border-2 border-amber-700 bg-white px-2 py-0.5 text-base font-black text-slate-800 shadow-lg" data-testid={`weigh-kg-${dex}`}>
                  {fmtKg(pokemon(dex).kg)}
                </span>
              </div>
            ))}
          {/* The bubbles pop when the answer is given */}
          {revealing && ui.reveal < 0.5 && xs.map((x, i) => <Burst key={`b${ui.round}-${i}`} x={x} y={BUBBLE_Y} color="#e0f2fe" count={8} />)}
          {landed && ok && <Burst key={`w${ui.round}`} x={PIVOT.x} y={order ? 220 : PIVOT.y} count={16} big />}
          {/* Hint before answering */}
          {!revealing && phase === 'play' && order && ui.picks.length === 0 && <p className="absolute left-1/2 top-[44%] -translate-x-1/2 whitespace-nowrap rounded-full bg-black/40 px-3 py-1 text-sm font-black text-white hint-pulse pointer-events-none">Chạm bạn nhẹ nhất trước nhé! 👆</p>}
        </div>
        </div>

        {/* Hosts round the result line: the child's Pokemon and a sleepy Snorlax */}
        <div className="relative z-10 w-full max-w-[360px] min-h-[84px] flex items-end gap-1">
          <img key={`p${cheer}`} src={player.image} alt={player.name} className={`shrink-0 w-14 h-14 object-contain drop-shadow-lg ${cheer && ok ? 'poke-hop' : 'sport-bob'}`} />
          <div className="flex-1 min-w-0 self-stretch flex flex-col items-center justify-center gap-1">
            {landed && (
              <div key={`r${ui.round}`} className="weigh-result flex flex-col items-center" data-testid="weigh-feedback" data-ok={ok ? 'yes' : 'no'}>
                <p className={`text-xl font-black drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)] ${ok ? 'text-yellow-300' : 'text-white'}`}>{ok ? 'Đúng rồi! 🎉' : 'Ồ, chưa đúng rồi! 😊'}</p>
                <p className="text-sm font-bold leading-tight text-white/90 text-center">{fact}</p>
              </div>
            )}
            {landed && ui.reveal > 0.9 && (
              <button type="button" onClick={skip} className="relative overflow-hidden rounded-2xl bg-white/90 px-4 py-1 text-sm font-black text-fuchsia-700 shadow-lg active:scale-95" data-testid="weigh-next">
                {ui.round + 1 >= ROUNDS ? 'Xong ➜' : 'Tiếp ➜'}
                <span className="absolute left-2 right-2 bottom-0.5 h-0.5 rounded bg-fuchsia-300 origin-left" style={{ transform: `scaleX(${Math.min(1, ui.reveal / REVEAL_TIME)})` }} />
              </button>
            )}
          </div>
          <span className="relative shrink-0" aria-hidden="true">
            <img key={`s${cheer}`} src={artworkUrl(SNORLAX)} alt="" className={`w-16 h-16 object-contain drop-shadow-lg ${cheer && ok ? 'poke-hop' : 'weigh-snore'}`} />
            {!(landed && ok) && <span className="weigh-zzz absolute -top-2 right-0 text-sm font-black text-sky-100">Zzz</span>}
          </span>
        </div>

        {phase === 'ready' && <Countdown onDone={() => setPhase('play')} />}
        {phase === 'done' && (
          <CarnivalResult
            title={ui.stars === 3 ? 'Chuyên gia cân nặng! 🏆' : ui.correct >= 6 ? 'Giỏi quá! ⚖️' : 'Cố lên lần sau nhé! 💪'}
            stars={ui.stars}
            detail={`Đoán đúng ${ui.correct}/${ROUNDS} câu`}
            onReplay={replay}
            onClose={onClose}
            onGold={onGold}
          />
        )}
      </div>
    </CarnivalShell>
  );
}
