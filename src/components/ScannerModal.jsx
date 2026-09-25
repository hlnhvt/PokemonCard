import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  FlipHorizontal, 
  Zap, 
  Sparkles, 
  AlertCircle, 
  Image as ImageIcon,
  Check,
  RefreshCw,
  HelpCircle,
  ShieldAlert,
  Smartphone
} from 'lucide-react';
import { POKEMON_CARDS, matchPokemonCard } from '../data/pokemonCards';
import { sounds } from '../utils/soundEffects';

export function ScannerModal({ onCardDetected }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isSecure, setIsSecure] = useState(true);
  const [facingMode, setFacingMode] = useState('environment'); // environment (back) or user (front)
  const [isScanning, setIsScanning] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const nativeCameraInputRef = useRef(null);

  // Check secure context on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const secure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      setIsSecure(secure);
    }
  }, []);

  // Multi-tier robust camera initialization
  const startCamera = async (mode = facingMode) => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Check browser security restriction on HTTP
      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        throw new Error('SECURE_CONTEXT_REQUIRED');
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MEDIA_DEVICES_NOT_SUPPORTED');
      }

      let stream = null;

      // Tier 1: Try with ideal facing mode
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err1) {
        console.warn('Tier 1 camera failed, trying Tier 2:', err1);
        // Tier 2: Try basic video constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
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
          console.warn('video.play() auto-play prevented:', playErr);
        }
        setCameraActive(true);
      }
    } catch (err) {
      console.warn('Camera access issue:', err);
      if (err.message === 'SECURE_CONTEXT_REQUIRED' || err.name === 'SecurityError') {
        setCameraError('BẢO MẬT: Trình duyệt điện thoại (iOS Safari/Android Chrome) bắt buộc kết nối HTTPS để mở Camera trực tiếp qua IP.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('QUYỀN TRUY CẬP: Bạn cần cho phép quyền truy cập Máy ảnh trong cài đặt trình duyệt của điện thoại.');
      } else {
        setCameraError('Không thể mở luồng Video Camera trực tiếp.');
      }
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
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

  // Flip camera back/front
  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Recognize card from image data (canvas or file)
  const processImageForPokemon = (imgElement, fileName = '') => {
    setIsScanning(true);
    sounds.playShutter();

    setTimeout(() => {
      sounds.playScanBeep();

      // Check if file name matches any pokemon
      if (fileName) {
        const foundByName = matchPokemonCard(fileName);
        if (foundByName) {
          setIsScanning(false);
          onCardDetected(foundByName);
          return;
        }
      }

      // Analyze image color tones from canvas
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0, 120, 120);
        const data = ctx.getImageData(0, 0, 120, 120).data;

        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        r = r / count;
        g = g / count;
        b = b / count;

        let detected = POKEMON_CARDS[0]; // default Charizard

        // Color heuristic matching
        if (r > 150 && g > 130 && b < 100) {
          // Yellow -> Pikachu
          detected = POKEMON_CARDS.find((p) => p.id === 'pikachu-vmax') || POKEMON_CARDS[1];
        } else if (r > 140 && g < 100 && b < 100) {
          // Red/Orange -> Charizard
          detected = POKEMON_CARDS.find((p) => p.id === 'charizard-vmax') || POKEMON_CARDS[0];
        } else if (b > 130 && r < 120) {
          // Blue -> Greninja / Blastoise
          detected = POKEMON_CARDS.find((p) => p.id === 'greninja-ex') || POKEMON_CARDS[5];
        } else if (g > 130 && r < 120) {
          // Green -> Rayquaza
          detected = POKEMON_CARDS.find((p) => p.id === 'rayquaza-vmax') || POKEMON_CARDS[3];
        } else if (r > 120 && b > 120 && g < 110) {
          // Purple/Pink -> Mewtwo or Gengar
          detected = POKEMON_CARDS.find((p) => p.id === 'mewtwo-vstar') || POKEMON_CARDS[2];
        } else {
          const randomIndex = Math.floor(Math.random() * POKEMON_CARDS.length);
          detected = POKEMON_CARDS[randomIndex];
        }

        setIsScanning(false);
        onCardDetected(detected);
      } catch (err) {
        console.error('Image analysis error:', err);
        setIsScanning(false);
        onCardDetected(POKEMON_CARDS[0]);
      }
    }, 700);
  };

  // Snapshot from live camera
  const captureCameraFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    processImageForPokemon(canvas, '');
  };

  // Handle file upload or native camera snapshot
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        processImageForPokemon(img, file.name);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Quick Demo Card Click
  const handleSelectDemoCard = (card) => {
    sounds.playScanBeep();
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      onCardDetected(card);
    }, 500);
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-4 sm:py-6 flex flex-col items-center">
      
      {/* Top Banner Guide */}
      <div className="w-full text-center mb-3">
        <h2 className="text-xl sm:text-2xl font-black text-white font-tech uppercase tracking-wider flex items-center justify-center space-x-2">
          <Camera className="w-6 h-6 text-red-500 animate-pulse" />
          <span>QUÉT THẺ BÀI POKÉMON</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Chụp ảnh thẻ thật trên điện thoại hoặc bấm Thẻ Mẫu để xem video và mở Pokedex
        </p>
      </div>

      {/* Main Scanner Viewport Container */}
      <div className="relative w-full aspect-[4/5] sm:aspect-[3/4] max-w-sm rounded-3xl overflow-hidden border-2 border-slate-700/80 bg-slate-950 shadow-2xl shadow-red-950/20 flex items-center justify-center">
        
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
                <span>Trình duyệt yêu cầu HTTPS</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Để bảo vệ quyền riêng tư, Safari/Chrome trên điện thoại chặn camera trực tiếp khi truy cập bằng <code>http://IP</code>.
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
              <span>Thử kích hoạt lại luồng Video</span>
            </button>
          </div>
        )}

        {/* Viewfinder Target Reticle (Card Aspect Ratio) */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
          <div className="relative w-full aspect-[63/88] max-h-[85%] rounded-2xl border-2 border-dashed border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.25)] flex items-center justify-center">
            
            {/* 4 Holographic Glowing Corner Brackets */}
            <div className="absolute -top-1.5 -left-1.5 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
            <div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
            <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

            {/* Laser Scanning Line Animation */}
            {cameraActive && !isScanning && (
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-scanner-line opacity-80" />
            )}

            {/* Center Reticle Crosshair */}
            <div className="w-8 h-8 border border-white/30 rounded-full flex items-center justify-center opacity-60">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
            </div>

            {/* Card Frame Label */}
            <span className="absolute top-2 text-[10px] font-tech font-bold uppercase tracking-widest text-slate-300/80 bg-slate-950/70 px-2 py-0.5 rounded border border-white/10">
              CANH KHUNG THẺ BÀI
            </span>
          </div>
        </div>

        {/* Scanning Progress Overlay */}
        {isScanning && (
          <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-t-red-500 border-r-amber-400 border-b-cyan-400 border-l-transparent animate-spin mb-3" />
            <span className="text-sm font-tech font-bold text-white tracking-widest uppercase animate-pulse">
              ĐANG NHẬN DIỆN THẺ BÀI...
            </span>
            <p className="text-[11px] text-slate-400 font-tech mt-1">Đang kích hoạt video trình diễn</p>
          </div>
        )}

        {/* Top Controls Overlay on Camera: Switch Front/Back Camera */}
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

      {/* Main Action Buttons */}
      <div className="w-full max-w-sm flex items-center justify-center gap-2.5 mt-4">
        {/* Shutter / Scan Button (if live video active) OR Native Phone Camera button */}
        {cameraActive ? (
          <button
            onClick={captureCameraFrame}
            disabled={isScanning}
            className="flex-1 py-3 px-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-xl shadow-red-600/30 flex items-center justify-center space-x-1.5 transition-all duration-200 active:scale-95 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Chụp Quét Thẻ</span>
          </button>
        ) : (
          <button
            onClick={() => nativeCameraInputRef.current?.click()}
            disabled={isScanning}
            className="flex-1 py-3 px-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-xl shadow-red-600/30 flex items-center justify-center space-x-1.5 transition-all duration-200 active:scale-95 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Mở Camera Điện Thoại</span>
          </button>
        )}

        {/* Upload Existing Photo Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isScanning}
          className="flex-1 py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs shadow-lg flex items-center justify-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
        >
          <Upload className="w-4 h-4 text-cyan-400" />
          <span>Tải Ảnh Từ Thư Viện</span>
        </button>

        {/* Hidden File Input for Native Mobile Camera */}
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Hidden File Input for Gallery Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Quick Test Demo Deck Section */}
      <div className="w-full max-w-sm mt-5 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-tech font-bold uppercase tracking-wider text-slate-200">
              BỘ THẺ MẪU (BẤM ĐỂ QUÉT NGAY)
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-tech">8 Thẻ Siêu Hiếm</span>
        </div>

        <p className="text-[11px] text-slate-400 mb-3">
          Bấm bất kỳ thẻ mẫu bên dưới để xem ngay video ngắn ấn tượng & thông tin chi tiết:
        </p>

        {/* Demo card pills */}
        <div className="grid grid-cols-4 gap-2">
          {POKEMON_CARDS.map((card) => (
            <button
              key={card.id}
              onClick={() => handleSelectDemoCard(card)}
              className="group relative flex flex-col items-center p-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-400/50 transition-all text-center"
            >
              <div className="w-12 h-14 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 group-hover:scale-105 transition-transform mb-1">
                <img
                  src={card.image}
                  alt={card.name}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = card.fallbackImage;
                  }}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[10px] font-bold text-slate-300 truncate w-full group-hover:text-amber-300">
                {card.name.split(' ')[0]}
              </span>
              <span className="text-[9px] text-slate-500 font-tech">
                {card.types[0]}
              </span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
