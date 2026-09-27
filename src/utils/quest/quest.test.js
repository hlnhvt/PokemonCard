import { describe, it, expect } from 'vitest';
import { ACTS, generateArea, findPath, circleBlocked, TILE, FREE } from './world';
import { tablePlan, apiPlan, nextEvolution, dexOfMember, SPECIES, EVOLUTIONS } from './species';
import { xpToNext, memberStats, MAX_LEVEL } from './progress';
import { rollDrops, rollChest, claimReward, earnReward, GOLD_PER_HOUR, ITEMS } from './items';
import { createQuest, step, enterArea, applyEvolution, applyItem, buyItem, goToTown, travelTo, hudOf, switchLead, setEvolutionPlan, questMember, fighters, expertResult, closeExpert } from './engine';
import { expertsIn, EXPERTS_PER_ACT } from './world';
import { EXPERT_ROSTER } from './experts';
import { koEnemy, makeEnemy } from './combat';
import { grantXp, damageEnemy, damageMember } from './combat';
import { toSave, loadQuest, saveQuest, SAVE_KEY, clearQuest } from './save';
import { seeded } from '../../test/seeded';
import { OPPONENT_POOL } from '../battle/opponentPool';
import { memberFromPool } from '../team/members';

const TEAM = ['Charmander', 'Bulbasaur', 'Squirtle', 'Pikachu', 'Eevee'].map((n) => memberFromPool(OPPONENT_POOL.find((p) => p.name === n)));
const quest = (opts = {}) => createQuest({ team: TEAM, seed: 1234, random: seeded(7), ...opts });
const memStore = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
// Walk straight at a point (stops when it arrives or the area changes)
const walkTo = (s, target, maxSteps = 4000) => {
  const area = s.area;
  for (let i = 0; i < maxSteps && s.area === area && Math.hypot(s.trainer.x - target.x, s.trainer.y - target.y) > 20; i++) {
    const d = { x: target.x - s.trainer.x, y: target.y - s.trainer.y };
    const l = Math.hypot(d.x, d.y);
    step(s, 1 / 30, { move: { x: d.x / l, y: d.y / l } });
  }
};

describe('quest world generation', () => {
  it('QW-01 six acts, each: town, 2 wild areas, a dungeon and a boss lair', () => {
    expect(ACTS).toHaveLength(6);
    for (const a of ACTS) {
      expect(a.areas.map((x) => x.kind)).toEqual(['town', 'wild', 'wild', 'dungeon', 'lair']);
      expect(SPECIES[a.boss.dex]).toBeTruthy();
      for (const d of [...a.enemies, ...a.elites]) expect(SPECIES[d]).toBeTruthy();
    }
    expect(ACTS.map((a) => a.boss.name)).toEqual(['Snorlax', 'Onix', 'Gengar', 'Moltres', 'Articuno', 'Mewtwo']);
  });

  it('QW-02 maps are big, deterministic per seed, and every portal, pack and chest can be reached', () => {
    for (let act = 0; act < ACTS.length; act++) {
      for (let i = 0; i < 5; i++) {
        const a = generateArea(99, act, i);
        const b = generateArea(99, act, i);
        expect(Array.from(a.grid)).toEqual(Array.from(b.grid));
        expect(a.w).toBeGreaterThan(1500);
        expect(circleBlocked(a, a.spawn.x, a.spawn.y, 12)).toBe(false);
        const targets = [...a.exits, ...a.packs, ...a.chests, ...a.experts, ...(a.bossSpawn ? [a.bossSpawn, a.nextActPortal] : [])];
        for (const t of targets) {
          const path = findPath(a, a.spawn, t, 20000);
          expect(path, `${ACTS[act].name}/${a.name} -> ${Math.round(t.x)},${Math.round(t.y)}`).not.toBeNull();
        }
        if (a.kind === 'wild' || a.kind === 'dungeon') {
          expect(a.packs.length).toBeGreaterThanOrEqual(8);
          expect(a.chests.length).toBeGreaterThanOrEqual(2);
          expect(a.exits).toHaveLength(2);
        }
      }
    }
    // Another seed gives another map
    expect(Array.from(generateArea(1, 0, 1).grid)).not.toEqual(Array.from(generateArea(2, 0, 1).grid));
  });

  it('QW-03 the town has the Pokemon Center, the shop, the board and the way out', () => {
    const t = generateArea(5, 0, 0);
    expect(t.spots.map((s) => s.id)).toEqual(['center', 'shop', 'board']);
    for (const s of t.spots) expect(t.grid[Math.floor(s.y / TILE) * t.W + Math.floor(s.x / TILE)]).toBe(FREE);
    expect(t.exits[0].to).toBe(1);
  });
});

describe('quest levels and evolutions', () => {
  it('QL-01 experience grows with the level; stats grow; max level 50', () => {
    for (let l = 1; l < MAX_LEVEL; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
    const lo = memberStats({ level: 5, power: 309, stage: 0 });
    const hi = memberStats({ level: 30, power: 309, stage: 0 });
    expect(hi.maxHp).toBeGreaterThan(lo.maxHp * 3);
    expect(hi.atk).toBeGreaterThan(lo.atk * 3);
    const s = quest();
    const m = s.party[0];
    grantXp(s, m, 10 ** 7);
    expect(m.level).toBe(MAX_LEVEL);
    expect(m.xp).toBe(0);
  });

  it('QL-02 the built-in table: starters at 16 and 32/36, stones as levels, all levels at most 50', () => {
    expect(tablePlan(4).map((st) => [st.name, st.level])).toEqual([['Charmeleon', 16], ['Charizard', 36]]);
    expect(tablePlan(1).map((st) => st.level)).toEqual([16, 32]);
    expect(tablePlan(25)).toMatchObject([{ name: 'Raichu', level: 22 }]);
    expect(tablePlan(133)).toMatchObject([{ name: 'Vaporeon', level: 25, types: ['water'] }]);
    expect(tablePlan(147).map((st) => st.level)).toEqual([30, 45]);
    expect(tablePlan(129)).toMatchObject([{ name: 'Gyarados', level: 20 }]);
    expect(tablePlan(10).map((st) => st.level)).toEqual([7, 10]);
    expect(tablePlan(143)).toEqual([]);
    for (const e of Object.values(EVOLUTIONS)) expect(e.level).toBeLessThanOrEqual(50);
  });

  it('QL-03 PokeAPI chains: levels from the description, stones and friendship get kid levels, branches follow the table', () => {
    const nodes = [
      { name: 'charmander', id: 4, stage: 0, from: null },
      { name: 'charmeleon', id: 5, stage: 1, from: 'charmander', how: 'Đạt cấp 16' },
      { name: 'charizard', id: 6, stage: 2, from: 'charmeleon', how: 'Đạt cấp 36' },
    ];
    expect(apiPlan(nodes, 4).map((st) => [st.to, st.level])).toEqual([[5, 16], [6, 36]]);
    expect(apiPlan(nodes, 5).map((st) => st.to)).toEqual([6]);
    const pika = [{ name: 'pichu', id: 172, stage: 0, from: null }, { name: 'pikachu', id: 25, stage: 1, from: 'pichu', how: 'Rất thân thiết' }, { name: 'raichu', id: 26, stage: 2, from: 'pikachu', how: 'Dùng Đá Sấm' }];
    expect(apiPlan(pika, 25)).toMatchObject([{ to: 26, level: 22, name: 'Raichu' }]);
    const eevee = [{ name: 'eevee', id: 133, stage: 0, from: null }, { name: 'jolteon', id: 135, stage: 1, from: 'eevee', how: 'Dùng Đá Sấm' }, { name: 'vaporeon', id: 134, stage: 1, from: 'eevee', how: 'Dùng Đá Nước' }];
    expect(apiPlan(eevee, 133)).toMatchObject([{ to: 134, level: 25 }]);
    const dratini = [{ name: 'dratini', id: 147, from: null, stage: 0 }, { name: 'dragonair', id: 148, from: 'dratini', stage: 1, how: 'Đạt cấp 30' }, { name: 'dragonite', id: 149, from: 'dragonair', stage: 2, how: 'Đạt cấp 55' }];
    expect(apiPlan(dratini, 147).map((st) => st.level)).toEqual([30, 45]);
    // An unknown line with a stone: a kid level by stage
    const odd = [{ name: 'foo', id: 900, stage: 0, from: null }, { name: 'foo-bar', id: 901, stage: 1, from: 'foo', how: 'Dùng Đá Lửa' }];
    expect(apiPlan(odd, 900)).toMatchObject([{ to: 901, level: 22, name: 'Foo-Bar' }]);
    expect(apiPlan([], 4)).toBeNull();
    expect(apiPlan([{ name: 'snorlax', id: 143, stage: 0, from: null }], 143)).toEqual([]);
  });

  it('QL-04 reaching the level starts the evolution; applying it changes species, types and makes it stronger', () => {
    const s = quest();
    const ch = s.party[0];
    expect(ch.name).toBe('Charmander');
    const atk = ch.atk;
    while (ch.level < 16) grantXp(s, ch, xpToNext(ch.level));
    expect(s.pendingEvolution).toMatchObject({ idx: 0, fromName: 'Charmander', toName: 'Charmeleon', toDex: 5 });
    expect(s.events.some((e) => e.kind === 'levelup' && e.level === 16)).toBe(true);
    // Nothing moves while the sequence is shown
    const before = s.time;
    step(s, 1, {});
    expect(s.time).toBe(before);
    applyEvolution(s);
    expect(ch).toMatchObject({ name: 'Charmeleon', dex: 5, stage: 1 });
    expect(ch.image).toMatch(/\/5\.png$/);
    expect(ch.hp).toBe(ch.maxHp);
    expect(ch.atk).toBeGreaterThan(atk * 2);
    expect(nextEvolution(ch.plan, ch.dex)).toMatchObject({ name: 'Charizard', level: 36 });
    // Several members reaching their level evolve one after the other
    for (const m of s.party.slice(1, 3)) while (m.level < 16) grantXp(s, m, xpToNext(m.level));
    expect(s.pendingEvolution.fromName).toBe('Bulbasaur');
    applyEvolution(s);
    expect(s.pendingEvolution.fromName).toBe('Squirtle');
    applyEvolution(s);
    expect(s.party.map((m) => m.name).slice(0, 3)).toEqual(['Charmeleon', 'Ivysaur', 'Wartortle']);
  });

  it('QL-05 the Pokedex number of any team member, and API plans replace the table', () => {
    expect(dexOfMember({ query: [25, 'pikachu'] })).toBe(25);
    expect(dexOfMember({ image: 'https://x/official-artwork/133.png' })).toBe(133);
    expect(dexOfMember({ name: 'Snorlax' })).toBe(143);
    expect(dexOfMember({ name: 'Nobody' })).toBeNull();
    const s = quest();
    const plan = [{ from: 25, to: 26, level: 8, name: 'Raichu', types: ['electric'], image: 'r.png' }];
    expect(setEvolutionPlan(s, s.party[3].key, plan)).toBe(true);
    expect(s.pendingEvolution).toBeNull();
    grantXp(s, s.party[3], xpToNext(5) + xpToNext(6) + xpToNext(7));
    expect(s.pendingEvolution).toMatchObject({ toName: 'Raichu' });
  });
});

describe('quest play', () => {
  it('QP-01 a new journey starts in Làng Pallet with 5 Pokemon at level 5 and a few items', () => {
    const s = quest();
    expect(s.area.name).toBe('Làng Pallet');
    expect(s.party).toHaveLength(5);
    expect(s.party.every((m) => m.level === 5 && m.hp === m.maxHp)).toBe(true);
    expect(s.inventory).toMatchObject({ berry: 3, potion: 2, revive: 1 });
    const h = hudOf(s);
    expect(h).toMatchObject({ act: 0, areaIdx: 0, areaKind: 'town', lead: 0, gold: 0 });
    expect(h.party[0]).toMatchObject({ name: 'Charmander', level: 5, fainted: false });
    expect(switchLead(s, 2)).toBe(true);
    expect(hudOf(s).lead).toBe(2);
  });

  it('QP-02 walking into the portal leads to the next area; the way back returns next to that portal', () => {
    const s = quest();
    walkTo(s, s.portals.find((p) => p.kind === 'next'));
    expect(s.areaIdx).toBe(1);
    expect(s.events.some((e) => e.kind === 'area' && e.name === 'Đồng cỏ Tuyến 1')).toBe(true);
    expect(s.enemies.length).toBeGreaterThan(20);
    const back = s.portals.find((p) => p.kind === 'back');
    expect(Math.hypot(back.x - s.trainer.x, back.y - s.trainer.y)).toBeLessThan(150);
    // Standing still next to it does not go back at once
    for (let i = 0; i < 30; i++) step(s, 1 / 30, {});
    expect(s.areaIdx).toBe(1);
  });

  it('QP-03 the team fights the wild Pokemon nearby by itself and earns experience', () => {
    const s = quest();
    enterArea(s, 0, 1, 'forward');
    const xp0 = s.party.map((m) => m.xp + m.level * 1000);
    for (let i = 0; i < 30 * 12; i++) step(s, 1 / 30, {});
    expect(s.stats.kills).toBeGreaterThanOrEqual(2);
    expect(s.party.every((m, i) => m.xp + m.level * 1000 > xp0[i])).toBe(true);
    expect(s.drops.length + s.gold).toBeGreaterThan(0);
  });

  it('QP-04 skills of the lead: a shot, a blast, and the team ultimate when charged', () => {
    const s = quest();
    enterArea(s, 0, 1, 'forward');
    const lead = s.party[0];
    const e = s.enemies[0];
    Object.assign(e, { x: lead.x + 60, y: lead.y, hp: 10 ** 6, maxHp: 10 ** 6 });
    step(s, 1 / 60, { cast: 's1' });
    expect(s.events.some((v) => v.kind === 'cast')).toBe(true);
    expect(lead.cd.s1).toBeGreaterThan(0);
    step(s, 1 / 60, { cast: 's2' });
    expect(s.events.some((v) => v.kind === 'nova')).toBe(true);
    s.ult = 100;
    step(s, 1 / 60, { cast: 'ult' });
    expect(s.ult).toBe(0);
    for (let i = 0; i < 60; i++) step(s, 1 / 60, {});
    expect(s.events.filter((v) => v.kind === 'ult-pulse')).toHaveLength(3);
  });

  it('QP-05 items: heal, revive, Rare Candy (+1 level), evolution stone, and the shop', () => {
    const s = quest();
    const m = s.party[1];
    m.hp = 5;
    expect(applyItem(s, 'potion')).toBe(true);
    expect(m.hp).toBeGreaterThan(5);
    expect(s.inventory.potion).toBe(1);
    // Nobody hurt: nothing is wasted
    s.party.forEach((p) => (p.hp = p.maxHp));
    expect(applyItem(s, 'berry')).toBe(false);
    s.party[2].fainted = true;
    s.party[2].hp = 0;
    expect(applyItem(s, 'revive')).toBe(true);
    expect(s.party[2].fainted).toBe(false);
    s.inventory.candy = 1;
    const lv = s.party[0].level;
    expect(applyItem(s, 'candy')).toBe(true);
    expect(s.party[0].level).toBe(lv + 1);
    s.inventory.stone = 1;
    expect(applyItem(s, 'stone')).toBe(true);
    expect(s.pendingEvolution.toName).toBe('Charmeleon');
    applyEvolution(s);
    s.gold = 30;
    expect(buyItem(s, 'potion')).toBe(true);
    expect(s.gold).toBe(5);
    expect(buyItem(s, 'potion')).toBe(false);
    expect(ITEMS.stone.price).toBeNull();
  });

  it('QP-06 all five fainted: back to town healed, the area starts again', () => {
    const s = quest();
    enterArea(s, 0, 1, 'forward');
    const e = s.enemies[0];
    for (const m of s.party) while (!m.fainted) damageMember(s, e, m, 50);
    expect(s.wipe).toBe(true);
    expect(s.events.some((v) => v.kind === 'wipe')).toBe(true);
    for (let i = 0; i < 100; i++) step(s, 1 / 30, {});
    expect(s.area.kind).toBe('town');
    expect(s.party.every((m) => !m.fainted && m.hp === m.maxHp)).toBe(true);
    expect(s.stats.wipes).toBe(1);
  });

  it('QP-07 the town portal and the way back to the same place', () => {
    const s = quest();
    enterArea(s, 0, 2, 'forward');
    s.trainer.x += 40;
    const at = { x: s.trainer.x, y: s.trainer.y };
    expect(goToTown(s)).toBe(true);
    expect(s.area.kind).toBe('town');
    const ret = s.portals.find((p) => p.kind === 'return');
    expect(ret.label).toContain('Bìa rừng Viridian');
    walkTo(s, ret);
    expect(s.areaIdx).toBe(2);
    expect(Math.hypot(s.trainer.x - at.x, s.trainer.y - at.y)).toBeLessThan(60);
    expect(s.returnTo).toBeNull();
  });

  it('QP-08 the Pokemon Center heals everyone when the trainer walks in', () => {
    const s = quest();
    s.party.forEach((m) => (m.hp = 1));
    s.party[4].fainted = true;
    s.party[4].hp = 0;
    walkTo(s, s.area.spots.find((p) => p.id === 'center'));
    expect(s.townSpot).toBe('center');
    expect(s.party.every((m) => !m.fainted && m.hp === m.maxHp)).toBe(true);
  });

  it('QP-09 the boss: it wakes up, warns before big attacks, and beating it opens the next act', () => {
    const s = quest();
    enterArea(s, 0, 4, 'forward');
    const boss = s.enemies.find((e) => e.boss);
    expect(boss).toMatchObject({ name: 'Snorlax', level: 12 });
    s.trainer.x = boss.x - 200;
    s.trainer.y = boss.y;
    for (let i = 0; i < 60 * 8; i++) step(s, 1 / 60, {});
    expect(s.events.some((e) => e.kind === 'boss-wake')).toBe(true);
    expect(s.events.some((e) => e.kind === 'boss-warn')).toBe(true);
    expect(hudOf(s).boss).toMatchObject({ name: 'Snorlax' });
    boss.hp = 1;
    damageEnemy(s, s.party[0], boss, 5);
    step(s, 1 / 60, {});
    expect(s.beaten).toEqual([0]);
    expect(s.unlocked).toBe(1);
    const act = s.portals.find((p) => p.kind === 'act');
    expect(act.label).toContain('Hang Mt. Moon');
    expect(s.events.some((e) => e.kind === 'act-clear' && e.next === 'Hang Mt. Moon')).toBe(true);
    // Loot: Rare Candy and an evolution stone among the drops
    expect(s.drops.some((d) => d.item === 'candy')).toBe(true);
    expect(s.drops.some((d) => d.item === 'stone')).toBe(true);
    walkTo(s, act);
    expect(s.act).toBe(1);
    expect(s.area.name).toBe('Thành phố Pewter');
    expect(travelTo(s, 0)).toBe(true);
    expect(s.area.name).toBe('Làng Pallet');
    expect(travelTo(s, 3)).toBe(false);
  });
});

describe('quest: two Pokemon out, three resting in their balls', () => {
  it('QO-01 only the lead and a companion walk and fight; tapping swaps, sends out and recalls', () => {
    const s = quest();
    enterArea(s, 0, 1, 'forward');
    expect(fighters(s).map((m) => m.idx)).toEqual([0, 1]);
    expect(hudOf(s).party.map((m) => m.out)).toEqual([true, true, false, false, false]);
    // The companion becomes the lead (a swap, nobody goes back)
    expect(switchLead(s, 1)).toBe(true);
    expect([s.lead, s.companion]).toEqual([1, 0]);
    s.events.length = 0;
    // A Pokemon from its ball: sent out as the lead, the old companion is recalled
    expect(switchLead(s, 3)).toBe(true);
    expect([s.lead, s.companion]).toEqual([3, 1]);
    expect(s.events.find((e) => e.kind === 'recall')).toMatchObject({ idx: 0 });
    expect(s.events.find((e) => e.kind === 'sendout')).toMatchObject({ idx: 3 });
    expect(fighters(s).map((m) => m.idx).sort()).toEqual([1, 3]);
    // Wild Pokemon only ever target the two out
    for (let i = 0; i < 30 * 8; i++) step(s, 1 / 30, {});
    expect(s.party.filter((m) => !m.out).every((m) => m.hp === m.maxHp)).toBe(true);
  });

  it('QO-02 a fainted Pokemon is replaced by the healthiest one from its ball; resting ones heal', () => {
    const s = quest();
    enterArea(s, 0, 1, 'forward');
    s.party[2].hp = 5;
    s.party[3].hp = s.party[3].maxHp;
    const e = s.enemies[0];
    while (!s.party[0].fainted) damageMember(s, e, s.party[0], 50);
    expect(s.lead).toBe(1);
    expect(s.companion).toBe(3);
    expect(s.events.some((v) => v.kind === 'sendout' && v.idx === 3)).toBe(true);
    // In its ball, a hurt Pokemon slowly heals
    const hp = s.party[2].hp;
    for (let i = 0; i < 30 * 4; i++) step(s, 1 / 30, {});
    expect(s.party[2].hp).toBeGreaterThan(hp);
  });

  it('QO-03 experience: full for the two out, a smaller share for those in their balls', () => {
    const s = quest();
    enterArea(s, 0, 1, 'forward');
    s.party.forEach((m) => (m.xp = 0));
    const e = makeEnemy(s, 16, 5, { x: s.trainer.x, y: s.trainer.y });
    e.hitBy.add(0);
    koEnemy(s, e);
    const xp = s.party.map((m) => m.xp);
    expect(xp[0]).toBeGreaterThan(xp[1]);
    expect(xp[1]).toBeGreaterThan(xp[2]);
    expect(xp[2]).toBeGreaterThan(0);
    expect(xp[2]).toBe(xp[3]);
  });
});

describe('quest expert trainers', () => {
  it('QX-01 five experts per act (1 + 2 + 2), each with a Vietnamese title and a themed team near the team level', () => {
    expect(expertsIn(1, 'wild') + expertsIn(2, 'wild') + expertsIn(3, 'dungeon')).toBe(EXPERTS_PER_ACT);
    expect(EXPERT_ROSTER).toHaveLength(ACTS.length);
    for (const r of EXPERT_ROSTER) for (const x of r) for (const d of x.team) expect(SPECIES[d], `${x.name} ${d}`).toBeTruthy();
    const s = quest();
    enterArea(s, 0, 2, 'forward');
    expect(s.experts).toHaveLength(2);
    expect(s.experts[0]).toMatchObject({ id: '0-2-0', title: 'Cô bé dã ngoại Mai' });
    expect(s.experts[0].team.length).toBeGreaterThanOrEqual(3);
    expect(s.experts[0].level).toBeGreaterThanOrEqual(7);
  });

  it('QX-02 walking up opens the talk (the map waits); win gives XP, gold and an item once; 5 wins give the badge', () => {
    const s = quest();
    enterArea(s, 0, 1, 'forward');
    const ex = s.experts[0];
    s.trainer.x = ex.x - 60;
    s.trainer.y = ex.y;
    step(s, 1 / 60, {});
    expect(s.pendingExpert).toBe(ex.id);
    const t = s.time;
    step(s, 1, {});
    expect(s.time).toBe(t);
    expect(hudOf(s).expert).toMatchObject({ title: 'Thợ bắt bọ Tuấn' });
    // A loss: nothing changes
    const before = { gold: s.gold, xp: s.party.map((m) => m.xp + m.level * 1e4) };
    expect(expertResult(s, ex.id, false)).toBeNull();
    expect(s.gold).toBe(before.gold);
    // A win
    const r = expertResult(s, ex.id, true);
    expect(r.gold).toBeGreaterThan(0);
    expect(s.gold).toBe(before.gold + r.gold);
    expect(s.party.every((m, i) => m.xp + m.level * 1e4 > before.xp[i])).toBe(true);
    expect(s.expertsBeaten).toEqual([ex.id]);
    expect(expertResult(s, ex.id, true)).toBeNull();
    closeExpert(s);
    step(s, 1 / 60, {});
    expect(s.pendingExpert).toBeNull();
    // The other four of the act
    s.expertsBeaten.push('0-2-0', '0-2-1', '0-3-0');
    expect(s.badges).toEqual([]);
    enterArea(s, 0, 3, 'forward');
    expertResult(s, '0-3-1', true);
    expect(s.badges).toEqual([0]);
    expect(s.events.some((e) => e.kind === 'badge')).toBe(true);
    expect(toSave(s)).toMatchObject({ badges: [0] });
    expect(toSave(s).expertsBeaten).toHaveLength(5);
  });
});

describe('quest loot, gold and saving', () => {
  it('QG-01 loot tables: bosses give candy, stone and charms; chests always give coins', () => {
    const r = seeded(3);
    const boss = rollDrops({ level: 12, boss: true }, r);
    expect(boss.filter((d) => d.item === 'candy')).toHaveLength(2);
    expect(boss.some((d) => d.item === 'stone')).toBe(true);
    const elite = rollDrops({ level: 8, elite: true }, r);
    expect(elite[0]).toMatchObject({ kind: 'coin' });
    for (let i = 0; i < 20; i++) expect(rollChest(5, r).filter((d) => d.kind === 'coin').length).toBe(2);
  });

  it('QG-02 app gold: paid in batches and never more than 150 per hour of play', () => {
    const reward = { earned: 0, paid: 0, playSeconds: 0 };
    let total = 0;
    for (let min = 1; min <= 120; min++) {
      reward.playSeconds += 60;
      earnReward(reward, 400); // a very lucky child: 400 quest gold a minute
      if (min % 5 === 0) total += claimReward(reward);
      expect(reward.paid).toBeLessThanOrEqual((GOLD_PER_HOUR * reward.playSeconds) / 3600 + 5);
    }
    expect(total).toBeLessThanOrEqual(2 * GOLD_PER_HOUR + 5);
    expect(total).toBeGreaterThan(250);
  });

  it('QS-01 save and continue: team, levels, evolved forms, bag, acts and area come back', () => {
    const store = memStore();
    const s = quest();
    grantXp(s, s.party[0], 10 ** 4);
    if (s.pendingEvolution) applyEvolution(s);
    s.inventory.candy = 3;
    s.gold = 77;
    s.beaten = [0];
    s.unlocked = 1;
    enterArea(s, 1, 2, 'forward');
    expect(saveQuest(s, store)).toBe(true);
    const data = loadQuest(store);
    expect(data).toMatchObject({ v: 1, act: 1, area: 2, gold: 77, unlocked: 1, beaten: [0] });
    const back = createQuest({ save: data, random: seeded(1) });
    expect(back.area.name).toBe('Đường hầm Đá');
    expect(back.party[0]).toMatchObject({ name: s.party[0].name, dex: s.party[0].dex, level: s.party[0].level, stage: s.party[0].stage });
    expect(back.inventory.candy).toBe(3);
    expect(Array.from(back.area.grid)).toEqual(Array.from(s.area.grid));
    expect(JSON.parse(store.getItem(SAVE_KEY)).party).toHaveLength(5);
    clearQuest(store);
    expect(loadQuest(store)).toBeNull();
    store.setItem(SAVE_KEY, '{broken');
    expect(loadQuest(store)).toBeNull();
    expect(toSave(s).party[0].plan.length).toBeGreaterThanOrEqual(1);
  });

  it('QS-02 members from cards keep their Pokedex number and types', () => {
    const m = questMember({ key: 'card-1', name: 'Gastly', query: [92, 'gastly'], types: ['ghost', 'poison'], power: 310, image: 'g.png' }, 0);
    expect(m).toMatchObject({ dex: 92, level: 5, types: ['ghost', 'poison'] });
    expect(m.plan.map((st) => st.level)).toEqual([25, 38]);
  });
});
