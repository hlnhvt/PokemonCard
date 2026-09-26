import React, { useRef, useState } from 'react';
import { ARCH_W as W, ARCH_H as H, ROUNDS, createArchery, stepArchery, shoot, rivalAim, targetAt, sway, totals } from '../../utils/sports/archery';
import { TYPE_VI } from '../../utils/battle/typeChart';
import { sounds } from '../../utils/soundEffects';
import { SportsShell, Banner, VsIntro, MatchResult } from './SportsCommon';
import { useLoop, useLater, useCanvas, pickOpponents, loadImage, drawSprite } from './sportsKit';
import { paletteOf, drawSkillShot, drawParticles, drawFlashes, impactFx, castFx } from '../moba/skillFx';

const TAU = Math.PI * 2;
const AIM_LIFT = 70; // the crosshair sits above the finger so the finger never hides it
const RING_COLORS = ['#facc15', '#facc15', '#ef4444', '#ef4444', '#3b82f6', '#3b82f6', '#1e293b', '#1e293b', '#f8fafc', '#f8fafc'];

// Types of the well-known rivals (for their skill's colour and shape)
const RIVAL_TYPES = {
  Bulbasaur: 'grass', Venusaur: 'grass', Charmander: 'fire', Charizard: 'fire', Squirtle: 'water', Blastoise: 'water', Pikachu: 'electric',
  Vulpix: 'fire', Jigglypuff: 'fairy', Meowth: 'normal', Psyduck: 'water', Growlithe: 'fire', Gengar: 'ghost', Magikarp: 'water',
  Gyarados: 'water', Lapras: 'ice', Ditto: 'normal', Eevee: 'normal', Snorlax: 'normal', Dragonite: 'dragon', Mewtwo: 'psychic', Mew: 'psychic',
  Chikorita: 'grass', Cyndaquil: 'fire', Totodile: 'water', Pichu: 'electric', Togepi: 'fairy', Marill: 'water', Umbreon: 'dark',
  Piplup: 'water', Lucario: 'fighting', Greninja: 'water', Sylveon: 'fairy', Rowlet: 'grass', Litten: 'fire', Popplio: 'water',
};
const typeOf = (p) => String(p?.types?.[0] || RIVAL_TYPES[p?.name] || 'normal').toLowerCase();

function drawRange(ctx, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, 200);
  sky.addColorStop(0, '#7dd3fc');
  sky.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, 200);
  // Far hills
  ctx.fillStyle = '#86efac';
  ctx.beginPath();
  ctx.moveTo(0, 190);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 160 + Math.sin(x / 55) * 16);
  ctx.lineTo(W, 200);
  ctx.lineTo(0, 200);
  ctx.fill();
  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (const [cx, cy, s] of [[40, 50, 1], [250, 30, 0.8], [330, 80, 0.6]]) {
    const x = ((cx + t * 6 * s) % (W + 90)) - 45;
    ctx.beginPath();
    ctx.arc(x, cy, 13 * s, 0, TAU);
    ctx.arc(x + 15 * s, cy - 7 * s, 16 * s, 0, TAU);
    ctx.arc(x + 32 * s, cy, 12 * s, 0, TAU);
    ctx.fill();
  }
  // Grass floor with perspective stripes
  const g = ctx.createLinearGradient(0, 190, 0, H);
  g.addColorStop(0, '#4ade80');
  g.addColorStop(1, '#15803d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 190, W, H - 190);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 20, 200);
    ctx.lineTo(W / 2 + i * 110, H);
    ctx.stroke();
  }
}

function drawTarget(ctx, tg, wobble, marks) {
  // Stand
  ctx.fillStyle = '#78350f';
  ctx.fillRect(tg.x - tg.r * 0.55, tg.y + tg.r * 0.6, 8, tg.r * 1.1);
  ctx.fillRect(tg.x + tg.r * 0.55 - 8, tg.y + tg.r * 0.6, 8, tg.r * 1.1);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(tg.x, tg.y + tg.r * 1.7, tg.r * 0.9, 10, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(tg.x, tg.y);
  ctx.rotate(wobble * 0.06);
  ctx.fillStyle = '#92400e';
  ctx.beginPath();
  ctx.arc(0, 0, tg.r + 6, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 10; i++) {
    const rr = tg.r * (1 - i / 10);
    ctx.fillStyle = RING_COLORS[9 - i];
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = i >= 8 ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.font = '900 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('10', 0, 3.5);
  // Marks left by earlier shots
  for (const m of marks) {
    ctx.fillStyle = m.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(m.dx, m.dy, 5, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawCrosshair(ctx, p, color, t) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.rotate(t * 1.5);
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(24, 0);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawWind(ctx, wind) {
  const x = W / 2;
  const y = 26;
  ctx.fillStyle = 'rgba(15,23,42,0.65)';
  ctx.beginPath();
  ctx.roundRect(x - 70, y - 16, 140, 32, 16);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const strength = Math.abs(wind);
  ctx.fillText(strength < 0.05 ? '🍃 Lặng gió' : `🍃 Gió ${wind < 0 ? '←' : '→'} ${Math.round(strength * 10)}`, x, y + 5);
  // Arrow length shows the strength
  if (strength >= 0.05) {
    const dir = Math.sign(wind);
    const len = 12 + strength * 40;
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - (dir * len) / 2, y + 26);
    ctx.lineTo(x + (dir * len) / 2, y + 26);
    ctx.lineTo(x + (dir * len) / 2 - dir * 7, y + 20);
    ctx.moveTo(x + (dir * len) / 2, y + 26);
    ctx.lineTo(x + (dir * len) / 2 - dir * 7, y + 32);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
}

const snapshot = (s) => ({ status: s.status, turn: s.turn, round: s.round, totals: totals(s), shots: { player: s.shots.player.map((x) => x.score), rival: s.shots.rival.map((x) => x.score) } });

/**
 * "Bắn trúng đích": the child's Pokemon and a rival take turns firing their skill at a
 * target. Hold to aim (the crosshair sways a little), release to fire; the wind pushes the
 * shot. 5 rounds each, the higher total wins.
 */
export function ArcheryGame({ player, onClose, onBerries, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [rival, setRival] = useState(() => pickOpponents(player.name, 1, random)[0]);
  const [first] = useState(() => createArchery({ random }));
  const game = useRef(first);
  const fx = useRef({ particles: [], trails: new Map(), flashes: [], impacts: [], novas: [], castPulse: {}, time: 0, wobble: 0, aim: null, rivalAim: null, marks: [], pops: [] });
  const [phase, setPhase] = useState('intro'); // intro | play | done
  const [ui, setUi] = useState(() => snapshot(first));
  const [banner, setBanner] = useState(null);
  const later = useLater();
  const imgs = { player: loadImage(player.image), rival: loadImage(rival.image) };
  const types = { player: typeOf(player), rival: typeOf(rival) };
  const say = (text, tone) => setBanner((b) => ({ id: (b?.id || 0) + 1, text, tone }));
  const sync = () => setUi(snapshot(game.current));
  const shooterAt = (who) => ({ x: who === 'player' ? W * 0.27 : W * 0.73, y: H - 70 });

  // The rival thinks for a moment, moves its crosshair, then fires
  const rivalTurn = () => {
    const v = fx.current;
    later(() => {
      const s = game.current;
      if (s.status !== 'aim' || s.turn !== 'rival') return;
      v.rivalAim = { from: { x: W / 2 + (random() - 0.5) * 120, y: 380 }, to: null, t: 0 };
      later(() => {
        const g = game.current;
        if (g.status !== 'aim' || g.turn !== 'rival') return;
        const aim = rivalAim(g);
        v.rivalAim.to = aim;
        later(() => {
          const g2 = game.current;
          if (g2.status !== 'aim' || g2.turn !== 'rival') return;
          fireAt('rival', aim);
          v.rivalAim = null;
        }, 450);
      }, 650);
    }, 700);
  };

  const fireAt = (who, aim) => {
    const s = game.current;
    if (!shoot(s, aim)) return;
    const from = shooterAt(who);
    castFx(fx.current, types[who], from.x, from.y - 30, { x: (aim.x - from.x) / 300, y: -1 });
    sounds.playWhoosh();
    sync();
  };

  // Hold to aim, release to fire
  const pointer = useRef(null);
  const toCanvas = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect?.width) return { x: W / 2, y: H / 2 };
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  };
  const canAim = () => phase === 'play' && game.current.status === 'aim' && game.current.turn === 'player';
  const onDown = (e) => {
    if (!canAim()) return;
    pointer.current = toCanvas(e);
    fx.current.aim = { x: pointer.current.x, y: pointer.current.y - AIM_LIFT };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!pointer.current) return;
    pointer.current = toCanvas(e);
  };
  const onUp = () => {
    if (!pointer.current || !canAim()) {
      pointer.current = null;
      return;
    }
    const aim = fx.current.aim;
    pointer.current = null;
    fx.current.aim = null;
    if (aim) fireAt('player', aim);
  };

  useLoop((dt) => {
    const s = game.current;
    const v = fx.current;
    v.time += dt;
    v.wobble = Math.max(0, v.wobble - dt * 3);
    if (phase === 'play') stepArchery(s, dt);
    // The crosshair follows the finger and sways
    if (pointer.current && v.aim) {
      const sw = sway(s.time, s.round);
      const want = { x: pointer.current.x + sw.x, y: pointer.current.y - AIM_LIFT + sw.y };
      v.aim.x += (want.x - v.aim.x) * Math.min(1, dt * 18);
      v.aim.y += (want.y - v.aim.y) * Math.min(1, dt * 18);
    }
    for (const e of s.events.splice(0)) {
      if (e.type === 'hit') {
        const tg = targetAt(s.round, s.time);
        const color = e.who === 'player' ? '#38bdf8' : '#f43f5e';
        if (e.score > 0) {
          v.marks.push({ dx: e.x - tg.x, dy: e.y - tg.y, color });
          v.wobble = 1;
          impactFx(v, types[e.who], e.x, e.y);
          sounds.playPop();
        } else sounds.playOops?.();
        v.pops.push({ x: e.x, y: e.y - 20, text: e.score ? String(e.score) : 'Trượt!', color: e.score === 10 ? '#fde047' : e.score >= 8 ? '#fb923c' : '#ffffff', size: e.score === 10 ? 44 : 32, life: 1, max: 1 });
        if (e.bull) {
          say('HỒNG TÂM! 🎯', 'gold');
          sounds.playCoin();
        } else if (e.score === 0) say('Trượt rồi!', 'red');
        sync();
        if (s.status === 'aim' && s.turn === 'rival') rivalTurn();
      } else if (e.type === 'round') {
        later(() => say(`Lượt ${e.round + 1}/${ROUNDS}`, 'blue'), 500);
      } else if (e.type === 'end') {
        later(() => {
          setPhase('done');
          sync();
        }, 1300);
      }
    }
    const ctx = getCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawRange(ctx, v.time);
    const tg = targetAt(s.round, s.time);
    drawTarget(ctx, tg, Math.sin(v.time * 30) * v.wobble, v.marks);
    drawWind(ctx, s.wind);
    // The two Pokemon at the shooting line
    for (const who of ['player', 'rival']) {
      const p = shooterAt(who);
      const active = s.turn === who && s.status !== 'done';
      if (active) {
        const c = paletteOf(types[who])[1];
        const glow = ctx.createRadialGradient(p.x, p.y + 20, 4, p.x, p.y + 20, 60);
        glow.addColorStop(0, `${c}99`);
        glow.addColorStop(1, `${c}00`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 24, 60, 22, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 34, 34, 10, 0, 0, TAU);
      ctx.fill();
      const bob = active ? Math.sin(v.time * 6) * 3 : 0;
      drawSprite(ctx, imgs[who], p.x, p.y - bob, active ? 92 : 76, { flip: who === 'player', alpha: active ? 1 : 0.75 });
    }
    // Flying skill: from the shooter to where it lands, shrinking with distance and arcing up
    const f = s.flight;
    if (f) {
      const k = Math.min(1, f.t / f.dur);
      const from = shooterAt(f.who);
      const x = from.x + (f.to.x - from.x) * k;
      const y = from.y - 30 + (f.to.y - from.y + 30) * k - Math.sin(k * Math.PI) * 70;
      const k2 = Math.min(1, k + 0.02);
      const nx = from.x + (f.to.x - from.x) * k2;
      const ny = from.y - 30 + (f.to.y - from.y + 30) * k2 - Math.sin(k2 * Math.PI) * 70;
      drawSkillShot(ctx, { id: `shot-${s.round}-${f.who}`, x, y, vx: nx - x, vy: ny - y, r: 13 - k * 6, type: types[f.who] }, v, v.time, dt);
    } else v.trails.clear();
    drawParticles(ctx, v, dt);
    drawFlashes(ctx, v, dt);
    // Crosshairs
    if (v.aim) drawCrosshair(ctx, v.aim, paletteOf(types.player)[1], v.time);
    if (v.rivalAim) {
      const ra = v.rivalAim;
      ra.t += dt;
      const to = ra.to || ra.from;
      ra.cur = ra.cur || { ...ra.from };
      ra.cur.x += (to.x - ra.cur.x) * Math.min(1, dt * 6);
      ra.cur.y += (to.y - ra.cur.y) * Math.min(1, dt * 6);
      drawCrosshair(ctx, ra.cur, '#f43f5e', v.time);
    }
    // Score pop-ups
    for (let i = v.pops.length - 1; i >= 0; i--) {
      const p = v.pops[i];
      p.life -= dt;
      if (p.life <= 0) {
        v.pops.splice(i, 1);
        continue;
      }
      const k = 1 - p.life / p.max;
      const sc = k < 0.15 ? 0.5 + k * 4 : 1.1;
      ctx.globalAlpha = Math.min(1, p.life * 2.5);
      ctx.font = `900 ${Math.round(p.size * sc)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(p.text, p.x, p.y - k * 40);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y - k * 40);
      ctx.globalAlpha = 1;
    }
  }, phase !== 'done');

  const replay = () => {
    game.current = createArchery({ random });
    Object.assign(fx.current, { particles: [], flashes: [], impacts: [], marks: [], pops: [], aim: null, rivalAim: null });
    fx.current.trails.clear();
    setRival(pickOpponents(player.name, 1, random)[0]);
    setBanner(null);
    setPhase('intro');
    sync();
  };

  const t = ui.totals;
  const result = t.player > t.rival ? 'win' : t.player < t.rival ? 'lose' : 'draw';
  const myTurn = phase === 'play' && ui.status === 'aim' && ui.turn === 'player';

  return (
    <SportsShell
      title="🎯 Bắn trúng đích"
      label="Bắn trúng đích"
      player={player}
      opponent={rival}
      scores={[t.player, t.rival]}
      active={phase === 'play' ? ui.turn === 'player' ? 'player' : 'opponent' : null}
      onClose={onClose}
      background="bg-gradient-to-b from-sky-300 via-emerald-500 to-green-700"
      dataAttrs={{ 'data-phase': phase, 'data-turn': ui.turn, 'data-round': ui.round + 1 }}
    >
      <div className="relative z-10 flex items-center justify-center gap-1.5 px-3 py-1 bg-black/40" data-testid="archery-rounds">
        {Array.from({ length: ROUNDS }).map((_, i) => (
          <span key={i} className={`flex flex-col items-center w-12 rounded-xl py-0.5 text-[10px] font-black ${i === ui.round && phase === 'play' ? 'bg-amber-400 text-slate-900' : 'bg-white/10 text-white'}`}>
            <span className="text-sky-200">{ui.shots.player[i] ?? '·'}</span>
            <span className={i === ui.round && phase === 'play' ? 'text-rose-700' : 'text-rose-300'}>{ui.shots.rival[i] ?? '·'}</span>
          </span>
        ))}
      </div>
      <div
        className="relative flex-1 min-h-0 flex items-start justify-center overflow-hidden touch-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => (pointer.current = null)}
        data-testid="archery-stage"
      >
        <canvas ref={canvasRef} className="max-w-full max-h-full" style={{ aspectRatio: `${W} / ${H}`, width: '100%', height: 'auto' }} />
        {myTurn && (
          <p className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[90%] px-3 py-1.5 rounded-2xl bg-black/55 text-center text-white text-sm font-black pointer-events-none" data-testid="archery-hint">
            Chạm giữ để ngắm, thả tay để tung {TYPE_VI[types.player] ? `chiêu hệ ${TYPE_VI[types.player]}` : 'chiêu'}! Nhớ xem gió 🍃
          </p>
        )}
        {phase === 'play' && ui.status === 'aim' && ui.turn === 'rival' && (
          <p className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-2xl bg-rose-900/70 text-center text-white text-sm font-black pointer-events-none">
            Lượt của {rival.name}...
          </p>
        )}
        <Banner banner={banner} />
        {phase === 'intro' && (
          <VsIntro
            player={player}
            opponent={rival}
            subtitle={`Mỗi bên ${ROUNDS} lượt bắn. Ai nhiều điểm hơn sẽ thắng!`}
            onDone={() => {
              setPhase('play');
              say(`Lượt 1/${ROUNDS}`, 'blue');
            }}
          />
        )}
        {phase === 'done' && (
          <MatchResult result={result} player={player} opponent={rival} scores={[t.player, t.rival]} detail={`🎯 Hồng tâm: ${ui.shots.player.filter((x) => x === 10).length} – ${ui.shots.rival.filter((x) => x === 10).length}`} onReplay={replay} onClose={onClose} onBerries={onBerries} onGold={onGold} />
        )}
      </div>
    </SportsShell>
  );
}
