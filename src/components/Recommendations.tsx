import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, AudioLines, Flame, Heart, Lock, Star } from "lucide-react";
import { Track } from "../types";

interface RecommendationsProps {
  favorites: Track[];
  currentMood: string;
  onPlayRecommendation: (suggested: { title: string; artist: string; genre: string }) => void;
  accentColor: string;
  isOffline: boolean;
  isPremium: boolean;
  userId: string | null | undefined;
  onOpenPremiumTab: () => void;
}

interface RecommendedItem {
  title: string;
  artist: string;
  genre: string;
  mood: string;
  reason: string;
}

export default function Recommendations({
  favorites,
  currentMood,
  onPlayRecommendation,
  accentColor,
  isOffline,
  isPremium,
  userId,
  onOpenPremiumTab
}: RecommendationsProps) {
  const [recommendations, setRecommendations] = useState<RecommendedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);

  const steps = [
    "Escaneando cowbells y subbajos de 808...",
    "Analizando tus hábitos de derrape rítmico...",
    "Solicitando espectro cuántico a los servidores de Memphis...",
    "Inyectando distorsión analógica en el plano de IA..."
  ];

  // Rotate loading steps
  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % steps.length);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const fetchRecommendations = async () => {
    if (!isPremium) {
      setError("Suscripción activa requerida.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId || ""
        },
        body: JSON.stringify({
          favorites: favorites.map(f => ({ title: f.title, artist: f.artist, genre: f.genre })),
          mood: currentMood
        })
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Acceso Premium requerido en el servidor.");
        }
        throw new Error("La solicitud al servidor falló.");
      }

      const data = await response.json();
      if (data.recommendations) {
        setRecommendations(data.recommendations);
      } else {
        throw new Error("Formato de respuesta desconocido.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No se pudieron cargar recomendaciones por IA. Mostrando mapa offline.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPremium) {
      fetchRecommendations();
    } else {
      setRecommendations([
        {
          title: "Tokyo Grave Drift VIP",
          artist: "Carbon Cowbell Boss",
          genre: "Drift Phonk",
          mood: "Agressivo",
          reason: "Suscripción activa requerida para generar mapas de música."
        },
        {
          title: "Memphis Crypt Drift",
          artist: "Slayer 808",
          genre: "Memphis Phonk",
          mood: "Oscuro",
          reason: "Análisis rítmico de Gemini para aficionados y audiófilos."
        },
        {
          title: "Four-Wheel Slide",
          artist: "Glow Plate",
          genre: "Wave Phonk",
          mood: "Cósmico",
          reason: "Algoritmos avanzados con IA."
        }
      ]);
    }
  }, [favorites.length, currentMood, isPremium, userId]);

  return (
    <div id="ai-recommendations" className="rounded-2xl bg-[#0a0a0a] border border-white/5 p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: `${accentColor}03` }} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-blue-400 shrink-0 animate-pulse" style={{ color: accentColor }} />
            <h3 className="text-lg font-bold font-display text-white">Recomendador Smart MyPhonk por IA</h3>
          </div>
          <p className="text-xs text-white/50 mt-1">Sugerencias personalizadas basadas en tus ritmos, cowbells y estados de ánimo de reproducción.</p>
        </div>

        <button
          onClick={fetchRecommendations}
          disabled={loading || !isPremium}
          className="flex items-center gap-2 self-start md:self-auto px-4 py-2 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-zinc-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refrescar con IA
        </button>
      </div>

      <div className="relative">
        {/* Beautiful Blurred Lock Screen for Premium Active Protection */}
        {!isPremium && (
          <div className="absolute inset-0 -m-3 backdrop-blur-[6px] bg-black/60 rounded-2xl z-20 flex flex-col items-center justify-center p-6 text-center animate-fade-in border border-purple-500/10" style={{ borderColor: `${accentColor}20` }}>
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20 mb-3 animate-pulse" style={{ color: accentColor, borderColor: `${accentColor}30`, backgroundColor: `${accentColor}10` }}>
              <Lock size={18} />
            </div>
            <h4 className="text-sm font-bold font-display text-white uppercase tracking-wider">HERRAMIENTA PREMIUM VIP REQUERIDA</h4>
            <p className="text-xs text-zinc-400 max-w-md mt-2 leading-relaxed">
              El recomendador rítmico automático de Gemini utiliza modelos inteligentes que analizan tus temas favoritos en tiempo real. ¡Actualiza tu plan en la pestaña Premium hoy mismo!
            </p>
            <button
              onClick={onOpenPremiumTab}
              className="mt-4 px-5 py-2 rounded-xl text-xs font-bold text-black bg-yellow-400 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 shadow-lg shadow-purple-500/10 cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              <Star size={12} fill="currentColor" />
              <span>Ver Planes Premium VIP</span>
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-4 border border-dashed border-white/5 rounded-xl bg-[#050505]/40">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-t-2 border-b-2 border-blue-500 animate-spin" style={{ borderTopColor: accentColor, borderBottomColor: accentColor }} />
              <AudioLines size={18} className="absolute inset-0 m-auto text-zinc-400 animate-pulse" />
            </div>
            <p className="text-sm font-semibold font-mono text-zinc-300 text-center animate-pulse px-4 max-w-sm">
              {steps[loadingStep]}
            </p>
          </div>
        ) : error && isPremium ? (
          <div className="p-4 rounded-xl border border-red-500/25 bg-red-500/5 text-center flex flex-col items-center gap-2">
            <p className="text-sm text-red-400">{error}</p>
            <button 
              onClick={fetchRecommendations} 
              className="text-xs font-semibold underline text-blue-400 hover:text-white uppercase tracking-wider font-mono cursor-pointer"
              style={{ color: accentColor }}
            >
              Reintentar Conexión
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendations.slice(0, 3).map((item, index) => (
              <div
                key={index}
                className="group relative flex flex-col justify-between rounded-xl p-5 bg-[#050505]/40 hover:bg-[#050505] border border-white/5 hover:border-white/10 transition-all hover:scale-[1.02]"
              >
                <div>
                  {/* Meta subgenre banner */}
                  <div className="flex items-center justify-between mb-3.5">
                    <span className="px-2 py-0.5 rounded-md bg-white/5 text-white/50 text-[10px] font-bold uppercase font-mono border border-white/5">
                      {item.genre}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-white/40 font-mono">
                      <Flame size={12} className="text-orange-500" />
                      <span>{item.mood}</span>
                    </div>
                  </div>

                  <h4 className="text-md font-bold text-white truncate group-hover:text-blue-400 transition-colors" style={{ groupHover: { color: accentColor } }}>
                    {item.title}
                  </h4>
                  <p className="text-xs text-white/50 mt-0.5">{item.artist}</p>

                  <p className="text-xs text-white/60 mt-3 leading-relaxed bg-[#0a0a0a] p-2.5 rounded-lg border border-white/5 font-sans italic">
                    "{item.reason}"
                  </p>
                </div>

                <div className="mt-5 pt-3.5 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-semibold font-mono text-white/40 uppercase tracking-widest flex items-center gap-1">
                    <Sparkles size={10} style={{ color: accentColor }} /> IA Match
                  </span>
                  <button
                    onClick={() => isPremium && onPlayRecommendation(item)}
                    disabled={!isPremium}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-black cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                    style={{ backgroundColor: accentColor }}
                  >
                    <AudioLines size={12} />
                    Sintonizar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
