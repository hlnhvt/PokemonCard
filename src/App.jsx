import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { ScannerModal } from './components/ScannerModal';
import { VideoShowcase } from './components/VideoShowcase';
import { PokemonCardDetail } from './components/PokemonCardDetail';
import { PokedexCollection } from './components/PokedexCollection';
import { GamesHub } from './components/GamesHub';
import { EvolutionScene } from './components/EvolutionScene';
import { getSavedCollection, saveCardToPokedex, recordCatch, feedCard, petCard, recordBattle } from './utils/storage';
import { getBerries, addBerries } from './utils/berries';
import { getGold, addGold, GOLD_REWARDS, goldForMatch } from './utils/gold';
import { getBag, buyItem, giveItem } from './utils/inventory';
import { GiftShop } from './components/GiftShop';
import { fetchPokemonOnline } from './services/pokemonOnlineService';
import { sounds } from './utils/soundEffects';
import { rollShiny } from './utils/shiny';
import { applyTheme, getInitialTheme } from './utils/theme';

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
  // The child's berry bag (filled by the runner game, spent on feeding)
  const [berries, setBerries] = useState(getBerries);
  // Gold from every game, spent in the gift shop; the bag holds what was bought
  const [gold, setGold] = useState(getGold);
  const [bag, setBag] = useState(getBag);
  const [showShop, setShowShop] = useState(false);
  const [goldToast, setGoldToast] = useState(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!goldToast) return undefined;
    const timer = setTimeout(() => setGoldToast(null), 2300);
    return () => clearTimeout(timer);
  }, [goldToast]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  // Species the child has scanned (unlocked); every other Pokemon stays locked
  const ownedSpecies = new Set(collection.flatMap((c) => [c.id, (c.speciesName || '').toLowerCase()]).filter(Boolean));
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

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

  // Tap on another Pokemon in the evolution tree: only scanned ones open
  const handleExplore = (name) => {
    const owned = findInCollection(name);
    if (owned) {
      openDetail(owned, owned);
      return;
    }
    setNotice({ text: '🔒 Bé chưa có thẻ ' + capitalize(name) + '. Hãy quét thẻ để mở khóa nhé!', tone: 'info' });
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

  const handleGold = (amount) => {
    const n = Math.floor(Number(amount) || 0);
    if (n <= 0) return;
    setGold(addGold(n));
    setGoldToast({ amount: n, id: Date.now() + Math.random() });
  };

  const handleBuy = (itemId) => {
    const outcome = buyItem(itemId);
    setGold(outcome.gold);
    setBag(outcome.bag);
    return outcome;
  };

  const handleGive = (itemId) => {
    if (!activePokemon) return null;
    const outcome = giveItem(activePokemon.id, itemId);
    if (outcome.result === 'ok') refreshCard(outcome.card);
    if (outcome.bag) setBag(outcome.bag);
    return outcome;
  };

  const handleCaught = () => {
    if (!activePokemon) return;
    handleGold(GOLD_REWARDS.catch);
    const updated = recordCatch(activePokemon.id);
    if (updated) {
      setSavedItem(updated);
      setCollection(getSavedCollection());
    }
  };

  const refreshCard = (card) => {
    setSavedItem(card);
    setActivePokemon((current) => (current && current.id === card.id ? { ...current, ...card, isShiny: current.isShiny } : current));
    setCollection(getSavedCollection());
  };

  const handleFeed = (berry) => {
    if (!activePokemon) return null;
    const outcome = feedCard(activePokemon.id, berry);
    if (outcome.result === 'fed') {
      refreshCard(outcome.card);
      setBerries(outcome.berries);
    }
    return outcome;
  };

  const handlePet = () => {
    if (!activePokemon) return null;
    const outcome = petCard(activePokemon.id);
    if (outcome?.gain) refreshCard(outcome.card);
    return outcome;
  };

  const handleBerriesCollected = (collected) => setBerries(addBerries(collected));

  // Battles reward berries (win 2, consolation 1) and are counted on the card
  const handleBattleResult = (cardId, { won }) => {
    setBerries(addBerries(won ? { oran: 1, razz: 1 } : { oran: 1 }));
    handleGold(goldForMatch(won ? 'win' : 'lose'));
    const updated = recordBattle(cardId, won);
    if (updated) {
      setCollection(getSavedCollection());
      setSavedItem((current) => (current && current.id === updated.id ? updated : current));
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
        onSelectTheme={setTheme}
        gold={gold}
        onOpenShop={() => setShowShop(true)}
      />

      {goldToast && (
        <div key={goldToast.id} role="status" className="gold-pop fixed top-20 left-1/2 z-[70] px-4 py-2 rounded-full bg-gradient-to-r from-amber-300 to-yellow-400 text-slate-900 text-lg font-black shadow-2xl shadow-amber-500/40 border-2 border-white pointer-events-none" data-testid="gold-toast">
          <span className="coin-spin">🪙</span> +{goldToast.amount} vàng
        </div>
      )}

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
          <ScannerModal onCardDetected={handleCardDetected} recentCards={collection} onOpenCard={handleSelectFromCollection} />
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
            berries={berries}
            onFeed={handleFeed}
            onPet={handlePet}
            onBerries={handleBerriesCollected}
            onBattleResult={handleBattleResult}
            onGold={handleGold}
            bag={bag}
            onGive={handleGive}
            onOpenShop={() => setShowShop(true)}
            ownedSpecies={ownedSpecies}
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
          <GamesHub
            collection={collection}
            berries={berries}
            onBerries={handleBerriesCollected}
            onBattleResult={handleBattleResult}
            onOpenCollection={() => setCurrentTab('collection')}
            onGold={handleGold}
            onOpenShop={() => setShowShop(true)}
            onScan={() => setCurrentTab('scan')}
          />
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

      {showShop && <GiftShop gold={gold} bag={bag} onBuy={handleBuy} onClose={() => setShowShop(false)} />}

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
