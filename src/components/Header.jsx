import React from 'react';
import { Camera, BookOpen, Gamepad2, Volume2, VolumeX, Moon, Sun, Waves } from 'lucide-react';
import { THEMES } from '../utils/theme';

const THEME_ICONS = { dark: Moon, light: Sun, ocean: Waves };

const TABS = [
  { id: 'scan', label: 'Quét Thẻ', Icon: Camera, active: 'bg-gradient-to-r from-red-600 to-rose-600 shadow-red-600/30 border-red-400/40' },
  { id: 'collection', label: 'Bộ Sưu Tập', Icon: BookOpen, active: 'bg-gradient-to-r from-indigo-600 to-blue-600 shadow-blue-600/30 border-blue-400/40' },
  { id: 'games', label: 'Trò Chơi', Icon: Gamepad2, active: 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-600/30 border-emerald-400/40' },
];

export function Header({ currentTab, setCurrentTab, collectionCount, isMuted, onToggleMute, theme = 'dark', onCycleTheme }) {
  const currentTheme = THEMES.find((t) => t.id === theme) || THEMES[0];
  const ThemeIcon = THEME_ICONS[currentTheme.id] || Moon;

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 px-3 sm:px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">

        {/* Pokedex Indicator Lights + Brand */}
        <div className="flex items-center space-x-3 cursor-pointer shrink-0" onClick={() => setCurrentTab('scan')}>
          {/* Main Large Glowing Blue Sensor */}
          <div className="relative flex items-center justify-center">
            <div className="w-9 h-9 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_15px_rgba(6,182,212,0.8)] flex items-center justify-center animate-pulse">
              <div className="w-3.5 h-3.5 rounded-full bg-white/80 blur-[1px]"></div>
            </div>
            {/* Miniature LED indicators */}
            <div className="hidden sm:flex space-x-1.5 ml-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            </div>
          </div>

          <div className="text-left hidden md:block">
            <div className="flex items-center space-x-1.5">
              <h1 className="text-base sm:text-lg font-black tracking-wider uppercase font-tech text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-400 to-cyan-400">
                POKE-SCAN
              </h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                AR
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-tech uppercase tracking-widest">Pokedex Card Scanner</p>
          </div>
        </div>

        {/* Navigation Tabs + Theme + Sound */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {TABS.map(({ id, label, Icon, active }) => (
            <button
              key={id}
              onClick={() => setCurrentTab(id)}
              aria-label={label}
              aria-current={currentTab === id ? 'page' : undefined}
              className={`relative flex items-center space-x-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border ${
                currentTab === id
                  ? `${active} text-white shadow-lg`
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border-transparent'
              }`}
            >
              <Icon className="w-5 h-5 sm:w-4 sm:h-4" />
              {/* Labels only from tablet width so three tabs fit on a phone */}
              <span className="hidden sm:inline">{label}</span>
              {id === 'collection' && collectionCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 sm:static sm:ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 font-tech">
                  {collectionCount}
                </span>
              )}
            </button>
          ))}

          {/* Theme switcher: dark -> light -> ocean */}
          <button
            onClick={onCycleTheme}
            aria-label={`Đổi giao diện (đang dùng: ${currentTheme.label})`}
            title={`Giao diện: ${currentTheme.label}`}
            className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-slate-900 border border-slate-800 transition-colors"
          >
            <ThemeIcon className="w-4 h-4 text-cyan-400" />
          </button>

          {/* Mute / Unmute Button */}
          <button
            onClick={onToggleMute}
            aria-label="Toggle Sound"
            className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-slate-900 border border-slate-800 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-amber-400 animate-pulse" />}
          </button>
        </nav>

      </div>
    </header>
  );
}
