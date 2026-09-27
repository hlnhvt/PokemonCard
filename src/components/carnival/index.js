import { DiglettGame } from './DiglettGame';
import { RingTossGame } from './RingTossGame';
import { PsyduckGame } from './PsyduckGame';
import { CansGame } from './CansGame';
import { ClawGame } from './ClawGame';
import { CupsGame } from './CupsGame';
import { FishingGame } from './FishingGame';
import { PonytaGame } from './PonytaGame';
import { HammerGame } from './HammerGame';
import { WheelGame } from './WheelGame';

/** Carnival games ("Hội chợ Pokémon"): listed in the Games tab and the game picker. */
export const CARNIVAL_GAMES = [
  { id: 'diglett', title: 'Đập Diglett', description: 'Đập Diglett, né Voltorb!', icon: '🔨', gradient: 'from-lime-500 to-green-700', Component: DiglettGame },
  { id: 'ringtoss', title: 'Ném vòng Pokéball', description: 'Vuốt lên ném vòng trúng cọc!', icon: '🎯', gradient: 'from-rose-500 to-purple-700', Component: RingTossGame },
  { id: 'psyduck', title: 'Bắn vịt Psyduck', description: 'Bắn vịt, né bóng bay Pikachu!', icon: '🦆', gradient: 'from-sky-400 to-blue-700', Component: PsyduckGame },
  { id: 'cans', title: 'Ném bóng đổ tháp lon', description: 'Ném Pokéball làm đổ tháp lon!', icon: '🥫', gradient: 'from-amber-400 to-orange-600', Component: CansGame },
  { id: 'claw', title: 'Máy gắp thú', description: 'Gắp thú bông Pokémon, săn Mew hiếm!', icon: '🧸', gradient: 'from-fuchsia-500 to-purple-700', Component: ClawGame },
  { id: 'cups', title: 'Đoán cốc', description: 'Nhìn kỹ xem bóng nằm dưới cốc nào!', icon: '🥤', gradient: 'from-rose-500 to-red-700', Component: CupsGame },
  { id: 'fishing', title: 'Câu cá Magikarp', description: 'Chờ phao chìm rồi giật cần thật nhanh!', icon: '🎣', gradient: 'from-cyan-500 to-emerald-700', Component: FishingGame },
  { id: 'ponyta', title: 'Đua ngựa Ponyta', description: 'Chạm đúng nhịp để Ponyta phi nước đại!', icon: '🐴', gradient: 'from-orange-400 to-red-600', Component: PonytaGame },
  { id: 'hammer', title: 'Búa sức mạnh Machop', description: 'Đập thật mạnh, rung chuông DING!', icon: '💪', gradient: 'from-rose-500 to-purple-700', Component: HammerGame },
  { id: 'wheel', title: 'Vòng quay may mắn', description: 'Dùng vé quay trúng vàng, quả mọng!', icon: '🎡', gradient: 'from-fuchsia-500 to-amber-500', Component: WheelGame },
];

export const findCarnivalGame = (id) => CARNIVAL_GAMES.find((g) => g.id === id) || null;
