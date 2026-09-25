import React, { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { Header } from './components/Header';
import { ScannerModal } from './components/ScannerModal';
import { VideoShowcase } from './components/VideoShowcase';
import { PokemonCardDetail } from './components/PokemonCardDetail';
import { PokedexCollection } from './components/PokedexCollection';
import { GuessGame } from './components/GuessGame';
import { EvolutionScene } from './components/EvolutionScene';
import { getSavedCollection, saveCardToPokedex, recordCatch } from './utils/storage';
import { fetchPokemonOnline } from './services/pokemonOnlineService';
import { sounds } from './utils/soundEffects';
import { rollShiny } from './utils/shiny';
import { applyTheme, getInitialTheme, nextTheme } from './utils/theme';

export function App() {
  const [currentTab, setCurrentTab] = useState('scan'); // 'scan' | 'collection' | 'games' | 'detail'
  const [activePokemon, setActivePokemon] = useState(null);
  const [savedItem, setSavedItem] = useState(null);
  // 'saved' for collected cards, 'preview' for a Pokemon opened from the evolution tree
  const [detailMode, setDetailMode] = useState('saved');
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  // 'scan' saves the card once the video ends; 'replay' only shows it again
  const [videoSource, setVideoSource] = useState('scan');
  // Load saved collection from localStorage on first render
  const [collection, setCollection] = useState(getSavedCollection);
  const [isMuted, setIsMuted] = useState(() => sounds.isMuted());
  const [theme, setTheme] = useState(getInitialTheme);
  const [evolution, setEvolution] = useState(null); // { from, to, error }
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const findInCollection = (name) =>
    getSavedCollection().find((c) => c.id === name || (c.speciesName || '').toLowerCase() === name);

  const openDetail = (pokemon, saved, mode = 'saved') => {
    setActivePokemon(pokemon);
    setSavedItem(saved);
    setDetailMode(mode);
    setCurrentTab('detail');
  };

  // Handler when a card is scanned or selected
  const handleCardDetected = (pokemon) => {
    setActivePokemon({ ...pokemon, isShiny: rollShiny() });
    setDetailMode('saved');
    setVideoSource('scan');
    setIsPlayingVideo(true); // Open video showcase first as requested!
  };

  // Handler when video completes or is skipped
  const handleVideoCompleted = () => {
    setIsPlayingVideo(false);

    // Save card into LocalStorage upon video completion of a new scan only
    if (activePokemon && videoSource === 'scan') {
      const saved = saveCardToPokedex(activePokemon);
      setSavedItem(saved);
      // Refresh collection state from localStorage
      setCollection(getSavedCollection());
    }

    // Advance to detailed card view
    setCurrentTab('detail');
  };

  // Replay video for the active or selected card without counting a new scan
  const handleReplayVideo = (pokemon = activePokemon) => {
    setActivePokemon(pokemon);
    setVideoSource('replay');
    setIsPlayingVideo(true);
  };

  // Open detail view for a card from collection
  const handleSelectFromCollection = (card) => openDetail(card, card);

  // Tap on another Pokemon in the evolution tree
  const handleExplore = async (name) => {
    const owned = findInCollection(name);
    if (owned) {
      openDetail(owned, owned);
      return;
    }
    setNotice({ text: 'Đang tải thông tin Pokémon...', tone: 'info' });
    try {
      const pokemon = await fetchPokemonOnline(name);
      setNotice(null);
      openDetail(pokemon, null, 'preview');
    } catch (err) {
      setNotice({ text: err.message || 'Không tải được Pokémon này.', tone: 'error' });
    }
  };

  // Evolve the current card (after enough scans) into one of its next forms
  const handleEvolve = async (targetName) => {
    const from = activePokemon;
    if (!from) return;
    setEvolution({ from, to: null, error: null });
    try {
      const evolved = await fetchPokemonOnline(targetName);
      setEvolution({ from, to: { ...evolved, isShiny: !!from.isShiny }, error: null });
    } catch (err) {
      setEvolution({ from, to: null, error: err.message || 'Không tải được dạng tiến hóa.' });
    }
  };

  const handleEvolutionDone = () => {
    const evolved = evolution?.to;
    setEvolution(null);
    if (!evolved) return;
    const saved = saveCardToPokedex(evolved);
    setCollection(getSavedCollection());
    openDetail(evolved, saved);
  };

  const handleCaught = () => {
    if (!activePokemon) return;
    const updated = recordCatch(activePokemon.id);
    if (updated) {
      setSavedItem(updated);
      setCollection(getSavedCollection());
    }
  };

  const handleToggleMute = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="min-h-screen app-bg text-slate-100 flex flex-col font-sans relative selection:bg-rose-500 selection:text-white">
      {/* Background Decorative Tech Grid & Gradients */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/10 blur-[120px] pointer-events-none rounded-full" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[300px] bg-blue-600/10 blur-[120px] pointer-events-none rounded-full" />

      {/* Pokedex App Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        collectionCount={collection.length}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        theme={theme}
        onCycleTheme={() => setTheme((t) => nextTheme(t))}
      />

      {notice && (
        <div role="status" className={`fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl shadow-xl text-sm font-bold ${
          notice.tone === 'error' ? 'bg-rose-600 text-white' : 'bg-cyan-600 text-white'
        }`}>
          {notice.text}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative z-10 w-full">
        {currentTab === 'scan' && (
          <ScannerModal onCardDetected={handleCardDetected} />
        )}

        {currentTab === 'detail' && activePokemon && (
          <PokemonCardDetail
            key={`${activePokemon.id}-${detailMode}`}
            pokemon={activePokemon}
            savedItem={savedItem}
            mode={detailMode}
            onScanNext={() => {
              setActivePokemon(null);
              setCurrentTab('scan');
            }}
            onReplayVideo={() => handleReplayVideo(activePokemon)}
            onViewCollection={() => setCurrentTab('collection')}
            onEvolve={handleEvolve}
            onExplore={handleExplore}
            onCaught={handleCaught}
          />
        )}

        {currentTab === 'collection' && (
          <PokedexCollection
            collection={collection}
            setCollection={setCollection}
            onSelectCard={handleSelectFromCollection}
            onReplayVideo={(card) => {
              setSavedItem(card);
              setDetailMode('saved');
              handleReplayVideo(card);
            }}
            onScanNew={() => setCurrentTab('scan')}
          />
        )}

        {currentTab === 'games' && (
          <div className="w-full max-w-xl mx-auto px-4 py-4 sm:py-6 pb-24 space-y-4 animate-fadeIn">
            <h2 className="text-xl sm:text-2xl font-black text-slate-50 text-center">🎮 Trò Chơi Pokémon</h2>
            <GuessGame collection={collection} />
            <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
              <Target className="w-8 h-8 text-red-400 shrink-0" />
              <p className="text-sm text-slate-300 flex-1">
                Muốn chơi <strong className="text-slate-100">Ném Bóng Bắt Pokémon</strong>? Mở một Pokémon trong bộ sưu tập nhé!
              </p>
              <button onClick={() => setCurrentTab('collection')} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold shrink-0">
                Mở bộ sưu tập
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Full-screen Cinematic Video Showcase Overlay */}
      {isPlayingVideo && activePokemon && (
        <VideoShowcase
          pokemon={activePokemon}
          onComplete={handleVideoCompleted}
          isMuted={isMuted}
        />
      )}

      {evolution && (
        <EvolutionScene from={evolution.from} to={evolution.to} error={evolution.error} onDone={handleEvolutionDone} />
      )}

      {/* Mobile Friendly Bottom Floating Bar when in detail or collection mode */}
      {currentTab !== 'scan' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 sm:hidden">
          <button
            onClick={() => setCurrentTab('scan')}
            className="flex items-center space-x-2 px-5 py-3 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs shadow-2xl shadow-red-600/50 border border-white/20 active:scale-95"
          >
            <span>Quét thẻ mới</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
