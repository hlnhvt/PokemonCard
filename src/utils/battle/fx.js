// Particle effects for battle moves, drawn on a canvas over the arena.
// Every type has its own pattern (stream of flames, lightning strikes, swirling leaves...).
// Coordinates are CSS pixels of the arena; the canvas context is pre-scaled for the DPR.

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const lerp = (a, b, t) => a + (b - a) * t;

// pattern: how the attack travels; shape: particle look; colors: palette (first = core)
export const TYPE_FX = {
  normal: { pattern: 'impact', shape: 'star', colors: ['#ffffff', '#fef9c3', '#e5e7eb'] },
  fire: { pattern: 'stream', shape: 'flame', colors: ['#fff7ae', '#fdba74', '#f97316', '#dc2626'] },
  water: { pattern: 'stream', shape: 'bubble', colors: ['#e0f2fe', '#7dd3fc', '#3b82f6', '#1d4ed8'] },
  electric: { pattern: 'bolts', shape: 'spark', colors: ['#ffffff', '#fef08a', '#facc15', '#eab308'] },
  grass: { pattern: 'swirl', shape: 'leaf', colors: ['#bef264', '#4ade80', '#16a34a', '#15803d'] },
  ice: { pattern: 'stream', shape: 'shard', colors: ['#ffffff', '#cffafe', '#67e8f9', '#38bdf8'] },
  fighting: { pattern: 'impact', shape: 'star', colors: ['#fed7aa', '#fb923c', '#ea580c', '#b91c1c'] },
  poison: { pattern: 'lob', shape: 'bubble', colors: ['#f5d0fe', '#d946ef', '#a21caf', '#6b21a8'] },
  ground: { pattern: 'erupt', shape: 'rock', colors: ['#fde68a', '#d97706', '#a16207', '#78350f'] },
  flying: { pattern: 'slashes', shape: 'spark', colors: ['#ffffff', '#e0e7ff', '#a5b4fc', '#818cf8'] },
  psychic: { pattern: 'rings', shape: 'circle', colors: ['#fce7f3', '#f9a8d4', '#ec4899', '#a855f7'] },
  bug: { pattern: 'swirl', shape: 'circle', colors: ['#ecfccb', '#a3e635', '#65a30d', '#3f6212'] },
  rock: { pattern: 'rain', shape: 'rock', colors: ['#e7e5e4', '#a8a29e', '#78716c', '#57534e'] },
  ghost: { pattern: 'orb', shape: 'circle', colors: ['#e9d5ff', '#a78bfa', '#6d28d9', '#1e1b4b'] },
  dragon: { pattern: 'beam', shape: 'circle', colors: ['#ffffff', '#c4b5fd', '#8b5cf6', '#4f46e5'] },
  dark: { pattern: 'rings', shape: 'circle', colors: ['#c4b5fd', '#6b21a8', '#312e81', '#0f0a1e'] },
  steel: { pattern: 'slashes', shape: 'star', colors: ['#ffffff', '#e2e8f0', '#94a3b8', '#64748b'] },
  fairy: { pattern: 'swirl', shape: 'heart', colors: ['#ffffff', '#fbcfe8', '#f472b6', '#db2777'] },
};

export class BattleFx {
  constructor() {
    this.particles = [];
    this.bolts = [];
    this.beams = [];
    this.rings = [];
    this.emitters = [];
    this.scheduled = []; // callbacks due at an effect time (slow motion keeps them in sync)
    this.time = 0;
  }

  /** Run fn after ms of effect time (not wall time, so slow motion stays consistent). */
  later(ms, fn) {
    this.scheduled.push({ at: this.time + ms, fn });
  }

  get busy() {
    return this.particles.length + this.bolts.length + this.beams.length + this.rings.length + this.emitters.length + this.scheduled.length > 0;
  }

  clear() {
    this.scheduled = [];
    this.particles = [];
    this.bolts = [];
    this.beams = [];
    this.rings = [];
    this.emitters = [];
  }

  add(p) {
    this.particles.push({
      vx: 0, vy: 0, gravity: 0, drag: 0.98, size: 6, grow: 0, rot: 0, vr: 0, life: 600,
      age: 0, shape: 'circle', color: '#fff', alpha: 1, ...p,
    });
  }

  ring(x, y, color, { size = 10, grow = 260, life = 500, width = 5 } = {}) {
    this.rings.push({ x, y, color, size, grow, life, width, age: 0 });
  }

  bolt(x1, y1, x2, y2, color, life = 260) {
    // Jagged lightning path with a few branches
    const points = [];
    const steps = 9;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const jitter = i === 0 || i === steps ? 0 : rand(-16, 16);
      points.push([lerp(x1, x2, t) + jitter, lerp(y1, y2, t)]);
    }
    this.bolts.push({ points, color, life, age: 0 });
  }

  beam(from, to, colors, life = 650, width = 18) {
    this.beams.push({ from, to, colors, life, width, age: 0 });
  }

  /** Emit `count` particles over `duration` ms using factory(t 0..1). */
  emit(duration, count, factory, delay = 0) {
    this.emitters.push({ duration, count, factory, age: -delay, emitted: 0 });
  }

  /** Burst of particles at a point (impacts, splashes, confetti). */
  burst(x, y, fx, { count = 26, speed = 260, size = 7, life = 650, gravity = 120 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(speed * 0.35, speed);
      this.add({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, gravity, drag: 0.93,
        size: rand(size * 0.5, size * 1.3), shape: fx.shape, color: pick(fx.colors), life: rand(life * 0.6, life),
        rot: rand(0, Math.PI * 2), vr: rand(-8, 8), grow: -size * 0.6,
      });
    }
  }

  /**
   * Play a move effect from `from` to `to` ({x, y}). Returns ms until the hit lands.
   * physical moves: the sprite lunges (done by the arena) and only the impact is drawn here.
   */
  playMove({ type, from, to, physical = false, power = 60 }) {
    const fx = TYPE_FX[type] || TYPE_FX.normal;
    const intensity = Math.min(1.6, Math.max(0.7, power / 70));
    if (physical && ['impact'].includes(fx.pattern)) return 320;
    const n = Math.round(40 * intensity);

    switch (physical ? 'impact' : fx.pattern) {
      case 'stream': {
        this.emit(420, n, (t) => {
          const spread = fx.shape === 'bubble' ? 30 : 18;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const speed = 1.6;
          return {
            x: from.x + rand(-6, 6), y: from.y + rand(-6, 6),
            vx: (dx * speed) + rand(-spread, spread), vy: (dy * speed) + rand(-spread, spread),
            drag: 1, size: rand(6, 13) * intensity, grow: fx.shape === 'flame' ? 14 : 4,
            shape: fx.shape, color: pick(fx.colors), life: 560 - t * 120, rot: rand(0, 6), vr: rand(-6, 6),
          };
        });
        return 520;
      }
      case 'bolts': {
        for (let i = 0; i < 3; i++) {
          this.later(i * 110, () => this.bolt(to.x + rand(-30, 30), -20, to.x + rand(-12, 12), to.y, pick(fx.colors.slice(0, 2))));
        }
        this.emit(300, 20, () => ({
          x: to.x + rand(-40, 40), y: to.y + rand(-40, 20), vx: rand(-120, 120), vy: rand(-160, 60),
          size: rand(4, 8), shape: 'spark', color: pick(fx.colors), life: 380,
        }), 120);
        return 330;
      }
      case 'swirl': {
        this.emit(480, n, (t) => {
          const angle0 = rand(0, Math.PI * 2);
          return {
            x: from.x, y: from.y, swirl: { from, to, angle0, radius: rand(18, 42), start: this.time, duration: 520 + t * 80 },
            size: rand(7, 12) * intensity, shape: fx.shape, color: pick(fx.colors), life: 640, rot: angle0, vr: rand(-10, 10),
          };
        });
        return 600;
      }
      case 'lob': {
        this.emit(360, Math.round(n * 0.6), () => {
          const flight = 0.55;
          const vx = (to.x - from.x) / flight;
          const g = 900;
          const vy = (to.y - from.y) / flight - 0.5 * g * flight;
          return {
            x: from.x, y: from.y, vx: vx + rand(-25, 25), vy: vy + rand(-30, 30), gravity: g, drag: 1,
            size: rand(8, 15) * intensity, shape: fx.shape, color: pick(fx.colors), life: 620,
          };
        });
        return 580;
      }
      case 'erupt': {
        this.emit(420, n, () => ({
          x: to.x + rand(-55, 55), y: to.y + 55, vx: rand(-60, 60), vy: rand(-620, -360), gravity: 1200,
          size: rand(8, 16) * intensity, shape: 'rock', color: pick(fx.colors), life: 700, rot: rand(0, 6), vr: rand(-6, 6),
        }));
        return 260;
      }
      case 'rain': {
        this.emit(420, Math.round(n * 0.7), () => ({
          x: to.x + rand(-50, 50), y: to.y - rand(170, 240), vx: rand(-20, 20), vy: rand(200, 320), gravity: 1400, drag: 1,
          size: rand(9, 17) * intensity, shape: 'rock', color: pick(fx.colors), life: 520, rot: rand(0, 6), vr: rand(-5, 5),
        }));
        return 420;
      }
      case 'slashes': {
        for (let i = 0; i < 3; i++) {
          this.later(i * 90, () => {
            const a = rand(-0.9, 0.9) + (i % 2 ? Math.PI / 2 : 0);
            for (let k = -3; k <= 3; k++) {
              this.add({
                x: to.x + Math.cos(a) * k * 14, y: to.y + Math.sin(a) * k * 14, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90,
                size: 14 - Math.abs(k) * 2, shape: 'spark', color: pick(fx.colors), life: 320,
              });
            }
          });
        }
        return 260;
      }
      case 'rings': {
        for (let i = 0; i < 4; i++) {
          this.later(i * 100, () => {
            this.ring(from.x, from.y, pick(fx.colors.slice(1)), { size: 14, grow: 0, life: 520, width: 6 });
            this.rings[this.rings.length - 1].travel = { from, to };
          });
        }
        return 560;
      }
      case 'orb': {
        this.add({
          x: from.x, y: from.y, vx: (to.x - from.x) / 0.5, vy: (to.y - from.y) / 0.5, drag: 1, size: 24 * intensity,
          shape: 'orb', color: fx.colors[2], life: 500, trail: fx,
        });
        return 500;
      }
      case 'beam': {
        this.beam(from, to, fx.colors, 700, 16 * intensity);
        this.emit(600, n, (t) => ({
          x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), vx: rand(-60, 60), vy: rand(-60, 60),
          size: rand(4, 9), shape: 'circle', color: pick(fx.colors), life: 420,
        }));
        return 380;
      }
      default:
        return 280;
    }
  }

  /** Impact at the target. Bigger for critical / super effective hits. */
  impact({ type, at, crit = false, superEffective = false, power = 60 }) {
    const fx = TYPE_FX[type] || TYPE_FX.normal;
    const big = crit || superEffective;
    const scale = Math.min(1.8, Math.max(0.8, power / 70)) * (big ? 1.4 : 1);
    this.burst(at.x, at.y, fx, { count: Math.round(22 * scale), speed: 240 * scale, size: 7 * scale });
    this.ring(at.x, at.y, fx.colors[1], { size: 12, grow: 220 * scale, life: 420, width: big ? 8 : 5 });
    if (big) this.ring(at.x, at.y, '#ffffff', { size: 6, grow: 320 * scale, life: 520, width: 3 });
    if (crit) {
      // Star sparkles for a critical hit
      this.burst(at.x, at.y, { shape: 'star', colors: ['#ffffff', '#fde047'] }, { count: 12, speed: 320, size: 10, gravity: 0 });
    }
  }

  /** Grand finale of the combo: multi-colour explosion. */
  finale(at) {
    const palette = { shape: 'star', colors: ['#ffffff', '#fde047', '#f472b6', '#60a5fa', '#34d399', '#f97316'] };
    this.burst(at.x, at.y, palette, { count: 90, speed: 520, size: 11, life: 1100, gravity: 60 });
    for (let i = 0; i < 4; i++) this.ring(at.x, at.y, pick(palette.colors), { size: 10, grow: 420 + i * 120, life: 700 + i * 120, width: 7 - i });
  }

  /** Sparkles rising from a fainted Pokemon. */
  faint(at) {
    this.emit(500, 30, () => ({
      x: at.x + rand(-40, 40), y: at.y + rand(-10, 40), vx: rand(-20, 20), vy: rand(-140, -60), drag: 0.99,
      size: rand(3, 6), shape: 'circle', color: pick(['#ffffff', '#e2e8f0', '#fde68a']), life: 900,
    }));
  }

  update(dtMs) {
    const dt = dtMs / 1000;
    this.time += dtMs;

    const due = this.scheduled.filter((s) => s.at <= this.time);
    if (due.length) {
      this.scheduled = this.scheduled.filter((s) => s.at > this.time);
      for (const s of due) s.fn();
    }

    for (const e of this.emitters) {
      e.age += dtMs;
      if (e.age < 0) continue;
      const due = Math.min(e.count, Math.floor((e.age / e.duration) * e.count));
      while (e.emitted < due) {
        this.add(e.factory(e.emitted / e.count));
        e.emitted++;
      }
    }
    this.emitters = this.emitters.filter((e) => e.emitted < e.count);

    for (const p of this.particles) {
      p.age += dtMs;
      if (p.swirl) {
        const s = p.swirl;
        const t = Math.min(1, (this.time - s.start) / s.duration);
        const angle = s.angle0 + t * Math.PI * 4;
        const r = s.radius * (1 - t * 0.8);
        p.x = lerp(s.from.x, s.to.x, t) + Math.cos(angle) * r;
        p.y = lerp(s.from.y, s.to.y, t) + Math.sin(angle) * r;
      } else {
        p.vy += p.gravity * dt;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      p.rot += p.vr * dt;
      p.size = Math.max(0.5, p.size + p.grow * dt);
      if (p.trail && Math.random() < 0.8) {
        this.particles.push({
          x: p.x + rand(-6, 6), y: p.y + rand(-6, 6), vx: rand(-20, 20), vy: rand(-20, 20), gravity: 0, drag: 0.95,
          size: rand(5, 10), grow: -8, rot: 0, vr: 0, life: 360, age: 0, shape: 'circle', color: pick(p.trail.colors), alpha: 1,
        });
      }
    }
    this.particles = this.particles.filter((p) => p.age < p.life);

    for (const r of this.rings) r.age += dtMs;
    this.rings = this.rings.filter((r) => r.age < r.life);
    for (const b of this.bolts) b.age += dtMs;
    this.bolts = this.bolts.filter((b) => b.age < b.life);
    for (const b of this.beams) b.age += dtMs;
    this.beams = this.beams.filter((b) => b.age < b.life);
  }

  draw(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const b of this.beams) {
      const t = b.age / b.life;
      const pulse = 1 + Math.sin(b.age / 40) * 0.2;
      const w = b.width * pulse * (t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 1);
      b.colors.slice().reverse().forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.globalAlpha = 0.35 + i * 0.2;
        ctx.lineWidth = w * (1.8 - i * 0.4);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(b.from.x, b.from.y);
        ctx.lineTo(b.to.x, b.to.y);
        ctx.stroke();
      });
    }

    for (const b of this.bolts) {
      const flicker = Math.random() < 0.85 ? 1 : 0.3;
      ctx.globalAlpha = (1 - b.age / b.life) * flicker;
      for (const [w, c] of [[9, b.color], [3, '#ffffff']]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        b.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
    }

    for (const r of this.rings) {
      const t = r.age / r.life;
      let x = r.x;
      let y = r.y;
      if (r.travel) {
        x = lerp(r.travel.from.x, r.travel.to.x, t);
        y = lerp(r.travel.from.y, r.travel.to.y, t);
      }
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - t * 0.6);
      ctx.beginPath();
      ctx.arc(x, y, r.size + (r.travel ? 30 * t : r.grow * t), 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const p of this.particles) {
      const t = p.age / p.life;
      ctx.globalAlpha = p.alpha * (t < 0.1 ? t / 0.1 : 1 - Math.max(0, (t - 0.5) / 0.5));
      drawParticle(ctx, p);
    }
    ctx.restore();
  }
}

function drawParticle(ctx, p) {
  const s = p.size;
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.color;
  switch (p.shape) {
    case 'flame':
    case 'circle':
    case 'orb': {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, p.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bubble':
      ctx.lineWidth = Math.max(1.5, s / 5);
      ctx.beginPath();
      ctx.arc(p.x, p.y, s * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x - s * 0.25, p.y - s * 0.25, s * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'spark': {
      const len = Math.max(s * 1.5, Math.hypot(p.vx, p.vy) * 0.05);
      const a = Math.atan2(p.vy, p.vx);
      ctx.lineWidth = Math.max(1.5, s / 3);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len);
      ctx.lineTo(p.x + Math.cos(a) * len, p.y + Math.sin(a) * len);
      ctx.stroke();
      break;
    }
    case 'leaf':
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    case 'shard':
    case 'rock': {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      if (p.shape === 'shard') {
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.4, s * 0.6);
        ctx.lineTo(-s * 0.4, s * 0.6);
      } else {
        ctx.moveTo(-s * 0.8, -s * 0.2);
        ctx.lineTo(-s * 0.2, -s * 0.8);
        ctx.lineTo(s * 0.7, -s * 0.5);
        ctx.lineTo(s * 0.8, s * 0.4);
        ctx.lineTo(-s * 0.3, s * 0.8);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'star': {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? s * 0.35 : s;
        const a = (i * Math.PI) / 4;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'heart': {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * 0.2);
      ctx.beginPath();
      ctx.moveTo(0, s * 0.35);
      ctx.bezierCurveTo(s, -s * 0.3, s * 0.5, -s, 0, -s * 0.4);
      ctx.bezierCurveTo(-s * 0.5, -s, -s, -s * 0.3, 0, s * 0.35);
      ctx.fill();
      ctx.restore();
      break;
    }
    default:
      ctx.beginPath();
      ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
      ctx.fill();
  }
}
