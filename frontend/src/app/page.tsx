"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ActivitySummary } from "@/types/telemetry";
import {
  fetchActivities,
  getStravaAuthHeaders,
  saveStravaAuthClient,
  purgeLegacyGarminCache,
  getStravaCacheKey
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { formatDistance, formatElevation, formatTime, formatSpeed } from "@/lib/utils";
import {
  Bike,
  Mountain,
  Gauge,
  Flame,
  ArrowRight,
  BrainCircuit,
  Activity as ActivityIcon,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Heart,
  Zap,
  Sparkles,
  Compass
} from "lucide-react";
import StravaConnectModal from "@/components/strava/StravaConnectModal";
import AuthModal from "@/components/auth/AuthModal";
import FreerideLogo from "@/components/layout/FreerideLogo";

export default function Dashboard() {
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStravaModalOpen, setIsStravaModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [stravaSession, setStravaSession] = useState<{ connected: boolean; athleteName?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncBanner, setSyncBanner] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const loadData = () => {
    purgeLegacyGarminCache();

    const user = getCurrentUser();
    if (!user) {
      setActivities([]);
      setLoading(false);
      setStravaSession({ connected: false });
      return;
    }

    const isOwner = user.id === "principal" || user.id === "usr_jmtb" || user.email === "jmtb@freeride.app";
    const cacheKey = getStravaCacheKey();

    const local = localStorage.getItem(cacheKey) || (isOwner ? localStorage.getItem("freeride_strava_activities_v4") : null);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setActivities(parsed);
          setLoading(false);
        } else {
          setActivities([]);
        }
      } catch {
        setActivities([]);
      }
    } else {
      setActivities([]);
    }

    fetchActivities()
      .then((data) => {
        if (Array.isArray(data)) {
          setActivities(data);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
          } catch {}
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    if (user.stravaAthleteName || user.stravaAuth) {
      setStravaSession({ connected: true, athleteName: user.stravaAthleteName || user.name });
    } else {
      setStravaSession({ connected: false });
    }

    fetch("/api/v1/strava/session", {
      cache: "no-store",
      headers: {
        ...getStravaAuthHeaders()
      }
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.connected && user) {
          setStravaSession(data);
        }
      })
      .catch((e) => console.error(e));
  };

  useEffect(() => {
    purgeLegacyGarminCache();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const errParam = params.get("strava_error") || params.get("error");

      if (errParam) {
        window.history.replaceState({}, "", window.location.pathname);
        const msg =
          errParam === "access_denied"
            ? "Se canceló la autorización en Strava. Pulsa 'Autorizar' en la pantalla de Strava."
            : "Error en la conexión anterior con Strava. Verifica tu Client ID y tu Secreto del cliente (Client Secret) y pulsa 'Autorizar con Strava en 1 Clic'.";
        setOauthError(msg);
        setIsStravaModalOpen(true);
        loadData();
        return;
      }

      if (code) {
        window.history.replaceState({}, "", window.location.pathname);
        let cid = localStorage.getItem("freeride_strava_cid") || "";
        let csec = localStorage.getItem("freeride_strava_csec") || "";

        if (state) {
          try {
            const decoded = JSON.parse(atob(state));
            if (decoded.cid) cid = decoded.cid;
            if (decoded.csec) csec = decoded.csec;
          } catch {}
        }

        setSyncing(true);
        setLoading(true);
        setOauthError(null);
        setSyncBanner("Conectando con Strava y descargando todo tu historial de entrenamientos...");

        fetch("/api/v1/strava/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getStravaAuthHeaders()
          },
          body: JSON.stringify({
            code,
            client_id: cid || undefined,
            client_secret: csec || undefined
          })
        })
          .then(async (res) => {
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.detail || "Error al intercambiar código OAuth con Strava");
            }
            if (data.strava_auth) {
              saveStravaAuthClient(data.strava_auth, data.athleteName);
            }
            setStravaSession({
              connected: true,
              athleteName: data.athleteName || "Atleta Strava"
            });
            if (Array.isArray(data.activities)) {
              setActivities(data.activities);
              try {
                localStorage.setItem(getStravaCacheKey(), JSON.stringify(data.activities));
              } catch {}
            }
            window.dispatchEvent(new Event("strava-synced"));
            setSyncBanner(
              data.message ||
                `¡Conectado a Strava! Se han importado ${data.synced_count || 0} actividades de tu historial.`
            );
            setTimeout(() => setSyncBanner(null), 7000);
          })
          .catch((err: any) => {
            setSyncBanner(null);
            setOauthError(err.message || "Error al sincronizar el historial de Strava");
            setIsStravaModalOpen(true);
          })
          .finally(() => {
            setSyncing(false);
            setLoading(false);
          });
        return;
      }
    }

    loadData();

    const handleAuthChange = () => {
      loadData();
    };
    window.addEventListener("auth-changed", handleAuthChange);
    return () => {
      window.removeEventListener("auth-changed", handleAuthChange);
    };
  }, []);

  const handleQuickSync = async () => {
    setSyncing(true);
    setOauthError(null);
    setSyncBanner("Sincronizando historial de actividades desde Strava...");
    try {
      const cid = localStorage.getItem("freeride_strava_cid") || undefined;
      const csec = localStorage.getItem("freeride_strava_csec") || undefined;
      const res = await fetch("/api/v1/strava/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getStravaAuthHeaders()
        },
        body: JSON.stringify({
          client_id: cid,
          client_secret: csec
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncBanner(null);
        setOauthError(data.detail || "Conecta tu cuenta de Strava para sincronizar");
        setIsStravaModalOpen(true);
        return;
      }
      if (data.strava_auth) {
        saveStravaAuthClient(data.strava_auth, data.athleteName);
      }
      setStravaSession({
        connected: true,
        athleteName: data.athleteName || "Atleta Strava"
      });
      if (data.activities && Array.isArray(data.activities) && data.activities.length > 0) {
        setActivities(data.activities);
        localStorage.setItem(getStravaCacheKey(), JSON.stringify(data.activities));
      } else {
        loadData();
      }
      window.dispatchEvent(new Event("strava-synced"));
      setSyncBanner(
        data.message || `¡Sincronización completada! (${data.synced_count || 0} entrenamientos)`
      );
      setTimeout(() => setSyncBanner(null), 6000);
    } catch {
      setSyncBanner(null);
      setIsStravaModalOpen(true);
    } finally {
      setSyncing(false);
    }
  };

  const activeUser = getCurrentUser();

  const totalDistance = activities.reduce((acc, a) => acc + (a.total_distance_m || 0), 0);
  const totalElevation = activities.reduce((acc, a) => acc + (a.elevation_gain_m || 0), 0);
  const totalTime = activities.reduce((acc, a) => acc + (a.moving_time_sec || 0), 0);
  const mtbCount = activities.filter((a) => a.activity_type === "MOUNTAIN_BIKE").length;
  const roadCount = activities.filter((a) => a.activity_type !== "MOUNTAIN_BIKE").length;

  // Compute Rider Historical Training Profile directly from all synced Strava activities
  const totalCount = activities.length;
  const avgDistKm = totalCount > 0 ? (totalDistance / 1000 / totalCount).toFixed(1) : "0";
  const maxDistKm =
    totalCount > 0
      ? (Math.max(...activities.map((a) => a.total_distance_m || 0)) / 1000).toFixed(1)
      : "0";
  const avgElevM = totalCount > 0 ? Math.round(totalElevation / totalCount) : 0;
  const elevRatio =
    totalDistance > 0 ? (totalElevation / (totalDistance / 1000)).toFixed(1) : "0";
  const hrActivities = activities.filter((a) => a.avg_hr && a.avg_hr > 0);
  const avgHistoricalHr =
    hrActivities.length > 0
      ? Math.round(hrActivities.reduce((acc, a) => acc + (a.avg_hr || 0), 0) / hrActivities.length)
      : 0;
  const maxHistoricalHr =
    activities.length > 0
      ? Math.max(0, ...activities.map((a) => a.max_hr || 0))
      : 0;
  const avgSpeedAll =
    totalCount > 0
      ? (activities.reduce((acc, a) => acc + (a.avg_speed_kmh || 0), 0) / totalCount).toFixed(1)
      : "0";

  const mtbPct = totalCount > 0 ? Math.round((mtbCount / totalCount) * 100) : 0;
  const riderProfileLabel =
    Number(elevRatio) >= 18
      ? mtbPct >= 50
        ? "Escalador Puro & Trail MTB"
        : "Escalador de Alta Montaña"
      : Number(avgDistKm) >= 55
      ? "Especialista en Gran Fondo & Resistencia"
      : Number(avgSpeedAll) >= 26
      ? "Rodador de Potencia & Ritmo Sostenido"
      : mtbPct >= 60
      ? "Especialista XC / Maratón MTB"
      : "Ciclista Polivalente de Resistencia";

  const z2Low = Math.round((maxHistoricalHr || 185) * 0.62);
  const z2High = Math.round((maxHistoricalHr || 185) * 0.73);
  const z4Low = Math.round((maxHistoricalHr || 185) * 0.82);
  const z4High = Math.round((maxHistoricalHr || 185) * 0.91);

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto">
      {/* Live Sync / Error Notifications */}
      {syncBanner && (
        <div className="glass-panel p-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs sm:text-sm font-bold flex items-center space-x-3 shadow-lg">
          {syncing ? (
            <RefreshCw className="w-5 h-5 animate-spin text-purple-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{syncBanner}</span>
        </div>
      )}

      {oauthError && (
        <div className="glass-panel p-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs sm:text-sm flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{oauthError}</span>
          </div>
          <button
            onClick={() => setIsStravaModalOpen(true)}
            className="shrink-0 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition"
          >
            Reintentar Conexión
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="glass-panel p-5 md:p-8 rounded-3xl bg-gradient-to-r from-dark-card via-dark-card to-purple-950/30 border border-purple-500/20 relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-bold">
            <Bike className="w-3.5 h-3.5" />
            <span>FREERIDE v4 · Powered by Strava API</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-4xl font-extrabold text-white tracking-tight">
            Panel de Telemetría & Entrenador Personal AI
          </h1>
          <p className="text-xs sm:text-sm text-dark-muted max-w-2xl">
            Sincronización directa con Strava para extraer todo tu historial de entrenamientos, gráficas segundo a segundo (Streams) y planificación inteligente con IA.
          </p>
        </div>
      </div>

      {!activeUser ? (
        <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-purple-500/40 bg-gradient-to-br from-dark-card via-dark-card to-purple-950/20 text-center space-y-5 max-w-2xl mx-auto shadow-2xl">
          <FreerideLogo size="lg" className="mx-auto" />
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              Sesión Cerrada · Selecciona tu Atleta
            </h2>
            <p className="text-xs sm:text-sm text-dark-muted max-w-md mx-auto">
              Cada perfil almacena sus datos, entrenamientos y conexión a Strava de forma totalmente independiente.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs sm:text-sm rounded-xl transition shadow-lg shadow-purple-600/30 flex items-center space-x-2"
            >
              <span>Elegir o Crear Perfil de Atleta</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* Distancia Total - Indigo / Violet */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center space-x-3 sm:space-x-4 border border-indigo-500/20 hover:border-indigo-500/40 transition">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/10">
            <Bike className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs text-dark-muted font-medium">Distancia Total</p>
            <p className="text-lg sm:text-2xl font-bold text-white">{formatDistance(totalDistance)}</p>
          </div>
        </div>

        {/* Desnivel Positivo - Emerald / Mint */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center space-x-3 sm:space-x-4 border border-emerald-500/20 hover:border-emerald-500/40 transition">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/10">
            <Mountain className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs text-dark-muted font-medium">Desnivel Positivo</p>
            <p className="text-lg sm:text-2xl font-bold text-white">{formatElevation(totalElevation)}</p>
          </div>
        </div>

        {/* Tiempo Entrenado - Warm Amber / Solar */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center space-x-3 sm:space-x-4 border border-amber-500/20 hover:border-amber-500/40 transition">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/10">
            <Gauge className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs text-dark-muted font-medium">Tiempo Entrenado</p>
            <p className="text-lg sm:text-2xl font-bold text-white">{formatTime(totalTime)}</p>
          </div>
        </div>

        {/* Entrenamientos - Electric Fuchsia / Magenta */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center space-x-3 sm:space-x-4 border border-fuchsia-500/20 hover:border-fuchsia-500/40 transition">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-pink-600/20 text-fuchsia-400 border border-fuchsia-500/30 flex items-center justify-center shrink-0 shadow-sm shadow-fuchsia-500/10">
            <Flame className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs text-dark-muted font-medium">Entrenamientos</p>
            <p className="text-base sm:text-2xl font-bold text-white">
              <span className="text-emerald-400">{mtbCount} MTB</span> / <span className="text-indigo-400">{roadCount} Rd</span>
            </p>
          </div>
        </div>
      </div>

      {/* Historical Rider Training Profile & AI Recommendation Banner */}
      {activities.length > 0 && (
        <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-purple-500/30 bg-gradient-to-br from-dark-card via-dark-card to-purple-950/25 space-y-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-violet-600 to-fuchsia-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-purple-600/25">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-extrabold text-white">
                    Tu Perfil de Entrenamiento:{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-purple-300 to-fuchsia-300">
                      {riderProfileLabel}
                    </span>
                  </h2>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                    {totalCount} salidas analizadas en Strava
                  </span>
                </div>
                <p className="text-xs text-dark-muted">
                  Diagnóstico fisiológico calculado sobre todo tu historial de recorridos en Strava
                </p>
              </div>
            </div>

            <Link
              href="/coach"
              className="self-start sm:self-auto inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition shadow-lg shadow-purple-600/25"
            >
              <BrainCircuit className="w-4 h-4" />
              <span>Ver Plan Semanal Personalizado</span>
            </Link>
          </div>

          {/* 4 Differentiated Sub-Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 1. Distancia - Indigo */}
            <div className="p-3.5 rounded-2xl bg-dark-bg/80 border border-indigo-500/25 hover:border-indigo-500/40 transition">
              <p className="text-[10px] uppercase font-bold text-dark-muted flex items-center space-x-1">
                <Compass className="w-3 h-3 text-indigo-400" />
                <span>Media por Salida / Récord</span>
              </p>
              <p className="text-sm sm:text-base font-extrabold text-white mt-1">
                {avgDistKm} km <span className="text-xs font-normal text-indigo-400">(Máx: {maxDistKm} km)</span>
              </p>
            </div>

            {/* 2. Desnivel - Emerald */}
            <div className="p-3.5 rounded-2xl bg-dark-bg/80 border border-emerald-500/25 hover:border-emerald-500/40 transition">
              <p className="text-[10px] uppercase font-bold text-dark-muted flex items-center space-x-1">
                <Mountain className="w-3 h-3 text-emerald-400" />
                <span>Exigencia Vertical</span>
              </p>
              <p className="text-sm sm:text-base font-extrabold text-white mt-1">
                +{avgElevM} m/ruta <span className="text-xs font-normal text-emerald-400">({elevRatio} m/km)</span>
              </p>
            </div>

            {/* 3. Pulso - Rose */}
            <div className="p-3.5 rounded-2xl bg-dark-bg/80 border border-rose-500/25 hover:border-rose-500/40 transition">
              <p className="text-[10px] uppercase font-bold text-dark-muted flex items-center space-x-1">
                <Heart className="w-3 h-3 text-rose-400" />
                <span>Pulso Medio / Máx Real</span>
              </p>
              <p className="text-sm sm:text-base font-extrabold text-white mt-1">
                {avgHistoricalHr > 0 ? `${avgHistoricalHr} bpm` : "--"}{" "}
                <span className="text-xs font-normal text-rose-400">
                  {maxHistoricalHr > 0 ? `(Máx: ${maxHistoricalHr} bpm)` : ""}
                </span>
              </p>
            </div>

            {/* 4. Velocidad - Amber / Cyan */}
            <div className="p-3.5 rounded-2xl bg-dark-bg/80 border border-cyan-500/25 hover:border-cyan-500/40 transition">
              <p className="text-[10px] uppercase font-bold text-dark-muted flex items-center space-x-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Velocidad & Terreno</span>
              </p>
              <p className="text-sm sm:text-base font-extrabold text-white mt-1">
                {avgSpeedAll} km/h <span className="text-xs font-normal text-cyan-400">({mtbPct}% MTB)</span>
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-dark-bg/90 border border-purple-500/25 text-xs text-gray-300 leading-relaxed space-y-1">
            <p className="font-bold text-fuchsia-400 flex items-center space-x-1.5 mb-1.5">
              <BrainCircuit className="w-4 h-4 text-fuchsia-400" />
              <span>Pauta Directa según tu Historial:</span>
            </p>
            <p>• <strong className="text-white">Base Z2 (75% de tus salidas):</strong> Rodar entre <strong className="text-emerald-400">{z2Low}-{z2High} bpm</strong> (bajar de tu media de {avgHistoricalHr} bpm).</p>
            <p>• <strong className="text-white">Calidad Z4 (1 día/sem):</strong> 3×10 min en subida a <strong className="text-amber-400">{z4Low}-{z4High} bpm</strong> (rec: 5m suave).</p>
            <p>• <strong className="text-white">Fondo Sábado:</strong> Objetivo <strong className="text-violet-400">{Math.round(Math.max(45, Number(avgDistKm) * 1.25))} km</strong> a 88-90 rpm.</p>
          </div>
        </div>
      )}

      {/* Main Grid: Activities Feed & Strava Sync Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Left Column: Historical & Recent Activities */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
              <ActivityIcon className="w-5 h-5 text-dark-accent" />
              <span>Historial de Actividades en Strava ({activities.length})</span>
            </h2>
            <Link
              href="/upload"
              className="text-xs font-semibold text-dark-accent hover:underline flex items-center space-x-1"
            >
              <span>Subir archivo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading && activities.length === 0 ? (
            <div className="glass-panel p-8 sm:p-12 text-center text-dark-muted rounded-2xl text-xs sm:text-sm flex flex-col items-center space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
              <span>Sincronizando y analizando todo tu historial de entrenamientos desde Strava...</span>
            </div>
          ) : activities.length === 0 ? (
            <div className="glass-panel p-8 sm:p-12 text-center rounded-2xl space-y-4 border border-purple-500/20">
              <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black text-2xl mx-auto shadow-lg shadow-purple-600/30">
                S
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-bold text-white">Conecta tu cuenta de Strava</h3>
                <p className="text-xs text-dark-muted max-w-md mx-auto">
                  Vincula Strava para importar automáticamente todos tus recorridos hasta la fecha actual, calcular tu perfil de entrenamiento y ver tus gráficas reales.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => (stravaSession?.connected ? handleQuickSync() : setIsStravaModalOpen(true))}
                  className="inline-flex items-center space-x-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold px-5 py-3 rounded-xl transition shadow-lg shadow-purple-600/25"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                  <span>Conectar y Sincronizar Strava</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((act) => {
                const isMTB = act.activity_type === "MOUNTAIN_BIKE";
                return (
                  <Link
                    key={act.id}
                    href={`/activities/${act.id}`}
                    className="glass-panel p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 hover:border-purple-500/50 transition duration-200 group"
                  >
                    <div className="space-y-1 w-full sm:w-auto">
                      <div className="flex items-center justify-between sm:justify-start space-x-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold ${
                            isMTB
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          }`}
                        >
                          {isMTB ? "MOUNTAIN BIKE" : "CARRETERA"}
                        </span>
                        <span className="text-[11px] sm:text-xs text-dark-muted">
                          {new Date(act.start_time).toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-purple-400 transition">
                        {act.title}
                      </h3>
                    </div>

                    {/* Stats Pill */}
                    <div className="w-full sm:w-auto grid grid-cols-3 sm:flex sm:items-center gap-2 sm:space-x-6 text-xs text-dark-muted pt-2 sm:pt-0 border-t border-dark-border/40 sm:border-t-0">
                      <div>
                        <p className="text-[9px] sm:text-[10px] uppercase font-semibold">Distancia</p>
                        <p className="font-bold text-white text-xs sm:text-sm">{formatDistance(act.total_distance_m)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] sm:text-[10px] uppercase font-semibold">Desnivel</p>
                        <p className="font-bold text-white text-xs sm:text-sm">+{formatElevation(act.elevation_gain_m)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] sm:text-[10px] uppercase font-semibold">Velocidad</p>
                        <p className="font-bold text-white text-xs sm:text-sm">{formatSpeed(act.avg_speed_kmh)}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Strava Sync & AI Coach Widgets */}
        <div className="space-y-6">
          {/* Strava Sync Card */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-purple-500/30 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-sm sm:text-base flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-md bg-purple-600 text-white flex items-center justify-center font-black text-xs">
                    S
                  </span>
                  <span>Motor Oficial Strava API</span>
                </h3>
                {stravaSession?.connected && (
                  <span className="flex items-center space-x-1 text-[10px] sm:text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Conectado</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-dark-muted leading-relaxed">
                {stravaSession?.connected
                  ? `Cuenta vinculada (${stravaSession.athleteName}). Pulsa para sincronizar tus últimos entrenamientos de Strava.`
                  : "Conecta Strava para extraer todo tu historial de entrenamientos y gráficas reales."}
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => (stravaSession?.connected ? handleQuickSync() : setIsStravaModalOpen(true))}
                disabled={syncing}
                className="w-full inline-flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold py-3 rounded-xl transition shadow-lg shadow-purple-600/25 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                <span>
                  {syncing
                    ? "Sincronizando con Strava..."
                    : stravaSession?.connected
                    ? "Sincronizar Nuevos Entrenos"
                    : "Conectar con Strava"}
                </span>
              </button>

              {stravaSession?.connected && (
                <button
                  onClick={() => setIsStravaModalOpen(true)}
                  className="w-full text-[11px] text-dark-muted hover:text-white py-1 transition"
                >
                  Configurar credenciales / OAuth de Strava
                </button>
              )}
            </div>
          </div>

          {/* AI Coach Widget */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-cyan-500/20 space-y-4">
            <div className="space-y-2">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center space-x-2">
                <BrainCircuit className="w-4 h-4 text-cyan-400" />
                <span>Entrenador AI FREERIDE</span>
              </h3>
              <p className="text-xs text-dark-muted leading-relaxed">
                Analiza todo tu historial de Strava (CTL/ATL/TSB, zonas cardíacas y potencia) para guiarte y entrenarte.
              </p>
            </div>

            <Link
              href="/coach"
              className="w-full inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold py-3 rounded-xl transition shadow-lg shadow-cyan-600/20"
            >
              <BrainCircuit className="w-4 h-4" />
              <span>Abrir Entrenador Personal AI</span>
            </Link>
          </div>
        </div>
      </div>
        </>
      )}

      <StravaConnectModal
        isOpen={isStravaModalOpen}
        onClose={() => setIsStravaModalOpen(false)}
        onSuccess={loadData}
        initialError={oauthError}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={getCurrentUser()}
        onUserChanged={() => loadData()}
      />
    </div>
  );
}
