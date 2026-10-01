import { describe, it, expect, beforeEach } from 'vitest';
import { seeded } from '../../test/seeded';
import {
  createPizza3D,
  step,
  act,
  snap,
  DT,
  DAY_LEN,
  newShop,
  buy,
  shopItems,
  simulateDay,
  shopBot,
  playerBot,
  bakeZone,
  bakeTime,
  takeOrder,
  prepAdd,
  prepToOven,
  ovenTake,
  boxPizza,
  servePizza,
  collectCoins,
  cleanTable,
  goldForDay,
  starsForDay,
  crowdOf,
  salaries,
  route,
  LAYOUT,
  speciesOf,
  cleanShop,
} from './pizza3d';
import { loadPizza3d, savePizza3d, resetPizza3d, PIZZA3D_KEY } from './pizza3dStore';

const run = (s, sec, onTick) => {
  for (let i = 0; i < Math.round(sec / DT) && s.phase !== 'done'; i++) {
    onTick?.(s);
    step(s, DT);
  }
  return s;
};
const types = (s) => s.events.map((e) => e.type);
function runUntil(s, pred, max = 60) {
  for (let i = 0; i < max / DT && !pred(s) && s.phase !== 'done'; i++) step(s, DT);
  return pred(s);
}

describe('pizza3d engine', () => {
  beforeEach(() => localStorage.removeItem(PIZZA3D_KEY));

  it('PIZ-E01 customers walk in, queue and wait at the register with an order', () => {
    const s = createPizza3D({ random: seeded(1) });
    expect(runUntil(s, (x) => x.customers.length >= 1, 10)).toBe(true);
    const c = s.customers[0];
    expect(c.x).toBeGreaterThan(LAYOUT.inside.x); // starts outside the door
    expect(runUntil(s, (x) => x.customers[0].state === 'order', 20)).toBe(true);
    expect(Math.abs(c.x - LAYOUT.registers[0].x)).toBeLessThan(0.01);
    expect(Math.abs(c.z - LAYOUT.custZ)).toBeLessThan(0.01);
    expect(['cheese', 'sausage']).toContain(c.recipe);
    const h = snap(s);
    expect(h.regs[0].ready).toBe(true);
    expect(h.regs[0].look.name).toBeTruthy();
  });

  it('PIZ-E02 the full loop by hand: order → dough, sauce, cheese, toppings → oven → perfect → box → serve → coins → collect', () => {
    const s = createPizza3D({ random: seeded(2) });
    runUntil(s, (x) => x.customers[0]?.state === 'order', 30);
    const c = s.customers[0];
    expect(takeOrder(s)).toBe(true);
    const o = s.orders[0];
    expect(o.state).toBe('taken');
    expect(c.state).toBe('wait');
    expect(prepAdd(s, 'cheese')).toBe(false); // must start with the dough
    expect(types(s)).toContain('hint');
    for (const it of o.steps) expect(prepAdd(s, it)).toBe(true);
    expect(snap(s).prep.next).toBe(null);
    expect(prepToOven(s)).toBe(true);
    expect(o.state).toBe('oven');
    run(s, bakeTime(s.shop) * 1.15);
    expect(snap(s).ovens[0].zone).toBe('perfect');
    expect(ovenTake(s, 0)).toBe(true);
    expect(o.bakeQ).toBe('perfect');
    expect(servePizza(s, o.id)).toBe(false); // box first
    expect(boxPizza(s, o.id)).toBe(true);
    expect(servePizza(s, o.id)).toBe(true);
    s.events.length = 0;
    runUntil(s, (x) => x.coins > 0, 20);
    const pay = s.events.find((e) => e.type === 'pay');
    expect(pay.hearts).toBe(3);
    expect(pay.tip).toBeGreaterThan(0);
    expect(pay.amount).toBe(pay.price + pay.tip);
    const before = s.money;
    expect(collectCoins(s)).toBe(pay.amount);
    expect(s.money).toBe(before + pay.amount);
    expect(s.coins).toBe(0);
    expect(s.report.served).toBe(1);
    expect(s.report.perfect).toBe(1);
  });

  it('PIZ-E03 mistakes and burnt pizzas lower the tip and the hearts; oven zones', () => {
    expect(bakeZone(0.5)).toBe('raw');
    expect(bakeZone(0.95)).toBe('ok');
    expect(bakeZone(1.2)).toBe('perfect');
    expect(bakeZone(1.6)).toBe('ok');
    expect(bakeZone(2.0)).toBe('burnt');
    const play = (bad) => {
      const s = createPizza3D({ random: seeded(5) });
      runUntil(s, (x) => x.customers[0]?.state === 'order', 30);
      takeOrder(s);
      const o = s.orders[0];
      prepAdd(s, 'dough');
      if (bad) {
        prepAdd(s, 'oran'); // not on this pizza
        prepAdd(s, 'dough'); // twice
      } else o.steps.slice(1).forEach((it) => prepAdd(s, it));
      prepToOven(s);
      run(s, bakeTime(s.shop) * (bad ? 2.2 : 1.1));
      ovenTake(s, 0);
      boxPizza(s);
      servePizza(s);
      s.events.length = 0;
      runUntil(s, (x) => x.coins > 0, 20);
      return s.events.find((e) => e.type === 'pay');
    };
    const good = play(false);
    const bad = play(true);
    expect(good.quality).toBe('perfect');
    expect(bad.quality).toBe('burnt');
    expect(bad.tip).toBeLessThan(good.tip);
    expect(bad.price).toBeLessThan(good.price);
    expect(bad.hearts).toBeLessThan(good.hearts);
  });

  it('PIZ-E04 impatient customers leave sad after a long wait; their order is dropped', () => {
    const s = createPizza3D({ random: seeded(3), dayLen: 400 });
    runUntil(s, (x) => x.customers[0]?.state === 'order', 30);
    takeOrder(s);
    s.events.length = 0;
    const id = s.customers[0].id;
    let angry = false;
    run(s, 200, (x) => {
      if (x.events.some((e) => e.type === 'angry' && e.id === id)) angry = true;
      x.events.length = 0;
    });
    expect(angry).toBe(true);
    expect(s.report.lost).toBeGreaterThan(0);
    expect(s.orders.find((o) => o.custId === id)).toBeUndefined();
  });

  it('PIZ-E05 the day ends after 3 minutes with a report; salaries are paid; stars and gold', () => {
    expect(DAY_LEN).toBe(180);
    const s = simulateDay(newShop(), { random: seeded(7) });
    expect(s.phase).toBe('done');
    const r = s.result;
    expect(r.served).toBeGreaterThan(5);
    expect(r.revenue).toBeGreaterThan(0);
    expect(r.tips).toBeGreaterThan(0);
    expect(r.stars).toBeGreaterThanOrEqual(2);
    expect(r.gold).toBeGreaterThanOrEqual(5);
    expect(r.gold).toBeLessThanOrEqual(30);
    expect(s.shopAfter.day).toBe(2);
    expect(s.shopAfter.money).toBe(newShop().money + r.earned);
    expect(goldForDay({ served: 0, lost: 0, hearts: 0 })).toBe(0);
    expect(starsForDay({ served: 10, lost: 0, hearts: 30 })).toBe(3);
    // with staff, salaries are taken at the end of the day
    let shop = { ...newShop(), money: 1000 };
    shop = buy(shop, 'hire:chef', { random: seeded(1) }).shop;
    expect(salaries(shop)).toBe(38);
    const s2 = simulateDay(shop, { random: seeded(8) });
    expect(s2.result.salaries).toBe(38);
    expect(s2.shopAfter.money).toBe(shop.money + s2.result.earned - 38);
  });

  it('PIZ-E06 staff run the shop: cashier takes orders, chef bakes, waiter serves and cleans', () => {
    let shop = { ...newShop(), money: 2000 };
    for (const k of ['up:tables', 'hire:cashier', 'hire:chef', 'hire:waiter']) {
      const r = buy(shop, k, { random: seeded(4), playerSpecies: 'pikachu' });
      expect(r.ok).toBe(true);
      shop = r.shop;
    }
    expect(shop.staff.map((m) => m.role)).toEqual(['cashier', 'chef', 'waiter']);
    expect(shop.staff.some((m) => m.species === 'pikachu')).toBe(false);
    const s = createPizza3D({ shop, random: seeded(9) });
    const by = { order: new Set(), oven: new Set(), box: new Set(), serve: new Set(), clean: new Set(), collect: new Set() };
    run(s, 400, (x) => {
      for (const e of x.events) if (by[e.type]) by[e.type].add(e.by);
      x.events.length = 0;
    });
    expect(s.phase).toBe('done');
    const staffIds = shop.staff.map((m) => m.id);
    expect([...by.order].every((b) => staffIds.includes(b))).toBe(true);
    expect(by.oven.has(shop.staff[1].id)).toBe(true);
    expect(by.serve.has(shop.staff[2].id)).toBe(true);
    expect(by.collect.has(shop.staff[0].id)).toBe(true);
    expect(by.clean.has(shop.staff[2].id)).toBe(true);
    expect(s.result.served).toBeGreaterThan(5);
    expect(s.result.profit).toBeGreaterThan(0);
  });

  it('PIZ-E07 shop: upgrades change the shop, locks, recipes grow the menu and toppings', () => {
    let shop = { ...newShop(), money: 5000 };
    expect(bakeTime(shop)).toBe(8.5);
    shop = buy(shop, 'up:oven').shop;
    expect(bakeTime(shop)).toBe(7);
    expect(buy(shop, 'up:tables').ok).toBe(true);
    shop = buy(buy(shop, 'up:tables').shop, 'up:tables').shop;
    const t3 = buy(shop, 'up:tables');
    expect(t3.ok).toBe(false);
    expect(t3.reason).toBe('locked');
    expect(buy(shop, 'menu:special').reason).toBe('locked');
    expect(buy(shop, 'hire:cashier').ok).toBe(true);
    const c1 = buy(shop, 'hire:cashier').shop;
    expect(buy(c1, 'hire:cashier').reason).toBe('locked');
    const poor = { ...newShop(), money: 10 };
    expect(buy(poor, 'up:oven').reason).toBe('money');
    const c0 = crowdOf(shop);
    shop = buy(shop, 'up:posters').shop;
    expect(crowdOf(shop)).toBeGreaterThan(c0);
    shop = buy(shop, 'menu:hawaii').shop;
    const s = createPizza3D({ shop, random: seeded(1) });
    expect(s.toppings).toEqual(expect.arrayContaining(['sausage', 'pineapple']));
    expect(s.tables.length).toBe(2);
    shop = buy(shop, 'up:expand').shop;
    expect(buy(shop, 'up:tables').ok).toBe(true);
    expect(buy(shop, 'menu:special').ok).toBe(true);
    expect(shopItems(shop).find((i) => i.key === 'up:expand').owned).toBe(true);
    // staff level up costs and raises salary
    shop = buy(shop, 'hire:waiter').shop;
    const m = shop.staff[0];
    const before = salaries(shop);
    shop = buy(shop, `level:${m.id}`).shop;
    expect(shop.staff[0].level).toBe(2);
    expect(salaries(shop)).toBeGreaterThan(before);
  });

  it('PIZ-E08 save/load round trip and reset; broken storage is safe', () => {
    let shop = { ...newShop(), money: 900 };
    shop = buy(shop, 'up:oven').shop;
    shop = buy(shop, 'menu:mushroom').shop;
    shop = buy(shop, 'hire:chef', { random: seeded(2) }).shop;
    shop = { ...shop, day: 4 };
    expect(savePizza3d(shop)).toBe(true);
    const back = loadPizza3d();
    expect(back).toEqual(cleanShop(shop));
    expect(back.day).toBe(4);
    expect(back.up.oven).toBe(1);
    expect(back.recipes).toContain('mushroom');
    expect(back.staff[0].role).toBe('chef');
    localStorage.setItem(PIZZA3D_KEY, '{oops');
    expect(loadPizza3d()).toBe(null);
    localStorage.setItem(PIZZA3D_KEY, JSON.stringify({ day: -3, money: 'x', up: { oven: 99 }, staff: [{ role: 'boss' }] }));
    const fixed = loadPizza3d();
    expect(fixed.day).toBe(1);
    expect(fixed.up.oven).toBe(3);
    expect(fixed.staff).toEqual([]);
    expect(resetPizza3d().day).toBe(1);
    expect(localStorage.getItem(PIZZA3D_KEY)).toBe(null);
  });

  it('PIZ-E10 dine-in: a customer sits at a free table, eats, pays extra and leaves it dirty; the child cleans it', () => {
    let shop = { ...newShop(), money: 500 };
    shop = buy(shop, 'up:tables').shop;
    const s = createPizza3D({ shop, random: () => 0.1 });
    runUntil(s, (x) => x.customers[0]?.state === 'order', 30);
    takeOrder(s);
    const o = s.orders[0];
    o.steps.forEach((it) => prepAdd(s, it));
    prepToOven(s);
    run(s, bakeTime(shop) * 1.1);
    ovenTake(s, 0);
    boxPizza(s);
    servePizza(s);
    expect(runUntil(s, (x) => x.customers[0]?.state === 'eat', 20)).toBe(true);
    expect(s.tables[0].cust).toBe(s.customers[0].id);
    s.events.length = 0;
    expect(runUntil(s, (x) => x.tables[0].dirty, 20)).toBe(true);
    const dine = s.events.find((e) => e.type === 'dine');
    expect(dine.amount).toBeGreaterThan(0);
    expect(s.report.dine).toBe(dine.amount);
    expect(snap(s).dirty).toEqual([0]);
    expect(cleanTable(s)).toBe(true);
    expect(s.tables[0].dirty).toBe(false);
  });

  it('PIZ-E09 routes go round the counter; species from card names', () => {
    const r = route({ x: 0, z: 1 }, { x: -2.8, z: -3 });
    expect(r.length).toBe(3);
    expect(r[0]).toEqual(LAYOUT.gapK);
    expect(route({ x: 0, z: 1 }, { x: -2, z: 1 }).length).toBe(1);
    expect(speciesOf('Pikachu V')).toBe('pikachu');
    expect(speciesOf('Mewtwo')).toBe(null);
  });

  it('PIZ-B01 bot: a good player grows money and buys upgrades and staff over 10 days, never bankrupt', () => {
    const random = seeded(11);
    let shop = newShop();
    const rows = [];
    for (let d = 1; d <= 10; d++) {
      const s = simulateDay(shop, { random });
      const r = s.result;
      const after = shopBot(s.shopAfter, { random });
      rows.push({ day: d, customers: r.customers, served: r.served, lost: r.lost, revenue: r.revenue, tips: r.tips, dine: r.dine, salaries: r.salaries, profit: r.profit, stars: r.stars, gold: r.gold, money: s.shopAfter.money, bought: after.bought.join(',') });
      expect(s.shopAfter.money).toBeGreaterThanOrEqual(0);
      expect(r.profit).toBeGreaterThan(0);
      shop = after.shop;
    }
    for (const r of rows) console.info(`[pizza3d] bot day ${r.day}: khách ${r.customers} (phục vụ ${r.served}, bỏ về ${r.lost}) · doanh thu ${r.revenue} + tip ${r.tips} + tại chỗ ${r.dine} − lương ${r.salaries} = lãi ${r.profit} · ★${r.stars} · gold ${r.gold} · xu ${r.money} · mua: ${r.bought || '-'}`);
    console.info(`[pizza3d] bot final shop: ${JSON.stringify({ up: shop.up, recipes: shop.recipes, staff: shop.staff.map((m) => `${m.role}${m.level}`) })}`);
    const early = rows.slice(0, 3);
    const late = rows.slice(-3);
    const avg = (xs, k) => xs.reduce((n, r) => n + r[k], 0) / xs.length;
    expect(avg(late, 'customers')).toBeGreaterThan(avg(early, 'customers') * 1.3);
    expect(avg(late, 'profit')).toBeGreaterThan(avg(early, 'profit') * 1.5);
    expect(rows.filter((r) => r.bought).length).toBeGreaterThanOrEqual(8); // something new almost every day
    expect(shop.staff.length).toBeGreaterThanOrEqual(1);
    for (const r of rows) {
      expect(r.gold).toBeGreaterThanOrEqual(5);
      expect(r.gold).toBeLessThanOrEqual(30);
    }
  });

  it('PIZ-B02 idle shop: staff hired on day 1 still earn money without the child, but less than playing', () => {
    const random = seeded(12);
    let shop = { ...newShop(), money: 60 + 240 + 360 + 260 };
    for (const k of ['hire:cashier', 'hire:chef', 'hire:waiter']) shop = buy(shop, k, { random }).shop;
    expect(shop.money).toBe(60);
    const idle = [];
    for (let d = 1; d <= 10; d++) {
      const s = simulateDay(shop, { random, bot: false });
      idle.push(s.result);
      shop = s.shopAfter;
    }
    console.info(`[pizza3d] idle staff days: ${idle.map((r) => `d${r.day} ${r.served}khách lãi ${r.profit}`).join(' · ')} · xu ${shop.money}`);
    for (const r of idle) expect(r.profit).toBeGreaterThan(0);
    // The same shop with the child helping earns more per day
    const random2 = seeded(12);
    let helped = { ...newShop(), money: 60 + 240 + 360 + 260 };
    for (const k of ['hire:cashier', 'hire:chef', 'hire:waiter']) helped = buy(helped, k, { random: random2 }).shop;
    const h = simulateDay(helped, { random: random2 }).result;
    const avgIdle = idle.slice(0, 3).reduce((n, r) => n + r.profit, 0) / 3;
    console.info(`[pizza3d] same shop with the child helping: ${h.served} khách, lãi ${h.profit} (idle ${Math.round(avgIdle)})`);
    expect(h.profit).toBeGreaterThan(avgIdle);
    // And the idle shop grows slower than the good player (who also buys upgrades)
    const random3 = seeded(11);
    let p = newShop();
    for (let d = 1; d <= 10; d++) {
      const s = simulateDay(p, { random: random3 });
      p = shopBot(s.shopAfter, { random: random3 }).shop;
    }
    const worth = (x) => x.money + x.totals.earned;
    expect(worth(p)).toBeGreaterThan(worth(shop));
  });

  it('PIZ-B03 a player bot never breaks the engine: no NaN positions, ovens and orders consistent', () => {
    let shop = { ...newShop(), money: 4000 };
    for (const k of ['up:oven2', 'up:register2', 'up:tables', 'up:tables', 'menu:mushroom', 'menu:veggie', 'hire:waiter']) shop = buy(shop, k, { random: seeded(3) }).shop;
    const s = createPizza3D({ shop, random: seeded(13), visitors: [{ name: 'Mewtwo', type: 'Psychic', image: 'x.png' }] });
    let cd = 0;
    run(s, 260, (x) => {
      cd -= DT;
      if (cd <= 0) {
        const a = playerBot(x);
        if (a) act(x, a);
        cd = 0.5;
      }
      for (const c of x.customers) expect(Number.isFinite(c.x + c.z + c.face)).toBe(true);
      for (const ov of x.ovens) if (ov.orderId != null) expect(x.orders.some((o) => o.id === ov.orderId && o.state === 'oven')).toBe(true);
      x.events.length = 0;
    });
    expect(s.phase).toBe('done');
    expect(s.result.served).toBeGreaterThan(8);
    expect(s.result.dine).toBeGreaterThan(0);
  });
});

