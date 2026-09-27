import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { TRACK, createPonyta, stepPonyta, gallop, zoneOf, greenHalf, yellowHalf, placeOf, standings, playerOf, ponytaStars } from '../../utils/carnival/ponyta';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { useLoop, useLater, useCanvas, loadImage, drawSprite, burst, updateParticles } from '../sports/sportsKit';
import { CarnivalShell, CarnivalResult, Countdown } from './CarnivalCommon';

const W = 360;
const H = 560;
const PX = 3; // screen pixels per track unit
const PLAYER_X = 112;
const TRACK_TOP = 214;
const LANE_H = 60;
const TRACK_BOTTOM = TRACK_TOP + LANE_H * 4;
const GAUGE = { x: 34, y: 508, w: 292, h: 26 };
const TAU = Math.PI * 2;
const COLORS = { player: '#3b82f6', rapidash: '#f97316', ponyta2: '#facc15', mudsdale: '#92400e' };
const NAMES = { rapidash: 'Rapidash', ponyta2: 'Ponyta', mudsdale: 'Mudsdale' };
const SIZE = { player: 1, rapidash: 1.08, ponyta2: 0.98, mudsdale: 1.12 };
const PLACE_TEXT = ['', 'Về nhất! 🥇', 'Về nhì! 🥈', 'Về ba! 🥉', 'Về thứ tư – lần sau cố lên nhé!'];
const FEEDBACK = { green: { text: 'TUYỆT!', tone: 'gold' }, yellow: { text: 'Tốt!', tone: 'green' }, miss: { text: 'Ối!', tone: 'red' } };

const mod = (a, n) => ((a % n) + n) % n;
const hash = (k) => {
  const x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const laneGround = (lane) => TRACK_TOP + LANE_H * lane + LANE_H - 8;
const laneScale = (lane) => 0.8 + lane * 0.07;

function drawSky(ctx, cam, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, 200);
  sky.addColorStop(0, '#38bdf8');
  sky.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, 210);
  // Sun
  const sun = ctx.createRadialGradient(305, 70, 4, 305, 70, 60);
  sun.addColorStop(0, 'rgba(254,249,195,1)');
  sun.addColorStop(0.35, 'rgba(253,224,71,0.9)');
  sun.addColorStop(1, 'rgba(253,224,71,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(240, 5, 130, 130);
  // Clouds, very slow
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let k = 0; k < 4; k++) {
    const x = mod(k * 150 - cam * PX * 0.04 - time * 5, W + 160) - 80;
    const y = 58 + (k % 2) * 22;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, TAU);
    ctx.arc(x + 16, y - 7, 17, 0, TAU);
    ctx.arc(x + 34, y, 13, 0, TAU);
    ctx.fill();
  }
  // Hills (two layers of parallax)
  for (const [f, base, amp, color] of [
    [0.1, 118, 18, '#86efac'],
    [0.22, 128, 12, '#4ade80'],
  ]) {
    const scroll = cam * PX * f;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 210);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, base - amp * Math.sin((x + scroll) / 55) - amp * 0.5 * Math.sin((x + scroll) / 23));
    ctx.lineTo(W, 210);
    ctx.fill();
  }
}

function drawStand(ctx, cam, time, cheer) {
  const scroll = cam * PX * 0.5;
  // Stand body
  ctx.fillStyle = '#7c3aed';
  ctx.fillRect(0, 112, W, 88);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 124; y < 200; y += 20) ctx.fillRect(0, y + 14, W, 3);
  // Crowd: 3 rows of bobbing heads, jumping more when the child gallops
  for (let row = 0; row < 3; row++) {
    const y = 132 + row * 20;
    const sp = 17;
    const first = Math.floor((scroll + row * 7) / sp) - 1;
    for (let k = first; k < first + W / sp + 3; k++) {
      const x = k * sp - scroll - row * 7;
      const h = hash(k * 3 + row);
      const bob = Math.max(0, Math.sin(time * (7 + h * 4) + k)) * (1.5 + cheer * 5 * h);
      ctx.fillStyle = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#fb923c', '#a3e635'][Math.floor(h * 7)];
      ctx.beginPath();
      ctx.roundRect(x - 6, y - bob, 12, 14, 5);
      ctx.fill();
      ctx.fillStyle = h > 0.5 ? '#fcd7b6' : '#e0a67a';
      ctx.beginPath();
      ctx.arc(x, y - 5 - bob, 5.5, 0, TAU);
      ctx.fill();
      // Waving arms when cheering
      if (cheer > 0.3 && h > 0.55) {
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x - 5, y + 1 - bob);
        ctx.lineTo(x - 9, y - 10 - bob - Math.sin(time * 14 + k) * 3);
        ctx.moveTo(x + 5, y + 1 - bob);
        ctx.lineTo(x + 9, y - 10 - bob + Math.sin(time * 14 + k) * 3);
        ctx.stroke();
      }
    }
  }
  // Striped roof
  const sw = 20;
  const off = mod(scroll, sw * 2);
  for (let x = -off - sw * 2; x < W + sw; x += sw * 2) {
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x, 100, sw, 14);
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(x + sw, 100, sw, 14);
  }
  ctx.fillStyle = '#b91c1c';
  for (let x = -off - sw * 2; x < W + sw; x += sw) {
    ctx.beginPath();
    ctx.arc(x + sw / 2, 114, sw / 2, 0, Math.PI);
    ctx.fill();
  }
  // Pennant string with flags that flutter
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 6) ctx.lineTo(x, 92 + Math.sin((x + scroll) / 30) * 3);
  ctx.stroke();
  const fs = 22;
  const f0 = Math.floor(scroll / fs) - 1;
  for (let k = f0; k < f0 + W / fs + 3; k++) {
    const x = k * fs - scroll;
    const y = 92 + Math.sin((x + scroll) / 30) * 3;
    const flap = Math.sin(time * 6 + k) * 2;
    ctx.fillStyle = ['#facc15', '#38bdf8', '#f472b6', '#4ade80', '#fb923c'][mod(k, 5)];
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x + 6, y);
    ctx.lineTo(x + flap, y + 13);
    ctx.fill();
  }
}

function drawFence(ctx, cam, y, factor, dark) {
  const scroll = cam * PX * factor;
  ctx.fillStyle = dark ? '#e2e8f0' : '#ffffff';
  ctx.fillRect(0, y, W, 5);
  ctx.fillRect(0, y + 10, W, 5);
  const sp = 46;
  const first = Math.floor(scroll / sp) - 1;
  for (let k = first; k < first + W / sp + 3; k++) {
    const x = k * sp - scroll;
    ctx.fillStyle = dark ? '#cbd5e1' : '#f8fafc';
    ctx.fillRect(x - 3, y - 6, 6, 26);
    ctx.fillStyle = k % 2 ? '#ef4444' : '#2563eb';
    ctx.fillRect(x - 3, y - 6, 6, 4);
  }
}

function drawTrack(ctx, cam, time) {
  const dirt = ctx.createLinearGradient(0, TRACK_TOP, 0, TRACK_BOTTOM);
  dirt.addColorStop(0, '#d6a46c');
  dirt.addColorStop(1, '#b77b43');
  ctx.fillStyle = dirt;
  ctx.fillRect(0, TRACK_TOP, W, TRACK_BOTTOM - TRACK_TOP);
  // Grass edge at the back
  ctx.fillStyle = '#65a30d';
  ctx.fillRect(0, 206, W, 10);
  // Pebbles and hoof prints scrolling with the ground
  const scroll = cam * PX;
  const sp = 29;
  const first = Math.floor(scroll / sp) - 1;
  for (let k = first; k < first + W / sp + 3; k++) {
    const h = hash(k);
    const x = k * sp - scroll + h * 12;
    const y = TRACK_TOP + 8 + hash(k + 99) * (TRACK_BOTTOM - TRACK_TOP - 16);
    ctx.fillStyle = h > 0.5 ? 'rgba(120,70,30,0.35)' : 'rgba(255,237,213,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y, 3 + h * 4, 1.5 + h * 1.5, 0, 0, TAU);
    ctx.fill();
  }
  // Lane lines
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 16]);
  ctx.lineDashOffset = scroll;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, TRACK_TOP + i * LANE_H);
    ctx.lineTo(W, TRACK_TOP + i * LANE_H);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Distance boards on the back fence every 300
  for (let d = 300; d < TRACK; d += 300) {
    const x = PLAYER_X + (d - cam) * PX;
    if (x < -30 || x > W + 30) continue;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(x - 18, 176, 36, 22, 5);
    ctx.fill();
    ctx.fillStyle = '#1e3a8a';
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round((TRACK - d) / 10)}m`, x, 191);
  }
  // Start line and finish arch
  const sx = PLAYER_X + (0 - cam) * PX;
  if (sx > -10 && sx < W + 10) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(sx - 3, TRACK_TOP, 6, TRACK_BOTTOM - TRACK_TOP);
  }
  const fx = PLAYER_X + (TRACK - cam) * PX;
  if (fx > -100 && fx < W + 100) {
    const sq = 10;
    for (let i = 0; i * sq < TRACK_BOTTOM - TRACK_TOP; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#0f172a' : '#f8fafc';
        ctx.fillRect(fx - sq + j * sq, TRACK_TOP + i * sq, sq, sq);
      }
    }
    // Back pole and banner (the front pole is drawn over the riders)
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(fx - 14, 130, 7, TRACK_TOP - 130);
    const wave = Math.sin(time * 4) * 2;
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(fx - 74, 118 + wave, 148, 30, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7c2d12';
    ctx.font = '900 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏁 VỀ ĐÍCH 🏁', fx, 139 + wave);
  }
}

function drawFrontPole(ctx, cam) {
  const fx = PLAYER_X + (TRACK - cam) * PX;
  if (fx < -40 || fx > W + 40) return;
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(fx + 6, 132, 8, TRACK_BOTTOM + 12 - 132);
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(fx + 10, 130, 7, 0, TAU);
  ctx.fill();
}

function drawRider(ctx, r, strideAt, img, x, time, playerImg) {
  const ground = laneGround(r.lane);
  const scale = laneScale(r.lane) * SIZE[r.id];
  const size = 92 * scale;
  const stride = Math.sin(strideAt);
  const bob = Math.abs(stride) * 7 * scale;
  let tilt = stride * 0.07;
  if (r.stumble > 0) tilt = 0.32 + Math.sin(time * 30) * 0.08;
  // Shadow
  ctx.fillStyle = 'rgba(60,30,10,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, ground, size * 0.36 - bob * 0.6, 6 * scale, 0, 0, TAU);
  ctx.fill();
  // Speed glow behind a galloping Ponyta
  if (r.boostT > 0) {
    const g = ctx.createRadialGradient(x - size * 0.3, ground - size * 0.45, 4, x - size * 0.3, ground - size * 0.45, size * 0.7);
    g.addColorStop(0, 'rgba(253,224,71,0.55)');
    g.addColorStop(1, 'rgba(249,115,22,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - size * 1.1, ground - size * 1.1, size * 1.6, size * 1.2);
  }
  drawSprite(ctx, img, x, ground - size * 0.48 - bob, size, { flip: true, rotate: tilt, color: COLORS[r.id] });
  if (r.isPlayer) drawSprite(ctx, playerImg, x - 2 * scale, ground - size * 0.9 - bob, 50 * scale, { rotate: tilt * 1.4, color: COLORS.player });
  if (r.stumble > 0) {
    // Dizzy stars
    for (let i = 0; i < 3; i++) {
      const a = time * 7 + (i * TAU) / 3;
      ctx.fillStyle = '#fde047';
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', x + Math.cos(a) * 20, ground - size * 1.05 + Math.sin(a) * 6);
    }
  }
}

function drawEdgeMarker(ctx, r, img, x, cam) {
  const right = x > W;
  const ex = right ? W - 22 : 22;
  const ey = laneGround(r.lane) - 30;
  ctx.fillStyle = 'rgba(15,23,42,0.6)';
  ctx.beginPath();
  ctx.arc(ex, ey, 17, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = COLORS[r.id];
  ctx.lineWidth = 3;
  ctx.stroke();
  drawSprite(ctx, img, ex, ey, 30, { flip: true, color: COLORS[r.id] });
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  if (right) {
    ctx.moveTo(W - 3, ey);
    ctx.lineTo(W - 9, ey - 6);
    ctx.lineTo(W - 9, ey + 6);
  } else {
    ctx.moveTo(3, ey);
    ctx.lineTo(9, ey - 6);
    ctx.lineTo(9, ey + 6);
  }
  ctx.fill();
  ctx.font = '800 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(Math.abs(r.dist - cam) / 10)}m`, ex, ey + 28);
}

function drawProgress(ctx, s, images, playerImg) {
  const x0 = 96;
  const x1 = W - 36;
  const y = 22;
  ctx.fillStyle = 'rgba(15,23,42,0.55)';
  ctx.beginPath();
  ctx.roundRect(x0 - 12, y - 12, x1 - x0 + 36, 24, 12);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x0, y - 2, x1 - x0, 4);
  ctx.font = '15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏁', x1 + 12, y + 5);
  for (const r of [...s.riders].reverse()) {
    const px = x0 + (x1 - x0) * Math.min(1, r.dist / TRACK);
    ctx.fillStyle = COLORS[r.id];
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, y, r.isPlayer ? 8 : 6, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (r.isPlayer) drawSprite(ctx, playerImg, px, y + 17, 24);
    else drawSprite(ctx, images[r.id], px, y - 14, 18, { flip: true, color: COLORS[r.id] });
  }
  // Place badge
  const place = placeOf(s);
  ctx.fillStyle = place === 1 ? '#facc15' : 'rgba(15,23,42,0.7)';
  ctx.beginPath();
  ctx.roundRect(8, 8, 70, 30, 12);
  ctx.fill();
  ctx.fillStyle = place === 1 ? '#7c2d12' : '#fff';
  ctx.font = '900 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Hạng ${place}`, 43, 29);
}

function drawGauge(ctx, s, look, time) {
  const { x, y, w, h } = GAUGE;
  // Panel
  ctx.fillStyle = 'rgba(15,23,42,0.82)';
  ctx.beginPath();
  ctx.roundRect(x - 16, y - 32, w + 32, h + 46, 18);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '900 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(s.status === 'play' ? 'Chạm khi kim vào ô XANH để phi nước đại!' : 'Về đích!', W / 2, y - 12);
  // Zones
  const gh = greenHalf(s);
  const yh = yellowHalf(s);
  const zx = (v) => x + v * w;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 13);
  ctx.clip();
  const red = ctx.createLinearGradient(x, 0, x + w, 0);
  red.addColorStop(0, '#be123c');
  red.addColorStop(0.5, '#f43f5e');
  red.addColorStop(1, '#be123c');
  ctx.fillStyle = red;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(zx(0.5 - yh), y, yh * 2 * w, h);
  const green = ctx.createLinearGradient(0, y, 0, y + h);
  green.addColorStop(0, '#86efac');
  green.addColorStop(1, '#16a34a');
  ctx.fillStyle = green;
  ctx.fillRect(zx(0.5 - gh), y, gh * 2 * w, h);
  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(x, y + 2, w, h * 0.32);
  // Flash of the last tap
  if (look.flash > 0) {
    ctx.fillStyle = look.flashColor.replace('A', String(look.flash * 0.45));
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 13);
  ctx.stroke();
  // Flame icon on the green zone
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('🔥', W / 2, y + h - 7);
  // Marker with a fading trail
  const mx = zx(s.marker);
  for (let i = 1; i <= 4; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.14 - i * 0.025})`;
    ctx.fillRect(mx - s.dir * i * 7 - 3, y - 2, 6, h + 4);
  }
  const pulse = 1 + Math.sin(time * 12) * 0.08;
  ctx.fillStyle = '#fff';
  ctx.shadowColor = zoneOf(s) === 'green' ? '#4ade80' : '#fff';
  ctx.shadowBlur = 10;
  ctx.fillRect(mx - 3, y - 5, 6, h + 10);
  ctx.beginPath();
  ctx.moveTo(mx - 8 * pulse, y - 9);
  ctx.lineTo(mx + 8 * pulse, y - 9);
  ctx.lineTo(mx, y - 1);
  ctx.fill();
  ctx.shadowBlur = 0;
}

/** Flames (additive glow, rising). */
function drawFlames(ctx, list, dt) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const k = p.life / p.max;
    ctx.globalAlpha = k;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * (0.6 + k));
    g.addColorStop(0, '#fef08a');
    g.addColorStop(0.45, k > 0.5 ? '#fb923c' : '#ef4444');
    g.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.6 + k), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

const fresh = (random) => ({
  race: createPonyta({ random }),
  cam: 0,
  time: 0,
  shake: 0,
  cheer: 0,
  flash: 0,
  flashColor: 'rgba(255,255,255,A)',
  looks: { player: { stride: 0.4 }, rapidash: { stride: 1.9 }, ponyta2: { stride: 3.1 }, mudsdale: { stride: 4.6 } }, // gallop phase of each rider
  dust: [],
  flames: [],
  sparks: [],
  lines: [],
});

const snap = (g) => {
  const s = g.race;
  return { place: placeOf(s), zone: zoneOf(s), streak: s.streak, taps: { ...s.taps }, best: s.bestStreak, ranking: standings(s) };
};

/**
 * "Đua ngựa Ponyta": the child's Pokemon rides a Ponyta against Rapidash, another Ponyta and
 * Mudsdale. Tap when the sweeping marker is in the green zone to gallop, careful not to stumble!
 */
export function PonytaGame({ player, onClose, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [phase, setPhase] = useState('ready'); // ready | play | finish | done
  const [first] = useState(() => fresh(random));
  const game = useRef(first);
  const [ui, setUi] = useState(() => snap(first));
  const [pops, setPops] = useState([]);
  const later = useLater();
  const idRef = useRef(0);
  const [images] = useState(() => ({
    player: loadImage(player.image),
    rapidash: loadImage(artworkUrl(78)),
    ponyta2: loadImage(artworkUrl(77)),
    mudsdale: loadImage(artworkUrl(750)),
    mount: loadImage(artworkUrl(77)),
  }));

  const pop = (text, tone) => {
    const id = ++idRef.current;
    setPops((list) => [...list.slice(-2), { id, text, tone }]);
    later(() => setPops((list) => list.filter((p) => p.id !== id)), 900);
  };

  const tap = () => {
    if (phase !== 'play') return;
    const g = game.current;
    const out = gallop(g.race);
    if (out.result === 'none') return;
    const me = playerOf(g.race);
    const x = PLAYER_X;
    const y = laneGround(me.lane) - 50;
    if (out.result === 'green') {
      sounds.playWhoosh();
      sounds.playNote(660 + Math.min(6, g.race.streak) * 60, { duration: 0.25, volume: 0.16 });
      burst(g.sparks, x + 10, y, { count: 16, colors: ['#fde047', '#fb923c', '#ffffff'], speed: 190, gravity: 120 });
      g.flash = 1;
      g.flashColor = 'rgba(134,239,172,A)';
      g.cheer = 1;
      pop(g.race.streak >= 3 ? `TUYỆT! x${g.race.streak} 🔥` : `${FEEDBACK.green.text} 🔥`, 'gold');
    } else if (out.result === 'yellow') {
      sounds.playPop();
      burst(g.sparks, x, y + 20, { count: 8, colors: ['#fde047', '#ffffff'], speed: 110, gravity: 200 });
      g.flash = 0.8;
      g.flashColor = 'rgba(253,224,71,A)';
      g.cheer = Math.max(g.cheer, 0.5);
      pop(FEEDBACK.yellow.text, 'green');
    } else {
      sounds.playOops();
      g.shake = 0.35;
      g.flash = 1;
      g.flashColor = 'rgba(244,63,94,A)';
      burst(g.dust, x - 10, laneGround(me.lane), { count: 12, colors: ['rgba(180,130,80,0.8)', 'rgba(230,200,160,0.8)'], speed: 90, gravity: 60, size: 6 });
      pop(`${FEEDBACK.miss.text} 😵`, 'red');
    }
    setUi(snap(g));
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        tap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useLoop((dt) => {
    const g = game.current;
    const s = g.race;
    g.time += dt;
    if (phase === 'play' || phase === 'finish') {
      stepPonyta(s, dt);
      for (const e of s.events.splice(0)) {
        if (e.type === 'surge' && Math.abs(s.riders.find((r) => r.id === e.rider).dist - g.cam) < 50) sounds.playNote(300, { duration: 0.12, volume: 0.05 });
        if (e.type === 'end') {
          setPhase('finish');
          sounds.playEnergySurge();
          pop(e.place === 1 ? 'VỀ NHẤT! 🏆' : 'VỀ ĐÍCH! 🏁', e.place === 1 ? 'gold' : 'green');
          try {
            confetti({ particleCount: e.place === 1 ? 150 : 70, spread: 100, origin: { y: 0.35 }, zIndex: 9999, colors: ['#ef4444', '#facc15', '#fb923c', '#ffffff'] });
          } catch {
            // decoration
          }
          later(() => setPhase('done'), 2000);
        }
      }
    }
    const me = playerOf(s);
    g.cam += (me.dist - g.cam) * Math.min(1, dt * 12);
    g.shake = Math.max(0, g.shake - dt);
    g.flash = Math.max(0, g.flash - dt * 3);
    g.cheer = Math.max(me.place ? 1 : 0, g.cheer - dt * 0.8, me.dist > TRACK * 0.85 ? 0.7 : 0);
    // Gallop animation, dust at every stride, flames behind a boosted Ponyta
    for (const r of s.riders) {
      const look = g.looks[r.id];
      const before = Math.floor(look.stride / Math.PI);
      look.stride += dt * (4 + r.speed * 0.12);
      const x = PLAYER_X + (r.dist - g.cam) * PX;
      if (Math.floor(look.stride / Math.PI) !== before && x > -40 && x < W + 40 && g.time > 0.1 && (phase === 'play' || phase === 'finish')) {
        const ground = laneGround(r.lane);
        for (let i = 0; i < 3; i++)
          g.dust.push({
            x: x - 22 + Math.random() * 10,
            y: ground - 2,
            vx: -me.speed * PX * 0.35 - 30 - Math.random() * 40,
            vy: -30 - Math.random() * 40,
            life: 0.55,
            max: 0.55,
            size: 3 + Math.random() * 4,
            color: 'rgba(214,180,140,0.75)',
            gravity: 70,
          });
      }
      if (r.isPlayer && r.boostT > 0 && phase !== 'ready') {
        const ground = laneGround(r.lane);
        for (let i = 0; i < 2; i++)
          g.flames.push({
            x: x - 34 + Math.random() * 10,
            y: ground - 44 + (Math.random() - 0.5) * 26,
            vx: -140 - Math.random() * 80,
            vy: -30 - Math.random() * 40,
            life: 0.45,
            max: 0.45,
            size: 6 + Math.random() * 6,
          });
      }
    }
    // Speed lines when galloping fast
    if (me.surge > 22 && Math.random() < 0.5) g.lines.push({ x: W + 20, y: TRACK_TOP + Math.random() * (TRACK_BOTTOM - TRACK_TOP), len: 30 + Math.random() * 50, life: 0.4 });

    const ctx = getCtx();
    if (!ctx) {
      // No canvas (tests): keep particle lists from growing
      g.dust.length = 0;
      g.flames.length = 0;
      g.sparks.length = 0;
      g.lines.length = 0;
      if (phase !== 'ready') setUi(snap(g));
      return;
    }
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake * 18, (Math.random() - 0.5) * g.shake * 18);
    drawSky(ctx, g.cam, g.time);
    drawStand(ctx, g.cam, g.time, g.cheer);
    drawFence(ctx, g.cam, 196, 1, true);
    drawTrack(ctx, g.cam, g.time);
    for (const r of [...s.riders].sort((a, b) => a.lane - b.lane)) {
      const x = PLAYER_X + (r.dist - g.cam) * PX;
      if (x > -60 && x < W + 60) drawRider(ctx, r, g.looks[r.id].stride, r.isPlayer ? images.mount : images[r.id], x, g.time, images.player);
    }
    drawFlames(ctx, g.flames, dt);
    updateParticles(ctx, g.dust, dt);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    for (let i = g.lines.length - 1; i >= 0; i--) {
      const l = g.lines[i];
      l.life -= dt;
      l.x -= 900 * dt;
      if (l.life <= 0) {
        g.lines.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = l.life / 0.4;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x + l.len, l.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawFrontPole(ctx, g.cam);
    drawFence(ctx, g.cam, TRACK_BOTTOM + 4, 1, false);
    // Grass in front
    ctx.fillStyle = '#4d7c0f';
    ctx.fillRect(0, TRACK_BOTTOM + 24, W, H - TRACK_BOTTOM - 24);
    updateParticles(ctx, g.sparks, dt);
    for (const r of s.riders) {
      const x = PLAYER_X + (r.dist - g.cam) * PX;
      if (!r.isPlayer && (x < -40 || x > W + 40)) drawEdgeMarker(ctx, r, images[r.id], x, g.cam);
    }
    ctx.restore();
    drawProgress(ctx, s, images, images.player);
    drawGauge(ctx, s, g, g.time);
    if (phase !== 'ready') setUi(snap(g));
  }, phase !== 'done');

  const replay = () => {
    game.current = fresh(random);
    setUi(snap(game.current));
    setPops([]);
    setPhase('ready');
  };

  const place = ui.place;
  const stars = ponytaStars(place);
  const nameOf = (id) => (id === 'player' ? player.name : NAMES[id]);

  return (
    <CarnivalShell
      title="🐴 Đua ngựa Ponyta"
      label="Đua ngựa Ponyta"
      onClose={onClose}
      background="bg-gradient-to-b from-sky-500 via-amber-600 to-lime-800"
      dataAttrs={{ 'data-phase': phase, 'data-place': place, 'data-zone': ui.zone, 'data-greens': ui.taps.green }}
    >
      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden touch-none" onPointerDown={tap} data-testid="ponyta-stage">
        <canvas ref={canvasRef} data-testid="ponyta-canvas" className="max-w-full max-h-full" style={{ aspectRatio: `${W} / ${H}`, width: '100%', height: 'auto' }} />
        {/* Tap feedback */}
        <div className="pointer-events-none absolute inset-x-0 top-[30%] flex justify-center">
          {pops.map((p) => (
            <span key={p.id} className={`ponyta-pop absolute text-5xl font-black sport-banner ${p.tone === 'gold' ? 'text-yellow-300' : p.tone === 'green' ? 'text-lime-300' : 'text-rose-400'}`}>
              {p.text}
            </span>
          ))}
        </div>
        {ui.streak >= 3 && phase === 'play' && (
          <span key={ui.streak} className="ponyta-streak pointer-events-none absolute left-3 top-[12%] px-3 py-1 rounded-full bg-orange-500 text-white text-sm font-black shadow-lg">
            🔥 Chuỗi {ui.streak}
          </span>
        )}
        {phase === 'ready' && (
          <>
            <p className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[88%] px-3 py-2 rounded-2xl bg-black/60 text-center text-white text-sm font-black pointer-events-none z-40">
              Chạm màn hình (hoặc phím cách) đúng lúc kim ở ô <span className="text-lime-300">XANH</span> để Ponyta phi nhanh! 🔥
            </p>
            <Countdown onDone={() => setPhase('play')} text="CHẠY!" />
          </>
        )}
        {phase === 'done' && (
          <CarnivalResult
            title={PLACE_TEXT[place] || 'Về đích!'}
            stars={stars}
            detail={`${ui.ranking.map((id, i) => `${['🥇', '🥈', '🥉', '4️⃣'][i]} ${nameOf(id)}`).join(' · ')} — ${ui.taps.green} cú phi TUYỆT 🔥`}
            onReplay={replay}
            onClose={onClose}
            onGold={onGold}
          />
        )}
      </div>
    </CarnivalShell>
  );
}
