import { MazeGame } from './MazeGame';
import { MathGame } from './MathGame';
import { EnglishGame } from './EnglishGame';
import { MemoryGame } from './MemoryGame';
import { MusicGame } from './MusicGame';

/** Simple thinking games with the child's Pokemon, listed in the game picker and the Games tab. */
export const LOGIC_GAMES = [
  { id: 'maze', title: 'Thoát mê cung', description: 'Vuốt để dẫn Pokémon tới quả Pokéball', icon: '🌿', gradient: 'from-green-500 to-emerald-600', Component: MazeGame },
  { id: 'math', title: 'Làm toán', description: 'Đếm, cộng, trừ với hình ảnh', icon: '🔢', gradient: 'from-sky-500 to-indigo-500', Component: MathGame },
  { id: 'english', title: 'Học tiếng Anh', description: 'Nghe, nhìn hình, học từ cùng nghĩa', icon: '🔤', gradient: 'from-amber-500 to-rose-500', Component: EnglishGame },
  { id: 'memory', title: 'Nhớ thứ tự', description: 'Nhớ Pokémon xuất hiện theo thứ tự', icon: '🧠', gradient: 'from-violet-500 to-fuchsia-500', Component: MemoryGame },
  { id: 'music', title: 'Chơi nhạc', description: 'Gõ đàn theo hướng dẫn thành bài hát', icon: '🎵', gradient: 'from-purple-600 to-pink-500', Component: MusicGame },
];

export const findLogicGame = (id) => LOGIC_GAMES.find((g) => g.id === id) || null;
