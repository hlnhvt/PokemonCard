import { MazeGame } from './MazeGame';
import { MathGame } from './MathGame';
import { EnglishGame } from './EnglishGame';
import { MemoryGame } from './MemoryGame';
import { MusicGame } from './MusicGame';
import { PairsGame } from './PairsGame';
import { RhythmGame } from './RhythmGame';
import { OddOneGame } from './OddOneGame';
import { SpotGame } from './SpotGame';

/** Simple thinking games with the child's Pokemon, listed in the game picker and the Games tab. */
export const LOGIC_GAMES = [
  { id: 'maze', title: 'Thoát mê cung', description: 'Vuốt để dẫn Pokémon tới quả Pokéball', icon: '🌿', gradient: 'from-green-500 to-emerald-600', Component: MazeGame },
  { id: 'math', title: 'Làm toán', description: 'Đếm, cộng, trừ với hình ảnh', icon: '🔢', gradient: 'from-sky-500 to-indigo-500', Component: MathGame },
  { id: 'english', title: 'Học tiếng Anh', description: 'Nghe, nhìn hình, học từ cùng nghĩa', icon: '🔤', gradient: 'from-amber-500 to-rose-500', Component: EnglishGame },
  { id: 'memory', title: 'Nhớ thứ tự', description: 'Nhớ Pokémon xuất hiện theo thứ tự', icon: '🧠', gradient: 'from-violet-500 to-fuchsia-500', Component: MemoryGame },
  { id: 'music', title: 'Chơi nhạc', description: 'Gõ đàn theo hướng dẫn thành bài hát', icon: '🎵', gradient: 'from-purple-600 to-pink-500', Component: MusicGame },
  { id: 'pairs', title: 'Lật thẻ tìm cặp', description: 'Lật hai thẻ giống nhau, học hệ Pokémon', icon: '🃏', gradient: 'from-indigo-500 to-sky-500', Component: PairsGame },
  { id: 'rhythm', title: 'Nhảy theo nhạc', description: 'Chạm đúng nhịp, Pokémon nhảy múa', icon: '💃', gradient: 'from-fuchsia-500 to-rose-500', Component: RhythmGame },
  { id: 'oddone', title: 'Cái nào khác loại?', description: 'Tìm bạn không cùng nhóm, rèn tư duy', icon: '🔍', gradient: 'from-cyan-500 to-blue-600', Component: OddOneGame },
  { id: 'spot', title: 'Tìm điểm khác nhau', description: 'So hai hình, tìm chỗ khác biệt', icon: '🔎', gradient: 'from-lime-500 to-emerald-600', Component: SpotGame },
];

export const findLogicGame = (id) => LOGIC_GAMES.find((g) => g.id === id) || null;
