import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  CheckCircle,
  AlertTriangle,
  RotateCw,
  Play,
  Volume2,
  Sparkles,
  Swords,
  Bookmark,
  Share2,
  Flame,
  Award,
  Search
} from 'lucide-react';
import { sounds } from '../utils/soundEffects';
import { playCry } from '../utils/cries';
import { PokemonBuddy } from './PokemonBuddy';
import { EvolutionTree } from './EvolutionTree';
import { CatchGame } from './CatchGame';
import { RunnerGame } from './RunnerGame';
import { BattleArena } from './BattleArena';
import { CookingGame } from './kidgames/CookingGame';
import { ShopGame } from './kidgames/ShopGame';
import { SPORTS, findSport } from './sports';
import { LOGIC_GAMES, findLogicGame } from './logic';
import { rankOf, GAME_RANK } from '../utils/pokemonRank';
import { getCardMedia } from '../services/pokemonOnlineService';
import { fedToday } from '../utils/friendship';

const DEFAULT_THEME = { primary: '#AAAA99', secondary: '#777766', accent: '#CCCCBB', glow: 'rgba(170, 170, 153, 0.6)' };

/**
 * mode 'saved': a card from the child's collection (just scanned or opened from it).
 * mode 'preview': a Pokemon opened from the evolution tree that is not collected yet.
 */
export function PokemonCardDetail({
  pokemon: rawPokemon,
  savedItem,
  mode = 'saved',
  onScanNext,
  onReplayVideo,
  onViewCollection,
  onEvolve,
  onExplore,
  onCaught,
  berries,
  onFeed,
  onPet,
  onBerries,
  onBattleResult,
  onGold,
  bag = {},
  onGive,
  onOpenShop,
  ownedSpecies,
}) {
  const isPreview = mode === 'preview';
  const [showShiny, setShowShiny] = useState(!!rawPokemon.isShiny);
  const [isCatching, setIsCatching] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isBattling, setIsBattling] = useState(false);
  const [isCooking, setIsCooking] = useState(false);
  const [isShopping, setIsShopping] = useState(false);
  const [extra, setExtra] = useState(null); // sports or logic game: { kind, id }

  const buddyImage = (showShiny && getCardMedia(rawPokemon).shinyImage) || rawPokemon.fallbackImage || rawPokemon.image;
  // All games for this Pokemon, shown in one picker instead of a long list of buttons
  const canBattle = !isPreview && !!savedItem;
  const games = [
    {
      id: 'catch',
      group: 'play',
      title: 'Ném bóng bắt Pokémon',
      description: 'Vuốt Pokéball để bắt bạn ấy!',
      icon: '🎯',
      gradient: 'from-red-500 to-rose-500',
      badge: savedItem?.catchCount ? `Bắt ${savedItem.catchCount} lần` : null,
      onPlay: () => setIsCatching(true),
    },
    {
      id: 'runner',
      group: 'play',
      title: 'Chạy nhảy',
      description: 'Nhảy qua chướng ngại, nhặt quả mọng',
      icon: '🏃',
      gradient: 'from-emerald-500 to-teal-500',
      onPlay: () => setIsRunning(true),
    },
    ...(canBattle
      ? [{
          id: 'battle',
          group: 'play',
          title: 'Đấu Pokémon',
          description: 'Tung chiêu thức và Tuyệt Kỹ Liên Hoàn',
          icon: '⚔️',
          gradient: 'from-orange-500 via-red-500 to-purple-600',
          badge: savedItem?.battleWins ? `Thắng ${savedItem.battleWins}` : null,
          onPlay: () => setIsBattling(true),
        }]
      : []),
    {
      id: 'cooking',
      group: 'play',
      title: 'Bếp Pokémon',
      description: 'Nấu món ngon cho khách Pokémon',
      icon: '🍳',
      gradient: 'from-amber-500 to-orange-500',
      onPlay: () => setIsCooking(true),
    },
    {
      id: 'shop',
      group: 'play',
      title: 'Cửa hàng Pokémon',
      description: 'Bán hàng và tập đếm tiền xu',
      icon: '🏪',
      gradient: 'from-sky-500 to-indigo-500',
      onPlay: () => setIsShopping(true),
    },
    ...SPORTS.map((s) => ({ id: s.id, title: s.title, description: s.description, icon: s.icon, gradient: s.gradient, group: 'sport', onPlay: () => setExtra({ kind: 'sport', id: s.id }) })),
    ...LOGIC_GAMES.map((g) => ({ id: g.id, title: g.title, description: g.description, icon: g.icon, gradient: g.gradient, group: 'logic', onPlay: () => setExtra({ kind: 'logic', id: g.id }) })),
  ];
  // Stronger Pokemon play more games (utils/pokemonRank.js)
  games.forEach((g) => {
    g.needRank = GAME_RANK[g.id] || 1;
  });
  const rank = rankOf({ ...rawPokemon, ...(savedItem || {}) });

  // Older or partially saved cards may miss fields; fill them so rendering never crashes
  const pokemon = {
    ...rawPokemon,
    themeColor: { ...DEFAULT_THEME, ...(rawPokemon.themeColor || {}) },
    types: Array.isArray(rawPokemon.types) && rawPokemon.types.length > 0 ? rawPokemon.types : ['Normal'],
    attacks: Array.isArray(rawPokemon.attacks) ? rawPokemon.attacks : [],
    weakness: rawPokemon.weakness || { type: '—', value: '' },
    resistance: rawPokemon.resistance || { type: '—', value: '' },
    retreatCost: Math.max(0, Math.min(5, Math.floor(Number(rawPokemon.retreatCost) || 0))),
  };
  const cardRef = useRef(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });
  const [shareStatus, setShareStatus] = useState(null); // null | 'copied' | 'failed'

  useEffect(() => {
    // Play celebratory sound fanfare
    sounds.playSuccessFanfare();

    // Trigger colorful confetti celebration
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.65 },
        colors: [
          rawPokemon.themeColor?.primary || DEFAULT_THEME.primary,
          rawPokemon.themeColor?.secondary || DEFAULT_THEME.secondary,
          '#FFDE00',
          '#ffffff',
        ],
      });
    } catch {
      // ignore
    }
  }, [rawPokemon]);

  // 3D Card tilt handler for mouse / touch
  const handleMouseMove = (e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rX = ((y - centerY) / centerY) * -12;
    const rY = ((x - centerX) / centerX) * 12;

    setRotateX(rX);
    setRotateY(rY);
    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
    });
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setGlarePos({ x: 50, y: 50 });
  };

  // Touch move for mobile device tilt
  const handleTouchMove = (e) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      setRotateX(((y - centerY) / centerY) * -14);
      setRotateY(((x - centerX) / centerX) * 14);
      setGlarePos({
        x: Math.max(0, Math.min(100, (x / rect.width) * 100)),
        y: Math.max(0, Math.min(100, (y / rect.height) * 100)),
      });
    }
  };

  const showShareStatus = (status) => {
    setShareStatus(status);
    setTimeout(() => setShareStatus(null), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Pokemon Card: ${pokemon.name}`,
          text: `Tôi vừa quét được thẻ bài ${pokemon.name} (${pokemon.rarity}) cực hiếm trên PokeScan AR!`,
          url: window.location.href,
        });
      } catch {
        // user cancelled share
      }
      return;
    }

    // navigator.clipboard only exists in secure contexts (not on plain HTTP LAN IPs)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(
        `Thẻ bài Pokémon: ${pokemon.name} - HP: ${pokemon.hp} - Độ hiếm: ${pokemon.rarity}`
      );
      showShareStatus('copied');
    } catch (err) {
      console.warn('Share failed:', err);
      showShareStatus('failed');
    }
  };

  const getTypeColor = (type) => {
    const t = (type || '').toLowerCase();
    const map = {
      fire: 'bg-red-500 text-white border-red-400',
      water: 'bg-blue-500 text-white border-blue-400',
      grass: 'bg-emerald-500 text-white border-emerald-400',
      electric: 'bg-amber-400 text-slate-950 border-amber-300',
      psychic: 'bg-fuchsia-500 text-white border-fuchsia-400',
      dragon: 'bg-indigo-600 text-white border-indigo-400',
      dark: 'bg-slate-800 text-slate-200 border-slate-600',
      darkness: 'bg-slate-800 text-slate-200 border-slate-600',
      fighting: 'bg-orange-700 text-white border-orange-500',
      steel: 'bg-slate-400 text-slate-900 border-slate-300',
      ice: 'bg-cyan-400 text-slate-950 border-cyan-300',
      fairy: 'bg-pink-400 text-slate-950 border-pink-300',
      normal: 'bg-stone-400 text-slate-950 border-stone-300',
      flying: 'bg-sky-400 text-slate-950 border-sky-300',
      poison: 'bg-purple-600 text-white border-purple-400',
      ground: 'bg-yellow-600 text-white border-yellow-400',
      rock: 'bg-amber-700 text-white border-amber-500',
      bug: 'bg-lime-500 text-slate-950 border-lime-400',
      ghost: 'bg-violet-700 text-white border-violet-500',
    };
    return map[t] || 'bg-slate-500 text-slate-50 border-slate-400';
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 sm:py-6 pb-20 animate-fadeIn">
      {/* Shiny celebration */}
      {pokemon.isShiny && !isPreview && (
        <div role="status" className="mb-3 p-3 rounded-2xl bg-gradient-to-r from-yellow-300 via-amber-300 to-pink-300 text-slate-900 text-center font-black text-base sm:text-lg shadow-lg flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6" /> WOW! Bé tìm được {pokemon.name} SHINY siêu hiếm! <Sparkles className="w-6 h-6" />
        </div>
      )}

      {/* Top Banner: Success notice (or warning when LocalStorage refused the save) */}
      <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-2xl border shadow-lg flex flex-wrap items-center justify-between gap-3 ${
        isPreview
          ? 'bg-gradient-to-r from-cyan-500/15 via-slate-900/90 to-cyan-500/15 border-cyan-500/40'
          : savedItem
            ? 'bg-gradient-to-r from-emerald-500/15 via-slate-900/90 to-emerald-500/15 border-emerald-500/40'
            : 'bg-gradient-to-r from-amber-500/15 via-slate-900/90 to-amber-500/15 border-amber-500/40'
      }`}>
        {isPreview ? (
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-tech font-bold uppercase tracking-wider text-cyan-400">
              BÉ CHƯA CÓ POKÉMON NÀY
            </span>
            <p className="text-xs text-slate-300">
              Hãy tìm thẻ {pokemon.name} và quét để thêm vào bộ sưu tập nhé!
            </p>
          </div>
        </div>
        ) : savedItem ? (
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-tech font-bold uppercase tracking-wider text-emerald-400">
                LƯU DỮ LIỆU THÀNH CÔNG
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-tech font-bold">
                Đã lưu LocalStorage
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Đã ghi nhận vào Pokedex • Số lần quét: <strong className="text-amber-400 font-tech text-sm">{savedItem.scanCount || 1}</strong>
            </p>
          </div>
        </div>
        ) : (
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-tech font-bold uppercase tracking-wider text-amber-400">
              CHƯA LƯU ĐƯỢC VÀO BỘ SƯU TẬP
            </span>
            <p className="text-xs text-slate-300">
              Trình duyệt không cho ghi LocalStorage (chế độ ẩn danh hoặc bộ nhớ đầy).
            </p>
          </div>
        </div>
        )}

        <div className="flex items-center space-x-2 ml-auto">
          <button
            onClick={() => playCry(pokemon)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
          >
            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Tiếng gầm</span>
          </button>
          {!isPreview && (
          <button
            onClick={onReplayVideo}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-red-600/30 hover:bg-red-600/50 border border-red-500/40 text-xs font-semibold text-red-300 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Xem lại Video</span>
          </button>
          )}
        </div>
      </div>

      {/* Main Grid: Holographic Card + Detail Info */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: 3D Holographic Tilt Card */}
        <div className="md:col-span-5 flex flex-col items-center">
          <div className="card-perspective w-full max-w-[320px]">
            <div
              ref={cardRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseLeave}
              style={{
                transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
                boxShadow: `0 20px 40px -15px ${pokemon.themeColor.glow}`,
              }}
              className="holo-card-inner relative aspect-[63/88] w-full rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing border-2 border-amber-300/40 bg-slate-900 shadow-2xl transition-transform"
            >
              {/* Card Image */}
              <img
                src={pokemon.image}
                alt={pokemon.name}
                onError={(e) => {
                  e.target.onerror = null;
                  if (pokemon.fallbackImage) e.target.src = pokemon.fallbackImage;
                }}
                className="w-full h-full object-cover select-none pointer-events-none"
              />

              {/* Holographic Rainbow Foil Overlay */}
              <div
                className="holo-foil absolute inset-0 opacity-80"
                style={{
                  backgroundPosition: `${glarePos.x}% ${glarePos.y}%`,
                }}
              />

              {/* Shiny Glass Glare Light */}
              <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-200"
                style={{
                  background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.45) 0%, transparent 60%)`,
                }}
              />

              {/* Card Set Badge in bottom corner */}
              <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm border border-white/20 text-[9px] font-tech text-white">
                {pokemon.cardNumber}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-2 font-tech flex items-center space-x-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
            <span>Chạm hoặc di chuột để nghiêng thẻ hiệu ứng 3D Foil</span>
          </p>

          {/* Quick Actions under card */}
          <div className="w-full max-w-[320px] flex items-center justify-between mt-4 gap-2">
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>
                {shareStatus === 'copied' ? 'Đã sao chép!' : shareStatus === 'failed' ? 'Không thể chia sẻ' : 'Chia sẻ thẻ'}
              </span>
            </button>
            <button
              onClick={onViewCollection}
              className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-xs font-semibold text-indigo-300 transition-colors"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Bộ sưu tập</span>
            </button>
          </div>

          <div className="w-full max-w-[320px] mt-4">
            <PokemonBuddy
              pokemon={pokemon}
              shinyUnlocked={!!savedItem?.shinyUnlocked}
              showShiny={showShiny}
              onToggleShiny={setShowShiny}
              catchCount={savedItem?.catchCount || 0}
              games={games}
              care={{
                enabled: !isPreview && !!savedItem,
                friendship: savedItem?.friendship || 0,
                fedToday: savedItem ? fedToday(savedItem) : 0,
                favoriteFound: !!savedItem?.favoriteFound,
                berries,
              }}
              onFeed={onFeed}
              onPet={onPet}
              gifts={{ enabled: !isPreview && !!savedItem, bag, card: savedItem, onGive, onOpenShop }}
              rank={rank}
            />
          </div>
        </div>

        {/* Right Column: Pokemon Technical Specs & Attacks */}
        <div className="md:col-span-7 flex flex-col space-y-4">

          <EvolutionTree
            ownedSpecies={ownedSpecies}
            pokemon={pokemon}
            scanCount={savedItem?.scanCount || 0}
            friendship={savedItem?.friendship || 0}
            canEvolve={!isPreview && !!savedItem}
            onEvolve={onEvolve}
            onExplore={onExplore}
          />

          {/* Identity Box */}
          <div className="glass-panel p-4 sm:p-5 rounded-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-tech font-bold text-slate-400">
                    #{pokemon.pokedexNumber}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-tech">
                    {pokemon.species}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-50 tracking-wide mt-1">
                  {pokemon.name}
                </h2>
                <p className="text-xs text-slate-400 font-tech">{pokemon.japaneseName}</p>
              </div>

              {/* HP Badge */}
              <div className="text-right">
                <span className="text-[10px] uppercase font-tech text-slate-400 font-bold tracking-widest block">
                  HIT POINTS
                </span>
                <span className="text-2xl sm:text-3xl font-black font-tech text-rose-500">
                  {pokemon.hp} <span className="text-sm text-slate-400">HP</span>
                </span>
              </div>
            </div>

            {/* Types & Rarity Badges */}
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-800/80">
              {pokemon.types.map((type) => (
                <span
                  key={type}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border shadow-sm ${getTypeColor(type)}`}
                >
                  {type.toUpperCase()}
                </span>
              ))}

              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>{pokemon.rarity}</span>
              </span>

              <span className="text-xs text-slate-400 ml-auto font-tech">
                Set: {pokemon.cardSet}
              </span>
            </div>
          </div>

          {/* Physical Attributes Banner */}
          <div className="grid grid-cols-3 gap-2">
            <div className="glass-panel p-2.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 uppercase font-tech block">Chiều cao</span>
              <span className="text-xs sm:text-sm font-bold text-slate-200 font-tech">{pokemon.height}</span>
            </div>
            <div className="glass-panel p-2.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 uppercase font-tech block">Cân nặng</span>
              <span className="text-xs sm:text-sm font-bold text-slate-200 font-tech">{pokemon.weight}</span>
            </div>
            <div className="glass-panel p-2.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 uppercase font-tech block">Họa sĩ</span>
              <span className="text-xs sm:text-sm font-bold text-slate-200 font-tech truncate block">{pokemon.illustrator}</span>
            </div>
          </div>

          {/* Online Combat Base Stats (From PokeAPI) */}
          {pokemon.attack && (
            <div className="glass-panel p-3.5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-tech font-bold uppercase text-cyan-400">
                <span>Chỉ Số Chiến Đấu Gốc (PokéAPI)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">Online Synced</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center font-tech">
                <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">BASE HP</span>
                  <span className="text-sm font-bold text-rose-400">{pokemon.baseHp || pokemon.hp}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">ATTACK</span>
                  <span className="text-sm font-bold text-amber-400">{pokemon.attack}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">DEFENSE</span>
                  <span className="text-sm font-bold text-blue-400">{pokemon.defense}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">SPEED</span>
                  <span className="text-sm font-bold text-emerald-400">{pokemon.speed}</span>
                </div>
              </div>
            </div>
          )}

          {/* Special Ability (if exists) */}
          {pokemon.ability && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-red-950/40 to-slate-900 border border-red-500/30">
              <div className="flex items-center space-x-2 text-xs font-bold text-red-400 font-tech uppercase mb-1">
                <Flame className="w-3.5 h-3.5" />
                <span>{pokemon.ability.name} ({pokemon.ability.type})</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {pokemon.ability.text}
              </p>
            </div>
          )}

          {/* Attacks Section */}
          <div className="glass-panel p-4 rounded-2xl space-y-3">
            <h3 className="text-xs font-tech font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Swords className="w-4 h-4 text-amber-400" />
              <span>Đòn Tấn Công & Chiêu Thức TCG</span>
            </h3>

            <div className="space-y-2.5">
              {pokemon.attacks.map((atk, index) => (
                <div
                  key={index}
                  className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        {(atk.cost || []).map((c, i) => (
                          <span
                            key={i}
                            title={c}
                            className={`w-3.5 h-3.5 rounded-full inline-block border border-white/20 ${
                              c === 'Fire' ? 'bg-red-500' :
                              c === 'Electric' || c === 'Lightning' ? 'bg-amber-400' :
                              c === 'Water' ? 'bg-blue-500' :
                              c === 'Psychic' ? 'bg-fuchsia-500' : 'bg-slate-500'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-bold text-slate-100">{atk.name}</span>
                    </div>
                    <span className="text-base font-black font-tech text-amber-400">
                      {atk.damage}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{atk.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Weakness, Resistance & Retreat */}
          <div className="grid grid-cols-3 gap-2">
            <div className="glass-panel p-2.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 uppercase font-tech block">Điểm yếu</span>
              <span className="text-xs font-bold text-rose-400 font-tech">
                {pokemon.weakness.type} {pokemon.weakness.value}
              </span>
            </div>
            <div className="glass-panel p-2.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 uppercase font-tech block">Kháng cự</span>
              <span className="text-xs font-bold text-emerald-400 font-tech">
                {pokemon.resistance.type} {pokemon.resistance.value}
              </span>
            </div>
            <div className="glass-panel p-2.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 uppercase font-tech block">Rút lui</span>
              <span className="text-xs font-bold text-slate-300 font-tech">
                {pokemon.retreatCost > 0 ? '★'.repeat(pokemon.retreatCost) : '—'}
              </span>
            </div>
          </div>

          {/* Lore / Pokedex description */}
          <div className="glass-panel p-3.5 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase font-tech block mb-1">
              GHI CHÚ POKÉDEX
            </span>
            <p className="text-xs text-slate-300 italic leading-relaxed">
              "{pokemon.lore}"
            </p>
          </div>

          {/* Big Action: Scan Next Card */}
          <button
            onClick={onScanNext}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-sm shadow-xl shadow-red-600/30 border border-red-400/40 flex items-center justify-center space-x-2 transition-all duration-200 active:scale-[0.98]"
          >
            <RotateCw className="w-4 h-4" />
            <span>Tiếp Tục Quét Thẻ Khác</span>
          </button>

        </div>
      </div>

      {isCooking && <CookingGame chef={{ ...pokemon, fallbackImage: buddyImage }} onBerries={onBerries} onGold={onGold} onClose={() => setIsCooking(false)} />}
      {isShopping && <ShopGame shopkeeper={{ ...pokemon, fallbackImage: buddyImage }} onBerries={onBerries} onGold={onGold} onClose={() => setIsShopping(false)} />}

      {extra && (() => {
        const Game = (extra.kind === 'sport' ? findSport(extra.id) : findLogicGame(extra.id)).Component;
        return <Game player={{ name: pokemon.name, image: buddyImage }} onBerries={onBerries} onGold={onGold} onClose={() => setExtra(null)} />;
      })()}

      {isBattling && savedItem && (
        <BattleArena
          card={{ ...savedItem, name: pokemon.name, fallbackImage: (showShiny && getCardMedia(pokemon).shinyImage) || pokemon.fallbackImage }}
          onClose={() => setIsBattling(false)}
          onResult={(result) => onBattleResult?.(savedItem.id, result)}
        />
      )}

      {isRunning && (
        <RunnerGame
          pokemon={pokemon}
          image={(showShiny && getCardMedia(pokemon).shinyImage) || pokemon.fallbackImage || pokemon.image}
          onClose={() => setIsRunning(false)}
          onBerries={onBerries}
          onGold={onGold}
        />
      )}

      {isCatching && (
        <CatchGame
          pokemon={pokemon}
          image={(showShiny && getCardMedia(pokemon).shinyImage) || pokemon.fallbackImage || pokemon.image}
          onClose={() => setIsCatching(false)}
          onCaught={isPreview ? undefined : onCaught}
        />
      )}
    </div>
  );
}
