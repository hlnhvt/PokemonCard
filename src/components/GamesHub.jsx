import React, { useState } from 'react';
import { Footprints, Target, Sparkles, Swords } from 'lucide-react';
import { GuessGame } from './GuessGame';
import { RunnerGame } from './RunnerGame';
import { BattleArena } from './BattleArena';
import { CookingGame } from './kidgames/CookingGame';
import { ShopGame } from './kidgames/ShopGame';
import { artworkUrl, getCardMedia } from '../services/pokemonOnlineService';
import { BERRY_TYPES, BERRIES } from '../utils/friendship';
import { BerryIcon } from './BerryIcon';

// Runner used before the child has scanned any card
const DEFAULT_RUNNER = { id: 'pikachu', name: 'Pikachu', pokedexNumber: '025', types: ['Electric'], fallbackImage: artworkUrl(25) };

const runnerImage = (card) =>
  (card.shinyUnlocked && getCardMedia(card).shinyImage) || card.fallbackImage || card.image || artworkUrl(Number(card.pokedexNumber));

export function GamesHub({ collection = [], berries, onBerries, onBattleResult, onOpenCollection }) {
  const choices = collection.length > 0 ? collection : [DEFAULT_RUNNER];
  const [selectedId, setSelectedId] = useState(choices[0].id);
  const [running, setRunning] = useState(false);
  const [battling, setBattling] = useState(false);
  const [cooking, setCooking] = useState(false);
  const [shopping, setShopping] = useState(false);
  const selected = choices.find((c) => c.id === selectedId) || choices[0];

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-4 sm:py-6 pb-24 space-y-4 animate-fadeIn">
      <h2 className="text-xl sm:text-2xl font-black text-slate-50 text-center">🎮 Trò Chơi Pokémon</h2>

      {/* Runner */}
      <div className="glass-panel rounded-3xl p-4 sm:p-5 space-y-3">
        <h3 className="text-lg font-black text-slate-50 flex items-center gap-2">
          <Footprints className="w-6 h-6 text-emerald-400" /> Pokémon Chạy Nhảy
        </h3>
        <p className="text-sm text-slate-300">Nhảy qua đá, bụi cỏ và những Pokémon khác. Quả mọng nhặt được sẽ vào túi để cho Pokémon ăn!</p>
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

        <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Chọn Pokémon để chạy">
          {choices.map((card) => {
            const active = card.id === selected.id;
            return (
              <button
                key={card.id}
                role="radio"
                aria-checked={active}
                onClick={() => setSelectedId(card.id)}
                className={`shrink-0 w-20 p-1.5 rounded-2xl border-2 flex flex-col items-center transition-transform active:scale-95 ${
                  active ? 'border-emerald-400 bg-emerald-400/15' : 'border-slate-700 bg-slate-900/60'
                }`}
              >
                <img src={runnerImage(card)} alt="" className="w-14 h-14 object-contain" loading="lazy" />
                <span className="text-[11px] font-bold text-slate-100 truncate w-full text-center">{card.name}</span>
              </button>
            );
          })}
        </div>
        {collection.length === 0 && (
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Quét thẻ để chạy bằng Pokémon của chính bé!
          </p>
        )}

        <button
          onClick={() => setRunning(true)}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-lg shadow-lg active:scale-95"
        >
          Chạy cùng {selected.name}!
        </button>
        <button
          onClick={() => setBattling(true)}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 text-white font-black text-lg shadow-lg active:scale-95 flex items-center justify-center gap-2"
        >
          <Swords className="w-5 h-5" /> Đấu Pokémon cùng {selected.name}!
        </button>
      </div>

      {/* Cooking and shop, with the selected Pokemon as chef / shopkeeper */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setCooking(true)}
          className="glass-panel rounded-3xl p-4 flex flex-col items-center gap-1 text-center active:scale-95 transition-transform"
        >
          <span className="text-5xl" aria-hidden="true">🍳</span>
          <span className="text-base font-black text-slate-50">Bếp Pokémon</span>
          <span className="text-xs text-slate-300">{selected.name} làm đầu bếp</span>
        </button>
        <button
          onClick={() => setShopping(true)}
          className="glass-panel rounded-3xl p-4 flex flex-col items-center gap-1 text-center active:scale-95 transition-transform"
        >
          <span className="text-5xl" aria-hidden="true">🏪</span>
          <span className="text-base font-black text-slate-50">Cửa hàng Pokémon</span>
          <span className="text-xs text-slate-300">{selected.name} bán hàng</span>
        </button>
      </div>

      {/* Silhouette quiz */}
      <GuessGame collection={collection} />

      {/* Catch game lives on each Pokemon's page */}
      <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
        <Target className="w-8 h-8 text-red-400 shrink-0" />
        <p className="text-sm text-slate-300 flex-1">
          Muốn chơi <strong className="text-slate-100">Ném Bóng Bắt Pokémon</strong>? Mở một Pokémon trong bộ sưu tập nhé!
        </p>
        <button onClick={onOpenCollection} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold shrink-0">
          Mở bộ sưu tập
        </button>
      </div>

      {battling && (
        <BattleArena
          card={{ ...selected, fallbackImage: runnerImage(selected) }}
          onClose={() => setBattling(false)}
          onResult={(result) => collection.length > 0 && onBattleResult?.(selected.id, result)}
        />
      )}
      {cooking && <CookingGame chef={{ ...selected, fallbackImage: runnerImage(selected) }} onBerries={onBerries} onClose={() => setCooking(false)} />}
      {shopping && <ShopGame shopkeeper={{ ...selected, fallbackImage: runnerImage(selected) }} onBerries={onBerries} onClose={() => setShopping(false)} />}
      {running && <RunnerGame pokemon={selected} image={runnerImage(selected)} onBerries={onBerries} onClose={() => setRunning(false)} />}
    </div>
  );
}
