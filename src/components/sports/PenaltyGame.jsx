import React, { useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { ROUNDS, childKick, planAiKick, childSave, columnOf, shotFromSwipe, diveFromSwipe } from '../../utils/sports/penalty';
import { matchResult } from '../../utils/sports/common';
import { sounds } from '../../utils/soundEffects';
import { SportsShell, VsIntro, Banner, MatchResult } from './SportsCommon';
import { useLoop, useLater, useCanvas, pickOpponents, loadImage, drawSprite, canvasPoint, burst, updateParticles } from './sportsKit';

const W = 360;
const H = 560;
const GOAL = { left: 48, right: 312, top: 150, ground: 300 };
const GOAL_HALF = (GOAL.right - GOAL.left) / 2;
const SPOT = { x: 180, y: 468 };
const RUN = 0.55; // kicker run-up (seconds)
const FLY = 0.8; // ball flight
const COLUMN_X = { left: -0.7, center: 0, right: 0.7 };

const goalPoint = ({ x, y }) => ({ x: W / 2 + x * GOAL_HALF, y: GOAL.ground - y * (GOAL.ground - GOAL.top) * 0.94 });
const ease = (k) => 1 - (1 - k) ** 2;

function drawStadium(ctx, time, cheer) {
  const sky = ctx.createLinearGradient(0, 0, 0, 150);
  sky.addColorStop(0, '#0c4a6e');
  sky.addColorStop(1, '#38bdf8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, 150);
  // Floodlights
  for (const x of [40, W - 40]) {
    const g = ctx.createRadialGradient(x, 18, 2, x, 18, 60);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 60, 0, 120, 80);
  }
  // Crowd
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 70, W, 90);
  const colors = ['#f87171', '#facc15', '#60a5fa', '#34d399', '#f472b6', '#ffffff'];
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 24; i++) {
      const x = 8 + i * 15 + (row % 2) * 7;
      const jumpY = cheer > 0 ? Math.abs(Math.sin(time * 14 + i * 1.7 + row)) * 7 * cheer : Math.sin(time * 2 + i) * 1;
      const y = 84 + row * 18 - jumpY;
      ctx.fillStyle = colors[(i * 7 + row * 3) % colors.length];
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 5, y + 4, 10, 8);
    }
  }
  // Advertising board
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 150, W, 16);
  ctx.fillStyle = '#fff';
  ctx.font = '900 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('POKÉMON CUP  ⚽  POKÉMON CUP  ⚽  POKÉMON CUP', W / 2, 162);
  // Grass with perspective stripes
  for (let i = 0; i < 10; i++) {
    const y0 = 166 + ((H - 166) * i ** 1.4) / 10 ** 1.4;
    const y1 = 166 + ((H - 166) * (i + 1) ** 1.4) / 10 ** 1.4;
    ctx.fillStyle = i % 2 ? '#16a34a' : '#22c55e';
    ctx.fillRect(0, y0, W, y1 - y0 + 1);
  }
  // Pitch lines: goal area and the penalty spot
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, GOAL.ground);
  ctx.lineTo(W, GOAL.ground);
  ctx.moveTo(GOAL.left - 30, GOAL.ground);
  ctx.lineTo(GOAL.left - 60, 380);
  ctx.lineTo(GOAL.right + 60, 380);
  ctx.lineTo(GOAL.right + 30, GOAL.ground);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(SPOT.x, SPOT.y + 8, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawGoal(ctx, ripple) {
  // Net
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(GOAL.left, GOAL.top, GOAL.right - GOAL.left, GOAL.ground - GOAL.top);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1;
  const off = (x, y) => {
    if (!ripple) return 0;
    const d2 = (x - ripple.x) ** 2 + (y - ripple.y) ** 2;
    return ripple.amp * Math.exp(-d2 / 2600) * Math.sin(ripple.t * 22);
  };
  for (let x = GOAL.left; x <= GOAL.right; x += 13) {
    ctx.beginPath();
    for (let y = GOAL.top; y <= GOAL.ground; y += 8) {
      const o = off(x, y);
      if (y === GOAL.top) ctx.moveTo(x + o * 0.3, y - o);
      else ctx.lineTo(x + o * 0.3, y - o);
    }
    ctx.stroke();
  }
  for (let y = GOAL.top; y <= GOAL.ground; y += 12) {
    ctx.beginPath();
    for (let x = GOAL.left; x <= GOAL.right; x += 8) {
      const o = off(x, y);
      if (x === GOAL.left) ctx.moveTo(x, y - o);
      else ctx.lineTo(x, y - o);
    }
    ctx.stroke();
  }
  // Posts and crossbar
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(GOAL.left, GOAL.ground);
  ctx.lineTo(GOAL.left, GOAL.top);
  ctx.lineTo(GOAL.right, GOAL.top);
  ctx.lineTo(GOAL.right, GOAL.ground);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineCap = 'butt';
}

function drawBall(ctx, x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  const patch = (a, d, s) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const ang = a + (i * Math.PI * 2) / 5;
      const px = Math.cos(a) * d + Math.cos(ang) * s;
      const py = Math.sin(a) * d + Math.sin(ang) * s;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.fill();
  };
  patch(0, 0, r * 0.36);
  for (let i = 0; i < 5; i++) patch((i * Math.PI * 2) / 5 + 0.6, r * 0.86, r * 0.28);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

const freshGame = () => ({
  round: 0,
  phase: 'intro', // intro | aim | read | kick | done
  kicker: 'player',
  scores: [0, 0],
  marks: { player: [], opponent: [] },
  plan: null,
  anim: null,
  ripple: null,
  cheer: 0,
  shake: 0,
  particles: [],
  time: 0,
});

const snapshot = (s) => ({ phase: s.phase, round: s.round, kicker: s.kicker, scores: [...s.scores], marks: { player: [...s.marks.player], opponent: [...s.marks.opponent] }, lean: s.plan ? s.plan.lean : null });

/**
 * Penalty shoot-out: the child shoots (tap where the ball should go) and saves
 * (watch where the kicker looks, then dive left / middle / right). 5 of each.
 */
export function PenaltyGame({ player, onClose, onBerries, onGold, random = Math.random }) {
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

  const startRound = () => {
    const s = game.current;
    s.anim = null;
    s.ripple = null;
    if (s.kicker === 'player') {
      s.phase = 'aim';
    } else {
      s.plan = planAiKick(random);
      s.phase = 'read';
    }
    rerender();
  };

  const play = (kicker, target, outcome, dive) => {
    const s = game.current;
    const ballEnd = goalPoint(target);
    const keeperX = outcome.saved
      ? ballEnd.x - W / 2 // dive right onto the ball
      : dive === columnOf(target.x) && !outcome.wide
        ? ballEnd.x - W / 2 - Math.sign(target.x || 1) * 46 // fingertips, just short
        : COLUMN_X[dive] * GOAL_HALF;
    s.anim = { t: 0, kicker, target, ballEnd, outcome, dive, keeperX, lift: dive === 'center' ? 34 : 22 + target.y * 40, resolved: false, bounce: null };
    s.phase = 'kick';
    rerender();
  };

  const resolve = () => {
    const s = game.current;
    const { kicker, outcome, ballEnd } = s.anim;
    const idx = kicker === 'player' ? 0 : 1;
    s.marks[kicker].push(outcome.goal);
    if (outcome.goal) {
      s.scores[idx] += 1;
      s.ripple = { x: ballEnd.x, y: ballEnd.y, amp: 9, t: 0 };
      s.shake = 0.3;
      if (kicker === 'player') {
        say('VÀO!!! ⚽', 'gold');
        s.cheer = 1;
        sounds.playSuccessFanfare();
        burst(s.particles, ballEnd.x, ballEnd.y, { count: 22, speed: 190, colors: ['#fde047', '#f472b6', '#60a5fa', '#ffffff'] });
        try {
          confetti({ particleCount: 50, spread: 70, origin: { y: 0.35 }, zIndex: 9999 });
        } catch {
          // decoration
        }
      } else {
        say(`${opponent.name} ghi bàn!`, 'red');
        sounds.playCoin();
      }
    } else if (outcome.saved) {
      if (kicker === 'player') {
        say('Bị bắt mất rồi!', 'blue');
        sounds.playPop();
      } else {
        say('CẢN PHÁ! 🧤', 'gold');
        s.cheer = 1;
        sounds.playSuccessFanfare();
        burst(s.particles, ballEnd.x, ballEnd.y, { count: 20, speed: 170, colors: ['#fde047', '#38bdf8', '#ffffff'] });
      }
    } else {
      say(kicker === 'player' ? 'Ra ngoài rồi!' : 'Sút ra ngoài! 😅', kicker === 'player' ? 'blue' : 'green');
      sounds.playPop();
    }
    rerender();
    later(() => {
      const st = game.current;
      if (st.kicker === 'player') {
        st.kicker = 'opponent';
      } else {
        st.kicker = 'player';
        st.round += 1;
      }
      if (st.round >= ROUNDS) {
        st.phase = 'done';
        rerender();
        return;
      }
      startRound();
    }, 1900);
  };

  const shootAt = ({ x, y }) => {
    const s = game.current;
    if (s.phase !== 'aim') return;
    const outcome = childKick({ x, y }, random);
    sounds.playPop();
    play('player', { x, y }, outcome, outcome.dive);
  };

  const diveTo = (column) => {
    const s = game.current;
    if (s.phase !== 'read') return;
    const outcome = childSave(s.plan, column, random);
    sounds.playPop();
    play('opponent', s.plan.target, outcome, column);
  };

  // Swipes: up towards the goal to shoot, left / up / right to dive
  const onSwipeStart = (e) => {
    const s = game.current;
    if (!canvasRef.current || (s.phase !== 'aim' && s.phase !== 'read')) return;
    const p = canvasPoint(canvasRef.current, e, W, H);
    s.swipe = { start: p, cur: p };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onSwipeMove = (e) => {
    const s = game.current;
    if (s.swipe && canvasRef.current) s.swipe.cur = canvasPoint(canvasRef.current, e, W, H);
  };
  const onSwipeEnd = (e) => {
    const s = game.current;
    if (!s.swipe || !canvasRef.current) return;
    const end = canvasPoint(canvasRef.current, e, W, H);
    const dx = end.x - s.swipe.start.x;
    const dy = end.y - s.swipe.start.y;
    s.swipe = null;
    if (s.phase === 'aim') {
      const target = shotFromSwipe(dx, dy);
      if (target) shootAt(target);
      else {
        sounds.playOops();
        say('Vuốt lên thật mạnh nhé! ⬆️', 'blue');
      }
    } else if (s.phase === 'read') {
      const dive = diveFromSwipe(dx, dy);
      if (dive) diveTo(dive);
      else say('Vuốt sang trái, phải hoặc lên trên!', 'blue');
    }
  };

  useLoop((dt) => {
    const s = game.current;
    s.time += dt;
    s.cheer = Math.max(0, s.cheer - dt * 0.5);
    s.shake = Math.max(0, s.shake - dt);
    if (s.ripple) {
      s.ripple.t += dt;
      s.ripple.amp *= Math.pow(0.12, dt);
    }
    const a = s.anim;
    if (a) {
      a.t += dt;
      if (!a.resolved && a.t >= RUN + FLY) {
        a.resolved = true;
        if (a.outcome.saved) a.bounce = { x: a.ballEnd.x, y: a.ballEnd.y, vx: (random() - 0.5) * 160, vy: 60, t: 0 };
        resolve();
      }
      if (a.bounce) {
        a.bounce.t += dt;
        a.bounce.vy += 520 * dt;
        a.bounce.x += a.bounce.vx * dt;
        a.bounce.y += a.bounce.vy * dt;
        if (a.bounce.y > GOAL.ground + 60) {
          a.bounce.y = GOAL.ground + 60;
          a.bounce.vy *= -0.45;
        }
      }
    }

    const ctx = getCtx();
    if (!ctx) return;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (s.shake > 0) ctx.translate(Math.sin(s.time * 97) * s.shake * 7, Math.cos(s.time * 83) * s.shake * 7);
    drawStadium(ctx, s.time, s.cheer);
    drawGoal(ctx, s.ripple);

    const kicker = a ? a.kicker : s.kicker;
    const keeperImg = kicker === 'player' ? images.opponent : images.player;
    const kickerImg = kicker === 'player' ? images.player : images.opponent;

    // Keeper
    let kx = Math.sin(s.time * 2.2) * 14;
    let ky = 0;
    let rot = 0;
    if (a && a.t > RUN + 0.08) {
      const k = ease(Math.min(1, (a.t - RUN - 0.08) / 0.45));
      kx = kx * (1 - k) + a.keeperX * k;
      ky = -a.lift * Math.sin(Math.min(1, k) * Math.PI * 0.5);
      rot = a.dive === 'center' ? 0 : Math.sign(a.keeperX) * 1.15 * k;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(W / 2 + kx, GOAL.ground - 2, 30, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    drawSprite(ctx, keeperImg, W / 2 + kx, GOAL.ground - 44 + ky, 96, { rotate: rot, flip: kicker === 'opponent' });

    // Ball
    let bx = SPOT.x;
    let by = SPOT.y;
    let br = 16;
    let spin = 0;
    if (a && a.t > RUN) {
      const k = Math.min(1, (a.t - RUN) / FLY);
      const e = ease(k);
      bx = SPOT.x + (a.ballEnd.x - SPOT.x) * e;
      by = SPOT.y + (a.ballEnd.y - SPOT.y) * e - Math.sin(k * Math.PI) * 36;
      br = 16 - 7 * e;
      spin = k * 14;
      if (a.resolved && a.outcome.goal) {
        const d = Math.min(1, (a.t - RUN - FLY) / 0.35);
        by += d * 6;
        br -= d * 1.5;
      } else if (a.resolved && a.outcome.wide) {
        const d = a.t - RUN - FLY;
        bx += Math.sign(a.target.x || 1) * d * 160;
        by -= d * 40;
      }
      if (a.bounce) {
        bx = a.bounce.x;
        by = a.bounce.y;
        br = 10;
        spin = a.bounce.t * 10;
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(bx, Math.max(by + br * 0.8, a && a.t > RUN ? GOAL.ground + (SPOT.y - GOAL.ground) * (1 - ease(Math.min(1, (a.t - RUN) / FLY))) : SPOT.y + 12), br, br * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    if (a && a.t > RUN && a.t < RUN + FLY) {
      // Speed trail
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = br;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + (SPOT.x - bx) * 0.12, by + (SPOT.y - by) * 0.12);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    drawBall(ctx, bx, by, br, spin);

    // Kicker, running up to the ball
    let px = SPOT.x - 62;
    let py = SPOT.y + 30;
    let lean = 0;
    if (s.phase === 'read' && s.plan && !a) lean = { left: -0.28, center: 0, right: 0.28 }[s.plan.lean];
    if (a) {
      const k = Math.min(1, a.t / RUN);
      px += 40 * ease(k);
      py -= 14 * ease(k);
      lean = a.t < RUN ? Math.sin(a.t * 30) * 0.08 : 0.1;
    }
    drawSprite(ctx, kickerImg, px, py - Math.abs(Math.sin(s.time * (a ? 18 : 3))) * (a ? 8 : 3), 120, { rotate: lean, flip: kicker === 'player' });

    // While swiping to shoot: a dotted arrow from the ball and a target ring where it will go
    if (s.phase === 'aim' && s.swipe) {
      const dx = s.swipe.cur.x - s.swipe.start.x;
      const dy = s.swipe.cur.y - s.swipe.start.y;
      const aim = shotFromSwipe(dx, dy);
      ctx.save();
      ctx.lineCap = 'round';
      if (aim) {
        const t = goalPoint(aim);
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 5;
        ctx.setLineDash([2, 12]);
        ctx.lineDashOffset = -s.time * 40;
        ctx.beginPath();
        ctx.moveTo(SPOT.x, SPOT.y);
        ctx.quadraticCurveTo((SPOT.x + t.x) / 2, (SPOT.y + t.y) / 2 - 40, t.x, t.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 16 + Math.sin(s.time * 10) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(t.x - 24, t.y);
        ctx.lineTo(t.x + 24, t.y);
        ctx.moveTo(t.x, t.y - 24);
        ctx.lineTo(t.x, t.y + 24);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(s.swipe.start.x, s.swipe.start.y);
        ctx.lineTo(s.swipe.cur.x, s.swipe.cur.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Target zones while aiming
    if (s.phase === 'aim' && !s.swipe) {
      for (const x of [-0.66, 0, 0.66]) {
        for (const y of [0.28, 0.72]) {
          const p = goalPoint({ x, y });
          const r = 20 + Math.sin(s.time * 4 + x * 3 + y * 5) * 3;
          ctx.strokeStyle = 'rgba(253, 224, 71, 0.9)';
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 5]);
          ctx.lineDashOffset = -s.time * 20;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(253, 224, 71, 0.18)';
          ctx.fill();
        }
      }
    }
    updateParticles(ctx, s.particles, dt);
    ctx.restore();
  }, g.phase !== 'done');

  const replay = () => {
    game.current = freshGame();
    setOpponent(pickOpponents(player.name, 1, random)[0]);
    setBanner(null);
    rerender();
  };

  const lookArrow = g.lean ? { left: '⬅️', center: '⬆️', right: '➡️' }[g.lean] : '';
  const hint =
    g.phase === 'aim'
      ? 'Vuốt lên về phía khung thành để sút! Vuốt xiên để sút góc, vuốt dài để sút cao ⭐'
      : g.phase === 'read'
        ? `Xem ${opponent.name} nhìn hướng nào rồi vuốt ← ↑ → để bay người!`
        : '';

  return (
    <SportsShell
      title={`⚽ Lượt ${Math.min(g.round + 1, ROUNDS)}/${ROUNDS}`}
      label="Sút penalty Pokémon"
      player={player}
      opponent={opponent}
      scores={g.scores}
      active={g.kicker === 'player' ? 'player' : 'opponent'}
      onClose={onClose}
      background="bg-gradient-to-b from-sky-900 via-emerald-800 to-emerald-900"
      dataAttrs={{ 'data-phase': g.phase, 'data-round': g.round, 'data-kicker': g.kicker }}
      footer={
        <div className="relative z-10 px-3 py-2 bg-black/40">
          {(
            <div className="grid grid-cols-[auto_repeat(5,1fr)] gap-x-1 gap-y-1 items-center text-center text-sm font-black" data-testid="kick-strip">
              {['player', 'opponent'].map((who) => (
                <React.Fragment key={who}>
                  <span className={`text-left truncate max-w-[80px] ${who === 'player' ? 'text-sky-300' : 'text-rose-300'}`}>{who === 'player' ? player.name : opponent.name}</span>
                  {Array.from({ length: ROUNDS }).map((_, i) => {
                    const m = g.marks[who][i];
                    return (
                      <span key={i} className={`mx-auto w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${m == null ? 'bg-white/15' : m ? 'bg-emerald-400 star-pop' : 'bg-rose-500 star-pop'}`}>
                        {m == null ? '' : m ? '⚽' : '✕'}
                      </span>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      }
    >
      <div
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden touch-none"
        onPointerDown={onSwipeStart}
        onPointerMove={onSwipeMove}
        onPointerUp={onSwipeEnd}
        onPointerCancel={() => (game.current.swipe = null)}
        data-testid="penalty-stage"
      >
        <canvas ref={canvasRef} data-testid="penalty-canvas" className="max-w-full max-h-full" style={{ aspectRatio: `${W} / ${H}`, width: '100%', height: 'auto' }} />
        {g.phase === 'read' && (
          <div className="bubble-pop absolute left-[18%] bottom-[30%] px-3 py-1.5 rounded-2xl bg-white text-2xl shadow-lg pointer-events-none" data-testid="kicker-look">
            👀{lookArrow}
          </div>
        )}
        {g.phase === 'aim' && (
          <span className="swipe-up-hint absolute left-1/2 bottom-[12%] text-4xl pointer-events-none drop-shadow-lg" aria-hidden="true" data-testid="swipe-hint">
            👆
          </span>
        )}
        {g.phase === 'read' && (
          <div className="absolute inset-x-0 top-[36%] flex items-center justify-center gap-10 pointer-events-none" aria-hidden="true" data-testid="dive-hint">
            <span className="nudge-l text-4xl drop-shadow-lg">⬅️</span>
            <span className="nudge-u text-4xl drop-shadow-lg">⬆️</span>
            <span className="nudge-r text-4xl drop-shadow-lg">➡️</span>
            <span className="swipe-side-hint absolute left-1/2 top-12 text-4xl">👆</span>
          </div>
        )}
        {hint && (
          <p className="hint-pulse absolute top-2 left-1/2 -translate-x-1/2 w-[92%] px-3 py-1.5 rounded-2xl bg-black/55 text-center text-white text-sm font-black pointer-events-none" data-testid="sport-hint">
            {hint}
          </p>
        )}
        <Banner banner={banner} />
        {g.phase === 'intro' && (
          <VsIntro player={player} opponent={opponent} subtitle="Sút 5 quả, bắt 5 quả. Ai ghi nhiều bàn hơn sẽ thắng!" onDone={() => game.current.phase === 'intro' && startRound()} />
        )}
        {g.phase === 'done' && (
          <MatchResult
            result={matchResult(g.scores[0], g.scores[1])}
            player={player}
            opponent={opponent}
            scores={g.scores}
            detail={`Bé ghi ${g.scores[0]} bàn, ${opponent.name} ghi ${g.scores[1]} bàn`}
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
