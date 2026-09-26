import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Volume2, Music, Sparkles, Heart, Gamepad2 } from 'lucide-react';
import { getCardMedia } from '../services/pokemonOnlineService';
import { playCry } from '../utils/cries';
import { sounds } from '../utils/soundEffects';
import {
  BERRIES,
  BERRY_TYPES,
  DAILY_FEED_LIMIT,
  MAX_FRIENDSHIP,
  favoriteBerry,
  levelFor,
  levelProgress,
} from '../utils/friendship';
import { BerryIcon } from './BerryIcon';
import { GamePicker } from './GamePicker';
import { itemById, wornItem, roomItems } from '../utils/shopItems';

const EAT_DELAY_MS = 450;

const MESSAGES = {
  full: (name) => `${name} no căng bụng rồi! Mai cho ăn tiếp nhé 😊`,
  noBerry: () => 'Hết quả này rồi! Chơi Chạy Nhảy để nhặt thêm nhé.',
  max: (name) => `${name} đã là bạn thân nhất của bé rồi! ❤️`,
  error: () => 'Chưa cho ăn được, thử lại nhé.',
};

const GIFT_MESSAGES = {
  full: (name) => `${name} ăn no quà vặt rồi! Mai cho ăn tiếp nhé 😊`,
  played: (name, item) => `${name} đã chơi ${item.name} hôm nay rồi. Thử đồ chơi khác nhé!`,
  owned: (name, item) => `${name} đã có ${item.name} rồi!`,
};
const ROOM_SPOTS = ['left-0 bottom-1', 'right-0 bottom-1', '-left-2 top-6', '-right-2 top-6'];

/**
 * "Your Pokemon" panel: big artwork children can tap (it hops, hearts float up and the
 * real cry plays), care (friendship + feeding berries from the runner game), a shiny
 * toggle once a shiny was found, and buttons for the minigames.
 *
 * care = { enabled, friendship, fedToday, favoriteFound, berries: { oran, razz } }
 * onFeed(berry) and onPet() return the outcome from storage (see utils/storage.js).
 */
export function PokemonBuddy({
  pokemon,
  shinyUnlocked = false,
  showShiny,
  onToggleShiny,
  games = [],
  catchCount = 0,
  care = { enabled: false },
  onFeed,
  onPet,
  gifts = { enabled: false },
}) {
  const [hearts, setHearts] = useState([]);
  const [hopKey, setHopKey] = useState(0);
  const [flyingBerry, setFlyingBerry] = useState(null);
  const [floatText, setFloatText] = useState(null);
  const [message, setMessage] = useState(null);
  const [levelUp, setLevelUp] = useState(null);
  const [showGames, setShowGames] = useState(false);
  const [giving, setGiving] = useState(null); // item flying to the Pokemon
  const [toyPlay, setToyPlay] = useState(null);
  const [sparkle, setSparkle] = useState(0);
  const heartId = useRef(0);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const { shinyImage } = getCardMedia(pokemon);
  const canShowShiny = (shinyUnlocked || pokemon.isShiny) && !!shinyImage;
  const image = canShowShiny && showShiny ? shinyImage : pokemon.fallbackImage || pokemon.image;

  const friendship = care.friendship || 0;
  const level = levelFor(friendship);
  const favorite = favoriteBerry(pokemon);

  const burstHearts = (count = 1) => {
    setHopKey((k) => k + 1);
    for (let i = 0; i < count; i++) {
      const id = ++heartId.current;
      setHearts((list) => [...list, { id, left: 25 + Math.random() * 50, delay: i * 90 }]);
      later(() => setHearts((list) => list.filter((h) => h.id !== id)), 1200 + i * 90);
    }
  };

  const celebrate = (newLevel) => {
    setLevelUp(newLevel);
    sounds.playSuccessFanfare();
    try {
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.5 }, colors: ['#f472b6', '#fb7185', '#fde047', '#ffffff'] });
    } catch {
      // ignore
    }
    later(() => setLevelUp(null), 2600);
  };

  const pet = () => {
    burstHearts(1);
    playCry(pokemon);
    const outcome = care.enabled ? onPet?.() : null;
    if (outcome?.levelUp) celebrate(outcome.levelUp);
  };

  const feed = (berry) => {
    if (!care.enabled || flyingBerry) return;
    const outcome = onFeed?.(berry);
    if (!outcome) return;
    if (outcome.result !== 'fed') {
      setMessage(MESSAGES[outcome.result]?.(pokemon.name) || MESSAGES.error());
      later(() => setMessage(null), 2500);
      return;
    }
    setMessage(null);
    setFlyingBerry({ type: berry, key: ++heartId.current });
    later(() => {
      setFlyingBerry(null);
      sounds.playMunch();
      burstHearts(outcome.favorite ? 5 : 3);
      setFloatText({ text: outcome.favorite ? `+${outcome.gain} Món yêu thích!` : `+${outcome.gain}`, key: ++heartId.current });
      later(() => setFloatText(null), 1200);
      if (outcome.levelUp) celebrate(outcome.levelUp);
    }, EAT_DELAY_MS);
  };

  const worn = wornItem(gifts.card);
  const room = roomItems(gifts.card);
  const bagItems = Object.entries(gifts.bag || {}).map(([id, count]) => ({ item: itemById(id), count })).filter((x) => x.item);

  const give = (itemId) => {
    if (!gifts.enabled || giving || flyingBerry) return;
    const item = itemById(itemId);
    const outcome = gifts.onGive?.(itemId);
    if (!outcome || !item) return;
    if (outcome.result !== 'ok') {
      setMessage(GIFT_MESSAGES[outcome.result]?.(pokemon.name, item) || MESSAGES.error());
      later(() => setMessage(null), 2500);
      return;
    }
    setMessage(null);
    setGiving({ emoji: item.emoji, key: ++heartId.current });
    later(() => {
      setGiving(null);
      if (item.category === 'food') {
        sounds.playMunch();
        burstHearts(3);
      } else if (item.category === 'toy') {
        setToyPlay({ emoji: item.emoji, key: ++heartId.current });
        sounds.playJump();
        burstHearts(2);
        later(() => setToyPlay(null), 1300);
      } else {
        setSparkle((n) => n + 1);
        sounds.playSuccessFanfare();
        burstHearts(4);
      }
      if (outcome.gain > 0) {
        setFloatText({ text: `+${outcome.gain} ❤️`, key: ++heartId.current });
        later(() => setFloatText(null), 1200);
      }
      if (outcome.levelUp) celebrate(outcome.levelUp);
    }, EAT_DELAY_MS);
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
        <img key={`hop-${hopKey}`} src={image} alt={pokemon.name} draggable={false} className={`w-40 h-40 object-contain ${hopKey ? 'poke-hop' : ''}`} />
        {hearts.map((h) => (
          <span key={`heart-${h.id}`} aria-hidden="true" className="heart-float absolute top-8 text-2xl" style={{ left: `${h.left}%`, animationDelay: `${h.delay}ms` }}>
            ❤️
          </span>
        ))}
        {worn && (
          <span key={`w${sparkle}`} aria-label={`Đang đội ${worn.name}`} className={`absolute left-1/2 -translate-x-1/2 top-0 text-4xl drop-shadow-lg pointer-events-none ${sparkle ? 'pop-in' : ''}`}>
            {worn.emoji}
          </span>
        )}
        {room.slice(0, ROOM_SPOTS.length).map((item, i) => (
          <span key={item.id} aria-label={item.name} className={`absolute ${ROOM_SPOTS[i]} text-3xl drop-shadow pointer-events-none`}>
            {item.emoji}
          </span>
        ))}
        {sparkle > 0 && <span key={`s${sparkle}`} className="sparkle-ring absolute inset-4 rounded-full border-4 border-amber-300 pointer-events-none" />}
        {giving && (
          <span key={`gift-${giving.key}`} data-testid="flying-gift" className="berry-fly absolute left-1/2 bottom-0 text-3xl">
            {giving.emoji}
          </span>
        )}
        {toyPlay && (
          <span key={`toy-${toyPlay.key}`} className="toy-play absolute left-1/2 bottom-6 text-4xl pointer-events-none">
            {toyPlay.emoji}
          </span>
        )}
        {flyingBerry && (
          <span data-testid="flying-berry" className="berry-fly absolute left-1/2 bottom-0">
            <BerryIcon type={flyingBerry.type} className="w-8 h-8" />
          </span>
        )}
        {floatText && (
          <span key={`float-${floatText.key}`} role="status" className="gain-float absolute top-2 left-1/2 whitespace-nowrap px-2 py-0.5 rounded-full bg-pink-500 text-white text-sm font-black shadow">
            {floatText.text}
          </span>
        )}
        {levelUp && (
          <span role="status" className="level-pop absolute inset-x-0 -bottom-3 mx-auto w-max px-3 py-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-black shadow-lg">
            🎉 Giờ là {levelUp.label}!
          </span>
        )}
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

      {/* Care: friendship and feeding */}
      <div className="w-full rounded-2xl border border-slate-700 bg-slate-900/50 p-3 space-y-2.5" aria-label="Chăm sóc Pokémon">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-black text-slate-100">{level.label}</span>
          <span className="flex items-center gap-0.5" aria-label={`Thân thiết ${friendship}/${MAX_FRIENDSHIP}`}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Heart key={i} className={`w-4 h-4 ${i < level.hearts ? 'fill-rose-500 text-rose-500' : 'text-slate-600'}`} />
            ))}
          </span>
        </div>
        <div className="h-3 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-label="Thân thiết" aria-valuemin={0} aria-valuemax={MAX_FRIENDSHIP} aria-valuenow={friendship}>
          <div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-500 transition-[width] duration-700 ease-out" style={{ width: `${levelProgress(friendship) * 100}%` }} />
        </div>

        {care.enabled ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {BERRY_TYPES.map((type) => {
                const count = care.berries?.[type] || 0;
                return (
                  <button
                    key={type}
                    onClick={() => feed(type)}
                    aria-label={`Cho ăn quả ${BERRIES[type].name} (còn ${count})`}
                    className={`py-2.5 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-black transition-transform active:scale-95 ${
                      count > 0 ? 'border-pink-400/60 bg-pink-500/10 text-slate-100' : 'border-slate-700 bg-slate-900 text-slate-500'
                    }`}
                  >
                    <BerryIcon type={type} className="w-6 h-6" />
                    {BERRIES[type].name} x{count}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 flex items-center justify-between gap-2">
              <span>Hôm nay đã ăn {Math.min(care.fedToday || 0, DAILY_FEED_LIMIT)}/{DAILY_FEED_LIMIT}</span>
              <span className="flex items-center gap-1">
                {care.favoriteFound ? (
                  <>
                    ❤️ Thích nhất: <BerryIcon type={favorite} className="w-4 h-4" /> {BERRIES[favorite].name}
                  </>
                ) : (
                  'Bạn ấy thích quả nào nhất nhỉ?'
                )}
              </span>
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-400">Quét thẻ {pokemon.name} để chăm sóc bạn ấy nhé!</p>
        )}
        {gifts.enabled && (
          <div className="pt-2 border-t border-slate-700/70" aria-label="Tặng quà">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-slate-100">🎁 Tặng quà</span>
              <button onClick={gifts.onOpenShop} className="px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-200 text-xs font-black active:scale-95">
                🪙 Tiệm quà
              </button>
            </div>
            {bagItems.length ? (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {bagItems.map(({ item, count }) => (
                  <button
                    key={item.id}
                    onClick={() => give(item.id)}
                    aria-label={`Tặng ${item.name}`}
                    className="relative shrink-0 w-16 py-1.5 rounded-xl border-2 border-amber-400/40 bg-amber-500/10 flex flex-col items-center active:scale-95 transition-transform"
                  >
                    <span className="text-3xl">{item.emoji}</span>
                    <span className="text-[10px] font-bold text-slate-200 truncate w-full text-center">{item.name}</span>
                    {item.category !== 'toy' && <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-amber-400 text-slate-900 text-[11px] font-black flex items-center justify-center">{count}</span>}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-400">Túi quà đang trống. Chơi game để có vàng rồi ghé Tiệm quà nhé!</p>
            )}
          </div>
        )}
        {message && (
          <p role="alert" className="text-sm font-bold text-amber-300 text-center">
            {message}
          </p>
        )}
      </div>

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
        {games.length > 0 && (
          // One button instead of a long list: the games open in a bottom sheet
          <button
            onClick={() => setShowGames(true)}
            className="col-span-2 py-4 rounded-2xl bg-gradient-to-r from-red-500 via-rose-500 to-orange-500 text-white text-lg font-black flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 active:scale-95 transition-transform"
          >
            <Gamepad2 className="w-6 h-6" /> Chơi cùng {pokemon.name}
            <span className="px-2 py-0.5 rounded-full bg-white/25 text-xs">{games.length} trò</span>
          </button>
        )}
      </div>

      {showGames && (
        <GamePicker pokemonName={pokemon.name} image={image} games={games} onClose={() => setShowGames(false)} />
      )}
    </div>
  );
}
