import React, { useState, useRef } from "react";
import { Upload, X, Music, AlertCircle, Sparkles } from "lucide-react";
import { Track } from "../types";

interface UploadModalProps {
  onClose: () => void;
  onUpload: (newTrack: Track) => void;
  accentColor: string;
}

export default function UploadModal({ onClose, onUpload, accentColor }: UploadModalProps) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("Drift Phonk");
  const [mood, setMood] = useState("Agressivo");
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (uploadedFile: File) => {
    setError("");
    if (!uploadedFile.type.startsWith("audio/")) {
      setError("Por favor, sube un archivo de audio válido (.mp3, .wav, .m4a).");
      return;
    }
    // Limit to 30MB for comfort
    if (uploadedFile.size > 30 * 1024 * 1024) {
      setError("El archivo supera el límite de 30 MB.");
      return;
    }
    setFile(uploadedFile);
    // Auto populate title if empty
    if (!title) {
      const nameWithoutExtension = uploadedFile.name.replace(/\.[^/.]+$/, "");
      setTitle(nameWithoutExtension);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) {
      setError("Por favor ingresa un título y selecciona un archivo de audio.");
      return;
    }

    setLoading(true);
    try {
      // Load file into Audio object to get duration accurately
      const objectUrl = URL.createObjectURL(file);
      const audio = new Audio();
      audio.src = objectUrl;

      audio.onloadedmetadata = () => {
        const totalSecs = Math.round(audio.duration) || 180;
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        const durationStr = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

        // Create random aesthetic neon background as cover if none provided
        const covers = [
          "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&auto=format&fit=crop&q=80"
        ];
        const randomCover = covers[Math.floor(Math.random() * covers.length)];

        const newTrack: Track = {
          id: `custom-${Date.now()}`,
          title,
          artist: artist || "Artista Independiente",
          duration: durationStr,
          durationSeconds: totalSecs,
          url: objectUrl,
          coverUrl: randomCover,
          genre,
          mood,
          downloadUrl: objectUrl,
          flacDownloadUrl: objectUrl, // triggers a lossless WAV download
          likesCount: 0,
          playsCount: 0,
          isUserUploaded: true,
          lyrics: `🎵 [Vocal subida por el usuario]\n[Track: ${title}]\n\nEstás escuchando tu propio sonido en alta definición.\nSincroniza y descarga este archivo en cualquier momento.`
        };

        onUpload(newTrack);
        setLoading(false);
        onClose();
      };

      audio.onerror = () => {
        setError("Error al procesar el archivo de audio. Podría estar corrupto o no soportado.");
        setLoading(false);
      };
    } catch (err) {
      console.error(err);
      setError("Error interno al subir el archivo.");
      setLoading(false);
    }
  };

  return (
    <div id="upload-modal-container" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div 
        id="upload-modal" 
        className="relative w-full max-w-lg rounded-2xl bg-[#0a0a0a] border border-white/5 p-6 md:p-8 shadow-2xl transition-all"
        style={{ boxShadow: `0 0 30px ${accentColor}10` }}
      >
        <button 
          id="close-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400" style={{ color: accentColor, backgroundColor: `${accentColor}10` }}>
            <Music size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display tracking-tight text-white">Subir tu propia Música</h2>
            <p className="text-xs text-white/50">Archivos agregados se guardarán localmente en MyPhonk.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Drag & Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`group relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all ${
              isDragActive 
                ? "border-blue-500 bg-blue-500/5" 
                : "border-white/5 bg-[#050505]/50 hover:border-white/10 hover:bg-[#050505]"
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept="audio/*" 
              className="hidden" 
              onChange={handleFileChange} 
            />
            <div className="mb-3 p-3 rounded-full bg-white/5 group-hover:scale-105 transition-transform border border-white/5">
              <Upload size={24} className="text-zinc-400 group-hover:text-white transition-colors" />
            </div>

            {file ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-blue-400 text-center truncate max-w-xs" style={{ color: accentColor }}>
                  {file.name}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB • Haz clic para cambiar
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm font-medium text-white/70">Suelte el track aquí o navegue</p>
                <p className="text-xs text-white/40 mt-1">Soporta MP3, WAV, FLAC hasta 30MB</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase font-mono">Título del Track</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Purple Cowbell Drop"
                required
                className="w-full rounded-xl bg-[#050505] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                style={{ focusRingColor: accentColor }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase font-mono">Artista / Productor</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Ej. DJ Phonk"
                className="w-full rounded-xl bg-[#050505] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                style={{ focusRingColor: accentColor }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase font-mono">Subgénero</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full rounded-xl bg-[#050505] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
              >
                <option value="Drift Phonk">Drift Phonk</option>
                <option value="Memphis Trap">Memphis Trap</option>
                <option value="Phonk House">Phonk House</option>
                <option value="Wave Phonk">Wave Phonk</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase font-mono">Estado de Ánimo</label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="w-full rounded-xl bg-[#050505] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
              >
                <option value="Agressivo">Agressivo</option>
                <option value="Oscuro">Oscuro</option>
                <option value="Cósmico">Cósmico</option>
                <option value="Chill">Chill</option>
                <option value="Hype">Hype</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-[#050505] text-sm font-medium transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-black font-semibold text-sm cursor-pointer transition-all hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              <Sparkles size={16} />
              {loading ? "Procesando..." : "Sellar en Librería"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
