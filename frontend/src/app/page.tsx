"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ActivitySummary } from "@/types/telemetry";
import { fetchActivities } from "@/lib/api";
import { formatDistance, formatElevation, formatTime, formatSpeed } from "@/lib/utils";
import { Bike, Mountain, Gauge, Flame, ArrowRight, UploadCloud, BrainCircuit, Activity as ActivityIcon, RefreshCw, CheckCircle2 } from "lucide-react";
import GarminSyncModal from "@/components/garmin/GarminSyncModal";

export default function Dashboard() {
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGarminModalOpen, setIsGarminModalOpen] = useState(false);
  const [garminSession, setGarminSession] = useState<{ connected: boolean; email?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadData = () => {
    // 1. Instantly load from localStorage if available
    const local = localStorage.getItem('freeride_cached_activities');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setActivities(parsed);
          setLoading(false);
        }
      } catch {}
    }

    // 2. Fetch latest from API & sync to localStorage
    fetchActivities()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setActivities(data);
          localStorage.setItem('freeride_cached_activities', JSON.stringify(data));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch("/api/v1/garmin/session")
      .then((r) => r.json())
      .then((data) => setGarminSession(data))
      .catch((e) => console.error(e));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQuickSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/v1/garmin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (res.ok && data.activities && Array.isArray(data.activities) && data.activities.length > 0) {
        setActivities(data.activities);
        localStorage.setItem('freeride_cached_activities', JSON.stringify(data.activities));
      } else {
        loadData();
      }
    } catch {
      setIsGarminModalOpen(true);
    } finally {
      setSyncing(false);
    }
  };

  const totalDistance = activities.reduce((acc, a) => acc + a.total_distance_m, 0);
  const totalElevation = activities.reduce((acc, a) => acc + a.elevation_gain_m, 0);
  const totalTime = activities.reduce((acc, a) => acc + a.moving_time_sec, 0);
  const mtbCount = activities.filter(a => a.activity_type === 'MOUNTAIN_BIKE').length;
  const roadCount = activities.filter(a => a.activity_type === 'ROAD_BIKE').length;

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="glass-panel p-5 md:p-8 rounded-3xl bg-gradient-to-r from-dark-card via-dark-card to-orange-950/20 border border-dark-border relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-semibold">
            <Bike className="w-3.5 h-3.5" />
            <span>FREERIDE App v1.0</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-4xl font-extrabold text-white tracking-tight">
            Panel de Telemetría & Entrenador AI
          </h1>
          <p className="text-xs sm:text-sm text-dark-muted max-w-2xl">
            Análisis de rendimiento y planes de entrenamiento personalizados para tus salidas de Carretera y Mountain Bike (Garmin Edge 130).
          </p>
        </div>
      </div>

      {/* Metric Summary Cards (Responsive 2x2 grid on mobile) */}
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
            <p className="text-[11px] sm:text-xs text-dark-muted font-medium">Tiempo Bici</p>
            <p className="text-lg sm:text-2xl font-bold text-white">{formatTime(totalTime)}</p>
          </div>
        </div>

        <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center space-x-3 sm:space-x-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs text-dark-muted font-medium">Salidas</p>
            <p className="text-base sm:text-2xl font-bold text-white">
              <span className="text-emerald-400">{mtbCount} MTB</span> / <span className="text-blue-400">{roadCount} Rd</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Activities Feed & Garmin Sync Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Left Column: Recent Activities */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
              <ActivityIcon className="w-5 h-5 text-dark-accent" />
              <span>Actividades Recientes ({activities.length})</span>
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
              Cargando actividades reales de Garmin Connect...
            </div>
          ) : activities.length === 0 ? (
            <div className="glass-panel p-8 sm:p-12 text-center rounded-2xl space-y-4">
              <UploadCloud className="w-10 h-10 sm:w-12 sm:h-12 text-dark-muted mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-bold text-white">No hay actividades cargadas</h3>
                <p className="text-xs text-dark-muted max-w-sm mx-auto">
                  Haz clic en "Sincronizar Garmin Connect" para importar todas tus rutas reales desde el 5 de agosto en adelante.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => (garminSession?.connected ? handleQuickSync() : setIsGarminModalOpen(true))}
                  className="inline-flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                  <span>Sincronizar Garmin Connect</span>
                </button>
                <Link
                  href="/upload"
                  className="inline-flex items-center space-x-2 bg-dark-accent hover:bg-orange-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Subir .FIT / .GPX</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((act) => {
                const isMTB = act.activity_type === 'MOUNTAIN_BIKE';
                return (
                  <Link
                    key={act.id}
                    href={`/activities/${act.id}`}
                    className="glass-panel p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 hover:border-dark-accent/50 transition duration-200 group"
                  >
                    <div className="space-y-1 w-full sm:w-auto">
                      <div className="flex items-center justify-between sm:justify-start space-x-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold ${
                          isMTB 
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                            : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        }`}>
                          {isMTB ? 'MOUNTAIN BIKE' : 'CARRETERA'}
                        </span>
                        <span className="text-[11px] sm:text-xs text-dark-muted">
                          {new Date(act.start_time).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-dark-accent transition">
                        {act.title}
                      </h3>
                    </div>

                    {/* Stats Pill (Responsive 3-column layout on mobile) */}
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

        {/* Right Column: Garmin Connect & AI Coach Widgets */}
        <div className="space-y-6">
          {/* Garmin Sync Card */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-cyan-500/20 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-sm sm:text-base flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 text-cyan-400" />
                  <span>Garmin Connect Sync</span>
                </h3>
                {garminSession?.connected && (
                  <span className="flex items-center space-x-1 text-[10px] sm:text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Conectado</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-dark-muted leading-relaxed">
                {garminSession?.connected
                  ? `Sesión activa (${garminSession.email}). Haz clic para reflejar tus rutas reales desde el 5 de agosto.`
                  : "Sincroniza tus salidas de Garmin Edge 130 de forma automática."}
              </p>
            </div>

            <button
              onClick={() => (garminSession?.connected ? handleQuickSync() : setIsGarminModalOpen(true))}
              disabled={syncing}
              className="w-full inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold py-3 rounded-xl transition shadow-lg shadow-cyan-600/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              <span>{syncing ? "Sincronizando..." : garminSession?.connected ? "Refrescar y Buscar Rutas" : "Conectar Garmin Connect"}</span>
            </button>
          </div>

          {/* AI Coach Widget */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-orange-500/20 space-y-4">
            <div className="space-y-2">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center space-x-2">
                <BrainCircuit className="w-4 h-4 text-orange-400" />
                <span>Entrenador AI FREERIDE</span>
              </h3>
              <p className="text-xs text-dark-muted leading-relaxed">
                Planificación adaptativa basada en tu carga (CTL/ATL/TSB) y perfil fisiológico real.
              </p>
            </div>

            <Link
              href="/coach"
              className="w-full inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold py-3 rounded-xl transition shadow-lg shadow-orange-500/20"
            >
              <BrainCircuit className="w-4 h-4" />
              <span>Consultar Entrenador AI</span>
            </Link>
          </div>
        </div>
      </div>

      <GarminSyncModal
        isOpen={isGarminModalOpen}
        onClose={() => setIsGarminModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
