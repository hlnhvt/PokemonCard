// "Tiệm Pizza Pokémon": a cosy 3D pizzeria management game for kids. Pure engine (no three.js, no DOM).
// One day = DAY_LEN seconds. Pokémon customers walk in, queue at the counter, order a pizza; the child
// (or hired staff) takes the order, builds the pizza (dough → sauce → cheese → toppings), bakes it
// (perfect window bonus, burnt if too late), boxes it, serves it and collects the coins.
// World: x right, y up, z towards the camera; yaw 0 faces -z (three.js convention).
import { DAY_LEN, CLOSING_MAX, LAYOUT, SPECIES, INGREDIENTS, recipeById, recipeSteps, speedOf, speciesOf } from './pizza3d/data';
import { bakeTime, crowdOf, decorPoints, menuOf, ovenCount, queueCap, registerCount, tableCount, toppingsOf, salaries, buy, shopItems, newShop } from './pizza3d/shop';

export * from './pizza3d/data';
export * from './pizza3d/shop';

export const DT = 1 / 30;
const SPEED = { customer: 2.0, staff: 2.9, player: 3.6 };
const LINE_PATIENCE = 85;
const WAIT_PATIENCE = 120;
const EAT_TIME = 7;
const BASE_INTERVAL = 13.5; // seconds between customers before crowd bonuses
export const BAKE_ZONES = { raw: 0.9, perfect: 1.0, perfectEnd: 1.4, burnt: 1.85 };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
const FACE_COUNTER = Math.PI; // customers look at the counter (+z)
const FACE_FRONT = Math.PI; // cooks face the camera
const FACE_BACK = 0; // staff behind the counter look at the customers (-z)

/** Bake progress → zone. */
export function bakeZone(p) {
  if (p < BAKE_ZONES.raw) return 'raw';
  if (p < BAKE_ZONES.perfect) return 'ok';
  if (p < BAKE_ZONES.perfectEnd) return 'perfect';
  if (p < BAKE_ZONES.burnt) return 'ok';
  return 'burnt';
}
const BAKE_SCORE = { perfect: 1, ok: 0.7, raw: 0.3, burnt: 0.1 };
const BAKE_TIP = { perfect: 1.25, ok: 0.9, raw: 0.3, burnt: 0.2 };
const BAKE_PAY = { perfect: 1, ok: 1, raw: 0.7, burnt: 0.6 };

// ---------------------------------------------------------------- places
const regSpot = (r) => ({ x: LAYOUT.registers[r].x, z: LAYOUT.custZ });
const regStand = (r) => ({ x: LAYOUT.registers[r].x, z: LAYOUT.staffZ });
const pickupSpot = () => ({ x: LAYOUT.pickupX, z: LAYOUT.custZ });
const passStand = () => ({ x: LAYOUT.pickupX, z: LAYOUT.staffZ });
const prepStand = (i) => ({ x: LAYOUT.prep[i].x, z: LAYOUT.cookZ });
const ovenStand = (i) => ({ x: LAYOUT.ovenStandX, z: LAYOUT.ovens[i].z });
const tableStand = (t) => ({ x: t.x, z: t.z + 0.8 });
const isKitchen = (p) => p.z > LAYOUT.counter.z;

/** Walking route; crossing between kitchen and shop floor goes round the end of the counter. */
export function route(from, to) {
  if (isKitchen(from) === isKitchen(to)) return [{ x: to.x, z: to.z }];
  return isKitchen(from) ? [{ ...LAYOUT.gapK }, { ...LAYOUT.gapF }, { x: to.x, z: to.z }] : [{ ...LAYOUT.gapF }, { ...LAYOUT.gapK }, { x: to.x, z: to.z }];
}

function walkTo(e, to, face = null) {
  e.path = route(e, to);
  e.faceEnd = face;
}

function moveAlong(e, speed, dt) {
  let rem = speed * dt;
  e.walking = e.path.length > 0;
  while (e.path.length && rem > 0) {
    const p = e.path[0];
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-4) e.face = yawTo(dx, dz);
    if (d <= rem) {
      e.x = p.x;
      e.z = p.z;
      rem -= d;
      e.path.shift();
    } else {
      e.x += (dx / d) * rem;
      e.z += (dz / d) * rem;
      rem = 0;
    }
  }
  if (!e.path.length && e.faceEnd != null) e.face = e.faceEnd;
}

// ---------------------------------------------------------------- creation
/**
 * createPizza3D({ shop, random, dayLen, visitors, playerSpecies }) → state for one day.
 * visitors: extra customer looks from the child's collection [{ name, type, image }].
 */
export function createPizza3D({ shop = newShop(), random = Math.random, dayLen = DAY_LEN, visitors = [], playerSpecies = null } = {}) {
  const s = {
    random,
    shop,
    day: shop.day,
    dayLen,
    t: 0,
    phase: 'open', // open | closing | done
    closingT: 0,
    nextId: 1,
    spawnT: 2.2,
    bake: bakeTime(shop),
    decor: decorPoints(shop),
    crowd: crowdOf(shop),
    menu: menuOf(shop),
    toppings: toppingsOf(shop),
    cap: queueCap(shop),
    visitors: visitors.filter((v) => v && v.name).slice(0, 40),
    playerSpecies,
    money: shop.money,
    coins: 0, // paid but not yet collected (on the counter)
    customers: [],
    line: [],
    registers: Array.from({ length: registerCount(shop) }, (_, i) => ({ i, cust: null })),
    ovens: Array.from({ length: ovenCount(shop) }, (_, i) => ({ i, orderId: null, t: 0, owner: null })),
    tables: Array.from({ length: tableCount(shop) }, (_, i) => ({ i, ...LAYOUT.tables[i], cust: null, dirty: false })),
    waitSpots: LAYOUT.wait.map(() => null),
    orders: [],
    prep: null, // the child's pizza on the prep table: { orderId }
    staff: [],
    chef: { id: 'player', x: prepStand(0).x, z: prepStand(0).z, path: [], face: FACE_FRONT, faceEnd: FACE_FRONT, walking: false, cue: null, cueT: 0 },
    events: [],
    report: { customers: 0, served: 0, lost: 0, revenue: 0, tips: 0, dine: 0, perfect: 0, burnt: 0, mistakes: 0, hearts: 0 },
    result: null,
  };
  let cashiers = 0;
  for (const m of shop.staff) {
    const e = { ...m, path: [], walking: false, task: null, holding: null, cool: 0, cue: null, cueT: 0 };
    if (m.role === 'cashier') {
      e.reg = Math.min(cashiers, s.registers.length - 1);
      cashiers += 1;
      Object.assign(e, regStand(e.reg), { face: FACE_BACK, faceEnd: FACE_BACK });
    } else if (m.role === 'chef') Object.assign(e, prepStand(1), { face: FACE_FRONT, faceEnd: FACE_FRONT, x: prepStand(1).x + (s.staff.some((o) => o.role === 'chef') ? 0.7 : 0) });
    else Object.assign(e, passStand(), { x: passStand().x - 0.5 - (s.staff.some((o) => o.role === 'waiter') ? 0.6 : 0), face: FACE_BACK, faceEnd: FACE_BACK });
    s.staff.push(e);
  }
  return s;
}

const emit = (s, e) => s.events.push(e);
const custById = (s, id) => s.customers.find((c) => c.id === id) || null;
export const orderById = (s, id) => s.orders.find((o) => o.id === id) || null;
const staffOn = (s, role) => s.staff.filter((m) => m.role === role);

function pickLook(s) {
  const r = s.random;
  if (s.visitors.length && r() < 0.3) {
    const v = s.visitors[Math.floor(r() * s.visitors.length) % s.visitors.length];
    const sp = speciesOf(v.name);
    const known = sp && SPECIES.find((x) => x.id === sp);
    return { species: sp || 'generic', name: v.name, type: v.type || known?.type || 'Normal', image: v.image || null, dex: known?.dex || v.dex || null, shiny: false };
  }
  const sp = SPECIES[Math.floor(r() * SPECIES.length) % SPECIES.length];
  return { species: sp.id, name: sp.name, type: sp.type, dex: sp.dex, image: null, shiny: r() < 0.07 };
}

function pickRecipe(s) {
  const menu = s.menu;
  const w = menu.map((m, i) => (i === menu.length - 1 && menu.length > 2 ? 1.6 : 1));
  let x = s.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < menu.length; i++) {
    x -= w[i];
    if (x <= 0) return menu[i].id;
  }
  return menu[menu.length - 1].id;
}

function spawnCustomer(s) {
  const id = s.nextId++;
  const c = {
    id,
    look: pickLook(s),
    recipe: pickRecipe(s),
    x: LAYOUT.outside.x,
    z: LAYOUT.outside.z + (s.random() - 0.5) * 0.4,
    path: [],
    face: -Math.PI / 2,
    faceEnd: null,
    walking: true,
    state: 'line',
    patience: LINE_PATIENCE * (1 + 0.06 * s.decor),
    maxPatience: LINE_PATIENCE * (1 + 0.06 * s.decor),
    reg: null,
    wait: null,
    table: null,
    seat: 0,
    orderId: null,
    hearts: 0,
    eatT: 0,
    carry: false,
    mood: 'happy',
    spot: -1,
  };
  s.customers.push(c);
  s.line.push(id);
  s.report.customers += 1;
  emit(s, { type: 'arrive', id });
}

const outdoors = (c) => c.x > LAYOUT.inside.x + 0.15;

/** Keeps everyone in line on their spot. */
function relayLine(s) {
  s.line.forEach((id, i) => {
    const c = custById(s, id);
    if (!c || c.spot === i) return;
    const q = LAYOUT.queue[Math.min(i, LAYOUT.queue.length - 1)];
    const next = LAYOUT.queue[Math.max(0, i - 1)];
    c.path = outdoors(c) ? [{ ...LAYOUT.inside }, { x: q.x, z: q.z }] : [{ x: q.x, z: q.z }];
    c.faceEnd = i === 0 ? FACE_COUNTER : yawTo(next.x - q.x, next.z - q.z);
    c.spot = i;
  });
}

function freeWaitSpot(s) {
  const i = s.waitSpots.indexOf(null);
  return i < 0 ? s.waitSpots.length - 1 : i;
}

function leave(s, c, mood) {
  if (c.reg != null && s.registers[c.reg]?.cust === c.id) s.registers[c.reg].cust = null;
  if (c.wait != null && s.waitSpots[c.wait] === c.id) s.waitSpots[c.wait] = null;
  if (c.table != null && s.tables[c.table]?.cust === c.id) s.tables[c.table].cust = null;
  const li = s.line.indexOf(c.id);
  if (li >= 0) {
    s.line.splice(li, 1);
    relayLine(s);
  }
  c.reg = null;
  c.wait = null;
  c.state = 'leave';
  c.mood = mood;
  c.path = [{ x: LAYOUT.inside.x - 0.2, z: LAYOUT.inside.z + 0.35 }, { x: LAYOUT.outside.x + 0.5, z: LAYOUT.outside.z + 0.35 }];
  c.faceEnd = null;
}

// ---------------------------------------------------------------- orders
function takeOrderFor(s, c, by) {
  if (!c || c.state !== 'order') return false;
  const recipe = recipeById(c.recipe);
  const order = { id: s.nextId++, custId: c.id, recipe: recipe.id, steps: recipeSteps(recipe), items: [], extras: [], mistakes: 0, state: 'taken', owner: null, claim: null, t0: s.t, bakeQ: null };
  s.orders.push(order);
  c.orderId = order.id;
  s.registers[c.reg].cust = null;
  c.reg = null;
  const w = freeWaitSpot(s);
  s.waitSpots[w] = c.id;
  c.wait = w;
  c.state = 'wait';
  c.patience = WAIT_PATIENCE * (1 + 0.06 * s.decor);
  c.maxPatience = c.patience;
  c.path = [{ ...LAYOUT.wait[w] }];
  c.faceEnd = FACE_COUNTER;
  emit(s, { type: 'order', id: order.id, custId: c.id, by, recipe: order.recipe });
  return true;
}

/** A customer gave up: their pizza goes to the next customer who ordered the same, or is thrown away. */
function dropOrder(s, order) {
  const other = s.orders.find((o) => o !== order && o.state === 'taken' && o.recipe === order.recipe && o.claim == null);
  if (other && order.state !== 'taken') {
    order.custId = other.custId;
    order.t0 = Math.min(order.t0, other.t0);
    const oc = custById(s, other.custId);
    if (oc) oc.orderId = order.id;
    s.orders.splice(s.orders.indexOf(other), 1);
    return;
  }
  if (s.prep?.orderId === order.id) s.prep = null;
  for (const ov of s.ovens) if (ov.orderId === order.id || ov.reserved === order.id) Object.assign(ov, { orderId: null, t: 0, owner: null, reserved: null });
  for (const m of s.staff) {
    if (m.holding === order.id) m.holding = null;
    if (m.task?.orderId === order.id) m.task = null;
  }
  if (order.state !== 'taken') emit(s, { type: 'waste', id: order.id });
  s.orders.splice(s.orders.indexOf(order), 1);
}

function pay(s, c, order) {
  const recipe = recipeById(order.recipe);
  const missing = order.steps.filter((x) => !order.items.includes(x)).length;
  const acc = clamp(1 - 0.25 * order.mistakes - 0.4 * missing, 0, 1);
  const wait = s.t - order.t0;
  const sp = clamp(1 - (wait - 22) / 60, 0, 1);
  const q = order.bakeQ || 'ok';
  const price = Math.round(recipe.price * BAKE_PAY[q]);
  const tip = Math.max(0, Math.round(recipe.price * (0.08 + 0.22 * sp) * acc * BAKE_TIP[q] * (1 + 0.08 * s.decor)));
  const score = 0.4 * acc + 0.3 * BAKE_SCORE[q] + 0.3 * sp;
  const hearts = score >= 0.78 ? 3 : score >= 0.5 ? 2 : 1;
  c.hearts = hearts;
  s.coins += price + tip;
  const R = s.report;
  R.served += 1;
  R.revenue += price;
  R.tips += tip;
  R.hearts += hearts;
  R.mistakes += order.mistakes + missing;
  if (q === 'perfect') R.perfect += 1;
  if (q === 'burnt') R.burnt += 1;
  emit(s, { type: 'pay', custId: c.id, amount: price + tip, price, tip, hearts, quality: q, x: c.x, z: c.z });
  s.orders.splice(s.orders.indexOf(order), 1);
  c.orderId = null;
  // Sit down and eat, or take it home
  const t = s.tables.find((tb) => !tb.cust && !tb.dirty);
  if (t && s.phase === 'open' && s.random() < 0.7) {
    t.cust = c.id;
    c.table = t.i;
    c.seat = s.random() < 0.5 ? -1 : 1;
    c.state = 'toTable';
    c.dinePrice = recipe.price;
    c.path = [{ x: t.x + c.seat * 0.72, z: t.z + 0.05 }];
    c.faceEnd = yawTo(-c.seat, 0);
  } else leave(s, c, 'happy');
}

// ---------------------------------------------------------------- player actions
function chefGo(s, to, face, cue) {
  walkTo(s.chef, to, face);
  s.chef.cue = cue;
  s.chef.cueT = 0;
}

/** Take the order of the customer waiting at register `r` (the child taps "Nhận order"). */
export function takeOrder(s, r = null, by = 'player') {
  const regs = r == null ? s.registers : [s.registers[r]].filter(Boolean);
  for (const reg of regs) {
    const c = custById(s, reg.cust);
    if (c && c.state === 'order') {
      if (by === 'player') chefGo(s, regStand(reg.i), FACE_BACK, 'talk');
      return takeOrderFor(s, c, by);
    }
  }
  return false;
}

/** Order the child's prep table is working on next (the oldest one nobody has started). */
export const nextPrepOrder = (s) => s.orders.find((o) => o.state === 'taken' && o.claim == null) || null;

/** Tap an ingredient. The first tap must be the dough; wrong or repeated toppings count as mistakes. */
export function prepAdd(s, item) {
  if (!INGREDIENTS[item]) return false;
  if (!s.prep) {
    if (item !== 'dough') {
      emit(s, { type: 'hint', hint: 'dough' });
      return false;
    }
    const o = nextPrepOrder(s);
    if (!o) {
      emit(s, { type: 'hint', hint: 'noOrder' });
      return false;
    }
    o.state = 'prep';
    o.owner = 'player';
    o.claim = 'player';
    s.prep = { orderId: o.id };
  }
  const o = orderById(s, s.prep.orderId);
  if (!o) {
    s.prep = null;
    return false;
  }
  let ok = true;
  if (o.items.includes(item) || !o.steps.includes(item)) {
    ok = false;
    o.mistakes += 1;
    if (!o.items.includes(item)) o.extras.push(item);
  } else o.items.push(item);
  chefGo(s, prepStand(0), FACE_FRONT, 'make');
  emit(s, { type: 'add', id: o.id, item, ok, done: o.steps.every((x) => o.items.includes(x)) });
  return ok;
}

/** Next ingredient the recipe wants (for the glowing hint), or null when complete. */
export function nextItem(order) {
  return order ? order.steps.find((x) => !order.items.includes(x)) || null : null;
}

const freeOven = (s) => s.ovens.find((o) => o.orderId == null && o.reserved == null) || null;

/** Put the child's pizza into a free oven. */
export function prepToOven(s) {
  const o = s.prep && orderById(s, s.prep.orderId);
  if (!o || !o.items.includes('dough')) return false;
  const ov = freeOven(s);
  if (!ov) {
    emit(s, { type: 'hint', hint: 'ovenFull' });
    return false;
  }
  Object.assign(ov, { orderId: o.id, t: 0, owner: 'player' });
  o.state = 'oven';
  o.claim = null;
  s.prep = null;
  chefGo(s, ovenStand(ov.i), Math.PI / 2, 'oven');
  emit(s, { type: 'oven', id: o.id, oven: ov.i });
  return true;
}

function takeOut(s, ov, by) {
  const o = orderById(s, ov.orderId);
  if (!o) return false;
  const p = ov.t / s.bake;
  o.bakeQ = bakeZone(p);
  o.state = 'out';
  o.claim = null;
  Object.assign(ov, { orderId: null, t: 0, owner: null });
  emit(s, { type: 'take', id: o.id, oven: ov.i, quality: o.bakeQ, by });
  return true;
}

/** Take a pizza out of oven i (any pizza, also the staff's). */
export function ovenTake(s, i) {
  const ov = s.ovens[i];
  if (!ov || ov.orderId == null) return false;
  chefGo(s, ovenStand(i), Math.PI / 2, 'oven');
  return takeOut(s, ov, 'player');
}

function doBox(s, o, by) {
  if (!o || o.state !== 'out') return false;
  o.state = 'boxed';
  o.claim = null;
  emit(s, { type: 'box', id: o.id, by });
  return true;
}
export function boxPizza(s, id) {
  const o = id == null ? s.orders.find((x) => x.state === 'out') : orderById(s, id);
  if (!o || o.state !== 'out') return false;
  chefGo(s, passStand(), FACE_BACK, 'box');
  return doBox(s, o, 'player');
}

function doServe(s, o, by) {
  if (!o || o.state !== 'boxed') return false;
  const c = custById(s, o.custId);
  if (!c || c.state !== 'wait') return false;
  o.state = 'served';
  o.claim = null;
  if (c.wait != null) s.waitSpots[c.wait] = null;
  c.wait = null;
  c.state = 'pickup';
  c.path = [{ x: pickupSpot().x + (s.random() - 0.5) * 0.5, z: pickupSpot().z }];
  c.faceEnd = FACE_COUNTER;
  emit(s, { type: 'serve', id: o.id, custId: c.id, by });
  return true;
}
export function servePizza(s, id) {
  const o = id == null ? s.orders.find((x) => x.state === 'boxed' && custById(s, x.custId)?.state === 'wait') : orderById(s, id);
  if (!o) return false;
  const ok = doServe(s, o, 'player');
  if (ok) chefGo(s, passStand(), FACE_BACK, 'serve');
  return ok;
}

function doCollect(s, by) {
  if (s.coins <= 0) return 0;
  const amount = s.coins;
  s.money += amount;
  s.coins = 0;
  emit(s, { type: 'collect', amount, by });
  return amount;
}
/** "Thu tiền": coins on the counter fly into the register. */
export function collectCoins(s) {
  if (s.coins <= 0) return 0;
  chefGo(s, regStand(0), FACE_BACK, 'cash');
  return doCollect(s, 'player');
}

function doClean(s, t, by) {
  if (!t || !t.dirty) return false;
  t.dirty = false;
  emit(s, { type: 'clean', table: t.i, by });
  return true;
}
export function cleanTable(s, i) {
  const t = i == null ? s.tables.find((x) => x.dirty) : s.tables[i];
  if (!t || !t.dirty) return false;
  chefGo(s, tableStand(t), FACE_BACK, 'clean');
  return doClean(s, t, 'player');
}

/** One dispatcher for the UI and the bots: { type, arg }. */
export function act(s, a) {
  if (!a || s.phase === 'done') return false;
  switch (a.type) {
    case 'take':
      return takeOrder(s, a.arg ?? null);
    case 'add':
      return prepAdd(s, a.arg);
    case 'oven':
      return prepToOven(s);
    case 'out':
      return ovenTake(s, a.arg);
    case 'box':
      return boxPizza(s, a.arg ?? null);
    case 'serve':
      return servePizza(s, a.arg ?? null);
    case 'collect':
      return collectCoins(s) > 0;
    case 'clean':
      return cleanTable(s, a.arg ?? null);
    default:
      return false;
  }
}

// ---------------------------------------------------------------- staff automation
function staffStep(s, m, dt) {
  const k = speedOf(m.level);
  if (m.path.length) {
    moveAlong(m, SPEED.staff * (0.9 + 0.1 * k), dt);
    return;
  }
  m.walking = false;
  if (m.task) {
    m.task.t += dt * k;
    runTask(s, m);
    return;
  }
  if (m.role === 'cashier') cashierThink(s, m);
  else if (m.role === 'chef') chefThink(s, m);
  else waiterThink(s, m);
}

function setTask(m, task, to, face) {
  m.task = { t: 0, ...task };
  if (to && dist(m, to) > 0.05) walkTo(m, to, face);
  else if (face != null) m.face = face;
  m.cue = task.type;
  m.cueT = 0;
}

function cashierThink(s, m) {
  const reg = s.registers[m.reg];
  const c = reg && custById(s, reg.cust);
  if (c && c.state === 'order') return setTask(m, { type: 'take', dur: 2.6, custId: c.id }, regStand(m.reg), FACE_BACK);
  if (s.coins > 0 && staffOn(s, 'cashier')[0] === m) return setTask(m, { type: 'collect', dur: 0.8 }, regStand(m.reg), FACE_BACK);
  if (dist(m, regStand(m.reg)) > 0.05) walkTo(m, regStand(m.reg), FACE_BACK);
  return undefined;
}

/** Two cooks share the second prep table side by side. */
function chefStand(s, m) {
  const chefs = staffOn(s, 'chef');
  const p = prepStand(1);
  return chefs.length > 1 ? { x: p.x + (chefs.indexOf(m) ? 0.45 : -0.45), z: p.z } : p;
}

function chefThink(s, m) {
  const mine = s.ovens.find((ov) => ov.owner === m.id && ov.orderId != null && ov.t / s.bake >= 0.6);
  if (mine) {
    const r = s.random();
    const good = r < 0.55 + 0.09 * (m.level - 1);
    const takeAt = good ? 1.06 + s.random() * 0.2 : 1.45 + s.random() * 0.25;
    return setTask(m, { type: 'take', dur: Infinity, oven: mine.i, orderId: mine.orderId, takeAt }, ovenStand(mine.i), Math.PI / 2);
  }
  if (m.holding != null) {
    const ov = freeOven(s);
    if (ov) {
      ov.owner = m.id; // reserved
      ov.reserved = m.holding;
      return setTask(m, { type: 'load', dur: 0.4, oven: ov.i, orderId: m.holding }, ovenStand(ov.i), Math.PI / 2);
    }
  }
  const out = s.orders.find((o) => o.state === 'out' && o.claim == null && (o.owner === m.id || !staffOn(s, 'waiter').length));
  if (out) {
    out.claim = m.id;
    return setTask(m, { type: 'box', dur: 1.3, orderId: out.id }, passStand(), FACE_BACK);
  }
  if (m.holding == null) {
    const o = s.orders.find((x) => x.state === 'taken' && x.claim == null);
    if (o) {
      o.claim = m.id;
      o.owner = m.id;
      o.state = 'prep';
      return setTask(m, { type: 'build', dur: 0.5 + o.steps.length * 1.45, orderId: o.id }, chefStand(s, m), FACE_FRONT);
    }
  }
  if (m.holding == null && dist(m, chefStand(s, m)) > 1.2) walkTo(m, chefStand(s, m), FACE_FRONT);
  return undefined;
}

function waiterThink(s, m) {
  const boxed = s.orders.find((o) => o.state === 'boxed' && o.claim == null && custById(s, o.custId)?.state === 'wait');
  if (boxed) {
    boxed.claim = m.id;
    return setTask(m, { type: 'serve', dur: 1.0, orderId: boxed.id }, passStand(), FACE_BACK);
  }
  const out = s.orders.find((o) => o.state === 'out' && o.claim == null);
  if (out) {
    out.claim = m.id;
    return setTask(m, { type: 'box', dur: 1.3, orderId: out.id }, passStand(), FACE_BACK);
  }
  const t = s.tables.find((x) => x.dirty && x.claim == null);
  if (t) {
    t.claim = m.id;
    return setTask(m, { type: 'clean', dur: 2.4, table: t.i }, tableStand(t), FACE_BACK);
  }
  const home = { x: passStand().x - 0.55, z: passStand().z };
  if (dist(m, home) > 1.5) walkTo(m, home, FACE_BACK);
  return undefined;
}

function runTask(s, m) {
  const T = m.task;
  const o = T.orderId != null ? orderById(s, T.orderId) : null;
  const done = T.t >= T.dur;
  switch (T.type) {
    case 'take': {
      if (m.role === 'cashier') {
        if (done) {
          const c = custById(s, T.custId);
          takeOrderFor(s, c, m.id);
          m.task = null;
        } else if (custById(s, T.custId)?.state !== 'order') m.task = null;
        return;
      }
      const ov = s.ovens[T.oven];
      if (!ov || ov.orderId !== T.orderId) {
        m.task = null;
        return;
      }
      if (ov.t / s.bake >= T.takeAt) {
        takeOut(s, ov, m.id);
        m.task = null;
        const oo = orderById(s, T.orderId);
        if (oo && (!staffOn(s, 'waiter').length || oo.owner === m.id) && oo.claim == null) {
          oo.claim = m.id;
          setTask(m, { type: 'box', dur: 1.3, orderId: oo.id }, passStand(), FACE_BACK);
        }
      }
      return;
    }
    case 'collect':
      if (done) {
        doCollect(s, m.id);
        m.task = null;
      }
      return;
    case 'build':
      if (!o || o.claim !== m.id) {
        m.task = null;
        return;
      }
      // ingredients appear one by one
      {
        const n = Math.min(o.steps.length, Math.floor(((T.t - 0.5) / (T.dur - 0.5)) * o.steps.length + 1));
        while (o.items.length < n) {
          const it = o.steps[o.items.length];
          o.items.push(it);
          emit(s, { type: 'add', id: o.id, item: it, ok: true, by: m.id, done: o.items.length === o.steps.length });
        }
      }
      if (done) {
        o.state = 'built';
        m.holding = o.id;
        m.task = null;
      }
      return;
    case 'load': {
      const ov = s.ovens[T.oven];
      if (!o || !ov || (ov.orderId != null && ov.orderId !== o.id)) {
        if (ov && ov.reserved === T.orderId) Object.assign(ov, { owner: null, reserved: null });
        m.task = null;
        return;
      }
      if (done) {
        Object.assign(ov, { orderId: o.id, t: 0, owner: m.id, reserved: null });
        o.state = 'oven';
        o.claim = null;
        m.holding = null;
        m.task = null;
        emit(s, { type: 'oven', id: o.id, oven: ov.i, by: m.id });
      }
      return;
    }
    case 'box':
      if (!o || o.state !== 'out' || o.claim !== m.id) {
        if (o && o.claim === m.id) o.claim = null;
        m.task = null;
        return;
      }
      if (done) {
        doBox(s, o, m.id);
        m.task = null;
      }
      return;
    case 'serve':
      if (!o || o.state !== 'boxed' || o.claim !== m.id) {
        if (o && o.claim === m.id) o.claim = null;
        m.task = null;
        return;
      }
      if (done) {
        if (!doServe(s, o, m.id)) o.claim = null;
        m.task = null;
      }
      return;
    case 'clean': {
      const t = s.tables[T.table];
      if (!t || !t.dirty) {
        if (t) t.claim = null;
        m.task = null;
        return;
      }
      if (done) {
        doClean(s, t, m.id);
        t.claim = null;
        m.task = null;
      }
      return;
    }
    default:
      m.task = null;
  }
}

// ---------------------------------------------------------------- customers
function customerStep(s, c, dt) {
  moveAlong(c, SPEED.customer, dt);
  const arrived = !c.path.length;
  switch (c.state) {
    case 'line':
    case 'toReg':
      c.patience -= dt;
      if (c.state === 'toReg' && arrived) {
        c.state = 'order';
        emit(s, { type: 'ready', id: c.id });
      }
      break;
    case 'order':
      c.patience -= dt;
      break;
    case 'wait':
      c.patience -= dt * 0.8;
      break;
    case 'pickup':
      if (arrived) {
        const o = orderById(s, c.orderId);
        c.carry = true;
        if (o) pay(s, c, o);
        else leave(s, c, 'happy');
      }
      break;
    case 'toTable':
      if (arrived) {
        c.state = 'eat';
        c.eatT = EAT_TIME;
      }
      break;
    case 'eat':
      c.eatT -= dt;
      if (c.eatT <= 0) {
        const t = s.tables[c.table];
        if (t) {
          t.dirty = true;
          t.cust = null;
        }
        const amount = Math.round((c.dinePrice || 12) * 0.35 * (1 + 0.05 * s.decor));
        s.money += amount;
        s.report.dine += amount;
        emit(s, { type: 'dine', custId: c.id, amount, table: c.table, x: c.x, z: c.z });
        c.table = null;
        c.carry = false;
        leave(s, c, 'happy');
      }
      break;
    case 'leave':
      if (arrived) c.state = 'gone';
      break;
    default:
  }
  if ((c.state === 'line' || c.state === 'toReg' || c.state === 'order' || c.state === 'wait') && c.patience <= 0) {
    const o = c.orderId != null ? orderById(s, c.orderId) : null;
    if (o) dropOrder(s, o);
    c.orderId = null;
    s.report.lost += 1;
    emit(s, { type: 'angry', id: c.id });
    leave(s, c, 'sad');
  }
}

// ---------------------------------------------------------------- day flow
function closeShop(s) {
  s.phase = 'closing';
  s.closingT = 0;
  for (const c of s.customers) if (c.state === 'line' || c.state === 'toReg' || c.state === 'order') leave(s, c, 'bye');
  emit(s, { type: 'close' });
}

export const starsForDay = (r) => {
  const n = r.served + r.lost;
  if (!r.served || !n) return 0;
  const avg = r.hearts / n;
  return avg >= 2.4 ? 3 : avg >= 1.7 ? 2 : 1;
};
/** App gold for a finished day (5–30), nothing if no pizza was sold. */
export const goldForDay = (r, stars = starsForDay(r)) => (r.served > 0 ? clamp(Math.round(4 + r.served * 0.7 + stars * 3), 5, 30) : 0);

function endDay(s) {
  // Coins left on the counter are counted, unfinished orders are dropped
  if (s.coins > 0) doCollect(s, 'auto');
  const R = s.report;
  const pay = salaries(s.shop);
  const earned = R.revenue + R.tips + R.dine;
  const money = Math.max(0, s.money - pay);
  const paid = s.money - money;
  const stars = starsForDay(R);
  const gold = goldForDay(R, stars);
  const shop = s.shop;
  s.result = { day: s.day, ...R, earned, salaries: paid, profit: earned - paid, stars, gold, money, avgHearts: R.served + R.lost ? R.hearts / (R.served + R.lost) : 0 };
  s.shopAfter = {
    ...shop,
    day: shop.day + 1,
    money,
    rep: clamp(shop.rep * 0.5 + (stars || 1) * 0.5, 0, 3),
    history: [...shop.history, { day: s.day, served: R.served, profit: earned - paid, stars }].slice(-30),
    totals: { served: shop.totals.served + R.served, earned: shop.totals.earned + earned, days: shop.totals.days + 1 },
  };
  s.money = money;
  s.phase = 'done';
  emit(s, { type: 'dayEnd', result: s.result });
}

/** Advance the day by dt seconds. */
export function step(s, dt) {
  if (s.phase === 'done') return s;
  s.t += dt;
  if (s.phase === 'open') {
    if (s.t >= s.dayLen) closeShop(s);
    else {
      s.spawnT -= dt;
      if (s.spawnT <= 0) {
        s.spawnT = (BASE_INTERVAL / s.crowd) * (0.7 + 0.6 * s.random());
        if (s.line.length < s.cap) spawnCustomer(s);
        else emit(s, { type: 'skip' });
      }
    }
  } else if (s.phase === 'closing') s.closingT += dt;

  relayLine(s);
  // Free registers call the next customer in line
  for (const reg of s.registers) {
    if (reg.cust != null || !s.line.length || s.phase !== 'open') continue;
    const c = custById(s, s.line[0]);
    s.line.shift();
    reg.cust = c.id;
    c.reg = reg.i;
    c.state = 'toReg';
    c.path = outdoors(c) ? [{ ...LAYOUT.inside }, regSpot(reg.i)] : [regSpot(reg.i)];
    c.faceEnd = FACE_COUNTER;
    c.spot = -2;
    relayLine(s);
  }
  for (const c of s.customers) customerStep(s, c, dt);
  for (let i = s.customers.length - 1; i >= 0; i--) {
    if (s.customers[i].state === 'gone') {
      emit(s, { type: 'gone', id: s.customers[i].id });
      s.customers.splice(i, 1);
    }
  }
  for (const ov of s.ovens) if (ov.orderId != null) ov.t += dt;
  for (const m of s.staff) {
    m.cueT += dt;
    staffStep(s, m, dt);
  }
  s.chef.cueT += dt;
  moveAlong(s.chef, SPEED.player, dt);

  if (s.phase === 'closing') {
    const busy = s.customers.some((c) => c.state !== 'leave');
    if (!busy || s.closingT >= CLOSING_MAX) endDay(s);
  }
  return s;
}

// ---------------------------------------------------------------- HUD snapshot
export function snap(s) {
  const cust = (id) => custById(s, id);
  const prepO = s.prep ? orderById(s, s.prep.orderId) : null;
  return {
    day: s.day,
    phase: s.phase,
    t: s.t,
    timeLeft: Math.max(0, s.dayLen - s.t),
    money: s.money,
    coins: s.coins,
    served: s.report.served,
    lost: s.report.lost,
    hearts: s.report.hearts,
    regs: s.registers.map((r) => {
      const c = cust(r.cust);
      return { i: r.i, ready: !!c && c.state === 'order', look: c?.look || null, recipe: c?.recipe || null, patience: c ? c.patience / c.maxPatience : 1, staffed: s.staff.some((m) => m.role === 'cashier' && m.reg === r.i) };
    }),
    orders: s.orders
      .filter((o) => o.state !== 'served')
      .map((o) => {
        const c = cust(o.custId);
        return { id: o.id, recipe: o.recipe, state: o.state, owner: o.owner === 'player' ? 'player' : o.owner != null ? 'staff' : null, look: c?.look || null, patience: c ? c.patience / c.maxPatience : 1, waiting: c?.state === 'wait' };
      }),
    prep: prepO ? { orderId: prepO.id, recipe: prepO.recipe, steps: prepO.steps, items: [...prepO.items], extras: [...prepO.extras], mistakes: prepO.mistakes, next: nextItem(prepO) } : null,
    nextOrder: nextPrepOrder(s)?.recipe || null,
    ovens: s.ovens.map((ov) => ({ i: ov.i, orderId: ov.orderId, p: ov.orderId != null ? ov.t / s.bake : 0, zone: ov.orderId != null ? bakeZone(ov.t / s.bake) : null, owner: ov.owner === 'player' ? 'player' : ov.owner != null ? 'staff' : null, recipe: ov.orderId != null ? orderById(s, ov.orderId)?.recipe : null })),
    pass: s.orders.filter((o) => o.state === 'out' || o.state === 'boxed').map((o) => ({ id: o.id, state: o.state, recipe: o.recipe, quality: o.bakeQ, claimed: o.claim != null, canServe: o.state === 'boxed' && cust(o.custId)?.state === 'wait' })),
    dirty: s.tables.filter((t) => t.dirty).map((t) => t.i),
    toppings: s.toppings,
    staff: { cashier: staffOn(s, 'cashier').length, chef: staffOn(s, 'chef').length, waiter: staffOn(s, 'waiter').length },
    result: s.result,
  };
}

/** The action the child should do next (for the glowing hint), like the bot would. */
export function suggest(s) {
  return playerBot(s, { kid: true });
}

// ---------------------------------------------------------------- bots
/** A good player: takes perfect pizzas out, serves, builds correctly, takes orders, collects. */
export function playerBot(s, { kid = false } = {}) {
  for (const ov of s.ovens) {
    if (ov.orderId == null) continue;
    const p = ov.t / s.bake;
    if (p >= BAKE_ZONES.perfect + 0.04 && p < BAKE_ZONES.burnt) return { type: 'out', arg: ov.i };
  }
  const canServe = s.orders.find((o) => o.state === 'boxed' && o.claim == null && custById(s, o.custId)?.state === 'wait');
  if (canServe) return { type: 'serve', arg: canServe.id };
  const out = s.orders.find((o) => o.state === 'out' && o.claim == null);
  if (out) return { type: 'box', arg: out.id };
  const prepO = s.prep && orderById(s, s.prep.orderId);
  if (prepO) {
    const nx = nextItem(prepO);
    if (nx) return { type: 'add', arg: nx };
    if (freeOven(s)) return { type: 'oven' };
  }
  const reg = s.registers.find((r) => {
    const c = custById(s, r.cust);
    return c && c.state === 'order' && !s.staff.some((m) => m.role === 'cashier' && m.reg === r.i);
  });
  if (reg) return { type: 'take', arg: reg.i };
  if (!prepO && nextPrepOrder(s) && (freeOven(s) || kid)) return { type: 'add', arg: 'dough' };
  if (s.coins > 0) return { type: 'collect' };
  const dirty = s.tables.find((t) => t.dirty && t.claim == null);
  if (dirty) return { type: 'clean', arg: dirty.i };
  return null;
}

/** A sensible order of purchases for the shop bot. */
export const BOT_PLAN = ['menu:mushroom', 'up:oven', 'up:lights', 'up:tables', 'up:oven2', 'menu:veggie', 'up:plants', 'hire:chef', 'up:register2', 'up:tables', 'up:posters', 'up:oven', 'menu:hawaii', 'hire:waiter', 'up:sign', 'up:expand', 'hire:cashier', 'menu:oran', 'up:tables', 'up:oven', 'menu:special', 'up:tables', 'hire:chef', 'up:tables', 'up:tables'];

/** Shop bot: follows BOT_PLAN (saving up for the next thing), then levels staff, keeping a reserve for salaries. */
export function shopBot(shop, { random = Math.random, plan = BOT_PLAN } = {}) {
  let cur = shop;
  const bought = [];
  const counts = {};
  const planned = plan.filter((k) => {
    counts[k] = (counts[k] || 0) + 1;
    const [tab, id] = k.split(':');
    if (tab === 'up') return (cur.up[id] || 0) < counts[k];
    if (tab === 'menu') return !cur.recipes.includes(id);
    return cur.staff.filter((m) => m.role === id).length < counts[k];
  });
  for (let guard = 0; guard < 12; guard++) {
    const reserve = salaries(cur) + 40;
    const items = shopItems(cur);
    let key = planned.find((k) => {
      const it = items.find((i) => i.key === k);
      return it && !it.owned && !it.locked && it.cost != null;
    });
    if (!key) {
      const lv = items.filter((i) => i.key.startsWith('level:') && !i.owned).sort((x, y) => x.cost - y.cost)[0];
      key = lv?.key;
    }
    if (!key) break;
    const it = items.find((i) => i.key === key);
    if (cur.money - it.cost < reserve) break;
    const r = buy(cur, key, { random });
    if (!r.ok) break;
    cur = r.shop;
    bought.push(key);
    planned.splice(planned.indexOf(key), 1);
  }
  return { shop: cur, bought };
}

/** Run one whole day with an optional player bot acting every `react` seconds. */
export function simulateDay(shop, { random = Math.random, bot = true, react = 0.6, dayLen = DAY_LEN, visitors = [] } = {}) {
  const s = createPizza3D({ shop, random, dayLen, visitors });
  let cd = 0;
  for (let i = 0; i < 20000 && s.phase !== 'done'; i++) {
    if (bot) {
      cd -= DT;
      if (cd <= 0) {
        const a = playerBot(s);
        if (a) {
          act(s, a);
          cd = react;
        }
      }
    }
    step(s, DT);
    s.events.length = 0;
  }
  return s;
}

