// Canvas drawing for the Pokemon runner. The context must already be scaled so that one
// unit is one logical pixel of the WORLD (see runnerGame.js).
import { WORLD, PLAYER, isNight } from './runnerGame';

const ready = (img) => !!img && img.complete && img.naturalWidth > 0;

// Official artwork has transparent margins, so sprites are drawn larger than their hitbox
const SPRITE_SCALE = 1.35;

function drawSky(ctx, state, night) {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.groundY);
  if (night) {
    sky.addColorStop(0, '#0b1438');
    sky.addColorStop(1, '#27336b');
  } else {
    sky.addColorStop(0, '#7dd3fc');
    sky.addColorStop(1, '#e0f2fe');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.groundY);

  if (night) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 24; i++) {
      const x = (i * 97 + 13) % WORLD.width;
      const y = (i * 53) % 110 + 8;
      ctx.fillRect(x, y, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
    }
    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.arc(520, 38, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#27336b';
    ctx.beginPath();
    ctx.arc(528, 33, 14, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(520, 40, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Clouds drift slowly (parallax)
  ctx.fillStyle = night ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 4; i++) {
    const x = WORLD.width - ((state.distance * 0.15 + i * 170) % (WORLD.width + 80)) + 40;
    const y = 30 + ((i * 37) % 50);
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.arc(x + 14, y - 6, 14, 0, Math.PI * 2);
    ctx.arc(x + 30, y, 11, 0, Math.PI * 2);
    ctx.fill();
  }

  // Distant hills scroll at a third of the speed
  ctx.fillStyle = night ? '#1e2a5a' : '#86efac';
  ctx.beginPath();
  ctx.moveTo(0, WORLD.groundY);
  const offset = state.distance * 0.33;
  for (let x = 0; x <= WORLD.width; x += 10) {
    const y = WORLD.groundY - 22 - Math.sin((x + offset) / 70) * 12 - Math.sin((x + offset) / 23) * 4;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(WORLD.width, WORLD.groundY);
  ctx.fill();
}

function drawGround(ctx, state, night) {
  ctx.fillStyle = night ? '#14532d' : '#4ade80';
  ctx.fillRect(0, WORLD.groundY, WORLD.width, WORLD.height - WORLD.groundY);
  ctx.fillStyle = night ? '#166534' : '#22c55e';
  ctx.fillRect(0, WORLD.groundY, WORLD.width, 3);
  // Pebbles and grass tufts scroll with the runner
  ctx.fillStyle = night ? 'rgba(255,255,255,0.18)' : 'rgba(21,128,61,0.55)';
  for (let i = 0; i < 18; i++) {
    const x = WORLD.width - ((state.distance + i * 47) % (WORLD.width + 20));
    const y = WORLD.groundY + 7 + ((i * 7) % 18);
    ctx.fillRect(x, y, i % 2 ? 6 : 3, 2);
  }
}

function shadow(ctx, cx, width, heightAbove) {
  const k = Math.max(0.35, 1 - heightAbove / 160);
  ctx.fillStyle = `rgba(0,0,0,${0.18 * k})`;
  ctx.beginPath();
  ctx.ellipse(cx, WORLD.groundY + 3, (width / 2) * k, 4 * k, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSprite(ctx, img, box, time, { bob = 0, flip = false, tilt = 0 } = {}) {
  const w = box.w * SPRITE_SCALE;
  const h = box.h * SPRITE_SCALE;
  const cx = box.x + box.w / 2;
  const bottom = WORLD.groundY - box.bottom + bob;
  ctx.save();
  ctx.translate(cx, bottom - h / 2 + (h - box.h) * 0.35);
  if (tilt) ctx.rotate(tilt);
  if (flip) ctx.scale(-1, 1);
  if (ready(img)) {
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
  } else {
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(box.w, box.h) / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawProp(ctx, o, night) {
  const top = WORLD.groundY - o.bottom - o.h;
  const x = o.x;
  if (o.kind === 'rock' || o.kind === 'rocks') {
    const pieces = o.kind === 'rocks' ? 3 : 1;
    const pw = o.w / pieces;
    for (let i = 0; i < pieces; i++) {
      const px = x + i * pw;
      const ph = o.h * (o.kind === 'rocks' ? [0.8, 1, 0.7][i] : 1);
      ctx.fillStyle = night ? '#6b7280' : '#9ca3af';
      ctx.beginPath();
      ctx.moveTo(px, WORLD.groundY);
      ctx.lineTo(px + pw * 0.15, WORLD.groundY - ph * 0.7);
      ctx.lineTo(px + pw * 0.5, WORLD.groundY - ph);
      ctx.lineTo(px + pw * 0.9, WORLD.groundY - ph * 0.6);
      ctx.lineTo(px + pw, WORLD.groundY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(px + pw * 0.2, WORLD.groundY - ph * 0.65);
      ctx.lineTo(px + pw * 0.5, WORLD.groundY - ph * 0.95);
      ctx.lineTo(px + pw * 0.45, WORLD.groundY - ph * 0.6);
      ctx.fill();
    }
  } else if (o.kind === 'bush') {
    ctx.fillStyle = night ? '#166534' : '#16a34a';
    const r = o.h / 2;
    ctx.beginPath();
    ctx.arc(x + r, WORLD.groundY - r * 0.9, r * 0.9, 0, Math.PI * 2);
    ctx.arc(x + o.w / 2, top + r * 0.9, r, 0, Math.PI * 2);
    ctx.arc(x + o.w - r, WORLD.groundY - r * 0.9, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(x + o.w * 0.35, top + r * 0.8, 2.5, 0, Math.PI * 2);
    ctx.arc(x + o.w * 0.65, top + r * 1.2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (o.kind === 'stump') {
    ctx.fillStyle = night ? '#78350f' : '#92400e';
    ctx.fillRect(x, top + 4, o.w, o.h - 4);
    ctx.fillStyle = night ? '#a16207' : '#d97706';
    ctx.beginPath();
    ctx.ellipse(x + o.w / 2, top + 4, o.w / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,53,15,0.8)';
    ctx.beginPath();
    ctx.ellipse(x + o.w / 2, top + 4, o.w / 4, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBerry(ctx, o, time) {
  const cx = o.x + o.w / 2;
  const cy = WORLD.groundY - o.bottom - o.h / 2 + Math.sin(time / 200 + o.id) * 3;
  ctx.fillStyle = o.berry === 'oran' ? '#3b82f6' : '#ec4899';
  ctx.beginPath();
  ctx.arc(cx, cy, o.w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(cx - 4, cy - 4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy - o.h / 2, 5, 2.5, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw one frame. assets = { player: Image, pokemon: Map<id, Image> }.
 */
export function drawRunner(ctx, state, assets) {
  const night = isNight(state);
  const t = state.time;
  drawSky(ctx, state, night);
  drawGround(ctx, state, night);

  for (const o of state.obstacles) {
    if (o.kind === 'berry') {
      drawBerry(ctx, o, t);
    } else if (o.kind === 'pokemon' || o.kind === 'flyer') {
      if (o.kind === 'pokemon') shadow(ctx, o.x + o.w / 2, o.w, 0);
      const bob = o.kind === 'flyer' ? Math.sin(t / 110 + o.phase) * 4 : 0;
      drawSprite(ctx, assets.pokemon?.get(o.pokemonId), o, t, { bob });
    } else {
      shadow(ctx, o.x + o.w / 2, o.w, 0);
      drawProp(ctx, o, night);
    }
  }

  // Runner: bobs while running, squashes when ducking, tilts in the air, blinks when hit
  const p = state.player;
  const box = { x: PLAYER.x, bottom: p.y, w: PLAYER.w, h: p.ducking && p.onGround ? PLAYER.duckH : PLAYER.h };
  shadow(ctx, box.x + box.w / 2, box.w, p.y);
  const blinkHidden = state.invincibleMs > 0 && Math.floor(state.invincibleMs / 100) % 2 === 0;
  if (!blinkHidden) {
    const bob = p.onGround ? -Math.abs(Math.sin(t / 70)) * 3 : 0;
    const tilt = p.onGround ? 0 : p.vy > 0 ? -0.15 : 0.1;
    const drawBox = p.ducking && p.onGround ? { ...box, w: box.w * 1.2, x: box.x - box.w * 0.1 } : box;
    // Official artwork mostly faces left; mirror it so the runner looks where it is going
    drawSprite(ctx, assets.player, drawBox, t, { bob, tilt: -tilt, flip: true });
  }
}
