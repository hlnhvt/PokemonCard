import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X } from '../../icons/PokeIcons';
import { DT, DAY_LEN, INGREDIENTS, LAYOUT, createPizza3D, step, act, snap, suggest, playerBot, newShop, buy, shopItems, recipeById, speciesOf, speciesById, salaries, menuOf } from '../../../utils/three3d/pizza3d';
import { loadPizza3d, savePizza3d, resetPizza3d } from '../../../utils/three3d/pizza3dStore';
import { artworkUrl } from '../../../services/pokemonOnlineService';
import { sounds } from '../../../utils/soundEffects';
import { StarRow, GoldReward } from '../../kidgames/Common';
import { useLoop, useLater } from '../../sports/sportsKit';
import { createPizza3DScene } from './Pizza3DScene';

const MAX_POPS = 6;
const fmtTime = (t) => {
  const s = Math.ceil(Math.max(0, t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hudOf = (s) => ({ ...snap(s), tip: s.phase === 'done' ? null : suggest(s) });
const lookImage = (look) => (look?.image ? look.image : look?.dex ? artworkUrl(look.dex) : null);
const RESULT_TITLE = ['Ngày mai cố lên nhé!', 'Một ngày vui!', 'Khách rất thích!', 'Tiệm tuyệt vời nhất phố!'];
const QUALITY = { perfect: 'Hoàn hảo! ⭐', ok: 'Chín rồi!', raw: 'Hơi sống…', burnt: 'Cháy mất rồi!' };
const TABS = [
  { id: 'up', label: '🔧 Nâng cấp' },
  { id: 'staff', label: '👥 Nhân viên' },
  { id: 'menu', label: '📜 Thực đơn' },
];
const HINT_TEXT = {
  take: '👉 Có khách! Bấm “Nhận order”',
  add: (item) => `👉 Bấm ${INGREDIENTS[item]?.icon} ${INGREDIENTS[item]?.name}`,
  oven: '👉 Bánh đủ rồi, bấm “Vào lò” 🔥',
  out: '👉 Vòng xanh rồi! Bấm “Lấy ra” ngay',
  box: '👉 Bấm 📦 Đóng hộp',
  serve: '👉 Bấm 🛎️ Giao bánh cho khách',
  collect: '👉 Bấm 💰 Thu tiền',
  clean: '👉 Bàn bẩn rồi, bấm 🧽 Dọn bàn',
};

/** Big glossy round button with an emoji "3D" icon. */
function IngredientButton({ item, onClick, glow, disabled }) {
  const ing = INGREDIENTS[item];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ing.name}
      data-testid={`pizza3d-add-${item}`}
      className={`pizza3d-key relative flex flex-col items-center justify-center w-[3.6rem] h-[3.6rem] rounded-full shadow-lg active:scale-90 transition-transform ${glow ? 'ring-4 ring-amber-300 hint-pulse' : ''} ${disabled ? 'opacity-50' : ''}`}
      style={{ background: `radial-gradient(circle at 32% 28%, #ffffff 0%, ${ing.color} 46%, ${ing.color} 70%, rgba(0,0,0,0.25) 100%)` }}
    >
      <span className="text-[1.65rem] leading-none drop-shadow">{ing.icon}</span>
      <span className="absolute -bottom-1.5 px-1.5 rounded-full bg-white/95 text-[9px] font-black text-slate-700 whitespace-nowrap shadow">{ing.name}</span>
    </button>
  );
}

/** Oven button with a timer ring: green = perfect, red = burnt. */
function OvenButton({ ov, onClick, glow }) {
  const zone = ov.zone;
  const frac = clamp(ov.p / 1.85, 0, 1);
  const color = zone === 'perfect' ? '#22c55e' : zone === 'burnt' ? '#ef4444' : zone === 'ok' ? '#f59e0b' : '#fb923c';
  const busy = ov.orderId != null;
  const R = 22;
  const L = 2 * Math.PI * R;
  return (
    <button
      onClick={onClick}
      disabled={!busy}
      aria-label={busy ? `Lấy bánh ra lò ${ov.i + 1}` : `Lò ${ov.i + 1} trống`}
      data-testid={`pizza3d-oven-${ov.i}`}
      data-zone={zone || ''}
      className={`relative shrink-0 w-[3.9rem] h-[3.9rem] rounded-2xl flex items-center justify-center shadow ${busy ? 'bg-gradient-to-b from-orange-100 to-orange-300 active:scale-95' : 'bg-white/60'} ${glow ? 'ring-4 ring-emerald-300 hint-pulse' : ''}`}
    >
      <svg viewBox="0 0 52 52" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <circle cx="26" cy="26" r={R} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="5" />
        {/* the perfect window */}
        <circle cx="26" cy="26" r={R} fill="none" stroke="rgba(34,197,94,0.35)" strokeWidth="5" strokeDasharray={`${(0.4 / 1.85) * L} ${L}`} strokeDashoffset={-(1 / 1.85) * L} transform="rotate(-90 26 26)" />
        {busy && <circle cx="26" cy="26" r={R} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${frac * L} ${L}`} transform="rotate(-90 26 26)" />}
      </svg>
      <span className="relative flex flex-col items-center leading-none">
        <span className="text-xl">{busy ? (zone === 'burnt' ? '🔥' : '🍕') : '🧱'}</span>
        <span className="text-[9px] font-black text-slate-700 mt-0.5">{busy ? (zone === 'perfect' ? 'LẤY RA!' : zone === 'burnt' ? 'Cháy!' : 'Đang nướng') : `Lò ${ov.i + 1}`}</span>
      </span>
    </button>
  );
}

function ActionButton({ children, onClick, glow, testId, color = 'from-sky-400 to-sky-600', disabled, label }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      data-testid={testId}
      className={`shrink-0 h-[3.9rem] px-2.5 rounded-2xl bg-gradient-to-b ${color} text-white font-black text-sm leading-tight shadow-lg active:scale-95 flex flex-col items-center justify-center ${glow ? 'ring-4 ring-amber-300 hint-pulse' : ''} ${disabled ? 'opacity-40 grayscale' : ''}`}
    >
      {children}
    </button>
  );
}

/** Small order ticket on the rail. */
function Ticket({ o }) {
  const r = recipeById(o.recipe);
  const label = { taken: 'Chờ làm', prep: 'Đang làm', built: 'Chờ lò', oven: 'Trong lò', out: 'Ra lò', boxed: 'Sẵn sàng' }[o.state] || '';
  const img = lookImage(o.look);
  return (
    <div className="shrink-0 w-[4.6rem] rounded-xl bg-white/95 shadow px-1 pt-1 pb-1 flex flex-col items-center" data-testid="pizza3d-ticket">
      <div className="flex items-center gap-0.5">
        {img ? <img src={img} alt="" className="w-6 h-6 object-contain" draggable={false} /> : <span className="text-base">🙂</span>}
        <span className="text-base leading-none">{r.icon}</span>
      </div>
      <span className="text-[9px] leading-tight font-black text-slate-700 truncate max-w-full">{r.name.replace('Pizza ', '')}</span>
      <span className={`text-[9px] font-black ${o.owner === 'staff' ? 'text-violet-600' : 'text-amber-600'}`}>{label}</span>
      <div className="mt-0.5 w-full h-1.5 rounded-full bg-slate-200 overflow-hidden" aria-hidden="true">
        <div className={`h-full rounded-full ${o.patience < 0.3 ? 'bg-rose-500' : o.patience < 0.6 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.round(o.patience * 100)}%` }} />
      </div>
    </div>
  );
}

function ShopCard({ item, money, onBuy }) {
  const afford = item.cost != null && money >= item.cost;
  const img = item.staff ? artworkUrl(speciesById(item.staff.species)?.dex || 25) : null;
  return (
    <div className={`flex items-center gap-2 rounded-2xl p-2 shadow ${item.owned ? 'bg-emerald-50' : 'bg-white'}`} data-testid={`pizza3d-item-${item.key}`}>
      <span className="relative w-12 h-12 shrink-0 rounded-xl bg-gradient-to-b from-amber-100 to-orange-200 flex items-center justify-center text-2xl shadow-inner">
        {img ? <img src={img} alt="" className="w-11 h-11 object-contain" draggable={false} /> : item.icon}
        {img && <span className="absolute -bottom-1 -right-1 text-base">{item.icon}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-slate-800 leading-tight">{item.name}</span>
        <span className="block text-[11px] font-bold text-slate-500 leading-tight">{item.locked || item.desc}</span>
        {item.max > 1 && (
          <span className="flex gap-0.5 mt-0.5" aria-label={`Cấp ${item.level}/${item.max}`}>
            {Array.from({ length: item.max }, (_, i) => (
              <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < item.level ? 'bg-amber-400' : 'bg-slate-200'}`} />
            ))}
          </span>
        )}
      </span>
      {item.owned ? (
        <span className="shrink-0 px-2 py-1 rounded-xl bg-emerald-500 text-white text-xs font-black">Đã có ✓</span>
      ) : (
        <button
          onClick={() => onBuy(item)}
          disabled={!!item.locked || !afford}
          className={`shrink-0 px-2.5 py-2 rounded-xl text-sm font-black shadow active:scale-95 ${item.locked ? 'bg-slate-200 text-slate-400' : afford ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950' : 'bg-slate-100 text-slate-400'}`}
          data-testid={`pizza3d-buy-${item.key}`}
          aria-label={`Mua ${item.name} giá ${item.cost} xu`}
        >
          {item.locked ? '🔒' : item.key.startsWith('level:') ? '⬆️' : ''} {item.cost} xu
        </button>
      )}
    </div>
  );
}

/**
 * "Tiệm Pizza Pokémon": a cosy 3D pizzeria. Take orders, build pizzas, bake them just right, box, serve and
 * collect the coins; between days buy upgrades, new recipes and hire Pokémon staff. Saves after every day.
 * `autopilot` lets a bot play (tests, demos); `dayLength` shortens a day (tests).
 */
export function Pizza3DGame({ player, collection = [], onClose, onGold, random = Math.random, autopilot = false, dayLength }) {
  const [shop, setShopState] = useState(() => loadPizza3d() || newShop());
  const [phase, setPhaseState] = useState('menu'); // menu | play | report | shop | nogl
  const [hud, setHud] = useState(null);
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState('up');
  const [pops, setPops] = useState([]);
  const [banner, setBanner] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [bump, setBump] = useState(0);
  const [stageKey, setStageKey] = useState(0);
  const phaseRef = useRef('menu');
  const game = useRef(null);
  const view = useRef(null); // static state shown in the menu / shop
  const sceneRef = useRef(null);
  const shopRef = useRef(shop);
  const acc = useRef(0);
  const hudT = useRef(0);
  const botT = useRef(0);
  const paidDay = useRef(0);
  const popId = useRef(0);
  const coinT = useRef(0);
  const later = useLater();

  const playerLook = useMemo(() => ({ species: speciesOf(player?.name) || 'generic', type: player?.types?.[0] || 'Normal', image: player?.image || null, name: player?.name || 'Bé' }), [player]);
  const visitors = useMemo(() => (collection || []).filter((c) => c && c.name).map((c) => ({ name: c.name, type: c.types?.[0] || 'Normal', image: c.image || c.fallbackImage || null })), [collection]);

  const setPhase = (p) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const setShop = (s) => {
    shopRef.current = s;
    setShopState(s);
  };
  const viewState = (s) => {
    view.current = createPizza3D({ shop: s, random: () => 0.5, playerSpecies: playerLook.species });
    return view.current;
  };

  const pop = (text, x, y, color = '#ffffff', big = false) => {
    popId.current += 1;
    const id = popId.current;
    setPops((list) => [...list.slice(-(MAX_POPS - 1)), { id, text, x, y, color, big }]);
    later(() => setPops((list) => list.filter((p) => p.id !== id)), big ? 1300 : 1000);
  };
  const showBanner = (title, sub, color = '#fde047') => {
    popId.current += 1;
    const id = popId.current;
    setBanner({ id, title, sub, color });
    later(() => setBanner((b) => (b && b.id === id ? null : b)), 1700);
  };
  const at = (x, y, z) => sceneRef.current?.project?.(x, y, z) || { x: 50, y: 40 };

  // The 3D shop: built once when the dialog opens
  const mountStage = useCallback(
    (node) => {
      if (!node) return undefined;
      let scene = null;
      try {
        scene = createPizza3DScene(node, { shop: shopRef.current, player: playerLook });
      } catch (err) {
        console.warn('[pizza3d] WebGL unavailable:', err);
        phaseRef.current = 'nogl';
        setPhaseState('nogl');
        return undefined;
      }
      sceneRef.current = scene;
      return () => {
        if (sceneRef.current === scene) sceneRef.current = null;
        scene.dispose();
      };
    },
    [playerLook]
  );

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [onClose]);

  const openDay = () => {
    const s = createPizza3D({ shop: shopRef.current, random, dayLen: dayLength || DAY_LEN, visitors, playerSpecies: playerLook.species });
    game.current = s;
    acc.current = 0;
    botT.current = 0;
    setResult(null);
    setPops([]);
    setHud(hudOf(s));
    setPhase('play');
    sounds.playNote(1318.5, { duration: 0.25, volume: 0.15 });
    later(() => sounds.playNote(1567.98, { duration: 0.35, volume: 0.15 }), 140);
    showBanner(`Ngày ${s.day} – Mở cửa!`, s.day === 1 ? 'Khách đang tới, bé sẵn sàng chưa?' : `${menuOf(shopRef.current).length} món trên thực đơn`, '#fde047');
  };

  const finishDay = (s) => {
    const r = s.result;
    const next = s.shopAfter;
    setShop(next);
    savePizza3d(next);
    viewState(next);
    setHud(hudOf(s));
    if (r.gold > 0 && paidDay.current !== r.day) {
      paidDay.current = r.day;
      onGold?.(r.gold);
    }
    setResult(r);
    setPhase('report');
    if (r.stars > 0) {
      sounds.playSuccessFanfare();
      try {
        confetti({ particleCount: 50 + r.stars * 30, spread: 90, origin: { y: 0.4 }, zIndex: 9999 });
      } catch {
        // decoration only
      }
    }
  };

  const handleEvents = (s) => {
    const scene = sceneRef.current;
    for (const e of s.events.splice(0)) {
      scene?.fx(e, s);
      switch (e.type) {
        case 'arrive':
          sounds.playNote(1760, { duration: 0.12, volume: 0.08 });
          break;
        case 'ready':
          sounds.playNote(880, { duration: 0.12, volume: 0.1 });
          break;
        case 'order':
          sounds.playScanBeep?.();
          break;
        case 'add':
          if (e.by == null && e.ok) sounds.playPop();
          else if (e.by == null) sounds.playOops();
          break;
        case 'oven':
          if (e.by == null) sounds.playWhoosh();
          break;
        case 'take': {
          const p = at(LAYOUT.ovens[e.oven].x + 0.6, 1.6, LAYOUT.ovens[e.oven].z);
          if (e.by === 'player') {
            if (e.quality === 'perfect') {
              sounds.playEnergySurge?.();
              pop(QUALITY.perfect, p.x, p.y, '#86efac', true);
            } else if (e.quality === 'burnt' || e.quality === 'raw') {
              sounds.playOops();
              pop(QUALITY[e.quality], p.x, p.y, '#fca5a5', true);
            } else {
              sounds.playPop();
              pop(QUALITY.ok, p.x, p.y, '#fde68a');
            }
          }
          break;
        }
        case 'box':
          if (e.by === 'player') sounds.playPop();
          break;
        case 'serve':
          if (e.by === 'player') sounds.playWhoosh();
          break;
        case 'pay': {
          const p = at(e.x, 1.9, e.z);
          pop(`+${e.amount} xu ${'❤️'.repeat(e.hearts)}`, p.x, p.y, '#fde047', e.hearts === 3);
          if (e.tip > 0 && e.hearts === 3) later(() => pop(`Tip +${e.tip}!`, p.x, p.y - 6, '#a7f3d0'), 350);
          sounds.playNote(1046.5, { duration: 0.15, volume: 0.12 });
          break;
        }
        case 'collect':
        case 'dine':
          if (coinT.current <= 0) {
            sounds.playCoin();
            later(() => sounds.playNote(2093, { duration: 0.18, volume: 0.12 }), 380);
            coinT.current = 0.25;
          }
          setBump((b) => b + 1);
          if (e.type === 'dine') {
            const p = at(e.x, 1.4, e.z);
            pop(`+${e.amount} 🥤`, p.x, p.y, '#bae6fd');
          }
          break;
        case 'clean':
          if (e.by === 'player') sounds.playPop();
          break;
        case 'angry': {
          sounds.playOops();
          break;
        }
        case 'hint':
          if (e.hint === 'ovenFull') showBanner('Lò đang bận!', 'Lấy bánh trong lò ra trước nhé', '#fdba74');
          else if (e.hint === 'noOrder') showBanner('Chưa có order', 'Nhận order của khách trước nhé', '#fdba74');
          else if (e.hint === 'dough') showBanner('Đế bột trước!', 'Bấm 🫓 Đế bột để bắt đầu', '#fdba74');
          break;
        case 'close':
          showBanner('Đóng cửa!', 'Làm nốt bánh cho khách đang chờ', '#fda4af');
          sounds.playNote(659.25, { duration: 0.4, volume: 0.15 });
          break;
        case 'dayEnd':
          finishDay(s);
          break;
        default:
      }
    }
  };

  const doAct = (a) => {
    const s = game.current;
    if (!s || phaseRef.current !== 'play') return;
    act(s, a);
    handleEvents(s);
    setHud(hudOf(s));
  };

  useLoop((dt) => {
    if (typeof document !== 'undefined' && document.hidden) return;
    coinT.current -= dt;
    const s = game.current;
    if (phaseRef.current === 'play' && s) {
      acc.current += dt;
      while (acc.current >= DT && s.phase !== 'done') {
        if (autopilot) {
          botT.current -= DT;
          if (botT.current <= 0) {
            const a = playerBot(s);
            if (a) {
              act(s, a);
              botT.current = 0.5;
            }
          }
        }
        step(s, DT);
        acc.current -= DT;
      }
      if (s.events.length) handleEvents(s);
      hudT.current += dt;
      if (hudT.current > 0.1 && phaseRef.current === 'play') {
        hudT.current = 0;
        setHud(hudOf(s));
      }
      sceneRef.current?.update(s, dt);
    } else if (phaseRef.current === 'report' && s) sceneRef.current?.update(s, dt, { light: 1 });
    else {
      if (!view.current) viewState(shopRef.current);
      sceneRef.current?.update(view.current, dt, { light: 0.05 });
    }
  }, phase !== 'nogl');

  const onBuy = (item) => {
    const r = buy(shopRef.current, item.key, { random, playerSpecies: playerLook.species });
    if (!r.ok) {
      sounds.playOops();
      return;
    }
    setShop(r.shop);
    savePizza3d(r.shop);
    viewState(r.shop);
    sceneRef.current?.setShop(r.shop, { animate: true });
    sounds.playCoin();
    later(() => sounds.playSuccessFanfare(), 200);
    showBanner(item.key.startsWith('level:') ? 'Lên cấp!' : item.key.startsWith('hire:') ? 'Có người mới!' : 'Xây xong!', r.shop.staff.length > shopRef.current.staff.length ? r.shop.staff[r.shop.staff.length - 1].name : item.name, '#a7f3d0');
    setBump((b) => b + 1);
  };

  const doReset = () => {
    const s = resetPizza3d();
    setShop(s);
    viewState(s);
    setConfirmReset(false);
    // rebuild the scene for the empty shop
    setStageKey((k) => k + 1);
  };
  // ---------------------------------------------------------------- render
  const s = hud;
  const tip = phase === 'play' && s ? s.tip : null;
  const showHelp = phase === 'play' && s && s.day <= 3;
  const items = phase === 'shop' ? shopItems(shop).filter((i) => i.tab === tab) : [];
  const money = phase === 'play' && s ? s.money : shop.money;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-amber-100 select-none overflow-hidden"
      role="dialog"
      aria-label="Tiệm Pizza Pokémon"
      data-phase={phase}
      data-day={phase === 'play' && s ? s.day : shop.day}
      data-money={Math.round(money)}
      data-served={s ? s.served : 0}
    >
      <div className="relative flex-1 min-h-0">
        <div key={`stage${stageKey}`} ref={mountStage} className="absolute inset-0" data-testid="pizza3d-stage" />

        {/* top HUD */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-2 pt-2 flex items-start gap-1 text-[13px]">
          <span className="px-2 py-1 rounded-full bg-white/90 font-black text-rose-600 shadow whitespace-nowrap" data-testid="pizza3d-day">
            🍕 Ngày {phase === 'play' && s ? s.day : shop.day}
          </span>
          {phase === 'play' && s && (
            <span className={`px-2 py-1 rounded-full font-black tabular-nums shadow whitespace-nowrap ${s.phase === 'closing' ? 'bg-rose-500 text-white' : s.timeLeft < 20 ? 'bg-amber-400 text-amber-950 hint-pulse' : 'bg-white/90 text-slate-800'}`} data-testid="pizza3d-time">
              {s.phase === 'closing' ? '🌙 Đóng cửa' : `⏱ ${fmtTime(s.timeLeft)}`}
            </span>
          )}
          <span key={bump} className="pizza3d-bump px-2 py-1 rounded-full bg-amber-300/95 font-black text-amber-950 tabular-nums shadow whitespace-nowrap" data-testid="pizza3d-money">
            🪙 {fmt(money)} xu
          </span>
          {phase === 'play' && s && (
            <span className="px-2 py-1 rounded-full bg-white/85 font-black text-emerald-700 tabular-nums shadow whitespace-nowrap" data-testid="pizza3d-served">
              😋 {s.served}
            </span>
          )}
          <button onClick={onClose} aria-label="Đóng trò chơi" className="pointer-events-auto ml-auto shrink-0 p-2 rounded-full bg-white/90 text-slate-700 shadow">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* +xu popups */}
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden="true">
          {pops.map((p) => (
            <span key={p.id} className={`pizza3d-pop absolute whitespace-nowrap font-black sport-banner ${p.big ? 'text-2xl' : 'text-lg'}`} style={{ left: `${clamp(p.x, p.big ? 26 : 18, p.big ? 74 : 82)}%`, top: `${clamp(p.y, 12, 88)}%`, color: p.color }}>
              {p.text}
            </span>
          ))}
        </div>
        {banner && (
          <div key={banner.id} className="pointer-events-none absolute inset-x-0 top-[18%] z-30 flex flex-col items-center px-4" data-testid="pizza3d-banner">
            <span className="pizza3d-banner text-3xl font-black sport-banner text-center" style={{ color: banner.color }}>
              {banner.title}
            </span>
            {banner.sub && <span className="pizza3d-banner mt-1 px-3 py-1 rounded-full bg-black/45 text-white text-sm font-black text-center">{banner.sub}</span>}
          </div>
        )}
        {showHelp && tip && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center px-3" data-testid="pizza3d-help">
            <span className="px-3 py-1.5 rounded-2xl bg-slate-900/70 text-white text-sm font-black text-center">{typeof HINT_TEXT[tip.type] === 'function' ? HINT_TEXT[tip.type](tip.arg) : HINT_TEXT[tip.type]}</span>
          </div>
        )}

        {/* menu */}
        {phase === 'menu' && (
          <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center bg-gradient-to-t from-black/45 via-black/10 to-transparent px-3 pb-4">
            <div className="result-rise w-full max-w-sm rounded-3xl bg-white/95 p-4 text-center shadow-2xl" data-testid="pizza3d-menu">
              <p className="text-2xl font-black text-rose-600">🍕 Tiệm Pizza Pokémon</p>
              <div className="mt-1 flex items-center justify-center gap-2">
                {player?.image && <img src={player.image} alt="" className="w-12 h-12 object-contain pizza3d-float" draggable={false} />}
                <p className="text-sm font-bold text-slate-600 text-left">
                  Đầu bếp <b className="text-slate-800">{player?.name || 'Pokémon'}</b> mở tiệm pizza! Nhận order, làm bánh, nướng vừa chín rồi giao cho khách.
                </p>
              </div>
              <ul className="mt-2 text-left text-xs font-bold text-slate-600 space-y-0.5">
                <li>📝 Nhận order → 🫓 Đế → 🍅 Sốt → 🧀 Phô mai → topping</li>
                <li>🔥 Vào lò, lấy ra khi vòng xanh để được tip to</li>
                <li>📦 Đóng hộp → 🛎️ Giao → 💰 Thu tiền</li>
                <li>🛒 Hết ngày: nâng cấp tiệm, thêm món, thuê nhân viên Pokémon</li>
              </ul>
              {shop.day > 1 && (
                <p className="mt-2 text-sm font-black text-amber-700" data-testid="pizza3d-save">
                  Tiệm của bé: ngày {shop.day} · {fmt(shop.money)} xu · {shop.staff.length} nhân viên
                </p>
              )}
              <button onClick={openDay} className="mt-3 w-full py-3 rounded-2xl bg-gradient-to-b from-rose-400 to-rose-600 text-white text-xl font-black shadow-lg active:scale-95" data-testid="pizza3d-start">
                {shop.day > 1 ? `▶ Mở cửa ngày ${shop.day}` : '▶ Mở tiệm thôi!'}
              </button>
              <div className="mt-2 flex gap-2">
                <button onClick={() => setPhase('shop')} className="flex-1 py-2 rounded-2xl bg-amber-400 text-amber-950 text-sm font-black shadow active:scale-95" data-testid="pizza3d-open-shop">
                  🛒 Cửa hàng
                </button>
                {shop.day > 1 && (
                  <button onClick={() => setConfirmReset(true)} className="flex-1 py-2 rounded-2xl bg-slate-200 text-slate-700 text-sm font-black shadow active:scale-95" data-testid="pizza3d-reset">
                    🆕 Tiệm mới
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* day report */}
        {phase === 'report' && result && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/55 px-4" data-testid="pizza3d-report" data-stars={result.stars}>
            <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-amber-50 to-white p-4 text-center shadow-2xl flex flex-col items-center gap-2">
              <p className="result-rise text-sm font-black text-rose-500">🌙 Hết ngày {result.day}</p>
              <p className="result-rise text-2xl font-black text-slate-800">{RESULT_TITLE[result.stars]}</p>
              <div className="result-rise" style={{ animationDelay: '100ms' }}>
                <StarRow stars={result.stars} size="w-11 h-11" animate />
              </div>
              <div className="result-rise grid grid-cols-2 gap-1.5 w-full text-sm font-black text-slate-700" style={{ animationDelay: '180ms' }}>
                <span className="rounded-xl bg-emerald-100 px-2 py-1">😋 Phục vụ: {result.served}</span>
                <span className="rounded-xl bg-rose-100 px-2 py-1">😢 Bỏ về: {result.lost}</span>
                <span className="rounded-xl bg-amber-100 px-2 py-1">💰 Doanh thu: {result.revenue}</span>
                <span className="rounded-xl bg-sky-100 px-2 py-1">✨ Tiền tip: {result.tips}</span>
                <span className="rounded-xl bg-violet-100 px-2 py-1">🥤 Ăn tại chỗ: {result.dine}</span>
                <span className="rounded-xl bg-slate-100 px-2 py-1">👥 Lương: −{result.salaries}</span>
                <span className="col-span-2 rounded-xl bg-amber-200 px-2 py-1 text-base" data-testid="pizza3d-profit">
                  Lãi hôm nay: {result.profit >= 0 ? '+' : ''}
                  {result.profit} xu · ⭐ Hoàn hảo: {result.perfect}
                </span>
              </div>
              {result.gold > 0 && (
                <div className="result-rise" style={{ animationDelay: '260ms' }}>
                  <GoldReward amount={result.gold} />
                </div>
              )}
              <button onClick={() => setPhase('shop')} className="result-rise mt-1 w-full py-3 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950 text-lg font-black shadow-lg active:scale-95" style={{ animationDelay: '320ms' }} data-testid="pizza3d-to-shop">
                🛒 Nâng cấp tiệm
              </button>
            </div>
          </div>
        )}

        {confirmReset && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-6" data-testid="pizza3d-confirm">
            <div className="max-w-xs rounded-3xl bg-white p-4 text-center shadow-2xl">
              <p className="text-lg font-black text-slate-800">Mở tiệm mới?</p>
              <p className="mt-1 text-sm font-bold text-slate-600">Tiệm cũ (ngày {shop.day}, {fmt(shop.money)} xu, nhân viên và đồ nâng cấp) sẽ mất hết đó!</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setConfirmReset(false)} className="flex-1 py-2 rounded-2xl bg-slate-200 text-slate-700 font-black">
                  Thôi
                </button>
                <button onClick={doReset} className="flex-1 py-2 rounded-2xl bg-rose-500 text-white font-black" data-testid="pizza3d-reset-yes">
                  Mở tiệm mới
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === 'nogl' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-rose-300 to-amber-300 px-6" data-testid="pizza3d-nogl">
            <div className="max-w-sm rounded-3xl bg-white p-5 text-center shadow-2xl">
              <p className="text-5xl">🍕</p>
              <p className="mt-2 text-lg font-black text-slate-800">Ối! Máy này chưa vẽ được tiệm pizza 3D.</p>
              <p className="mt-1 text-sm font-bold text-slate-600">Bé thử trò chơi khác hoặc dùng máy khác nhé!</p>
              <button onClick={onClose} className="mt-3 px-6 py-2.5 rounded-2xl bg-rose-500 text-white text-base font-black shadow active:scale-95">
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>

      {/* bottom panel: the kitchen controls */}
      {phase === 'play' && s && <PlayPanel s={s} tip={tip} doAct={doAct} />}

      {/* shop between days */}
      {phase === 'shop' && (
        <div className="relative z-40 shrink-0 h-[56%] flex flex-col bg-gradient-to-b from-amber-100 to-orange-100 rounded-t-3xl shadow-[0_-8px_20px_rgba(0,0,0,0.15)]" data-testid="pizza3d-shop">
          <div className="flex items-center gap-2 px-3 pt-3">
            <p className="text-lg font-black text-slate-800">🛒 Cửa hàng</p>
            <span className="ml-auto text-xs font-bold text-slate-500">Lương/ngày: {salaries(shop)} xu</span>
          </div>
          <div className="flex gap-1.5 px-3 pt-2">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-1.5 rounded-xl text-xs font-black shadow ${tab === t.id ? 'bg-rose-500 text-white' : 'bg-white text-slate-600'}`} data-testid={`pizza3d-tab-${t.id}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col gap-1.5">
            {items.map((it) => (
              <ShopCard key={it.key} item={it} money={shop.money} onBuy={onBuy} />
            ))}
          </div>
          <div className="px-3 pb-3 pt-1">
            <button onClick={openDay} className="w-full py-3 rounded-2xl bg-gradient-to-b from-rose-400 to-rose-600 text-white text-lg font-black shadow-lg active:scale-95" data-testid="pizza3d-next-day">
              🍕 Mở cửa ngày {shop.day}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

function PlayPanel({ s, tip, doAct }) {
  const glow = (type, arg) => tip && tip.type === type && (arg === undefined || tip.arg === arg);
  const items = ['dough', 'sauce', 'cheese', ...s.toppings];
  const prep = s.prep;
  const r = prep ? recipeById(prep.recipe) : s.nextOrder ? recipeById(s.nextOrder) : null;
  const outs = s.pass.filter((p) => p.state === 'out');
  const boxed = s.pass.filter((p) => p.canServe);
  const ready = s.regs.filter((x) => x.ready && !x.staffed);
  return (
    <div className="relative z-30 shrink-0 bg-gradient-to-b from-amber-200 to-orange-200 rounded-t-3xl shadow-[0_-8px_20px_rgba(0,0,0,0.15)] px-2 pt-2 pb-2 flex flex-col gap-1.5" data-testid="pizza3d-panel">
      {/* orders rail */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 min-h-[4.4rem]" data-testid="pizza3d-rail">
        {ready.map((x) => {
          const rr = recipeById(x.recipe);
          const img = lookImage(x.look);
          return (
            <button
              key={`reg${x.i}`}
              onClick={() => doAct({ type: 'take', arg: x.i })}
              className={`shrink-0 w-[5.2rem] rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 shadow px-1 py-1 flex flex-col items-center active:scale-95 ${glow('take') ? 'ring-4 ring-white hint-pulse' : ''}`}
              data-testid={`pizza3d-take-${x.i}`}
              aria-label="Nhận order"
            >
              <span className="flex items-center gap-0.5">
                {img ? <img src={img} alt="" className="w-7 h-7 object-contain" draggable={false} /> : <span>🙂</span>}
                <span className="text-lg">{rr.icon}</span>
              </span>
              <span className="text-[10px] font-black text-amber-950 leading-tight">📝 Nhận order</span>
            </button>
          );
        })}
        {s.orders.map((o) => (
          <Ticket key={o.id} o={o} />
        ))}
        {!ready.length && !s.orders.length && <span className="self-center px-2 text-xs font-bold text-amber-800">{s.phase === 'closing' ? 'Hết khách rồi, sắp đóng cửa…' : 'Đang chờ khách vào tiệm… 🚪'}</span>}
      </div>

      {/* prep station */}
      <div className="rounded-2xl bg-white/60 px-2 py-1.5">
        <div className="flex items-center gap-1 min-h-[1.5rem]">
          {r ? (
            <>
              <span className="text-xs font-black text-slate-700 whitespace-nowrap">{prep ? 'Đang làm:' : 'Bánh tiếp:'}</span>
              <span className="text-xs font-black text-rose-600 truncate">{r.name}</span>
              <span className="ml-auto flex gap-0.5" data-testid="pizza3d-steps">
                {(prep ? prep.steps : ['dough', 'sauce', 'cheese', ...r.toppings]).map((it) => (
                  <span key={it} className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${prep?.items.includes(it) ? 'bg-emerald-400' : prep?.next === it ? 'bg-amber-300 hint-pulse' : 'bg-white'}`} title={INGREDIENTS[it].name}>
                    {prep?.items.includes(it) ? '✓' : INGREDIENTS[it].icon}
                  </span>
                ))}
                {prep && prep.mistakes > 0 && <span className="ml-0.5 text-xs font-black text-rose-500">✗{prep.mistakes}</span>}
              </span>
            </>
          ) : (
            <span className="text-xs font-bold text-slate-500">Nhận order rồi làm bánh ở đây 👇</span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <div className="flex-1 grid grid-cols-4 gap-x-1 gap-y-2.5 justify-items-center">
            {items.map((it) => (
              <IngredientButton key={it} item={it} onClick={() => doAct({ type: 'add', arg: it })} glow={glow('add', it)} />
            ))}
          </div>
          <ActionButton onClick={() => doAct({ type: 'oven' })} glow={glow('oven')} testId="pizza3d-to-oven" color="from-orange-400 to-red-500" disabled={!prep || !prep.items.includes('dough')} label="Vào lò">
            <span className="text-2xl">🔥</span>
            <span>Vào lò</span>
          </ActionButton>
        </div>
      </div>

      {/* ovens + pass + cash */}
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {s.ovens.map((ov) => (
          <OvenButton key={ov.i} ov={ov} onClick={() => doAct({ type: 'out', arg: ov.i })} glow={glow('out', ov.i)} />
        ))}
        <ActionButton onClick={() => doAct({ type: 'box', arg: outs[0]?.id })} glow={glow('box')} testId="pizza3d-box" color="from-amber-500 to-amber-700" disabled={!outs.length} label="Đóng hộp">
          <span className="text-xl">📦</span>
          <span>Hộp{outs.length > 1 ? ` x${outs.length}` : ''}</span>
        </ActionButton>
        <ActionButton onClick={() => doAct({ type: 'serve', arg: boxed[0]?.id })} glow={glow('serve')} testId="pizza3d-serve" color="from-emerald-400 to-emerald-600" disabled={!boxed.length} label="Giao bánh">
          <span className="text-xl">🛎️</span>
          <span>Giao{boxed.length > 1 ? ` x${boxed.length}` : ''}</span>
        </ActionButton>
        <ActionButton onClick={() => doAct({ type: 'collect' })} glow={glow('collect')} testId="pizza3d-collect" color="from-yellow-400 to-amber-500" disabled={s.coins <= 0} label="Thu tiền">
          <span className="text-xl">💰</span>
          <span className="tabular-nums">{s.coins > 0 ? `+${s.coins}` : 'Thu'}</span>
        </ActionButton>
        {s.dirty.length > 0 && (
          <ActionButton onClick={() => doAct({ type: 'clean', arg: s.dirty[0] })} glow={glow('clean')} testId="pizza3d-clean" color="from-cyan-400 to-sky-600" label="Dọn bàn">
            <span className="text-xl">🧽</span>
            <span>Dọn</span>
          </ActionButton>
        )}
      </div>
    </div>
  );
}

