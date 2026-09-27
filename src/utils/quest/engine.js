// "Hành trình Huấn luyện viên": a top-down action RPG. Pure simulation stepped with a fixed
// dt; the component draws `state` and plays `state.events` (then empties the list).
// The child walks the trainer; of the 5 Pokemon only 2 are out of their balls at a time (the
// lead and a companion): they follow the trainer and fight by themselves, the lead also has
// 2 skills and the team ultimate on buttons. Tapping a portrait sends that Pokemon out.
import { ACTS, areaDef, generateArea, moveCircle, blocksShot, nearestFree, circleBlocked, findPath, shotClear } from './world';
import { tablePlan, dexOfMember, speciesByName, nextEvolution } from './species';
import { xpToNext, MAX_LEVEL, START_LEVEL } from './progress';
import { ITEMS, rollChest, earnReward, earnActClear, HEAL_ORDER, MAX_CHARMS, STARTING_ITEMS } from './items';
import { mulberry32, hashSeed, int } from './rng';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { makeBoss, stepBoss, insideWarning } from './boss';
import { expertsFor, expertReward, BADGES } from './experts';
import { EXPERTS_PER_ACT } from './world';
import { ULT_MAX, MEMBER_R, isRangedType, dist, emit, refreshStats, makeEnemy, alert, damageEnemy, spawnDrop, levelUp, grantXp, checkEvolution, damageMember, fighters, syncOut, bestBenched, placeOut } from './combat';

export { ULT_MAX, insideWarning, fighters };
export const TRAINER_SPEED = 200;
export const TRAINER_R = 14;
export const FOG_CELL = 80;
const REVEAL_R = 430;
const ENGAGE = 330; // team members fight wild Pokemon this close to the trainer
const LEASH = 380; // and never run further than this from the trainer
const ACTIVE_R = 1400;
const HOME_LEASH = 720;
export const SKILLS = {
  basicMelee: { cd: 0.8, range: 58, mult: 1.15 },
  basicRanged: { cd: 0.95, range: 225, mult: 1.0, speed: 560 },
  s1: { cd: 1.1, mult: 2.3, speed: 720, range: 440, r: 12, name: 'Chiêu 1' },
  s2: { cd: 2.8, mult: 1.8, r: 150, name: 'Chiêu 2' },
  ult: { pulses: 3, gap: 0.32, r: 310, mult: 2.2 },
};
// Move names per type: [skill 1, skill 2, team ultimate]
const MOVES = {
  normal: ['Lao tới', 'Tiếng hét', 'Siêu Tốc Liên Hoàn'],
  fire: ['Phun lửa', 'Vòng lửa', 'Bão Lửa Đồng Đội'],
  water: ['Súng nước', 'Sóng thần', 'Đại Hồng Thủy'],
  electric: ['Sấm sét', 'Điện trường', 'Lôi Thần Giáng Thế'],
  grass: ['Lá bay', 'Bão lá', 'Rừng Xanh Nổi Giận'],
  ice: ['Tia băng', 'Bão tuyết', 'Kỷ Băng Hà'],
  fighting: ['Cú đá bay', 'Chấn động', 'Võ Thần Liên Hoàn'],
  poison: ['Bom bùn', 'Khí độc', 'Mưa Axit'],
  ground: ['Đá tảng', 'Động đất', 'Địa Chấn'],
  flying: ['Chém gió', 'Lốc xoáy', 'Thiên Không Bão Tố'],
  psychic: ['Sóng tâm linh', 'Vòng siêu linh', 'Tâm Linh Tối Thượng'],
  bug: ['Cắn xé', 'Bầy côn trùng', 'Trùng Vương'],
  rock: ['Đá lở', 'Bão cát', 'Thạch Thần'],
  ghost: ['Bóng ma', 'Đêm tối', 'U Linh Dạ Hành'],
  dragon: ['Móng rồng', 'Cơn thịnh nộ', 'Thần Long Giáng Thế'],
  dark: ['Nghiền nát', 'Bóng tối', 'Ám Dạ'],
  steel: ['Pháo thép', 'Cánh thép', 'Thép Thần'],
  fairy: ['Ánh trăng', 'Hào quang', 'Tiên Nữ Ban Phước'],
};
export const movesOf = (types) => MOVES[types?.[0]] || MOVES.normal;
const FORMATION = [[-34, 34], [-34, -34]];

const norm = (x, y) => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};
const lower = (s) => String(s || '').toLowerCase();

/** A team member for the quest, from a TeamBuilder member or a saved one. */
export function questMember(m, i) {
  const dex = dexOfMember(m);
  const known = speciesByName(m.name);
  const types = (m.types?.length ? m.types : known?.types || ['normal']).map(lower);
  return {
    key: m.key || `m${i}`,
    name: m.name,
    species: lower(m.species || m.name),
    dex,
    image: m.image || (dex ? artworkUrl(dex) : ''),
    types,
    power: Math.round(m.power || m.bst || known?.bst || 320),
    level: Math.max(1, Math.min(MAX_LEVEL, m.level || START_LEVEL)),
    xp: m.xp || 0,
    stage: m.stage || 0,
    plan: m.plan || (dex ? tablePlan(dex) : []),
    hpFrac: m.hpFrac ?? 1,
    fainted: !!m.fainted,
  };
}

function runtimeMember(state, p, idx) {
  const m = { ...p, idx, id: `p${idx}`, x: 0, y: 0, r: MEMBER_R, hp: 1, maxHp: 0, atk: 0, speed: 0, cd: { basic: 0, s1: 0, s2: 0 }, target: null, retarget: 0, facing: 1, moving: false, lastHurt: -99, farT: 0, knock: null };
  m.ranged = isRangedType(m.types[0]);
  refreshStats(state, m);
  m.hp = m.fainted ? 0 : Math.max(1, Math.round(m.maxHp * (p.hpFrac ?? 1)));
  delete m.hpFrac;
  return m;
}

/**
 * New journey from 5 TeamBuilder members, or a saved one (see save.js).
 * Starts in the town of the saved act (or Làng Pallet).
 */
export function createQuest({ team = [], save = null, seed = null, random = Math.random } = {}) {
  const worldSeed = save?.seed ?? seed ?? Math.floor(random() * 2 ** 31);
  const state = {
    worldSeed,
    random,
    time: 0,
    act: 0,
    areaIdx: 0,
    area: null,
    actDef: ACTS[0],
    trainer: { x: 0, y: 0, r: TRAINER_R, dir: { x: 1, y: 0 }, face: 'down', moving: false, walk: 0 },
    party: [],
    lead: save?.lead ?? 0,
    companion: save?.companion ?? -1,
    ult: 0,
    ultRun: null,
    enemies: [],
    projectiles: [],
    drops: [],
    chests: [],
    portals: [],
    telegraphs: [],
    events: [],
    nextId: 1,
    inventory: { ...STARTING_ITEMS, ...(save?.inventory || {}) },
    charms: { atk: 0, hp: 0, speed: 0, ...(save?.charms || {}) },
    gold: save?.gold ?? 0,
    unlocked: save?.unlocked ?? 0,
    beaten: [...(save?.beaten || [])],
    expertsBeaten: [...(save?.expertsBeaten || [])],
    badges: [...(save?.badges || [])],
    experts: [],
    expertLock: new Set(),
    pendingExpert: null,
    reward: { earned: 0, paid: 0, playSeconds: 0, ...(save?.reward || {}) },
    stats: { kills: 0, dealt: 0, taken: 0, levels: 0, faints: 0, wipes: 0, ...(save?.stats || {}) },
    memory: {},
    fog: null,
    portalLock: new Set(),
    townSpot: null,
    pendingEvolution: null,
    wipe: false,
    wipeT: 0,
    returnTo: null,
    visits: 0,
    regenT: 0,
    fogT: 0,
    over: false,
  };
  if (save && !save.inventory) state.inventory = { ...STARTING_ITEMS };
  const members = (save?.party || team).slice(0, 5).map(questMember);
  state.party = members.map((p, i) => runtimeMember(state, p, i));
  if (!state.party[state.lead] || state.party[state.lead].fainted) state.lead = Math.max(0, state.party.findIndex((m) => !m.fainted));
  const comp = state.party[state.companion];
  if (!comp || comp.fainted || state.companion === state.lead) state.companion = state.party.findIndex((m) => !m.fainted && m.idx !== state.lead);
  syncOut(state);
  const act = Math.min(ACTS.length - 1, Math.max(0, save?.act ?? 0));
  const idx = save?.area ?? 0;
  if (save?.pos && areaDef(act, idx)?.kind !== 'town') state.returnTo = { act, area: idx, x: save.pos.x, y: save.pos.y };
  enterArea(state, act, areaDef(act, idx) ? idx : 0, save?.pos ? 'return' : 'load');
  return state;
}

export const leadOf = (state) => state.party[state.lead];

// ---------- areas ----------

function spawnPacks(state) {
  const { area, actDef } = state;
  const rnd = mulberry32(hashSeed(area.seed, state.visits, 99));
  const [lo, hi] = area.def.levels || [1, 1];
  const [smin, smax] = area.def.packSize || [2, 3];
  const pool = actDef.enemies;
  // Early areas use the first species of the act more
  const early = area.index <= 1 ? pool.slice(0, Math.max(3, pool.length - 2)) : pool;
  area.packs.forEach((p, k) => {
    if (p.welcome) {
      for (let i = 0; i < 2; i++) makeEnemy(state, pool[i % 2], Math.max(1, lo - 1), { x: p.x + (i ? 40 : -40), y: p.y, pack: k, ranged: false });
      return;
    }
    const n = int(rnd, smin, smax);
    const eliteChance = area.kind === 'dungeon' ? 0.4 : state.act === 0 && area.index === 1 ? 0 : 0.18;
    const elite = rnd() < eliteChance;
    const base = early[Math.floor(rnd() * early.length)];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd();
      const d = i === 0 ? 0 : 30 + rnd() * Math.max(30, p.r * 0.7);
      const dex = i === 0 || rnd() < 0.55 ? base : early[Math.floor(rnd() * early.length)];
      makeEnemy(state, dex, int(rnd, lo, hi), { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, pack: k });
    }
    if (elite) makeEnemy(state, actDef.elites[Math.floor(rnd() * actDef.elites.length)], hi + 1, { elite: true, x: p.x + 10, y: p.y - 10, pack: k });
  });
}

function makeFog(state) {
  const { area } = state;
  const key = `${state.act}-${state.areaIdx}`;
  const mem = (state.memory[key] ||= { opened: [], fog: null });
  const cols = Math.ceil(area.w / FOG_CELL);
  const rows = Math.ceil(area.h / FOG_CELL);
  if (!mem.fog || mem.fog.length !== cols * rows) {
    mem.fog = new Uint8Array(cols * rows);
    if (area.kind === 'town' || area.kind === 'lair') mem.fog.fill(1);
  }
  state.fog = { cols, rows, cell: FOG_CELL, data: mem.fog, version: (state.fog?.version || 0) + 1 };
  return mem;
}

function placeParty(state) {
  const t = state.trainer;
  [state.party[state.lead], state.party[state.companion]].filter(Boolean).forEach((m, i) => {
    const slot = FORMATION[i];
    const p = nearestFree(state.area, t.x + slot[0] * t.dir.x - slot[1] * t.dir.y, t.y + slot[0] * t.dir.y + slot[1] * t.dir.x, m.r);
    m.x = p.x;
    m.y = p.y;
    m.target = null;
    m.knock = null;
  });
}

/**
 * Go to an area. via: 'forward' (came from the area before), 'back' (from the one after),
 * 'town' (teleport, wipe, travel), 'return' (back through the town's return portal), 'load'.
 */
export function enterArea(state, act, index, via = 'forward') {
  const def = areaDef(act, index);
  if (!def) return false;
  state.visits += 1;
  state.act = act;
  state.areaIdx = index;
  state.actDef = ACTS[act];
  state.area = generateArea(state.worldSeed, act, index);
  state.enemies = [];
  state.projectiles = [];
  state.drops = [];
  state.telegraphs = [];
  state.ultRun = null;
  state.townSpot = null;
  const area = state.area;
  const mem = makeFog(state);
  // Where the trainer appears
  let at = area.spawn;
  const back = area.exits.find((e) => e.to === index - 1);
  const fwd = area.exits.find((e) => e.to === index + 1);
  if (via === 'forward' && back) at = { x: back.x + 80, y: back.y };
  else if (via === 'back' && fwd) at = { x: fwd.x - 80, y: fwd.y };
  else if (via === 'return' && state.returnTo) at = { x: state.returnTo.x, y: state.returnTo.y };
  const p = nearestFree(area, at.x, at.y, TRAINER_R + 4);
  Object.assign(state.trainer, { x: p.x, y: p.y, moving: false, dir: via === 'back' ? { x: -1, y: 0 } : { x: 1, y: 0 }, face: via === 'back' ? 'left' : 'right' });
  if (index !== 0) state.returnTo = null;
  // Portals
  state.portals = area.exits.map((e) => ({
    id: state.nextId++,
    x: e.x,
    y: e.y,
    to: { act, area: e.to },
    kind: e.to < index ? 'back' : 'next',
    label: areaDef(act, e.to)?.name || '',
  }));
  if (def.kind === 'town' && state.returnTo) {
    // Below the square, off the ways to the Center, the shop and the exit
    state.portals.push({ id: state.nextId++, x: area.spawn.x + 150, y: area.spawn.y + 150, to: { act: state.returnTo.act, area: state.returnTo.area }, kind: 'return', label: `Quay lại ${areaDef(state.returnTo.act, state.returnTo.area)?.name || ''}` });
  }
  if (def.kind === 'lair') {
    if (state.beaten.includes(act)) addActPortal(state);
    else makeBoss(state, act, area.bossSpawn);
  } else if (def.kind !== 'town') {
    spawnPacks(state);
  }
  state.chests = area.chests.map((c, i) => ({ id: state.nextId++, idx: i, x: c.x, y: c.y, opened: mem.opened.includes(i) }));
  const avg = state.party.reduce((a, m) => a + m.level, 0) / Math.max(1, state.party.length);
  state.experts = expertsFor(area, avg, state.expertsBeaten);
  state.pendingExpert = null;
  state.expertLock = new Set(state.experts.filter((e) => dist(e, state.trainer) < 90).map((e) => e.id));
  // Do not walk straight back through the portal we came out of
  state.portalLock = new Set(state.portals.filter((q) => dist(q, state.trainer) < 150).map((q) => q.id));
  placeParty(state);
  revealFog(state, true);
  emit(state, { kind: 'area', act, index, name: def.name, actName: ACTS[act].name, areaKind: def.kind, via });
  return true;
}

function addActPortal(state) {
  const { act, area } = state;
  if (act + 1 >= ACTS.length || state.portals.some((p) => p.kind === 'act')) return;
  const p = area.nextActPortal;
  state.portals.push({ id: state.nextId++, x: p.x, y: p.y, to: { act: act + 1, area: 0 }, kind: 'act', label: `Đi tới ${ACTS[act + 1].name}` });
}

/** Back to the act's town: a teleport (can return to the same place) or after the whole team fainted. */
export function goToTown(state, reason = 'portal') {
  if (reason === 'wipe') {
    delete state.memory[`${state.act}-${state.areaIdx}`];
    state.returnTo = null;
    state.stats.wipes += 1;
    for (const m of state.party) {
      m.fainted = false;
      m.hp = m.maxHp;
    }
    fillCompanion(state);
    state.wipe = false;
  } else if (state.area.kind !== 'town') {
    state.returnTo = { act: state.act, area: state.areaIdx, x: state.trainer.x, y: state.trainer.y };
  } else return false;
  enterArea(state, state.act, 0, 'town');
  if (reason === 'wipe') emit(state, { kind: 'wiped-home' });
  return true;
}

/** From the town's board: go to the town of another act already opened. */
export function travelTo(state, act) {
  if (act < 0 || act > state.unlocked || act >= ACTS.length) return false;
  if (state.area.kind !== 'town') return false;
  state.returnTo = null;
  return enterArea(state, act, 0, 'town');
}

// ---------- the child's actions ----------

/** An empty place next to the trainer is taken by the healthiest Pokemon from its ball. */
function fillCompanion(state, place = false) {
  const comp = state.party[state.companion];
  if (comp && !comp.fainted) return;
  const next = bestBenched(state);
  state.companion = next ? next.idx : -1;
  syncOut(state);
  if (next && place) placeOut(state, next);
}

/**
 * Tap on a portrait. The companion becomes the lead (they swap); a Pokemon resting in its ball
 * is sent out as the new lead, the old lead stays out as companion and the old companion goes
 * back to its ball (red recall beam).
 */
export function switchLead(state, idx) {
  const m = state.party[idx];
  if (!m || m.fainted || idx === state.lead) return false;
  if (idx === state.companion) {
    state.companion = state.lead;
    state.lead = idx;
    emit(state, { kind: 'lead', idx });
    return true;
  }
  const old = state.party[state.companion];
  if (old && !old.fainted) emit(state, { kind: 'recall', idx: old.idx, x: old.x, y: old.y, toX: state.trainer.x, toY: state.trainer.y - 20, name: old.name });
  state.companion = state.lead;
  state.lead = idx;
  syncOut(state);
  placeOut(state, m);
  emit(state, { kind: 'lead', idx });
  return true;
}

export function healAll(state, frac = 1) {
  for (const m of state.party) {
    if (m.fainted && frac >= 1) m.fainted = false;
    if (!m.fainted) m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * frac));
  }
  const t = state.trainer;
  for (const m of state.party) if (m.hp <= 0) m.hp = 1;
  fillCompanion(state, true);
  emit(state, { kind: 'heal', x: t.x, y: t.y, full: frac >= 1 });
}

/** Use an item from the bag. Returns true when it did something. */
export function applyItem(state, id) {
  const it = ITEMS[id];
  if (!it || !(state.inventory[id] > 0)) return false;
  const lead = leadOf(state);
  if (it.heal) {
    const hurt = state.party.filter((m) => !m.fainted && m.hp < m.maxHp);
    if (!hurt.length) return false;
    for (const m of hurt) m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * it.heal));
  } else if (it.revive) {
    const down = state.party.filter((m) => m.fainted);
    if (!down.length) return false;
    const t = state.trainer;
    for (const m of down) {
      m.fainted = false;
      m.hp = Math.round(m.maxHp * it.revive);
      emit(state, { kind: 'revive', idx: m.idx, x: t.x, y: t.y });
    }
    fillCompanion(state, true);
  } else if (id === 'candy') {
    if (!lead || lead.level >= MAX_LEVEL || state.pendingEvolution) return false;
    state.inventory[id] -= 1;
    levelUp(state, lead);
    emit(state, { kind: 'use', item: id, x: lead.x, y: lead.y });
    return true;
  } else if (id === 'stone') {
    if (!lead || state.pendingEvolution || !nextEvolution(lead.plan, lead.dex)) return false;
    state.inventory[id] -= 1;
    checkEvolution(state, lead, true);
    return true;
  } else return false;
  state.inventory[id] -= 1;
  emit(state, { kind: 'use', item: id, x: state.trainer.x, y: state.trainer.y });
  return true;
}

/** The quick heal button: the smallest healing item that exists. */
export function quickHeal(state) {
  for (const id of HEAL_ORDER) if (state.inventory[id] > 0) return applyItem(state, id) ? id : null;
  return null;
}

export function buyItem(state, id) {
  const it = ITEMS[id];
  if (!it?.price || state.gold < it.price) return false;
  state.gold -= it.price;
  state.inventory[id] = (state.inventory[id] || 0) + 1;
  emit(state, { kind: 'buy', item: id });
  return true;
}

/** Finish the evolution sequence (the component calls it when the animation ends). */
export function applyEvolution(state) {
  const p = state.pendingEvolution;
  if (!p) return false;
  const m = state.party[p.idx];
  const step = m && nextEvolution(m.plan, m.dex);
  state.pendingEvolution = null;
  if (!step) return false;
  const from = m.name;
  m.dex = step.to;
  m.name = step.name;
  m.species = lower(step.name);
  if (step.types?.length) m.types = step.types.map(lower);
  m.ranged = isRangedType(m.types[0]);
  m.power = step.bst || Math.round(m.power * 1.25);
  m.stage += 1;
  m.image = step.image || artworkUrl(step.to);
  refreshStats(state, m);
  if (!m.fainted) m.hp = m.maxHp;
  emit(state, { kind: 'evolved', idx: m.idx, from, to: m.name, x: m.x, y: m.y });
  // Another member may be waiting (or the same one again, e.g. with a Rare Candy)
  for (const o of state.party) if (checkEvolution(state, o)) break;
  return true;
}

/** Evolution data from PokeAPI arrived for a member (replaces the built-in table). */
export function setEvolutionPlan(state, key, plan) {
  if (!Array.isArray(plan) || !plan.length) return false;
  const m = state.party.find((p) => p.key === key);
  if (!m) return false;
  m.plan = plan;
  if (!state.pendingEvolution) checkEvolution(state, m);
  return true;
}

// ---------- expert trainers ----------

export const expertById = (state, id) => state.experts.find((e) => e.id === id) || null;

/** "Để sau" (or after a battle): back to the map. */
export function closeExpert(state) {
  state.pendingExpert = null;
}

/**
 * The battle with an expert is over. A win (the first time) gives experience to the whole team,
 * quest gold and an item; beating the 5 experts of an act gives its badge. A loss changes nothing.
 */
export function expertResult(state, id, won) {
  const e = expertById(state, id);
  if (!e) return null;
  if (!won || e.beaten) {
    emit(state, { kind: won ? 'expert-again' : 'expert-lose', id, name: e.title });
    return null;
  }
  e.beaten = true;
  state.expertsBeaten.push(id);
  const r = expertReward(e, state.act);
  state.gold += r.gold;
  earnReward(state.reward, r.gold);
  const it = ITEMS[r.item];
  if (it.charm) {
    state.charms[it.charm] = Math.min(MAX_CHARMS, (state.charms[it.charm] || 0) + 1);
    for (const m of state.party) refreshStats(state, m);
  } else state.inventory[r.item] = (state.inventory[r.item] || 0) + 1;
  for (const m of state.party) grantXp(state, m, r.xp);
  emit(state, { kind: 'expert-win', id, name: e.title, gold: r.gold, item: r.item, itemName: it.name, xp: r.xp });
  const act = state.act;
  const count = state.expertsBeaten.filter((x) => x.startsWith(`${act}-`)).length;
  if (count >= EXPERTS_PER_ACT && !state.badges.includes(act)) {
    state.badges.push(act);
    emit(state, { kind: 'badge', act, name: BADGES[act].name, icon: BADGES[act].icon });
  }
  return r;
}

// ---------- simulation ----------

function moveTrainer(state, input, dt) {
  const t = state.trainer;
  const mv = input?.move || { x: 0, y: 0 };
  const len = Math.hypot(mv.x, mv.y);
  t.moving = len > 0.12;
  if (!t.moving) return;
  const k = Math.min(1, len);
  const d = { x: mv.x / len, y: mv.y / len };
  t.dir = d;
  t.face = Math.abs(d.x) > Math.abs(d.y) * 0.8 ? (d.x > 0 ? 'right' : 'left') : d.y > 0 ? 'down' : 'up';
  const sp = TRAINER_SPEED * (1 + 0.03 * (state.charms.speed || 0)) * k;
  moveCircle(state.area, t, d.x * sp * dt, d.y * sp * dt, t.r);
  t.walk += dt * 11 * k;
  // The trainer never disappears behind the big boss: pushed out of its body
  for (const e of state.enemies) {
    if (!e.boss) continue;
    const dd = dist(t, e);
    const min = e.r + t.r + 26;
    if (dd >= min) continue;
    const n = dd > 0.01 ? { x: (t.x - e.x) / dd, y: (t.y - e.y) / dd } : { x: -1, y: 0 };
    moveCircle(state.area, t, n.x * (min - dd), n.y * (min - dd), t.r);
  }
}

function interact(state) {
  const t = state.trainer;
  // Expert trainers: walking up to one opens the dialog (once until the trainer walks away)
  for (const e of state.experts) {
    const d = dist(e, t);
    if (state.expertLock.has(e.id)) {
      if (d > 170) state.expertLock.delete(e.id);
      continue;
    }
    if (d < 78) {
      state.expertLock.add(e.id);
      state.pendingExpert = e.id;
      emit(state, { kind: 'expert', id: e.id, name: e.title, beaten: e.beaten });
      return true;
    }
  }
  // Portals
  for (const id of [...state.portalLock]) {
    const p = state.portals.find((q) => q.id === id);
    if (!p || dist(p, t) > 95) state.portalLock.delete(id);
  }
  for (const p of state.portals) {
    if (state.portalLock.has(p.id) || dist(p, t) > 38) continue;
    emit(state, { kind: 'portal', x: p.x, y: p.y, portal: p.kind });
    if (p.kind === 'return') enterArea(state, p.to.act, p.to.area, 'return');
    else if (p.kind === 'act') {
      state.returnTo = null;
      enterArea(state, p.to.act, 0, 'town');
    } else enterArea(state, p.to.act, p.to.area, p.kind === 'back' ? 'back' : 'forward');
    return true;
  }
  // Town: Pokemon Center heals everyone, shop and board open their panels
  if (state.area.kind === 'town') {
    const spot = state.area.spots.find((s) => dist(s, t) < s.r);
    const id = spot?.id || null;
    if (id !== state.townSpot) {
      state.townSpot = id;
      if (id) emit(state, { kind: 'spot', id });
      if (id === 'center') healAll(state, 1);
    }
  }
  // Chests open when the trainer walks up to them
  for (const c of state.chests) {
    if (c.opened || dist(c, t) > 58) continue;
    c.opened = true;
    state.memory[`${state.act}-${state.areaIdx}`]?.opened.push(c.idx);
    const lv = state.area.def.levels?.[1] || 1;
    for (const d of rollChest(lv, state.random)) spawnDrop(state, c.x, c.y - 10, d, 1.4);
    emit(state, { kind: 'chest', x: c.x, y: c.y });
  }
  // Loot: coins fly to the trainer, items are picked up by walking over them
  for (let i = state.drops.length - 1; i >= 0; i--) {
    const d = state.drops[i];
    if (d.age < 0.45) continue;
    const dd = dist(d, t);
    if (d.kind === 'coin' && dd < 120 && dd > 1) {
      const k = Math.min(1, 520 / 60 / dd);
      d.x += (t.x - d.x) * k * 0.9;
      d.y += (t.y - d.y) * k * 0.9;
    }
    if (dist(d, t) > (d.kind === 'coin' ? 24 : 34)) continue;
    state.drops.splice(i, 1);
    pickUp(state, d);
  }
  return false;
}

function pickUp(state, d) {
  const t = state.trainer;
  if (d.kind === 'coin') {
    state.gold += d.amount;
    earnReward(state.reward, d.amount);
    emit(state, { kind: 'pickup', coin: true, amount: d.amount, x: t.x, y: t.y - 40 });
    return;
  }
  const it = ITEMS[d.item];
  if (it.charm) {
    if ((state.charms[it.charm] || 0) >= MAX_CHARMS) {
      state.gold += 25;
      emit(state, { kind: 'pickup', coin: true, amount: 25, x: t.x, y: t.y - 40 });
      return;
    }
    state.charms[it.charm] = (state.charms[it.charm] || 0) + 1;
    for (const m of state.party) refreshStats(state, m);
  } else state.inventory[d.item] = (state.inventory[d.item] || 0) + 1;
  emit(state, { kind: 'pickup', item: d.item, name: it.name, rarity: it.rarity, x: t.x, y: t.y - 40 });
}

function nearestEnemy(state, from, maxD, filter) {
  let best = null;
  let bd = maxD;
  for (const e of state.enemies) {
    if (e.dead || (filter && !filter(e))) continue;
    const d = dist(from, e);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

function shootFrom(state, m, dir, skill) {
  const s = skill === 's1' ? SKILLS.s1 : SKILLS.basicRanged;
  state.projectiles.push({
    id: state.nextId++,
    side: 'party',
    owner: m.idx,
    type: m.types[0],
    x: m.x + dir.x * 16,
    y: m.y - 18 + dir.y * 16,
    vx: dir.x * s.speed,
    vy: dir.y * s.speed,
    life: (skill === 's1' ? s.range : s.range + 60) / s.speed,
    r: skill === 's1' ? SKILLS.s1.r : 7,
    mult: s.mult,
    pierce: skill === 's1',
    skill,
    hit: [],
  });
}

/** The lead's skills and the team ultimate. Returns true when cast. */
export function cast(state, what) {
  const m = leadOf(state);
  if (!m || m.fainted || state.area.kind === 'town') return false;
  if (what === 's1' && m.cd.s1 <= 0) {
    const t = nearestEnemy(state, m, SKILLS.s1.range + 60);
    const dir = t ? norm(t.x - m.x, t.y - 18 - m.y) : state.trainer.dir;
    m.cd.s1 = SKILLS.s1.cd;
    if (Math.abs(dir.x) > 0.1) m.facing = dir.x > 0 ? 1 : -1;
    shootFrom(state, m, dir, 's1');
    emit(state, { kind: 'cast', idx: m.idx, x: m.x, y: m.y - 18, dx: dir.x, dy: dir.y, type: m.types[0], name: movesOf(m.types)[0] });
    return true;
  }
  if (what === 's2' && m.cd.s2 <= 0) {
    m.cd.s2 = SKILLS.s2.cd;
    emit(state, { kind: 'nova', idx: m.idx, x: m.x, y: m.y, r: SKILLS.s2.r, type: m.types[0], name: movesOf(m.types)[1] });
    for (const e of state.enemies) {
      if (e.dead || dist(m, e) > SKILLS.s2.r + e.r) continue;
      damageEnemy(state, m, e, SKILLS.s2.mult, { knock: norm(e.x - m.x, e.y - m.y) });
    }
    return true;
  }
  if (what === 'ult' && state.ult >= ULT_MAX && !state.ultRun) {
    if (!nearestEnemy(state, m, SKILLS.ult.r + 140)) return false;
    state.ult = 0;
    state.ultRun = { t: 0, pulses: 0, idx: m.idx };
    emit(state, { kind: 'ult', idx: m.idx, x: m.x, y: m.y, type: m.types[0], name: movesOf(m.types)[2] });
    // The whole team joins in with a skill shot each
    for (const o of fighters(state)) {
      if (o === m) continue;
      const t = nearestEnemy(state, o, 520);
      if (!t) continue;
      const dir = norm(t.x - o.x, t.y - 18 - o.y);
      shootFrom(state, o, dir, 's1');
      emit(state, { kind: 'cast', idx: o.idx, x: o.x, y: o.y - 18, dx: dir.x, dy: dir.y, type: o.types[0], quiet: true });
    }
    return true;
  }
  return false;
}

function stepUlt(state, dt) {
  const u = state.ultRun;
  if (!u) return;
  const m = state.party[u.idx];
  if (!m || m.fainted) {
    state.ultRun = null;
    return;
  }
  u.t -= dt;
  if (u.t > 0) return;
  u.t = SKILLS.ult.gap;
  u.pulses += 1;
  const last = u.pulses >= SKILLS.ult.pulses;
  emit(state, { kind: 'ult-pulse', x: m.x, y: m.y, r: SKILLS.ult.r, type: m.types[0], n: u.pulses, last });
  for (const e of state.enemies) {
    if (e.dead || dist(m, e) > SKILLS.ult.r + e.r) continue;
    damageEnemy(state, m, e, SKILLS.ult.mult * (last ? 1.4 : 1), { charge: false, knock: last ? norm(e.x - m.x, e.y - m.y) : null });
  }
  if (last) state.ultRun = null;
}

/**
 * Walk towards a goal; when a tree or rock is in the way for a moment, follow an A* path
 * around it for a while. Returns the distance moved.
 */
function steer(state, ent, goal, speed, dt) {
  const d = dist(ent, goal);
  if (d < 2) return 0;
  const len = Math.min(d, speed * dt);
  let tx = goal.x;
  let ty = goal.y;
  if (ent.path && state.time < ent.pathUntil) {
    while (ent.path.length && dist(ent, ent.path[0]) < 16) ent.path.shift();
    if (ent.path.length) {
      tx = ent.path[0].x;
      ty = ent.path[0].y;
    } else ent.path = null;
  }
  const dir = norm(tx - ent.x, ty - ent.y);
  const bx = ent.x;
  const by = ent.y;
  moveCircle(state.area, ent, dir.x * len, dir.y * len);
  const moved = Math.hypot(ent.x - bx, ent.y - by);
  ent.blockT = moved < len * 0.4 ? (ent.blockT || 0) + dt : Math.max(0, (ent.blockT || 0) - dt);
  if (ent.blockT > 0.45 && state.time > (ent.nextPath || 0)) {
    ent.path = findPath(state.area, ent, goal, 2500);
    ent.pathUntil = state.time + 2.5;
    ent.nextPath = state.time + 1;
    ent.blockT = 0;
  }
  if (Math.abs(dir.x) > 0.3) ent.facing = dir.x > 0 ? 1 : -1;
  return moved;
}

function formationSlot(state, m) {
  const t = state.trainer;
  // The lead on one side, the companion on the other, both a little behind
  const s = FORMATION[m.idx === state.lead ? 0 : 1];
  return { x: t.x + s[0] * t.dir.x - s[1] * t.dir.y, y: t.y + s[0] * t.dir.y + s[1] * t.dir.x };
}

function stepMember(state, m, dt) {
  const t = state.trainer;
  m.cd.basic = Math.max(0, m.cd.basic - dt);
  m.cd.s1 = Math.max(0, m.cd.s1 - dt);
  m.cd.s2 = Math.max(0, m.cd.s2 - dt);
  m.moving = false;
  if (m.knock) {
    moveCircle(state.area, m, m.knock.vx * dt, m.knock.vy * dt);
    m.knock.t -= dt;
    if (m.knock.t <= 0) m.knock = null;
    return;
  }
  // Too far behind (stuck behind a tree): pop back next to the trainer
  if (dist(m, t) > 520) {
    m.farT += dt;
    if (m.farT > 1.2) {
      const p = nearestFree(state.area, t.x - t.dir.x * 40, t.y - t.dir.y * 40, m.r);
      emit(state, { kind: 'poof', x: m.x, y: m.y });
      m.x = p.x;
      m.y = p.y;
      m.farT = 0;
      emit(state, { kind: 'poof', x: m.x, y: m.y });
    }
  } else m.farT = 0;

  let target = m.target != null ? state.enemies.find((e) => e.id === m.target && !e.dead) : null;
  if (target && (dist(target, t) > ENGAGE + 90 || dist(target, m) > 520)) target = null;
  if (!target || state.time > m.retarget) {
    m.retarget = state.time + 0.45;
    const found = nearestEnemy(state, m, 440, (e) => dist(e, t) <= ENGAGE && (e.mode === 'chase' || e.boss || dist(e, m) < 300));
    if (found) target = found;
  }
  m.target = target ? target.id : null;

  let goal = null;
  let speed = m.speed;
  const danger = state.telegraphs.find((w) => insideWarning(m, w));
  if (danger) {
    // Step out of the red warning shape
    if (danger.shape === 'strip') {
      const side = -(m.x - danger.x) * Math.sin(danger.ang) + (m.y - danger.y) * Math.cos(danger.ang);
      const s = side >= 0 ? 1 : -1;
      goal = { x: m.x - Math.sin(danger.ang) * s * 80, y: m.y + Math.cos(danger.ang) * s * 80 };
    } else {
      const d = norm(m.x - danger.x, m.y - danger.y);
      goal = { x: m.x + d.x * 90, y: m.y + d.y * 90 };
    }
    speed *= 1.15;
  } else if (target && m.hp < m.maxHp * 0.3 && dist(m, target) < 150) {
    // Tired: step back behind the trainer (shooters keep shooting from there)
    const away = norm(m.x - target.x, m.y - target.y);
    goal = { x: t.x + away.x * 60, y: t.y + away.y * 60 };
    if (m.ranged && m.cd.basic <= 0 && shotClear(state.area, m.x, m.y, target.x, target.y)) {
      m.cd.basic = SKILLS.basicRanged.cd;
      shootFrom(state, m, norm(target.x - m.x, target.y - 12 - (m.y - 18)), 'basic');
    }
    speed *= 1.1;
  } else if (target) {
    const d = dist(m, target);
    // Shooters need a clear line; otherwise they walk closer (round the tree)
    const sight = !m.ranged || d < 60 || shotClear(state.area, m.x, m.y, target.x, target.y);
    const range = !sight ? 40 : m.ranged ? SKILLS.basicRanged.range : SKILLS.basicMelee.range + target.r;
    if (d > range * 0.9) {
      const dir = norm(target.x - m.x, target.y - m.y);
      const nx = m.x + dir.x * 30;
      const ny = m.y + dir.y * 30;
      if (Math.hypot(nx - t.x, ny - t.y) < LEASH || Math.hypot(nx - t.x, ny - t.y) < dist(m, t)) goal = target;
    }
    if (Math.abs(target.x - m.x) > 4) m.facing = target.x > m.x ? 1 : -1;
    if (m.cd.basic <= 0 && d <= range + 12 && (sight || d < 60)) {
      if (m.ranged) {
        m.cd.basic = SKILLS.basicRanged.cd * (0.9 + state.random() * 0.2);
        shootFrom(state, m, norm(target.x - m.x, target.y - 12 - (m.y - 18)), 'basic');
        emit(state, { kind: 'shoot', idx: m.idx, type: m.types[0] });
      } else {
        m.cd.basic = SKILLS.basicMelee.cd * (0.9 + state.random() * 0.2);
        const dir = norm(target.x - m.x, target.y - m.y);
        m.lunge = 0.18;
        emit(state, { kind: 'slash', idx: m.idx, x: target.x, y: target.y - 16, dx: dir.x, dy: dir.y, type: m.types[0] });
        damageEnemy(state, m, target, SKILLS.basicMelee.mult);
      }
    }
  } else {
    const slot = formationSlot(state, m);
    const d = dist(m, slot);
    if (d > 10) {
      goal = slot;
      speed = Math.min(m.speed * 1.35, Math.max(40, d * 4.5));
    }
  }
  if (goal) {
    const face = m.facing;
    m.moving = steer(state, m, goal, speed, dt) > speed * dt * 0.3;
    if (target) m.facing = face;
  }
  if (m.lunge) m.lunge = Math.max(0, m.lunge - dt);
}

function stepEnemy(state, e, dt) {
  const t = state.trainer;
  if (e.mode === 'idle' && dist(e, t) > ACTIVE_R) return;
  e.cd = Math.max(0, e.cd - dt);
  e.alertT = Math.max(0, e.alertT - dt);
  e.moving = false;
  if (e.knock) {
    moveCircle(state.area, e, e.knock.vx * dt, e.knock.vy * dt);
    e.knock.t -= dt;
    if (e.knock.t <= 0) e.knock = null;
    return;
  }
  const alive = fighters(state);
  if (e.mode === 'idle') {
    e.wanderT -= dt;
    if (e.wanderT <= 0) {
      e.wanderT = 1.5 + state.random() * 2.5;
      const a = state.random() * Math.PI * 2;
      const r = 30 + state.random() * 80;
      e.wx = e.home.x + Math.cos(a) * r;
      e.wy = e.home.y + Math.sin(a) * r;
    }
    const d = Math.hypot(e.wx - e.x, e.wy - e.y);
    if (d > 6) {
      const dir = norm(e.wx - e.x, e.wy - e.y);
      if (!moveCircle(state.area, e, dir.x * e.speed * 0.35 * dt, dir.y * e.speed * 0.35 * dt)) e.wanderT = 0;
      e.moving = true;
      if (Math.abs(dir.x) > 0.3) e.facing = dir.x > 0 ? 1 : -1;
    }
    const aggro = e.elite ? 260 : 225;
    if (dist(e, t) < aggro || alive.some((m) => dist(m, e) < aggro - 40)) alert(state, e);
    return;
  }
  if (e.mode === 'return') {
    const d = dist(e, e.home);
    e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.3 * dt);
    if (d < 20) {
      e.mode = 'idle';
      e.hitBy.clear();
      return;
    }
    e.returnT = (e.returnT || 0) + dt;
    if (!steer(state, e, e.home, e.speed * 1.3, dt) && e.returnT > 3) {
      e.x = e.home.x;
      e.y = e.home.y;
    }
    e.moving = true;
    return;
  }
  // chase (gives up when nothing happened for a long while, e.g. no way round a pond)
  if (!alive.length || (!e.minion && dist(e, e.home) > HOME_LEASH) || state.time - (e.lastAction ?? state.time) > 9) {
    e.mode = 'return';
    e.returnT = 0;
    e.lastAction = null;
    e.target = null;
    return;
  }
  let target = e.target != null ? state.party[e.target] : null;
  if (!target || target.fainted || state.time > e.retarget) {
    e.retarget = state.time + 0.7;
    target = alive.reduce((a, m) => (dist(m, e) < dist(a, e) ? m : a), alive[0]);
  }
  e.target = target.idx;
  const d = dist(e, target);
  const sight = !e.ranged || shotClear(state.area, e.x, e.y, target.x, target.y);
  const range = e.ranged && sight ? 195 : e.r + target.r + 12;
  if (Math.abs(target.x - e.x) > 4) e.facing = target.x > e.x ? 1 : -1;
  if (e.windup > 0) {
    e.windup -= dt;
    if (e.windup <= 0) {
      e.cd = e.atkCd * (0.85 + state.random() * 0.3);
      if (e.ranged) {
        const dir = norm(target.x - e.x, target.y - e.y);
        state.projectiles.push({ id: state.nextId++, side: 'enemy', owner: e.id, type: e.types[0], x: e.x + dir.x * e.r, y: e.y - 14 + dir.y * e.r, vx: dir.x * 300, vy: dir.y * 300, life: 1.25, r: 8, mult: 1, pierce: false });
        emit(state, { kind: 'enemy-shot', id: e.id, type: e.types[0] });
      } else if (d <= range + 24) {
        emit(state, { kind: 'bite', x: target.x, y: target.y - 16, type: e.types[0] });
        damageMember(state, e, target, 1);
      }
    }
    return;
  }
  if (d > range * 0.92) {
    steer(state, e, target, e.speed, dt);
    e.moving = true;
    if (Math.abs(target.x - e.x) > 4) e.facing = target.x > e.x ? 1 : -1;
  } else if (e.cd <= 0) {
    e.windup = e.ranged ? 0.4 : 0.32;
    emit(state, { kind: 'windup', id: e.id });
  }
}

function separate(area, list, minD) {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const need = Math.min(minD, (a.r + b.r) * 0.9);
      const d2 = dx * dx + dy * dy;
      if (d2 >= need * need || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (need - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      // Pushed apart, but never into a tree or a pond
      if (!a.boss) moveCircle(area, a, -nx * push, -ny * push);
      if (!b.boss) moveCircle(area, b, nx * push, ny * push);
    }
  }
}

function stepProjectiles(state, dt) {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    let gone = p.life <= 0 || blocksShot(state.area, p.x, p.y + 18);
    if (!gone && p.side === 'party') {
      const owner = state.party[p.owner];
      for (const e of state.enemies) {
        if (e.dead || p.hit.includes(e.id)) continue;
        if (Math.hypot(e.x - p.x, e.y - 18 - p.y) > e.r + p.r + 4) continue;
        p.hit.push(e.id);
        damageEnemy(state, owner, e, p.mult);
        if (!p.pierce) {
          gone = true;
          break;
        }
      }
    } else if (!gone) {
      const owner = state.enemies.find((e) => e.id === p.owner) || { atk: 5, types: [p.type] };
      for (const m of fighters(state)) {
        if (Math.hypot(m.x - p.x, m.y - 18 - p.y) > m.r + p.r) continue;
        damageMember(state, owner, m, p.mult);
        gone = true;
        break;
      }
    }
    if (gone) {
      emit(state, { kind: 'pop', id: p.id, x: p.x, y: p.y, type: p.type, big: p.skill === 's1' || p.big, side: p.side });
      state.projectiles.splice(i, 1);
    }
  }
}

export function revealFog(state, force = false) {
  const f = state.fog;
  if (!f) return;
  const t = state.trainer;
  const r = REVEAL_R;
  const c0 = Math.max(0, Math.floor((t.x - r) / f.cell));
  const c1 = Math.min(f.cols - 1, Math.floor((t.x + r) / f.cell));
  const r0 = Math.max(0, Math.floor((t.y - r) / f.cell));
  const r1 = Math.min(f.rows - 1, Math.floor((t.y + r) / f.cell));
  let changed = force;
  for (let y = r0; y <= r1; y++) {
    for (let x = c0; x <= c1; x++) {
      const i = y * f.cols + x;
      if (f.data[i]) continue;
      if (Math.hypot((x + 0.5) * f.cell - t.x, (y + 0.5) * f.cell - t.y) <= r) {
        f.data[i] = 1;
        changed = true;
      }
    }
  }
  if (changed) f.version += 1;
}

/** Share of the area explored (0..1). */
export function explored(state) {
  const d = state.fog?.data;
  if (!d) return 0;
  let n = 0;
  for (let i = 0; i < d.length; i++) n += d[i];
  return n / d.length;
}

/**
 * Advance by dt seconds. input: { move: {x, y}, cast: 's1' | 's2' | 'ult' | null }.
 * Nothing moves while an evolution is being shown.
 */
export function step(state, dt, input = {}) {
  if (state.pendingEvolution || state.pendingExpert) return state;
  if (state.wipe) {
    state.wipeT -= dt;
    if (state.wipeT <= 0) goToTown(state, 'wipe');
    return state;
  }
  state.time += dt;
  state.reward.playSeconds += dt;
  moveTrainer(state, input, dt);
  if (interact(state)) return state;
  if (input.cast) cast(state, input.cast);

  for (const m of fighters(state)) stepMember(state, m, dt);
  for (const e of state.enemies) {
    if (e.dead) continue;
    if (e.boss) stepBoss(state, e, dt);
    else stepEnemy(state, e, dt);
  }
  stepUlt(state, dt);
  stepProjectiles(state, dt);
  if (state.enemies.some((e) => e.dead)) {
    const boss = state.enemies.find((e) => e.dead && e.boss);
    state.enemies = state.enemies.filter((e) => !e.dead);
    if (boss) bossDown(state, boss);
  }
  separate(state.area, fighters(state), 30);
  const near = state.enemies.filter((e) => e.mode !== 'idle' || dist(e, state.trainer) < 700);
  separate(state.area, near, 34);
  // Safety: anything stuck inside a wall steps out to the nearest free spot
  for (const o of [...fighters(state), ...near]) {
    if (o.boss || !circleBlocked(state.area, o.x, o.y, o.r - 6)) continue;
    const p = nearestFree(state.area, o.x, o.y, o.r);
    o.x = p.x;
    o.y = p.y;
  }

  // Drops fly out in a little arc
  for (const d of state.drops) {
    d.age += dt;
    if (d.z > 0 || d.vz > 0) {
      d.vz -= 900 * dt;
      d.z = Math.max(0, d.z + d.vz * dt);
      if (d.z === 0) d.vz = 0;
      const nx = d.x + d.vx * dt;
      const ny = d.y + d.vy * dt;
      if (!circleBlocked(state.area, nx, ny, 6)) {
        d.x = nx;
        d.y = ny;
      }
    }
  }

  // Resting heals slowly (faster in town); nothing heals while fighting
  state.regenT += dt;
  if (state.regenT >= 0.5) {
    const town = state.area.kind === 'town';
    const fighting = state.enemies.some((e) => e.mode === 'chase');
    for (const m of state.party) {
      if (m.fainted || m.hp >= m.maxHp) continue;
      // Resting in the ball heals a little all the time
      if (!m.out) {
        m.hp = Math.min(m.maxHp, m.hp + m.maxHp * (town ? 0.06 : 0.03) * state.regenT);
        continue;
      }
      if (!town && (fighting || state.time - m.lastHurt < 5)) continue;
      m.hp = Math.min(m.maxHp, m.hp + m.maxHp * (town ? 0.06 : 0.025) * state.regenT);
    }
    state.regenT = 0;
  }
  state.fogT += dt;
  if (state.fogT > 0.15) {
    state.fogT = 0;
    revealFog(state);
  }
  return state;
}

function bossDown(state, b) {
  const act = state.act;
  state.telegraphs = [];
  for (const e of state.enemies) if (e.minion) {
    e.dead = true;
    emit(state, { kind: 'poof', x: e.x, y: e.y });
  }
  state.enemies = state.enemies.filter((e) => !e.dead);
  const first = !state.beaten.includes(act);
  if (first) {
    state.beaten.push(act);
    earnActClear(state.reward);
  }
  state.unlocked = Math.min(ACTS.length - 1, Math.max(state.unlocked, act + 1));
  addActPortal(state);
  const final = act === ACTS.length - 1;
  if (final) state.over = true;
  emit(state, { kind: 'boss-down', x: b.x, y: b.y, name: b.name, dex: b.dex });
  emit(state, { kind: 'act-clear', act, first, final, name: ACTS[act].name, next: ACTS[act + 1]?.name || null });
}

/** Snapshot for the React HUD (plain values only). */
export function hudOf(state) {
  const lead = leadOf(state);
  const boss = state.enemies.find((e) => e.boss && e.woke);
  return {
    act: state.act,
    areaIdx: state.areaIdx,
    areaName: state.area.name,
    areaKind: state.area.kind,
    actName: ACTS[state.act].name,
    theme: state.area.theme,
    gold: state.gold,
    lead: state.lead,
    ult: state.ult,
    ultReady: state.ult >= ULT_MAX,
    cd: lead ? { s1: lead.cd.s1, s2: lead.cd.s2 } : { s1: 0, s2: 0 },
    moves: lead ? movesOf(lead.types) : movesOf(['normal']),
    party: state.party.map((m) => ({
      key: m.key,
      name: m.name,
      image: m.image,
      dex: m.dex,
      types: m.types,
      level: m.level,
      hp: Math.max(0, Math.round(m.hp)),
      maxHp: m.maxHp,
      hpRatio: m.maxHp ? Math.max(0, m.hp / m.maxHp) : 0,
      xpRatio: m.level >= MAX_LEVEL ? 1 : Math.min(1, m.xp / xpToNext(m.level)),
      xp: Math.floor(m.xp),
      fainted: m.fainted,
      out: !!m.out,
      nextEvo: nextEvolution(m.plan, m.dex),
    })),
    companion: state.companion,
    inventory: { ...state.inventory },
    charms: { ...state.charms },
    boss: boss ? { name: boss.name, title: boss.title, hpRatio: Math.max(0, boss.hp / boss.maxHp), angry: boss.angry, level: boss.level } : null,
    townSpot: state.townSpot,
    expert: state.pendingExpert ? { ...expertById(state, state.pendingExpert) } : null,
    badges: [...state.badges],
    expertsDone: ACTS.map((_, a) => state.expertsBeaten.filter((x) => x.startsWith(`${a}-`)).length),
    canReturn: !!state.returnTo,
    pendingEvolution: state.pendingEvolution ? { ...state.pendingEvolution } : null,
    wipe: state.wipe,
    unlocked: state.unlocked,
    beaten: [...state.beaten],
    enemiesLeft: state.enemies.length,
    anyFainted: state.party.some((m) => m.fainted),
    anyHurt: state.party.some((m) => !m.fainted && m.hp < m.maxHp),
    over: state.over,
    x: Math.round(state.trainer.x),
    y: Math.round(state.trainer.y),
  };
}
