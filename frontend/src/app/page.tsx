"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ActivitySummary } from "@/types/telemetry";
import {
  fetchActivities,
  getStravaAuthHeaders,
  saveStravaAuthClient,
  purgeLegacyGarminCache
} from "@/lib/api";
import { formatDistance, formatElevation, formatTime, formatSpeed } from "@/lib/utils";
import {
  Bike,
  Mountain,
  Gauge,
  Flame,
  ArrowRight,
  UploadCloud,
  BrainCircuit,
  Activity as ActivityIcon,
  RefreshCw,
  CheckCircle2
} from "lucide-react";
import StravaConnectModal from "@/components/strava/StravaConnectModal";

export default function Dashboard() {
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStravaModalOpen, setIsStravaModalOpen] = useState(false);
  const [stravaSession, setStravaSession] = useState<{ connected: boolean; athleteName?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadData = () => {
    purgeLegacyGarminCache();

    const local = localStorage.getItem("freeride_strava_activities_v4");
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setActivities(parsed);
          setLoading(false);
        }
      } catch {}
    }

    fetchActivities()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setActivities(data);
          localStorage.setItem("freeride_strava_activities_v4", JSON.stringify(data));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch("/api/v1/strava/session", {
      cache: "no-store",
      headers: {
        ...getStravaAuthHeaders()
      }
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.connected) {
          setStravaSession(data);
        } else {
          const cachedAuth = localStorage.getItem("freeride_strava_auth");
          const cachedAthlete = localStorage.getItem("freeride_strava_athlete");
          if (cachedAuth) {
            setStravaSession({ connected: true, athleteName: cachedAthlete || "Atleta Strava" });
          } else {
            setStravaSession({ connected: false });
          }
        }
      })
      .catch((e) => console.error(e));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQuickSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/v1/strava/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getStravaAuthHeaders()
        },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) {
        setIsStravaModalOpen(true);
        return;
      }
      if (data.strava_auth) {
        saveStravaAuthClient(data.strava_auth, data.athleteName);
      }
      if (data.activities && Array.isArray(data.activities) && data.activities.length > 0) {
        setActivities(data.activities);
        localStorage.setItem("freeride_strava_activities_v4", JSON.stringify(data.activities));
      } else {
        loadData();
      }
    } catch {
      setIsStravaModalOpen(true);
    } finally {
      setSyncing(false);
    }
  };

  const totalDistance = activities.reduce((acc, a) => acc + a.total_distance_m, 0);
  const totalElevation = activities.reduce((acc, a) => acc + a.elevation_gain_m, 0);
  const totalTime = activities.reduce((acc, a) => acc + a.moving_time_sec, 0);
  const mtbCount = activities.filter((a) => a.activity_type === "MOUNTAIN_BIKE").length;
  const roadCount = activities.filter((a) => a.activity_type !== "MOUNTAIN_BIKE").length;

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="glass-panel p-5 md:p-8 rounded-3xl bg-gradient-to-r from-dark-card via-dark-card to-orange-950/30 border border-orange-500/20 relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold">
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

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center space-x-3 sm:space-x-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
            <Bike className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs text-dark-muted font-medium">Distancia Total</p>
            <p className="text-lg sm:text-2xl font-bold text-white">{formatDistance(totalDistance)}</p>
          </div>
        </div>

        <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center space-x-3 sm:space-x-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Mountain className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs text-dark-muted font-medium">Desnivel Positivo</p>
            <p className="text-lg sm:text-2xl font-bold text-white">{formatElevation(totalElevation)}</p>
          </div>
        </div>

        <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center space-x-3 sm:space-x-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
            <Gauge className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs text-dark-muted font-medium">Tiempo Entrenado</p>
            <p className="text-lg sm:text-2xl font-bold text-white">{formatTime(totalTime)}</p>
          </div>
        </div>

        <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center space-x-3 sm:space-x-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs text-dark-muted font-medium">Entrenamientos</p>
            <p className="text-base sm:text-2xl font-bold text-white">
              <span className="text-emerald-400">{mtbCount} MTB</span> / <span className="text-blue-400">{roadCount} Rd</span>
            </p>
          </div>
        </div>
      </div>

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
            <div className="glass-panel p-8 sm:p-12 text-center text-dark-muted rounded-2xl text-xs sm:text-sm">
              Cargando historial de entrenamientos desde Strava...
            </div>
          ) : activities.length === 0 ? (
            <div className="glass-panel p-8 sm:p-12 text-center rounded-2xl space-y-4 border border-orange-500/20">
              <div className="w-12 h-12 rounded-2xl bg-[#FC4C02] text-white flex items-center justify-center font-black text-2xl mx-auto shadow-lg shadow-orange-600/30">
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
                  className="inline-flex items-center space-x-2 bg-[#FC4C02] hover:bg-[#e34402] text-white text-xs font-extrabold px-5 py-3 rounded-xl transition shadow-lg shadow-orange-600/25"
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
                    className="glass-panel p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 hover:border-orange-500/50 transition duration-200 group"
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
                      <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-orange-400 transition">
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
          <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-orange-500/30 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-sm sm:text-base flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-md bg-[#FC4C02] text-white flex items-center justify-center font-black text-xs">
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
                className="w-full inline-flex items-center justify-center space-x-2 bg-[#FC4C02] hover:bg-[#e34402] text-white text-xs font-extrabold py-3 rounded-xl transition shadow-lg shadow-orange-600/25 disabled:opacity-50"
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

      <StravaConnectModal
        isOpen={isStravaModalOpen}
        onClose={() => setIsStravaModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
