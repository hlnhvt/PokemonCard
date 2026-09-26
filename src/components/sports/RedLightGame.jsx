import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { TRACK, RIVALS, TIME_LIMIT, createRedLight, stepRedLight, playerOf, redLightResult } from '../../utils/sports/redlight';
import { sounds } from '../../utils/soundEffects';
import { SportsShell, Banner, MatchResult } from './SportsCommon';
import { useLoop, useLater, useCanvas, pickOpponents, loadImage, drawSprite, burst, updateParticles } from './sportsKit';

const W = 360;
const H = 560;
const TAU = Math.PI * 2;
const PLAYER_Y = 450; // where the child's Pokemon stays on screen while the field scrolls
const FINISH_TOP = 190; // the finish line never goes above this on screen
const CAM_MAX = TRACK - (PLAYER_Y - FINISH_TOP);
const DOLL = { x: 180, y: 96, r: 46 };
const LANE_W = 50;
const laneX = (lane) => 30 + LANE_W / 2 + lane * LANE_W;
const LIGHT_UI = {
  green: { text: 'ĐÈN XANH – CHẠY!', cls: 'from-emerald-400 to-green-600', icon: '🟢' },
  turning: { text: 'SẮP QUAY LẠI!', cls: 'from-amber-300 to-orange-500', icon: '🟡' },
  red: { text: 'ĐÈN ĐỎ – ĐỨNG IM!', cls: 'from-rose-500 to-red-700', icon: '🔴' },
};

function drawField(ctx, cam, light, t) {
  // Pastel walls with painted clouds (left and right), sand in the middle
  const wall = ctx.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, '#f9a8d4');
  wall.addColorStop(1, '#f472b6');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);
  const sand = ctx.createLinearGradient(0, 0, 0, H);
  sand.addColorStop(0, '#fde68a');
  sand.addColorStop(1, '#fbbf24');
  ctx.fillStyle = sand;
  ctx.fillRect(24, 0, W - 48, H);
  // Scrolling sand ripples
  ctx.strokeStyle = 'rgba(180,83,9,0.18)';
  ctx.lineWidth = 2;
  for (let k = -1; k < 12; k++) {
    const y = ((k * 60 + (cam % 60)) % (H + 60)) - 20;
    ctx.beginPath();
    for (let x = 28; x <= W - 28; x += 12) ctx.lineTo(x, y + Math.sin(x / 20 + k) * 3);
    ctx.stroke();
  }
  // Lane lines
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.setLineDash([14, 14]);
  ctx.lineDashOffset = -cam;
  for (let i = 1; i < RIVALS + 1; i++) {
    ctx.beginPath();
    ctx.moveTo(30 + i * LANE_W, 0);
    ctx.lineTo(30 + i * LANE_W, H);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Wall clouds scroll with the field
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let k = 0; k < 8; k++) {
    const y = ((k * 110 + cam * 0.6) % (H + 100)) - 50;
    for (const x of [8, W - 8]) {
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, TAU);
      ctx.arc(x, y + 10, 7, 0, TAU);
      ctx.fill();
    }
  }
  // Start and finish lines
  for (const [dist, finish] of [[0, false], [TRACK, true]]) {
    const y = PLAYER_Y - (dist - cam);
    if (y < -30 || y > H + 30) continue;
    if (finish) {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(24, y - 5, W - 48, 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🏁 VỀ ĐÍCH 🏁', W / 2, y - 10 + Math.sin(t * 4) * 1.5);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(24, y - 3, W - 48, 6);
    }
  }
  // Mood tint: green glow or red alarm
  if (light !== 'turning') {
    ctx.fillStyle = light === 'red' ? `rgba(220,38,38,${0.1 + Math.sin(t * 6) * 0.04})` : 'rgba(34,197,94,0.06)';
    ctx.fillRect(0, 0, W, H);
  }
}

/** The singing Pokemon doll (Jigglypuff style). `face` 1 = looking at the children, 0 = back. */
function drawDoll(ctx, face, flip, light, t) {
  const { x, y, r } = DOLL;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(Math.max(0.04, flip), 1);
  // Glow behind
  const glow = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.8);
  glow.addColorStop(0, light === 'red' ? 'rgba(248,113,113,0.6)' : light === 'green' ? 'rgba(74,222,128,0.45)' : 'rgba(250,204,21,0.5)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.8, 0, TAU);
  ctx.fill();
  // Feet and ears
  ctx.fillStyle = '#f9a8d4';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * r * 0.45, r * 0.9, r * 0.28, r * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * r * 0.35, -r * 0.75);
    ctx.lineTo(s * r * 0.95, -r * 1.05);
    ctx.lineTo(s * r * 0.8, -r * 0.35);
    ctx.fill();
    if (face) {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(s * r * 0.5, -r * 0.72);
      ctx.lineTo(s * r * 0.85, -r * 0.9);
      ctx.lineTo(s * r * 0.78, -r * 0.5);
      ctx.fill();
      ctx.fillStyle = '#f9a8d4';
    }
  }
  // Body
  const body = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.2, 0, 0, r);
  body.addColorStop(0, '#fce7f3');
  body.addColorStop(1, '#f472b6');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  // The curl of hair
  ctx.strokeStyle = '#f472b6';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -r * 0.62, r * 0.28, -Math.PI * 0.9, Math.PI * 0.6);
  ctx.stroke();
  ctx.lineCap = 'butt';
  if (face) {
    // Big eyes; they glow red when the doll is watching
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(s * r * 0.36, -r * 0.05, r * 0.26, r * 0.3, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = light === 'red' ? '#ef4444' : '#0ea5e9';
      if (light === 'red') {
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 16;
      }
      ctx.beginPath();
      ctx.arc(s * r * 0.36 + Math.sin(t * 2) * 3, -r * 0.02, r * 0.16, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s * r * 0.3, -r * 0.1, r * 0.05, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = '#9d174d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, r * 0.38, r * 0.12, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    // Back: a darker patch and a bow
    ctx.fillStyle = 'rgba(190,24,93,0.15)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.2, r * 0.55, r * 0.5, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

const snapshot = (s) => {
  const p = playerOf(s);
  return { light: s.light, status: s.status, count: s.clock < 0 ? Math.ceil(-s.clock) : 0, progress: p.y / TRACK, place: p.place, left: Math.max(0, Math.ceil(TIME_LIMIT - Math.max(0, s.clock))), out: s.runners.filter((c) => c.out).length };
};

/**
 * "Đèn xanh, đèn đỏ" (the squid-game race): hold the button to run while the doll sings
 * with its back turned; let go when it turns round. Anyone moving while it watches is out.
 * Reach the finish first to win.
 */
export function RedLightGame({ player, onClose, onBerries, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [rivals, setRivals] = useState(() => pickOpponents(player.name, RIVALS, random));
  const [first] = useState(() => createRedLight({ random }));
  const game = useRef(first);
  const fx = useRef({ particles: [], beams: [], notes: [], flip: 0, time: 0, turned: 0 });
  const running = useRef(false);
  const [holding, setHolding] = useState(false);
  const [ui, setUi] = useState(() => snapshot(first));
  const [phase, setPhase] = useState('play'); // play | done
  const [banner, setBanner] = useState(null);
  const later = useLater();
  const images = { player: loadImage(player.image) };
  rivals.forEach((r, i) => (images[`cpu${i}`] = loadImage(r.image)));
  const say = (text, tone) => setBanner((b) => ({ id: (b?.id || 0) + 1, text, tone }));
  const hold = (on) => {
    running.current = on;
    setHolding(on);
  };

  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        hold(true);
      }
    };
    const up = (e) => (e.code === 'Space' || e.code === 'ArrowUp') && hold(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useLoop((dt) => {
    const s = game.current;
    const v = fx.current;
    v.time += dt;
    const before = snapshot(s);
    stepRedLight(s, dt, running.current);
    for (const e of s.events.splice(0)) {
      if (e.type === 'go') {
        say('BẮT ĐẦU!', 'green');
        sounds.playEnergySurge();
      } else if (e.type === 'light') {
        if (e.light === 'turning') sounds.playScanBeep();
        if (e.light === 'green') {
          v.turned = 0.35; // quick turn back
          sounds.playNote?.(523, { duration: 0.25 });
        }
        if (e.light === 'red') sounds.playWhoosh();
      } else if (e.type === 'out') {
        const c = s.runners.find((r) => r.id === e.id);
        const cy = PLAYER_Y - (c.y - Math.min(CAM_MAX, playerOf(s).y));
        v.beams.push({ x: laneX(c.lane), y: cy - 20, life: 0.6, max: 0.6 });
        burst(v.particles, laneX(c.lane), cy - 20, { count: 22, colors: ['#ef4444', '#fca5a5', '#ffffff'], speed: 170, gravity: 120 });
        sounds.playPop();
        if (e.id !== 'player') say(`${rivals[Number(e.id.slice(3))].name} bị loại!`, 'red');
      } else if (e.type === 'finish' && e.id !== 'player' && e.place === 1) {
        say(`${rivals[Number(e.id.slice(3))].name} về trước!`, 'blue');
      } else if (e.type === 'end') {
        running.current = false;
        setHolding(false);
        if (e.status === 'out') {
          say('BỊ PHÁT HIỆN! 😵', 'red');
          sounds.playOops?.();
        } else if (e.status === 'won' || e.status === 'finished') {
          say(e.status === 'won' ? 'VỀ NHẤT! 🏆' : 'VỀ ĐÍCH! 🏁', e.status === 'won' ? 'gold' : 'green');
          sounds.playSuccessFanfare();
          try {
            confetti({ particleCount: e.status === 'won' ? 150 : 60, spread: 90, origin: { y: 0.3 }, zIndex: 9999 });
          } catch {
            // decoration
          }
        } else say('HẾT GIỜ!', 'red');
        later(() => setPhase('done'), 1800);
      }
    }
    const now = snapshot(s);
    if (now.light !== before.light || now.count !== before.count || now.status !== before.status || Math.abs(now.progress - ui.progress) > 0.01 || now.left !== ui.left || now.out !== ui.out) setUi(now);

    // Doll turning: flip 1 -> 0 -> 1 around the moment it changes face
    const facing = s.light === 'red' ? 1 : 0;
    if (s.light === 'turning') v.flip = Math.abs(Math.cos((1 - s.lightT / 0.55) * Math.PI));
    else if (v.turned > 0) {
      v.turned -= dt;
      v.flip = Math.abs(Math.cos((1 - v.turned / 0.35) * Math.PI));
    } else v.flip = 1;
    const showFace = s.light === 'turning' ? s.lightT < 0.55 / 2 : v.turned > 0.35 / 2 ? 1 : facing;
    // Singing notes while green
    if (s.light === 'green' && s.clock > 0 && Math.random() < dt * 3) v.notes.push({ x: DOLL.x + (Math.random() - 0.5) * 60, y: DOLL.y - 20, vx: (Math.random() - 0.5) * 30, life: 1.4, max: 1.4, ch: Math.random() < 0.5 ? '♪' : '♫' });

    const ctx = getCtx();
    if (!ctx) return;
    const p = playerOf(s);
    const cam = Math.min(CAM_MAX, p.y);
    ctx.clearRect(0, 0, W, H);
    drawField(ctx, cam, s.light, v.time);
    // Laser sweep while watching
    if (s.light === 'red') {
      const sweep = Math.sin(v.time * 1.8) * 140;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const sx of [-16, 16]) {
        const g = ctx.createLinearGradient(DOLL.x, DOLL.y, DOLL.x + sweep, H);
        g.addColorStop(0, 'rgba(248,113,113,0.8)');
        g.addColorStop(1, 'rgba(248,113,113,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(DOLL.x + sx, DOLL.y);
        ctx.lineTo(DOLL.x + sweep + sx * 3, H);
        ctx.stroke();
      }
      ctx.restore();
    }
    // Runners, far ones first
    const order = [...s.runners].sort((a, b) => b.y - a.y);
    for (const c of order) {
      const y = PLAYER_Y - (c.y - cam);
      if (y < DOLL.y + 30 || y > H + 40) continue;
      const x = laneX(c.lane);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 18, 6, 0, 0, TAU);
      ctx.fill();
      if (c.id === 'player') {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, y + 4, 22, 8, 0, 0, TAU);
        ctx.stroke();
      }
      const bob = c.moving ? Math.abs(Math.sin(v.time * 16 + c.lane)) * 5 : 0;
      if (c.out) {
        drawSprite(ctx, images[c.id], x, y - 14, 42, { rotate: Math.PI / 2, alpha: 0.45 });
        ctx.fillStyle = '#dc2626';
        ctx.font = '900 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✖', x, y - 10);
      } else {
        drawSprite(ctx, images[c.id], x, y - 20 - bob, c.id === 'player' ? 50 : 42);
        if (c.moving && Math.random() < 0.3) v.particles.push({ x: x + (Math.random() - 0.5) * 10, y: y + 2, vx: (Math.random() - 0.5) * 30, vy: 30, life: 0.35, max: 0.35, size: 2.5 + Math.random() * 2, color: 'rgba(180,83,9,0.45)', gravity: 0 });
      }
      if (c.place) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(['', '🥇', '🥈', '🥉', '4', '5', '6'][c.place], x, y - 48);
      }
    }
    updateParticles(ctx, v.particles, dt);
    // Elimination beams from the doll's eyes
    for (let i = v.beams.length - 1; i >= 0; i--) {
      const b = v.beams[i];
      b.life -= dt;
      if (b.life <= 0) {
        v.beams.splice(i, 1);
        continue;
      }
      const a = b.life / b.max;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(239,68,68,${a})`;
      ctx.lineWidth = 8 * a;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(DOLL.x, DOLL.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 14 * (1.4 - a), 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // The doll on its stand, above everything
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(DOLL.x - 30, DOLL.y + DOLL.r - 4, 60, 12);
    drawDoll(ctx, showFace, v.flip, s.light, v.time);
    for (let i = v.notes.length - 1; i >= 0; i--) {
      const n = v.notes[i];
      n.life -= dt;
      if (n.life <= 0) {
        v.notes.splice(i, 1);
        continue;
      }
      n.x += n.vx * dt;
      n.y -= 26 * dt;
      ctx.globalAlpha = n.life / n.max;
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(n.ch, n.x, n.y);
      ctx.globalAlpha = 1;
    }
    // Progress rail on the right
    ctx.fillStyle = 'rgba(15,23,42,0.45)';
    ctx.beginPath();
    ctx.roundRect(W - 16, 170, 8, 300, 4);
    ctx.fill();
    for (const c of s.runners) {
      const py = 470 - (c.y / TRACK) * 300;
      ctx.fillStyle = c.out ? '#64748b' : c.id === 'player' ? '#38bdf8' : '#f43f5e';
      ctx.beginPath();
      ctx.arc(W - 12, py, c.id === 'player' ? 6 : 4, 0, TAU);
      ctx.fill();
    }
  }, phase !== 'done');

  const replay = () => {
    game.current = createRedLight({ random });
    fx.current = { particles: [], beams: [], notes: [], flip: 0, time: 0, turned: 0 };
    setRivals(pickOpponents(player.name, RIVALS, random));
    running.current = false;
    setHolding(false);
    setBanner(null);
    setPhase('play');
    setUi(snapshot(game.current));
  };

  const li = LIGHT_UI[ui.light];
  const status = ui.status;
  const headline = status === 'won' ? 'Về nhất! 🏆' : status === 'finished' ? `Về thứ ${ui.place}!` : status === 'out' ? 'Bị phát hiện cử động! 😵' : 'Hết giờ rồi!';

  return (
    <SportsShell
      title="🦑 Đèn xanh, đèn đỏ"
      label="Đèn xanh đèn đỏ"
      player={player}
      opponent={null}
      onClose={onClose}
      background="bg-gradient-to-b from-pink-400 via-rose-500 to-slate-900"
      dataAttrs={{ 'data-phase': phase, 'data-light': ui.light, 'data-status': ui.status }}
    >
      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden touch-none" data-testid="redlight-stage">
        <canvas ref={canvasRef} className="max-w-full max-h-full" style={{ aspectRatio: `${W} / ${H}`, width: '100%', height: 'auto' }} />
        {ui.count === 0 && phase === 'play' && (
          <div className="absolute inset-x-0 top-2 flex justify-center pointer-events-none">
            <div key={ui.light} className={`pop-in whitespace-nowrap px-4 py-1.5 rounded-full bg-gradient-to-r ${li.cls} text-white text-base font-black shadow-lg border-2 border-white/70`} data-testid="redlight-light">
              {li.icon} {li.text}
            </div>
          </div>
        )}
        {ui.count === 0 && phase === 'play' && (
          <span className="absolute left-2 top-12 px-2 py-1 rounded-full bg-black/50 text-white text-xs font-black tabular-nums pointer-events-none">⏱ {ui.left}s</span>
        )}
        {ui.count > 0 && (
          <>
            <div key={ui.count} className="count-pop absolute left-1/2 top-[40%] text-8xl font-black text-white sport-banner pointer-events-none" data-testid="countdown">
              {ui.count}
            </div>
            <p className="absolute top-[58%] left-1/2 -translate-x-1/2 w-[88%] px-3 py-2 rounded-2xl bg-black/60 text-center text-white text-sm font-black pointer-events-none">
              Giữ nút để chạy khi Jigglypuff quay lưng hát. Khi nó quay lại, buông tay đứng im ngay nhé!
            </p>
          </>
        )}
        {phase === 'play' && ui.status === 'play' && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              hold(true);
            }}
            onPointerUp={() => hold(false)}
            onPointerCancel={() => hold(false)}
            onPointerLeave={() => hold(false)}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Giữ để chạy"
            aria-pressed={holding}
            className={`absolute bottom-3 left-1/2 -translate-x-1/2 w-40 h-20 rounded-full border-4 text-white text-lg font-black shadow-2xl transition-all select-none ${holding ? 'bg-gradient-to-b from-emerald-400 to-green-600 border-yellow-200 scale-95' : 'bg-gradient-to-b from-sky-500 to-indigo-600 border-white/80'}`}
            data-testid="redlight-run"
          >
            {holding ? '🏃 Đang chạy...' : '👆 GIỮ ĐỂ CHẠY'}
          </button>
        )}
        <Banner banner={banner} />
        {phase === 'done' && (
          <MatchResult
            result={redLightResult(status)}
            headline={headline}
            detail={`${ui.out} Pokémon bị loại`}
            player={player}
            opponent={null}
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
