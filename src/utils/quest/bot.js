// A simple player for the balance simulation (quest.sim.test.js): walks with A* paths,
// picks up loot, opens chests, clears every pack, heals with the bag, goes to town when the
// team is tired, and fights the boss while keeping the trainer at a safe distance.
import { findPath } from './world';
import { leadOf, quickHeal, applyItem, buyItem, goToTown, switchLead, fighters, closeExpert, ULT_MAX } from './engine';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function createBot() {
  return { path: null, goalKey: null, repathAt: 0, lastPos: null, stuckT: 0, bought: 0, ignore: new Set(), keySince: 0 };
}

function goTo(state, bot, goal, key) {
  const t = state.trainer;
  if (dist(t, goal) < 14) return { x: 0, y: 0 };
  if (bot.goalKey !== key) bot.keySince = state.time;
  // The same goal for too long (unreachable): forget it
  if (state.time - bot.keySince > 14 && /^(fight|hunt|drop|chest)-/.test(key)) bot.ignore.add(key.split('-')[1]);
  if (bot.goalKey !== key || !bot.path || state.time > bot.repathAt) {
    bot.goalKey = key;
    bot.path = findPath(state.area, t, goal) || [goal];
    bot.repathAt = state.time + 1.5;
  }
  while (bot.path.length && dist(t, bot.path[0]) < 18) bot.path.shift();
  const next = bot.path[0] || goal;
  const dx = next.x - t.x;
  const dy = next.y - t.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

const teamHealth = (state) => {
  const alive = state.party.filter((m) => !m.fainted);
  return { alive: alive.length, ratio: alive.reduce((a, m) => a + m.hp / m.maxHp, 0) / Math.max(1, alive.length) };
};

/** One decision: { move, cast }. May also use items or the town portal directly. */
export function botStep(state, bot) {
  const t = state.trainer;
  const area = state.area;
  const input = { move: { x: 0, y: 0 }, cast: null };
  // The bot does not take the expert battles (they are separate games): "Để sau"
  if (state.pendingExpert) closeExpert(state);
  // Stuck against something: plan again
  if (bot.lastPos && dist(bot.lastPos, t) < 0.5 && bot.wanted) bot.stuckT += 1 / 30;
  else bot.stuckT = 0;
  if (bot.stuckT > 0.8) {
    bot.path = null;
    bot.stuckT = 0;
  }
  bot.lastPos = { x: t.x, y: t.y };

  if (area.kind === 'town') {
    const hurt = state.party.some((m) => m.fainted || m.hp < m.maxHp * 0.9);
    const spot = (id) => area.spots.find((s) => s.id === id);
    if (state.townSpot === 'shop') {
      while (bot.bought < 3 && buyItem(state, state.gold > 150 ? 'superPotion' : 'potion')) bot.bought += 1;
    }
    let goal;
    let key;
    if (hurt) [goal, key] = [spot('center'), 'center'];
    else if (state.gold >= 25 && bot.bought < 3 && (state.inventory.potion || 0) + (state.inventory.superPotion || 0) < 4) [goal, key] = [spot('shop'), 'shop'];
    else {
      const p = state.portals.find((q) => q.kind === 'return') || state.portals.find((q) => q.kind === 'next');
      [goal, key] = [p, `portal-${p.id}`];
    }
    input.move = goTo(state, bot, goal, key);
    bot.wanted = true;
    return input;
  }
  bot.bought = 0;

  // Tired Pokemon go back to their balls to rest, a fresh one comes out
  const low = fighters(state).find((m) => m.hp / m.maxHp < 0.35);
  const fresh = state.party.filter((m) => !m.out && !m.fainted && m.hp / m.maxHp > 0.7)[0];
  if (low && fresh && state.time > (bot.swapAt || 0)) {
    bot.swapAt = state.time + 1;
    if (low.idx === state.lead && state.party[state.companion] && !state.party[state.companion].fainted) switchLead(state, state.companion);
    else switchLead(state, fresh.idx);
  }
  const lead = leadOf(state);
  const h = teamHealth(state);
  const fainted = state.party.length - h.alive;
  if (fainted >= 2 && state.inventory.revive > 0) applyItem(state, 'revive');
  if (h.ratio < 0.45) quickHeal(state);
  const boss = state.enemies.find((e) => e.boss);
  if (!boss && (h.alive <= 1 || (h.ratio < 0.3 && !quickHeal(state)))) {
    goToTown(state, 'portal');
    return input;
  }

  // Skills
  const near = (r, from = lead) => state.enemies.filter((e) => from && dist(e, from) < r);
  if (lead && !lead.fainted) {
    if (state.ult >= ULT_MAX && (near(300).length >= 3 || (boss && dist(boss, lead) < 300))) input.cast = 'ult';
    else if (near(150).length) input.cast = 's2';
    else if (near(420).length) input.cast = 's1';
  }

  // Where to walk
  let goal = null;
  let key = null;
  if (boss && boss.awake) {
    // Circle round the boss at a safe distance, the team does the fighting
    const a = Math.atan2(t.y - boss.y, t.x - boss.x) + 0.5;
    const r = 230;
    goal = { x: boss.x + Math.cos(a) * r, y: boss.y + Math.sin(a) * r };
    key = `boss-${Math.round(a * 4)}`;
    if (state.telegraphs.some((w) => w.shape === 'circle' ? dist(w, t) < w.r + 30 : false)) {
      const w = state.telegraphs[0];
      const d = { x: t.x - w.x, y: t.y - w.y };
      const l = Math.hypot(d.x, d.y) || 1;
      goal = { x: t.x + (d.x / l) * 120, y: t.y + (d.y / l) * 120 };
      key = `dodge-${Math.round(state.time)}`;
    }
  } else {
    const ok = (o) => !bot.ignore.has(String(o.id));
    const drop = state.drops.filter((d) => ok(d) && dist(d, t) < 320).sort((a, b) => dist(a, t) - dist(b, t))[0];
    const chest = state.chests.filter((c) => ok(c) && !c.opened && dist(c, t) < 520).sort((a, b) => dist(a, t) - dist(b, t))[0];
    const fighting = state.enemies.filter((e) => ok(e) && e.mode === 'chase' && dist(e, t) < 450);
    if (fighting.length) {
      const e = fighting.sort((a, b) => dist(a, t) - dist(b, t))[0];
      if (dist(e, t) > 170) [goal, key] = [e, `fight-${e.id}`];
    } else if (drop) [goal, key] = [drop, `drop-${drop.id}`];
    else if (chest) [goal, key] = [chest, `chest-${chest.id}`];
    else if (state.enemies.some(ok)) {
      const e = state.enemies.filter(ok).reduce((a, b) => (dist(b, t) < dist(a, t) ? b : a));
      [goal, key] = [e, `hunt-${e.id}`];
    } else {
      const next = state.portals.find((p) => p.kind === 'act') || state.portals.find((p) => p.kind === 'next');
      if (next) {
        // Rest before the boss lair
        const lair = area.def && state.actDef.areas[next.to.area]?.kind === 'lair';
        if (lair && (h.ratio < 0.85 || fainted) && !quickHeal(state) && fainted) {
          goToTown(state, 'portal');
          return input;
        }
        [goal, key] = [next, `portal-${next.id}`];
      }
    }
  }
  bot.wanted = !!goal;
  if (goal) input.move = goTo(state, bot, goal, key);
  if (boss && boss.awake && dist(boss, t) < 160) {
    const d = { x: t.x - boss.x, y: t.y - boss.y };
    const l = Math.hypot(d.x, d.y) || 1;
    input.move = { x: d.x / l, y: d.y / l };
  }
  return input;
}
