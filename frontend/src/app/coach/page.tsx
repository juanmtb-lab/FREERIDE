"use client";

import { useState } from "react";
import { fetchWeeklyPlan } from "@/lib/api";
import { AIInsight } from "@/types/telemetry";
import { BrainCircuit, Calendar, Flame, RefreshCw, Zap, ShieldCheck } from "lucide-react";

export default function CoachPage() {
  const [plan, setPlan] = useState<AIInsight | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGeneratePlan = async () => {
    setLoading(true);
    try {
      const data = await fetchWeeklyPlan();
      setPlan(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Banner */}
      <div className="glass-panel p-8 rounded-3xl bg-gradient-to-r from-dark-card via-dark-card to-orange-950/30 border border-orange-500/20 space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
            <BrainCircuit className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Entrenador Virtual FREERIDE</h1>
            <p className="text-xs text-dark-muted">Optimización de Carga (CTL/ATL/TSB) y Planes Semanales en Español</p>
          </div>
        </div>

        <p className="text-sm text-dark-muted max-w-3xl leading-relaxed">
          Basado en tu volumen de entrenamiento histórico, variabilidad de cadencia y zonas de frecuencia cardíaca de Garmin Edge 130, el Entrenador AI evalúa tu estado de forma y fatiga para sugerirte entrenamientos adaptativos.
        </p>

        <button
          onClick={handleGeneratePlan}
          disabled={loading}
          className="inline-flex items-center space-x-2 px-6 py-3.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-orange-600/20 disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Generando plan adaptativo...</span>
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4" />
              <span>Generar Plan Semanal Personalizado</span>
            </>
          )}
        </button>
      </div>

      {/* Plan Output */}
      {plan ? (
        <div className="glass-panel p-8 rounded-3xl border border-dark-border space-y-4">
          <div className="flex items-center justify-between border-b border-dark-border pb-4">
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <span>{plan.title}</span>
            </h2>
            <span className="text-xs text-dark-muted">
              Generado: {new Date(plan.created_at).toLocaleTimeString('es-ES')}
            </span>
          </div>

          <div className="prose prose-invert max-w-none text-sm text-dark-text leading-relaxed whitespace-pre-line bg-dark-bg/60 p-6 rounded-2xl border border-dark-border">
            {plan.content_es}
          </div>
        </div>
      ) : (
        <div className="glass-panel p-12 text-center rounded-3xl space-y-3">
          <Zap className="w-12 h-12 text-dark-muted mx-auto" />
          <h3 className="text-base font-bold text-white">Ningún plan activo para esta semana</h3>
          <p className="text-xs text-dark-muted max-w-md mx-auto">
            Haz clic en el botón superior para calcular tu balance de entrenamiento (TSB) y estructurar los días de base, series y recuperación.
          </p>
        </div>
      )}
    </div>
  );
}
