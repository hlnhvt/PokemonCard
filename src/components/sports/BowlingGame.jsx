import React, { useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  FRAMES,
  HEAD_PIN_Y,
  LANE_END,
  LANE_HALF,
  AIM_TO_LANE,
  BALL_R,
  pinLayout,
  createRoll,
  stepRoll,
  knockedIds,
  standingIds,
  aiThrow,
  frameScore,
} from '../../utils/sports/bowling';
import { swing, pulse, matchResult } from '../../utils/sports/common';
import { sounds } from '../../utils/soundEffects';
import { SportsShell, VsIntro, Banner, MatchResult } from './SportsCommon';
import { useLoop, useLater, useCanvas, pickOpponents, drawPokeball, burst, updateParticles } from './sportsKit';

const W = 360;
const H = 560;
const VANISH_Y = 64;
const FOUL_Y = 520;
const LANE_PX = 118; // half lane width at the foul line
const DEPTH = 0.2;
const AIM_SPEED = 0.33; // arrow swings per second (slow for children)
const POWER_SPEED = 0.5;
const AIM_AMPLITUDE = 0.9;

function project(x, z) {
  const s = 1 / (1 + z * DEPTH);
  return { x: W / 2 + x * LANE_PX * s, y: VANISH_Y + (FOUL_Y - VANISH_Y) * s, s };
}

function lanePolygon(ctx, half, z0, z1) {
  const a = project(-half, z0);
  const b = project(half, z0);
  const c = project(half, z1);
  const d = project(-half, z1);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
}

function drawLane(ctx, time) {
  // Back wall with neon sign
  const wall = ctx.createLinearGradient(0, 0, 0, 240);
  wall.addColorStop(0, '#1e1b4b');
  wall.addColorStop(1, '#312e81');
  ctx.fillStyle = wall;
  ctx.fillRect(-40, -40, W + 80, H + 80);
  ctx.save();
  ctx.shadowColor = '#f472b6';
  ctx.shadowBlur = 14 + Math.sin(time * 3) * 4;
  ctx.fillStyle = '#fbcfe8';
  ctx.font = '900 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('POKÉ BOWL', W / 2, 44);
  ctx.restore();
  // Side lanes (darker) and the pin-deck light
  ctx.fillStyle = '#1e293b';
  lanePolygon(ctx, LANE_HALF + 0.9, 0, LANE_END + 0.6);
  ctx.fill();
  // Gutters
  ctx.fillStyle = '#475569';
  lanePolygon(ctx, LANE_HALF + 0.3, 0, LANE_END + 0.6);
  ctx.fill();
  // Wooden lane
  const wood = ctx.createLinearGradient(0, FOUL_Y, 0, project(0, LANE_END).y);
  wood.addColorStop(0, '#f59e0b');
  wood.addColorStop(0.5, '#fbbf24');
  wood.addColorStop(1, '#fde68a');
  ctx.fillStyle = wood;
  lanePolygon(ctx, LANE_HALF, 0, LANE_END + 0.6);
  ctx.fill();
  // Boards
  ctx.strokeStyle = 'rgba(146, 64, 14, 0.22)';
  ctx.lineWidth = 1;
  for (let i = -6; i <= 6; i++) {
    const x = (i / 7) * LANE_HALF;
    const a = project(x, 0);
    const b = project(x, LANE_END + 0.6);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Shine along the lane
  const shine = ctx.createLinearGradient(W / 2 - 60, 0, W / 2 + 60, 0);
  shine.addColorStop(0, 'rgba(255,255,255,0)');
  shine.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  lanePolygon(ctx, 0.35, 0.5, LANE_END);
  ctx.fill();
  // Guide arrows
  ctx.fillStyle = 'rgba(190, 18, 60, 0.75)';
  for (let i = -3; i <= 3; i++) {
    const p = project((i / 4) * LANE_HALF, 3.2 + Math.abs(i) * 0.25);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 9 * p.s);
    ctx.lineTo(p.x + 5 * p.s, p.y + 4 * p.s);
    ctx.lineTo(p.x - 5 * p.s, p.y + 4 * p.s);
    ctx.fill();
  }
  // Foul line
  const f1 = project(-LANE_HALF, 0.05);
  const f2 = project(LANE_HALF, 0.05);
  ctx.strokeStyle = '#be123c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(f1.x, f1.y);
  ctx.lineTo(f2.x, f2.y);
  ctx.stroke();
  // Pin deck glow
  const deck = project(0, HEAD_PIN_Y + 0.7);
  const glow = ctx.createRadialGradient(deck.x, deck.y, 4, deck.x, deck.y, 70);
  glow.addColorStop(0, 'rgba(255,255,255,0.55)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(deck.x - 80, deck.y - 60, 160, 110);
}

function drawPin(ctx, pin, fall) {
  const p = project(pin.x, pin.y);
  const h = 70 * p.s;
  const w = 23 * p.s;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, w * 0.6, w * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(p.x, p.y);
  const dir = pin.vx === 0 ? (pin.id % 2 ? 1 : -1) : Math.sign(pin.vx);
  ctx.rotate(fall * dir * 1.45 + (pin.down ? pin.angle * 0.15 : 0));
  ctx.globalAlpha = 1 - Math.max(0, fall - 0.85) * 2;
  const body = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  body.addColorStop(0, '#e2e8f0');
  body.addColorStop(0.45, '#ffffff');
  body.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-w * 0.28, 0);
  ctx.bezierCurveTo(-w * 0.62, -h * 0.25, -w * 0.5, -h * 0.5, -w * 0.18, -h * 0.64);
  ctx.bezierCurveTo(-w * 0.26, -h * 0.8, -w * 0.3, -h, 0, -h);
  ctx.bezierCurveTo(w * 0.3, -h, w * 0.26, -h * 0.8, w * 0.18, -h * 0.64);
  ctx.bezierCurveTo(w * 0.5, -h * 0.5, w * 0.62, -h * 0.25, w * 0.28, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-w * 0.2, -h * 0.72, w * 0.4, h * 0.05);
  ctx.fillRect(-w * 0.19, -h * 0.63, w * 0.38, h * 0.05);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawAim(ctx, aim, time, color) {
  const start = project(0, 0.2);
  const target = project(aim * AIM_TO_LANE, HEAD_PIN_Y);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.setLineDash([12, 10]);
  ctx.lineDashOffset = -time * 40;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y - 24);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();
  ctx.setLineDash([]);
  // Arrow head
  const a = Math.atan2(target.y - start.y, target.x - start.x);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(target.x + Math.cos(a) * 12, target.y + Math.sin(a) * 12);
  ctx.lineTo(target.x + Math.cos(a + 2.4) * 12, target.y + Math.sin(a + 2.4) * 12);
  ctx.lineTo(target.x + Math.cos(a - 2.4) * 12, target.y + Math.sin(a - 2.4) * 12);
  ctx.fill();
  ctx.restore();
}

function drawPowerBar(ctx, power, time) {
  const x = W - 34;
  const top = 250;
  const h = 200;
  ctx.fillStyle = 'rgba(15,23,42,0.7)';
  ctx.beginPath();
  ctx.roundRect(x - 4, top - 4, 26, h + 8, 12);
  ctx.fill();
  const g = ctx.createLinearGradient(0, top + h, 0, top);
  g.addColorStop(0, '#22c55e');
  g.addColorStop(0.55, '#facc15');
  g.addColorStop(1, '#ef4444');
  ctx.fillStyle = g;
  const fill = h * power;
  ctx.beginPath();
  ctx.roundRect(x, top + h - fill, 18, fill, 9);
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${0.6 + Math.sin(time * 8) * 0.3})`;
  ctx.fillRect(x - 6, top + h - fill - 2, 30, 4);
}

function drawFrameStrip(frames) {
  return frames.map((f, i) => {
    if (!f) return <span key={i} className="text-white/30">·</span>;
    const text = f.mark === 'strike' ? 'X' : f.mark === 'spare' ? `${f.first}/` : `${f.first}${f.second != null ? `+${f.second}` : ''}`;
    return (
      <span key={i} className={f.mark === 'strike' ? 'text-amber-300' : f.mark === 'spare' ? 'text-sky-300' : 'text-white'}>
        {text}
      </span>
    );
  });
}

const freshGame = () => ({
  frame: 0,
  turn: 'player',
  rollInFrame: 0,
  first: 0,
  standing: null,
  phase: 'intro', // intro | aim | power | rolling | pause | done
  t: 0,
  aim: 0,
  power: 0,
  roll: null,
  plan: null,
  frames: { player: Array(FRAMES).fill(null), opponent: Array(FRAMES).fill(null) },
  totals: [0, 0],
  zoom: 1,
  shake: 0,
  flash: 0,
  hitSeen: false,
  fall: new Map(),
  particles: [],
  time: 0,
});

const snapshot = (s) => ({
  phase: s.phase,
  turn: s.turn,
  frame: s.frame,
  totals: [...s.totals],
  frames: { player: [...s.frames.player], opponent: [...s.frames.opponent] },
});

/**
 * Pokemon bowling against another Pokemon: tap once to stop the swinging arrow (aim),
 * tap again to stop the power bar. 5 frames each, strikes and spares earn bonus points.
 */
export function BowlingGame({ player, onClose, onBerries, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [opponent, setOpponent] = useState(() => pickOpponents(player.name, 1, random)[0]);
  // Mutable game state lives in a ref (the animation loop changes it every frame);
  // `ui` is the snapshot the markup renders from
  const [initial] = useState(freshGame);
  const game = useRef(initial);
  const [ui, setUi] = useState(() => snapshot(initial));
  const [banner, setBanner] = useState(null);
  const [hop, setHop] = useState(0);
  const rerender = () => setUi(snapshot(game.current));
  const later = useLater();
  const g = ui;
  const nameOf = (turn) => (turn === 'player' ? player.name : opponent.name);

  const say = (text, tone) => setBanner((b) => ({ id: (b?.id || 0) + 1, text, tone }));

  const beginRoll = () => {
    const s = game.current;
    s.phase = 'aim';
    s.t = 0;
    s.roll = null;
    s.hitSeen = false;
    s.fall = new Map();
    s.plan = s.turn === 'opponent' ? aiThrow(random) : null;
    rerender();
  };

  const launch = () => {
    const s = game.current;
    s.roll = createRoll({ aim: s.aim, power: s.power, standing: s.standing, random });
    s.phase = 'rolling';
    s.t = 0;
    setHop((n) => n + 1);
    sounds.playWhoosh();
    rerender();
  };

  const nextTurn = () => {
    const s = game.current;
    s.rollInFrame = 0;
    s.first = 0;
    s.standing = null;
    if (s.turn === 'player') {
      s.turn = 'opponent';
    } else {
      s.turn = 'player';
      s.frame += 1;
    }
    if (s.frame >= FRAMES) {
      s.phase = 'done';
      rerender();
      return;
    }
    beginRoll();
  };

  const finishRoll = () => {
    const s = game.current;
    const n = knockedIds(s.roll).length;
    const who = s.turn;
    const idx = who === 'player' ? 0 : 1;
    s.phase = 'pause';
    if (s.rollInFrame === 0 && n === 10) {
      const f = frameScore(10);
      s.frames[who][s.frame] = { ...f, first: 10 };
      s.totals[idx] += f.total;
      say('STRIKE!', 'gold');
      sounds.playSuccessFanfare();
      s.shake = 0.5;
      s.flash = 1;
      try {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.4 }, zIndex: 9999, colors: ['#fde047', '#f97316', '#ffffff'] });
      } catch {
        // decoration
      }
      later(nextTurn, 1900);
    } else if (s.rollInFrame === 0) {
      s.first = n;
      s.standing = standingIds(s.roll);
      s.frames[who][s.frame] = { first: n, second: null, mark: null, total: n };
      say(n === 0 ? 'Ối, trượt rồi!' : `${n} ki!`, n >= 7 ? 'green' : 'blue');
      if (n > 0) sounds.playCoin();
      s.rollInFrame = 1;
      later(beginRoll, 1500);
    } else {
      const f = frameScore(s.first, n);
      s.frames[who][s.frame] = { ...f, first: s.first, second: n };
      s.totals[idx] += f.total;
      if (f.mark === 'spare') {
        say('SPARE!', 'blue');
        sounds.playSuccessFanfare();
        s.flash = 0.6;
      } else {
        say(`${f.total} điểm`, 'green');
        if (n > 0) sounds.playCoin();
      }
      later(nextTurn, 1700);
    }
    rerender();
  };

  const tap = () => {
    const s = game.current;
    if (s.turn !== 'player') return;
    if (s.phase === 'aim') {
      s.phase = 'power';
      s.t = 0;
      sounds.playPop();
      rerender();
    } else if (s.phase === 'power') {
      launch();
    }
  };

  useLoop((dt) => {
    const s = game.current;
    s.time += dt;
    s.t += dt;

    if (s.phase === 'aim') {
      if (s.turn === 'player') {
        s.aim = swing(s.t, AIM_SPEED) * AIM_AMPLITUDE;
      } else {
        // The opponent's arrow glides to its choice, then stops
        const k = Math.min(1, s.t / 1.1);
        s.aim = s.plan.aim * (1 - (1 - k) ** 3) + swing(s.t, 0.8) * 0.12 * (1 - k);
        if (s.t > 1.5) {
          s.phase = 'power';
          s.t = 0;
          sounds.playPop();
          rerender();
        }
      }
    } else if (s.phase === 'power') {
      if (s.turn === 'player') {
        s.power = pulse(s.t, POWER_SPEED);
      } else {
        s.power = Math.min(s.plan.power, s.t * 0.8);
        if (s.t > s.plan.power / 0.8 + 0.4) {
          s.power = s.plan.power;
          launch();
        }
      }
    } else if (s.phase === 'rolling' && s.roll) {
      // Slow motion as the ball reaches the pins, so children can watch them fly
      const near = s.roll.ball.y > HEAD_PIN_Y - 2.2 && s.roll.ball.y < HEAD_PIN_Y + 2;
      let left = dt * (near ? 0.55 : 1);
      while (left > 0 && !s.roll.done) {
        stepRoll(s.roll, Math.min(1 / 120, left));
        left -= 1 / 120;
      }
      if (!s.hitSeen && s.roll.hits > 0) {
        s.hitSeen = true;
        s.shake = 0.25;
        sounds.playPop();
        const b = project(s.roll.ball.x, s.roll.ball.y);
        burst(s.particles, b.x, b.y - 10, { count: 16, speed: 120, size: 3 });
      }
      if (s.roll.done) finishRoll();
    }

    // Camera: zoom towards the pins while the ball rolls and while they settle
    const wantZoom = (s.phase === 'rolling' && s.roll && s.roll.ball.y > 3) || (s.phase === 'pause' && s.roll) ? 1.85 : 1;
    s.zoom += (wantZoom - s.zoom) * Math.min(1, dt * 3);
    s.shake = Math.max(0, s.shake - dt);
    s.flash = Math.max(0, s.flash - dt * 1.6);

    const ctx = getCtx();
    if (!ctx) return;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    const a = (s.zoom - 1) / 0.85;
    const focusY = project(0, HEAD_PIN_Y).y;
    const sh = s.shake > 0 ? s.shake * 16 : 0;
    ctx.translate(W / 2 + (Math.random() - 0.5) * sh, focusY + 35 * a + (Math.random() - 0.5) * sh);
    ctx.scale(s.zoom, s.zoom);
    ctx.translate(-W / 2, -focusY);
    drawLane(ctx, s.time);

    // Pins (far first) and the ball in depth order
    const pins = s.roll ? s.roll.pins : pinLayout().filter((p) => !s.standing || s.standing.includes(p.id));
    const items = pins.map((p) => ({ z: p.y, draw: () => {
      const f = p.down ? Math.min(1.2, (s.fall.get(p.id) || 0) + dt * 3) : 0;
      if (p.down) s.fall.set(p.id, f);
      drawPin(ctx, p, Math.min(1, f));
    } }));
    const ball = s.roll ? s.roll.ball : { x: 0, y: 0.35, spin: 0, gutter: false };
    if (ball.y < LANE_END + 0.4) {
      items.push({ z: ball.y, draw: () => {
        const b = project(ball.x, ball.y);
        const r = BALL_R * LANE_PX * b.s * 1.25;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, r, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        drawPokeball(ctx, b.x, b.y - r, r, ball.spin);
      } });
    }
    items.sort((p, q) => q.z - p.z).forEach((it) => it.draw());

    updateParticles(ctx, s.particles, dt);
    ctx.restore();

    if (s.phase === 'aim' || s.phase === 'power') drawAim(ctx, s.aim, s.time, s.turn === 'player' ? '#38bdf8' : '#f87171');
    if (s.phase === 'power') drawPowerBar(ctx, s.power, s.time);
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${s.flash * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
  }, g.phase !== 'done');

  const replay = () => {
    game.current = freshGame();
    setOpponent(pickOpponents(player.name, 1, random)[0]);
    setBanner(null);
    rerender();
  };

  const result = matchResult(g.totals[0], g.totals[1]);
  const hint =
    g.phase === 'aim' && g.turn === 'player'
      ? 'Chạm khi mũi tên chỉ gần giữa các ki! 🎯'
      : g.phase === 'power' && g.turn === 'player'
        ? 'Chạm lần nữa để chọn lực! 💪'
        : g.turn === 'opponent' && g.phase !== 'done'
          ? `Lượt của ${opponent.name}…`
          : '';

  return (
    <SportsShell
      title={`🎳 Frame ${Math.min(g.frame + 1, FRAMES)}/${FRAMES}`}
      label="Bowling Pokémon"
      player={player}
      opponent={opponent}
      scores={g.totals}
      active={g.turn === 'player' ? 'player' : 'opponent'}
      onClose={onClose}
      background="bg-gradient-to-b from-indigo-950 via-indigo-900 to-slate-900"
      dataAttrs={{ 'data-phase': g.phase, 'data-turn': g.turn, 'data-frame': g.frame }}
      footer={
        <div className="relative z-10 grid grid-cols-[auto_repeat(5,1fr)_auto] gap-x-1 gap-y-0.5 px-3 py-2 bg-black/40 text-center text-sm font-black" data-testid="frame-strip">
          <span className="text-left text-sky-300 truncate max-w-[70px]">{player.name}</span>
          {drawFrameStrip(g.frames.player)}
          <span className="text-white">{g.totals[0]}</span>
          <span className="text-left text-rose-300 truncate max-w-[70px]">{opponent.name}</span>
          {drawFrameStrip(g.frames.opponent)}
          <span className="text-white">{g.totals[1]}</span>
        </div>
      }
    >
      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden" onPointerDown={tap} data-testid="bowling-stage">
        <canvas ref={canvasRef} data-testid="bowling-canvas" className="max-w-full max-h-full" style={{ aspectRatio: `${W} / ${H}`, width: '100%', height: 'auto' }} />
        {/* The two Pokemon beside the lane */}
        <img
          key={`p${g.turn === 'player' ? hop : 0}`}
          src={player.image}
          alt=""
          draggable={false}
          className={`absolute left-1 bottom-2 w-20 h-20 object-contain scale-x-[-1] transition-all duration-300 pointer-events-none ${g.turn === 'player' ? 'poke-hop drop-shadow-[0_0_12px_rgba(56,189,248,0.9)]' : 'opacity-60 grayscale-[40%]'}`}
        />
        <img
          key={`o${g.turn === 'opponent' ? hop : 0}`}
          src={opponent.image}
          alt=""
          draggable={false}
          className={`absolute right-1 bottom-2 w-20 h-20 object-contain transition-all duration-300 pointer-events-none ${g.turn === 'opponent' ? 'poke-hop drop-shadow-[0_0_12px_rgba(248,113,113,0.9)]' : 'opacity-60 grayscale-[40%]'}`}
        />
        {hint && (
          <p className="hint-pulse absolute top-2 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/55 text-white text-sm font-black whitespace-nowrap pointer-events-none" data-testid="sport-hint">
            {hint}
          </p>
        )}
        <Banner banner={banner} />
        {g.phase === 'intro' && (
          <VsIntro
            player={player}
            opponent={opponent}
            subtitle="Chạm 1 lần để ngắm, chạm lần 2 để chọn lực!"
            onDone={() => game.current.phase === 'intro' && beginRoll()}
          />
        )}
        {g.phase === 'done' && (
          <MatchResult
            result={result}
            player={player}
            opponent={opponent}
            scores={g.totals}
            detail={`${nameOf(result === 'lose' ? 'opponent' : 'player')} ${result === 'draw' ? 'và bạn ấy bằng điểm' : 'ghi nhiều điểm hơn'}!`}
            onReplay={replay}
            onClose={onClose}
            onBerries={onBerries}
            onGold={onGold}
          />
        )}
      </div>
    </SportsShell>
  );
}
