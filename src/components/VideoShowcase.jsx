import React, { useEffect, useRef, useState } from 'react';
import { Play, SkipForward, Sparkles, Zap, Flame, ShieldAlert, Volume2, VolumeX } from 'lucide-react';
import { sounds } from '../utils/soundEffects';

export function VideoShowcase({ pokemon, onComplete, isMuted, onToggleMute }) {
  const [progress, setProgress] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const durationRef = useRef(pokemon?.videoShowcase?.duration || 5);

  useEffect(() => {
    // Play energy surge sound and Pokemon cry
    sounds.playEnergySurge();
    const cryTimer = setTimeout(() => {
      sounds.playPokemonCry(pokemon.videoShowcase?.soundEffect || pokemon.types[0]);
    }, 450);

    return () => clearTimeout(cryTimer);
  }, [pokemon]);

  // Canvas dynamic cinematic particle FX generator
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles = [];
    const color = pokemon.themeColor.primary || '#FF4422';
    const accent = pokemon.themeColor.accent || '#FFAA00';

    for (let i = 0; i < 65; i++) {
      particles.push({
        x: width / 2 + (Math.random() - 0.5) * 100,
        y: height / 2 + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        radius: Math.random() * 4 + 1.5,
        alpha: Math.random() * 0.8 + 0.2,
        color: Math.random() > 0.5 ? color : accent,
      });
    }

    let start = performance.now();
    const render = (time) => {
      const elapsed = (time - start) / 1000;
      ctx.clearRect(0, 0, width, height);

      // Radial energy shockwave
      const waveRadius = ((elapsed * 250) % (Math.max(width, height) * 0.7));
      ctx.save();
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, waveRadius, 0, Math.PI * 2);
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, 4 - (waveRadius / 150));
      ctx.globalAlpha = Math.max(0, 1 - (waveRadius / 400));
      ctx.stroke();
      ctx.restore();

      // Draw and update energy particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.008;

        if (p.alpha <= 0 || p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
          p.x = width / 2 + (Math.random() - 0.5) * 60;
          p.y = height / 2 + (Math.random() - 0.5) * 60;
          p.vx = (Math.random() - 0.5) * 9;
          p.vy = (Math.random() - 0.5) * 9;
          p.alpha = Math.random() * 0.9 + 0.3;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fill();
        ctx.restore();
      });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [pokemon]);

  // Video progress handling or fallback timer
  useEffect(() => {
    const totalSeconds = durationRef.current;
    const intervalTime = 50; // update every 50ms
    const step = (intervalTime / (totalSeconds * 1000)) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + step;
        if (next >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            onComplete();
          }, 250);
          return 100;
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [onComplete]);

  // Try playing video element when mounted
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setVideoLoaded(true))
          .catch(() => {
            setVideoError(true);
          });
      }
    }
  }, [isMuted]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-2xl overflow-hidden p-4">
      {/* Background Ambience Glow */}
      <div
        className="absolute inset-0 opacity-40 blur-3xl pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(circle at center, ${pokemon.themeColor.primary} 0%, ${pokemon.themeColor.secondary} 40%, transparent 75%)`,
        }}
      />

      {/* Futuristic Scanline Overlay */}
      <div className="absolute inset-0 scanline pointer-events-none opacity-40" />

      {/* Top Header info */}
      <div className="relative z-10 w-full max-w-xl flex items-center justify-between px-2 mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <span className="text-xs font-tech font-bold uppercase tracking-widest text-slate-300">
            DETECTED: #{pokemon.pokedexNumber} {pokemon.name}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleMute}
            className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>
          <button
            onClick={onComplete}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition-colors"
          >
            <span>Bỏ qua</span>
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Video & Holographic Projection Stage */}
      <div className="relative z-10 w-full max-w-xl aspect-[16/10] sm:aspect-video rounded-2xl overflow-hidden border-2 border-slate-700/80 shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-slate-950 flex items-center justify-center">
        
        {/* Real Video Element */}
        {!videoError && (
          <video
            ref={videoRef}
            src={pokemon.videoUrl}
            autoPlay
            playsInline
            muted={isMuted}
            onEnded={onComplete}
            onError={() => setVideoError(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-85"
          />
        )}

        {/* Dynamic Canvas Particles FX (Blends over video or functions as stunning fallback) */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen" />

        {/* Hero Hologram / Pokemon Artwork overlay */}
        <div className="relative z-20 flex flex-col items-center justify-center pointer-events-none">
          <div className="relative">
            <img
              src={pokemon.fallbackImage || pokemon.image}
              alt={pokemon.name}
              className="w-44 h-44 sm:w-56 sm:h-56 object-contain drop-shadow-[0_0_35px_rgba(255,255,255,0.7)] animate-float"
            />
            {/* Holographic light ring */}
            <div
              className="absolute -inset-4 rounded-full border border-dashed opacity-70 animate-spin-slow"
              style={{ borderColor: pokemon.themeColor.primary }}
            />
          </div>
        </div>

        {/* Showcase Banner overlay */}
        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex flex-col items-center text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-xs font-tech font-bold text-amber-400 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{pokemon.videoShowcase?.title || 'LEGENDARY BATTLE ENCOUNTER'}</span>
          </div>
          <p className="text-xs text-slate-300 max-w-md line-clamp-2 px-2">
            {pokemon.videoShowcase?.description || pokemon.lore}
          </p>
        </div>
      </div>

      {/* Progress Bar & Status */}
      <div className="relative z-10 w-full max-w-xl mt-4 px-2">
        <div className="flex justify-between items-center text-xs font-tech text-slate-400 mb-1.5">
          <span className="flex items-center space-x-1">
            <Zap className="w-3.5 h-3.5 text-yellow-400 animate-bounce" />
            <span>Đang giải mã dữ liệu thẻ bài...</span>
          </span>
          <span className="font-bold text-slate-200">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700/60">
          <div
            className="h-full transition-all duration-75 rounded-full"
            style={{
              width: `${progress}%`,
              backgroundColor: pokemon.themeColor.primary || '#FF4422',
              boxShadow: `0 0 10px ${pokemon.themeColor.primary}`,
            }}
          />
        </div>
      </div>

      {/* Bottom Hint */}
      <p className="relative z-10 text-[11px] text-slate-500 font-tech mt-3 text-center">
        Thông tin chi tiết và lưu thẻ vào Pokedex sẽ sẵn sàng ngay sau video
      </p>
    </div>
  );
}
