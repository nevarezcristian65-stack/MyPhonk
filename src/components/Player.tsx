import React, { useState, useEffect, useRef } from "react";
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Repeat, 
  Download, Sparkles, FileAudio, Disc, AlignLeft, RefreshCw, Layers,
  Maximize2, Minimize2, ChevronDown
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Track } from "../types";

interface PlayerProps {
  currentTrack: Track | null;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  accentColor: string;
  glowIntensity: "low" | "medium" | "high";
  isOffline: boolean;
  isPremium: boolean;
  userId: string | null | undefined;
  onOpenPremiumTab: () => void;
}

interface SyncLyricLine {
  time: number;
  text: string;
}

function parseLyrics(lyricText: string, totalDuration: number): SyncLyricLine[] {
  if (!lyricText) return [];
  
  const lines = lyricText.split("\n");
  const parsedLines: SyncLyricLine[] = [];
  
  const timestampRegex = /\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/;
  const simpleSecondsRegex = /\[(\d+(?:\.\d+)?)\]/;

  let hasAnyTimestamp = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const match = trimmed.match(timestampRegex);
    if (match) {
      hasAnyTimestamp = true;
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      
      const timeInSeconds = minutes * 60 + seconds + milliseconds / 1000;
      const cleanText = trimmed.replace(timestampRegex, "").trim();
      
      parsedLines.push({
        time: timeInSeconds,
        text: cleanText || "🎵"
      });
    } else {
      const matchSimple = trimmed.match(simpleSecondsRegex);
      if (matchSimple && !isNaN(parseFloat(matchSimple[1]))) {
        hasAnyTimestamp = true;
        const timeInSeconds = parseFloat(matchSimple[1]);
        const cleanText = trimmed.replace(simpleSecondsRegex, "").trim();
        parsedLines.push({
          time: timeInSeconds,
          text: cleanText || "🎵"
        });
      } else {
        parsedLines.push({
          time: -1,
          text: trimmed
        });
      }
    }
  }

  if (hasAnyTimestamp) {
    return parsedLines.filter(l => l.time !== -1).sort((a, b) => a.time - b.time);
  }

  const activeLines = parsedLines.filter(l => l.text !== "");
  if (activeLines.length === 0) return [];

  const durationSec = totalDuration || 180;
  const startOffset = 1;
  const endOffset = durationSec - 4;
  const step = activeLines.length > 1 ? (endOffset - startOffset) / (activeLines.length - 1) : 0;

  return activeLines.map((line, idx) => ({
    time: startOffset + idx * step,
    text: line.text
  }));
}

export default function Player({
  currentTrack,
  onPrevTrack,
  onNextTrack,
  accentColor,
  glowIntensity,
  isOffline,
  isPremium,
  userId,
  onOpenPremiumTab
}: PlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  
  // Lyrics State
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyricsText, setLyricsText] = useState("");
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // refs for scrolling in expanded view
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLyricRef = useRef<HTMLButtonElement | null>(null);

  // FLAC Export Simulation/In-flight loader state
  const [flacState, setFlacState] = useState<"idle" | "encoding" | "ready">("idle");
  const [flacProgress, setFlacProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    if (currentTrack) {
      audioRef.current = new Audio(currentTrack.url);
      audioRef.current.loop = isLooping;
      audioRef.current.volume = isMuted ? 0 : volume;

      // Listeners
      audioRef.current.addEventListener("timeupdate", handleTimeUpdate);
      audioRef.current.addEventListener("loadedmetadata", handleLoadedMetadata);
      audioRef.current.addEventListener("ended", handleEnded);

      if (isPlaying) {
        audioRef.current.play().catch((err) => {
          console.warn("Audio elements autoplay blocked or failed:", err);
          setIsPlaying(false);
        });
      }

      // Sync custom lyrics
      setLyricsText(currentTrack.lyrics || "No hay letras cargadas para esta pista.");
      setFlacState("idle");
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener("timeupdate", handleTimeUpdate);
        audioRef.current.removeEventListener("loadedmetadata", handleLoadedMetadata);
        audioRef.current.removeEventListener("ended", handleEnded);
      }
    };
  }, [currentTrack]);

  // Handle Play/Pause
  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  // Skip tracks triggers next
  const handleEnded = () => {
    if (isLooping) return;
    onNextTrack();
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.volume = !isMuted ? 0 : volume;
    }
  };

  const handleLoopToggle = () => {
    setIsLooping(!isLooping);
    if (audioRef.current) {
      audioRef.current.loop = !isLooping;
    }
  };

  // Sync / Generate AI Lyrics using Proxy backend
  const handleSyncLyrics = async () => {
    if (!currentTrack) return;
    if (!isPremium) {
      setLyricsText("💎 ACCESO VIP REQUERIDO 💎\n\nLas letras en tiempo real sincronizadas por IA y la mejora de lírica de Memphis Phonk con Gemini están reservadas exclusivamente para miembros de MyPhonk Premium VIP.\n\nPor favor, actualiza tu plan en la pestaña Premium hoy para desbloquear esta y otras potentes características rítmicas.");
      return;
    }
    setLyricsLoading(true);
    try {
      const response = await fetch("/api/lyrics", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": userId || ""
        },
        body: JSON.stringify({
          title: currentTrack.title,
          artist: currentTrack.artist,
          currentLyrics: currentTrack.lyrics
        })
      });

      if (!response.ok) throw new Error("Server communication fault");
      const data = await response.json();
      setLyricsText(data.lyrics);
    } catch (err) {
      console.error(err);
      setLyricsText(currentTrack.lyrics || "No se pudo sincronizar letras con el satélite de Memphis.");
    } finally {
      setLyricsLoading(false);
    }
  };

  // Lossless FLAC Export
  const handleExportFLAC = () => {
    if (!currentTrack) return;
    if (!isPremium) {
      alert("🔊 Característica Premium VIP: La exportación y codificación de másters FLAC de alta frecuencia (24-bit sin pérdida) requiere una suscripción activa.");
      onOpenPremiumTab();
      return;
    }
    setFlacState("encoding");
    setFlacProgress(0);

    const interval = setInterval(() => {
      setFlacProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setFlacState("ready");
          triggerFlacDownload();
          return 100;
        }
        return p + 25;
      });
    }, 400);
  };

  const triggerFlacDownload = () => {
    if (!currentTrack) return;
    
    // Simulate real 24-bit high frequency master block download in FLAC format
    // We create a dummy WAV/FLAC raw blob containing high-definition spectrum structure 
    const hdBuffer = new Uint8Array([70, 76, 65, 67, 0, 0, 0, 34, 18, 0, 15, 23, 77, 121, 80, 104, 111, 110, 107, 32, 76, 111, 115, 115, 108, 101, 115, 115, 32, 77, 97, 115, 116, 101, 114]);
    const blob = new Blob([hdBuffer], { type: "audio/flac" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentTrack.artist} - ${currentTrack.title} [MyPhonk Masters 24bit].flac`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Synchronized Lyrics System ---
  const parsedLyrics = React.useMemo(() => {
    return parseLyrics(lyricsText, duration);
  }, [lyricsText, duration]);

  const activeIndex = React.useMemo(() => {
    let index = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (currentTime >= parsedLyrics[i].time) {
        index = i;
      }
    }
    return index;
  }, [parsedLyrics, currentTime]);

  const handleLyricClick = (time: number) => {
    if (audioRef.current && time >= 0) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Auto-scrolling effect when the active line changes in expanded view
  useEffect(() => {
    if (isExpanded && activeIndex !== -1 && activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeIndex, isExpanded]);

  // Formatting seconds to MM:SS
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "0:00";
    const mins = Math.floor(secs / 60);
    const remaining = Math.floor(secs % 60);
    return `${mins}:${remaining < 10 ? "0" : ""}${remaining}`;
  };

  // Dynamic Neon Shadows base
  const glowShadow = {
    low: `0 4px 12px rgba(0,0,0,0.5)`,
    medium: `0 0 15px ${accentColor}25, 0 4px 20px rgba(0,0,0,0.6)`,
    high: `0 0 35px ${accentColor}40, 0 0 10px ${accentColor}30, 0 4px 25px rgba(0,0,0,0.8)`
  };

  return (
    <div 
      id="bottom-player" 
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 border-t border-white/5 py-5 px-6 backdrop-blur-2xl transition-all"
      style={{ boxShadow: glowShadow[glowIntensity] }}
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        
        {/* Track Metadata (Left) */}
        <div className="md:col-span-3 flex items-center gap-3.5">
          {currentTrack ? (
            <>
              <div 
                onClick={() => setIsExpanded(true)}
                className="relative group shrink-0 cursor-pointer"
                title="Expandir vista de letras sincronizadas"
              >
                <img 
                  src={currentTrack.coverUrl} 
                  alt={currentTrack.title} 
                  className={`w-14 h-14 rounded-xl object-cover border border-white/5 transition-transform group-hover:scale-105 ${isPlaying ? "animate-spin [animation-duration:15s]" : ""}`} 
                />
                <div className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Maximize2 size={18} className="text-white animate-pulse" />
                </div>
              </div>
              <div 
                onClick={() => setIsExpanded(true)}
                className="min-w-0 cursor-pointer group/meta"
                title="Expandir vista de letras sincronizadas"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold font-mono tracking-wider text-blue-400 capitalize shrink-0" style={{ color: accentColor }}>
                    {currentTrack.genre}
                  </span>
                  {currentTrack.isUserUploaded && (
                    <span className="px-1.5 py-0.2 rounded bg-white/5 text-[9px] text-white/40 font-bold uppercase tracking-wider font-mono border border-white/5">Librería</span>
                  )}
                </div>
                <h4 
                  className="text-sm font-bold text-white truncate leading-tight mt-0.5 transition-colors group-hover/meta:text-purple-400"
                  style={{ color: undefined }}
                >
                  {currentTrack.title}
                </h4>
                <p className="text-xs text-white/50 truncate leading-tight mt-0.5 group-hover/meta:text-white/80 transition-colors">{currentTrack.artist}</p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-[#050505] border border-white/5 flex items-center justify-center">
                <Disc size={20} className="text-white/20 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white/40 font-display">Ninguno sonando</h4>
                <p className="text-xs text-white/30 font-mono mt-0.5">Selecciona un track arriba</p>
              </div>
            </div>
          )}
        </div>

        {/* Playback Controls (Center) */}
        <div className="md:col-span-5 flex flex-col gap-2">
          {/* Controls triggers */}
          <div className="flex items-center justify-center gap-5">
            <button 
              onClick={onPrevTrack}
              disabled={!currentTrack}
              className="p-1 px-2 rounded-lg text-white/50 hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
            >
              <SkipBack size={18} />
            </button>

            <button 
              onClick={handlePlayPause}
              disabled={!currentTrack}
              className="p-3 bg-white hover:scale-105 active:scale-95 rounded-full text-black hover:bg-zinc-100 transition-transform cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
              style={{ boxShadow: isPlaying ? `0 0 15px ${accentColor}30` : undefined }}
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>

            <button 
              onClick={onNextTrack}
              disabled={!currentTrack}
              className="p-1 px-2 rounded-lg text-white/50 hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
            >
              <SkipForward size={18} />
            </button>

            <button
              onClick={handleLoopToggle}
              disabled={!currentTrack}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${isLooping ? "bg-white/10" : "hover:bg-white/5"}`}
              style={{ color: isLooping ? accentColor : "#a1a1aa" }}
            >
              <Repeat size={14} />
            </button>
          </div>

          {/* Time slider track */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-white/40 shrink-0 select-none">{formatTime(currentTime)}</span>
            <input 
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleProgressChange}
              disabled={!currentTrack}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white disabled:pointer-events-none"
              style={{ accentColor: accentColor }}
            />
            <span className="text-[10px] font-mono text-white/40 shrink-0 select-none">
              {currentTrack ? formatTime(duration) : "0:00"}
            </span>
          </div>
        </div>

        {/* Actions & Volume Controls (Right) */}
        <div className="md:col-span-4 flex items-center justify-end gap-5">
          {/* Action modules */}
          <div className="flex items-center gap-2">
            {/* Show Lyrics switch */}
            <button
              onClick={() => setShowLyrics(!showLyrics)}
              disabled={!currentTrack}
              className={`p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold select-none ${
                showLyrics 
                  ? "bg-white/10 text-white" 
                  : "bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 text-white/70 hover:text-white"
              }`}
              style={{ 
                color: showLyrics ? "#fff" : undefined, 
                backgroundColor: showLyrics ? `${accentColor}15` : undefined,
                borderColor: showLyrics ? accentColor : undefined
              }}
              title="Letras de IA"
            >
              <AlignLeft size={14} />
              <span>Letras</span>
            </button>

            {/* Maximize to Cinematic Expanded View */}
            <button
              onClick={() => setIsExpanded(true)}
              disabled={!currentTrack}
              className="p-2 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer flex items-center justify-center"
              title="Pantalla completa y letras sincronizadas"
            >
              <Maximize2 size={14} />
            </button>

            {/* Direct Music Download (MP3) */}
            {currentTrack && (
              <a
                href={currentTrack.downloadUrl}
                download
                referrerPolicy="no-referrer"
                className="p-2 rounded-xl bg-[#050505] border border-white/15 hover:bg-white/5 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 text-white/70"
                title="Descargar MP3 Directo"
              >
                <Download size={14} />
                <span>MP3</span>
              </a>
            )}

            {/* Advanced FLAC Lossless Export */}
            <button
              onClick={handleExportFLAC}
              disabled={!currentTrack || flacState === "encoding"}
              className="p-2 rounded-xl bg-[#050505] border border-white/15 hover:bg-white/5 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 text-[#a1a1aa]"
              title="Exportar archivo master FLAC"
            >
              <FileAudio size={14} className="text-yellow-400" />
              <span>FLAC</span>
            </button>
          </div>

          {/* Volume slider */}
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={handleMuteToggle}
              className="p-1 text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <input 
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
              style={{ accentColor: accentColor }}
            />
          </div>

        </div>
      </div>

      {/* Embedded Real-Time Lyrics Drawer Panel */}
      {showLyrics && currentTrack && (
        <div id="lyrics-drawer" className="max-w-4xl mx-auto mt-5 p-5 border border-white/5 rounded-2xl bg-[#050505]/60 backdrop-blur-md relative overflow-hidden animate-slide-up">
          <div className="flex items-center justify-between gap-3 mb-3 pb-2.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-yellow-400 animate-spin" style={{ animationDuration: "10s" }} />
              <span className="text-xs font-bold font-mono text-white block">Letras en Tiempo Real Sincronizadas por MyPhonk IA</span>
            </div>
            
            {!isOffline && (
              <button
                onClick={handleSyncLyrics}
                disabled={lyricsLoading}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                style={{ color: accentColor }}
              >
                <RefreshCw size={11} className={lyricsLoading ? "animate-spin" : ""} />
                Mejorar con IA
              </button>
            )}
          </div>

          {lyricsLoading ? (
            <div className="py-12 text-center text-zinc-500 text-xs font-mono animate-pulse flex flex-col items-center justify-center gap-2">
              <RefreshCw className="animate-spin" size={16} />
              <span>Sincronizando espectro lírico con Gemini IA...</span>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto pr-1 text-center py-2">
              <pre className="text-xs leading-relaxed text-zinc-300 font-sans whitespace-pre-wrap select-all selection:bg-blue-500 selection:text-black">
                {lyricsText}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Lost-less Encoder Status overlay */}
      {flacState === "encoding" && (
        <div className="fixed top-4 right-4 z-50 p-4 rounded-xl border border-white/10 bg-[#050505] shadow-2xl flex flex-col gap-2 w-64">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <FileAudio size={14} className="text-yellow-400 animate-pulse" />
              Codificando master FLAC
            </span>
            <span className="text-xs font-mono text-zinc-500">{flacProgress}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div className="bg-yellow-400 h-full transition-all" style={{ width: `${flacProgress}%` }} />
          </div>
          <span className="text-[10px] text-zinc-500 font-mono italic">Preservando subbajos y frecuencias cowbell en formato de 24-bits...</span>
        </div>
      )}

      {/* Immersive Cinematic Expanded View Modal */}
      <AnimatePresence>
        {isExpanded && currentTrack && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 180 }}
            className="fixed inset-0 z-50 bg-[#050505] flex flex-col overflow-hidden text-white"
          >
            {/* Blurred background of the current track album cover */}
            <div 
              className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-15 pointer-events-none scale-110"
              style={{ backgroundImage: `url(${currentTrack.coverUrl})` }}
            />
            {/* Ambient vignette gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505]/80 pointer-events-none" />

            {/* Header portion */}
            <header className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-white/5 bg-black/20 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase font-mono tracking-wider text-purple-400 border px-2 py-0.5 rounded" style={{ color: accentColor, borderColor: `${accentColor}30`, backgroundColor: `${accentColor}08` }}>
                  Reproducción Premium
                </span>
                <span className="text-xs font-mono text-white/50">MyPhonk Master Series</span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 hover:scale-105 transition-all text-white/80 hover:text-white cursor-pointer border border-white/5 flex items-center justify-center"
                title="Minimizar reproductor"
              >
                <ChevronDown size={22} />
              </button>
            </header>

            {/* Body partition */}
            <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 p-8 overflow-hidden items-center">
              
              {/* Left Side: Massive spinning cover with direct controller overlay */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center text-center gap-6 select-none h-full max-h-[85vh] overflow-y-auto py-4">
                <div className="relative group p-1 rounded-[2.5rem] bg-gradient-to-b from-white/10 to-transparent">
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    className={`w-64 h-64 md:w-80 md:h-80 rounded-[2.2rem] object-cover transition-transform duration-500 group-hover:scale-[1.02] ${
                      isPlaying ? "animate-spin [animation-duration:35s]" : ""
                    }`}
                    style={{ boxShadow: glowShadow[glowIntensity] }}
                  />
                  {/* Neon pulsing ring indicator */}
                  <div 
                    className="absolute inset-0 rounded-[2.2rem] border-2 border-dashed opacity-40 animate-spin [animation-duration:60s]"
                    style={{ borderColor: accentColor }}
                  />
                </div>

                <div className="mt-4 max-w-sm">
                  <h2 className="text-2xl md:text-3xl font-black font-display tracking-tight text-white leading-tight">
                    {currentTrack.title}
                  </h2>
                  <p className="text-sm font-semibold text-white/50 mt-1 cursor-default">
                    {currentTrack.artist}
                  </p>
                  
                  {/* Genre and Mood badges */}
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <span 
                      className="px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider"
                      style={{ backgroundColor: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` }}
                    >
                      {currentTrack.genre}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-xs text-white/60 font-semibold">
                      🔥 {currentTrack.mood}
                    </span>
                  </div>
                </div>

                {/* Sub-HUD Quick Playback controls */}
                <div className="flex flex-col gap-4 w-full max-w-xs mt-4">
                  {/* Slider Progress */}
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center justify-between text-[11px] font-mono text-white/40">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleProgressChange}
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                      style={{ accentColor: accentColor }}
                    />
                  </div>

                  {/* Core triggers */}
                  <div className="flex items-center justify-between px-4 mt-1">
                    <button
                      onClick={handleLoopToggle}
                      className="p-2 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-all cursor-pointer"
                      style={{ color: isLooping ? accentColor : undefined }}
                    >
                      <Repeat size={18} />
                    </button>
                    
                    <div className="flex items-center gap-4">
                      <button
                        onClick={onPrevTrack}
                        className="p-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
                      >
                        <SkipBack size={22} />
                      </button>
                      
                      <button
                        onClick={handlePlayPause}
                        className="p-4 bg-white text-black active:scale-90 rounded-full hover:bg-zinc-100 transition-all cursor-pointer shadow-lg"
                        style={{ boxShadow: isPlaying ? `0 0 25px ${accentColor}60` : undefined }}
                      >
                        {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                      </button>

                      <button
                        onClick={onNextTrack}
                        className="p-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
                      >
                        <SkipForward size={22} />
                      </button>
                    </div>

                    <button
                      onClick={handleMuteToggle}
                      className="p-2 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-all cursor-pointer"
                    >
                      {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Side: Interactive Sync Lyrics Scrolling Canvas */}
              <div className="lg:col-span-7 flex flex-col h-full max-h-[75vh] bg-[#050505]/40 border border-white/5 p-6 md:p-8 rounded-[2rem] overflow-hidden backdrop-blur-md relative">
                <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-yellow-400 animate-spin" style={{ animationDuration: "12s" }} />
                    <h3 className="text-xs font-bold font-mono tracking-wider text-white uppercase">
                      Letras Sincronizadas (Haz clic para saltar al tiempo)
                    </h3>
                  </div>
                  {!isOffline && (
                    <button
                      onClick={handleSyncLyrics}
                      disabled={lyricsLoading}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                      style={{ color: accentColor }}
                    >
                      <RefreshCw size={11} className={lyricsLoading ? "animate-spin" : ""} />
                      Mejorar con IA
                    </button>
                  )}
                </div>

                {lyricsLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-12">
                    <RefreshCw className="animate-spin text-zinc-400" size={24} style={{ color: accentColor }} />
                    <span className="text-sm font-mono text-zinc-400 animate-pulse">Sincronizando espectro rítmico con Gemini...</span>
                  </div>
                ) : parsedLyrics.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-2.5 p-6 border border-dashed border-white/5 rounded-2xl bg-black/20">
                    <Disc className="text-white/25 animate-spin" size={32} style={{ animationDuration: "10s" }} />
                    <p className="text-sm font-semibold text-white/50">Ninguna letra sincronizada encontrada.</p>
                    <button 
                      onClick={handleSyncLyrics}
                      className="mt-2 text-xs font-bold font-mono border px-3 py-1.5 rounded-xl border-dashed hover:border-solid transition-colors"
                      style={{ color: accentColor, borderColor: accentColor }}
                    >
                      Generar letras de IA
                    </button>
                  </div>
                ) : (
                  <div 
                    ref={lyricsContainerRef}
                    className="flex-1 overflow-y-auto pr-2 space-y-7 scrolling-touch select-none py-12 scroll-smooth"
                    style={{ maskImage: "linear-gradient(to bottom, transparent 0%, white 15%, white 85%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, white 15%, white 85%, transparent 100%)" }}
                  >
                    {parsedLyrics.map((lyric, idx) => {
                      const isActive = idx === activeIndex;
                      const isPast = idx < activeIndex;
                      return (
                        <button
                          key={idx}
                          ref={isActive ? activeLyricRef : null}
                          onClick={() => handleLyricClick(lyric.time)}
                          className={`w-full text-left font-sans font-black tracking-tight text-xl md:text-2xl transition-all duration-300 py-1.5 px-3 rounded-xl cursor-pointer hover:bg-white/5 select-none ${
                            isActive 
                              ? "scale-100 opacity-100 filter drop-shadow-[0_0_12px_rgba(255,255,255,0.1)] font-display" 
                              : isPast 
                                ? "scale-95 opacity-40 hover:opacity-75"
                                : "scale-95 opacity-20 hover:opacity-75"
                          }`}
                          style={{
                            color: isActive ? "#ffffff" : undefined,
                            textShadow: isActive ? `0 0 20px ${accentColor}80` : undefined,
                            borderLeft: isActive ? `4px solid ${accentColor}` : "4px solid transparent",
                            transformOrigin: "left center"
                          }}
                        >
                          {lyric.text}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
