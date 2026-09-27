// The child's trainer (anime style: red cap with a Pokeball logo, blue jacket, gloves, yellow
// backpack, 4-direction walk cycle with bobbing and arm / leg swing) and the expert trainers
// ("chuyên gia") drawn from a few parts: hat, coat and trousers colours, what they carry.
const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
function limb(ctx, x, y, len, w, angle, color, end, endColor) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  rr(ctx, -w / 2, 0, w, len, w / 2, color);
  if (end) rr(ctx, -w / 2 - 0.5, len - end, w + 1, end + 1.5, (w + 1) / 2, endColor);
  ctx.restore();
}

function eyes(ctx, face, blink) {
  if (face === 'up') return;
  const side = face !== 'down';
  const list = side ? [6] : [-4.6, 4.6];
  for (const ex of list) {
    if (blink) {
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(ex - 2.4, -29);
      ctx.lineTo(ex + 2.4, -29);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, -29.5, 2.6, 3.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7c4a21';
    ctx.beginPath();
    ctx.ellipse(ex + (side ? 0.8 : 0), -29, 2, 2.8, 0, 0, TAU);
    ctx.fill();
    circle(ctx, ex + (side ? 0.8 : 0), -28.6, 1.1, '#111827');
    circle(ctx, ex - 0.6 + (side ? 0.8 : 0), -30.4, 0.8, '#ffffff');
    // Brow
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ex - 2.6, -34);
    ctx.lineTo(ex + 2.2, -34.6);
    ctx.stroke();
  }
}

function spikyHair(ctx, face, color) {
  ctx.fillStyle = color;
  if (face === 'up') {
    ctx.beginPath();
    ctx.arc(0, -30, 12.6, 0, TAU);
    ctx.fill();
    for (let k = 0; k < 5; k++) {
      const x = -9 + k * 4.5;
      ctx.beginPath();
      ctx.moveTo(x - 3, -22);
      ctx.lineTo(x, -16 - (k % 2) * 2);
      ctx.lineTo(x + 3, -22);
      ctx.fill();
    }
    return;
  }
  const side = face !== 'down';
  // Spikes poking out under the cap
  const spikes = side ? [[-10, -34, -16, -28], [-11, -28, -15, -21], [-8, -23, -11, -17]] : [[-11, -33, -16, -28], [-11, -28, -15, -22], [11, -33, 16, -28], [11, -28, 15, -22]];
  for (const [x1, y1, x2, y2] of spikes) {
    ctx.beginPath();
    ctx.moveTo(x1, y1 - 3);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x1 + (x2 > x1 ? -1 : 1), y1 + 5);
    ctx.closePath();
    ctx.fill();
  }
  // Fringe
  ctx.beginPath();
  if (side) {
    ctx.moveTo(-6, -36);
    ctx.lineTo(4, -37);
    ctx.lineTo(2, -32);
    ctx.lineTo(-3, -33);
  } else {
    ctx.moveTo(-9, -35);
    ctx.lineTo(9, -35);
    ctx.lineTo(6, -31);
    ctx.lineTo(2, -34);
    ctx.lineTo(-1, -31);
    ctx.lineTo(-4, -34);
    ctx.lineTo(-7, -31);
  }
  ctx.closePath();
  ctx.fill();
}

function pokeLogo(ctx, x, y, r) {
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x - r, y - 0.5, r * 2, 1);
  circle(ctx, x, y, r * 0.38, '#1f2937');
  circle(ctx, x, y, r * 0.2, '#ffffff');
}

function trainerCap(ctx, face) {
  // Dome
  const grd = ctx.createLinearGradient(-12, -46, 12, -34);
  grd.addColorStop(0, '#f87171');
  grd.addColorStop(1, '#dc2626');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(0, -35, 12.8, Math.PI, TAU);
  ctx.fill();
  ctx.fillRect(-12.8, -36, 25.6, 2.5);
  if (face === 'down') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -35.5, 7.6, Math.PI, TAU);
    ctx.fill();
    pokeLogo(ctx, 0, -39.2, 3.6);
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.ellipse(0, -33.5, 13.5, 3.8, 0, 0, Math.PI);
    ctx.fill();
  } else if (face === 'up') {
    ctx.fillStyle = '#b91c1c';
    rr(ctx, -6, -37, 12, 3, 1.5, '#b91c1c');
    circle(ctx, 0, -47.5, 2, '#ffffff');
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(4, -36.5, 6.2, Math.PI, TAU);
    ctx.fill();
    pokeLogo(ctx, 5, -39.5, 2.8);
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.ellipse(12.5, -34.5, 8.5, 2.8, 0.1, 0, TAU);
    ctx.fill();
  }
}

function backpack(ctx, x, y, w, h) {
  rr(ctx, x, y, w, h, 5, '#facc15');
  rr(ctx, x + 2, y + h * 0.5, w - 4, h * 0.38, 3, '#eab308');
  ctx.fillStyle = '#a16207';
  ctx.fillRect(x + w / 2 - 1.5, y + h * 0.5, 3, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x + 2, y + 2, w - 4, 2);
}

/** The child's trainer: feet at (t.x, t.y + 10). t.face: down / up / left / right. */
export function drawTrainer(ctx, t, time) {
  const walking = t.moving;
  const ph = t.walk || 0;
  const sw = walking ? Math.sin(ph) : 0;
  const bob = walking ? Math.abs(Math.cos(ph)) * 2.4 : Math.sin(time * 2.4) * 0.6;
  const face = t.face || 'down';
  const side = face === 'left' || face === 'right';
  const blink = (time % 3.4) < 0.12;
  const skin = '#fcd9b8';
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 13 - bob, 5, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(250,204,21,0.85)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 10, 18 + Math.sin(time * 4) * 1.5, 7, 0, 0, TAU);
  ctx.stroke();
  ctx.translate(0, -bob);
  if (face === 'left') ctx.scale(-1, 1);
  // Legs (jeans) and sneakers
  if (side) {
    limb(ctx, -1, -3, 13, 6, sw * 0.55, '#1e40af', 3.5, '#ef4444');
    limb(ctx, 1, -3, 13, 6, -sw * 0.55, '#1e3a8a', 3.5, '#dc2626');
  } else {
    const l = walking ? sw * 2.5 : 0;
    rr(ctx, -7, -3 - Math.max(0, l), 6, 13, 3, '#1e3a8a');
    rr(ctx, 1, -3 - Math.max(0, -l), 6, 13, 3, '#1e40af');
    rr(ctx, -8, 7 - Math.max(0, l), 8, 4.5, 2, '#ef4444');
    rr(ctx, 0, 7 - Math.max(0, -l), 8, 4.5, 2, '#ef4444');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-8, 10 - Math.max(0, l), 8, 1.5);
    ctx.fillRect(0, 10 - Math.max(0, -l), 8, 1.5);
  }
  if (face === 'down') backpack(ctx, -12, -22, 24, 13);
  else if (side) backpack(ctx, -16, -24, 10, 18);
  // Back arm (side view)
  if (side) limb(ctx, -2, -19, 12, 5.5, -sw * 0.7, '#1d4ed8', 3.5, '#16a34a');
  // Jacket: blue with white trim, black shirt, zipper
  const jg = ctx.createLinearGradient(-10, -24, 10, -2);
  jg.addColorStop(0, '#3b82f6');
  jg.addColorStop(1, '#1d4ed8');
  rr(ctx, -10, -24, 20, 22, 7, jg);
  if (face === 'down') {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.moveTo(-4, -24);
    ctx.lineTo(0, -17);
    ctx.lineTo(4, -24);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-0.8, -17, 1.6, 15);
    ctx.fillRect(-10, -9, 20, 2);
    ctx.fillStyle = '#ca8a04';
    ctx.fillRect(-8.5, -23, 3, 14);
    ctx.fillRect(5.5, -23, 3, 14);
  } else if (face === 'up') {
    backpack(ctx, -11, -23, 22, 19);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-10, -6, 20, 2);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-10, -9, 20, 2);
    ctx.fillStyle = '#ca8a04';
    ctx.fillRect(-4, -23, 3, 14);
  }
  // Arms with green fingerless gloves
  if (side) limb(ctx, 2, -19, 12, 5.5, sw * 0.7, '#2563eb', 3.5, '#16a34a');
  else {
    limb(ctx, -11, -21, 12, 5.5, 0.12 + sw * 0.4, '#2563eb', 3.5, '#16a34a');
    limb(ctx, 11, -21, 12, 5.5, -0.12 - sw * 0.4, '#2563eb', 3.5, '#16a34a');
  }
  // Head (big, anime proportions)
  circle(ctx, 0, -30, 12, skin);
  if (face !== 'up') {
    // Ear and cheek
    if (side) circle(ctx, -3, -29, 2.6, '#f5c09a');
  }
  spikyHair(ctx, face, '#1f2937');
  if (face === 'down') {
    eyes(ctx, face, blink);
    ctx.fillStyle = '#fda4af';
    ctx.globalAlpha = 0.7;
    circle(ctx, -7.5, -24.5, 2, '#fda4af');
    circle(ctx, 7.5, -24.5, 2, '#fda4af');
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -24.5, 2.4, 0.25, Math.PI - 0.25);
    ctx.stroke();
  } else if (side) {
    eyes(ctx, face, blink);
    ctx.globalAlpha = 0.7;
    circle(ctx, 5, -24.5, 2, '#fda4af');
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(8, -24.8, 1.8, 0.2, Math.PI * 0.7);
    ctx.stroke();
  }
  trainerCap(ctx, face);
  ctx.restore();
}

// ---------- expert trainers ----------

function npcHat(ctx, hat, look) {
  switch (hat) {
    case 'straw':
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.ellipse(0, -36, 18, 5, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -37, 9, Math.PI, TAU);
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-9, -39, 18, 2.5);
      break;
    case 'bow':
      ctx.fillStyle = look.coat;
      ctx.beginPath();
      ctx.moveTo(-1, -41);
      ctx.lineTo(-10, -46);
      ctx.lineTo(-10, -37);
      ctx.closePath();
      ctx.moveTo(1, -41);
      ctx.lineTo(10, -46);
      ctx.lineTo(10, -37);
      ctx.closePath();
      ctx.fill();
      circle(ctx, 0, -41, 2.5, '#ffffff');
      break;
    case 'cap':
      ctx.fillStyle = look.coat;
      ctx.beginPath();
      ctx.arc(0, -35, 12.5, Math.PI, TAU);
      ctx.fill();
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.ellipse(0, -33.5, 13, 3.4, 0, 0, Math.PI);
      ctx.fill();
      circle(ctx, 0, -40, 2.4, '#ffffff');
      break;
    case 'ranger':
    case 'fisher':
      ctx.fillStyle = hat === 'ranger' ? '#a16207' : '#facc15';
      ctx.beginPath();
      ctx.ellipse(0, -35, 17, 4.5, 0, 0, TAU);
      ctx.fill();
      rr(ctx, -9, -45, 18, 11, 4, hat === 'ranger' ? '#ca8a04' : '#fde047');
      break;
    case 'hiker':
      rr(ctx, -11, -44, 22, 10, 4, '#78350f');
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.ellipse(0, -35, 15, 3.5, 0, 0, TAU);
      ctx.fill();
      break;
    case 'helmet':
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, -35, 13, Math.PI, TAU);
      ctx.fill();
      rr(ctx, -14, -36, 28, 4, 2, '#eab308');
      circle(ctx, 0, -43, 3, '#fef9c3');
      break;
    case 'hood':
      ctx.fillStyle = look.coat;
      ctx.beginPath();
      ctx.arc(0, -31, 14, Math.PI * 0.95, TAU + Math.PI * 0.05);
      ctx.lineTo(13, -22);
      ctx.lineTo(-13, -22);
      ctx.closePath();
      ctx.fill();
      break;
    case 'bandana':
      rr(ctx, -12.5, -40, 25, 6, 3, '#f97316');
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(-12, -38);
      ctx.lineTo(-18, -34);
      ctx.lineTo(-13, -33);
      ctx.fill();
      break;
    case 'swim':
      ctx.fillStyle = look.coat;
      ctx.beginPath();
      ctx.arc(0, -33, 12.5, Math.PI, TAU);
      ctx.fill();
      rr(ctx, -9, -34, 18, 5, 2.5, '#0f172a');
      circle(ctx, -4.5, -31.5, 2.5, '#7dd3fc');
      circle(ctx, 4.5, -31.5, 2.5, '#7dd3fc');
      break;
    case 'beanie':
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, -35, 12.5, Math.PI, TAU);
      ctx.fill();
      rr(ctx, -13, -36, 26, 5, 2, '#ffffff');
      circle(ctx, 0, -48, 3.5, '#ffffff');
      break;
    default:
      break;
  }
}

/** An expert trainer standing at their battle spot: feet at (x, y + 10). */
export function drawExpert(ctx, x, y, look, time, { scale = 1, face = 'down' } = {}) {
  const bob = Math.sin(time * 2.2 + x) * 0.8;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 13, 5, 0, 0, TAU);
  ctx.fill();
  ctx.translate(0, -bob);
  if (look.item === 'cape') {
    ctx.fillStyle = look.coat;
    ctx.beginPath();
    ctx.moveTo(-11, -22);
    ctx.lineTo(11, -22);
    ctx.lineTo(15 + Math.sin(time * 3) * 2, 8);
    ctx.lineTo(-15 + Math.sin(time * 3 + 1) * 2, 8);
    ctx.closePath();
    ctx.fill();
  }
  if (look.item === 'bag') backpack(ctx, -14, -24, 28, 20);
  rr(ctx, -7, -3, 6, 13, 3, look.pants);
  rr(ctx, 1, -3, 6, 13, 3, look.pants);
  rr(ctx, -8, 7, 8, 4.5, 2, '#1f2937');
  rr(ctx, 0, 7, 8, 4.5, 2, '#1f2937');
  const long = look.hat === 'hood';
  rr(ctx, -10, -24, 20, long ? 30 : 22, 7, look.coat);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(-10, -12, 20, 2);
  limb(ctx, -11, -21, 12, 5.5, 0.18, look.coat, 3.5, look.skin);
  limb(ctx, 11, -21, 12, 5.5, -0.3, look.coat, 3.5, look.skin);
  circle(ctx, 0, -30, 11.5, look.skin);
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  ctx.arc(0, -32, 11.8, Math.PI * 1.05, TAU - 0.05);
  ctx.fill();
  ctx.fillRect(-11.5, -33, 4, 8);
  ctx.fillRect(7.5, -33, 4, 8);
  eyes(ctx, face, (time % 3.9) < 0.12);
  if (look.item === 'glasses') {
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(-4.6, -29.5, 3.4, 0, TAU);
    ctx.arc(4.6, -29.5, 3.4, 0, TAU);
    ctx.stroke();
  }
  ctx.strokeStyle = '#9a3412';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(0, -24.5, 2.2, 0.25, Math.PI - 0.25);
  ctx.stroke();
  npcHat(ctx, look.hat, look);
  // What they carry
  if (look.item === 'net') {
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, -12);
    ctx.lineTo(20, -44);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(21, -50, 7, 8, 0.2, 0, TAU);
    ctx.stroke();
  } else if (look.item === 'staff') {
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(15, 8);
    ctx.lineTo(15, -46);
    ctx.stroke();
    circle(ctx, 15, -48, 4, '#c084fc');
  } else if (look.item === 'rod') {
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(14, -12);
    ctx.quadraticCurveTo(24, -50, 34, -48);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(34, -48);
    ctx.lineTo(34, -20);
    ctx.stroke();
  }
  ctx.restore();
}
