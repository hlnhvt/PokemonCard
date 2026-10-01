import { lazy } from 'react';

// three.js is only downloaded when one of these games is opened
const Run3DGame = lazy(() => import('./run3d/Run3DGame').then((m) => ({ default: m.Run3DGame })));
const Sky3DGame = lazy(() => import('./sky3d/Sky3DGame').then((m) => ({ default: m.Sky3DGame })));
const Island3DGame = lazy(() => import('./island3d/Island3DGame').then((m) => ({ default: m.Island3DGame })));
const Gulp3DGame = lazy(() => import('./gulp3d/Gulp3DGame').then((m) => ({ default: m.Gulp3DGame })));
const Pinball3DGame = lazy(() => import('./pinball3d/Pinball3DGame').then((m) => ({ default: m.Pinball3DGame })));

/** 3D games (three.js), listed in the Games tab. */
export const GAMES_3D = [
  { id: 'run3d', title: 'Chạy 3 làn', description: 'Vuốt đổi làn, nhảy, trượt qua 4 vùng đất', icon: '🏃', gradient: 'from-sky-400 to-emerald-500', Component: Run3DGame },
  { id: 'sky3d', title: 'Cưỡi Charizard', description: 'Bay xuyên vòng sáng trên đảo mây', icon: '🔥', gradient: 'from-sky-400 to-orange-500', Component: Sky3DGame },
  { id: 'island3d', title: 'Đảo nhà Pokémon', description: 'Xây đảo khối vuông, thực hiện điều ước', icon: '🏝️', gradient: 'from-emerald-400 via-sky-400 to-cyan-500', Component: Island3DGame },
  { id: 'gulp3d', title: 'Snorlax nuốt thành phố', description: 'Ăn đồ nhỏ để lớn dần, nuốt cả tòa tháp!', icon: '😋', gradient: 'from-teal-400 via-emerald-400 to-lime-400', Component: Gulp3DGame },
  { id: 'pinball3d', title: 'Pinball Pokémon', description: 'Lật cần giữ bóng, bắt Pokémon hoang dã', icon: '🎯', gradient: 'from-indigo-500 via-fuchsia-500 to-amber-400', Component: Pinball3DGame },
];

export const findGame3D = (id) => GAMES_3D.find((g) => g.id === id) || null;
