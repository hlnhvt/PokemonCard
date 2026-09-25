import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  FlipHorizontal,
  Sparkles,
  AlertCircle,
  Check,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Edit3,
  X,
  RotateCcw,
  Search,
  History,
  Image as ImageIcon,
} from 'lucide-react';
import { recognizeCardWithOCR } from '../utils/cardRecognizer';
import { mapRectToVideoFrame } from '../utils/cardImage';
import { findBestPokemonNameFromText, fetchPokemonOnline, getAllPokemonNames, artworkUrl } from '../services/pokemonOnlineService';
import { sounds } from '../utils/soundEffects';
import { PokeballIcon } from './PokeballIcon';

// Famous Pokemon children know, one tap away
const QUICK_PICKS = [
  { name: 'pikachu', label: 'Pikachu', id: 25 },
  { name: 'charizard', label: 'Charizard', id: 6 },
  { name: 'eevee', label: 'Eevee', id: 133 },
  { name: 'mewtwo', label: 'Mewtwo', id: 150 },
  { name: 'gengar', label: 'Gengar', id: 94 },
  { name: 'lucario', label: 'Lucario', id: 448 },
  { name: 'squirtle', label: 'Squirtle', id: 7 },
  { name: 'snorlax', label: 'Snorlax', id: 143 },
];
const MAX_SUGGESTIONS = 6;
const MAX_RECENT = 10;

const labelOf = (name) => name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('-');

function detectSecureContext() {
  if (typeof window === 'undefined') return true;
  return window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

export function ScannerModal({ onCardDetected, recentCards = [], onOpenCard }) {
  // Species names for search suggestions and candidate pictures (list index + 1 = Pokedex number)
  const [allNames, setAllNames] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingName, setLoadingName] = useState('');
  const confirmInputRef = useRef(null);
  // Bumped when a download is cancelled, so its late result is ignored
  const loadTokenRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    getAllPokemonNames().then((names) => {
      if (!cancelled) setAllNames(names);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Only the full ordered list maps names to Pokedex numbers (the offline fallback is unordered)
  const idOf = (name) => {
    if (allNames.length < 1000) return null;
    const index = allNames.indexOf(String(name).toLowerCase());
    return index >= 0 ? index + 1 : null;
  };
  const thumbFor = (name) => {
    const quick = QUICK_PICKS.find((q) => q.name === String(name).toLowerCase());
    const id = quick?.id || idOf(name);
    return id ? artworkUrl(id) : null;
  };
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isSecure] = useState(detectSecureContext);
  const [facingMode, setFacingMode] = useState('environment');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusText, setScanStatusText] = useState('');
  const [scanError, setScanError] = useState(null);

  // Recognition confirmation state
  const [detectedName, setDetectedName] = useState('');
  const [detectedCandidates, setDetectedCandidates] = useState([]);
  // Kept separate from the name so clearing the input does not close the panel
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [manualInputName, setManualInputName] = useState('');
  const [isLoadingOnline, setIsLoadingOnline] = useState(false);
  const [onlineError, setOnlineError] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const nativeCameraInputRef = useRef(null);
  const reticleRef = useRef(null);
  // Incremented on every start/stop so a getUserMedia call that resolves late can tell it is stale
  const cameraRequestRef = useRef(0);
  const isLoadingOnlineRef = useRef(false);

  const startCamera = async (mode = facingMode) => {
    const requestId = ++cameraRequestRef.current;
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (!detectSecureContext()) {
        throw new Error('SECURE_CONTEXT_REQUIRED');
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MEDIA_DEVICES_NOT_SUPPORTED');
      }

      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (constraintErr) {
        // Permission problems will not be fixed by looser constraints
        if (constraintErr?.name === 'NotAllowedError' || constraintErr?.name === 'SecurityError') {
          throw constraintErr;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      if (requestId !== cameraRequestRef.current) {
        // The component unmounted or another request started meanwhile: release the camera
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('autoplay', 'true');
        videoRef.current.setAttribute('muted', 'true');
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('play prevented:', playErr);
        }
        if (requestId === cameraRequestRef.current) {
          setCameraActive(true);
        }
      }
    } catch (err) {
      if (requestId !== cameraRequestRef.current) return;
      if (err.message === 'SECURE_CONTEXT_REQUIRED' || err.name === 'SecurityError') {
        setCameraError('BẢO MẬT: Trình duyệt điện thoại chặn camera trực tiếp qua HTTP IP. Hãy dùng nút "Chụp Bằng Camera Điện Thoại" bên dưới.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('QUYỀN TRUY CẬP: Cần cấp quyền truy cập Camera trong cài đặt trình duyệt.');
      } else if (err.message === 'MEDIA_DEVICES_NOT_SUPPORTED') {
        setCameraError('Trình duyệt này không hỗ trợ mở Camera trực tiếp. Hãy tải ảnh thẻ lên hoặc dùng camera điện thoại.');
      } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
        setCameraError('Không tìm thấy Camera trên thiết bị này.');
      } else if (err.name === 'NotReadableError') {
        setCameraError('Camera đang được ứng dụng khác sử dụng.');
      } else {
        setCameraError('Không thể mở luồng Camera trực tiếp.');
      }
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    cameraRequestRef.current++;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const openConfirmation = (name, candidates) => {
    setDetectedName(name);
    setManualInputName(name);
    setDetectedCandidates(candidates);
    setIsConfirmOpen(true);
  };

  // Step 1: Recognize Name from Image using Google Lens-grade OCR
  const processImageForPokemon = async (imgElement, fileName = '') => {
    setIsScanning(true);
    setScanProgress(15);
    setScanStatusText('Đang chụp ảnh & căn chỉnh thẻ...');
    setOnlineError(null);
    setScanError(null);
    sounds.playShutter();

    try {
      // Check file name hint
      if (fileName) {
        const match = await findBestPokemonNameFromText(fileName.replace(/\.[a-z0-9]+$/i, ''));
        if (match) {
          setScanProgress(100);
          setIsScanning(false);
          openConfirmation(match, [{ name: match, displayName: match.toUpperCase(), score: 100 }]);
          sounds.playScanBeep();
          return;
        }
      }

      setScanProgress(35);
      setScanStatusText('Đang nhận diện tên Pokémon trên thẻ (AI OCR)...');

      const ocrResult = await recognizeCardWithOCR(imgElement, (pct) => {
        setScanProgress(35 + Math.round(pct * 0.5));
      });

      console.log('[PokeScan AI OCR Output]:', ocrResult);

      setScanProgress(100);
      setIsScanning(false);
      sounds.playScanBeep();

      if (ocrResult.candidates && ocrResult.candidates.length > 0) {
        openConfirmation(ocrResult.candidates[0].name, ocrResult.candidates);
      } else if (ocrResult.bestMatch) {
        openConfirmation(ocrResult.bestMatch, [{ name: ocrResult.bestMatch, displayName: ocrResult.bestMatch.toUpperCase(), score: ocrResult.confidence || 80 }]);
      } else {
        // Nothing recognised: let the user type the name instead of guessing one
        openConfirmation('', []);
        setManualInputName((ocrResult.rawText || '').slice(0, 15).trim());
        setOnlineError('Không đọc được tên Pokémon trên ảnh. Hãy nhập tên thủ công.');
      }
    } catch (err) {
      console.error('OCR error:', err);
      setIsScanning(false);
      openConfirmation('', []);
      setOnlineError('Nhận diện ảnh thất bại. Hãy nhập tên Pokémon thủ công.');
    }
  };

  // Step 2: Fetch Pokemon from Online sources (PokeAPI, TCG API & YouTube)
  const handleFetchOnline = async (targetName = detectedName || manualInputName) => {
    // A ref guards against double submits (Enter + click) before React re-renders
    if (isLoadingOnlineRef.current) return;

    if (!targetName || !targetName.trim()) {
      setOnlineError('Vui lòng nhập tên Pokémon');
      return;
    }

    isLoadingOnlineRef.current = true;
    const token = ++loadTokenRef.current;
    setIsLoadingOnline(true);
    setLoadingName(labelOf(targetName.trim()));
    setOnlineError(null);

    try {
      console.log('[PokeScan] Fetching online data for:', targetName);
      const onlinePokemon = await fetchPokemonOnline(targetName.trim());
      if (token !== loadTokenRef.current) return; // cancelled meanwhile
      setDetectedName('');
      setIsConfirmOpen(false);

      // Advance to Video Showcase and detail flow!
      onCardDetected(onlinePokemon);
    } catch (err) {
      if (token !== loadTokenRef.current) return;
      console.error('Online fetch failed:', err);
      setOnlineError(err.message || 'Không tìm thấy Pokémon này trên cơ sở dữ liệu online.');
    } finally {
      if (token === loadTokenRef.current) {
        isLoadingOnlineRef.current = false;
        setIsLoadingOnline(false);
      }
    }
  };

  // Stop waiting for a download the child no longer wants (wrong name, too slow...)
  const cancelLoading = () => {
    loadTokenRef.current += 1;
    isLoadingOnlineRef.current = false;
    setIsLoadingOnline(false);
    setOnlineError(null);
  };

  const closeConfirmation = () => {
    cancelLoading();
    setDetectedName('');
    setDetectedCandidates([]);
    setIsConfirmOpen(false);
  };

  // Wrong Pokemon recognised: close the panel and go straight back to taking a picture
  const retakeScan = () => {
    closeConfirmation();
    setScanError(null);
    if (!cameraActive) nativeCameraInputRef.current?.click();
  };

  // Suggestions while typing: names starting with the text first, then containing it
  const query = manualInputName.trim().toLowerCase().replace(/\s+/g, '-');
  const suggestions =
    query.length >= 2
      ? [
          ...allNames.filter((n) => n.startsWith(query)),
          ...allNames.filter((n) => !n.startsWith(query) && n.includes(query)),
        ]
          .slice(0, MAX_SUGGESTIONS)
          .map((n) => ({ name: n, label: labelOf(n), id: idOf(n), thumb: thumbFor(n) }))
      : [];

  // Recently scanned cards, newest first
  const recent = [...recentCards]
    .sort((a, b) => String(b.lastScannedAt || '').localeCompare(String(a.lastScannedAt || '')))
    .slice(0, MAX_RECENT);

  const captureCameraFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      // Capturing before the first frame arrives would OCR a black image
      setScanError('Camera chưa sẵn sàng, vui lòng thử lại sau giây lát.');
      return;
    }
    // Only the part of the frame inside the on-screen reticle holds the card; OCR on the
    // full frame shrinks the name text and adds background noise
    let region = { x: 0, y: 0, width: video.videoWidth, height: video.videoHeight };
    const videoRect = video.getBoundingClientRect();
    const reticleRect = reticleRef.current?.getBoundingClientRect();
    if (reticleRect && videoRect.width > 0 && videoRect.height > 0 && reticleRect.width > 0) {
      const mapped = mapRectToVideoFrame(reticleRect, videoRect, video.videoWidth, video.videoHeight, 0.06);
      if (mapped.width > 50 && mapped.height > 50) region = mapped;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(region.width);
    canvas.height = Math.round(region.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setScanError('Không thể chụp khung hình từ Camera.');
      return;
    }
    ctx.drawImage(video, region.x, region.y, region.width, region.height, 0, 0, canvas.width, canvas.height);

    processImageForPokemon(canvas, '');
  };

  const handleFileUpload = (e) => {
    const input = e.target;
    const file = input.files?.[0];
    // Reset so choosing the same file again still fires onChange
    input.value = '';
    if (!file) return;

    setScanError(null);
    if (file.type && !file.type.startsWith('image/')) {
      setScanError('Tệp đã chọn không phải là ảnh. Vui lòng chọn ảnh thẻ bài.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        processImageForPokemon(img, file.name);
      };
      img.onerror = () => {
        setScanError('Không đọc được ảnh (định dạng không hỗ trợ hoặc tệp bị hỏng).');
      };
      img.src = event.target.result;
    };
    reader.onerror = () => {
      setScanError('Không đọc được tệp ảnh.');
    };
    reader.readAsDataURL(file);
  };


  return (
    <div className="w-full max-w-xl mx-auto px-4 py-4 sm:py-6 flex flex-col items-center">
      <div className="w-full text-center mb-3">
        <h2 className="text-xl sm:text-2xl font-black text-slate-50 uppercase tracking-wide flex items-center justify-center gap-2">
          <PokeballIcon className="w-7 h-7" />
          <span>Quét thẻ Pokémon</span>
        </h2>
        <p className="text-sm text-slate-400 mt-1">Đưa tên trên thẻ vào khung rồi bấm Pokéball để chụp</p>
      </div>
      {/* Main Scanner Viewport Container */}
      <div data-theme="dark" className="relative w-full aspect-[4/5] sm:aspect-[3/4] max-w-sm rounded-3xl overflow-hidden border-2 border-slate-700/80 bg-slate-950 shadow-2xl shadow-cyan-950/20 flex items-center justify-center">
        
        {/* Live Camera Video Feed */}
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
        />

        {/* Fallback View when camera cannot be opened directly */}
        {!cameraActive && (
          <div className="flex flex-col items-center justify-center p-5 text-center text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center mb-3">
              <Camera className="w-8 h-8 text-slate-400" />
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 max-w-xs mb-3 leading-relaxed">
              <div className="flex items-center justify-center space-x-1 text-amber-400 font-bold mb-1">
                <ShieldAlert className="w-4 h-4" />
                <span>{isSecure ? 'Chưa mở được Camera' : 'Trình duyệt yêu cầu HTTPS'}</span>
              </div>
              <p className="text-[11px] text-slate-400" role="status">
                {cameraError
                  ? cameraError
                  : isSecure
                    ? 'Đang kết nối Camera... Nếu không được, bấm nút dưới để chụp bằng Máy ảnh gốc điện thoại:'
                    : 'Để bảo vệ quyền riêng tư, Safari/Chrome chặn camera qua HTTP IP. Bấm nút dưới để chụp bằng Máy ảnh gốc điện thoại:'}
              </p>
            </div>

            {/* Native Mobile Camera Button (Always Works 100% on phones!) */}
            <button
              onClick={() => nativeCameraInputRef.current?.click()}
              className="w-full max-w-xs py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-red-600/40 flex items-center justify-center space-x-2 transition-transform active:scale-95 mb-2 cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>Chụp Bằng Camera Điện Thoại</span>
            </button>

            <button
              onClick={() => startCamera()}
              className="text-[11px] text-cyan-400 hover:underline flex items-center space-x-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Thử kết nối lại Camera</span>
            </button>
          </div>
        )}

        {/* Viewfinder Target Reticle (Card Aspect Ratio) */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
          <div ref={reticleRef} className="relative w-full aspect-[63/88] max-h-[85%] rounded-2xl border-2 border-dashed border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.25)] flex items-center justify-center">
            
            {/* 4 Holographic Glowing Corner Brackets */}
            <div className="absolute -top-1.5 -left-1.5 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
            <div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
            <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

            {/* Target Area Guide for Name Header */}
            <div className="absolute top-2 inset-x-2 h-10 border border-cyan-400/40 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <span className="text-[9px] font-tech text-cyan-300 uppercase tracking-wider">
                CANH VÙNG TÊN THẺ BÀI
              </span>
            </div>

            {/* Laser Scanning Line Animation */}
            {cameraActive && !isScanning && (
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-scanner-line opacity-80" />
            )}

            {/* Center Reticle Crosshair */}
            <div className="w-8 h-8 border border-white/30 rounded-full flex items-center justify-center opacity-60">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            </div>
          </div>
        </div>

        {/* Scanning & OCR Progress Overlay */}
        {isScanning && (
          <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-full border-4 border-t-cyan-400 border-r-amber-400 border-b-rose-500 border-l-transparent animate-spin mb-3" />
            <span className="text-sm font-tech font-bold text-white tracking-widest uppercase">
              {scanStatusText || 'ĐANG ĐỌC TÊN THẺ BÀI...'}
            </span>
            <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden mt-3 border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all duration-150"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <span className="text-[10px] font-tech text-slate-400 mt-1.5">{scanProgress}%</span>
          </div>
        )}


      </div>

      {/* Confirmation: "Is it this Pokemon?" with big picture choices and clear ways out */}
      {isConfirmOpen && (
        <div className="w-full max-w-sm mt-3 p-4 rounded-3xl bg-slate-900 border-2 border-cyan-400/80 shadow-[0_0_25px_rgba(6,182,212,0.3)] flex flex-col gap-3 animate-fadeIn" data-testid="confirm-panel">
          <div className="flex items-center justify-center gap-2 text-cyan-400 text-sm font-black">
            {detectedCandidates.length > 0 ? <Check className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
            <span>{detectedCandidates.length > 0 ? 'CÓ PHẢI POKÉMON NÀY KHÔNG?' : 'NHẬP TÊN POKÉMON'}</span>
          </div>

          {detectedCandidates.length > 0 && (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Gợi ý từ ảnh">
              {detectedCandidates.map((cand) => {
                const active = (detectedName || manualInputName).toLowerCase() === cand.name.toLowerCase();
                const thumb = thumbFor(cand.name);
                return (
                  <button
                    key={cand.name}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setDetectedName(cand.name);
                      setManualInputName(cand.name);
                    }}
                    className={`relative flex items-center gap-2 p-2 rounded-2xl border-2 text-left transition-all active:scale-95 ${
                      active ? 'border-cyan-400 bg-cyan-500/15 shadow-[0_0_14px_rgba(34,211,238,0.35)]' : 'border-slate-700 bg-slate-950'
                    }`}
                  >
                    {thumb ? (
                      <img src={thumb} alt="" loading="lazy" className="w-12 h-12 object-contain" />
                    ) : (
                      <PokeballIcon className="w-10 h-10" />
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-slate-50 truncate">{cand.displayName}</span>
                      <span className="block text-[10px] font-bold text-slate-400">Khớp {cand.score}%</span>
                    </span>
                    {active && <Check className="absolute top-1 right-1 w-4 h-4 p-0.5 rounded-full bg-cyan-400 text-slate-950" />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="relative">
            <input
              ref={confirmInputRef}
              type="text"
              aria-label="Tên Pokémon cần xác nhận"
              value={manualInputName}
              onChange={(e) => {
                setDetectedName(e.target.value);
                setManualInputName(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFetchOnline();
              }}
              placeholder="Gõ tên Pokémon, vd: Pikachu"
              className="w-full pl-3 pr-10 py-3 rounded-2xl bg-slate-950 border-2 border-slate-700 focus:border-amber-400 text-slate-50 font-bold text-base focus:outline-none"
            />
            <Edit3 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {onlineError && (
            <p className="text-sm font-bold text-rose-400 text-center" role="alert">
              {onlineError}
            </p>
          )}

          {isLoadingOnline ? (
            <div className="flex gap-2">
              <div className="flex-1 py-3.5 rounded-2xl bg-slate-800 text-slate-100 font-black text-sm flex items-center justify-center gap-2" role="status">
                <PokeballIcon className="w-6 h-6" spin />
                Đang tải {loadingName}...
              </div>
              <button onClick={cancelLoading} className="px-4 py-3.5 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-black text-sm flex items-center gap-1.5">
                <X className="w-4 h-4" /> Hủy tải
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleFetchOnline()}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-500 via-rose-500 to-orange-500 text-white font-black text-base shadow-lg shadow-red-600/40 flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <PokeballIcon className="w-7 h-7" />
              {detectedCandidates.length > 0 ? 'Đúng rồi! Tải Pokémon' : 'Tìm Pokémon này'}
            </button>
          )}

          {/* Wrong guess? Three clear ways out */}
          <div className="grid grid-cols-3 gap-2">
            <button onClick={retakeScan} className="py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-black flex flex-col items-center gap-1">
              <RotateCcw className="w-5 h-5 text-cyan-400" /> Quét lại
            </button>
            <button onClick={() => confirmInputRef.current?.focus()} className="py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-black flex flex-col items-center gap-1">
              <Edit3 className="w-5 h-5 text-amber-400" /> Nhập tên khác
            </button>
            <button onClick={closeConfirmation} className="py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-black flex flex-col items-center gap-1">
              <X className="w-5 h-5 text-rose-400" /> Hủy
            </button>
          </div>
        </div>
      )}

      {/* Capture bar: upload - big Pokeball shutter - flip camera */}
      <div className="w-full max-w-sm flex items-center justify-between mt-4 px-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isScanning || isLoadingOnline}
          aria-label="Tải ảnh thẻ lên"
          className="w-16 flex flex-col items-center gap-1 text-slate-200 disabled:opacity-40"
        >
          <span className="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center shadow-lg active:scale-90 transition-transform">
            <ImageIcon className="w-6 h-6 text-cyan-400" />
          </span>
          <span className="text-[11px] font-bold">Tải ảnh</span>
        </button>

        <button
          onClick={cameraActive ? captureCameraFrame : () => nativeCameraInputRef.current?.click()}
          disabled={isScanning || isLoadingOnline}
          aria-label={cameraActive ? 'Chụp quét tên thẻ' : 'Mở camera điện thoại'}
          className="group relative w-24 h-24 rounded-full bg-white/10 p-1.5 shadow-[0_0_30px_rgba(239,68,68,0.45)] disabled:opacity-50 active:scale-90 transition-transform"
        >
          <span className="absolute inset-0 rounded-full border-4 border-white/70 group-hover:border-white" />
          <PokeballIcon className={`w-full h-full drop-shadow-xl ${isScanning ? 'animate-spin' : ''}`} />
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-black text-slate-100">
            {cameraActive ? 'Chụp' : 'Mở camera'}
          </span>
        </button>

        <button
          onClick={cameraActive ? toggleCameraFacing : () => startCamera()}
          disabled={isScanning || isLoadingOnline}
          aria-label={cameraActive ? 'Đổi camera trước / sau' : 'Thử kết nối lại camera'}
          className="w-16 flex flex-col items-center gap-1 text-slate-200 disabled:opacity-40"
        >
          <span className="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center shadow-lg active:scale-90 transition-transform">
            {cameraActive ? <FlipHorizontal className="w-6 h-6 text-amber-400" /> : <RefreshCw className="w-6 h-6 text-amber-400" />}
          </span>
          <span className="text-[11px] font-bold">{cameraActive ? 'Đổi cam' : 'Thử lại'}</span>
        </button>

        <input ref={nativeCameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
      </div>

      {scanError && (
        <p role="alert" className="w-full max-w-sm mt-8 text-sm font-bold text-rose-400 text-center flex items-center justify-center gap-1">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{scanError}</span>
        </p>
      )}

      {/* Error of a direct search shown here when the confirmation panel is closed */}
      {onlineError && !isConfirmOpen && (
        <p role="alert" className="w-full max-w-sm mt-8 text-sm font-bold text-rose-400 text-center">{onlineError}</p>
      )}

      {/* Search with live suggestions */}
      <div className="relative w-full max-w-sm mt-9">
        <div className="flex gap-2 p-1.5 rounded-2xl bg-slate-900/80 border-2 border-slate-700 focus-within:border-cyan-400 transition-colors">
          <span className="flex items-center pl-2">
            <Search className="w-5 h-5 text-slate-400" />
          </span>
          <input
            type="text"
            aria-label="Tìm Pokémon theo tên"
            placeholder="Tìm Pokémon: Pikachu, Eevee..."
            value={manualInputName}
            onChange={(e) => {
              setManualInputName(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setShowSuggestions(false);
                handleFetchOnline(manualInputName);
              }
            }}
            className="flex-1 min-w-0 py-2 bg-transparent text-base text-slate-50 placeholder-slate-500 focus:outline-none"
          />
          {manualInputName && (
            <button onClick={() => setManualInputName('')} aria-label="Xóa ô tìm kiếm" className="px-1 text-slate-400 hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleFetchOnline(manualInputName)}
            disabled={isLoadingOnline || !manualInputName.trim()}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-black text-sm shadow-md disabled:opacity-40 flex items-center gap-1.5 active:scale-95"
          >
            <PokeballIcon className="w-5 h-5" />
            <span>Tải</span>
          </button>
        </div>

        {showSuggestions && suggestions.length > 0 && !isConfirmOpen && (
          <ul className="absolute z-20 left-0 right-0 mt-1 rounded-2xl bg-slate-900 border-2 border-slate-700 shadow-2xl overflow-hidden" role="listbox" aria-label="Gợi ý tên">
            {suggestions.map((s) => (
              <li key={s.name}>
                <button
                  role="option"
                  aria-selected="false"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setShowSuggestions(false);
                    setManualInputName(s.label);
                    handleFetchOnline(s.name);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-800 text-left"
                >
                  {s.thumb ? <img src={s.thumb} alt="" loading="lazy" className="w-10 h-10 object-contain" /> : <PokeballIcon className="w-8 h-8" />}
                  <span className="text-sm font-black text-slate-100">{s.label}</span>
                  <span className="ml-auto text-xs font-bold text-slate-500">#{String(s.id || '').padStart(3, '0')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recently scanned: open the saved card straight away (no download) */}
      {recent.length > 0 && (
        <section className="w-full max-w-sm mt-4" aria-label="Pokémon gần đây">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-300">
            <History className="w-4 h-4 text-cyan-400" /> Pokémon gần đây
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recent.map((card) => (
              <button
                key={card.id}
                onClick={() => onOpenCard?.(card)}
                aria-label={`Mở ${card.name}`}
                className="shrink-0 w-20 p-1.5 rounded-2xl bg-slate-900/80 border-2 border-slate-700 hover:border-cyan-400 flex flex-col items-center active:scale-95 transition-transform"
              >
                <img src={card.fallbackImage || card.image} alt="" loading="lazy" className="w-14 h-14 object-contain" />
                <span className="w-full text-center text-[11px] font-black text-slate-100 truncate">{card.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Famous Pokemon, one tap away */}
      <section className="w-full max-w-sm mt-4 p-3 rounded-3xl bg-slate-900/60 border border-slate-800" aria-label="Pokémon nổi tiếng">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-300">
          <Sparkles className="w-4 h-4 text-amber-400" /> Pokémon nổi tiếng
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_PICKS.map((p) => (
            <button
              key={p.name}
              onClick={() => handleFetchOnline(p.name)}
              disabled={isLoadingOnline}
              className="flex flex-col items-center p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/60 disabled:opacity-50 active:scale-95 transition-transform"
            >
              <img src={artworkUrl(p.id)} alt="" loading="lazy" className="w-12 h-12 object-contain" />
              <span className="text-[11px] font-bold text-slate-200">{p.label}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
