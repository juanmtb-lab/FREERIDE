"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ActivityDetail, AIInsight } from "@/types/telemetry";
import { fetchActivityDetail, fetchActivityCoachInsight, deleteActivity } from "@/lib/api";
import { formatDistance, formatElevation, formatTime, formatSpeed, formatWatts } from "@/lib/utils";
import TelemetryCharts from "@/components/charts/TelemetryCharts";
import {
  Bike,
  Mountain,
  Gauge,
  Flame,
  Zap,
  Activity as HRIcon,
  BrainCircuit,
  Trash2,
  ArrowLeft,
  Calendar
} from "lucide-react";
import Link from "next/link";

export default function ActivityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const activityId = params.id as string;

  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (activityId) {
      fetchActivityDetail(activityId).then((data) => {
        setActivity(data);
        setLoading(false);
      });
    }
  }, [activityId]);

  const handleGenerateInsight = async () => {
    if (!activityId) return;
    setLoadingInsight(true);
    try {
      const data = await fetchActivityCoachInsight(activityId);
      setInsight(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInsight(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("¿Estás seguro de eliminar esta actividad?")) {
      await deleteActivity(activityId);
      router.push("/");
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-12 text-center text-dark-muted glass-panel rounded-3xl">
        Cargando telemetría real de Garmin...
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="max-w-7xl mx-auto p-12 text-center text-white glass-panel rounded-3xl space-y-4">
        <h2 className="text-xl font-bold">Actividad no encontrada</h2>
        <Link href="/" className="inline-block px-4 py-2 bg-dark-accent text-white font-bold rounded-xl text-xs">
          Volver al Inicio
        </Link>
      </div>
    );
  }

  const isMTB = activity.activity_type === 'MOUNTAIN_BIKE';

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center space-x-2 text-xs font-semibold text-dark-muted hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Panel</span>
        </Link>

        <button
          onClick={handleDelete}
          className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition"
          title="Eliminar actividad"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Activity Summary Title Banner */}
      <div className="glass-panel p-6 md:p-8 rounded-3xl space-y-4 border border-dark-border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                isMTB
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
              }`}>
                {isMTB ? 'MOUNTAIN BIKE' : 'CARRETERA'}
              </span>

              {isMTB && (
                <span className="text-xs text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  Técnico MTB: {activity.mtb_technical_score}/10
                </span>
              )}

              <span className="text-xs text-dark-muted flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(activity.start_time).toLocaleString('es-ES')}</span>
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-white">{activity.title}</h1>
          </div>
        </div>

        {/* Global Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t border-dark-border">
          <div>
            <p className="text-[11px] text-dark-muted font-medium">Distancia Real</p>
            <p className="text-xl font-bold text-white">{formatDistance(activity.total_distance_m)}</p>
          </div>

          <div>
            <p className="text-[11px] text-dark-muted font-medium">Desnivel Positivo</p>
            <p className="text-xl font-bold text-emerald-400">+{formatElevation(activity.elevation_gain_m)}</p>
          </div>

          <div>
            <p className="text-[11px] text-dark-muted font-medium">Tiempo Movimiento</p>
            <p className="text-xl font-bold text-white">{formatTime(activity.moving_time_sec)}</p>
          </div>

          <div>
            <p className="text-[11px] text-dark-muted font-medium">Velocidad Media</p>
            <p className="text-xl font-bold text-cyan-400">{formatSpeed(activity.avg_speed_kmh)}</p>
          </div>

          <div>
            <p className="text-[11px] text-dark-muted font-medium">Potencia Estimada</p>
            <p className="text-xl font-bold text-amber-400">{formatWatts(activity.normalized_power || activity.avg_watts_est || 0)}</p>
          </div>

          <div>
            <p className="text-[11px] text-dark-muted font-medium">Pulsaciones Med / Máx</p>
            <p className="text-xl font-bold text-rose-400">
              {activity.avg_hr ? `${activity.avg_hr} / ${activity.max_hr || '--'}` : '-- / --'} <span className="text-xs">bpm</span>
            </p>
          </div>
        </div>
      </div>

      {/* 2D Synchronized Telemetry Charts */}
      {activity.telemetry_points && activity.telemetry_points.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <HRIcon className="w-5 h-5 text-cyan-400" />
            <span>Gráficas Reales de Telemetría Sincronizadas</span>
          </h2>
          <TelemetryCharts
            points={activity.telemetry_points}
            hrZones={activity.hr_zone_distribution}
            onPointHover={(idx) => setActiveIndex(idx)}
          />
        </div>
      )}

      {/* Spanish AI Coach Insight Box */}
      <div className="glass-panel p-8 rounded-3xl border border-orange-500/30 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center space-x-3">
            <BrainCircuit className="w-6 h-6 text-orange-400" />
            <span>Análisis Fisiológico Entrenador AI FREERIDE</span>
          </h2>

          <button
            onClick={handleGenerateInsight}
            disabled={loadingInsight}
            className="px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl transition shadow-md shadow-orange-500/20 disabled:opacity-50"
          >
            {loadingInsight ? "Analizando telemetría real..." : "Generar Análisis AI"}
          </button>
        </div>

        {insight ? (
          <div className="prose prose-invert max-w-none text-sm text-dark-text leading-relaxed whitespace-pre-line bg-dark-bg/60 p-6 rounded-2xl border border-dark-border">
            {insight.content_es}
          </div>
        ) : (
          <div className="text-center py-6 text-dark-muted text-xs">
            Haz clic en "Generar Análisis AI" para obtener feedback fisiológico real de tu salida en español.
          </div>
        )}
      </div>
    </div>
  );
}
