import React from 'react';
import { X, Lock, CheckCircle, ArrowRight } from '../icons/PokeIcons';
import { ITEMS, SHOP, RARITY, MAX_CHARMS } from '../../utils/quest/items';
import { ACTS } from '../../utils/quest/world';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { itemIcon } from './questUi';
import { BADGES } from '../../utils/quest/experts';
import { EXPERTS_PER_ACT } from '../../utils/quest/world';


function Panel({ title, onClose, children, testId, wide = false }) {
  return (
    <div
      className={`quest-panel absolute z-40 right-2 top-12 bottom-2 ${wide ? 'w-[min(420px,calc(100%-16px))]' : 'w-[min(340px,calc(100%-16px))]'} flex flex-col rounded-3xl border-2 border-white/40 bg-gradient-to-b from-slate-900/95 to-indigo-950/95 shadow-2xl overflow-hidden`}
      role="dialog"
      aria-label={title}
      data-testid={testId}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-white/10">
        <span className="text-base font-black text-white">{title}</span>
        <button type="button" onClick={onClose} aria-label="Đóng" className="ml-auto p-1.5 rounded-full bg-white/15 text-white active:scale-90">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">{children}</div>
    </div>
  );
}

/** The bag: healing items, revives, Rare Candy and stones (for the lead), charms. */
export function BagPanel({ hud, onUse, onClose }) {
  const lead = hud.party[hud.lead];
  const usable = Object.keys(ITEMS).filter((id) => !ITEMS[id].charm);
  const canUse = (id) => {
    const it = ITEMS[id];
    if (!(hud.inventory[id] > 0)) return false;
    if (it.heal) return hud.anyHurt;
    if (it.revive) return hud.anyFainted;
    if (id === 'candy') return lead && lead.level < 50;
    if (id === 'stone') return !!lead?.nextEvo;
    return false;
  };
  return (
    <Panel title="🎒 Túi đồ" onClose={onClose} testId="quest-bag">
      {lead && (
        <p className="flex items-center gap-2 text-[11px] font-bold text-white/80">
          <img src={lead.image} alt="" className="w-8 h-8 object-contain" /> Kẹo hiếm và Đá tiến hóa dùng cho <span className="text-amber-300 font-black">{lead.name}</span>
        </p>
      )}
      {usable.map((id) => {
        const it = ITEMS[id];
        const n = hud.inventory[id] || 0;
        return (
          <div key={id} className={`flex items-center gap-2 p-2 rounded-2xl bg-white/5 border ${n ? 'border-white/15' : 'border-white/5 opacity-50'}`} data-testid={`bag-${id}`}>
            <span className="text-2xl w-8 text-center">{itemIcon(id)}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-black" style={{ color: RARITY[it.rarity].color }}>
                {it.name} <span className="text-white/70">x{n}</span>
              </span>
              <span className="block text-[10px] font-bold text-white/70 truncate">{it.desc}</span>
            </span>
            <button type="button" disabled={!canUse(id)} onClick={() => onUse(id)} aria-label={`Dùng ${it.name}`} className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-black shadow active:scale-95 disabled:opacity-40 disabled:bg-slate-600">
              Dùng
            </button>
          </div>
        );
      })}
      <div className="p-2 rounded-2xl bg-amber-400/10 border border-amber-300/30">
        <p className="text-xs font-black text-amber-200">✨ Bùa của đội (tự có tác dụng)</p>
        <div className="mt-1 grid grid-cols-3 gap-1 text-center">
          {[['charmAtk', 'atk'], ['charmHp', 'hp'], ['charmSpeed', 'speed']].map(([id, k]) => (
            <span key={id} className="rounded-xl bg-black/25 py-1 text-[10px] font-bold text-white">
              <span className="block text-lg">{itemIcon(id)}</span>
              {ITEMS[id].name}
              <span className="block text-amber-300 font-black">
                {hud.charms[k] || 0}/{MAX_CHARMS}
              </span>
            </span>
          ))}
        </div>
      </div>
    </Panel>
  );
}

export function ShopPanel({ hud, onBuy, onClose }) {
  return (
    <Panel title="🛒 Cửa hàng" onClose={onClose} testId="quest-shop">
      <p className="flex items-center justify-between text-sm font-black text-white">
        Vàng hành trình <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200" data-testid="shop-gold">🪙 {hud.gold}</span>
      </p>
      {SHOP.map((id) => {
        const it = ITEMS[id];
        const ok = hud.gold >= it.price;
        return (
          <div key={id} className="flex items-center gap-2 p-2 rounded-2xl bg-white/5 border border-white/15" data-testid={`shop-${id}`}>
            <span className="text-2xl w-8 text-center">{itemIcon(id)}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-black" style={{ color: RARITY[it.rarity].color }}>
                {it.name} <span className="text-white/60 text-xs">(có {hud.inventory[id] || 0})</span>
              </span>
              <span className="block text-[10px] font-bold text-white/70 truncate">{it.desc}</span>
            </span>
            <button type="button" disabled={!ok} onClick={() => onBuy(id)} aria-label={`Mua ${it.name}`} className="shrink-0 px-2.5 py-1.5 rounded-xl bg-amber-400 text-slate-900 text-xs font-black shadow active:scale-95 disabled:opacity-40">
              🪙 {it.price}
            </button>
          </div>
        );
      })}
    </Panel>
  );
}

export function CenterPanel({ hud, onClose }) {
  return (
    <Panel title="💖 Trung tâm Pokémon" onClose={onClose} testId="quest-center">
      <p className="bubble-pop text-center text-sm font-black text-pink-200">Chị Joy đã chữa lành cả đội! Các bạn Pokémon khỏe lại rồi ✨</p>
      <div className="grid grid-cols-5 gap-1">
        {hud.party.map((m) => (
          <span key={m.key} className="flex flex-col items-center rounded-xl bg-white/10 p-1">
            <img src={m.image} alt="" className="quest-heal-pop w-10 h-10 object-contain" />
            <span className="w-full text-center text-[9px] font-black text-white truncate">{m.name}</span>
            <span className="text-[9px] font-black text-emerald-300">
              {m.hp}/{m.maxHp}
            </span>
          </span>
        ))}
      </div>
      <p className="text-[11px] font-bold text-white/70 text-center">Đi vào cổng sáng bên phải để tiếp tục hành trình.</p>
    </Panel>
  );
}

/** The journey board: every act, what is done, travel to a town already opened. */
export function BoardPanel({ hud, onTravel, onClose }) {
  return (
    <Panel title="🗺️ Bảng hành trình" onClose={onClose} testId="quest-board" wide>
      {hud.badges?.length > 0 && (
        <div className="flex flex-wrap gap-1" data-testid="board-badges">
          {hud.badges.map((b) => (
            <span key={b} className="pop-in px-2 py-1 rounded-full text-xs font-black text-slate-900 shadow" style={{ background: BADGES[b].color }}>
              {BADGES[b].icon} {BADGES[b].name}
            </span>
          ))}
        </div>
      )}
      <p className="text-xs font-bold text-white/80">
        Đã hạ <span className="text-amber-300 font-black">{hud.beaten.length}</span>/{ACTS.length} Boss. Hạ Boss cuối mỗi màn để mở màn tiếp theo! Thắng cả {EXPERTS_PER_ACT} chuyên gia của một màn để nhận huy hiệu.
      </p>
      {ACTS.map((a, i) => {
        const done = hud.beaten.includes(i);
        const open = i <= hud.unlocked;
        const here = i === hud.act;
        return (
          <div key={a.id} className={`flex items-center gap-2 p-2 rounded-2xl border ${here ? 'border-amber-300 bg-amber-300/10' : 'border-white/15 bg-white/5'} ${open ? '' : 'opacity-50'}`} data-testid={`board-act-${i}`}>
            <img src={artworkUrl(a.boss.dex)} alt="" className={`w-10 h-10 object-contain ${done ? '' : open ? 'brightness-75' : 'brightness-0 opacity-60'}`} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-black text-white truncate">
                Màn {i + 1}: {a.name}
              </span>
              <span className="block text-[10px] font-bold text-white/70 truncate">
                {done ? `Đã hạ ${a.boss.name}` : open ? `Boss: ${a.boss.title}` : 'Chưa mở'} · {a.areas[0].name}
              </span>
              {open && (
                <span className="block text-[10px] font-black text-pink-200" data-testid={`board-experts-${i}`}>
                  ⭐ Chuyên gia {hud.expertsDone?.[i] || 0}/{EXPERTS_PER_ACT}
                  {hud.badges?.includes(i) && (
                    <span className="ml-1 px-1.5 rounded-full text-slate-900" style={{ background: BADGES[i].color }}>
                      {BADGES[i].icon} {BADGES[i].name}
                    </span>
                  )}
                </span>
              )}
            </span>
            {done ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : !open ? <Lock className="w-5 h-5 text-white/60" /> : null}
            {open && !here && (
              <button type="button" onClick={() => onTravel(i)} aria-label={`Đi tới ${a.name}`} className="shrink-0 px-2 py-1.5 rounded-xl bg-sky-500 text-white text-xs font-black flex items-center gap-1 active:scale-95">
                Đi <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </Panel>
  );
}
