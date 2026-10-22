"use client";

import { useEffect, useState } from "react";
import { CoachResponse, RiderFitnessMetrics } from "@/lib/n8n_coach";
import { getStravaAuthHeaders, getStravaCacheKey } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import CoachMessageRenderer from "@/components/coach/CoachMessageRenderer";
import {
  BrainCircuit,
  Calendar,
  RefreshCw,
  Zap,
  ShieldCheck,
  MessageSquare,
  Send,
  Flame,
  Activity,
  Sparkles
} from "lucide-react";

export default function CoachPage() {
  const [coachData, setCoachData] = useState<CoachResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const [userQuery, setUserQuery] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "coach"; text: string; time: string }[]>([]);

  // Interactive FTP & Threshold Calculator state
  const [test20MinWatts, setTest20MinWatts] = useState<string>("230");
  const [test20MinHr, setTest20MinHr] = useState<string>("171");
  const [riderWeightKg, setRiderWeightKg] = useState<string>("72");

  const getCachedClientActivities = () => {
    if (typeof window === "undefined") return [];
    try {
      const user = getCurrentUser();
      if (!user) return [];
      const isOwner = user.id === "principal" || user.id === "usr_jmtb" || user.email === "jmtb@freeride.app";
      const key = getStravaCacheKey();
      const raw = localStorage.getItem(key) || (isOwner ? localStorage.getItem("freeride_strava_activities_v4") : null);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const loadCoachData = async () => {
    setLoading(true);
    try {
      const cachedActs = getCachedClientActivities();
      const currentAthlete = getCurrentUser();
      const res = await fetch("/api/v1/coach/plan", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...getStravaAuthHeaders()
        },
        body: JSON.stringify({
          activities: cachedActs,
          user_profile: currentAthlete
            ? {
                name: currentAthlete.name,
                age: currentAthlete.age,
                weight_kg: currentAthlete.weightKg,
                height_cm: currentAthlete.heightCm,
                experience_level: currentAthlete.experienceLevel,
                weekly_days_target: currentAthlete.weeklyDaysTarget,
                weekly_hours_target: currentAthlete.weeklyHoursTarget,
                known_max_hr: currentAthlete.knownMaxHr,
                known_ftp: currentAthlete.knownFtp
              }
            : undefined
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCoachData(data);
        if (data?.metrics?.maxObservedHr) {
          const est20Hr = Math.round(data.metrics.maxObservedHr * 0.935);
          setTest20MinHr(String(est20Hr));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const initRiderMetrics = () => {
    if (typeof window === "undefined") return;
    const user = getCurrentUser();
    if (user?.onboardingCompleted) {
      if (user.weightKg) setRiderWeightKg(String(user.weightKg));
      if (user.knownFtp) setTest20MinWatts(String(user.knownFtp));
      if (user.knownMaxHr) setTest20MinHr(String(Math.round(user.knownMaxHr * 0.935)));
    } else {
      const savedW = localStorage.getItem("freeride_ftp_20m_w");
      const savedHr = localStorage.getItem("freeride_ftp_20m_hr");
      const savedKg = localStorage.getItem("freeride_rider_kg");
      if (savedW) setTest20MinWatts(savedW);
      if (savedHr) setTest20MinHr(savedHr);
      if (savedKg) setRiderWeightKg(savedKg);
    }
  };

  useEffect(() => {
    initRiderMetrics();
    loadCoachData();

    const handleAuthChange = () => {
      initRiderMetrics();
      loadCoachData();
    };
    window.addEventListener("auth-changed", handleAuthChange);
    return () => {
      window.removeEventListener("auth-changed", handleAuthChange);
    };
  }, []);

  const submitCoachPrompt = async (promptText: string) => {
    if (!promptText.trim()) return;
    const nowStr = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    setChatMessages((prev) => [...prev, { role: "user", text: promptText, time: nowStr }]);
    setChatLoading(true);

    try {
      const cachedActs = getCachedClientActivities();
      const currentAthlete = getCurrentUser();
      const res = await fetch("/api/v1/coach/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getStravaAuthHeaders()
        },
        body: JSON.stringify({
          query: promptText,
          activities: cachedActs,
          user_profile: currentAthlete
            ? {
                name: currentAthlete.name,
                age: currentAthlete.age,
                weight_kg: currentAthlete.weightKg,
                height_cm: currentAthlete.heightCm,
                experience_level: currentAthlete.experienceLevel,
                weekly_days_target: currentAthlete.weeklyDaysTarget,
                weekly_hours_target: currentAthlete.weeklyHoursTarget,
                known_max_hr: currentAthlete.knownMaxHr,
                known_ftp: currentAthlete.knownFtp
              }
            : undefined
        })
      });

      if (res.ok) {
        const data: CoachResponse = await res.json();
        setCoachData(data);
        setChatMessages((prev) => [
          ...prev,
          {
            role: "coach",
            text: data.content_es,
            time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
          }
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleAskCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim()) return;
    const q = userQuery;
    setUserQuery("");
    await submitCoachPrompt(q);
  };

  const metrics: RiderFitnessMetrics = coachData?.metrics || {
    ctl: 0,
    atl: 0,
    tsb: 0,
    formStatus: "Calculando carga histórica desde Strava...",
    formColor: "#06B6D4",
    weeklyDistanceKm: 0,
    weeklyElevGainM: 0,
    avgHrLastRides: 0,
    avgWattsLastRides: 0
  };

  const maxHrReal = metrics.maxObservedHr || 183;
  const z1Low = Math.round(maxHrReal * 0.50);
  const z1High = Math.round(maxHrReal * 0.60);
  const z2Low = Math.round(maxHrReal * 0.62);
  const z2High = Math.round(maxHrReal * 0.73);
  const z4Low = Math.round(maxHrReal * 0.82);
  const z4High = Math.round(maxHrReal * 0.91);
  const estLthr = Math.round(maxHrReal * 0.895);

  const parsed20W = Math.max(50, Number(test20MinWatts) || 230);
  const parsed20Hr = Math.max(100, Number(test20MinHr) || 171);
  const parsedKg = Math.max(40, Number(riderWeightKg) || 72);
  const calculatedFtp = Math.round(parsed20W * 0.95);
  const calculatedLthr = Math.round(parsed20Hr * 0.95);
  const wattsPerKg = (calculatedFtp / parsedKg).toFixed(2);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* 1. Header Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-dark-card via-dark-card to-purple-950/40 border border-purple-500/30 space-y-5 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/30">
              <BrainCircuit className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white">Entrenador Personal AI FREERIDE</h1>
                <span className="bg-purple-500/20 text-purple-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-purple-500/30 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{coachData?.source === "N8N_WORKFLOW" ? "Engine: N8N Workflow" : "Engine: Cycling Science AI"}</span>
                </span>
              </div>
              <p className="text-xs text-dark-muted">
                Optimización fisiológica de carga (CTL / ATL / TSB) sobre todo tu historial de Strava
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-dark-muted max-w-3xl leading-relaxed">
          Tu entrenador personal analiza todo tu historial de entrenamientos sincronizado desde{" "}
          <strong className="text-white">Strava API v3</strong>. Calcula tu estado de forma (CTL), fatiga aguda (ATL) y balance de frescura (TSB) para diseñar tus entrenamientos semanales de Carretera y MTB.
        </p>
      </div>

      {/* 2. Physiological Fitness & Load Dashboard (CTL / ATL / TSB) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-dark-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-dark-muted font-medium">Estado de Forma (CTL)</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">
            {metrics.ctl} <span className="text-xs text-dark-muted font-normal">TSS</span>
          </p>
          <div className="w-full bg-dark-bg h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full"
              style={{ width: `${Math.min(100, (metrics.ctl / 80) * 100)}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-dark-muted">Carga Crónica de 42 días</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-dark-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-dark-muted font-medium">Fatiga Acumulada (ATL)</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">
            {metrics.atl} <span className="text-xs text-dark-muted font-normal">TSS</span>
          </p>
          <div className="w-full bg-dark-bg h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full"
              style={{ width: `${Math.min(100, (metrics.atl / 80) * 100)}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-dark-muted">Carga Aguda de 7 días</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-dark-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-dark-muted font-medium">Frescura / Form (TSB)</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">
            {metrics.tsb > 0 ? `+${metrics.tsb}` : metrics.tsb}{" "}
            <span className="text-xs text-dark-muted font-normal">TSS</span>
          </p>
          <p className="text-[11px] font-bold truncate" style={{ color: metrics.formColor }}>
            {metrics.formStatus}
          </p>
          <p className="text-[10px] text-dark-muted">CTL - ATL Balance</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-dark-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-dark-muted font-medium">Volumen Semanal</span>
            <Calendar className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">
            {metrics.weeklyDistanceKm} <span className="text-xs text-dark-muted font-normal">km</span>
          </p>
          <p className="text-[11px] text-emerald-400 font-medium">+{metrics.weeklyElevGainM} m desnivel</p>
          <p className="text-[10px] text-dark-muted">
            Media HR: {metrics.avgHrLastRides > 0 ? `${metrics.avgHrLastRides} bpm` : "--"}
          </p>
        </div>
      </div>

      {/* 3. Interactive AI Personal Coach Assistant */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-dark-border space-y-6">
        <div className="flex items-center justify-between border-b border-dark-border pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Consultar a tu Entrenador AI</h2>
              <p className="text-xs text-dark-muted">
                Hazle cualquier pregunta sobre tu evolución, test FTP, ritmo, alimentación o entrenamiento de hoy
              </p>
            </div>
          </div>

          <button
            onClick={loadCoachData}
            disabled={loading}
            className="p-2 text-dark-muted hover:text-white bg-dark-bg rounded-xl border border-dark-border transition"
            title="Recargar diagnóstico"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-purple-400" : ""}`} />
          </button>
        </div>

        {/* Quick Action Prompt Chips */}
        <div className="flex flex-wrap gap-2">
          {[
            "🎯 Créame un Test FTP de 20 minutos adaptado a mis pulsaciones reales",
            "⛰️ ¿Cómo mejoro subiendo puertos según mi historial de Strava?",
            "🚴 ¿Cómo preparo una ruta de más de 100 km sin desfallecer?",
            "⚡ Analiza mis zonas de frecuencia cardíaca y polarización"
          ].map((quickPrompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => submitCoachPrompt(quickPrompt)}
              disabled={chatLoading}
              className="text-[11px] sm:text-xs font-semibold px-3 py-1.5 rounded-xl bg-dark-bg hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition disabled:opacity-50"
            >
              {quickPrompt}
            </button>
          ))}
        </div>

        <div className="space-y-4 max-h-[30rem] overflow-y-auto pr-2">
          {coachData && (
            <div className="bg-dark-bg/85 p-5 rounded-2xl border border-purple-500/30 space-y-3 shadow-lg">
              <div className="flex items-center space-x-2 text-xs text-purple-400 font-extrabold pb-2 border-b border-dark-border/60">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>{coachData.title}</span>
              </div>
              <CoachMessageRenderer content={coachData.content_es} />
            </div>
          )}

          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl text-xs sm:text-sm max-w-3xl space-y-2 ${
                msg.role === "user"
                  ? "bg-purple-600/20 border border-purple-500/30 text-white ml-auto"
                  : "bg-dark-bg/90 border border-purple-500/25 text-dark-text mr-auto shadow-md"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-dark-muted pb-1 border-b border-dark-border/40 mb-1.5">
                <span className="font-extrabold text-purple-400">
                  {msg.role === "user" ? "Tú" : "🤖 Entrenador Personal FREERIDE"}
                </span>
                <span>{msg.time}</span>
              </div>
              {msg.role === "user" ? (
                <div className="text-white font-medium text-xs sm:text-sm leading-relaxed">{msg.text}</div>
              ) : (
                <CoachMessageRenderer content={msg.text} />
              )}
            </div>
          ))}

          {chatLoading && (
            <div className="p-4 bg-dark-bg/90 rounded-2xl border border-dark-border text-xs text-purple-400 flex items-center space-x-2 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>El Entrenador AI está procesando tu historial de Strava y preparando tu respuesta...</span>
            </div>
          )}
        </div>

        <form onSubmit={handleAskCoach} className="flex items-center space-x-3 pt-2">
          <input
            type="text"
            placeholder="Ej: Créame un test FTP adaptado a mí / ¿Qué entreno debo hacer hoy?"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            className="flex-1 bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-dark-muted focus:outline-none focus:border-purple-500"
          />

          <button
            type="submit"
            disabled={chatLoading || !userQuery.trim()}
            className="px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-purple-600/25 disabled:opacity-50 flex items-center space-x-2"
          >
            <span>Enviar</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* 3.5 Personalized FTP & LTHR Test Protocol + Zones Calculator */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-purple-500/30 bg-gradient-to-br from-dark-card via-dark-card to-purple-950/20 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-dark-border pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                Protocolo de Test FTP & Umbral (20 min) Adaptado a tu Fisiología
              </h2>
              <p className="text-xs text-dark-muted">
                Calibrado según tu FC Máxima real en Strava ({maxHrReal} bpm) y tu perfil de {metrics.riderProfileType || "Ciclista de Resistencia"}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 self-start sm:self-auto">
            Protocolo Oficial Allen & Coggan (65 min)
          </span>
        </div>

        {/* 5-Phase Step-by-Step Protocol */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-2xl bg-dark-bg/75 border border-dark-border space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-blue-400">1. Calentamiento (20m)</span>
            <p className="text-xs font-bold text-white">Progresivo Z1 → Z2</p>
            <p className="text-[11px] text-dark-muted leading-relaxed">
              Rueda entre <strong className="text-white">{z1Low}-{z2High} bpm</strong> a 85-90 rpm preparando el sistema aeróbico.
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-dark-bg/75 border border-dark-border space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-emerald-400">2. Activación (6m)</span>
            <p className="text-xs font-bold text-white">3 × 1 min Cadencia Alta</p>
            <p className="text-[11px] text-dark-muted leading-relaxed">
              3 aceleraciones ágiles a <strong className="text-white">100-105 rpm</strong> con 1 min suave en Z1 entre cada una.
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-dark-bg/75 border border-dark-border space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-amber-400">3. Vaciado AWC (15m)</span>
            <p className="text-xs font-bold text-white">5m Fuerte + 10m Z1</p>
            <p className="text-[11px] text-dark-muted leading-relaxed">
              5 min en <strong className="text-white">{z4Low}-{z4High + 4} bpm</strong> para vaciar la batería anaeróbica + 10 min muy suaves (&lt;{z1High} bpm).
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-purple-500/15 border border-purple-500/40 space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-purple-400">4. TEST FTP (20m)</span>
            <p className="text-xs font-extrabold text-white">Esfuerzo Máximo Sostenido</p>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              Subida tendida (3-5%) o llano. Min 0-5 a <strong className="text-white">{z4Low}-{estLthr} bpm</strong>, min 5-15 en <strong className="text-white">{estLthr}-{z4High} bpm</strong> y últimos 5m a tope.
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-dark-bg/75 border border-dark-border space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-cyan-400">5. Enfriamiento (10m)</span>
            <p className="text-xs font-bold text-white">Vuelta a la Calma</p>
            <p className="text-[11px] text-dark-muted leading-relaxed">
              10 min de rodaje regenerativo en <strong className="text-white">Zona 1 (&lt;{z1High} bpm)</strong> soltando piernas.
            </p>
          </div>
        </div>

        {/* Interactive Calculator */}
        <div className="p-5 rounded-2xl bg-dark-bg/90 border border-dark-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Calculadora de Resultado del Test (FTP en Vatios & Umbral LTHR en Pulsaciones)
            </h3>
            <span className="text-[11px] text-purple-400 font-semibold">
              Fórmula: 95% de la media de tus 20 minutos
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-dark-muted mb-1">
                Potencia Media en los 20 min (W)
              </label>
              <input
                type="number"
                value={test20MinWatts}
                onChange={(e) => {
                  setTest20MinWatts(e.target.value);
                  try {
                    localStorage.setItem("freeride_ftp_20m_w", e.target.value);
                  } catch {}
                }}
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-dark-muted mb-1">
                Pulso Medio en los 20 min (bpm)
              </label>
              <input
                type="number"
                value={test20MinHr}
                onChange={(e) => {
                  setTest20MinHr(e.target.value);
                  try {
                    localStorage.setItem("freeride_ftp_20m_hr", e.target.value);
                  } catch {}
                }}
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-dark-muted mb-1">
                Tu Peso Corporal (kg)
              </label>
              <input
                type="number"
                value={riderWeightKg}
                onChange={(e) => {
                  setRiderWeightKg(e.target.value);
                  try {
                    localStorage.setItem("freeride_rider_kg", e.target.value);
                  } catch {}
                }}
                className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30">
              <p className="text-[10px] uppercase font-bold text-purple-300">Tu FTP Estimado (95%)</p>
              <p className="text-lg sm:text-xl font-black text-white">{calculatedFtp} W</p>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-[10px] uppercase font-bold text-emerald-300">Relación Peso/Potencia</p>
              <p className="text-lg sm:text-xl font-black text-white">{wattsPerKg} W/kg</p>
            </div>
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
              <p className="text-[10px] uppercase font-bold text-rose-300">Pulso de Umbral (LTHR)</p>
              <p className="text-lg sm:text-xl font-black text-white">{calculatedLthr} bpm</p>
            </div>
            <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
              <p className="text-[10px] uppercase font-bold text-cyan-300">Zona 2 Base Óptima</p>
              <p className="text-sm sm:text-base font-black text-white">
                {Math.round(calculatedFtp * 0.56)}-{Math.round(calculatedFtp * 0.75)} W{" "}
                <span className="text-xs font-normal text-cyan-300">({z2Low}-{z2High} bpm)</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Adaptive 7-Day Workout Plan */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-dark-border space-y-6">
        <div className="flex items-center justify-between border-b border-dark-border pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Microciclo Adaptativo de 7 Días</h2>
              <p className="text-xs text-dark-muted">
                Programación personalizada en función de tu balance de frescura (TSB)
              </p>
            </div>
          </div>

          <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
            Fase: Base & Umbral
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coachData?.weekly_plan?.map((workout, idx) => (
            <div
              key={idx}
              className="bg-dark-bg/60 p-4 rounded-2xl border border-dark-border space-y-3 hover:border-purple-500/40 transition group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-purple-400 uppercase tracking-wider">{workout.day}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    workout.intensity === "Descanso"
                      ? "bg-dark-border text-dark-muted"
                      : workout.intensity === "Baja"
                      ? "bg-blue-500/20 text-blue-400"
                      : workout.intensity === "Media"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : workout.intensity === "Alta"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-rose-500/20 text-rose-400"
                  }`}
                >
                  {workout.intensity}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">
                  {workout.title}
                </h3>
                <p className="text-xs text-dark-muted mt-1 leading-relaxed">{workout.description}</p>
              </div>

              <div className="pt-2 border-t border-dark-border/60 flex items-center justify-between text-[11px]">
                <span className="text-dark-muted font-medium">{workout.target_hr_zone}</span>
                <span className="font-bold text-white">
                  {workout.duration_min > 0 ? `${workout.duration_min} min` : "Descanso"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
