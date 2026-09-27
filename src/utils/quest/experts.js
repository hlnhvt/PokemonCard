// "Chuyên gia": expert trainers waiting at battle spots in the wild areas and dungeons.
// Walking up to one opens a dialog; the child may battle them in the real-time arena or
// in the turn-based 5 vs 5. Beating all 5 experts of an act gives that act's badge.
import { speciesInfo } from './species';
import { hashSeed } from './rng';

// look: how the trainer is drawn (hat, colours, what they carry)
export const EXPERT_ROSTER = [
  [
    { cls: 'Thợ bắt bọ', name: 'Tuấn', look: { hat: 'straw', coat: '#65a30d', pants: '#854d0e', skin: '#f5c9a0', hair: '#3f2a1d', item: 'net' }, team: [10, 13, 11, 14, 12] },
    { cls: 'Cô bé dã ngoại', name: 'Mai', look: { hat: 'bow', coat: '#f472b6', pants: '#1d4ed8', skin: '#fcd9b8', hair: '#78350f', item: 'none' }, team: [16, 19, 43, 39] },
    { cls: 'Người nuôi chim', name: 'Nam', look: { hat: 'cap', coat: '#0ea5e9', pants: '#334155', skin: '#e8b98f', hair: '#1f2937', item: 'none' }, team: [16, 21, 17, 22] },
    { cls: 'Thợ bắt bọ', name: 'Bin', look: { hat: 'straw', coat: '#84cc16', pants: '#166534', skin: '#fcd9b8', hair: '#111827', item: 'net' }, team: [13, 46, 14, 15] },
    { cls: 'Kiểm lâm', name: 'Hạnh', look: { hat: 'ranger', coat: '#15803d', pants: '#78350f', skin: '#f5c9a0', hair: '#3f2a1d', item: 'none' }, team: [43, 69, 1, 44, 17] },
  ],
  [
    { cls: 'Nhà leo núi', name: 'Hùng', look: { hat: 'hiker', coat: '#b45309', pants: '#57534e', skin: '#d6a57c', hair: '#1f2937', item: 'bag' }, team: [74, 95, 75, 27] },
    { cls: 'Nhà thám hiểm', name: 'Lan', look: { hat: 'helmet', coat: '#ca8a04', pants: '#44403c', skin: '#fcd9b8', hair: '#78350f', item: 'none' }, team: [41, 46, 50, 42] },
    { cls: 'Mọt sách', name: 'Minh', look: { hat: 'none', coat: '#e5e7eb', pants: '#1e3a8a', skin: '#f5c9a0', hair: '#111827', item: 'glasses' }, team: [81, 100, 35, 82] },
    { cls: 'Nhà leo núi', name: 'Sơn', look: { hat: 'hiker', coat: '#92400e', pants: '#3f3f46', skin: '#d6a57c', hair: '#3f2a1d', item: 'bag' }, team: [66, 74, 111, 75, 67] },
    { cls: 'Thợ mỏ', name: 'Phúc', look: { hat: 'helmet', coat: '#475569', pants: '#1f2937', skin: '#e8b98f', hair: '#111827', item: 'none' }, team: [27, 50, 28, 51, 95] },
  ],
  [
    { cls: 'Bà đồng', name: 'Hằng', look: { hat: 'hood', coat: '#6b21a8', pants: '#3b0764', skin: '#f5d0b0', hair: '#e5e7eb', item: 'staff' }, team: [92, 93, 200, 92] },
    { cls: 'Cậu bé ngoại cảm', name: 'Long', look: { hat: 'none', coat: '#db2777', pants: '#1e1b4b', skin: '#fcd9b8', hair: '#7c3aed', item: 'none' }, team: [63, 96, 64, 97] },
    { cls: 'Người giữ tháp', name: 'Bảo', look: { hat: 'hood', coat: '#374151', pants: '#111827', skin: '#e8b98f', hair: '#111827', item: 'staff' }, team: [104, 92, 105, 93, 200] },
    { cls: 'Bà đồng', name: 'Thu', look: { hat: 'hood', coat: '#7e22ce', pants: '#4c1d95', skin: '#f5d0b0', hair: '#1f2937', item: 'staff' }, team: [200, 93, 355, 94] },
    { cls: 'Cô bé ngoại cảm', name: 'Vy', look: { hat: 'bow', coat: '#c026d3', pants: '#312e81', skin: '#fcd9b8', hair: '#0f172a', item: 'none' }, team: [96, 79, 97, 64] },
  ],
  [
    { cls: 'Nghệ sĩ lửa', name: 'Dũng', look: { hat: 'bandana', coat: '#dc2626', pants: '#1f2937', skin: '#d6a57c', hair: '#111827', item: 'none' }, team: [58, 37, 77, 126] },
    { cls: 'Nhà khoa học', name: 'Quân', look: { hat: 'none', coat: '#f8fafc', pants: '#334155', skin: '#f5c9a0', hair: '#6b7280', item: 'glasses' }, team: [109, 81, 100, 110, 101] },
    { cls: 'Thợ săn đá', name: 'Khoa', look: { hat: 'hiker', coat: '#9a3412', pants: '#292524', skin: '#d6a57c', hair: '#1f2937', item: 'bag' }, team: [74, 218, 75, 76] },
    { cls: 'Nghệ sĩ lửa', name: 'Hỏa', look: { hat: 'bandana', coat: '#ea580c', pants: '#450a0a', skin: '#e8b98f', hair: '#7f1d1d', item: 'none' }, team: [37, 58, 78, 59, 38] },
    { cls: 'Huấn luyện viên ưu tú', name: 'Kiệt', look: { hat: 'cap', coat: '#b91c1c', pants: '#111827', skin: '#f5c9a0', hair: '#111827', item: 'cape' }, team: [126, 78, 59, 6] },
  ],
  [
    { cls: 'Vận động viên bơi', name: 'Thủy', look: { hat: 'swim', coat: '#0284c7', pants: '#0369a1', skin: '#f5c9a0', hair: '#78350f', item: 'none' }, team: [116, 120, 86, 117] },
    { cls: 'Người trượt tuyết', name: 'Tuyết', look: { hat: 'beanie', coat: '#e0f2fe', pants: '#1e40af', skin: '#fcd9b8', hair: '#3f2a1d', item: 'none' }, team: [361, 220, 124, 362] },
    { cls: 'Ngư dân', name: 'Hải', look: { hat: 'fisher', coat: '#facc15', pants: '#1e3a8a', skin: '#d6a57c', hair: '#1f2937', item: 'rod' }, team: [129, 90, 116, 130, 91] },
    { cls: 'Vận động viên bơi', name: 'Sóng', look: { hat: 'swim', coat: '#0891b2', pants: '#155e75', skin: '#e8b98f', hair: '#111827', item: 'none' }, team: [86, 120, 87, 121] },
    { cls: 'Người trượt tuyết', name: 'Băng', look: { hat: 'beanie', coat: '#bae6fd', pants: '#0c4a6e', skin: '#f5c9a0', hair: '#e5e7eb', item: 'none' }, team: [220, 124, 221, 87, 131] },
  ],
  [
    { cls: 'Huấn luyện viên ưu tú', name: 'Phong', look: { hat: 'cap', coat: '#1d4ed8', pants: '#111827', skin: '#f5c9a0', hair: '#1f2937', item: 'cape' }, team: [65, 68, 112, 130, 149] },
    { cls: 'Cao thủ tâm linh', name: 'Linh', look: { hat: 'hood', coat: '#7c3aed', pants: '#2e1065', skin: '#fcd9b8', hair: '#f5d0fe', item: 'staff' }, team: [64, 97, 121, 65, 282] },
    { cls: 'Nhà vô địch', name: 'Kiên', look: { hat: 'cap', coat: '#b91c1c', pants: '#1e1b4b', skin: '#e8b98f', hair: '#111827', item: 'cape' }, team: [6, 9, 3, 143, 149] },
    { cls: 'Nhà khoa học', name: 'Thái', look: { hat: 'none', coat: '#f1f5f9', pants: '#312e81', skin: '#f5c9a0', hair: '#9ca3af', item: 'glasses' }, team: [137, 101, 82, 132, 376] },
    { cls: 'Huấn luyện viên ưu tú', name: 'Như', look: { hat: 'bow', coat: '#be185d', pants: '#111827', skin: '#fcd9b8', hair: '#111827', item: 'cape' }, team: [36, 40, 184, 282, 373] },
  ],
];

export const BADGES = [
  { name: 'Huy hiệu Rừng Xanh', icon: '🍃', color: '#22c55e' },
  { name: 'Huy hiệu Đá Tảng', icon: '🪨', color: '#a8a29e' },
  { name: 'Huy hiệu Linh Hồn', icon: '👻', color: '#a855f7' },
  { name: 'Huy hiệu Núi Lửa', icon: '🔥', color: '#f97316' },
  { name: 'Huy hiệu Băng Giá', icon: '❄️', color: '#38bdf8' },
  { name: 'Huy hiệu Tâm Linh', icon: '🔮', color: '#ec4899' },
];

// Which roster entry sits in area `index` place `k` (2 + ... = 5 per act)
const SLOT = { 1: [0], 2: [1, 2], 3: [3, 4] };

const HELLO = ['Chào bé! Đội của anh chị mạnh lắm đấy!', 'Bé cũng là Huấn luyện viên à? Đấu thử nhé!', 'Không ai qua đây mà không đấu với ta!', 'Ta đã luyện tập ở đây rất lâu rồi. Thử sức nào!', 'Pokémon của bé trông khỏe quá! Đấu một trận nhé?'];
const WIN = ['Bé giỏi quá! Đây là phần thưởng cho bé!', 'Wow, đội của bé thật tuyệt vời!', 'Ta thua rồi! Bé sẽ thành nhà vô địch đấy!', 'Trận đấu hay quá! Cảm ơn bé nhé!'];
const LOSE = ['Lần sau cố lên nhé! Ta luôn chờ ở đây.', 'Suýt nữa thôi! Luyện thêm rồi quay lại nhé!', 'Đội của bé sẽ mạnh hơn nữa đấy!'];
const AFTER = ['Chúc bé thượng lộ bình an!', 'Đội của bé mạnh thật đấy!', 'Hẹn gặp lại ở giải đấu lớn nhé!'];

const pick = (list, seed) => list[seed % list.length];

/**
 * The experts of an area (from world.js positions). partyLevel: the team's average level,
 * so the expert is a fair match. beaten: ids already beaten.
 */
export function expertsFor(area, partyLevel, beaten = []) {
  const roster = EXPERT_ROSTER[area.act] || EXPERT_ROSTER[0];
  const slots = SLOT[area.index] || [];
  const hi = area.def.levels?.[1] || 5;
  return area.experts.map((p, k) => {
    const r = roster[slots[k] ?? k % roster.length];
    const id = `${area.act}-${area.index}-${k}`;
    const seed = hashSeed(area.seed, k, 31);
    const level = Math.min(50, Math.max(hi + 1 + k, Math.round(partyLevel)));
    return {
      id,
      x: p.x,
      y: p.y,
      cls: r.cls,
      name: r.name,
      title: `${r.cls} ${r.name}`,
      look: r.look,
      level,
      team: r.team.map((dex) => {
        const sp = speciesInfo(dex);
        return { dex, name: sp?.name || `#${dex}`, types: sp?.types || ['normal'], bst: sp?.bst || 320, level };
      }),
      hello: pick(HELLO, seed),
      winLine: pick(WIN, seed >>> 3),
      loseLine: pick(LOSE, seed >>> 5),
      afterLine: pick(AFTER, seed >>> 7),
      beaten: beaten.includes(id),
    };
  });
}

/** Reward for beating an expert: gold, an item, experience for every team member. */
export function expertReward(expert, act) {
  const items = ['candy', 'superPotion', 'charmAtk', 'charmHp', 'revive', 'candy', 'charmSpeed'];
  const k = Number(expert.id.split('-')[2]) || 0;
  const idx = Number(expert.id.split('-')[1]) || 0;
  return {
    gold: 30 + act * 20 + k * 10,
    item: items[(act + idx * 2 + k) % items.length],
    xp: Math.round((3 + expert.level * 1.4) * 3 * 4),
  };
}
