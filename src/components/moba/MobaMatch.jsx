import React, { useEffect, useRef, useState } from 'react';
import { usePortrait, landscapeStyle } from './landscape';
import { createMatch, step, timeLeft, fighterById, SKILLS, ULT_MAX, summary } from '../../utils/moba/engine';
import { decide } from '../../utils/moba/ai';
import { WORLD } from '../../utils/moba/map';
import { TYPE_VI } from '../../utils/battle/typeChart';
import { sounds } from '../../utils/soundEffects';
import { useLoop, loadImage } from '../sports/sportsKit';
import { renderMap, createFx, burstFx, typeColor, drawWorld, drawMinimap, TEAM_COLORS } from './mobaDraw';

const SIM_DT = 1 / 60;
const VIEW_H = 450; // world units visible vertically
const COUNTDOWN = 3;
const JOY_R = 55;
const KEYMOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function SkillButton({ label, name, cd, max, ready, big, onPress, color, charge, testId }) {
  const frac = max ? Math.min(1, cd / max) : 0;
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPress();
      }}
      aria-label={name}
      data-testid={testId}
      className={`relative rounded-full border-4 shadow-xl flex flex-col items-center justify-center text-white font-black select-none touch-none active:scale-90 transition-transform ${big ? 'w-24 h-24 text-sm' : 'w-16 h-16 text-[10px]'} ${ready ? 'border-white/90' : 'border-white/30'}`}
      style={{ background: `radial-gradient(circle at 35% 30%, ${color}, ${color}99 60%, #0f172a 100%)`, boxShadow: ready && big ? `0 0 24px 6px ${color}` : undefined }}
    >
      <span className="text-lg leading-none">{label}</span>
      <span className="px-1 leading-tight text-center drop-shadow line-clamp-2">{name}</span>
      {frac > 0 && (
        <span className="absolute inset-0 rounded-full flex items-center justify-center text-base font-black" style={{ background: `conic-gradient(rgba(15,23,42,0.75) ${frac * 360}deg, transparent 0)` }}>
          {Math.ceil(cd)}
        </span>
      )}
      {charge != null && charge < 1 && (
        <span className="absolute inset-[-6px] rounded-full pointer-events-none" style={{ background: `conic-gradient(#facc15 ${charge * 360}deg, rgba(255,255,255,0.15) 0)`, WebkitMask: 'radial-gradient(circle, transparent 62%, black 64%)', mask: 'radial-gradient(circle, transparent 62%, black 64%)' }} />
      )}
    </button>
  );
}

/**
 * The arena match itself (landscape). blue / red: members { name, image, types, power }.
 * onEnd(summary) when the time is up.
 */
export function MobaMatch({ blue, red, minutes, control = 0, random = Math.random, onEnd, onQuit }) {
  const portrait = usePortrait();
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const [initial] = useState(() => createMatch({ blue, red, duration: minutes * 60, random, control }));
  const stateRef = useRef(initial);
  const fxRef = useRef(null);
  const mapRef = useRef(null);
  const images = useRef({});
  const input = useRef({ joy: { x: 0, y: 0 }, keys: new Set(), cast: null });
  const memory = useRef({});
  const camera = useRef({ x: 0, y: 0 });
  const acc = useRef(0);
  const clock = useRef({ count: COUNTDOWN, time: 0, lastPop: 0, zoom: 1 });
  const joyEl = useRef(null);
  const [hud, setHud] = useState(() => hudOf(initial, COUNTDOWN));
  const [feed, setFeed] = useState([]);
  const [banner, setBanner] = useState(null);
  const [joyShow, setJoyShow] = useState(null);
  const ended = useRef(false);

  useEffect(() => {
    for (const f of initial.fighters) images.current[f.id] = loadImage(f.image);
    mapRef.current = renderMap();
    fxRef.current = createFx();
    fxRef.current.hitFlash = {};
  }, [initial]);

  const say = (text, tone = 'gold') => setBanner((b) => ({ id: (b?.id || 0) + 1, text, tone }));
  const nameOf = (id) => fighterById(stateRef.current, id)?.name || '';
  const teamOf = (id) => (id?.startsWith('blue') ? 'blue' : 'red');

  const switchTo = (id) => {
    const s = stateRef.current;
    const f = fighterById(s, id);
    if (!f || f.dead || s.control === id) return;
    s.control = id;
    sounds.playPop();
    setHud(hudOf(s, clock.current.count));
  };

  // Keyboard (desktop)
  useEffect(() => {
    const down = (e) => {
      if (KEYMOVE[e.code]) {
        input.current.keys.add(e.code);
        e.preventDefault();
      } else if (e.code === 'KeyQ' || e.code === 'KeyJ') input.current.cast = 's1';
      else if (e.code === 'KeyE' || e.code === 'KeyK') input.current.cast = 's2';
      else if (e.code === 'KeyR' || e.code === 'Space') input.current.cast = 'ult';
      else if (/^Digit[1-5]$/.test(e.code)) switchTo(`blue${Number(e.code.slice(5)) - 1}`);
    };
    const up = (e) => input.current.keys.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  // Floating joystick on the left part of the screen. When the game is turned for an
  // upright phone, screen movements are turned back into game directions.
  const toLocal = (dx, dy) => (portrait ? { x: dy, y: -dx } : { x: dx, y: dy });
  const onJoyDown = (e) => {
    const rect = stageRef.current.getBoundingClientRect();
    const local = portrait ? { x: (e.clientY - rect.top) / rect.height, y: (rect.right - e.clientX) / rect.width } : { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
    if (local.x > 0.45) return; // the right side is for the skill buttons
    joyEl.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY };
    setJoyShow({ x: local.x * 100, y: local.y * 100, dx: 0, dy: 0 });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onJoyMove = (e) => {
    const j = joyEl.current;
    if (!j || j.id !== e.pointerId) return;
    const d = toLocal(e.clientX - j.sx, e.clientY - j.sy);
    const len = Math.hypot(d.x, d.y);
    const k = len > JOY_R ? JOY_R / len : 1;
    input.current.joy = { x: (d.x * k) / JOY_R, y: (d.y * k) / JOY_R };
    setJoyShow((s) => (s ? { ...s, dx: d.x * k, dy: d.y * k } : s));
  };
  const onJoyUp = (e) => {
    if (joyEl.current?.id !== e.pointerId) return;
    joyEl.current = null;
    input.current.joy = { x: 0, y: 0 };
    setJoyShow(null);
  };

  const playEvents = (s, fx) => {
    const me = s.control;
    for (const e of s.events) {
      switch (e.kind) {
        case 'hit': {
          const c = typeColor(e.type);
          burstFx(fx, e.x, e.y + 10, c, { count: e.crit ? 18 : 9, speed: e.crit ? 240 : 160, size: e.crit ? 5 : 3.5 });
          fx.numbers.push({ x: e.x + (Math.random() - 0.5) * 16, y: e.y, text: `${e.crit ? '💥' : ''}-${e.amount}`, color: e.crit ? '#fde047' : e.eff >= 2 ? '#fb923c' : '#ffffff', size: e.crit ? 26 : e.eff >= 2 ? 22 : 17, life: 0.9, max: 0.9 });
          fx.hitFlash[e.target] = 1;
          if (e.target === me || e.from === me) fx.shake = Math.max(fx.shake, e.crit ? 0.25 : 0.1);
          if (clock.current.time - clock.current.lastPop > 0.08) {
            clock.current.lastPop = clock.current.time;
            sounds.playPop();
          }
          break;
        }
        case 'nova':
          fx.rings.push({ x: e.x, y: e.y, from: 10, to: e.r, life: 0.45, max: 0.45, color: typeColor(e.type), width: 10, fill: true });
          burstFx(fx, e.x, e.y, typeColor(e.type), { count: 26, speed: 300, size: 4 });
          if (e.who === me) {
            fx.shake = Math.max(fx.shake, 0.2);
            sounds.playWhoosh();
          }
          break;
        case 'cast':
          fx.rings.push({ x: fighterById(s, e.who).x, y: fighterById(s, e.who).y - 20, from: 8, to: 40, life: 0.3, max: 0.3, color: typeColor(e.type), width: 5 });
          if (e.who === me) sounds.playWhoosh();
          break;
        case 'ult':
          fx.slow = 0.55;
          fx.flash = 0.6;
          clock.current.zoom = 1.18;
          sounds.playEnergySurge();
          say(`${nameOf(e.who)}: ${e.name}!`, teamOf(e.who) === 'blue' ? 'blue' : 'red');
          fx.rings.push({ x: e.x, y: e.y - 10, from: 10, to: 90, life: 0.5, max: 0.5, color: typeColor(e.type), width: 12, fill: true });
          break;
        case 'combo-hit': {
          const c = typeColor(e.type);
          fx.rings.push({ x: e.x, y: e.y - 20, from: 6, to: e.final ? 120 : 60, life: e.final ? 0.6 : 0.3, max: e.final ? 0.6 : 0.3, color: e.final ? '#ffffff' : c, width: e.final ? 14 : 8 });
          burstFx(fx, e.x, e.y - 20, c, { count: e.final ? 50 : 18, speed: e.final ? 420 : 240, size: e.final ? 6 : 4 });
          fx.numbers.push({ x: e.x, y: e.y - 70, text: `x${e.n}${e.final ? '!!' : ''}`, color: '#facc15', size: e.final ? 42 : 30, life: 0.8, max: 0.8 });
          fx.shake = Math.max(fx.shake, e.final ? 0.55 : 0.2);
          if (e.final) {
            fx.flash = 0.8;
            clock.current.zoom = 1.25;
          }
          break;
        }
        case 'kill': {
          const v = fighterById(s, e.victim);
          burstFx(fx, e.x, e.y - 20, TEAM_COLORS[v.team], { count: 40, speed: 320, size: 5, life: 0.9 });
          fx.rings.push({ x: e.x, y: e.y, from: 10, to: 80, life: 0.5, max: 0.5, color: '#ffffff', width: 6 });
          const entry = { id: `${s.time}-${e.victim}`, killer: e.killer, victim: e.victim, killerName: fighterById(s, e.killer).name, victimName: v.name };
          setFeed((list) => [entry, ...list].slice(0, 4));
          if (e.multi) say(e.multi, teamOf(e.killer) === 'blue' ? 'gold' : 'red');
          else if (e.first) say('HẠ GỤC ĐẦU TIÊN!', teamOf(e.killer) === 'blue' ? 'gold' : 'red');
          else if (e.victim === me) say('Hồi sinh sau 5 giây...', 'red');
          if (teamOf(e.killer) === 'blue') sounds.playCoin();
          break;
        }
        case 'respawn':
          fx.beams.push({ x: e.x, y: e.y, life: 0.7, max: 0.7, color: TEAM_COLORS[teamOf(e.who)] });
          break;
        case 'pop':
          burstFx(fx, e.x, e.y, typeColor(e.type), { count: e.big ? 10 : 4, speed: 120, size: 3, life: 0.35 });
          break;
        default:
          break;
      }
    }
    s.events.length = 0;
  };

  useLoop((rawDt) => {
    const s = stateRef.current;
    const fx = fxRef.current;
    if (!fx) return;
    const c = clock.current;
    c.time += rawDt;

    // 3, 2, 1, then the match runs
    if (c.count > 0) {
      const before = Math.ceil(c.count);
      c.count -= rawDt;
      if (Math.ceil(Math.max(0, c.count)) !== before) {
        if (c.count > 0) sounds.playScanBeep();
        else {
          sounds.playEnergySurge();
          say('BẮT ĐẦU!', 'gold');
        }
        setHud(hudOf(s, c.count));
      }
    } else if (!s.over) {
      fx.slow = Math.max(0, fx.slow - rawDt);
      acc.current += rawDt * (fx.slow > 0 ? 0.35 : 1);
      let guard = 0;
      while (acc.current >= SIM_DT && guard++ < 6) {
        acc.current -= SIM_DT;
        const inputs = {};
        for (const f of s.fighters) {
          if (f.dead) continue;
          if (f.id === s.control) {
            const k = input.current.keys;
            let mx = input.current.joy.x;
            let my = input.current.joy.y;
            for (const code of k) {
              mx += KEYMOVE[code][0];
              my += KEYMOVE[code][1];
            }
            inputs[f.id] = { move: { x: Math.max(-1, Math.min(1, mx)), y: Math.max(-1, Math.min(1, my)) }, basic: true, cast: input.current.cast };
            input.current.cast = null;
          } else {
            inputs[f.id] = decide(s, f, (memory.current[f.id] ||= {}));
          }
        }
        step(s, SIM_DT, inputs);
        // Afterimages while an ultimate dashes
        for (const f of s.fighters) if (f.combo?.dashing) fx.afterimages.push({ id: f.id, x: f.x, y: f.y, flip: f.facing < 0, life: 0.3, max: 0.3 });
        playEvents(s, fx);
        if (s.over) break;
      }
      if (s.over && !ended.current) {
        ended.current = true;
        say(s.winner === 'blue' ? 'CHIẾN THẮNG!' : s.winner === 'red' ? 'THẤT BẠI' : 'HÒA!', s.winner === 'red' ? 'red' : 'gold');
        sounds.playSuccessFanfare();
        setTimeout(() => onEnd?.(summary(s)), 1800);
      }
    }
    for (const id of Object.keys(fx.hitFlash)) fx.hitFlash[id] = Math.max(0, fx.hitFlash[id] - rawDt * 5);
    fx.shake = Math.max(0, fx.shake - rawDt);
    fx.flash = Math.max(0, fx.flash - rawDt * 2);
    c.zoom += (1 - c.zoom) * Math.min(1, rawDt * 4);

    // Throttled HUD (10 times a second)
    c.hudT = (c.hudT || 0) + rawDt;
    if (c.hudT > 0.1) {
      c.hudT = 0;
      setHud(hudOf(s, c.count));
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) return;
    const cw = canvas.clientWidth || 800;
    const ch = canvas.clientHeight || 450;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    const scale = (ch / VIEW_H) * c.zoom;
    const view = { w: cw / scale, h: ch / scale };
    const me = fighterById(s, s.control);
    const target = me && !me.dead ? me : me ? { x: me.base.x, y: me.base.y } : { x: WORLD.w / 2, y: WORLD.h / 2 };
    const cam = camera.current;
    const tx = Math.max(0, Math.min(WORLD.w - view.w, target.x - view.w / 2));
    const ty = Math.max(0, Math.min(WORLD.h - view.h, target.y - view.h / 2));
    cam.x += (tx - cam.x) * Math.min(1, rawDt * 6);
    cam.y += (ty - cam.y) * Math.min(1, rawDt * 6);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    const shake = fx.shake > 0 ? fx.shake * 14 : 0;
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.scale(scale, scale);
    ctx.translate(-cam.x, -cam.y);
    if (mapRef.current) ctx.drawImage(mapRef.current, 0, 0, WORLD.w, WORLD.h);
    drawWorld(ctx, s, fx, images.current, c.time, rawDt, s.control);
    ctx.restore();
    if (fx.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${fx.flash * 0.45})`;
      ctx.fillRect(0, 0, cw, ch);
    }
    if (fx.slow > 0) {
      // Slow motion: dark edges while an ultimate plays
      const g = ctx.createRadialGradient(cw / 2, ch / 2, ch * 0.3, cw / 2, ch / 2, ch * 0.9);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(30,0,60,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, ch);
    }
    drawMinimap(ctx, s, cam, view, cw - 170, 54, 160);
  }, true);

  const me = hud.fighters.find((f) => f.id === hud.control);
  const stageStyle = landscapeStyle(portrait);

  return (
    <div className="fixed inset-0 z-[80] bg-black select-none touch-none" role="dialog" aria-label="Đấu trường Pokémon" data-over={hud.over} data-control={hud.control} data-portrait={portrait}>
      <div ref={stageRef} style={stageStyle} className="overflow-hidden" onPointerDown={onJoyDown} onPointerMove={onJoyMove} onPointerUp={onJoyUp} onPointerCancel={onJoyUp} data-testid="moba-stage">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" data-testid="moba-canvas" />

        {/* Top: score and time */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-1.5 rounded-2xl bg-slate-950/75 border border-white/20 shadow-xl pointer-events-none" data-testid="moba-score">
          <span className="text-2xl font-black text-sky-300 tabular-nums">{hud.score.blue}</span>
          <span className={`text-lg font-black tabular-nums ${hud.left <= 10 ? 'text-rose-400 hint-pulse' : 'text-white'}`}>{fmt(hud.left)}</span>
          <span className="text-2xl font-black text-rose-400 tabular-nums">{hud.score.red}</span>
        </div>

        {/* Top left: the child's team, tap to take control */}
        <div className="absolute top-2 left-2 flex gap-1.5" data-testid="moba-team">
          {hud.fighters
            .filter((f) => f.team === 'blue')
            .map((f, i) => (
              <button
                key={f.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  switchTo(f.id);
                }}
                aria-label={`Điều khiển ${f.name}`}
                aria-pressed={f.id === hud.control}
                className={`relative w-12 h-12 rounded-xl border-2 bg-slate-900/80 overflow-hidden ${f.id === hud.control ? 'border-amber-300 scale-110 shadow-[0_0_12px_rgba(252,211,77,0.9)]' : 'border-sky-400/60'} transition-transform`}
              >
                <img src={f.image} alt="" className={`w-full h-full object-contain ${f.dead ? 'grayscale opacity-40' : ''}`} />
                <span className="absolute left-0.5 top-0 text-[9px] font-black text-white drop-shadow">{i + 1}</span>
                <span className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
                  <span className="block h-full bg-emerald-400" style={{ width: `${f.hpRatio * 100}%` }} />
                </span>
                {f.ultReady && !f.dead && <span className="absolute right-0.5 top-0 text-[10px]">⚡</span>}
                {f.dead && <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-white">{Math.ceil(f.respawnIn)}</span>}
              </button>
            ))}
        </div>

        {/* Kill feed under the minimap */}
        <div className="absolute right-2 top-[150px] flex flex-col items-end gap-1 pointer-events-none" data-testid="moba-feed">
          {feed.map((k) => (
            <div key={k.id} className="pop-in flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950/70 text-[11px] font-black">
              <span className={teamOf(k.killer) === 'blue' ? 'text-sky-300' : 'text-rose-300'}>{k.killerName}</span>
              <span className="text-white">⚔️</span>
              <span className={teamOf(k.victim) === 'blue' ? 'text-sky-300' : 'text-rose-300'}>{k.victimName}</span>
            </div>
          ))}
        </div>

        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            onQuit?.();
          }}
          aria-label="Thoát trận"
          className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-slate-950/70 text-white text-xs font-black border border-white/20"
        >
          ✕ Thoát
        </button>

        {/* Joystick */}
        {joyShow ? (
          <div className="absolute w-[120px] h-[120px] -ml-[60px] -mt-[60px] rounded-full border-4 border-white/40 bg-white/10 pointer-events-none" style={{ left: `${joyShow.x}%`, top: `${joyShow.y}%` }}>
            <span className="absolute left-1/2 top-1/2 w-14 h-14 -ml-7 -mt-7 rounded-full bg-white/70 shadow-xl" style={{ transform: `translate(${joyShow.dx}px, ${joyShow.dy}px)` }} />
          </div>
        ) : (
          <div className="absolute left-8 bottom-8 w-[120px] h-[120px] rounded-full border-4 border-dashed border-white/30 flex items-center justify-center text-white/60 text-xs font-black pointer-events-none">
            Kéo để đi
          </div>
        )}

        {/* Skills */}
        {me && (
          <div className="absolute right-4 bottom-4 flex items-end gap-3" data-testid="moba-skills">
            <div className="flex flex-col gap-3 mb-1">
              <SkillButton label="1" name={me.kit[1]} cd={me.cd.s1} max={SKILLS.s1.cd} ready={me.cd.s1 <= 0 && !me.dead} color={typeColor(me.types[0])} onPress={() => (input.current.cast = 's1')} testId="skill-s1" />
              <SkillButton label="2" name={me.kit[2]} cd={me.cd.s2} max={SKILLS.s2.cd} ready={me.cd.s2 <= 0 && !me.dead} color={typeColor(me.types[0])} onPress={() => (input.current.cast = 's2')} testId="skill-s2" />
            </div>
            <SkillButton label="⚡" name={me.kit[3]} cd={0} max={0} big ready={me.ult >= ULT_MAX && !me.dead} charge={me.ult / ULT_MAX} color={me.ult >= ULT_MAX ? '#f59e0b' : '#64748b'} onPress={() => (input.current.cast = 'ult')} testId="skill-ult" />
          </div>
        )}
        {me && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-2 px-3 py-1 rounded-full bg-slate-950/70 text-[11px] font-black text-white pointer-events-none">
            {me.name} · Hệ {TYPE_VI[me.types[0]]} · Tự đánh thường khi đối thủ ở gần
          </div>
        )}

        {hud.count > 0 && (
          <div key={Math.ceil(hud.count)} className="count-pop absolute left-1/2 top-[42%] text-8xl font-black text-white sport-banner pointer-events-none" data-testid="moba-countdown">
            {Math.ceil(hud.count)}
          </div>
        )}
        {banner && (
          <div key={banner.id} className="banner-slam absolute z-40 left-1/2 top-[32%] pointer-events-none" data-testid="moba-banner">
            <span className={`block px-5 py-2 rounded-2xl text-white text-2xl sm:text-3xl font-black whitespace-nowrap shadow-2xl border-2 border-white/70 bg-gradient-to-r ${banner.tone === 'blue' ? 'from-sky-400 to-blue-700' : banner.tone === 'red' ? 'from-rose-500 to-red-800' : 'from-amber-300 to-orange-600'}`}>
              {banner.text}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function hudOf(s, count) {
  return {
    count,
    over: s.over,
    control: s.control,
    left: timeLeft(s),
    score: { ...s.score },
    fighters: s.fighters.map((f) => ({ id: f.id, team: f.team, name: f.name, image: f.image, types: f.types, kit: f.kit, dead: f.dead, respawnIn: f.respawnIn, hpRatio: Math.max(0, f.hp / f.maxHp), ult: f.ult, ultReady: f.ult >= ULT_MAX, cd: { ...f.cd } })),
  };
}
