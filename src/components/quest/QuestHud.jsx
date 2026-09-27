import React from 'react';
import { TYPE_COLORS, TYPE_VI } from '../../utils/battle/typeChart';
import { PokeballIcon } from '../PokeballIcon';

const typeColor = (t) => TYPE_COLORS[t] || '#94a3b8';

/** Round skill button with a cooldown sweep (and an optional charge ring for the ultimate). */
export function SkillButton({ label, name, cd = 0, max = 0, ready, big, onPress, color, charge, testId, keyHint }) {
  const frac = max ? Math.min(1, cd / max) : 0;
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPress();
      }}
      aria-label={name}
      data-testid={testId}
      data-ready={ready}
      className={`quest-skill relative rounded-full border-4 shadow-xl flex flex-col items-center justify-center text-white font-black select-none touch-none active:scale-90 transition-transform ${big ? 'w-[88px] h-[88px] text-[11px]' : 'w-[62px] h-[62px] text-[9px]'} ${ready ? 'border-white/90' : 'border-white/30'}`}
      style={{ background: `radial-gradient(circle at 35% 30%, ${color}, ${color}aa 60%, #0f172a 100%)`, boxShadow: ready && big ? `0 0 22px 6px ${color}` : undefined }}
    >
      <span className={`${big ? 'text-2xl' : 'text-lg'} leading-none`}>{label}</span>
      <span className="px-1 leading-tight text-center drop-shadow line-clamp-2">{name}</span>
      {keyHint && <span className="absolute -top-1 -left-1 px-1 rounded bg-slate-900/80 text-[8px] text-white/70 hidden sm:block">{keyHint}</span>}
      {frac > 0 && (
        <span className="absolute inset-0 rounded-full flex items-center justify-center text-base font-black" style={{ background: `conic-gradient(rgba(15,23,42,0.75) ${frac * 360}deg, transparent 0)` }}>
          {cd >= 1 ? Math.ceil(cd) : ''}
        </span>
      )}
      {charge != null && charge < 1 && (
        <span className="absolute inset-[-6px] rounded-full pointer-events-none" style={{ background: `conic-gradient(#facc15 ${charge * 360}deg, rgba(255,255,255,0.15) 0)`, WebkitMask: 'radial-gradient(circle, transparent 62%, black 64%)', mask: 'radial-gradient(circle, transparent 62%, black 64%)' }} />
      )}
    </button>
  );
}

/**
 * The five Pokemon at the top left. The two out with the trainer show big (the lead with a
 * gold frame); the three resting in their Pokeballs show as balls with their HP. Tap one to
 * make it the lead (a Pokemon in its ball is sent out).
 */
export function PartyBar({ party, lead, onPick }) {
  return (
    <div className="flex gap-1.5" data-testid="quest-party">
      {party.map((m, i) => {
        const isLead = i === lead;
        const out = m.out && !m.fainted;
        return (
          <button
            key={m.key}
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onPick(i);
            }}
            aria-label={out ? (isLead ? `${m.name} dẫn đầu` : `Chọn ${m.name} dẫn đầu`) : `Thả ${m.name} ra`}
            aria-pressed={isLead}
            data-testid={`quest-member-${i}`}
            data-level={m.level}
            data-xp={m.xp}
            data-fainted={m.fainted}
            data-out={out}
            className={`relative w-[52px] h-[60px] rounded-xl border-2 overflow-hidden transition-transform ${isLead ? 'border-amber-300 scale-105 shadow-[0_0_12px_rgba(252,211,77,0.9)] bg-slate-900/85' : out ? 'border-sky-400 bg-slate-900/85' : 'border-white/25 bg-slate-950/70'}`}
          >
            {out || m.fainted ? (
              <img src={m.image} alt="" className={`absolute left-0.5 right-0.5 top-0 h-[44px] w-[calc(100%-4px)] object-contain ${m.fainted ? 'grayscale opacity-30' : ''}`} />
            ) : (
              <>
                <span className="absolute left-1/2 top-1 -translate-x-1/2 w-9 h-9 quest-ball-idle">
                  <PokeballIcon className="w-9 h-9" />
                </span>
                <img src={m.image} alt="" className="absolute right-0 bottom-[12px] w-6 h-6 object-contain drop-shadow" />
              </>
            )}
            <span className="absolute left-0.5 top-0.5 px-1 rounded bg-slate-950/80 text-[9px] font-black text-amber-300 leading-tight">{m.level}</span>
            {m.nextEvo && !m.fainted && out && <span className="absolute right-0.5 top-0.5 text-[9px] leading-none" title={`Tiến hóa ở cấp ${m.nextEvo.level}`}>✨</span>}
            <span className="absolute inset-x-1 bottom-[9px] h-1.5 rounded-full bg-black/60 overflow-hidden">
              <span className={`block h-full ${m.hpRatio > 0.5 ? 'bg-emerald-400' : m.hpRatio > 0.25 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${m.hpRatio * 100}%` }} />
            </span>
            <span className="absolute inset-x-1 bottom-[3px] h-1 rounded-full bg-black/60 overflow-hidden">
              <span className="block h-full bg-sky-400" style={{ width: `${m.xpRatio * 100}%` }} />
            </span>
            {m.fainted && (
              <span className="absolute inset-0 flex items-center justify-center">
                <PokeballIcon className="w-7 h-7 opacity-80" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function BossBar({ boss }) {
  return (
    <div className="px-3 py-1.5 rounded-2xl bg-slate-950/80 border border-white/20 shadow-xl pointer-events-none" data-testid="quest-boss-bar" data-hp={Math.round(boss.hpRatio * 100)}>
      <div className="flex items-center gap-2 text-white">
        <span className="text-xs sm:text-sm font-black truncate">👑 {boss.title}</span>
        <span className="text-[10px] font-black text-rose-200">Lv {boss.level}</span>
        {boss.angry && <span className="pop-in px-1.5 rounded-full bg-red-600 text-[10px] font-black">NỔI GIẬN</span>}
      </div>
      <div className="relative mt-1 h-3 rounded-full bg-black/60 overflow-hidden border border-white/20">
        <div className={`h-full transition-[width] duration-200 bg-gradient-to-r ${boss.angry ? 'from-red-500 via-orange-500 to-red-700' : 'from-rose-400 via-red-500 to-rose-700'}`} style={{ width: `${boss.hpRatio * 100}%` }} />
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white drop-shadow">{Math.ceil(boss.hpRatio * 100)}%</span>
      </div>
    </div>
  );
}

export function LeadInfo({ member }) {
  if (!member) return null;
  const t = member.types[0];
  return (
    <span className="px-3 py-1 rounded-full bg-slate-950/70 text-[11px] font-black text-white pointer-events-none whitespace-nowrap">
      {member.name} · <span style={{ color: typeColor(t) }}>Hệ {TYPE_VI[t] || t}</span> · Cả đội tự đánh khi có Pokémon hoang dã
    </span>
  );
}
