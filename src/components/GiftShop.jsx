import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, ShoppingBag } from 'lucide-react';
import { CATEGORIES, itemsIn } from '../utils/shopItems';
import { canBuyMore } from '../utils/inventory';
import { artworkUrl } from '../services/pokemonOnlineService';
import { sounds } from '../utils/soundEffects';

const SHOPKEEPER = { name: 'Meowth', image: artworkUrl(52) };
const EFFECT_TEXT = {
  food: (i) => `+${i.gain} ❤️ khi ăn`,
  toy: (i) => `+${i.gain} ❤️ mỗi ngày chơi`,
  decor: (i) => `+${i.gain} ❤️ ${i.slot === 'wear' ? 'đội lên đầu' : 'trang trí'}`,
};

/**
 * "Tiệm quà Pokémon": spend gold from the games on food, toys and things for the
 * Pokemon. Items go into the bag; they are given from each Pokemon's page.
 * onBuy(itemId) returns the outcome of inventory.buyItem.
 */
export function GiftShop({ gold, bag = {}, onBuy, onClose }) {
  const [tab, setTab] = useState('food');
  const [flying, setFlying] = useState([]);
  const [say, setSay] = useState({ text: 'Meo! Chọn quà cho bạn Pokémon của bé nhé! 😺', key: 0 });
  const [walletBump, setWalletBump] = useState(0);
  const [poorShake, setPoorShake] = useState(0);
  const [hop, setHop] = useState(0);
  const bagRef = useRef(null);
  const flyId = useRef(0);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const bagCount = Object.values(bag).reduce((a, b) => a + b, 0);

  const buy = (item, e) => {
    const outcome = onBuy(item.id);
    if (outcome.result === 'poor') {
      setPoorShake((n) => n + 1);
      sounds.playOops();
      setSay((s) => ({ text: `Bé cần thêm ${item.price - gold} vàng. Chơi game để kiếm vàng nhé! 🎮`, key: s.key + 1 }));
      return;
    }
    if (outcome.result === 'owned') {
      setSay((s) => ({ text: `Bé đã có ${item.name} rồi, đồ chơi dùng mãi được đó!`, key: s.key + 1 }));
      return;
    }
    if (outcome.result !== 'ok') return;
    sounds.playCoin();
    setWalletBump((n) => n + 1);
    setHop((n) => n + 1);
    setSay((s) => ({ text: `Cảm ơn bé! ${item.name} đã vào túi rồi 🎁`, key: s.key + 1 }));
    // The item flies from its card into the bag button
    const from = e.currentTarget.getBoundingClientRect();
    const to = bagRef.current?.getBoundingClientRect();
    if (to) {
      const id = ++flyId.current;
      setFlying((list) => [...list, { id, emoji: item.emoji, x: to.left + to.width / 2, y: to.top + to.height / 2, sx: from.left + from.width / 2 - (to.left + to.width / 2), sy: from.top + from.height / 2 - (to.top + to.height / 2) }]);
      timers.current.push(setTimeout(() => setFlying((list) => list.filter((f) => f.id !== id)), 800));
    }
    if (item.price >= 40) {
      try {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, zIndex: 9999 });
      } catch {
        // decoration
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 select-none" role="dialog" aria-label="Tiệm quà Pokémon">
      <div className="relative flex flex-col w-full h-full sm:h-auto sm:max-h-full max-w-md overflow-hidden sm:rounded-3xl sm:border-4 border-white/70 shadow-2xl bg-gradient-to-b from-rose-100 via-amber-50 to-sky-100">
        {/* Awning */}
        <div className="h-5 shrink-0 bg-[repeating-linear-gradient(90deg,#ef4444_0_28px,#fff_28px_56px)] shadow" aria-hidden="true" />
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <h2 className="text-xl font-black text-rose-600">🎁 Tiệm quà Pokémon</h2>
          <div className="flex items-center gap-2">
            <span key={`${walletBump}-${poorShake}`} className={`flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-400 text-slate-900 text-lg font-black shadow ${poorShake && !walletBump ? 'wrong-shake' : walletBump ? 'score-bump' : ''}`} aria-label={`${gold} vàng`} data-testid="shop-gold">
              <span className="coin-spin">🪙</span> {gold}
            </span>
            <button onClick={onClose} aria-label="Đóng tiệm quà" className="p-2 rounded-full bg-white text-slate-700 shadow">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Shopkeeper */}
        <div className="flex items-end gap-2 px-4">
          <img key={`hop-${hop}`} src={SHOPKEEPER.image} alt={SHOPKEEPER.name} className={`w-20 h-20 object-contain drop-shadow-lg ${hop ? 'poke-hop' : 'sport-bob'}`} />
          <p key={`say-${say.key}`} className="bubble-pop relative mb-4 flex-1 px-3 py-2 rounded-2xl bg-white shadow text-sm font-bold text-slate-700" role="status">
            {say.text}
            <span className="absolute -left-1.5 bottom-3 w-3 h-3 rotate-45 bg-white" />
          </p>
        </div>

        {/* Categories */}
        <div className="grid grid-cols-3 gap-2 px-4" role="tablist">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={tab === c.id}
              onClick={() => setTab(c.id)}
              className={`py-2 rounded-2xl text-sm font-black flex items-center justify-center gap-1 transition-all ${tab === c.id ? 'bg-rose-500 text-white shadow-lg scale-105' : 'bg-white/80 text-slate-600'}`}
            >
              <span className="text-lg">{c.icon}</span> {c.label}
            </button>
          ))}
        </div>

        {/* Items */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          <div key={tab} className="grid grid-cols-2 gap-3">
            {itemsIn(tab).map((item, i) => {
              const affordable = gold >= item.price;
              const owned = bag[item.id] || 0;
              const soldOut = !canBuyMore(item.id, bag);
              return (
                <button
                  key={item.id}
                  onClick={(e) => buy(item, e)}
                  disabled={soldOut}
                  aria-label={`Mua ${item.name} giá ${item.price} vàng`}
                  className="pop-in relative p-3 rounded-3xl bg-white shadow-md flex flex-col items-center gap-1 active:scale-95 transition-transform disabled:opacity-60"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {owned > 0 && <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-black">{soldOut ? 'Đã có' : `Có ${owned}`}</span>}
                  <span className="text-5xl balloon-float" style={{ animationDelay: `${i * 200}ms` }}>
                    {item.emoji}
                  </span>
                  <span className="text-sm font-black text-slate-800">{item.name}</span>
                  <span className="text-[11px] font-bold text-rose-500">{EFFECT_TEXT[item.category](item)}</span>
                  <span className={`mt-1 px-3 py-1 rounded-full text-sm font-black flex items-center gap-1 ${affordable ? 'bg-amber-400 text-slate-900' : 'bg-slate-200 text-slate-500'}`}>
                    🪙 {item.price}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bag */}
        <div className="shrink-0 px-4 py-3 bg-white/70 border-t border-rose-200 flex items-center gap-3">
          <span ref={bagRef} key={bagCount} className="relative w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg pop-in">
            <ShoppingBag className="w-6 h-6" />
            {bagCount > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-amber-400 text-slate-900 text-[11px] font-black flex items-center justify-center" data-testid="bag-count">{bagCount}</span>}
          </span>
          <p className="flex-1 text-xs font-bold text-slate-600">Quà trong túi được tặng ở trang của từng Pokémon (mục 🎁 Tặng quà).</p>
        </div>

        {flying.map((f) => (
          <span key={f.id} className="item-drop fixed z-[60] text-4xl leading-none pointer-events-none" style={{ left: f.x, top: f.y, marginLeft: -18, marginTop: -18, '--sx': `${f.sx}px`, '--sy': `${f.sy}px` }}>
            {f.emoji}
          </span>
        ))}
      </div>
    </div>,
    document.body
  );
}
