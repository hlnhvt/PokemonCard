import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  FlipHorizontal,
  Sparkles,
  AlertCircle,
  Check,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  ScanText,
  Globe,
  ArrowRight,
  Edit3
} from 'lucide-react';
import { recognizeCardWithOCR } from '../utils/cardRecognizer';
import { mapRectToVideoFrame } from '../utils/cardImage';
import { findBestPokemonNameFromText, fetchPokemonOnline } from '../services/pokemonOnlineService';
import { sounds } from '../utils/soundEffects';

function detectSecureContext() {
  if (typeof window === 'undefined') return true;
  return window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

export function ScannerModal({ onCardDetected }) {
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
    setIsLoadingOnline(true);
    setOnlineError(null);

    try {
      console.log('[PokeScan] Fetching online data for:', targetName);
      const onlinePokemon = await fetchPokemonOnline(targetName.trim());
      setDetectedName('');
      setIsConfirmOpen(false);

      // Advance to Video Showcase and detail flow!
      onCardDetected(onlinePokemon);
    } catch (err) {
      console.error('Online fetch failed:', err);
      setOnlineError(err.message || 'Không tìm thấy Pokémon này trên cơ sở dữ liệu online.');
    } finally {
      isLoadingOnlineRef.current = false;
      setIsLoadingOnline(false);
    }
  };

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
      
      {/* Top Banner Guide */}
      <div className="w-full text-center mb-3">
        <h2 className="text-xl sm:text-2xl font-black text-white font-tech uppercase tracking-wider flex items-center justify-center space-x-2">
          <Globe className="w-6 h-6 text-cyan-400 animate-pulse" />
          <span>QUÉT THẺ & ĐỒNG BỘ DỮ LIỆU ONLINE</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Nhận diện tên Pokémon ➔ Lấy thông số PokeAPI & Video YouTube thời gian thực
        </p>
      </div>

      {/* Main Scanner Viewport Container */}
      <div className="relative w-full aspect-[4/5] sm:aspect-[3/4] max-w-sm rounded-3xl overflow-hidden border-2 border-slate-700/80 bg-slate-950 shadow-2xl shadow-cyan-950/20 flex items-center justify-center">
        
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

        {/* Top Controls Overlay on Camera */}
        {cameraActive && (
          <div className="absolute top-3 right-3 z-20 flex space-x-2">
            <button
              onClick={toggleCameraFacing}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 backdrop-blur-md transition-colors"
              title="Đổi camera trước / sau"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>

      {/* Confirmation & Online Fetch Modal (Displayed as soon as Name is recognized) */}
      {isConfirmOpen && (
        <div className="w-full max-w-sm mt-3 p-4 rounded-2xl bg-slate-900 border-2 border-cyan-400/80 shadow-[0_0_25px_rgba(6,182,212,0.3)] flex flex-col items-center animate-fadeIn">

          <div className="flex items-center space-x-1.5 text-cyan-400 text-xs font-bold mb-1">
            {detectedCandidates.length > 0 ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            <span>{detectedCandidates.length > 0 ? 'ĐÃ NHẬN DIỆN TÊN POKÉMON' : 'NHẬP TÊN POKÉMON'}</span>
          </div>

          <div className="w-full my-2">
            <label className="text-[10px] font-tech text-slate-400 uppercase tracking-wider block mb-1">
              Tên Pokémon (bạn có thể bấm để chỉnh sửa nếu cần):
            </label>
            <div className="relative">
              <input
                type="text"
                aria-label="Tên Pokémon cần xác nhận"
                value={manualInputName}
                onChange={(e) => {
                  setDetectedName(e.target.value);
                  setManualInputName(e.target.value);
                }}
                placeholder="Nhập tên Pokemon (vd: Charizard, Pikachu, Lucario...)"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-cyan-500/50 text-white font-bold text-sm focus:outline-none focus:border-amber-400 uppercase tracking-wider"
              />
              <Edit3 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Quick AI OCR Candidate Chips */}
          {detectedCandidates.length > 0 && (
            <div className="w-full my-1.5">
              <span className="text-[10px] font-tech text-slate-400 uppercase tracking-wider block mb-1">
                Gợi ý chuẩn xác từ AI OCR:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {detectedCandidates.map((cand) => (
                  <button
                    key={cand.name}
                    type="button"
                    onClick={() => {
                      setDetectedName(cand.name);
                      setManualInputName(cand.name);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      (detectedName || manualInputName).toLowerCase() === cand.name.toLowerCase()
                        ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>{cand.displayName}</span>
                    <span className="ml-1 text-[10px] opacity-75 font-tech">({cand.score}%)</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {onlineError && (
            <p className="text-xs text-rose-400 mb-2 text-center">{onlineError}</p>
          )}

          <div className="flex w-full space-x-2 mt-1">
            <button
              onClick={() => handleFetchOnline()}
              disabled={isLoadingOnline}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/40 flex items-center justify-center space-x-1.5 transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isLoadingOnline ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang tải PokeAPI & YouTube...</span>
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4" />
                  <span>Tải Dữ Liệu Online & Video ➔</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                setDetectedName('');
                setIsConfirmOpen(false);
                setOnlineError(null);
              }}
              className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
            >
              Hủy
            </button>
          </div>

        </div>
      )}

      {/* Main Action Buttons */}
      <div className="w-full max-w-sm flex items-center justify-center gap-2.5 mt-4">
        {cameraActive ? (
          <button
            onClick={captureCameraFrame}
            disabled={isScanning || isLoadingOnline}
            className="flex-1 py-3 px-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-xl shadow-red-600/30 flex items-center justify-center space-x-1.5 transition-all duration-200 active:scale-95 cursor-pointer"
          >
            <ScanText className="w-4 h-4" />
            <span>Chụp Quét Tên Thẻ</span>
          </button>
        ) : (
          <button
            onClick={() => nativeCameraInputRef.current?.click()}
            disabled={isScanning || isLoadingOnline}
            className="flex-1 py-3 px-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-xl shadow-red-600/30 flex items-center justify-center space-x-1.5 transition-all duration-200 active:scale-95 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Mở Camera Điện Thoại</span>
          </button>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isScanning || isLoadingOnline}
          className="flex-1 py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs shadow-lg flex items-center justify-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
        >
          <Upload className="w-4 h-4 text-cyan-400" />
          <span>Tải Ảnh Thẻ Lên</span>
        </button>

        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {scanError && (
        <p role="alert" className="w-full max-w-sm mt-2 text-xs text-rose-400 text-center flex items-center justify-center space-x-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{scanError}</span>
        </p>
      )}

      {/* Error of a direct search shown here when the confirmation panel is closed */}
      {onlineError && !isConfirmOpen && (
        <p role="alert" className="w-full max-w-sm mt-2 text-xs text-rose-400 text-center">{onlineError}</p>
      )}

      {/* Direct Online Search for ANY Pokemon */}
      <div className="w-full max-w-sm mt-4 p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
        <span className="text-[10px] font-tech text-slate-400 uppercase tracking-wider block mb-1.5">
          HOẶC NHẬP BẤT KỲ TÊN POKÉMON ĐỂ TẢI DỮ LIỆU ONLINE & YOUTUBE:
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            aria-label="Tìm Pokémon theo tên"
            placeholder="Ví dụ: rayquaza, mewtwo, garchomp..."
            value={manualInputName}
            onChange={(e) => setManualInputName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFetchOnline(manualInputName);
            }}
            className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
          <button
            onClick={() => handleFetchOnline(manualInputName)}
            disabled={isLoadingOnline || !manualInputName.trim()}
            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1"
          >
            <span>Tải</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Test Demo Cards */}
      <div className="w-full max-w-sm mt-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-tech font-bold uppercase tracking-wider text-slate-200">
              THẺ MẪU NHANH (TEST ONLINE NGAY)
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-tech">1-Click Test</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {['charizard', 'pikachu', 'mewtwo', 'umbreon', 'gengar', 'greninja', 'lucario', 'blastoise'].map((name) => (
            <button
              key={name}
              onClick={() => handleFetchOnline(name)}
              disabled={isLoadingOnline}
              className="disabled:opacity-50 disabled:cursor-not-allowed py-2 px-1 rounded-xl bg-slate-950/80 hover:bg-cyan-950/50 border border-slate-800 hover:border-cyan-500/50 text-center transition-all group cursor-pointer"
            >
              <span className="text-[11px] font-bold text-slate-300 capitalize group-hover:text-cyan-400 block truncate">
                {name}
              </span>
              <span className="text-[9px] text-slate-500 font-tech">PokeAPI</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
