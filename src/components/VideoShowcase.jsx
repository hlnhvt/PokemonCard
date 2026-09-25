import React, { useEffect, useRef, useState } from 'react';
import { Play, SkipForward, Sparkles, Zap, Flame, ShieldAlert, Volume2, VolumeX, Video, ExternalLink, ArrowRight } from 'lucide-react';
import { sounds } from '../utils/soundEffects';

export function VideoShowcase({ pokemon, onComplete, isMuted, onToggleMute }) {
  const [progress, setProgress] = useState(0);
  const [videoMode, setVideoMode] = useState('direct'); // 'direct' (HTML5 MP4) | 'youtube' | 'canvas'
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef(null);
  const duration = pokemon?.videoShowcase?.duration || 7;

  useEffect(() => {
    sounds.playEnergySurge();
    const cryTimer = setTimeout(() => {
      sounds.playPokemonCry(pokemon.videoShowcase?.soundEffect || pokemon.types[0]);
    }, 350);

    return () => clearTimeout(cryTimer);
  }, [pokemon]);

  // Attempt to play direct HTML5 video
  useEffect(() => {
    if (videoRef.current && videoMode === 'direct') {
      videoRef.current.muted = isMuted;
      videoRef.current.play().catch((e) => {
        console.warn('HTML5 Video play issue:', e);
        setVideoError(true);
      });
    }
  }, [videoMode, isMuted]);

  // Progress countdown timer
  useEffect(() => {
    if (!autoAdvance) return;

    const intervalTime = 100;
    const step = (intervalTime / (duration * 1000)) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + step;
        if (next >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            onComplete();
          }, 350);
          return 100;
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [autoAdvance, onComplete, duration]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-2xl overflow-y-auto p-4 py-6">
      {/* Background Ambience Glow */}
      <div
        className="absolute inset-0 opacity-40 blur-3xl pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(circle at center, ${pokemon.themeColor.primary} 0%, ${pokemon.themeColor.secondary} 40%, transparent 75%)`,
        }}
      />

      <div className="absolute inset-0 scanline pointer-events-none opacity-30" />

      {/* Top Header info */}
      <div className="relative z-10 w-full max-w-2xl flex items-center justify-between px-2 mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <span className="text-xs font-tech font-bold uppercase tracking-widest text-slate-200">
            SHOWCASE: #{pokemon.pokedexNumber} {pokemon.name}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {pokemon.youtubeSearchUrl && (
            <a
              href={pokemon.youtubeSearchUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-red-600/30 hover:bg-red-600/50 border border-red-500/40 text-xs text-red-200 transition-colors"
            >
              <span>Xem trên YouTube</span>
              <ExternalLink className="w-3 h-3 text-red-400" />
            </a>
          )}

          <button
            onClick={onComplete}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            <span>Bỏ qua</span>
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Video Stage */}
      <div className="relative z-10 w-full max-w-2xl aspect-[16/10] sm:aspect-video rounded-2xl overflow-hidden border-2 border-slate-700/80 shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-slate-950 flex items-center justify-center">
        
        {/* Mode 1: High Quality HTML5 Video (No ads, 100% reliable) */}
        {videoMode === 'direct' && !videoError && pokemon.directVideoUrl && (
          <video
            ref={videoRef}
            src={pokemon.directVideoUrl}
            autoPlay
            playsInline
            muted={isMuted}
            onEnded={onComplete}
            onError={() => setVideoError(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-85"
          />
        )}

        {/* Mode 2: YouTube Iframe (If selected and available) */}
        {videoMode === 'youtube' && pokemon.youtubeUrl && (
          <iframe
            src={pokemon.youtubeUrl}
            title={`${pokemon.name} Video Showcase`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full border-0 relative z-20"
          />
        )}

        {/* Mode 3 / Fallback: 3D Holographic Awakening Animation */}
        {(videoMode === 'canvas' || videoError || !pokemon.directVideoUrl) && (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center">
            {/* Spinning Holographic Light Ring */}
            <div
              className="absolute w-72 h-72 rounded-full border-2 border-dashed opacity-70 animate-spin-slow pointer-events-none"
              style={{ borderColor: pokemon.themeColor.primary }}
            />

            {/* Glowing Energy Aura */}
            <div
              className="absolute w-48 h-48 rounded-full blur-2xl opacity-60 animate-pulse pointer-events-none"
              style={{ backgroundColor: pokemon.themeColor.primary }}
            />

            {/* Pokemon Artwork */}
            <img
              src={pokemon.fallbackImage || pokemon.image}
              alt={pokemon.name}
              className="w-48 h-48 sm:w-60 sm:h-60 object-contain drop-shadow-[0_0_40px_rgba(255,255,255,0.7)] animate-float relative z-10"
            />
          </div>
        )}

        {/* Video Overlay Info Banner */}
        <div className="absolute bottom-3 inset-x-4 p-3 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 flex flex-col items-center z-30">
          <span className="text-xs font-tech font-bold text-amber-400 uppercase tracking-widest flex items-center space-x-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{pokemon.videoShowcase?.title || `${pokemon.name.toUpperCase()} BATTLE AWAKENING`}</span>
          </span>
          <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 text-center">
            {pokemon.videoShowcase?.description || pokemon.lore}
          </p>
        </div>
      </div>

      {/* Progress Bar & Status */}
      <div className="relative z-10 w-full max-w-2xl mt-4 px-2">
        <div className="flex justify-between items-center text-xs font-tech text-slate-400 mb-1.5">
          <span className="flex items-center space-x-1">
            <Zap className="w-3.5 h-3.5 text-yellow-400 animate-bounce" />
            <span>Đang nạp năng lượng & đồng bộ dữ liệu Pokédex...</span>
          </span>
          <span className="font-bold text-slate-200">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700/60">
          <div
            className="h-full transition-all duration-100 rounded-full"
            style={{
              width: `${progress}%`,
              backgroundColor: pokemon.themeColor.primary || '#FF4422',
              boxShadow: `0 0 10px ${pokemon.themeColor.primary}`,
            }}
          />
        </div>
      </div>

      {/* Control Actions */}
      <div className="relative z-10 w-full max-w-2xl mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 px-2">
        <button
          onClick={() => setAutoAdvance(!autoAdvance)}
          className="text-xs text-slate-400 hover:text-slate-200 underline font-tech"
        >
          {autoAdvance ? 'Tạm dừng tự động chuyển' : 'Tiếp tục tự động chuyển'}
        </button>

        <button
          onClick={onComplete}
          className="w-full sm:w-auto py-3 px-6 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs shadow-xl shadow-red-600/40 flex items-center justify-center space-x-2 transition-transform active:scale-95 cursor-pointer"
        >
          <span>Xem Xong Video ➔ Khám Phá Thông Số Pokémon</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
