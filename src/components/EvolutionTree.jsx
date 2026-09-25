import React, { useEffect, useState } from 'react';
import { GitBranch, Sparkles, ChevronRight } from 'lucide-react';
import { fetchEvolutionChain } from '../services/pokemonOnlineService';
import { FRIENDSHIP_TO_EVOLVE } from '../utils/friendship';

// Scans of the same card needed before a child can evolve it
export const SCANS_TO_EVOLVE = 3;

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Which chain node is this card? Match by species name, then by Pokedex number. */
function findCurrent(nodes, pokemon) {
  const species = (pokemon.speciesName || '').toLowerCase();
  const num = Number(pokemon.pokedexNumber);
  return nodes.find((n) => n.name === species) || nodes.find((n) => n.id === num) || null;
}

export function EvolutionTree({ pokemon, scanCount = 0, friendship = 0, canEvolve = true, onEvolve, onExplore }) {
  const lookup = pokemon.speciesName || (Number(pokemon.pokedexNumber) <= 1025 ? Number(pokemon.pokedexNumber) : null);
  // Result tagged with the lookup it belongs to, so a stale result reads as "loading"
  const [loaded, setLoaded] = useState({ lookup: null, nodes: [] });

  useEffect(() => {
    if (!lookup) return undefined;
    let cancelled = false;
    fetchEvolutionChain(lookup).then((result) => {
      if (!cancelled) setLoaded({ lookup, nodes: result });
    });
    return () => {
      cancelled = true;
    };
  }, [lookup]);

  const nodes = !lookup ? [] : loaded.lookup === lookup ? loaded.nodes : null; // null = loading

  if (nodes === null) {
    return (
      <div className="glass-panel p-4 rounded-2xl text-sm text-slate-400" role="status">
        Đang tải cây tiến hóa...
      </div>
    );
  }
  if (nodes.length === 0) return null;

  const current = findCurrent(nodes, pokemon);
  const nextForms = current ? nodes.filter((n) => n.from === current.name) : [];
  const stages = [...new Set(nodes.map((n) => n.stage))].sort((a, b) => a - b);
  const scansLeft = Math.max(0, SCANS_TO_EVOLVE - scanCount);
  // Friendship evolutions unlock through care; the others through repeated scans
  const isUnlocked = (form) => (form.needsFriendship ? friendship >= FRIENDSHIP_TO_EVOLVE : scansLeft === 0);
  const unlockedForms = nextForms.filter(isUnlocked);
  const lockedByScans = nextForms.filter((f) => !f.needsFriendship && !isUnlocked(f));
  const lockedByFriendship = nextForms.filter((f) => f.needsFriendship && !isUnlocked(f));

  return (
    <div className="glass-panel p-4 rounded-2xl space-y-3">
      <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-emerald-400" /> Cây Tiến Hóa
      </h3>

      {nodes.length === 1 ? (
        <p className="text-sm text-slate-300">{capitalize(nodes[0].name)} không tiến hóa. Bạn ấy đặc biệt như vậy đó! ✨</p>
      ) : (
        <div className="flex items-center gap-1 overflow-x-auto pb-2" data-testid="evolution-stages">
          {stages.map((stage, index) => (
            <React.Fragment key={stage}>
              {index > 0 && <ChevronRight className="w-5 h-5 shrink-0 text-slate-500" />}
              {/* Many branches (Eevee has 8) wrap into two columns instead of one long list */}
              <div className={`grid gap-2 shrink-0 ${nodes.filter((n) => n.stage === stage).length > 3 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {nodes
                  .filter((n) => n.stage === stage)
                  .map((node) => {
                    const isCurrent = current?.name === node.name;
                    return (
                      <button
                        key={node.name}
                        type="button"
                        onClick={() => !isCurrent && onExplore?.(node.name)}
                        aria-current={isCurrent ? 'true' : undefined}
                        className={`w-24 p-2 rounded-2xl border-2 flex flex-col items-center text-center transition-transform active:scale-95 ${
                          isCurrent ? 'border-amber-400 bg-amber-400/15' : 'border-slate-700 bg-slate-900/60 hover:border-cyan-400'
                        }`}
                      >
                        {node.image && <img src={node.image} alt={capitalize(node.name)} loading="lazy" className="w-16 h-16 object-contain" />}
                        <span className="text-xs font-black text-slate-100">{capitalize(node.name)}</span>
                        {node.how && <span className="text-[10px] leading-tight text-slate-400 mt-0.5">{node.how}</span>}
                      </button>
                    );
                  })}
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      {canEvolve && current && nextForms.length > 0 && (
        <div className="space-y-2">
          {unlockedForms.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {unlockedForms.map((form) => (
                <button
                  key={form.name}
                  onClick={() => onEvolve?.(form.name)}
                  className="flex-1 min-w-[10rem] py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-white font-black text-base shadow-lg flex items-center justify-center gap-2 active:scale-95"
                >
                  <Sparkles className="w-5 h-5" /> Tiến hóa thành {capitalize(form.name)}!
                </button>
              ))}
            </div>
          )}
          {lockedByScans.length > 0 && (
            <div>
              <p className="text-sm font-bold text-slate-200">
                Quét thẻ này thêm <strong className="text-amber-400">{scansLeft}</strong> lần nữa để tiến hóa
                {lockedByFriendship.length > 0 && ` thành ${lockedByScans.map((f) => capitalize(f.name)).join(', ')}`}!
              </p>
              <div className="mt-1.5 h-3 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-label="Tiến độ quét" aria-valuemin={0} aria-valuemax={SCANS_TO_EVOLVE} aria-valuenow={Math.min(scanCount, SCANS_TO_EVOLVE)}>
                <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${(Math.min(scanCount, SCANS_TO_EVOLVE) / SCANS_TO_EVOLVE) * 100}%` }} />
              </div>
            </div>
          )}
          {lockedByFriendship.length > 0 && (
            <div>
              <p className="text-sm font-bold text-slate-200">
                ❤️ Cho {capitalize(current.name)} ăn quả mọng để thân thiết đạt <strong className="text-rose-400">{FRIENDSHIP_TO_EVOLVE}</strong> và tiến hóa thành{' '}
                {lockedByFriendship.map((f) => capitalize(f.name)).join(', ')}!
              </p>
              <div className="mt-1.5 h-3 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-label="Tiến độ thân thiết" aria-valuemin={0} aria-valuemax={FRIENDSHIP_TO_EVOLVE} aria-valuenow={Math.min(friendship, FRIENDSHIP_TO_EVOLVE)}>
                <div className="h-full bg-gradient-to-r from-pink-400 to-rose-500" style={{ width: `${(Math.min(friendship, FRIENDSHIP_TO_EVOLVE) / FRIENDSHIP_TO_EVOLVE) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {current && nextForms.length === 0 && nodes.length > 1 && (
        <p className="text-sm text-slate-300">🏆 {capitalize(current.name)} đã ở dạng tiến hóa cuối cùng!</p>
      )}
    </div>
  );
}
