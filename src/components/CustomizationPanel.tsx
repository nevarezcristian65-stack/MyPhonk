import { Palette, WifiOff, CloudLightning, ShieldAlert, CheckCircle } from "lucide-react";
import { UserLibrary } from "../types";

interface CustomizationPanelProps {
  library: UserLibrary;
  onChangeLibrary: (updated: UserLibrary) => void;
  isOffline: boolean;
  onToggleOffline: () => void;
  accentColor: string;
}

const COLORS = [
  { name: "Laser Blue", value: "#3b82f6" },
  { name: "Neon Purple", value: "#8B5CF6" },
  { name: "Laser Cyan", value: "#00f0ff" },
  { name: "Hot Pink", value: "#EC4899" },
  { name: "Toxic Green", value: "#39FF14" }
];

export default function CustomizationPanel({
  library,
  onChangeLibrary,
  isOffline,
  onToggleOffline,
  accentColor
}: CustomizationPanelProps) {

  const handleColorChange = (val: string) => {
    onChangeLibrary({
      ...library,
      accentColor: val
    });
  };

  const handleGlowChange = (intensity: "low" | "medium" | "high") => {
    onChangeLibrary({
      ...library,
      glowIntensity: intensity
    });
  };

  return (
    <div id="customization-panel" className="rounded-2xl bg-[#0a0a0a] border border-white/5 p-6 flex flex-col gap-6">
      {/* Visual Header */}
      <div className="flex items-center gap-2.5">
        <Palette size={20} className="text-zinc-400" style={{ color: accentColor }} />
        <h3 className="text-md uppercase tracking-[0.2em] font-display text-white">Consola de Estilo</h3>
      </div>

      {/* Colors Section */}
      <div>
        <span className="block text-xs font-semibold text-white/40 mb-2.5 uppercase font-mono tracking-wider">Acento de Color</span>
        <div className="flex flex-wrap gap-2.5">
          {COLORS.map((col) => (
            <button
              key={col.value}
              onClick={() => handleColorChange(col.value)}
              className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all cursor-pointer ${
                library.accentColor === col.value 
                  ? "scale-110 border-white" 
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: col.value }}
              title={col.name}
            >
              {library.accentColor === col.value && (
                <div className="w-2.5 h-2.5 bg-black rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Glow Intensity Section */}
      <div>
        <span className="block text-xs font-semibold text-white/40 mb-2.5 uppercase font-mono tracking-wider">Densidad del Brillo</span>
        <div className="grid grid-cols-3 gap-2">
          {["low", "medium", "high"].map((glow) => (
            <button
              key={glow}
              onClick={() => handleGlowChange(glow as any)}
              className={`py-1.5 rounded-lg border text-xs font-semibold capitalize font-mono transition-all cursor-pointer ${
                library.glowIntensity === glow
                  ? "border-white text-white"
                  : "border-white/5 bg-[#050505] text-white/50 hover:text-white"
              }`}
              style={{
                borderColor: library.glowIntensity === glow ? accentColor : undefined,
                color: library.glowIntensity === glow ? "#fff" : undefined,
                backgroundColor: library.glowIntensity === glow ? `${accentColor}15` : undefined
              }}
            >
              {glow === "low" ? "Bajo" : glow === "medium" ? "Medio" : "Extremo 🔥"}
            </button>
          ))}
        </div>
      </div>

      {/* Connectivity & Offline settings */}
      <div className="border-t border-white/5 pt-4 space-y-4">
        <span className="block text-xs font-semibold text-white/40 mb-1 uppercase font-mono tracking-wider">Estado de Conectividad</span>
        
        {/* Offline Switch */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#050505] border border-white/5">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-white/80">Soporte Offline</span>
            <span className="text-[11px] text-white/40">Solo pistas sincronizadas</span>
          </div>
          <button
            onClick={onToggleOffline}
            className={`w-12 h-6 rounded-full p-0.5 transition-all outline-none cursor-pointer ${
              isOffline ? "bg-red-500 text-white" : "bg-white/10"
            }`}
          >
            <div 
              className={`w-5 h-5 bg-white rounded-full transition-transform ${
                isOffline ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Sync Status Info */}
        <div className="p-3.5 rounded-xl bg-[#050505] border border-white/5 flex flex-col gap-2.5">
          <div className="flex items-start gap-2.5">
            {isOffline ? (
              <WifiOff size={16} className="text-red-400 mt-0.5 shrink-0" />
            ) : (
              <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
            )}
            <div>
              <span className="text-xs font-bold text-white block">
                {isOffline ? "Sesión Desconectada" : "Sincronizado con la Nube"}
              </span>
              <span className="text-[11px] text-white/40 block leading-tight mt-0.5">
                {isOffline 
                  ? "Las solicitudes a la API de letras e historial están pausadas temporalmente."
                  : "Tu librería se sincroniza de manera segura con MyPhonk Cloud."
                }
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono mt-1">
            <CloudLightning size={12} className="text-blue-400" style={{ color: accentColor }} />
            <span>ID de Sesión: SANDBOX-A382</span>
          </div>
        </div>
      </div>
    </div>
  );
}
