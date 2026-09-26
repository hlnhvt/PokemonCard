import React, { useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Lightbulb } from 'lucide-react';
import { VIEW, HORIZON, LEVELS, CHANGE_TEXT, createSpot, tapAt, giveHint as hintOf, nextLevel, spotStars } from '../../utils/logic/spot';
import { goldForStars } from '../../utils/gold';
import { sounds } from '../../utils/soundEffects';
import { KidGameShell, SessionSummary, StarRow } from '../kidgames/Common';

const darker = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.round(v * 0.72));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

/** One thing in the meadow, drawn around (0, 0) with its size. */
function Thing({ o }) {
  const s = o.size;
  const c = o.color;
  let body;
  switch (o.kind) {
    case 'sun':
      body = (
        <g>
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={i} x1="0" y1="0" x2={Math.cos((i * Math.PI) / 4) * s * 0.85} y2={Math.sin((i * Math.PI) / 4) * s * 0.85} stroke={c} strokeWidth="2.5" strokeLinecap="round" />
          ))}
          <circle r={s * 0.5} fill={c} stroke={darker(c)} strokeWidth="1" />
          <circle cx={-s * 0.15} cy={-s * 0.05} r="1.6" fill="#78350f" />
          <circle cx={s * 0.15} cy={-s * 0.05} r="1.6" fill="#78350f" />
          <path d={`M${-s * 0.18} ${s * 0.12} Q0 ${s * 0.28} ${s * 0.18} ${s * 0.12}`} stroke="#78350f" strokeWidth="1.3" fill="none" />
        </g>
      );
      break;
    case 'cloud':
      body = (
        <g fill={c} stroke="#cbd5e1" strokeWidth="0.8">
          <ellipse cx={-s * 0.35} cy={s * 0.08} rx={s * 0.38} ry={s * 0.26} />
          <ellipse cx={s * 0.35} cy={s * 0.08} rx={s * 0.38} ry={s * 0.26} />
          <ellipse cx="0" cy={-s * 0.1} rx={s * 0.42} ry={s * 0.34} />
        </g>
      );
      break;
    case 'star': {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 ? s * 0.25 : s * 0.6;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        return `${Math.cos(a) * r},${Math.sin(a) * r}`;
      }).join(' ');
      body = <polygon points={pts} fill={c} stroke={darker(c)} strokeWidth="1" />;
      break;
    }
    case 'butterfly':
      body = (
        <g>
          <ellipse cx={-s * 0.35} cy={-s * 0.15} rx={s * 0.38} ry={s * 0.3} fill={c} stroke={darker(c)} strokeWidth="0.8" />
          <ellipse cx={-s * 0.28} cy={s * 0.25} rx={s * 0.25} ry={s * 0.2} fill={c} stroke={darker(c)} strokeWidth="0.8" />
          <ellipse cx={s * 0.3} cy={-s * 0.1} rx={s * 0.22} ry={s * 0.2} fill="#fef08a" stroke={darker(c)} strokeWidth="0.8" />
          <rect x={-1.2} y={-s * 0.4} width="2.4" height={s * 0.8} rx="1.2" fill="#1f2937" />
        </g>
      );
      break;
    case 'tree':
      body = (
        <g>
          <rect x={-s * 0.1} y={s * 0.05} width={s * 0.2} height={s * 0.5} fill="#92400e" />
          <circle cx="0" cy={-s * 0.15} r={s * 0.42} fill={c} stroke={darker(c)} strokeWidth="1" />
          <circle cx={-s * 0.28} cy={s * 0.02} r={s * 0.26} fill={c} />
          <circle cx={s * 0.28} cy={s * 0.02} r={s * 0.26} fill={c} />
          <circle cx={-s * 0.12} cy={-s * 0.3} r={s * 0.1} fill="rgba(255,255,255,0.35)" />
        </g>
      );
      break;
    case 'flower':
      body = (
        <g>
          <line x1="0" y1="0" x2="0" y2={s * 0.9} stroke="#15803d" strokeWidth="1.6" />
          {Array.from({ length: 5 }).map((_, i) => (
            <circle key={i} cx={Math.cos((i * 2 * Math.PI) / 5) * s * 0.3} cy={Math.sin((i * 2 * Math.PI) / 5) * s * 0.3} r={s * 0.24} fill={c} />
          ))}
          <circle r={s * 0.18} fill="#fde047" />
        </g>
      );
      break;
    case 'pokeball':
      body = (
        <g>
          <circle r={s * 0.5} fill="#f8fafc" stroke="#1f2937" strokeWidth="1.2" />
          <path d={`M${-s * 0.5} 0 A${s * 0.5} ${s * 0.5} 0 0 1 ${s * 0.5} 0 Z`} fill={c} stroke="#1f2937" strokeWidth="1.2" />
          <line x1={-s * 0.5} y1="0" x2={s * 0.5} y2="0" stroke="#1f2937" strokeWidth="1.6" />
          <circle r={s * 0.16} fill="#f8fafc" stroke="#1f2937" strokeWidth="1.2" />
        </g>
      );
      break;
    case 'berry':
      body = (
        <g>
          <circle r={s * 0.45} fill={c} stroke={darker(c)} strokeWidth="1" />
          <ellipse cx={s * 0.1} cy={-s * 0.5} rx={s * 0.25} ry={s * 0.12} fill="#22c55e" transform={`rotate(-25 ${s * 0.1} ${-s * 0.5})`} />
          <circle cx={-s * 0.15} cy={-s * 0.15} r={s * 0.1} fill="rgba(255,255,255,0.6)" />
        </g>
      );
      break;
    case 'rock':
      body = <polygon points={`${-s * 0.55},${s * 0.3} ${-s * 0.4},${-s * 0.2} ${-s * 0.05},${-s * 0.4} ${s * 0.4},${-s * 0.25} ${s * 0.55},${s * 0.3}`} fill={c} stroke={darker(c)} strokeWidth="1" />;
      break;
    case 'mushroom':
      body = (
        <g>
          <rect x={-s * 0.14} y="0" width={s * 0.28} height={s * 0.45} rx="2" fill="#fef3c7" stroke="#d6d3d1" strokeWidth="0.8" />
          <path d={`M${-s * 0.55} ${s * 0.05} Q${-s * 0.45} ${-s * 0.55} ${s * 0.15} ${-s * 0.5} Q${s * 0.6} ${-s * 0.35} ${s * 0.5} ${s * 0.05} Z`} fill={c} stroke={darker(c)} strokeWidth="1" />
          <circle cx={-s * 0.2} cy={-s * 0.2} r={s * 0.08} fill="#fff" />
          <circle cx={s * 0.15} cy={-s * 0.28} r={s * 0.06} fill="#fff" />
        </g>
      );
      break;
    case 'house':
      body = (
        <g>
          <rect x={-s * 0.4} y={-s * 0.1} width={s * 0.8} height={s * 0.55} fill="#fef3c7" stroke="#a16207" strokeWidth="1" />
          <polygon points={`${-s * 0.52},${-s * 0.08} 0,${-s * 0.55} ${s * 0.52},${-s * 0.08}`} fill={c} stroke={darker(c)} strokeWidth="1" />
          <rect x={s * 0.2} y={-s * 0.5} width={s * 0.12} height={s * 0.22} fill="#78716c" />
          <rect x={-s * 0.1} y={s * 0.15} width={s * 0.2} height={s * 0.3} fill="#92400e" />
          <rect x={-s * 0.32} y={s * 0.02} width={s * 0.15} height={s * 0.13} fill="#7dd3fc" stroke="#a16207" strokeWidth="0.6" />
        </g>
      );
      break;
    default:
      body = <circle r={s * 0.4} fill={c} />;
  }
  return <g transform={`translate(${o.x} ${o.y}) scale(${o.flip ? -1 : 1} 1)`}>{body}</g>;
}

/** One picture: sky, hills, meadow, the things, and the child's Pokemon in the middle. */
function Picture({ objects, mascot, label, found, diffs, hint, misses, onTap, testId }) {
  const svgRef = useRef(null);
  const tap = (e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect?.width) return;
    onTap(((e.clientX - rect.left) / rect.width) * VIEW.w, ((e.clientY - rect.top) / rect.height) * VIEW.h);
  };
  return (
    <div className="relative">
      <span className="absolute left-2 top-2 z-10 px-2 py-0.5 rounded-full bg-white/85 text-[11px] font-black text-slate-700 shadow pointer-events-none">{label}</span>
      <svg ref={svgRef} viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="w-full h-auto rounded-2xl border-4 border-white shadow-xl touch-none cursor-pointer" onPointerDown={tap} data-testid={testId} role="img" aria-label={label}>
        <defs>
          <linearGradient id={`sky-${testId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7dd3fc" />
            <stop offset="1" stopColor="#e0f2fe" />
          </linearGradient>
          <linearGradient id={`grass-${testId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#86efac" />
            <stop offset="1" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        <rect width={VIEW.w} height={HORIZON + 6} fill={`url(#sky-${testId})`} />
        <path d={`M0 ${HORIZON} Q80 ${HORIZON - 26} 160 ${HORIZON - 4} T320 ${HORIZON - 10} V${HORIZON + 10} H0 Z`} fill="#4ade80" />
        <rect y={HORIZON} width={VIEW.w} height={VIEW.h - HORIZON} fill={`url(#grass-${testId})`} />
        <path d={`M120 ${VIEW.h} Q150 ${HORIZON + 50} 165 ${HORIZON + 8} Q185 ${HORIZON + 50} 215 ${VIEW.h} Z`} fill="#fde68a" opacity="0.7" />
        {objects.map((o) => (
          <Thing key={o.id} o={o} />
        ))}
        <image href={mascot} x={140} y={148} width={40} height={40} preserveAspectRatio="xMidYMid meet" />
        {/* Found: a circle drawn round it, with sparkles */}
        {diffs
          .filter((d) => found.includes(d.id))
          .map((d) => (
            <g key={d.id}>
              <circle className="spot-ring" cx={d.x} cy={d.y} r={d.r} fill="none" stroke="#facc15" strokeWidth="3.5" />
              <circle cx={d.x} cy={d.y} r={d.r} fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.8" />
              {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], i) => (
                <text key={i} className="spot-sparkle" x={d.x} y={d.y} fontSize="10" textAnchor="middle" style={{ '--dx': `${sx * 16}px`, '--dy': `${sy * 16}px` }}>
                  ✨
                </text>
              ))}
            </g>
          ))}
        {hint != null && (() => {
          const d = diffs.find((q) => q.id === hint);
          return d ? <circle className="spot-hint" cx={d.x} cy={d.y} r={d.r + 4} fill="rgba(253,224,71,0.25)" stroke="#fde047" strokeWidth="3" strokeDasharray="6 4" /> : null;
        })()}
        {misses.map((m) => (
          <text key={m.id} className="spot-miss" x={m.x} y={m.y + 6} fontSize="20" fontWeight="900" fill="#ef4444" textAnchor="middle" stroke="#fff" strokeWidth="1">
            ✕
          </text>
        ))}
      </svg>
    </div>
  );
}

/**
 * "Tìm điểm khác nhau": two pictures of a Pokemon meadow, the second with a few changes.
 * Tap a difference on either picture to circle it on both. 5 levels, more things and more
 * differences each time; a hint lights one up (costs a bit of the stars).
 */
export function SpotGame({ player, onClose, onGold, random = Math.random }) {
  const [s, setS] = useState(() => createSpot({ random }));
  const [pop, setPop] = useState(null);
  const paid = useRef(false);
  const level = LEVELS[s.level];
  const recentMisses = s.misses.slice(-3);

  const tap = (x, y) => {
    const out = tapAt(s, x, y);
    if (out.result === 'ignored' || out.result === 'again') return;
    setS(out.state);
    if (out.result === 'found') {
      sounds.playCoin();
      setPop({ id: Date.now(), text: CHANGE_TEXT[out.diff.change] });
      if (out.state.status !== 'play') {
        sounds.playSuccessFanfare();
        try {
          confetti({ particleCount: out.state.status === 'done' ? 160 : 80, spread: 80, origin: { y: 0.4 }, zIndex: 9999 });
        } catch {
          // decoration
        }
        if (out.state.status === 'done' && !paid.current) {
          paid.current = true;
          onGold?.(goldForStars(spotStars(out.state.stars)));
        }
      }
    } else sounds.playOops();
  };

  const hint = () => {
    if (s.hint != null) return;
    sounds.playPop();
    setS(hintOf(s));
  };

  const replay = () => {
    paid.current = false;
    setS(createSpot({ random }));
  };

  const stars = spotStars(s.stars);

  return (
    <KidGameShell
      title="🔎 Tìm điểm khác nhau"
      label="Tìm điểm khác nhau"
      round={s.status === 'done' ? LEVELS.length : s.level}
      rounds={LEVELS.length}
      onClose={onClose}
      background="bg-gradient-to-b from-emerald-200 via-sky-100 to-amber-100"
      dataAttrs={{ 'data-status': s.status, 'data-level': s.level + 1, 'data-found': s.found.length }}
    >
      {s.status === 'done' ? (
        <SessionSummary title="Mắt tinh như đại bàng! 🦅" stars={stars} maxStars={3} gold={goldForStars(stars)} detail={`Tìm hết ${LEVELS.reduce((a, l) => a + l.diffs, 0)} điểm khác nhau qua ${LEVELS.length} màn`} onReplay={replay} onClose={onClose} />
      ) : (
        <div className="relative px-3 pt-3 pb-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-white/85 text-sm font-black text-emerald-700 shadow">Màn {s.level + 1}/{LEVELS.length}</span>
            <div className="flex gap-1" aria-label={`Đã tìm ${s.found.length}/${level.diffs}`} data-testid="spot-count">
              {Array.from({ length: level.diffs }).map((_, i) => (
                <span key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow transition-all ${i < s.found.length ? 'bg-amber-400 text-white scale-110' : 'bg-white/80 text-slate-300'}`}>
                  {i < s.found.length ? '★' : i + 1}
                </span>
              ))}
            </div>
            <button onClick={hint} disabled={s.hint != null || s.status !== 'play'} aria-label="Gợi ý" className="ml-auto px-3 py-1.5 rounded-full bg-amber-400 text-slate-900 text-sm font-black flex items-center gap-1 shadow active:scale-95 disabled:opacity-50">
              <Lightbulb className="w-4 h-4" /> Gợi ý
            </button>
          </div>
          <p className="text-center text-sm font-black text-slate-700">Hình dưới có {level.diffs} điểm khác hình trên. Chạm vào chỗ khác nhau nhé! 👀</p>

          <Picture objects={s.left} mascot={player.image} label="Hình gốc" found={s.found} diffs={s.diffs} hint={s.hint} misses={recentMisses} onTap={tap} testId="spot-left" />
          <Picture objects={s.right} mascot={player.image} label="Hình khác" found={s.found} diffs={s.diffs} hint={s.hint} misses={recentMisses} onTap={tap} testId="spot-right" />

          {pop && (
            <div key={pop.id} className="banner-slam absolute left-1/2 top-1/2 z-20 pointer-events-none whitespace-nowrap px-4 py-1.5 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-500 text-white text-xl font-black shadow-xl border-2 border-white">
              ✨ {pop.text}!
            </div>
          )}

          {s.status === 'levelDone' && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-6" data-testid="spot-level-done">
              <div className="pop-in w-full max-w-xs rounded-3xl bg-white p-5 text-center shadow-2xl">
                <p className="text-2xl font-black text-emerald-600">Mắt tinh quá! 👀</p>
                <div className="my-2 flex justify-center">
                  <StarRow stars={s.stars[s.stars.length - 1]} size="w-10 h-10" animate />
                </div>
                <p className="text-sm font-bold text-slate-600">Màn sau có nhiều đồ hơn và {LEVELS[s.level + 1].diffs} điểm khác nhau</p>
                <button onClick={() => setS(nextLevel(s))} className="mt-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-lg font-black shadow-lg active:scale-95">
                  Màn tiếp theo ➜
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </KidGameShell>
  );
}
