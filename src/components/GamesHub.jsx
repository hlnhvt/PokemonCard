import React, { useState } from 'react';
import { Target, Lock } from 'lucide-react';
import { GuessGame } from './GuessGame';
import { RunnerGame } from './RunnerGame';
import { BattleArena } from './BattleArena';
import { CookingGame } from './kidgames/CookingGame';
import { ShopGame } from './kidgames/ShopGame';
import { SPORTS, findSport } from './sports';
import { LOGIC_GAMES, findLogicGame } from './logic';
import { PokeballIcon } from './PokeballIcon';
import { TeamBattle } from './team/TeamBattle';
import { artworkUrl, getCardMedia } from '../services/pokemonOnlineService';
import { BERRY_TYPES, BERRIES } from '../utils/friendship';
import { BerryIcon } from './BerryIcon';

const playerImage = (card) =>
  (card.shinyUnlocked && getCardMedia(card).shinyImage) || card.fallbackImage || card.image || artworkUrl(Number(card.pokedexNumber));

const PLAY_GAMES = [
  { id: 'runner', title: 'Chạy nhảy', description: 'Nhảy qua chướng ngại', icon: '🏃', gradient: 'from-emerald-500 to-teal-500' },
  { id: 'battle', title: 'Đấu Pokémon', description: 'Tuyệt Kỹ Liên Hoàn', icon: '⚔️', gradient: 'from-orange-500 via-red-500 to-purple-600' },
  { id: 'cooking', title: 'Bếp Pokémon', description: 'Nấu món cho khách', icon: '🍳', gradient: 'from-amber-500 to-orange-500' },
  { id: 'shop', title: 'Cửa hàng', description: 'Bán hàng, đếm xu', icon: '🏪', gradient: 'from-sky-500 to-indigo-500' },
];

const SECTIONS = [
  { id: 'play', title: '🎮 Vui chơi', games: PLAY_GAMES },
  { id: 'sport', title: '🏆 Thi đấu thể thao', games: SPORTS },
  { id: 'logic', title: '🧠 Trò chơi trí tuệ', games: LOGIC_GAMES },
];

function GameTile({ game, onPlay, locked }) {
  return (
    <button
      onClick={onPlay}
      disabled={locked}
      aria-label={locked ? `${game.title} (cần quét thẻ)` : game.title}
      className={`relative rounded-2xl p-3 flex flex-col items-center gap-0.5 text-center text-white bg-gradient-to-br ${game.gradient} shadow-lg active:scale-95 transition-transform ${locked ? 'grayscale opacity-50' : ''}`}
    >
      <span className="text-4xl" aria-hidden="true">{game.icon}</span>
      <span className="text-sm font-black leading-tight">{game.title}</span>
      <span className="text-[11px] font-semibold text-white/85 leading-tight">{game.description}</span>
      {locked && <Lock className="absolute top-2 right-2 w-4 h-4" aria-hidden="true" />}
    </button>
  );
}

/**
 * Games tab: every game is played with one of the child's scanned Pokemon. Before the
 * first scan the games stay locked (only the silhouette quiz is open).
 */
export function GamesHub({ collection = [], berries, onBerries, onBattleResult, onOpenCollection, onGold, onOpenShop, onScan, onTeamScan, teamUseScanned = false }) {
  const [selectedId, setSelectedId] = useState(collection[0]?.id || null);
  const [playing, setPlaying] = useState(null); // { section, id }
  const selected = collection.find((c) => c.id === selectedId) || collection[0] || null;
  const locked = !selected;
  const player = selected ? { name: selected.name, image: playerImage(selected) } : null;
  const card = selected ? { ...selected, fallbackImage: playerImage(selected) } : null;
  const close = () => setPlaying(null);
  const is = (id) => playing?.id === id;

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-4 sm:py-6 pb-24 space-y-4 animate-fadeIn">
      <h2 className="text-xl sm:text-2xl font-black text-slate-50 text-center">🎮 Trò Chơi Pokémon</h2>

      {locked ? (
        <div className="glass-panel rounded-3xl p-5 flex flex-col items-center gap-3 text-center" data-testid="games-locked">
          <div className="relative">
            <PokeballIcon className="w-20 h-20 sport-bob" />
            <span className="absolute -right-2 -bottom-1 text-3xl" aria-hidden="true">🔒</span>
          </div>
          <p className="text-lg font-black text-slate-50">Quét thẻ Pokémon đầu tiên để mở khóa trò chơi!</p>
          <p className="text-sm text-slate-300">Mỗi trò chơi bé sẽ chơi cùng Pokémon mình đã quét, và nhận vàng 🪙 để mua quà trong Tiệm quà.</p>
          <button onClick={onScan} className="px-6 py-3 rounded-2xl bg-gradient-to-r from-red-500 to-rose-500 text-white text-lg font-black shadow-lg flex items-center gap-2 active:scale-95">
            <PokeballIcon className="w-6 h-6" /> Quét thẻ ngay
          </button>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-black text-slate-50">Chơi cùng Pokémon nào?</h3>
            <button onClick={onOpenShop} className="px-3 py-1.5 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-200 text-sm font-black active:scale-95">
              🎁 Tiệm quà
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Chọn Pokémon để chơi">
            {collection.map((c) => {
              const active = c.id === selected.id;
              return (
                <button
                  key={c.id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelectedId(c.id)}
                  className={`shrink-0 w-20 p-1.5 rounded-2xl border-2 flex flex-col items-center transition-transform active:scale-95 ${active ? 'border-emerald-400 bg-emerald-400/15' : 'border-slate-700 bg-slate-900/60'}`}
                >
                  <img src={playerImage(c)} alt="" className="w-14 h-14 object-contain" loading="lazy" />
                  <span className="text-[11px] font-bold text-slate-100 truncate w-full text-center">{c.name}</span>
                </button>
              );
            })}
          </div>
          {berries && (
            <div className="flex items-center gap-3 text-sm font-bold text-slate-200" aria-label="Túi quả mọng">
              <span className="text-slate-400">Túi:</span>
              {BERRY_TYPES.map((t) => (
                <span key={t} className="flex items-center gap-1">
                  <BerryIcon type={t} className="w-5 h-5" /> {BERRIES[t].name} x{berries[t] || 0}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5 vs 5 team battle: open even before the first scan (cards are scanned while building the team) */}
      <button
        onClick={() => setPlaying({ section: 'team', id: 'team' })}
        className="relative w-full overflow-hidden rounded-3xl p-4 text-left text-white shadow-2xl bg-gradient-to-r from-red-600 via-rose-600 to-purple-700 border-2 border-amber-300/70 active:scale-[0.98] transition-transform"
        aria-label="Đấu đội 5 vs 5"
      >
        <div className="vs-rays absolute inset-0 opacity-20" />
        <div className="relative flex items-center gap-3">
          <span className="text-5xl drop-shadow" aria-hidden="true">🏆</span>
          <div className="flex-1 min-w-0">
            <p className="text-xl font-black">Đấu đội 5 vs 5</p>
            <p className="text-xs font-bold text-white/90">Quét thẻ lập đội, chọn sàn đấu, giành cúp vô địch!</p>
            <div className="mt-1.5 flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => <PokeballIcon key={i} className="w-5 h-5" />)}
            </div>
          </div>
          <span className="px-2 py-1 rounded-full bg-amber-300 text-slate-900 text-[11px] font-black shadow">+45 🪙</span>
        </div>
      </button>

      {SECTIONS.map((section) => (
        <section key={section.id} className="glass-panel rounded-3xl p-4 space-y-3" aria-label={section.title}>
          <h3 className="text-lg font-black text-slate-50">
            {section.title}
            {selected && <span className="ml-1 text-sm font-bold text-slate-400">cùng {selected.name}</span>}
          </h3>
          <div className={`grid gap-3 ${section.games.length % 3 === 0 || section.games.length > 4 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {section.games.map((g) => (
              <GameTile key={g.id} game={g} locked={locked} onPlay={() => setPlaying({ section: section.id, id: g.id })} />
            ))}
          </div>
        </section>
      ))}

      {/* Silhouette quiz: guessing other Pokemon is open to everyone */}
      <GuessGame collection={collection} onGold={onGold} />

      {selected && (
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
          <Target className="w-8 h-8 text-red-400 shrink-0" />
          <p className="text-sm text-slate-300 flex-1">
            Muốn chơi <strong className="text-slate-100">Ném Bóng Bắt Pokémon</strong>? Mở một Pokémon trong bộ sưu tập nhé!
          </p>
          <button onClick={onOpenCollection} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold shrink-0">
            Mở bộ sưu tập
          </button>
        </div>
      )}

      {playing?.section === 'team' && <TeamBattle collection={collection} allowScanned={teamUseScanned} onScanned={onTeamScan} onGold={onGold} onClose={close} />}
      {selected && is('battle') && <BattleArena card={card} onClose={close} onResult={(result) => onBattleResult?.(selected.id, result)} />}
      {selected && is('cooking') && <CookingGame chef={card} onBerries={onBerries} onGold={onGold} onClose={close} />}
      {selected && is('shop') && <ShopGame shopkeeper={card} onBerries={onBerries} onGold={onGold} onClose={close} />}
      {selected && is('runner') && <RunnerGame pokemon={selected} image={player.image} onBerries={onBerries} onGold={onGold} onClose={close} />}
      {selected && (playing?.section === 'sport' || playing?.section === 'logic') && (() => {
        const Game = (playing.section === 'sport' ? findSport(playing.id) : findLogicGame(playing.id)).Component;
        return <Game player={player} onBerries={onBerries} onGold={onGold} onClose={close} />;
      })()}
    </div>
  );
}
