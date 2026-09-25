import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ScannerModal } from './components/ScannerModal';
import { VideoShowcase } from './components/VideoShowcase';
import { PokemonCardDetail } from './components/PokemonCardDetail';
import { PokedexCollection } from './components/PokedexCollection';
import { getSavedCollection, saveCardToPokedex } from './utils/storage';
import { sounds } from './utils/soundEffects';

export function App() {
  const [currentTab, setCurrentTab] = useState('scan'); // 'scan' | 'collection' | 'detail'
  const [activePokemon, setActivePokemon] = useState(null);
  const [savedItem, setSavedItem] = useState(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [collection, setCollection] = useState([]);
  const [isMuted, setIsMuted] = useState(false);

  // Load saved collection from localStorage on mount
  useEffect(() => {
    const list = getSavedCollection();
    setCollection(list);
  }, []);

  // Handler when a card is scanned or selected
  const handleCardDetected = (pokemon) => {
    setActivePokemon(pokemon);
    setIsPlayingVideo(true); // Open video showcase first as requested!
  };

  // Handler when video completes or is skipped
  const handleVideoCompleted = () => {
    setIsPlayingVideo(false);

    // Save card into LocalStorage upon video completion
    if (activePokemon) {
      const saved = saveCardToPokedex(activePokemon);
      setSavedItem(saved);
      // Refresh collection state from localStorage
      setCollection(getSavedCollection());
    }

    // Advance to detailed card view
    setCurrentTab('detail');
  };

  // Replay video for the active or selected card
  const handleReplayVideo = (pokemon = activePokemon) => {
    setActivePokemon(pokemon);
    setIsPlayingVideo(true);
  };

  // Open detail view for a card from collection
  const handleSelectFromCollection = (card) => {
    setActivePokemon(card);
    setSavedItem(card);
    setCurrentTab('detail');
  };

  const handleToggleMute = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative selection:bg-rose-500 selection:text-white">
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
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative z-10 w-full">
        {currentTab === 'scan' && (
          <ScannerModal onCardDetected={handleCardDetected} />
        )}

        {currentTab === 'detail' && activePokemon && (
          <PokemonCardDetail
            pokemon={activePokemon}
            savedItem={savedItem}
            onScanNext={() => {
              setActivePokemon(null);
              setCurrentTab('scan');
            }}
            onReplayVideo={() => handleReplayVideo(activePokemon)}
            onViewCollection={() => setCurrentTab('collection')}
          />
        )}

        {currentTab === 'collection' && (
          <PokedexCollection
            collection={collection}
            setCollection={setCollection}
            onSelectCard={handleSelectFromCollection}
            onReplayVideo={(card) => {
              setActivePokemon(card);
              setIsPlayingVideo(true);
            }}
            onScanNew={() => setCurrentTab('scan')}
          />
        )}
      </main>

      {/* Full-screen Cinematic Video Showcase Overlay */}
      {isPlayingVideo && activePokemon && (
        <VideoShowcase
          pokemon={activePokemon}
          onComplete={handleVideoCompleted}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
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
