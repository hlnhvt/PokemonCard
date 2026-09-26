import React from 'react';
import { createPortal } from 'react-dom';
import { X, Star, RotateCcw } from 'lucide-react';
import { BerryIcon } from '../BerryIcon';

/** Full-screen frame shared by the kids games: title, round dots and a close button. */
export function KidGameShell({ title, label, round, rounds, onClose, children, background, dataAttrs = {} }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 select-none"
      role="dialog"
      aria-label={label}
      {...dataAttrs}
    >
      <div className={`relative w-full max-w-xl max-h-full overflow-y-auto overflow-x-hidden rounded-3xl border-4 border-white/80 shadow-2xl ${background}`}>
        <div className="sticky top-0 z-30 flex items-center justify-between gap-2 px-4 py-2.5 bg-white/85 backdrop-blur">
          <span className="text-lg font-black text-slate-800">{title}</span>
          <div className="flex items-center gap-1.5" aria-label={`Lượt ${Math.min(round + 1, rounds)}/${rounds}`}>
            {Array.from({ length: rounds }).map((_, i) => (
              <span
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${i < round ? 'bg-emerald-500' : i === round ? 'bg-amber-400 scale-125' : 'bg-slate-300'}`}
              />
            ))}
          </div>
          <button onClick={onClose} aria-label="Đóng trò chơi" className="p-2 rounded-full bg-white text-slate-700 hover:bg-slate-100 shadow">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/** A customer Pokemon walking in or out, with a speech bubble. */
export function Customer({ image, name, leaving, bubble, hop }) {
  return (
    <div className={`absolute right-2 sm:right-4 bottom-2 w-[42%] flex flex-col items-center pointer-events-none ${leaving ? 'customer-leave' : 'customer-enter'}`} data-testid="customer">
      {bubble && (
        <div className="bubble-pop relative mb-1 px-3 py-2 rounded-2xl bg-white shadow-lg text-center text-slate-800 font-black text-sm sm:text-base max-w-full">
          {bubble}
          <span className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-4 h-4 rotate-45 bg-white" />
        </div>
      )}
      <img key={hop} src={image} alt={name} draggable={false} className={`w-28 h-28 sm:w-36 sm:h-36 object-contain drop-shadow-xl ${hop ? 'poke-hop' : ''}`} />
    </div>
  );
}

/** The child's Pokemon, with a hat (chef or shopkeeper). */
export function HelperPokemon({ image, name, hat = 'chef', hop }) {
  return (
    <div className="absolute left-2 sm:left-4 bottom-2 w-[30%] flex flex-col items-center pointer-events-none" data-testid="helper">
      <div className="relative">
        {hat === 'chef' ? (
          <span aria-hidden="true" className="absolute left-1/2 -top-5 -translate-x-1/2 z-10 block w-14 h-9">
            <span className="absolute inset-x-1 bottom-0 h-3 rounded-sm bg-white border border-slate-200" />
            <span className="absolute left-0 bottom-2 w-6 h-6 rounded-full bg-white border border-slate-200" />
            <span className="absolute left-4 bottom-3 w-7 h-7 rounded-full bg-white border border-slate-200" />
            <span className="absolute right-0 bottom-2 w-6 h-6 rounded-full bg-white border border-slate-200" />
          </span>
        ) : (
          <span aria-hidden="true" className="absolute left-1/2 -top-3 -translate-x-1/2 z-10 block w-14 h-5 rounded-t-full bg-red-500 border-b-4 border-red-700" />
        )}
        <img key={hop} src={image} alt={name} draggable={false} className={`w-24 h-24 sm:w-32 sm:h-32 object-contain drop-shadow-xl scale-x-[-1] ${hop ? 'poke-hop' : ''}`} />
      </div>
    </div>
  );
}

/** Something flying in an arc between two points (coordinates relative to the stage). */
export function FlyingItem({ from, to, children, testId = 'flying-item' }) {
  return (
    <span
      data-testid={testId}
      className="arc-fly absolute z-20 text-4xl pointer-events-none"
      style={{ left: from.x, top: from.y, '--dx': `${to.x - from.x}px`, '--dy': `${to.y - from.y}px` }}
    >
      {children}
    </span>
  );
}

/** Burst of little drops or sparkles at a point. */
export function Splash({ at, color = '#60a5fa', count = 10 }) {
  return (
    <span className="absolute z-20 pointer-events-none" style={{ left: at.x, top: at.y }}>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="splash-drop absolute w-2.5 h-2.5 -ml-1 -mt-1 rounded-full"
          style={{ '--angle': `${(360 / count) * i}deg`, backgroundColor: color, animationDelay: `${(i % 3) * 30}ms` }}
        />
      ))}
    </span>
  );
}

export function StarRow({ stars, size = 'w-8 h-8', animate = false }) {
  return (
    <div className="flex gap-1" aria-label={`${stars} sao`}>
      {[0, 1, 2].map((i) => (
        <Star
          key={i}
          className={`${size} ${i < stars ? 'fill-amber-400 text-amber-500' : 'text-slate-300'} ${animate ? 'star-pop' : ''}`}
          style={animate ? { animationDelay: `${i * 150}ms` } : undefined}
        />
      ))}
    </div>
  );
}

/** "+15 vàng" with coins raining behind it (end of a game). */
export function GoldReward({ amount, dark = false }) {
  return (
    <div className="relative" data-testid="gold-reward">
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-24 h-40 overflow-visible">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className="coin-rain absolute text-2xl" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${i * 110}ms` }}>
            🪙
          </span>
        ))}
      </span>
      <p className={`relative flex items-center gap-2 px-4 py-1.5 rounded-2xl text-lg font-black shadow ${dark ? 'bg-amber-400/20 text-amber-200' : 'bg-amber-100 text-amber-700'}`}>
        <span className="coin-spin text-2xl">🪙</span> +{amount} vàng
      </p>
    </div>
  );
}

/** End-of-session summary with stars and the berry reward. */
export function SessionSummary({ title, stars, maxStars, berries, gold, detail, onReplay, onClose }) {
  const average = maxStars ? Math.round((stars / maxStars) * 3) : 0;
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <p className="text-3xl font-black text-slate-800">{title}</p>
      <StarRow stars={Math.max(1, average)} size="w-12 h-12" animate />
      <p className="text-lg font-bold text-slate-700">{detail}</p>
      {berries != null && (
        <p className="flex items-center gap-2 text-lg font-black text-emerald-700">
          <BerryIcon type="razz" className="w-6 h-6" /> Phần thưởng: {berries} quả mọng
        </p>
      )}
      {gold > 0 && <GoldReward amount={gold} />}
      <div className="flex gap-3 mt-2">
        <button onClick={onReplay} className="px-6 py-3 rounded-2xl bg-red-500 hover:bg-red-400 text-white text-lg font-black flex items-center gap-2 shadow-lg active:scale-95">
          <RotateCcw className="w-5 h-5" /> Chơi lại
        </button>
        <button onClick={onClose} className="px-6 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-lg font-black shadow-lg active:scale-95">
          Xong
        </button>
      </div>
    </div>
  );
}
