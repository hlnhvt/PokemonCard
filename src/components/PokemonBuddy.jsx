import React, { useRef, useState } from 'react';
import { Volume2, Music, Sparkles, Target } from 'lucide-react';
import { getCardMedia } from '../services/pokemonOnlineService';
import { playCry } from '../utils/cries';

/**
 * "Your Pokemon" panel: big artwork children can tap (it hops, hearts float up and the
 * real cry plays), a shiny toggle once a shiny was found, and the catch minigame button.
 */
export function PokemonBuddy({ pokemon, shinyUnlocked = false, showShiny, onToggleShiny, onPlayCatch, catchCount = 0 }) {
  const [hearts, setHearts] = useState([]);
  const [hopKey, setHopKey] = useState(0);
  const heartId = useRef(0);
  const { shinyImage } = getCardMedia(pokemon);
  const canShowShiny = (shinyUnlocked || pokemon.isShiny) && !!shinyImage;
  const image = canShowShiny && showShiny ? shinyImage : pokemon.fallbackImage || pokemon.image;

  const pet = () => {
    setHopKey((k) => k + 1);
    const id = ++heartId.current;
    setHearts((list) => [...list, { id, left: 30 + Math.random() * 40 }]);
    setTimeout(() => setHearts((list) => list.filter((h) => h.id !== id)), 1100);
    playCry(pokemon);
  };

  return (
    <div className="glass-panel p-4 rounded-2xl flex flex-col items-center gap-3">
      <div className="w-full flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-300">Pokémon của bé</h3>
        {catchCount > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
            Đã bắt {catchCount} lần
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={pet}
        aria-label={`Chạm vào ${pokemon.name}`}
        className="relative w-48 h-48 rounded-full bg-gradient-to-b from-sky-300/30 to-emerald-300/20 border-4 border-slate-700 flex items-center justify-center"
      >
        {canShowShiny && showShiny && (
          <>
            <Sparkles className="absolute top-3 left-5 w-6 h-6 text-yellow-300 shiny-twinkle" />
            <Sparkles className="absolute bottom-6 right-4 w-5 h-5 text-yellow-300 shiny-twinkle" style={{ animationDelay: '0.6s' }} />
          </>
        )}
        <img key={hopKey} src={image} alt={pokemon.name} draggable={false} className={`w-40 h-40 object-contain ${hopKey ? 'poke-hop' : ''}`} />
        {hearts.map((h) => (
          <span key={h.id} aria-hidden="true" className="heart-float absolute top-8 text-2xl" style={{ left: `${h.left}%` }}>
            ❤️
          </span>
        ))}
      </button>
      <p className="text-xs text-slate-400">Chạm vào {pokemon.name} để chơi cùng bạn ấy nhé!</p>

      {canShowShiny && (
        <div className="flex rounded-xl overflow-hidden border border-slate-700 text-sm font-bold" role="group" aria-label="Màu Pokémon">
          <button onClick={() => onToggleShiny?.(false)} aria-pressed={!showShiny} className={`px-4 py-2 ${!showShiny ? 'bg-cyan-500 text-white' : 'bg-slate-900 text-slate-300'}`}>
            Bình thường
          </button>
          <button onClick={() => onToggleShiny?.(true)} aria-pressed={!!showShiny} className={`px-4 py-2 flex items-center gap-1 ${showShiny ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-300'}`}>
            <Sparkles className="w-4 h-4" /> Shiny
          </button>
        </div>
      )}

      <div className="w-full grid grid-cols-2 gap-2">
        <button onClick={() => playCry(pokemon)} className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-bold text-slate-100 flex items-center justify-center gap-1.5">
          <Volume2 className="w-4 h-4 text-amber-400" /> Nghe tiếng kêu
        </button>
        {pokemon.cryLegacyUrl ? (
          <button onClick={() => playCry(pokemon, { legacy: true })} className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-bold text-slate-100 flex items-center justify-center gap-1.5">
            <Music className="w-4 h-4 text-cyan-400" /> Tiếng kêu cổ điển
          </button>
        ) : (
          <span />
        )}
        <button onClick={onPlayCatch} className="col-span-2 py-3.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white text-base font-black flex items-center justify-center gap-2 shadow-lg active:scale-95">
          <Target className="w-5 h-5" /> Chơi Ném Bóng Bắt {pokemon.name}!
        </button>
      </div>
    </div>
  );
}
