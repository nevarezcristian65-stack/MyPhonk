import React, { useState, useEffect } from "react";
import { 
  Shield, CheckCircle, Sparkles, RefreshCw, 
  ArrowUpRight, HelpCircle, Star, Check, X, AlertTriangle 
} from "lucide-react";

interface PremiumPageProps {
  user: any;
  subscription: {
    status: string;
    plan: string;
    currentPeriodEnd: string;
    subscriptionId?: string;
  } | null;
  onSignIn: () => void;
  accentColor: string;
}

export default function PremiumPage({
  user,
  subscription,
  onSignIn,
  accentColor
}: PremiumPageProps) {
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const isPremiumActive = subscription?.status === "active" || subscription?.status === "trialing";

  // Check query params for success/cancel responses on payment redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment_success") === "true") {
      setSuccessMsg("🎉 ¡Felicidades! Tu cuenta MyPhonk se ha actualizado a PREMIUM VIP de forma segura.");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get("payment_canceled") === "true") {
      setError("❌ El flujo de pago con Stripe fue cancelado.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Trigger real Stripe checkout payment redirect
  const handleSubscribeClick = async (tier: "pro" | "institucion", type: "monthly" | "yearly") => {
    if (!user) {
      onSignIn();
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: user.uid,
          email: user.email,
          plan: type === "yearly" ? "yearly" : "monthly"
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al procesar el checkout con Stripe.");
      }

      if (data.url) {
        // Redirect to Stripe's real checkout page hosted securely
        window.location.href = data.url;
      } else {
        throw new Error("No se pudo obtener la URL de sesión de Stripe.");
      }
    } catch (err: any) {
      console.error("Stripe Checkout Error:", err);
      setError(err?.message || "No se pudo conectar con el sistema de pagos de Stripe en producción.");
    } finally {
      setLoading(false);
    }
  };

  // Redirect to Customer Billing Portal
  const handlePortalRedirect = async () => {
    if (!user) return;

    setPortalLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const response = await fetch("/api/create-portal-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: user.uid
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo abrir el portal de facturación en este momento.");
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No se pudo obtener la URL de Portal de Stripe.");
      }
    } catch (err: any) {
      console.error("Stripe Portal Error:", err);
      setError(err?.message || "Imposible conectar con el panel de facturación de Stripe.");
    } finally {
      setPortalLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!subscription) {
      return (
        <span className="px-3 py-1 text-xs rounded-full bg-zinc-800 border border-white/5 text-zinc-400 font-mono flex items-center gap-1.5 font-bold">
          🌱 PLAN SEMILLA (GUEST / GRATUITO)
        </span>
      );
    }

    const currentPlanStr = subscription.plan.toUpperCase();
    if (subscription.status === "trialing") {
      return (
        <span className="px-3 py-1 text-xs rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 font-mono font-bold flex items-center gap-1.5 animate-pulse">
          <Star size={12} fill="currentColor" />
          PRUEBA GRATUITA ({currentPlanStr})
        </span>
      );
    }

    if (subscription.status === "active") {
      return (
        <span className="px-3.5 py-1 text-xs rounded-full bg-green-500/10 border border-green-500/20 text-green-400 font-mono font-bold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
          VIP PREMIUM ACTIVO ({currentPlanStr})
        </span>
      );
    }

    return (
      <span className="px-3 py-1 text-xs rounded-full bg-red-400/10 border border-red-400/20 text-red-400 font-mono font-bold uppercase">
        ESTADO: {subscription.status}
      </span>
    );
  };

  return (
    <div id="premium-portal-panel" className="max-w-5xl mx-auto flex flex-col gap-10 animate-fade-in relative z-10 pb-16">
      
      {/* Top Header Billboard */}
      <div 
        className="rounded-[2rem] border border-white/5 p-8 md:p-14 text-center relative overflow-hidden"
        style={{ 
          background: `radial-gradient(circle at center, ${accentColor}10 0%, #050505 100%)`
        }}
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: `${accentColor}05` }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: `${accentColor}03` }} />

        <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center gap-5">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center bg-black/50 border border-white/10 mb-2 cursor-default"
            style={{ boxShadow: `0 0 35px ${accentColor}40`, borderColor: `${accentColor}30` }}
          >
            <Star size={28} className="text-yellow-400 animate-spin" style={{ color: accentColor, animationDuration: "12s" }} />
          </div>

          <h2 className="text-3xl md:text-5xl font-black font-display tracking-tight text-white leading-none">
            ELEGIR PLAN DE <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(to right, ${accentColor}, #22d3ee)` }}>MONETIZACIÓN</span>
          </h2>
          <p className="text-xs md:text-sm text-zinc-400 leading-relaxed max-w-2xl font-medium">
            Integra tu pasarela de cobros segura de Stripe para habilitar el motor premium de Phonk, exportador de master 24 bits FLAC y consulta de letras por Gemini Inteligencia Artificial de forma instantánea.
          </p>

          <div className="mt-2">
            {getStatusBadge()}
          </div>
        </div>
      </div>

      {/* Global Toast Prompts */}
      {successMsg && (
        <div className="rounded-2xl bg-green-500/10 border border-green-500/20 p-5 text-xs font-semibold text-green-400 flex items-center gap-3">
          <CheckCircle size={18} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-5 text-xs font-semibold text-red-400 flex items-center gap-3">
          <AlertTriangle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3 Scaled Tiers Selection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch font-sans">
        
        {/* Tier 1: Plan Semilla */}
        <div className="bg-[#080808] border border-white/5 rounded-[2rem] p-8 flex flex-col justify-between hover:border-white/10 transition-all relative">
          <div className="flex flex-col gap-6">
            <div>
              <span className="text-[10px] font-bold font-mono tracking-widest text-zinc-500 uppercase">EXPLORADOR INICIAL</span>
              <h3 className="text-2xl font-black font-display text-white mt-1">Plan Semilla</h3>
              <p className="text-xs text-zinc-500 mt-2">
                Para oyentes casuales que desean disfrutar los ritmos básicos de MyPhonk sin costo.
              </p>
            </div>

            <div className="py-2 border-y border-white/5 my-2">
              <span className="text-3xl font-black font-mono text-white">$0</span>
              <span className="text-xs text-zinc-500 ml-1">Gratis para siempre</span>
            </div>

            <ul className="space-y-4">
              <li className="flex items-start gap-2.5 text-xs text-zinc-400 font-medium">
                <Check size={14} className="text-green-500 mt-0.5 shrink-0" />
                <span>Escucha de todo el catálogo base local</span>
              </li>
              <li className="flex items-start gap-2.5 text-xs text-zinc-400 font-medium">
                <Check size={14} className="text-green-500 mt-0.5 shrink-0" />
                <span>Crea playlists ilimitadas</span>
              </li>
              <li className="flex items-start gap-2.5 text-xs text-zinc-400 font-medium">
                <Check size={14} className="text-green-500 mt-0.5 shrink-0" />
                <span>Personalización básica del reproductor</span>
              </li>
              <li className="flex items-start gap-2.5 text-xs text-zinc-500 font-medium">
                <X size={14} className="text-red-500/50 mt-0.5 shrink-0" />
                <span>Letras sincronizadas con Gemini IA para Phonk</span>
              </li>
              <li className="flex items-start gap-2.5 text-xs text-zinc-500 font-medium">
                <X size={14} className="text-red-500/50 mt-0.5 shrink-0" />
                <span>Formatos FLAC de Estudio de Ultra Alta Fidelidad</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4">
            <button
              disabled={true}
              className="w-full py-3.5 rounded-2xl bg-zinc-900 border border-white/5 text-zinc-500 text-xs font-bold uppercase tracking-wider"
            >
              Nivel Básico Actual
            </button>
          </div>
        </div>

        {/* Tier 2: Plan Pro (Most Popular) */}
        <div 
          className="bg-[#080808] border rounded-[2rem] p-8 flex flex-col justify-between hover:border-purple-500/50 transition-all relative"
          style={{ borderColor: `${accentColor}60`, boxShadow: `0 0 45px ${accentColor}10` }}
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-[9px] font-bold font-mono rounded text-black uppercase tracking-wider" style={{ backgroundColor: accentColor }}>
            RECOMENDADO • PRECIO JUSTO
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <span className="text-[10px] font-bold font-mono tracking-widest uppercase" style={{ color: accentColor }}>PRODUCTOR ACTIVO</span>
              <h3 className="text-2xl font-black font-display text-white mt-1 flex items-center gap-1.5">
                Plan Pro / Creador
              </h3>
              <p className="text-xs text-zinc-400 mt-2">
                Para el productor exigente que desea gozar de música pura en alta fidelidad con inteligencia artificial.
              </p>
            </div>

            <div className="py-2 border-y border-white/5 my-1 flex items-center justify-between">
              <div>
                <span className="text-3xl font-black font-mono text-white">$15</span>
                <span className="text-xs text-zinc-500 ml-1">/mes</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold font-mono text-zinc-300 block">$120 /año</span>
                <span className="text-[10px] text-zinc-500 block">($10 USD al mes)</span>
              </div>
            </div>

            <ul className="space-y-4">
              <li className="flex items-start gap-2.5 text-xs text-zinc-200 font-medium">
                <Check size={14} className="text-green-400 mt-0.5 shrink-0" />
                <span className="text-white font-semibold">Letras por Inteligencia Artificial (Gemini)</span>
              </li>
              <li className="flex items-start gap-2.5 text-xs text-zinc-300 font-medium">
                <Check size={14} className="text-green-400 mt-0.5 shrink-0" />
                <span className="text-white font-semibold">Descargar audio FLAC Premium original</span>
              </li>
              <li className="flex items-start gap-2.5 text-xs text-zinc-300 font-medium">
                <Check size={14} className="text-green-400 mt-0.5 shrink-0" />
                <span>Nube infinita para tus pistas cargadas</span>
              </li>
              <li className="flex items-start gap-2.5 text-xs text-zinc-300 font-medium">
                <Check size={14} className="text-green-400 mt-0.5 shrink-0" />
                <span>Personalización de Neon Premium</span>
              </li>
              <li className="flex items-start gap-2.5 text-xs text-zinc-300 font-medium">
                <Check size={14} className="text-green-400 mt-0.5 shrink-0" />
                <span>Recomendaciones personalizadas avanzadas con IA</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 flex flex-col gap-2.5">
            <button
              onClick={() => handleSubscribeClick("pro", "monthly")}
              disabled={loading || isPremiumActive}
              className="w-full py-3 h-11 flex items-center justify-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
            >
              Pagar Pro Mensual ($15/mes)
            </button>
            <button
              onClick={() => handleSubscribeClick("pro", "yearly")}
              disabled={loading || isPremiumActive}
              className="w-full py-3.5 h-12 flex items-center justify-center gap-1.5 rounded-xl font-black text-xs text-black transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-40"
              style={{ backgroundColor: accentColor, boxShadow: `0 0 15px ${accentColor}30` }}
            >
              {loading ? <RefreshCw size={12} className="animate-spin text-black" /> : <span>Adquirir Pro Anual ($120/año)</span>}
            </button>
          </div>
        </div>

        {/* Tier 3: Plan DJ Master (Institución) */}
        <div className="bg-[#080808] border border-white/5 rounded-[2rem] p-8 flex flex-col justify-between hover:border-white/10 transition-all relative">
          <div className="flex flex-col gap-6">
            <div>
              <span className="text-[10px] font-bold font-mono tracking-widest text-[#22d3ee] uppercase">NIVEL PROFESIONAL</span>
              <h3 className="text-2xl font-black font-display text-white mt-1">DJ Master / Club</h3>
              <p className="text-xs text-zinc-500 mt-2">
                Diseñado para marcas de radios locales, DJs, escuelas de música y setups comerciales de e-learning.
              </p>
            </div>

            <div className="py-2 border-y border-white/5 my-1 flex items-center justify-between">
              <div>
                <span className="text-3xl font-black font-mono text-white">$79</span>
                <span className="text-xs text-zinc-500 ml-1">/mes</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold font-mono text-zinc-300 block">$599 /año</span>
                <span className="text-[10px] text-zinc-500 block">($49 USD al mes)</span>
              </div>
            </div>

            <ul className="space-y-4">
              <li className="flex items-start gap-2.5 text-xs text-zinc-400 font-medium font-medium">
                <Check size={14} className="text-green-500 mt-0.5 shrink-0" />
                <span className="text-zinc-200">Todo lo del Plan Pro incluido</span>
              </li>
              <li className="flex items-start gap-2.5 text-xs text-zinc-400 font-medium">
                <Check size={14} className="text-green-500 mt-0.5 shrink-0" />
                <span className="font-semibold text-white">Remover marca de agua de MyPhonk</span>
              </li>
              <li className="flex items-start gap-2.5 text-xs text-zinc-400 font-medium">
                <Check size={14} className="text-green-500 mt-0.5 shrink-0" />
                <span>Panel de administración (hasta 10 DJ seats)</span>
              </li>
              <li className="flex items-start gap-2.5 text-xs text-zinc-400 font-medium">
                <Check size={14} className="text-green-500 mt-0.5 shrink-0" />
                <span>Códigos incrustados (Embed) para tus webs</span>
              </li>
              <li className="flex items-start gap-2.5 text-xs text-zinc-400 font-medium">
                <Check size={14} className="text-green-500 mt-0.5 shrink-0" />
                <span>Soporte técnico prioritario por correo (4h)</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 flex flex-col gap-2.5">
            <button
              onClick={() => handleSubscribeClick("institucion", "monthly")}
              disabled={loading || isPremiumActive}
              className="w-full py-3 h-11 flex items-center justify-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
            >
              Club Mensual ($79/mes)
            </button>
            <button
              onClick={() => handleSubscribeClick("institucion", "yearly")}
              disabled={loading || isPremiumActive}
              className="w-full py-3.5 h-11 flex items-center justify-center gap-1.5 rounded-xl bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/20 text-purple-300 font-bold text-xs transition-all cursor-pointer disabled:opacity-40"
            >
              Club Anual ($599/año)
            </button>
          </div>
        </div>

      </div>

      {/* Subscription Management Section */}
      {isPremiumActive && (
        <div className="rounded-[2rem] bg-[#0c0c0d] border border-white/5 p-6 md:p-8 flex flex-col items-center justify-between md:flex-row gap-6 mt-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 border border-green-500/20">
              <CheckCircle size={22} className="animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">MEMBRESÍA ACTIVA SECURE</span>
              <h4 className="text-sm font-black font-display text-white mt-0.5 leading-tight">
                Estás disfrutando de todos los beneficios de MyPhonk Premium
              </h4>
              <p className="text-xs text-zinc-500 mt-1">
                Puedes cancelar, cambiar de tarjeta o actualizar tu plan de Stripe de forma segura desde tu panel de cliente oficial.
              </p>
            </div>
          </div>
          
          <button
            onClick={handlePortalRedirect}
            disabled={portalLoading}
            className="px-6 py-3.5 rounded-xl bg-white text-black font-black text-xs transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
          >
            {portalLoading ? (
              <RefreshCw size={12} className="animate-spin text-black" />
            ) : (
              <>
                <span>Ir a Gestión de Facturación en Stripe</span>
                <ArrowUpRight size={14} />
              </>
            )}
          </button>
        </div>
      )}

      {/* Trust badges footer */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-[#070707] border border-white/5 rounded-3xl p-6 text-center text-zinc-500 text-xs">
        <div className="flex flex-col items-center gap-2">
          <Shield size={16} className="text-zinc-400" />
          <span className="font-bold text-zinc-300">Stripe Checkout Oficial</span>
          <span>Encriptación AES-256 de nivel bancario comercial directamente procesada por Stripe.</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Star size={16} className="text-zinc-400" />
          <span className="font-bold text-zinc-300">Monetización en Producción</span>
          <span>Acciones instantáneas directamente integradas con los eventos en vivo de tu plataforma.</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <HelpCircle size={16} className="text-zinc-400" />
          <span className="font-bold text-zinc-300">Cambios inmediatos</span>
          <span>Las modificaciones de planes se sincronizan de inmediato con tu base de datos de Firestore.</span>
        </div>
      </div>

    </div>
  );
}
