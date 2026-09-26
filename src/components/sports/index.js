import { BowlingGame } from './BowlingGame';
import { PenaltyGame } from './PenaltyGame';
import { BasketballGame } from './BasketballGame';
import { RacingGame } from './RacingGame';
import { GoldMinerGame } from './GoldMinerGame';
import { ArcheryGame } from './ArcheryGame';
import { RedLightGame } from './RedLightGame';

/** Sports matches against other Pokemon, listed in the game picker and the Games tab. */
export const SPORTS = [
  { id: 'bowling', title: 'Bowling', description: 'Ngắm, chọn lực, đánh đổ hết ki!', icon: '🎳', gradient: 'from-indigo-500 to-fuchsia-500', Component: BowlingGame },
  { id: 'penalty', title: 'Sút penalty', description: 'Sút 5 quả, bắt 5 quả', icon: '⚽', gradient: 'from-emerald-500 to-lime-500', Component: PenaltyGame },
  { id: 'basketball', title: 'Bóng rổ', description: 'Kéo ngược như ná, thả tay để ném', icon: '🏀', gradient: 'from-orange-500 to-amber-500', Component: BasketballGame },
  { id: 'racing', title: 'Đua xe máy', description: 'Né chướng ngại, về đích đầu tiên', icon: '🏍️', gradient: 'from-sky-500 to-blue-600', Component: RacingGame },
  { id: 'goldminer', title: 'Đào vàng', description: 'Thả móc gắp vàng, qua 5 cửa', icon: '⛏️', gradient: 'from-yellow-500 to-amber-700', Component: GoldMinerGame },
  { id: 'archery', title: 'Bắn trúng đích', description: 'Tung chiêu vào hồng tâm, đấu 5 lượt', icon: '🎯', gradient: 'from-rose-500 to-red-600', Component: ArcheryGame },
  { id: 'redlight', title: 'Đèn xanh đèn đỏ', description: 'Chạy khi xanh, đứng im khi đỏ!', icon: '🦑', gradient: 'from-pink-500 to-fuchsia-600', Component: RedLightGame },
];

export const findSport = (id) => SPORTS.find((s) => s.id === id) || null;
