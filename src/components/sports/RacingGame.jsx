import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { LANES, TRACK, createRace, stepRace, steer, standings, placeOf, player as playerOf } from '../../utils/sports/racing';
import { sounds } from '../../utils/soundEffects';
import { SportsShell, Banner, MatchResult } from './SportsCommon';
import { useLoop, useLater, useCanvas, pickOpponents, loadImage, drawSprite, burst, updateParticles } from './sportsKit';

const W = 360;
const H = 560;
const ROAD = 264;
const LANE_W = ROAD / LANES;
const ROAD_LEFT = (W - ROAD) / 2;
const PLAYER_Y = 430;
const COLORS = { player: '#3b82f6', cpu0: '#ef4444', cpu1: '#22c55e', cpu2: '#a855f7' };
const PLACE_TEXT = ['', 'Về nhất! 🥇', 'Về nhì! 🥈', 'Về ba! 🥉', 'Về thứ 4 – lần sau cố lên nhé!'];
const PLACE_RESULT = ['', 'win', 'draw', 'draw', 'lose'];

const laneX = (x) => ROAD_LEFT + LANE_W / 2 + x * LANE_W;

function drawRoad(ctx, camera, time) {
  // Grass with stripes that scroll
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(0, 0, W, H);
  const stripe = 60;
  for (let y = -stripe + ((camera % (stripe * 2)) + stripe * 2) % (stripe * 2) - stripe; y < H; y += stripe * 2) {
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, y, ROAD_LEFT - 10, stripe);
    ctx.fillRect(W - ROAD_LEFT + 10, y, ROAD_LEFT - 10, stripe);
  }
  // Trees and flowers beside the road (placed along the track so they scroll with it)
  const first = Math.floor((camera - 200) / 70);
  for (let k = first; k < first + 14; k++) {
    const y = PLAYER_Y - (k * 70 - camera);
    const left = k % 2 === 0;
    const x = left ? 18 + ((k * 13) % 14) : W - 18 - ((k * 7) % 14);
    if (k % 3 === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(x + 4, y + 6, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(x - 4, y - 4, 9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = ['#f472b6', '#facc15', '#ffffff'][k % 3];
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(x + Math.cos(i * 1.57) * 4, y + Math.sin(i * 1.57) * 4, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Asphalt
  const road = ctx.createLinearGradient(ROAD_LEFT, 0, ROAD_LEFT + ROAD, 0);
  road.addColorStop(0, '#334155');
  road.addColorStop(0.5, '#475569');
  road.addColorStop(1, '#334155');
  ctx.fillStyle = road;
  ctx.fillRect(ROAD_LEFT, 0, ROAD, H);
  // Red and white kerbs
  const kerb = 24;
  const off = ((camera % (kerb * 2)) + kerb * 2) % (kerb * 2);
  for (let y = -kerb * 2 + off; y < H; y += kerb * 2) {
    for (const x of [ROAD_LEFT - 10, ROAD_LEFT + ROAD]) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x, y, 10, kerb);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x, y + kerb, 10, kerb);
    }
  }
  // Lane dashes
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 4;
  ctx.setLineDash([26, 22]);
  ctx.lineDashOffset = -camera;
  for (let i = 1; i < LANES; i++) {
    const x = ROAD_LEFT + i * LANE_W;
    ctx.beginPath();
    ctx.moveTo(x, -10);
    ctx.lineTo(x, H + 10);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Start and finish lines
  for (const [dist, label] of [[0, null], [TRACK, 'VỀ ĐÍCH']]) {
    const y = PLAYER_Y - (dist - camera);
    if (y < -80 || y > H + 40) continue;
    const sq = 12;
    for (let i = 0; i < ROAD / sq; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#0f172a' : '#f8fafc';
        ctx.fillRect(ROAD_LEFT + i * sq, y - j * sq, sq, sq);
      }
    }
    if (label) {
      // Arch with flags
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(ROAD_LEFT - 16, y - 70, 10, 70);
      ctx.fillRect(ROAD_LEFT + ROAD + 6, y - 70, 10, 70);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.roundRect(ROAD_LEFT - 16, y - 88, ROAD + 32, 26, 8);
      ctx.fill();
      ctx.fillStyle = '#7c2d12';
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🏁 ${label} 🏁`, W / 2, y - 69 + Math.sin(time * 4) * 1.5);
    }
  }
}

function drawItem(ctx, item, y, time) {
  const x = laneX(item.lane);
  if (item.type === 'oil') {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(x, y, 30, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 14, y + 6, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(168, 85, 247, ${0.35 + Math.sin(time * 3 + item.id) * 0.15})`;
    ctx.beginPath();
    ctx.ellipse(x - 8, y - 4, 12, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.type === 'cone') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 12, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x + 14, y + 12);
    ctx.lineTo(x - 14, y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 8, y - 2, 16, 5);
    ctx.fillStyle = '#c2410c';
    ctx.fillRect(x - 17, y + 10, 34, 5);
  } else {
    // Boost pad: glowing chevrons that flow forwards
    ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
    ctx.beginPath();
    ctx.roundRect(x - 30, y - 26, 60, 52, 10);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const phase = (time * 2 + i / 3) % 1;
      ctx.strokeStyle = `rgba(253, 224, 71, ${1 - phase * 0.7})`;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      const cy = y + 16 - i * 14 - phase * 6;
      ctx.beginPath();
      ctx.moveTo(x - 16, cy + 8);
      ctx.lineTo(x, cy - 4);
      ctx.lineTo(x + 16, cy + 8);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }
}

function drawBike(ctx, rider, img, x, y, time) {
  const boosting = rider.effect === 'boost';
  const wobble = rider.wobble > 0 ? Math.sin(time * 40) * rider.wobble * 0.5 : 0;
  const lean = (rider.lane - rider.x) * -0.35;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(wobble + lean);
  // Exhaust: flames when boosting, puffs otherwise
  if (boosting) {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ['#fde047', '#fb923c', '#ef4444'][i];
      ctx.beginPath();
      ctx.moveTo(-6 + i * 2, 30);
      ctx.lineTo(6 - i * 2, 30);
      ctx.lineTo(0, 44 + i * 10 + Math.sin(time * 50 + i) * 5);
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(4, 6, 18, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wheels
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(-6, -34, 12, 20, 5);
  ctx.roundRect(-7, 14, 14, 22, 5);
  ctx.fill();
  // Body
  ctx.fillStyle = COLORS[rider.id];
  ctx.beginPath();
  ctx.roundRect(-12, -20, 24, 40, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(-3, -18, 6, 34);
  // Handlebar
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-16, -18);
  ctx.lineTo(16, -18);
  ctx.stroke();
  ctx.restore();
  // The Pokemon rider, bouncing a little
  drawSprite(ctx, img, x, y - 6 - Math.abs(Math.sin(time * 9 + x)) * 3, rider.isPlayer ? 64 : 56, { rotate: wobble + lean, color: COLORS[rider.id] });
  if (boosting) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const lx = x - 26 + i * 17;
      const ly = y + 30 + ((time * 400 + i * 37) % 60);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx, ly + 22);
      ctx.stroke();
    }
  }
}

function drawHud(ctx, race, images) {
  // Progress bar on the right with every rider's position
  const x = W - 14;
  const top = 70;
  const bottom = H - 70;
  ctx.fillStyle = 'rgba(15,23,42,0.55)';
  ctx.beginPath();
  ctx.roundRect(x - 6, top - 10, 12, bottom - top + 20, 6);
  ctx.fill();
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏁', x, top - 14);
  for (const r of [...race.riders].reverse()) {
    const y = bottom - (bottom - top) * Math.min(1, r.dist / TRACK);
    ctx.fillStyle = COLORS[r.id];
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r.isPlayer ? 9 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (r.isPlayer) drawSprite(ctx, images.player, x - 22, y, 26);
  }
  // Current place
  const place = placeOf(race);
  ctx.fillStyle = 'rgba(15,23,42,0.7)';
  ctx.beginPath();
  ctx.roundRect(8, 8, 110, 40, 12);
  ctx.fill();
  ctx.fillStyle = place === 1 ? '#fde047' : '#fff';
  ctx.font = '900 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const label = `Hạng ${place}`;
  ctx.fillText(label, 16, 36);
  const after = 16 + ctx.measureText(label).width + 2;
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(`/${race.riders.length}`, after, 36);
}

const freshRace = (random) => ({ race: createRace({ random }), phase: 'race', count: 3, particles: [], shake: 0, time: 0, finishPlace: 0 });

const snapshot = (s) => ({
  phase: s.phase,
  count: s.count,
  place: s.finishPlace || placeOf(s.race),
  ranking: standings(s.race),
  lane: playerOf(s.race).lane,
});

/**
 * Motorbike race against 3 Pokemon: tap the left or right side to change lane,
 * avoid oil and cones, ride over the yellow arrows to speed up.
 */
export function RacingGame({ player, onClose, onBerries, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [rivals, setRivals] = useState(() => pickOpponents(player.name, 3, random));
  // Mutable race for the animation loop; `ui` is the snapshot the markup renders from
  const [initial] = useState(() => freshRace(random));
  const raceRef = useRef(initial);
  const [ui, setUi] = useState(() => snapshot(initial));
  const [banner, setBanner] = useState(null);
  const rerender = () => setUi(snapshot(raceRef.current));
  const later = useLater();
  const st = ui;
  const images = { player: loadImage(player.image), cpu0: loadImage(rivals[0].image), cpu1: loadImage(rivals[1].image), cpu2: loadImage(rivals[2].image) };
  const nameOf = (id) => (id === 'player' ? player.name : rivals[Number(id.slice(3))].name);

  const say = (text, tone) => setBanner((b) => ({ id: (b?.id || 0) + 1, text, tone }));

  const move = (dir) => {
    const s = raceRef.current;
    if (s.phase !== 'race' || s.race.time < 0) return;
    const before = playerOf(s.race).lane;
    steer(s.race, dir);
    if (playerOf(s.race).lane !== before) {
      sounds.playWhoosh();
      rerender();
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') move(-1);
      else if (e.key === 'ArrowRight') move(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useLoop((dt) => {
    const s = raceRef.current;
    s.time += dt;
    s.shake = Math.max(0, s.shake - dt);
    const race = s.race;
    const wasCount = s.count;
    stepRace(race, dt);
    const count = race.time < 0 ? Math.ceil(-race.time) : 0;
    if (count !== wasCount) {
      s.count = count;
      if (count > 0) sounds.playScanBeep();
      rerender();
    }
    const p = playerOf(race);
    for (const e of race.events.splice(0)) {
      if (e.type === 'go') {
        say('XUẤT PHÁT!', 'gold');
        sounds.playEnergySurge();
      } else if (e.rider === 'player' && e.type === 'oil') {
        say('Trơn quá! 😵', 'blue');
        sounds.playPop();
      } else if (e.rider === 'player' && e.type === 'cone') {
        say('Ối! 🚧', 'red');
        s.shake = 0.35;
        sounds.playPop();
        burst(s.particles, laneX(p.x), PLAYER_Y - 20, { count: 12, colors: ['#f97316', '#ffffff'], speed: 140 });
      } else if (e.rider === 'player' && e.type === 'boost') {
        say('TĂNG TỐC! 🚀', 'gold');
        sounds.playWhoosh();
        burst(s.particles, laneX(p.x), PLAYER_Y + 20, { count: 14, colors: ['#fde047', '#fb923c'], speed: 150 });
      } else if (e.type === 'finish' && e.rider === 'player') {
        s.finishPlace = e.place;
        s.phase = 'finish';
        say(e.place === 1 ? 'VỀ NHẤT! 🏆' : 'VỀ ĐÍCH! 🏁', e.place === 1 ? 'gold' : 'green');
        sounds.playSuccessFanfare();
        try {
          confetti({ particleCount: e.place === 1 ? 140 : 60, spread: 90, origin: { y: 0.3 }, zIndex: 9999 });
        } catch {
          // decoration
        }
        rerender();
        later(() => {
          raceRef.current.phase = 'done';
          rerender();
        }, 1800);
      }
    }
    // Dust behind the player's bike
    if (race.time > 0 && s.phase === 'race' && Math.random() < 0.4) {
      s.particles.push({ x: laneX(p.x) + (Math.random() - 0.5) * 12, y: PLAYER_Y + 38, vx: (Math.random() - 0.5) * 30, vy: 90, life: 0.4, max: 0.4, size: 3 + Math.random() * 3, color: 'rgba(226,232,240,0.7)', gravity: 0 });
    }

    const ctx = getCtx();
    if (!ctx) return;
    const camera = p.dist;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (s.shake > 0) ctx.translate((Math.random() - 0.5) * s.shake * 16, (Math.random() - 0.5) * s.shake * 16);
    drawRoad(ctx, camera, s.time);
    for (const it of race.items) {
      if (it.gone) continue;
      const y = PLAYER_Y - (it.y - camera);
      if (y > -40 && y < H + 40) drawItem(ctx, it, y, s.time);
    }
    // Riders, far ones first
    const riders = [...race.riders].sort((a, b) => b.dist - a.dist);
    for (const r of riders) {
      const y = PLAYER_Y - (r.dist - camera);
      if (y < -60 || y > H + 60) continue;
      drawBike(ctx, r, images[r.id], laneX(r.x), y, s.time);
    }
    updateParticles(ctx, s.particles, dt);
    ctx.restore();
    drawHud(ctx, race, images);
  }, st.phase !== 'done');

  const replay = () => {
    raceRef.current = freshRace(random);
    setRivals(pickOpponents(player.name, 3, random));
    setBanner(null);
    rerender();
  };

  const onStagePointer = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mid = rect.width ? rect.left + rect.width / 2 : 0;
    move(e.clientX < mid ? -1 : 1);
  };

  const { place, ranking } = st;

  return (
    <SportsShell
      title="🏍️ Đua xe Pokémon"
      label="Đua xe máy Pokémon"
      player={player}
      opponent={null}
      onClose={onClose}
      background="bg-gradient-to-b from-emerald-700 via-emerald-800 to-slate-900"
      dataAttrs={{ 'data-phase': st.phase, 'data-place': place, 'data-lane': st.lane }}
      footer={
        <div className="relative z-10 grid grid-cols-2 gap-3 px-3 py-2 bg-black/40">
          {[
            [-1, '⬅️ Trái'],
            [1, 'Phải ➡️'],
          ].map(([dir, text]) => (
            <button
              key={dir}
              onPointerDown={(e) => {
                e.stopPropagation();
                move(dir);
              }}
              className="py-3 rounded-2xl bg-gradient-to-b from-sky-300 to-blue-600 text-white text-xl font-black shadow-lg active:scale-95 border-b-4 border-blue-800"
            >
              {text}
            </button>
          ))}
        </div>
      }
    >
      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden touch-none" onPointerDown={onStagePointer} data-testid="racing-stage">
        <canvas ref={canvasRef} data-testid="racing-canvas" className="max-w-full max-h-full" style={{ aspectRatio: `${W} / ${H}`, width: '100%', height: 'auto' }} />
        {st.count > 0 && st.phase === 'race' && (
          <div key={st.count} className="count-pop absolute left-1/2 top-[40%] text-8xl font-black text-white sport-banner pointer-events-none" data-testid="countdown">
            {st.count}
          </div>
        )}
        {st.count > 0 && st.phase === 'race' && (
          <p className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[90%] px-3 py-1.5 rounded-2xl bg-black/55 text-center text-white text-sm font-black pointer-events-none">
            Chạm bên trái / phải để đổi làn. Né vũng dầu 🛢️ và cọc 🚧, đi qua mũi tên vàng để tăng tốc!
          </p>
        )}
        <Banner banner={banner} />
        {st.phase === 'done' && (
          <MatchResult
            result={PLACE_RESULT[place]}
            headline={PLACE_TEXT[place]}
            player={player}
            opponent={null}
            detail={ranking.map((id, i) => `${['🥇', '🥈', '🥉', '4.'][i]} ${nameOf(id)}`).join('  ')}
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
