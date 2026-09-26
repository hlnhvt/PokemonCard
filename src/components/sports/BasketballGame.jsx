import React, { useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { START, HOOP, BALL_R, BOARD, SHOTS, POINTS, launchFromDrag, clampDrag, createShot, stepShot, guidePoints, aiLaunch } from '../../utils/sports/basketball';
import { matchResult } from '../../utils/sports/common';
import { sounds } from '../../utils/soundEffects';
import { SportsShell, VsIntro, Banner, MatchResult } from './SportsCommon';
import { useLoop, useLater, useCanvas, pickOpponents, loadImage, drawSprite, canvasPoint, burst, updateParticles } from './sportsKit';

const W = 360;
const H = 560;
const PX = 36;
const ORIGIN_X = 8;
const FLOOR_Y = 505;
const DRAG_STRENGTH = 3.2;
const NET_DEPTH = 0.75;

const sx = (x) => ORIGIN_X + x * PX;
const sy = (y) => FLOOR_Y - y * PX;

function drawArena(ctx, time, cheer) {
  const bg = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  bg.addColorStop(0, '#1e1b4b');
  bg.addColorStop(0.55, '#4c1d95');
  bg.addColorStop(1, '#7c2d12');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Spotlights
  for (const [x, c] of [[60, 'rgba(56,189,248,0.25)'], [W - 60, 'rgba(244,114,182,0.25)']]) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x - 10, 0);
    ctx.lineTo(x + 10, 0);
    ctx.lineTo(W / 2 + (x - W / 2) * 0.2 + 70 + Math.sin(time * 0.8 + x) * 30, FLOOR_Y);
    ctx.lineTo(W / 2 + (x - W / 2) * 0.2 - 70 + Math.sin(time * 0.8 + x) * 30, FLOOR_Y);
    ctx.fill();
  }
  // Crowd in the stands
  const colors = ['#f87171', '#facc15', '#60a5fa', '#34d399', '#f472b6', '#e2e8f0'];
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i < 20; i++) {
      const x = 10 + i * 18 + (row % 2) * 9;
      const jump = cheer > 0 ? Math.abs(Math.sin(time * 13 + i * 2.1 + row)) * 8 * cheer : Math.sin(time * 2 + i + row) * 1.2;
      const y = 60 + row * 22 - jump;
      ctx.globalAlpha = 0.55 + row * 0.08;
      ctx.fillStyle = colors[(i * 5 + row * 2) % colors.length];
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 6, y + 5, 12, 9);
    }
  }
  ctx.globalAlpha = 1;
  // Wall under the stands
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 175, W, 16);
  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏀  POKÉ HOOPS  🏀  POKÉ HOOPS  🏀', W / 2, 187);
  // Wooden floor
  const floor = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
  floor.addColorStop(0, '#d97706');
  floor.addColorStop(1, '#92400e');
  ctx.fillStyle = floor;
  ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, FLOOR_Y + 1);
  ctx.lineTo(W, FLOOR_Y + 1);
  ctx.stroke();
  // Three-point arc on the floor
  ctx.beginPath();
  ctx.ellipse(sx(HOOP.x), FLOOR_Y + 22, 190, 16, 0, Math.PI * 0.5, Math.PI * 1.5, true);
  ctx.stroke();
}

function drawHoopBack(ctx, rimShake) {
  // Pole and backboard
  ctx.fillStyle = '#475569';
  ctx.fillRect(sx(BOARD.x) + 10, sy(BOARD.bottom) + 10, 8, FLOOR_Y - sy(BOARD.bottom) - 10);
  ctx.fillStyle = 'rgba(241,245,249,0.92)';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  const top = sy(BOARD.top);
  const bottom = sy(BOARD.bottom);
  ctx.beginPath();
  ctx.roundRect(sx(BOARD.x), top, 10, bottom - top, 3);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#ef4444';
  ctx.strokeRect(sx(BOARD.x) + 2, sy(HOOP.y + 0.9), 6, 0.8 * PX);
  // Back half of the rim
  const y = sy(HOOP.y) + Math.sin(rimShake * 60) * rimShake * 6;
  ctx.strokeStyle = '#c2410c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(sx(HOOP.x), y, HOOP.r * PX, 6, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  // Bracket to the board
  ctx.fillStyle = '#9a3412';
  ctx.fillRect(sx(HOOP.x + HOOP.r), y - 2, sx(BOARD.x) - sx(HOOP.x + HOOP.r), 4);
}

function drawHoopFront(ctx, rimShake, netPulse, time) {
  const cx = sx(HOOP.x);
  const y = sy(HOOP.y) + Math.sin(rimShake * 60) * rimShake * 6;
  const r = HOOP.r * PX;
  // Net: stretches down and sways after a basket
  const depth = NET_DEPTH * PX * (1 + netPulse * 0.45);
  const sway = Math.sin(time * 16) * netPulse * 5;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.5;
  const strands = 7;
  for (let i = 0; i <= strands; i++) {
    const t = i / strands;
    const x0 = cx - r + t * 2 * r;
    const x1 = cx - r * 0.55 + t * 1.1 * r + sway;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y + depth);
    ctx.stroke();
  }
  for (let j = 1; j <= 3; j++) {
    const k = j / 3;
    const half = r * (1 - 0.45 * k);
    ctx.beginPath();
    ctx.moveTo(cx - half + sway * k, y + depth * k);
    ctx.lineTo(cx + half + sway * k, y + depth * k);
    ctx.stroke();
  }
  // Front half of the rim
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(cx, y, r, 6, 0, 0, Math.PI);
  ctx.stroke();
}

function drawBasketball(ctx, x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#fdba74');
  g.addColorStop(1, '#c2410c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#431407';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.moveTo(0, -r);
  ctx.lineTo(0, r);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-r * 1.1, 0, r * 0.75, -0.9, 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 1.1, 0, r * 0.75, Math.PI - 0.9, Math.PI + 0.9);
  ctx.stroke();
  ctx.restore();
}

const freshGame = () => ({
  shot: 0, // shots taken by each side so far (the round)
  turn: 'player',
  phase: 'intro', // intro | aim | flying | pause | done
  scores: [0, 0],
  marks: { player: [], opponent: [] },
  drag: null, // { start, dx, dy } in world units
  aiDrag: null,
  current: null,
  eventIndex: 0,
  trail: [],
  rimShake: 0,
  netPulse: 0,
  cheer: 0,
  particles: [],
  t: 0,
  time: 0,
});

const snapshot = (s) => ({ phase: s.phase, turn: s.turn, shot: s.shot, scores: [...s.scores], marks: { player: [...s.marks.player], opponent: [...s.marks.opponent] } });

/**
 * Basketball shoot-out: pull back like a slingshot (the dots show the start of the flight)
 * and let go. 5 shots each; a clean SWISH gets its own celebration.
 */
export function BasketballGame({ player, onClose, onBerries, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [opponent, setOpponent] = useState(() => pickOpponents(player.name, 1, random)[0]);
  // Mutable state for the animation loop; `ui` is the snapshot the markup renders from
  const [initial] = useState(freshGame);
  const game = useRef(initial);
  const [ui, setUi] = useState(() => snapshot(initial));
  const [banner, setBanner] = useState(null);
  const rerender = () => setUi(snapshot(game.current));
  const later = useLater();
  const g = ui;
  const images = { player: loadImage(player.image), opponent: loadImage(opponent.image) };

  const say = (text, tone) => setBanner((b) => ({ id: (b?.id || 0) + 1, text, tone }));

  const beginShot = () => {
    const s = game.current;
    s.phase = 'aim';
    s.current = null;
    s.drag = null;
    s.trail = [];
    s.t = 0;
    s.aiDrag = null;
    if (s.turn === 'opponent') {
      const v = aiLaunch(random);
      s.aiDrag = { dx: -v.vx / DRAG_STRENGTH, dy: -v.vy / DRAG_STRENGTH, v };
    }
    rerender();
  };

  const shoot = (v) => {
    const s = game.current;
    s.current = createShot(v);
    s.eventIndex = 0;
    s.phase = 'flying';
    s.t = 0;
    s.drag = null;
    sounds.playWhoosh();
    rerender();
  };

  const finishShot = () => {
    const s = game.current;
    const made = s.current.made;
    const idx = s.turn === 'player' ? 0 : 1;
    s.marks[s.turn].push(made);
    if (made) s.scores[idx] += POINTS;
    else say(s.current.rimTouched ? 'Suýt nữa thôi!' : 'Trượt rồi!', 'blue');
    s.phase = 'pause';
    rerender();
    later(() => {
      const st = game.current;
      if (st.turn === 'player') {
        st.turn = 'opponent';
      } else {
        st.turn = 'player';
        st.shot += 1;
      }
      if (st.shot >= SHOTS) {
        st.phase = 'done';
        rerender();
        return;
      }
      beginShot();
    }, 1300);
  };

  const onEvent = (type) => {
    const s = game.current;
    const hoop = { x: sx(HOOP.x), y: sy(HOOP.y) };
    if (type === 'rim') {
      s.rimShake = 0.35;
      sounds.playPop();
    } else if (type === 'board') {
      sounds.playPop();
    } else if (type === 'swish' || type === 'score') {
      s.netPulse = 1;
      s.cheer = s.turn === 'player' ? 1 : 0.4;
      burst(s.particles, hoop.x, hoop.y + 10, { count: type === 'swish' ? 28 : 18, speed: 180, colors: ['#fde047', '#fb923c', '#ffffff', '#60a5fa'] });
      if (s.turn === 'player') {
        say(type === 'swish' ? 'SWISH! 🔥' : 'VÀO RỒI! 🏀', type === 'swish' ? 'gold' : 'green');
        sounds.playSuccessFanfare();
        if (type === 'swish') {
          try {
            confetti({ particleCount: 55, spread: 60, origin: { x: 0.75, y: 0.5 }, zIndex: 9999 });
          } catch {
            // decoration
          }
        }
      } else {
        say(`${opponent.name} ghi điểm!`, 'red');
        sounds.playCoin();
      }
    }
  };

  const toWorldDrag = (e) => {
    const s = game.current;
    const p = canvasPoint(canvasRef.current, e, W, H);
    const d = clampDrag((p.x - s.drag.start.x) / PX, -(p.y - s.drag.start.y) / PX);
    s.drag.dx = d.dx;
    s.drag.dy = d.dy;
  };

  const onDown = (e) => {
    const s = game.current;
    if (s.phase !== 'aim' || s.turn !== 'player' || !canvasRef.current) return;
    const start = canvasPoint(canvasRef.current, e, W, H);
    s.drag = { start, dx: 0, dy: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!game.current.drag) return;
    toWorldDrag(e);
  };
  const onUp = (e) => {
    const s = game.current;
    if (!s.drag) return;
    toWorldDrag(e);
    const v = launchFromDrag(s.drag.dx, s.drag.dy, DRAG_STRENGTH);
    if (Math.hypot(v.vx, v.vy) < 3 || v.vx <= 0) {
      s.drag = null; // too small a pull: nothing happens
      return;
    }
    shoot(v);
  };

  useLoop((dt) => {
    const s = game.current;
    s.time += dt;
    s.t += dt;
    s.rimShake = Math.max(0, s.rimShake - dt);
    s.netPulse = Math.max(0, s.netPulse - dt * 1.4);
    s.cheer = Math.max(0, s.cheer - dt * 0.5);

    // The opponent pulls back slowly, holds, then shoots
    if (s.phase === 'aim' && s.turn === 'opponent' && s.aiDrag) {
      if (s.t > 1.9) shoot(s.aiDrag.v);
    }
    if (s.phase === 'flying' && s.current) {
      let left = dt;
      while (left > 0 && !s.current.done) {
        stepShot(s.current, Math.min(1 / 240, left));
        left -= 1 / 240;
      }
      while (s.eventIndex < s.current.events.length) onEvent(s.current.events[s.eventIndex++]);
      s.trail.push({ x: s.current.ball.x, y: s.current.ball.y });
      if (s.trail.length > 10) s.trail.shift();
      if (s.current.done) finishShot();
    }

    const ctx = getCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawArena(ctx, s.time, s.cheer);
    drawHoopBack(ctx, s.rimShake);

    // Shooter
    const shooterImg = s.turn === 'player' ? images.player : images.opponent;
    const aiming = s.phase === 'aim';
    let drag = null;
    if (aiming && s.turn === 'player' && s.drag) drag = s.drag;
    if (aiming && s.turn === 'opponent' && s.aiDrag) {
      const k = Math.min(1, Math.max(0, (s.t - 0.4) / 1.0));
      const e = 1 - (1 - k) ** 3;
      drag = { dx: s.aiDrag.dx * e, dy: s.aiDrag.dy * e };
    }
    const pullLen = drag ? Math.hypot(drag.dx, drag.dy) : 0;
    const pullScale = pullLen > 0 ? Math.min(1, 1.1 / pullLen) : 0;
    const bob = aiming ? Math.sin(s.time * 3) * 3 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx(START.x - 0.3), FLOOR_Y + 2, 34, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    const jump = s.phase === 'flying' && s.t < 0.5 ? Math.sin((s.t / 0.5) * Math.PI) * 26 : 0;
    drawSprite(ctx, shooterImg, sx(START.x - 0.35), FLOOR_Y - 52 - jump + bob, 108, { flip: s.turn === 'player' });

    // Aiming: ball pulled back, elastic band and the guide dots
    if (aiming) {
      const bx = sx(START.x + (drag ? drag.dx * pullScale * 0.6 : 0));
      const by = sy(START.y + (drag ? drag.dy * pullScale * 0.6 : 0)) + bob;
      if (drag && pullLen > 0.15) {
        const v = launchFromDrag(drag.dx, drag.dy, DRAG_STRENGTH);
        ctx.strokeStyle = s.turn === 'player' ? 'rgba(56,189,248,0.9)' : 'rgba(248,113,113,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx(START.x), sy(START.y));
        ctx.lineTo(bx, by);
        ctx.stroke();
        guidePoints(v, 9).forEach((p, i) => {
          ctx.fillStyle = `rgba(255,255,255,${0.95 - i * 0.08})`;
          ctx.beginPath();
          ctx.arc(sx(p.x), sy(p.y), 5 - i * 0.3, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (s.turn === 'player') {
        // Show the gesture: a hand pulling down-left
        const k = (s.time % 1.6) / 1.6;
        ctx.globalAlpha = Math.sin(k * Math.PI);
        ctx.font = '30px system-ui, sans-serif';
        ctx.fillText('👆', sx(START.x) - k * 40, sy(START.y) + 30 + k * 40);
        ctx.globalAlpha = 1;
      }
      drawBasketball(ctx, bx, by, BALL_R * PX * 1.1, 0);
    }

    // Flying ball with a motion trail
    if (s.current && (s.phase === 'flying' || s.phase === 'pause')) {
      const b = s.current.ball;
      s.trail.forEach((p, i) => {
        ctx.fillStyle = `rgba(253, 186, 116, ${(i / s.trail.length) * 0.35})`;
        ctx.beginPath();
        ctx.arc(sx(p.x), sy(p.y), BALL_R * PX * (0.4 + (i / s.trail.length) * 0.6), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(sx(b.x), FLOOR_Y + 2, BALL_R * PX * (1.2 - Math.min(0.8, b.y / 8)), 4, 0, 0, Math.PI * 2);
      ctx.fill();
      drawBasketball(ctx, sx(b.x), sy(b.y), BALL_R * PX * 1.1, b.spin);
    }
    drawHoopFront(ctx, s.rimShake, s.netPulse, s.time);
    updateParticles(ctx, s.particles, dt);
  }, g.phase !== 'done');

  const replay = () => {
    game.current = freshGame();
    setOpponent(pickOpponents(player.name, 1, random)[0]);
    setBanner(null);
    rerender();
  };

  const hint =
    g.phase === 'aim' && g.turn === 'player'
      ? 'Kéo ngược về phía sau rồi thả tay để ném! 🏀'
      : g.turn === 'opponent' && g.phase !== 'done' && g.phase !== 'intro'
        ? `${opponent.name} đang ném…`
        : '';

  return (
    <SportsShell
      title={`🏀 Lượt ${Math.min(g.shot + 1, SHOTS)}/${SHOTS}`}
      label="Bóng rổ Pokémon"
      player={player}
      opponent={opponent}
      scores={g.scores}
      active={g.turn === 'player' ? 'player' : 'opponent'}
      onClose={onClose}
      background="bg-gradient-to-b from-indigo-950 via-purple-900 to-orange-900"
      dataAttrs={{ 'data-phase': g.phase, 'data-turn': g.turn, 'data-shot': g.shot }}
      footer={
        <div className="relative z-10 grid grid-cols-[auto_repeat(5,1fr)] gap-x-1 gap-y-1 items-center px-3 py-2 bg-black/40 text-center text-sm font-black" data-testid="shot-strip">
          {['player', 'opponent'].map((who) => (
            <React.Fragment key={who}>
              <span className={`text-left truncate max-w-[80px] ${who === 'player' ? 'text-sky-300' : 'text-rose-300'}`}>{who === 'player' ? player.name : opponent.name}</span>
              {Array.from({ length: SHOTS }).map((_, i) => {
                const m = g.marks[who][i];
                return (
                  <span key={i} className={`mx-auto w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${m == null ? 'bg-white/15' : m ? 'bg-orange-400 star-pop' : 'bg-slate-500 star-pop'}`}>
                    {m == null ? '' : m ? '🏀' : '✕'}
                  </span>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      }
    >
      <div
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden touch-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => (game.current.drag = null)}
        data-testid="basketball-stage"
      >
        <canvas ref={canvasRef} data-testid="basketball-canvas" className="max-w-full max-h-full" style={{ aspectRatio: `${W} / ${H}`, width: '100%', height: 'auto' }} />
        {hint && (
          <p className="hint-pulse absolute top-2 left-1/2 -translate-x-1/2 w-[92%] px-3 py-1.5 rounded-2xl bg-black/55 text-center text-white text-sm font-black pointer-events-none" data-testid="sport-hint">
            {hint}
          </p>
        )}
        <Banner banner={banner} />
        {g.phase === 'intro' && (
          <VsIntro player={player} opponent={opponent} subtitle="Kéo ngược như ná cao su rồi thả tay. Mỗi bên ném 5 quả!" onDone={() => game.current.phase === 'intro' && beginShot()} />
        )}
        {g.phase === 'done' && (
          <MatchResult
            result={matchResult(g.scores[0], g.scores[1])}
            player={player}
            opponent={opponent}
            scores={g.scores}
            detail={`Bé ném vào ${g.marks.player.filter(Boolean).length}/${SHOTS} quả`}
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
