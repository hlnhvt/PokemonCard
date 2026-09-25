import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Star,
  Trash2,
  Play,
  Plus
} from 'lucide-react';
import { toggleCardFavorite, removeCardFromPokedex, clearPokedex } from '../utils/storage';
import { levelFor } from '../utils/friendship';

export function PokedexCollection({ collection, onSelectCard, onReplayVideo, onScanNew, setCollection }) {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [showOnlyFavs, setShowOnlyFavs] = useState(false);

  const handleToggleFavorite = (e, cardId) => {
    e.stopPropagation();
    const updated = toggleCardFavorite(cardId);
    setCollection(updated);
  };

  const handleDeleteCard = (e, cardId) => {
    e.stopPropagation();
    if (window.confirm('Bạn có chắc muốn xóa thẻ này khỏi Pokedex?')) {
      const updated = removeCardFromPokedex(cardId);
      setCollection(updated);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Cảnh báo: Bạn có chắc muốn xóa toàn bộ bộ sưu tập Pokedex trong máy?')) {
      clearPokedex();
      setCollection([]);
    }
  };

  // Unique types actually present in the collection (PokeAPI names: Dark, Grass, Ghost...)
  const collectionTypes = [
    ...new Set(collection.flatMap((c) => (Array.isArray(c.types) ? c.types : []).map((t) => String(t).toUpperCase()))),
  ].sort();
  const availableTypes = ['ALL', ...collectionTypes];
  // A filter for a type that no longer exists (e.g. after deleting cards) falls back to ALL
  const activeType = availableTypes.includes(selectedType) ? selectedType : 'ALL';

  // Filter items
  const query = search.trim().toLowerCase();
  // "#006" (as the placeholder suggests) should match Pokedex number "006"
  const numberQuery = query.replace(/^#/, '');
  const filteredList = collection.filter((item) => {
    const types = Array.isArray(item.types) ? item.types : [];
    const matchesSearch =
      !query ||
      item.name.toLowerCase().includes(query) ||
      (numberQuery !== '' && String(item.pokedexNumber || '').includes(numberQuery)) ||
      (typeof item.species === 'string' && item.species.toLowerCase().includes(query));

    const matchesType =
      activeType === 'ALL' ||
      types.some((t) => String(t).toUpperCase() === activeType);

    const matchesFav = !showOnlyFavs || item.isFavorite;

    return matchesSearch && matchesType && matchesFav;
  });

  // Stats calculation
  const totalScans = collection.reduce((acc, curr) => acc + (curr.scanCount || 1), 0);
  const favoriteCount = collection.filter((c) => c.isFavorite).length;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 sm:py-6 pb-24 animate-fadeIn">
      
      {/* Header & Stats Overview */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-50 font-tech uppercase tracking-wider flex items-center space-x-2">
              <BookOpen className="w-6 h-6 text-indigo-400" />
              <span>BỘ SƯU TẬP POKÉDEX</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Dữ liệu thẻ bài được lưu trữ tự động trong LocalStorage của thiết bị
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onScanNew}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-xs shadow-lg shadow-red-600/30 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Quét thẻ mới</span>
            </button>

            {collection.length > 0 && (
              <button
                onClick={handleClearAll}
                className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors"
                title="Xóa tất cả thẻ"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-panel p-3 rounded-2xl flex flex-col justify-between">
            <span className="text-[10px] sm:text-xs font-tech text-slate-400 uppercase">Thẻ Đã Có</span>
            <div className="flex items-baseline space-x-1 mt-1">
              <span className="text-xl sm:text-2xl font-black font-tech text-cyan-400">{collection.length}</span>
              <span className="text-[10px] text-slate-500">thẻ</span>
            </div>
          </div>

          <div className="glass-panel p-3 rounded-2xl flex flex-col justify-between">
            <span className="text-[10px] sm:text-xs font-tech text-slate-400 uppercase">Tổng Lần Quét</span>
            <div className="flex items-baseline space-x-1 mt-1">
              <span className="text-xl sm:text-2xl font-black font-tech text-amber-400">{totalScans}</span>
              <span className="text-[10px] text-slate-500">lượt</span>
            </div>
          </div>

          <div className="glass-panel p-3 rounded-2xl flex flex-col justify-between">
            <span className="text-[10px] sm:text-xs font-tech text-slate-400 uppercase">Yêu Thích</span>
            <div className="flex items-baseline space-x-1 mt-1">
              <span className="text-xl sm:text-2xl font-black font-tech text-rose-400">{favoriteCount}</span>
              <span className="text-[10px] text-slate-500">thẻ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên Pokemon, số thẻ (#006)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 transition-colors"
            />
          </div>

          {/* Favorite filter toggle */}
          <button
            onClick={() => setShowOnlyFavs(!showOnlyFavs)}
            className={`p-2.5 rounded-xl border transition-colors flex items-center space-x-1 text-xs font-semibold ${
              showOnlyFavs
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Star className={`w-4 h-4 ${showOnlyFavs ? 'fill-amber-400 text-amber-400' : ''}`} />
          </button>
        </div>

        {/* Type pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
          {availableTypes.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1 rounded-lg font-tech font-bold uppercase transition-all whitespace-nowrap ${
                activeType === t
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Pokemon Cards */}
      {filteredList.length === 0 ? (
        <div className="glass-panel p-8 sm:p-12 rounded-3xl text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 text-slate-500">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-200 mb-1">Chưa có thẻ nào phù hợp</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-4">
            {collection.length === 0
              ? 'Hãy dùng Camera hoặc chọn Thẻ Mẫu trong tab Quét Thẻ để bắt đầu bộ sưu tập!'
              : 'Không tìm thấy thẻ bài nào khớp với từ khóa tìm kiếm.'}
          </p>
          <button
            onClick={onScanNew}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs shadow-lg shadow-red-600/30 transition-all"
          >
            Quét Thẻ Ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {filteredList.map((card) => (
            <div
              key={card.id}
              onClick={() => onSelectCard(card)}
              className="group relative rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-2.5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-950/30 cursor-pointer overflow-hidden"
            >
              {/* Top Row: Pokedex ID & Favorite */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-tech font-bold text-slate-400">
                  #{card.pokedexNumber}
                </span>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={(e) => handleToggleFavorite(e, card.id)}
                    className="p-1 text-slate-500 hover:text-amber-400 transition-colors"
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        card.isFavorite ? 'fill-amber-400 text-amber-400' : ''
                      }`}
                    />
                  </button>
                  <button
                    onClick={(e) => handleDeleteCard(e, card.id)}
                    className="p-1 text-slate-600 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Card Image Thumbnail */}
              <div className="relative aspect-[63/88] w-full rounded-xl overflow-hidden bg-slate-950 mb-2 border border-slate-800 group-hover:border-amber-400/40 transition-colors">
                <img
                  src={card.image}
                  alt={card.name}
                  onError={(e) => {
                    e.target.onerror = null;
                    if (card.fallbackImage) e.target.src = card.fallbackImage;
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Scan count pill */}
                <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[9px] font-tech text-amber-300 border border-white/10">
                  Quét {card.scanCount || 1}x{card.catchCount > 0 ? ` • Bắt ${card.catchCount}x` : ''}
                </div>
                {card.friendship > 0 && (
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-pink-500/90 text-[9px] font-black text-white shadow" title="Mức thân thiết">
                    ❤ {levelFor(card.friendship).label}
                  </div>
                )}
                {card.shinyUnlocked && (
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-yellow-300 to-pink-300 text-[9px] font-black text-slate-900 shadow" title="Đã tìm thấy bản Shiny">
                    ✨ SHINY
                  </div>
                )}
              </div>

              {/* Card Info */}
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-100 truncate flex-1 group-hover:text-amber-300">
                    {card.name}
                  </h4>
                  <span className="text-[10px] font-tech font-bold text-rose-400 ml-1">
                    {card.hp}HP
                  </span>
                </div>

                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] text-slate-400 uppercase font-tech">
                    {(Array.isArray(card.types) ? card.types : []).join('/')}
                  </span>
                  
                  {/* Play video mini button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReplayVideo(card);
                    }}
                    className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[9px] text-slate-300 transition-colors"
                  >
                    <Play className="w-2.5 h-2.5 text-red-400" />
                    <span>Video</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
