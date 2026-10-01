import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, RotateCcw, RotateCw, Moon, Sun, Lock, Plus, Check } from '../../icons/PokeIcons';
import { GoldReward } from '../../kidgames/Common';
import { useLoop, useLater } from '../../sports/sportsKit';
import { sounds } from '../../../utils/soundEffects';
import { artworkUrl } from '../../../services/pokemonOnlineService';
import {
  BLOCKS,
  DECOR,
  PAINTS,
  PAINT_NAMES,
  WISHES,
  WISH_BY_ID,
  WISH_NEEDS,
  MAX_GUESTS,
  createIsland,
  applyTool,
  undo,
  resetIsland,
  setNight,
  inviteResident,
  step,
  snap,
  targetFor,
  wishText,
  itemName,
  loadSaved,
  saveIsland,
} from '../../../utils/three3d/island3d';
import { createIsland3DScene } from './Island3DScene';

const TOOLS = [
  { id: 'place', label: 'Đặt khối', icon: '🧱' },
  { id: 'remove', label: 'Xóa khối', icon: '💨' },
  { id: 'paint', label: 'Tô màu', icon: '🎨' },
  { id: 'decor', label: 'Trang trí', icon: '🌸' },
];

const DENY = {
  locked: 'Hoàn thành điều ước của các bạn để mở khóa nhé!',
  nowhere: 'Chạm vào mặt một khối để đặt nhé!',
  cantPaint: 'Khối này không tô màu được',
  same: 'Khối này đã có màu đó rồi',
  bad: 'Chọn một khối trước nhé!',
};

const SAVE_DELAY = 800;

function Swatch({ block, size = 'w-9 h-9' }) {
  return (
    <span
      aria-hidden="true"
      className={`block ${size} rounded-lg border-2 border-black/15 shadow-inner`}
      style={{ background: `linear-gradient(180deg, ${block.top} 0 46%, ${block.side} 46% 100%)`, opacity: block.see ? 0.75 : 1 }}
    />
  );
}

function Avatar({ r, className = 'w-10 h-10' }) {
  const src = r.image || (r.dex ? artworkUrl(Number(r.dex)) : null);
  return (
    <span className={`relative inline-flex items-center justify-center rounded-full bg-white/90 shadow ${className}`}>
      {src ? <img src={src} alt="" className="w-full h-full object-contain" draggable={false} /> : <span className="text-lg font-black text-amber-500">{r.name.slice(0, 1)}</span>}
    </span>
  );
}

function Bar({ have, need }) {
  const pct = Math.round((Math.min(have, need) / need) * 100);
  return (
    <span className="block h-2.5 w-full rounded-full bg-black/10 overflow-hidden">
      <span className="block h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-400 transition-all" style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Pokémon from the collection that can still be invited (unique names, not already living here). */
function invitable(collection, hud, playerName) {
  const seen = new Set([playerName, ...hud.residents.map((r) => r.name)]);
  const out = [];
  for (const c of collection || []) {
    if (!c?.name || seen.has(c.name)) continue;
    seen.add(c.name);
    const dex = Number(c.pokedexNumber) || null;
    out.push({ name: c.name, image: c.image || c.fallbackImage || (dex ? artworkUrl(dex) : null), dex });
  }
  return out;
}

export function Island3DGame({ player, collection = [], onClose, onGold, random = Math.random }) {
  const hero = useMemo(() => ({ name: player?.name || 'Pikachu', image: player?.image || null }), [player?.name, player?.image]);
  const [engine] = useState(() => createIsland({ random, player: hero, saved: loadSaved() }));
  const [hud, setHud] = useState(() => snap(engine));
  const [tool, setTool] = useState('place');
  const [block, setBlock] = useState(BLOCKS[0].id);
  const [decor, setDecor] = useState(DECOR[1].id);
  const [color, setColor] = useState(1);
  const [panel, setPanel] = useState(null); // 'quests' | 'residents' | 'confirm'
  const [celebrate, setCelebrate] = useState(null);
  const [toast, setToast] = useState(null);
  const [glError, setGlError] = useState(false);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState(true);
  const [goldTotal, setGoldTotal] = useState(0);
  const sceneRef = useRef(null);
  const ghostRef = useRef(null);
  const saveAt = useRef(0);
  const toolRef = useRef({ tool, block, decor, color });
  const later = useLater();
  const toastId = useRef(0);

  useEffect(() => {
    toolRef.current = { tool, block, decor, color };
  }, [tool, block, decor, color]);

  // The three.js scene, made when the stage mounts (WebGL may be missing)
  const stageRef = useCallback(
    (el) => {
      if (!el) return undefined;
      let scene = null;
      try {
        scene = createIsland3DScene(el, { random });
        sceneRef.current = scene;
        setReady(true);
      } catch {
        setGlError(true);
      }
      return () => {
        sceneRef.current = null;
        try {
          scene?.dispose();
        } catch {
          // already gone
        }
      };
    },
    [random]
  );

  // Save when leaving
  useEffect(
    () => () => {
      if (engine.dirty) saveIsland(engine);
    },
    [engine]
  );

  const showToast = useCallback(
    (text, kind = 'info') => {
      const id = ++toastId.current;
      setToast({ id, text, kind });
      later(() => setToast((t) => (t && t.id === id ? null : t)), 2200);
    },
    [later]
  );

  const handleEvents = useCallback(() => {
    const evs = engine.events.splice(0);
    if (!evs.length) return;
    let changed = false;
    for (const e of evs) {
      sceneRef.current?.effect(e);
      if (e.type === 'place') {
        sounds.playPop();
        changed = true;
      } else if (e.type === 'decor') {
        sounds.playPop();
        sounds.playNote(880, { duration: 0.25, volume: 0.15 });
        changed = true;
      } else if (e.type === 'remove') {
        sounds.playWhoosh();
        changed = true;
      } else if (e.type === 'paint') {
        sounds.playNote(523 + e.color * 40, { duration: 0.3, volume: 0.18 });
        changed = true;
      } else if (e.type === 'undo' || e.type === 'reset') {
        sounds.playWhoosh();
        changed = true;
      } else if (e.type === 'deny') {
        sounds.playOops();
        showToast(DENY[e.reason] || DENY.nowhere, 'warn');
      } else if (e.type === 'invite') {
        sounds.playPop();
        changed = true;
      } else if (e.type === 'newWish') {
        changed = true;
      } else if (e.type === 'wish') {
        changed = true;
        sounds.playSuccessFanfare();
        sounds.playCoin();
        onGold?.(e.gold);
        setGoldTotal((g) => g + e.gold);
        const resident = engine.residents.find((r) => r.key === e.resident);
        setCelebrate({ key: `${e.wishId}`, name: e.name, wishId: e.wishId, gold: e.gold, unlocks: e.unlocks, home: !!e.home && WISH_BY_ID[e.wishId].home, image: resident?.image || null, dex: resident?.dex || null });
        try {
          confetti({ particleCount: 90, spread: 90, origin: { y: 0.45 }, zIndex: 9999, colors: ['#ef4444', '#facc15', '#38bdf8', '#f472b6', '#4ade80'] });
        } catch {
          // decoration only
        }
      }
    }
    if (changed) setHud(snap(engine));
  }, [engine, onGold, showToast]);

  useLoop((dt) => {
    step(engine, dt);
    handleEvents();
    // Autosave after a short pause in building
    if (engine.dirty) {
      if (!saveAt.current) saveAt.current = performance.now() + SAVE_DELAY;
      else if (performance.now() >= saveAt.current) {
        saveIsland(engine);
        saveAt.current = 0;
      }
    }
    sceneRef.current?.update(engine, dt, { ghost: ghostRef.current });
  }, ready && !glError);

  // ---------- tools
  const ghostFor = useCallback(
    (hit) => {
      const t = toolRef.current;
      const cell = targetFor(engine, hit, t.tool);
      if (!cell) return null;
      const tint = t.tool === 'place' ? BLOCKS.find((b) => b.id === t.block)?.top : t.tool === 'decor' ? DECOR.find((d) => d.id === t.decor)?.color : t.tool === 'paint' ? PAINTS[t.color] || '#ffffff' : '#ef4444';
      return { cell, kind: t.tool, color: tint };
    },
    [engine]
  );

  const applyAt = useCallback(
    (hit) => {
      const t = toolRef.current;
      const res = applyTool(engine, t.tool, hit, { block: t.block, decor: t.decor, color: t.color });
      if (res.ok) setHint(false);
      handleEvents();
    },
    [engine, handleEvents]
  );

  const doUndo = useCallback(() => {
    if (undo(engine)) handleEvents();
  }, [engine, handleEvents]);

  // ---------- gestures on the stage
  const pointers = useRef(new Map());
  const gesture = useRef({ moved: false, multi: false, start: 0, dist: 0, mid: null });
  const onPointerDown = (e) => {
    const scene = sceneRef.current;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // not supported
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, shift: e.shiftKey });
    const g = gesture.current;
    if (pointers.current.size === 1) {
      g.moved = false;
      g.multi = false;
      g.start = Date.now();
      ghostRef.current = scene ? ghostFor(scene.pick(e.clientX, e.clientY)) : null;
    } else {
      g.multi = true;
      ghostRef.current = null;
      const [a, b] = [...pointers.current.values()];
      g.dist = Math.hypot(a.x - b.x, a.y - b.y);
      g.mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  };
  const onPointerMove = (e) => {
    const scene = sceneRef.current;
    const p = pointers.current.get(e.pointerId);
    if (!p) {
      // Mouse hover: show where the block would go
      if (e.pointerType === 'mouse' && scene) ghostRef.current = ghostFor(scene.pick(e.clientX, e.clientY));
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    const g = gesture.current;
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (g.dist > 0 && dist > 0) scene?.zoom(g.dist / dist);
      if (g.mid) scene?.pan(mid.x - g.mid.x, mid.y - g.mid.y);
      g.dist = dist;
      g.mid = mid;
      return;
    }
    if (!g.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) {
      g.moved = true;
      ghostRef.current = null;
    }
    if (g.moved) {
      if (p.button === 2 || p.shift) scene?.pan(dx, dy);
      else scene?.orbit(dx, dy);
    }
  };
  const onPointerUp = (e) => {
    const p = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!p) return;
    if (!g.multi && !g.moved && pointers.current.size === 0 && Date.now() - g.start < 900 && e.type === 'pointerup') {
      const scene = sceneRef.current;
      const hit = scene?.pick(e.clientX, e.clientY);
      applyAt(hit || null);
    }
    if (pointers.current.size === 0) {
      ghostRef.current = e.pointerType === 'mouse' && sceneRef.current ? ghostFor(sceneRef.current.pick(e.clientX, e.clientY)) : null;
      g.multi = false;
    } else {
      g.dist = 0;
      g.mid = null;
    }
  };
  const onWheel = (e) => sceneRef.current?.zoom(Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.004));

  // ---------- keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (panel) setPanel(null);
        else onClose?.();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        doUndo();
      } else if (['1', '2', '3', '4'].includes(e.key)) setTool(TOOLS[Number(e.key) - 1].id);
      else if (e.key === 'q' || e.key === 'ArrowLeft') sceneRef.current?.rotate90(-1);
      else if (e.key === 'e' || e.key === 'ArrowRight') sceneRef.current?.rotate90(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, onClose, doUndo]);

  // ---------- actions
  const toggleNight = () => {
    setNight(engine, !engine.night);
    sounds.playNote(engine.night ? 392 : 659, { duration: 0.5, volume: 0.2 });
    setHud(snap(engine));
  };
  const invite = (p) => {
    if (inviteResident(engine, p)) {
      handleEvents();
      showToast(`${p.name} đã chuyển đến đảo! 💖`);
    }
  };
  const newIsland = () => {
    resetIsland(engine);
    setPanel(null);
    handleEvents();
    showToast('Đảo mới đã sẵn sàng! 🏝️');
  };
  const selectLocked = () => {
    sounds.playOops();
    showToast(DENY.locked, 'warn');
  };

  const unlocked = useMemo(() => new Set(hud.unlocked), [hud.unlocked]);
  const heroWish = hud.residents[0]?.wishId;
  const guests = invitable(collection, hud, hero.name);
  const guestCount = hud.residents.length - 1;
  const openWishes = hud.residents.filter((r) => r.wishId);

  const close = () => onClose?.();

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 select-none"
      role="dialog"
      aria-label="Đảo nhà Pokémon"
      data-tool={tool}
      data-wishes-done={hud.done.length}
      data-residents={hud.residents.length}
      data-night={hud.night ? 'yes' : 'no'}
      data-rev={hud.rev}
      data-testid="island3d-dialog"
    >
      <div className="relative flex flex-col w-full h-full max-w-md overflow-hidden bg-sky-300 sm:rounded-3xl sm:max-h-[860px]">
        {/* Stage */}
        <div
          ref={stageRef}
          className="absolute inset-0 touch-none"
          data-testid="island3d-stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse' && !pointers.current.size) ghostRef.current = null;
          }}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Top bar */}
        <div className="relative z-20 flex items-center gap-1.5 px-2 pt-2 pointer-events-none">
          <span className="px-3 py-1.5 rounded-2xl bg-white/85 text-emerald-700 text-sm font-black shadow whitespace-nowrap">🏝️ Đảo nhà Pokémon</span>
          <span className="ml-auto" />
          <button onClick={toggleNight} aria-label={hud.night ? 'Ban ngày' : 'Ban đêm'} data-testid="island3d-night" className="pointer-events-auto p-2 rounded-full bg-white/90 text-indigo-700 shadow active:scale-90">
            {hud.night ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={() => setPanel('confirm')} aria-label="Đảo mới" data-testid="island3d-new" className="pointer-events-auto px-2.5 py-2 rounded-full bg-white/90 text-rose-600 text-xs font-black shadow whitespace-nowrap active:scale-90">
            Đảo mới
          </button>
          <button onClick={close} aria-label="Đóng trò chơi" className="pointer-events-auto p-2 rounded-full bg-white/90 text-slate-700 shadow active:scale-90">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wish banner */}
        <div className="relative z-20 px-2 pt-2 flex gap-1.5">
          <button onClick={() => setPanel('quests')} data-testid="island3d-quests" className="flex-1 min-w-0 flex items-center gap-2 rounded-2xl bg-white/90 px-2 py-1.5 text-left shadow active:scale-[0.98]">
            <Avatar r={hud.residents[0]} className="w-9 h-9 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-black text-violet-600">
                Nhiệm vụ {hud.done.length}/{WISHES.length}
                {goldTotal > 0 && <span className="ml-2 text-amber-600" data-testid="island3d-gold">🪙 +{goldTotal}</span>}
              </span>
              <span className="block truncate text-sm font-bold text-slate-800" data-testid="island3d-hero-wish">
                {heroWish ? wishText(hud.residents[0].name, heroWish) : 'Tất cả điều ước đã thành sự thật! 🌈'}
              </span>
              {heroWish && hud.progress[heroWish] && <Bar {...hud.progress[heroWish]} />}
            </span>
          </button>
          <button onClick={() => setPanel('residents')} aria-label="Cư dân" data-testid="island3d-residents" className="shrink-0 flex flex-col items-center justify-center rounded-2xl bg-white/90 px-2 shadow active:scale-95">
            <span className="text-lg leading-none">🏠</span>
            <span className="text-[11px] font-black text-sky-700">
              {hud.residents.length}/{MAX_GUESTS + 1}
            </span>
          </button>
        </div>

        {/* Camera buttons */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
          <button onClick={() => sceneRef.current?.rotate90(-1)} aria-label="Xoay trái" data-testid="island3d-rotate-left" className="w-11 h-11 flex items-center justify-center rounded-full bg-white/85 text-sky-700 shadow active:scale-90">
            <RotateCcw className="w-5 h-5" />
          </button>
          <button onClick={() => sceneRef.current?.rotate90(1)} aria-label="Xoay phải" data-testid="island3d-rotate-right" className="w-11 h-11 flex items-center justify-center rounded-full bg-white/85 text-sky-700 shadow active:scale-90">
            <RotateCw className="w-5 h-5" />
          </button>
          <button onClick={() => sceneRef.current?.resetView()} aria-label="Nhìn cả đảo" data-testid="island3d-reset-view" className="w-11 h-11 flex items-center justify-center rounded-full bg-white/85 text-lg shadow active:scale-90">
            🏝️
          </button>
        </div>

        {hint && !glError && (
          <p className="island3d-hint absolute left-1/2 bottom-[190px] z-10 -translate-x-1/2 w-[86%] max-w-xs rounded-2xl bg-black/55 px-3 py-2 text-center text-sm font-bold text-white pointer-events-none">
            👆 Chạm vào mặt khối để đặt khối mới
            <br />
            <span className="text-white/80 text-xs">Kéo 1 ngón để xoay • 2 ngón để phóng to</span>
          </p>
        )}

        {toast && (
          <p key={toast.id} className={`island3d-toast absolute left-1/2 top-28 z-30 w-[88%] max-w-xs -translate-x-1/2 rounded-2xl px-3 py-2 text-center text-sm font-black shadow-lg pointer-events-none ${toast.kind === 'warn' ? 'bg-amber-100 text-amber-800' : 'bg-white text-emerald-700'}`} data-testid="island3d-toast">
            {toast.text}
          </p>
        )}

        <span className="flex-1" />

        {/* Palette */}
        <div className="relative z-20 mx-2 mb-1.5 rounded-2xl bg-white/90 shadow">
          <div className="flex gap-1.5 overflow-x-auto px-2 py-1.5 [scrollbar-width:none]" data-testid="island3d-palette">
            {(tool === 'place' || tool === 'remove') &&
              BLOCKS.map((b) => {
                const open = unlocked.has(b.id);
                const on = tool === 'place' && block === b.id;
                return (
                  <button
                    key={b.id}
                    data-testid={`island3d-item-${b.id}`}
                    aria-label={open ? b.name : `${b.name} (chưa mở khóa)`}
                    aria-pressed={on}
                    onClick={() => {
                      if (!open) return selectLocked();
                      setBlock(b.id);
                      setTool('place');
                    }}
                    className={`relative shrink-0 flex flex-col items-center w-14 rounded-xl py-1 ${on ? 'bg-amber-200 ring-2 ring-amber-500' : 'bg-slate-100'} ${open ? '' : 'opacity-50'}`}
                  >
                    <Swatch block={b} />
                    <span className="mt-0.5 text-[10px] font-black leading-tight text-slate-700 whitespace-nowrap">{b.name}</span>
                    {!open && <Lock className="absolute top-1 right-1 w-3.5 h-3.5 text-slate-600" />}
                  </button>
                );
              })}
            {tool === 'decor' &&
              DECOR.map((d) => {
                const open = unlocked.has(d.id);
                const on = decor === d.id;
                return (
                  <button
                    key={d.id}
                    data-testid={`island3d-item-${d.id}`}
                    aria-label={open ? d.name : `${d.name} (chưa mở khóa)`}
                    aria-pressed={on}
                    onClick={() => (open ? setDecor(d.id) : selectLocked())}
                    className={`relative shrink-0 flex flex-col items-center w-16 rounded-xl py-1 ${on ? 'bg-pink-200 ring-2 ring-pink-500' : 'bg-slate-100'} ${open ? '' : 'opacity-50'}`}
                  >
                    <span className="text-2xl leading-9">{d.icon}</span>
                    <span className="text-[10px] font-black leading-tight text-slate-700 text-center">{d.name}</span>
                    {!open && <Lock className="absolute top-1 right-1 w-3.5 h-3.5 text-slate-600" />}
                  </button>
                );
              })}
            {tool === 'paint' &&
              PAINTS.map((c, k) => (
                <button
                  key={k}
                  data-testid={`island3d-color-${k}`}
                  aria-label={k ? PAINT_NAMES[k] : 'Xóa màu'}
                  aria-pressed={color === k}
                  onClick={() => setColor(k)}
                  className={`shrink-0 flex flex-col items-center w-12 rounded-xl py-1 ${color === k ? 'bg-sky-200 ring-2 ring-sky-500' : 'bg-slate-100'}`}
                >
                  <span className="block w-8 h-8 rounded-full border-2 border-white shadow" style={{ background: c || 'repeating-linear-gradient(45deg,#e2e8f0 0 4px,#ffffff 4px 8px)' }} />
                  <span className="text-[10px] font-black text-slate-700">{k ? PAINT_NAMES[k] : 'Xóa'}</span>
                </button>
              ))}
          </div>
          {tool === 'remove' && <p className="px-3 pb-1.5 -mt-0.5 text-[11px] font-bold text-rose-600">Chạm vào khối hoặc đồ trang trí để xóa • chọn khối để đặt lại</p>}
        </div>

        {/* Toolbar */}
        <div className="relative z-20 grid grid-cols-5 gap-1.5 px-2 pb-2">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              data-testid={`island3d-tool-${t.id}`}
              aria-pressed={tool === t.id}
              className={`flex flex-col items-center justify-center rounded-2xl py-2 shadow-lg active:scale-95 transition ${tool === t.id ? 'bg-amber-400 text-amber-950 -translate-y-0.5' : 'bg-white/90 text-slate-700'}`}
            >
              <span className="text-2xl leading-none">{t.icon}</span>
              <span className="mt-0.5 text-[11px] font-black whitespace-nowrap">{t.label}</span>
            </button>
          ))}
          <button onClick={doUndo} disabled={!hud.canUndo} data-testid="island3d-tool-undo" className="flex flex-col items-center justify-center rounded-2xl py-2 shadow-lg bg-white/90 text-slate-700 active:scale-95 disabled:opacity-40">
            <RotateCcw className="w-6 h-6" />
            <span className="mt-0.5 text-[11px] font-black whitespace-nowrap">Hoàn tác</span>
          </button>
        </div>

        {/* Quests */}
        {panel === 'quests' && (
          <Sheet title="📜 Nhiệm vụ" onClose={() => setPanel(null)} testId="island3d-quest-panel">
            <ul className="flex flex-col gap-2">
              {openWishes.map((r) => {
                const pr = hud.progress[r.wishId] || { have: 0, need: 1 };
                const needs = WISH_NEEDS[r.wishId];
                return (
                  <li key={r.key} className="flex items-center gap-2 rounded-2xl bg-violet-50 p-2">
                    <Avatar r={r} className="w-11 h-11 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-800">{wishText(r.name, r.wishId)}</span>
                      <span className="flex items-center gap-2">
                        <Bar {...pr} />
                        <span className="text-xs font-black text-violet-700 tabular-nums">
                          {pr.have}/{pr.need}
                        </span>
                      </span>
                      {needs && !unlocked.has(needs) && <span className="block text-[11px] font-bold text-amber-700">🔒 Cần mở khóa {itemName(needs)} trước</span>}
                      <span className="block text-[11px] font-bold text-amber-600">Thưởng 🪙 {WISH_BY_ID[r.wishId].reward}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {hud.done.length > 0 && (
              <>
                <p className="mt-3 mb-1 text-xs font-black text-emerald-700">Đã hoàn thành</p>
                <ul className="flex flex-wrap gap-1.5">
                  {hud.done.map((id) => (
                    <li key={id} className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                      <Check className="w-3.5 h-3.5" /> {WISH_BY_ID[id].text.replace(/^muốn /, '')}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {guestCount < MAX_GUESTS && guests.length > 0 && <p className="mt-3 text-xs font-bold text-slate-500">Mời thêm bạn đến đảo để có thêm điều ước! 🏠</p>}
          </Sheet>
        )}

        {/* Residents */}
        {panel === 'residents' && (
          <Sheet title="🏠 Cư dân trên đảo" onClose={() => setPanel(null)} testId="island3d-resident-panel">
            <ul className="grid grid-cols-4 gap-2">
              {hud.residents.map((r) => (
                <li key={r.key} className="flex flex-col items-center gap-0.5">
                  <Avatar r={r} className="w-14 h-14" />
                  <span className="text-[11px] font-black text-slate-700 truncate max-w-full">{r.name}</span>
                  {r.hasHome && <span className="text-[10px] font-bold text-emerald-700">🏡 có nhà</span>}
                </li>
              ))}
            </ul>
            <p className="mt-3 mb-1 text-sm font-black text-sky-700">
              Mời bạn đến ở ({guestCount}/{MAX_GUESTS})
            </p>
            {guestCount >= MAX_GUESTS ? (
              <p className="text-xs font-bold text-slate-500">Đảo đã đủ bạn rồi!</p>
            ) : guests.length ? (
              <ul className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                {guests.map((g) => (
                  <li key={g.name} className="flex items-center gap-2 rounded-2xl bg-sky-50 p-1.5">
                    <Avatar r={g} className="w-10 h-10" />
                    <span className="flex-1 text-sm font-bold text-slate-800">{g.name}</span>
                    <button onClick={() => invite(g)} data-testid={`island3d-invite-${g.name}`} className="flex items-center gap-1 rounded-xl bg-sky-500 px-3 py-1.5 text-sm font-black text-white shadow active:scale-95">
                      <Plus className="w-4 h-4" /> Mời
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs font-bold text-slate-500">Quét thêm thẻ Pokémon để mời bạn mới nhé!</p>
            )}
          </Sheet>
        )}

        {/* Confirm new island */}
        {panel === 'confirm' && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 px-6" data-testid="island3d-confirm">
            <div className="result-rise w-full max-w-xs rounded-3xl bg-white p-4 text-center shadow-2xl">
              <p className="text-4xl">🏝️</p>
              <p className="mt-1 text-lg font-black text-slate-800">Làm đảo mới?</p>
              <p className="mt-1 text-sm font-bold text-slate-500">Mọi thứ bé đã xây sẽ biến mất. Các điều ước đã xong và đồ đã mở khóa vẫn được giữ.</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setPanel(null)} data-testid="island3d-confirm-no" className="flex-1 rounded-2xl bg-slate-200 py-2.5 font-black text-slate-700 active:scale-95">
                  Thôi
                </button>
                <button onClick={newIsland} data-testid="island3d-confirm-yes" className="flex-1 rounded-2xl bg-rose-500 py-2.5 font-black text-white active:scale-95">
                  Làm mới
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Wish fulfilled */}
        {celebrate && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 px-5" data-testid="island3d-celebrate" data-wish={celebrate.wishId}>
            <div className="result-rise w-full max-w-xs rounded-3xl bg-gradient-to-b from-amber-50 to-pink-50 p-4 text-center shadow-2xl">
              <p className="text-sm font-black text-pink-600">✨ Điều ước thành sự thật! ✨</p>
              <div className="island3d-hop mx-auto mt-2 w-fit">
                <Avatar r={celebrate} className="w-20 h-20" />
              </div>
              <p className="mt-2 text-base font-black text-slate-800">{wishText(celebrate.name, celebrate.wishId).replace(' muốn ', ' đã có ')}</p>
              {celebrate.home && <p className="text-sm font-bold text-emerald-700">🏡 {celebrate.name} chuyển vào nhà mới!</p>}
              <div className="mt-3 flex justify-center">
                <GoldReward amount={celebrate.gold} />
              </div>
              {celebrate.unlocks.length > 0 && (
                <p className="mt-2 text-sm font-bold text-violet-700" data-testid="island3d-unlocks">
                  🔓 Mở khóa: {celebrate.unlocks.map(itemName).join(', ')}
                </p>
              )}
              <button onClick={() => setCelebrate(null)} data-testid="island3d-celebrate-ok" className="mt-3 w-full rounded-2xl bg-emerald-500 py-3 text-lg font-black text-white shadow-lg active:scale-95">
                Tuyệt vời!
              </button>
            </div>
          </div>
        )}

        {glError && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-sky-900 px-8 text-center" data-testid="island3d-webgl-error">
            <p className="text-5xl">🏝️</p>
            <p className="text-lg font-black text-white">Máy này chưa vẽ được thế giới 3D</p>
            <p className="text-sm font-bold text-white/80">Bé thử mở trên máy khác hoặc trình duyệt khác nhé!</p>
            <button onClick={close} className="rounded-2xl bg-white px-6 py-3 font-black text-sky-800 shadow active:scale-95">
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function Sheet({ title, onClose, children, testId }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/40" data-testid={testId} onClick={onClose}>
      <div className="island3d-sheet w-full max-h-[75%] overflow-y-auto rounded-t-3xl bg-white p-3 pb-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center">
          <p className="text-lg font-black text-slate-800">{title}</p>
          <button onClick={onClose} aria-label="Đóng bảng" className="ml-auto rounded-full bg-slate-100 p-1.5 text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
