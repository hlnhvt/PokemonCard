import React, { useEffect, useId, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { BABIES, RARITY, EGG_STYLES, createHatch, tapHatch, crackStage, recordHatch, loadCollection, collectionProgress, createShakeDetector, shakeHit } from '../../utils/carnival/eggs';
import { getTickets, spendTicket } from '../../utils/carnival/tickets';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { BookOpen, Sparkles, X } from '../icons/PokeIcons';
import { GoldReward } from '../kidgames/Common';
import { useLater } from '../sports/sportsKit';
import { CarnivalShell, Ticket } from './CarnivalCommon';

// ---------- Egg drawing (viewBox 0 0 100 130) ----------
const EGG_PATH = 'M50 3C77 3 96 52 96 82C96 110 76 127 50 127C24 127 4 110 4 82C4 52 23 3 50 3Z';
// Crack lines, one per step; the last two make the zigzag the shell breaks along
const CRACKS = ['M34 30L40 40L35 47L42 55', 'M66 36L60 45L67 51L61 60', 'M6 80L16 74L26 86L38 74L50 86', 'M50 86L62 74L74 86L86 74L96 80'];
const TOP_CLIP = 'M-20 -40H120V80L96 80L86 74L74 86L62 74L50 86L38 74L26 86L16 74L6 80L-20 80Z';
const BOTTOM_CLIP = 'M-20 80L6 80L16 74L26 86L38 74L50 86L62 74L74 86L86 74L96 80L120 80V160H-20Z';

const tri = (x, y, s, c, down = false) => <path key={`${x}-${y}`} d={`M${x} ${y}l${s / 2} ${down ? s * 0.86 : -s * 0.86}l${s / 2} ${down ? -s * 0.86 : s * 0.86}z`} fill={c} />;

function starPath(cx, cy, r) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }
  return `${d}Z`;
}

const ZIG = 'M0 62L12 54L24 62L36 54L48 62L60 54L72 62L84 54L100 62';

const PATTERNS = {
  // Togepi style: cream with red and blue triangles
  tri: {
    base: '#fffbeb',
    edge: '#b45309',
    spark: '#f87171',
    art: [tri(16, 52, 18, '#ef4444'), tri(56, 26, 15, '#ef4444', true), tri(38, 108, 20, '#ef4444'), tri(66, 76, 17, '#ef4444', true), tri(48, 70, 17, '#3b82f6'), tri(14, 84, 15, '#3b82f6', true), tri(70, 116, 15, '#3b82f6'), tri(30, 20, 13, '#3b82f6', true), tri(76, 52, 12, '#3b82f6')],
  },
  spots: {
    base: '#bbf7d0',
    edge: '#15803d',
    spark: '#86efac',
    art: [
      [30, 38, 9],
      [62, 24, 7],
      [72, 58, 12],
      [26, 78, 11],
      [56, 94, 8],
      [82, 96, 7],
      [40, 116, 9],
      [12, 58, 5],
      [50, 56, 5],
    ].map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#22c55e" stroke="#15803d" strokeWidth="1.2" />),
  },
  zigzag: {
    base: '#fbcfe8',
    edge: '#be185d',
    spark: '#f9a8d4',
    art: [
      <path key="band" d="M0 62L12 54L24 62L36 54L48 62L60 54L72 62L84 54L100 62V80L84 72L72 80L60 72L48 80L36 72L24 80L12 72L0 80Z" fill="#ffffff" />,
      <path key="l1" d={ZIG} fill="none" stroke="#ec4899" strokeWidth="3" strokeLinejoin="round" />,
      <path key="l2" d={ZIG} transform="translate(0 18)" fill="none" stroke="#ec4899" strokeWidth="3" strokeLinejoin="round" />,
      ...[
        [30, 30],
        [58, 22],
        [70, 40],
        [40, 44],
        [24, 100],
        [52, 108],
        [76, 100],
      ].map(([cx, cy]) => <circle key={`d${cx}-${cy}`} cx={cx} cy={cy} r="4" fill="#f472b6" />),
    ],
  },
  // Pichu style: yellow with an orange lightning band
  zap: {
    base: '#fde047',
    edge: '#a16207',
    spark: '#fef08a',
    art: [
      <path key="bolt" d="M-4 70L32 56L24 72L58 58L50 76L104 60V78L52 94L60 78L26 92L34 76L-4 88Z" fill="#fb923c" stroke="#c2410c" strokeWidth="1.5" strokeLinejoin="round" />,
      <path key="b1" d="M40 20l-6 12h6l-4 10 12-14h-7l5-8z" fill="#f97316" />,
      <path key="b2" d="M70 102l-5 9h5l-3 8 10-11h-6l4-6z" fill="#f97316" />,
      <path key="b3" d="M24 104l-4 7h4l-2 6 8-9h-5l3-4z" fill="#f97316" />,
    ],
  },
  stars: {
    base: '#ddd6fe',
    edge: '#6d28d9',
    spark: '#e9d5ff',
    art: [
      ...[
        [32, 34, 9],
        [66, 30, 7],
        [70, 68, 11],
        [28, 80, 10],
        [52, 108, 9],
        [82, 102, 6],
      ].map(([cx, cy, r]) => <path key={`${cx}-${cy}`} d={starPath(cx, cy, r)} fill="#a855f7" stroke="#7e22ce" strokeWidth="1" strokeLinejoin="round" />),
      ...[
        [50, 50],
        [18, 58],
        [44, 90],
        [80, 50],
        [30, 112],
      ].map(([cx, cy]) => <path key={`w${cx}-${cy}`} d={starPath(cx, cy, 3.5)} fill="#ffffff" />),
    ],
  },
  waves: {
    base: '#bae6fd',
    edge: '#0369a1',
    spark: '#7dd3fc',
    art: [
      ...[40, 72, 104].map((y) => <path key={y} d={`M-6 ${y}Q7 ${y - 10} 20 ${y}T45 ${y}T70 ${y}T95 ${y}T120 ${y}`} fill="none" stroke="#0ea5e9" strokeWidth="7" strokeLinecap="round" />),
      ...[
        [30, 22, 4],
        [62, 56, 3],
        [40, 88, 3.5],
        [72, 118, 3],
        [20, 56, 2.5],
      ].map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#ffffff" opacity="0.85" />),
    ],
  },
};

/** A decorated egg, cracked `stage` times; `part` draws only the top or bottom half of the shell. */
function EggArt({ style, stage = 0, part = 'whole', still = false, className = '' }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const P = PATTERNS[style] || PATTERNS.tri;
  return (
    <svg viewBox="0 0 100 130" className={className} overflow="visible" aria-hidden="true">
      <defs>
        <clipPath id={`${uid}e`}>
          <path d={EGG_PATH} />
        </clipPath>
        {part !== 'whole' && (
          <clipPath id={`${uid}p`}>
            <path d={part === 'top' ? TOP_CLIP : BOTTOM_CLIP} />
          </clipPath>
        )}
        <radialGradient id={`${uid}s`} cx="0.36" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.78" stopColor="#000" stopOpacity="0.06" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </radialGradient>
      </defs>
      <g clipPath={part !== 'whole' ? `url(#${uid}p)` : undefined}>
        <g clipPath={`url(#${uid}e)`}>
          <rect x="0" y="0" width="100" height="130" fill={P.base} />
          {P.art}
          <rect x="0" y="0" width="100" height="130" fill={`url(#${uid}s)`} />
        </g>
        <path d={EGG_PATH} fill="none" stroke={P.edge} strokeWidth="2.5" />
        <ellipse cx="34" cy="26" rx="8" ry="13" fill="#fff" opacity="0.5" transform="rotate(20 34 26)" />
        {CRACKS.slice(0, stage).map((d) => (
          <g key={d}>
            <path d={d} pathLength="1" className={still ? undefined : 'eggs-crack eggs-crack-glow'} opacity={still ? 0.8 : undefined} stroke="#fef08a" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d={d} pathLength="1" className={still ? undefined : 'eggs-crack'} stroke="#422006" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** A woven straw nest (drawn in front of the egg's bottom). */
function Nest({ className = '' }) {
  return (
    <svg viewBox="0 0 120 40" className={className} aria-hidden="true">
      <ellipse cx="60" cy="22" rx="56" ry="16" fill="#92400e" />
      <ellipse cx="60" cy="16" rx="52" ry="10" fill="#b45309" />
      {Array.from({ length: 11 }, (_, i) => (
        <path key={i} d={`M${10 + i * 9} ${14 + (i % 2) * 4}q6 ${8 + (i % 3) * 2} 14 ${4 - (i % 2) * 6}`} stroke={i % 2 ? '#fcd34d' : '#f59e0b'} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      ))}
      <path d="M8 20q52 22 104 0" stroke="#78350f" strokeWidth="2" fill="none" />
      <path d="M14 28q46 14 92 0" stroke="#fbbf24" strokeWidth="1.6" fill="none" opacity="0.8" />
    </svg>
  );
}

const WORDS = ['Cốc!', 'Rắc!', 'Cộp!', 'Tách!'];
let sparkId = 0;

/** Sparkles that fly out of the egg from (x, y) in % of the egg box. */
function makeSparks(n, x, y, color, spread = 60, big = false) {
  return Array.from({ length: n }, () => {
    const a = Math.random() * Math.PI * 2;
    const d = spread * (0.5 + Math.random() * 0.7);
    return { id: ++sparkId, kind: 'spark', x, y, dx: Math.cos(a) * d, dy: Math.sin(a) * d - (big ? 20 : 30), color: Math.random() < 0.4 ? '#fde047' : color, size: (big ? 14 : 9) + Math.random() * 8, delay: Math.random() * (big ? 160 : 60) };
  });
}

function SparkLayer({ sparks }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {sparks.map((s) =>
        s.kind === 'word' ? (
          <span key={s.id} className="eggs-word absolute font-black text-2xl text-white whitespace-nowrap" style={{ left: `${s.x}%`, top: `${s.y}%`, '--dx': `${s.dx}px` }}>
            {s.text}
          </span>
        ) : (
          <svg
            key={s.id}
            viewBox="-10 -10 20 20"
            className="eggs-spark absolute"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, marginLeft: -s.size / 2, marginTop: -s.size / 2, '--dx': `${s.dx}px`, '--dy': `${s.dy}px`, animationDelay: `${s.delay}ms` }}
          >
            <path d="M0 -10Q1.5 -1.5 10 0Q1.5 1.5 0 10Q-1.5 1.5 -10 0Q-1.5 -1.5 0 -10Z" fill={s.color} />
          </svg>
        ),
      )}
    </div>
  );
}

// Where sparkles leak out, for each crack (in % of the egg box)
const CRACK_SPOTS = [
  [38, 34],
  [64, 38],
  [28, 62],
  [72, 62],
];

function BabyImage({ baby, className = '', style }) {
  return <img src={artworkUrl(baby.dex, baby.shiny)} alt={baby.name} className={`object-contain ${className}`} style={style} draggable="false" />;
}

function RevealCard({ baby, outcome, tickets, progress, onAgain, onAlbum, onClose }) {
  const rare = baby.rarity === 'rare';
  const title = outcome.isNew ? `Chào bé ${baby.name}!` : baby.shiny ? `${baby.name} lấp lánh!` : `Lại là ${baby.name}!`;
  const sub = outcome.isNew ? 'Pokémon mới! Đã dán vào Bộ sưu tập trứng 📖' : baby.shiny ? 'Một bạn lấp lánh hiếm lắm đó! ✨' : 'Bé đã có bạn này rồi – đổi thành vàng nhé!';
  const card = (
    <div className={`relative w-full rounded-3xl px-5 pt-5 pb-5 text-center shadow-2xl ${baby.shiny ? 'bg-gradient-to-b from-yellow-50 via-amber-50 to-amber-100' : outcome.isNew ? 'bg-gradient-to-b from-white to-emerald-50' : 'bg-gradient-to-b from-white to-amber-50'}`}>
      {outcome.isNew && (
        <span className="eggs-stamp absolute -top-3 -right-2 px-3 py-1 rounded-full bg-rose-500 text-white text-sm font-black shadow-lg border-2 border-white" data-testid="eggs-new">
          MỚI!
        </span>
      )}
      <div className="relative mx-auto w-40 h-40">
        <div className={`eggs-rays absolute left-1/2 top-1/2 w-72 h-72 -ml-36 -mt-36 rounded-full pointer-events-none ${baby.shiny ? 'eggs-rays-gold' : ''}`} aria-hidden="true" />
        <BabyImage baby={baby} className="eggs-card-bounce relative w-40 h-40 drop-shadow-[0_8px_10px_rgba(0,0,0,0.3)]" />
        {baby.shiny &&
          [
            [4, 10],
            [86, 4],
            [92, 70],
            [2, 76],
            [48, -6],
          ].map(([l, t], i) => (
            <Sparkles key={i} className="shiny-twinkle absolute w-6 h-6 text-yellow-400" style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${i * 0.25}s` }} />
          ))}
      </div>
      <div className="mt-1 flex justify-center gap-1.5">
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${rare ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-700'}`} data-testid="eggs-rarity">
          {rare ? '💎 ' : ''}
          {RARITY[baby.rarity].label}
        </span>
        {baby.shiny && <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-yellow-300 to-amber-500 text-amber-900">✨ Shiny ✨</span>}
      </div>
      <p className="mt-2 text-2xl font-black text-slate-800 leading-tight">{title}</p>
      <p className="mt-1 text-sm font-bold text-slate-600">{sub}</p>
      <div className="mt-3 flex justify-center">
        <GoldReward amount={outcome.gold} />
      </div>
      <p className="mt-2 text-xs font-bold text-slate-500">
        Bộ sưu tập: {progress.owned}/{progress.total}
        {progress.complete ? ' – Đủ bộ rồi! 🏆' : ''}
      </p>
      {tickets <= 0 && <p className="mt-2 text-sm font-black text-rose-600">Hết vé rồi! Chơi các trò khác trong Hội chợ để nhận thêm vé nhé 🎪</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={onAgain}
          disabled={tickets <= 0}
          className="col-span-2 py-3 rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 text-white text-lg font-black shadow-lg active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
          data-testid="eggs-again"
        >
          🥚 Ấp trứng nữa
          <span className="flex items-center gap-1 text-sm bg-black/20 rounded-full px-2 py-0.5">
            −1 <Ticket className="w-6 h-4" />
          </span>
        </button>
        <button onClick={onAlbum} className="py-2.5 rounded-2xl bg-violet-600 text-white text-base font-black shadow active:scale-95 flex items-center justify-center gap-1.5">
          <BookOpen className="w-5 h-5" /> Bộ sưu tập
        </button>
        <button onClick={onClose} className="py-2.5 rounded-2xl bg-sky-600 text-white text-base font-black shadow active:scale-95">
          Xong
        </button>
      </div>
    </div>
  );
  return (
    <div className="absolute inset-0 z-40 bg-black/55 overflow-y-auto overflow-x-hidden" data-testid="eggs-reveal" data-dex={baby.dex} data-new={outcome.isNew ? 'true' : 'false'} data-shiny={baby.shiny ? 'true' : 'false'}>
      <div className="min-h-full flex items-center justify-center px-5 py-4">
        <div className="eggs-card-in relative w-full max-w-[320px]">{baby.shiny ? <div className="eggs-shiny-border rounded-[28px] p-1.5">{card}</div> : card}</div>
      </div>
    </div>
  );
}

function Album({ collection, fresh, onClose }) {
  const progress = collectionProgress(collection);
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-gradient-to-b from-amber-100 to-orange-100" data-testid="eggs-album">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <BookOpen className="w-6 h-6 text-amber-700" />
        <p className="text-xl font-black text-amber-900">Bộ sưu tập trứng</p>
        <span className="ml-auto px-2.5 py-0.5 rounded-full bg-amber-600 text-white text-sm font-black" data-testid="eggs-album-progress">
          {progress.owned}/{progress.total}
        </span>
        <button onClick={onClose} aria-label="Đóng bộ sưu tập" className="p-1.5 rounded-full bg-white text-slate-700 shadow">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="mx-4 h-3 rounded-full bg-amber-200 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-400 transition-all duration-700" style={{ width: `${(progress.owned / progress.total) * 100}%` }} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        <div className="grid grid-cols-3 gap-2.5">
          {BABIES.map((b, i) => {
            const e = collection[b.dex];
            const owned = !!e;
            const rare = b.rarity === 'rare';
            return (
              <div
                key={b.dex}
                className={`eggs-sticker relative rounded-2xl p-1.5 text-center shadow-md border-[3px] ${owned ? (e.shiny ? 'eggs-sticker-shiny border-yellow-300 bg-gradient-to-b from-yellow-50 to-amber-100' : rare ? 'border-violet-300 bg-white' : 'border-white bg-white') : 'border-dashed border-amber-300 bg-amber-50/70'} ${fresh === b.dex ? 'eggs-sticker-new' : ''}`}
                style={{ animationDelay: fresh === b.dex ? '0ms' : `${i * 25}ms` }}
                data-testid={`eggs-sticker-${b.dex}`}
                data-owned={owned ? 'true' : 'false'}
                data-count={e?.count || 0}
                data-shiny={e?.shiny ? 'true' : 'false'}
              >
                <div className="relative mx-auto aspect-square w-full">
                  <img
                    src={artworkUrl(b.dex, !!e?.shiny)}
                    alt={owned ? b.name : 'Chưa nở'}
                    className="w-full h-full object-contain"
                    style={owned ? undefined : { filter: 'brightness(0)', opacity: 0.18 }}
                    draggable="false"
                    loading="lazy"
                  />
                  {!owned && <span className="absolute inset-0 flex items-center justify-center text-3xl font-black text-amber-400/80">?</span>}
                  {owned && e.count > 1 && <span className="absolute -top-1 -right-1 min-w-[26px] px-1 py-0.5 rounded-full bg-rose-500 text-white text-xs font-black shadow">×{e.count}</span>}
                  {e?.shiny && <Sparkles className="shiny-twinkle absolute -top-1 -left-1 w-5 h-5 text-yellow-500" />}
                </div>
                <p className={`mt-0.5 text-[11px] font-black truncate ${owned ? 'text-slate-700' : 'text-amber-400'}`}>{owned ? b.name : '???'}</p>
                {rare && <span className="absolute bottom-6 left-1 text-xs" title="Hiếm">💎</span>}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs font-bold text-amber-800/80">Ấp trứng để tìm đủ {progress.total} bé Pokémon! 💎 là bạn hiếm, ✨ là bạn lấp lánh.</p>
      </div>
    </div>
  );
}

// Idle wobble timing for each shelf egg, so they never move together
const WOBBLE = [
  [2.4, 0],
  [2.9, -0.7],
  [2.6, -1.4],
  [3.1, -0.3],
  [2.5, -1.9],
  [2.8, -1.1],
];

/**
 * "Xổ số trứng Pokémon": spend a carnival ticket to pick one of six decorated eggs, then tap it
 * (or shake the phone) until it cracks open and a baby Pokémon hatches into the sticker album.
 */
export function EggLotteryGame({ player, onClose, onGold, random = Math.random }) {
  const [tickets, setTickets] = useState(getTickets);
  const [collection, setCollection] = useState(loadCollection);
  const [phase, setPhase] = useState('shelf'); // shelf | hatch | burst | reveal
  const [hatch, setHatch] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [sparks, setSparks] = useState([]);
  const [nudge, setNudge] = useState(0);
  const [album, setAlbum] = useState(false);
  const [fresh, setFresh] = useState(null); // dex just added, for the album pop
  const [hatches, setHatches] = useState(0);
  const [motion, setMotion] = useState(false); // the phone reports motion: offer shaking
  const later = useLater();
  const shaker = useRef(createShakeDetector());
  const tapRef = useRef(null);

  const addSparks = (list, ms = 1000) => {
    setSparks((s) => [...s.slice(-40), ...list]);
    const ids = new Set(list.map((p) => p.id));
    later(() => setSparks((s) => s.filter((p) => !ids.has(p.id))), ms);
  };

  const pickEgg = (egg) => {
    if (phase !== 'shelf' || album) return;
    const left = spendTicket();
    if (left < 0) {
      setTickets(0);
      setNudge((n) => n + 1);
      sounds.playOops();
      return;
    }
    // iPhone asks before it shares motion; this runs in the tap, as it requires
    try {
      const ask = window.DeviceMotionEvent?.requestPermission;
      if (typeof ask === 'function') ask.call(window.DeviceMotionEvent).catch(() => {});
    } catch {
      // no motion: tapping works
    }
    setTickets(left);
    setHatch(createHatch({ random, egg }));
    setPhase('hatch');
    setSparks([]);
    sounds.playWhoosh();
  };

  const burst = (h) => {
    setPhase('burst');
    const res = recordHatch(h.baby);
    setCollection(res.collection);
    setOutcome(res);
    setFresh(res.isNew ? h.baby.dex : null);
    setHatches((n) => n + 1);
    onGold?.(res.gold);
    sounds.playEnergySurge();
    const P = PATTERNS[EGG_STYLES[h.egg]];
    addSparks([...makeSparks(22, 50, 58, P.spark, 150, true), ...makeSparks(10, 50, 58, '#ffffff', 110, true)], 1400);
    later(() => {
      setPhase('reveal');
      sounds.playCoin();
      sounds.playSuccessFanfare();
      if (res.isNew || h.baby.shiny) {
        const shots = h.baby.shiny ? 3 : 1;
        for (let k = 0; k < shots; k++) {
          later(() => {
            try {
              confetti({
                particleCount: h.baby.shiny ? 120 : 80,
                spread: 100,
                startVelocity: 42,
                origin: { x: shots > 1 ? 0.2 + k * 0.3 : 0.5, y: 0.4 },
                zIndex: 9999,
                colors: h.baby.shiny ? ['#facc15', '#fde047', '#fef9c3', '#ffffff', '#f59e0b'] : ['#facc15', '#f472b6', '#38bdf8', '#4ade80', '#ffffff'],
              });
            } catch {
              // decoration
            }
          }, k * 260);
        }
      }
    }, 1100);
  };

  const tap = () => {
    if (phase !== 'hatch' || !hatch) return;
    const before = crackStage(hatch);
    const h = tapHatch(hatch);
    setHatch(h);
    const st = crackStage(h);
    const P = PATTERNS[EGG_STYLES[h.egg]];
    if (h.hatched) {
      burst(h);
      return;
    }
    sounds.playNote(440 + h.taps * 70, { duration: 0.09, volume: 0.18 });
    if (st > before) sounds.playPop();
    const [x, y] = CRACK_SPOTS[Math.max(0, st - 1)];
    addSparks([...makeSparks(3 + st * 2, x, y, P.spark, 40 + st * 12), { id: ++sparkId, kind: 'word', text: WORDS[h.taps % WORDS.length], x: 50, y: 6, dx: (h.taps % 2 ? 1 : -1) * 30 }], 900);
  };

  useEffect(() => {
    tapRef.current = tap;
  });

  // Space / Enter taps the egg
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter') {
        if (phase === 'hatch') {
          e.preventDefault();
          tapRef.current?.();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  // Shaking the phone taps the egg too (when the phone has a motion sensor)
  useEffect(() => {
    const onMotion = (e) => {
      const a = e.acceleration && e.acceleration.x != null ? e.acceleration : null;
      const g = !a ? e.accelerationIncludingGravity : null;
      if (!a && !(g && g.x != null)) return;
      setMotion(true);
      if (phase === 'hatch' && shakeHit(shaker.current, a || g, performance.now() / 1000, { gravity: !a })) tapRef.current?.();
    };
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [phase]);

  const again = () => {
    setOutcome(null);
    setHatch(null);
    setSparks([]);
    setPhase('shelf');
    sounds.playPop();
  };

  const progress = collectionProgress(collection);
  const stage = hatch ? crackStage(hatch) : 0;
  const style = hatch ? EGG_STYLES[hatch.egg] : EGG_STYLES[0];
  const empty = tickets <= 0 && phase === 'shelf';

  return (
    <CarnivalShell
      tickets={tickets}
      title="🥚 Xổ số trứng Pokémon"
      label="Xổ số trứng Pokémon"
      onClose={onClose}
      background="bg-gradient-to-b from-sky-800 via-indigo-900 to-violet-950"
      dataAttrs={{
        'data-phase': phase,
        'data-tickets': tickets,
        'data-taps': hatch?.taps ?? 0,
        'data-need': hatch?.need ?? 0,
        'data-stage': stage,
        'data-hatches': hatches,
        'data-owned': progress.owned,
      }}
      hud={
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-2xl bg-black/35 px-3 py-1 text-white text-sm font-black">
            <Ticket className="w-7 h-5 shrink-0" />
            <span data-testid="eggs-tickets">Bé có {tickets} vé</span>
            <span className="text-white/60 truncate">· 1 vé 1 trứng</span>
          </div>
          <button
            onClick={() => setAlbum(true)}
            className="shrink-0 flex items-center gap-1 rounded-2xl bg-amber-300 px-2.5 py-1 text-amber-900 text-sm font-black shadow active:scale-95"
            data-testid="eggs-album-btn"
            aria-label="Bộ sưu tập trứng"
          >
            <BookOpen className="w-4 h-4" /> {progress.owned}/{progress.total}
          </button>
        </div>
      }
    >
      <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center gap-3 px-3 pb-4 overflow-hidden">
        {/* Floating soft lights */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {[8, 22, 40, 58, 74, 90].map((l, i) => (
            <span key={l} className="eggs-bokeh absolute bottom-0 rounded-full bg-amber-200/20" style={{ left: `${l}%`, width: 14 + (i % 3) * 10, height: 14 + (i % 3) * 10, animationDelay: `${-i * 1.3}s`, animationDuration: `${7 + (i % 3) * 2}s` }} />
          ))}
        </div>

        {phase === 'shelf' && (
          <>
            <div className="relative w-full max-w-[340px] rounded-[28px] bg-gradient-to-b from-amber-600 via-amber-700 to-amber-900 p-2.5 pt-8 shadow-[0_14px_30px_rgba(0,0,0,0.45)] border-4 border-amber-950/30 pop-in" data-testid="eggs-shelf">
              {/* Warm incubator lamp */}
              <div className="eggs-lamp absolute left-1/2 top-0 w-60 h-40 rounded-full pointer-events-none" style={{ marginLeft: -120 }} aria-hidden="true" />
              <div className="absolute left-1/2 top-1.5 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-black shadow whitespace-nowrap">🌟 Lò ấp trứng 🌟</div>
              {[0, 1].map((row) => (
                <div key={row} className="relative">
                  <div className="relative z-10 grid grid-cols-3 gap-1 rounded-2xl bg-amber-950/25 px-1 pt-3">
                    {[0, 1, 2].map((col) => {
                      const i = row * 3 + col;
                      const [dur, delay] = WOBBLE[i];
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => pickEgg(i)}
                          className={`eggs-pick relative flex flex-col items-center justify-end h-[118px] rounded-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300 ${tickets > 0 ? '' : 'opacity-80'}`}
                          aria-label={`Chọn quả trứng số ${i + 1}`}
                          data-testid={`eggs-egg-${i}`}
                        >
                          <span className="eggs-wobble relative z-10 block w-[62px]" style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s` }}>
                            <EggArt style={EGG_STYLES[i]} className="w-full h-auto drop-shadow-[0_4px_4px_rgba(0,0,0,0.3)]" />
                          </span>
                          <Nest className="relative z-20 -mt-5 w-[88px] h-7" />
                        </button>
                      );
                    })}
                  </div>
                  {/* Plank */}
                  <div className="relative z-20 -mt-1 mb-2 h-3.5 rounded-full bg-gradient-to-b from-amber-800 to-amber-950 shadow-[0_4px_0_rgba(0,0,0,0.25)]" />
                </div>
              ))}
              <img src={player.image} alt={player.name} className="absolute -right-3 -bottom-6 z-30 w-16 h-16 object-contain drop-shadow-xl pointer-events-none sport-bob" />
            </div>
            {empty ? (
              <p key={nudge} className={`w-full max-w-[320px] px-4 py-3 rounded-2xl bg-white/95 text-center text-sm font-black text-violet-800 shadow-lg ${nudge ? 'wrong-shake' : 'pop-in'}`} data-testid="eggs-empty">
                Bé chưa có vé 🎟️ Hãy chơi các trò khác trong Hội chợ để nhận vé rồi quay lại ấp trứng nhé! 🎪
              </p>
            ) : (
              <p className="px-4 py-2 rounded-2xl bg-black/30 text-center text-base font-black text-white">
                Chọn 1 quả trứng thật xinh! 🥚 <span className="text-amber-200">(−1 vé)</span>
              </p>
            )}
          </>
        )}

        {phase !== 'shelf' && hatch && (
          <>
            <p className="relative z-10 text-center text-lg font-black text-white drop-shadow min-h-[28px]">
              {phase === 'hatch' ? (stage >= 3 ? 'Sắp nở rồi! Gõ tiếp nào! 🤩' : stage >= 1 ? 'Trứng nứt rồi! Gõ nữa đi! 👏' : 'Gõ gõ vào trứng nhé! 👆') : 'Nở rồi!!! 🎉'}
            </p>
            <div className={`relative ${phase === 'burst' ? 'eggs-screen-shake' : ''}`} style={{ width: 'min(200px, 52vw)' }}>
              {/* Glow behind the egg grows with the cracks */}
              <div className="eggs-halo absolute left-1/2 top-1/2 rounded-full pointer-events-none" style={{ width: '170%', aspectRatio: '1', marginLeft: '-85%', marginTop: '-85%', opacity: phase === 'hatch' ? 0.25 + stage * 0.18 : 1 }} aria-hidden="true" />
              {phase === 'hatch' ? (
                <button
                  type="button"
                  onClick={tap}
                  className="eggs-zoom-in relative block w-full touch-manipulation focus:outline-none"
                  aria-label="Gõ vào trứng"
                  data-testid="eggs-hatch-egg"
                >
                  <span className={`block ${hatch.taps === 0 ? '' : hatch.taps % 2 ? 'eggs-hit-a' : 'eggs-hit-b'}`}>
                    <span className={`block ${stage >= 3 ? 'eggs-tremble' : stage >= 1 ? 'eggs-tremble-soft' : 'eggs-wobble'}`}>
                      <EggArt style={style} stage={stage} className="w-full h-auto drop-shadow-[0_10px_12px_rgba(0,0,0,0.45)]" />
                    </span>
                  </span>
                  {hatch.taps === 0 && <span className="eggs-point absolute -right-4 bottom-4 text-5xl pointer-events-none" aria-hidden="true">👆</span>}
                </button>
              ) : (
                <div className="relative w-full" style={{ aspectRatio: '100 / 130' }} data-testid="eggs-burst">
                  <div className="eggs-flash absolute left-1/2 top-1/2 rounded-full pointer-events-none" style={{ width: '220%', aspectRatio: '1', marginLeft: '-110%', marginTop: '-110%' }} aria-hidden="true" />
                  <BabyImage baby={hatch.baby} className="eggs-baby-rise absolute left-[5%] top-[8%] w-[90%] h-auto drop-shadow-[0_8px_10px_rgba(0,0,0,0.4)]" />
                  <div className="eggs-shell-bottom absolute inset-0">
                    <EggArt style={style} stage={CRACKS.length} part="bottom" still className="w-full h-auto" />
                  </div>
                  <div className="eggs-shell-top absolute inset-0">
                    <EggArt style={style} stage={CRACKS.length} part="top" still className="w-full h-auto" />
                  </div>
                </div>
              )}
              <SparkLayer sparks={sparks} />
            </div>
            {phase === 'hatch' && (
              <>
                <div className="flex items-center justify-center gap-1.5" data-testid="eggs-progress" aria-hidden="true">
                  {Array.from({ length: hatch.need }, (_, i) => (
                    <span key={i} className={`block w-4 h-5 rounded-[50%_50%_45%_45%/60%_60%_40%_40%] border-2 transition-all duration-200 ${i < hatch.taps ? 'bg-amber-300 border-amber-100 scale-110 shadow-[0_0_8px_#fde047]' : 'bg-white/15 border-white/40'}`} />
                  ))}
                </div>
                <p className="text-sm font-bold text-white/80 text-center">{motion ? 'Chạm liên tục hoặc lắc điện thoại để trứng nở! 📱' : 'Chạm liên tục vào trứng để trứng nở!'}</p>
              </>
            )}
            <img src={player.image} alt={player.name} className={`absolute right-3 bottom-4 w-16 h-16 object-contain drop-shadow-xl pointer-events-none ${phase === 'hatch' ? 'dance-bob' : 'poke-hop'}`} />
          </>
        )}

        {phase === 'reveal' && hatch && outcome && <RevealCard baby={hatch.baby} outcome={outcome} tickets={tickets} progress={progress} onAgain={again} onAlbum={() => setAlbum(true)} onClose={onClose} />}
        {album && <Album collection={collection} fresh={fresh} onClose={() => setAlbum(false)} />}
      </div>
    </CarnivalShell>
  );
}
