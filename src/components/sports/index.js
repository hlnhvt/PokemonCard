import { BowlingGame } from './BowlingGame';
import { PenaltyGame } from './PenaltyGame';
import { BasketballGame } from './BasketballGame';
import { RacingGame } from './RacingGame';

/** Sports matches against other Pokemon, listed in the game picker and the Games tab. */
export const SPORTS = [
  { id: 'bowling', title: 'Bowling', description: 'Ngắm, chọn lực, đánh đổ hết ki!', icon: '🎳', gradient: 'from-indigo-500 to-fuchsia-500', Component: BowlingGame },
  { id: 'penalty', title: 'Sút penalty', description: 'Sút 5 quả, bắt 5 quả', icon: '⚽', gradient: 'from-emerald-500 to-lime-500', Component: PenaltyGame },
  { id: 'basketball', title: 'Bóng rổ', description: 'Kéo ngược như ná, thả tay để ném', icon: '🏀', gradient: 'from-orange-500 to-amber-500', Component: BasketballGame },
  { id: 'racing', title: 'Đua xe máy', description: 'Né chướng ngại, về đích đầu tiên', icon: '🏍️', gradient: 'from-sky-500 to-blue-600', Component: RacingGame },
];

export const findSport = (id) => SPORTS.find((s) => s.id === id) || null;
