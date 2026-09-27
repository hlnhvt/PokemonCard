// Pokemon used by the quest (wild Pokemon, bosses, evolved forms) and a built-in evolution
// table for well-known lines. The table is used when the PokeAPI chain cannot be downloaded;
// levels are kid-friendly (stone / friendship / trade evolutions get a level, all <= 50).
import { artworkUrl } from '../../services/pokemonOnlineService';

// dex:Name:type1/type2:base stat total
const RAW = `
1:Bulbasaur:grass/poison:318 2:Ivysaur:grass/poison:405 3:Venusaur:grass/poison:525
4:Charmander:fire:309 5:Charmeleon:fire:405 6:Charizard:fire/flying:534
7:Squirtle:water:314 8:Wartortle:water:405 9:Blastoise:water:530
10:Caterpie:bug:195 11:Metapod:bug:205 12:Butterfree:bug/flying:395
13:Weedle:bug/poison:195 14:Kakuna:bug/poison:205 15:Beedrill:bug/poison:395
16:Pidgey:normal/flying:251 17:Pidgeotto:normal/flying:349 18:Pidgeot:normal/flying:479
19:Rattata:normal:253 20:Raticate:normal:413 21:Spearow:normal/flying:262 22:Fearow:normal/flying:442
23:Ekans:poison:288 24:Arbok:poison:448 25:Pikachu:electric:320 26:Raichu:electric:485
27:Sandshrew:ground:300 28:Sandslash:ground:450 35:Clefairy:fairy:323 36:Clefable:fairy:483
37:Vulpix:fire:299 38:Ninetales:fire:505 39:Jigglypuff:normal/fairy:270 40:Wigglytuff:normal/fairy:435
41:Zubat:poison/flying:245 42:Golbat:poison/flying:455 169:Crobat:poison/flying:535
43:Oddish:grass/poison:320 44:Gloom:grass/poison:395 45:Vileplume:grass/poison:490
46:Paras:bug/grass:285 47:Parasect:bug/grass:405 50:Diglett:ground:265 51:Dugtrio:ground:425
52:Meowth:normal:290 53:Persian:normal:440 54:Psyduck:water:320 55:Golduck:water:500
58:Growlithe:fire:350 59:Arcanine:fire:555 60:Poliwag:water:300 61:Poliwhirl:water:385 62:Poliwrath:water/fighting:510
63:Abra:psychic:310 64:Kadabra:psychic:400 65:Alakazam:psychic:500
66:Machop:fighting:305 67:Machoke:fighting:405 68:Machamp:fighting:505
69:Bellsprout:grass/poison:300 70:Weepinbell:grass/poison:390 71:Victreebel:grass/poison:490
74:Geodude:rock/ground:300 75:Graveler:rock/ground:390 76:Golem:rock/ground:495
77:Ponyta:fire:410 78:Rapidash:fire:500 79:Slowpoke:water/psychic:315 80:Slowbro:water/psychic:490
81:Magnemite:electric/steel:325 82:Magneton:electric/steel:465 86:Seel:water:325 87:Dewgong:water/ice:475
90:Shellder:water:305 91:Cloyster:water/ice:525 92:Gastly:ghost/poison:310 93:Haunter:ghost/poison:405 94:Gengar:ghost/poison:500
95:Onix:rock/ground:385 96:Drowzee:psychic:328 97:Hypno:psychic:483 100:Voltorb:electric:330 101:Electrode:electric:490
104:Cubone:ground:320 105:Marowak:ground:425 109:Koffing:poison:340 110:Weezing:poison:490
111:Rhyhorn:ground/rock:345 112:Rhydon:ground/rock:485 116:Horsea:water:295 117:Seadra:water:440
120:Staryu:water:340 121:Starmie:water/psychic:520 124:Jynx:ice/psychic:455 126:Magmar:fire:495
129:Magikarp:water:200 130:Gyarados:water/flying:540 132:Ditto:normal:288 133:Eevee:normal:325 134:Vaporeon:water:525
137:Porygon:normal:395 143:Snorlax:normal:540 144:Articuno:ice/flying:580 146:Moltres:fire/flying:580
147:Dratini:dragon:300 148:Dragonair:dragon:420 149:Dragonite:dragon/flying:600 150:Mewtwo:psychic:680
152:Chikorita:grass:318 153:Bayleef:grass:405 154:Meganium:grass:525
155:Cyndaquil:fire:309 156:Quilava:fire:405 157:Typhlosion:fire:534
158:Totodile:water:314 159:Croconaw:water:405 160:Feraligatr:water:530
172:Pichu:electric:205 175:Togepi:fairy:245 176:Togetic:fairy/flying:405
179:Mareep:electric:280 180:Flaaffy:electric:365 181:Ampharos:electric:510 183:Marill:water/fairy:250 184:Azumarill:water/fairy:420
200:Misdreavus:ghost:435 218:Slugma:fire:250 220:Swinub:ice/ground:250 221:Piloswine:ice/ground:450
246:Larvitar:rock/ground:300 247:Pupitar:rock/ground:410 248:Tyranitar:rock/dark:600
252:Treecko:grass:310 253:Grovyle:grass:405 254:Sceptile:grass:530
255:Torchic:fire:310 256:Combusken:fire/fighting:405 257:Blaziken:fire/fighting:530
258:Mudkip:water:310 259:Marshtomp:water/ground:405 260:Swampert:water/ground:535
280:Ralts:psychic/fairy:198 281:Kirlia:psychic/fairy:278 282:Gardevoir:psychic/fairy:518
355:Duskull:ghost:295 361:Snorunt:ice:300 362:Glalie:ice:480
371:Bagon:dragon:300 372:Shelgon:dragon:420 373:Salamence:dragon/flying:600
374:Beldum:steel/psychic:300 375:Metang:steel/psychic:420 376:Metagross:steel/psychic:600
387:Turtwig:grass:318 388:Grotle:grass:405 389:Torterra:grass/ground:525
390:Chimchar:fire:309 391:Monferno:fire/fighting:405 392:Infernape:fire/fighting:534
393:Piplup:water:314 394:Prinplup:water:405 395:Empoleon:water/steel:530
443:Gible:dragon/ground:300 444:Gabite:dragon/ground:410 445:Garchomp:dragon/ground:600
447:Riolu:fighting:285 448:Lucario:fighting/steel:525
495:Snivy:grass:308 496:Servine:grass:413 497:Serperior:grass:528
498:Tepig:fire:308 499:Pignite:fire/fighting:418 500:Emboar:fire/fighting:528
501:Oshawott:water:308 502:Dewott:water:413 503:Samurott:water:528
650:Chespin:grass:313 651:Quilladin:grass:405 652:Chesnaught:grass/fighting:530
653:Fennekin:fire:307 654:Braixen:fire:409 655:Delphox:fire/psychic:534
656:Froakie:water:314 657:Frogadier:water:405 658:Greninja:water/dark:530
722:Rowlet:grass/flying:320 723:Dartrix:grass/flying:420 724:Decidueye:grass/ghost:530
725:Litten:fire:320 726:Torracat:fire:420 727:Incineroar:fire/dark:530
728:Popplio:water:320 729:Brionne:water:420 730:Primarina:water/fairy:530
810:Grookey:grass:310 811:Thwackey:grass:420 812:Rillaboom:grass:530
813:Scorbunny:fire:310 814:Raboot:fire:420 815:Cinderace:fire:530
816:Sobble:water:310 817:Drizzile:water:420 818:Inteleon:water:530
906:Sprigatito:grass:310 907:Floragato:grass:410 908:Meowscarada:grass/dark:530
909:Fuecoco:fire:310 910:Crocalor:fire:411 911:Skeledirge:fire/ghost:530
912:Quaxly:water:310 913:Quaxwell:water:410 914:Quaquaval:water/fighting:530
`;

export const SPECIES = {};
for (const item of RAW.trim().split(/\s+/)) {
  const [dex, name, types, bst] = item.split(':');
  SPECIES[dex] = { dex: Number(dex), name, types: types.split('/'), bst: Number(bst) };
}
const BY_NAME = {};
for (const s of Object.values(SPECIES)) BY_NAME[s.name.toLowerCase()] = s;

export const speciesInfo = (dex) => SPECIES[dex] || null;
export const speciesByName = (name) => BY_NAME[String(name || '').toLowerCase().trim()] || null;

// from dex -> [to dex, level]
const EVO_RAW = `
1>2@16 2>3@32 4>5@16 5>6@36 7>8@16 8>9@36 10>11@7 11>12@10 13>14@7 14>15@10 16>17@18 17>18@36
19>20@20 21>22@20 23>24@22 172>25@12 25>26@22 27>28@22 35>36@28 37>38@28 39>40@28 41>42@22 42>169@36
43>44@21 44>45@32 46>47@24 50>51@26 52>53@28 54>55@33 58>59@30 60>61@25 61>62@36 63>64@16 64>65@36
66>67@28 67>68@40 69>70@21 70>71@32 74>75@25 75>76@40 77>78@40 79>80@37 81>82@30 86>87@34 90>91@30
92>93@25 93>94@38 96>97@26 100>101@30 104>105@28 109>110@35 111>112@42 116>117@32 120>121@30
129>130@20 133>134@25 147>148@30 148>149@45 152>153@16 153>154@32 155>156@14 156>157@36 158>159@18
159>160@30 175>176@20 179>180@15 180>181@30 183>184@18 220>221@33 246>247@30 247>248@45 252>253@16
253>254@36 255>256@16 256>257@36 258>259@16 259>260@36 280>281@20 281>282@30 361>362@42 371>372@30
372>373@45 374>375@20 375>376@45 387>388@18 388>389@32 390>391@14 391>392@36 393>394@16 394>395@36
443>444@24 444>445@48 447>448@25 495>496@17 496>497@36 498>499@17 499>500@36 501>502@17 502>503@36
650>651@16 651>652@36 653>654@16 654>655@36 656>657@16 657>658@36 722>723@17 723>724@34 725>726@17
726>727@34 728>729@17 729>730@34 810>811@16 811>812@35 813>814@16 814>815@35 816>817@16 817>818@35
906>907@16 907>908@36 909>910@16 910>911@36 912>913@16 913>914@36
`;
export const EVOLUTIONS = {};
for (const item of EVO_RAW.trim().split(/\s+/)) {
  const m = /^(\d+)>(\d+)@(\d+)$/.exec(item);
  EVOLUTIONS[m[1]] = { to: Number(m[2]), level: Number(m[3]) };
}

export const MAX_EVO_LEVEL = 48;

function stepFor(fromDex, toDex, level, name, types) {
  const info = speciesInfo(toDex);
  return {
    from: fromDex,
    to: toDex,
    level: Math.max(2, Math.min(MAX_EVO_LEVEL, level)),
    name: info?.name || name,
    types: info?.types || types || null,
    bst: info?.bst || null,
    image: artworkUrl(toDex),
  };
}

/** Evolution steps from the built-in table, following the whole line: [{ from, to, level, name, types, bst, image }]. */
export function tablePlan(dex) {
  const out = [];
  let cur = Number(dex);
  const seen = new Set();
  while (EVOLUTIONS[cur] && !seen.has(cur)) {
    seen.add(cur);
    const e = EVOLUTIONS[cur];
    out.push(stepFor(cur, e.to, e.level));
    cur = e.to;
  }
  return out;
}

const cap = (s) => String(s || '').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('-');

/**
 * Evolution steps from PokeAPI chain nodes (parseEvolutionChain in pokemonOnlineService):
 * [{ name, id, stage, from, how }]. The level comes from "Đạt cấp N"; stone, friendship and
 * trade evolutions (or levels above 50) take the built-in table's level, else 22 / 36 by stage.
 * Branching lines (Eevee...) follow the table's choice when it has one, else the first branch.
 */
export function apiPlan(nodes, dex) {
  if (!Array.isArray(nodes) || !nodes.length) return null;
  const byName = new Map(nodes.map((n) => [n.name, n]));
  let cur = nodes.find((n) => n.id === Number(dex));
  if (!cur) return null;
  const out = [];
  const seen = new Set();
  while (cur && !seen.has(cur.name)) {
    seen.add(cur.name);
    const children = nodes.filter((n) => n.from === cur.name && n.id);
    if (!children.length) break;
    const table = EVOLUTIONS[cur.id];
    const next = (table && children.find((c) => c.id === table.to)) || children[0];
    const m = /cấp\s*(\d+)/i.exec(next.how || '');
    let level = m ? Number(m[1]) : null;
    if (!level || level > 50) level = table && table.to === next.id ? table.level : next.stage >= 2 ? 36 : 22;
    out.push(stepFor(cur.id, next.id, level, cap(next.name), null));
    cur = byName.get(next.name);
  }
  return out;
}

/** The next evolution of a Pokemon (by its current dex) in a plan, or null. */
export const nextEvolution = (plan, dex) => (plan || []).find((s) => s.from === Number(dex)) || null;

/** Pokedex number of a team member (TeamBuilder shape): query number, artwork URL, name. */
export function dexOfMember(m) {
  if (Number.isInteger(Number(m?.dex)) && Number(m.dex) > 0) return Number(m.dex);
  const q = Array.isArray(m?.query) ? m.query : [m?.query];
  for (const v of q) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0 && n < 2000) return n;
  }
  const img = /\/(\d+)\.png(\?.*)?$/.exec(m?.image || '');
  if (img) return Number(img[1]);
  return speciesByName(m?.name)?.dex || speciesByName(m?.species)?.dex || null;
}
