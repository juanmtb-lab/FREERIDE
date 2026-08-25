"use client";

import { useEffect, useState } from "react";
import { CoachResponse, RiderFitnessMetrics } from "@/lib/n8n_coach";
import { BrainCircuit, Calendar, RefreshCw, Zap, ShieldCheck, MessageSquare, Send, Workflow, Flame, Activity, Sparkles, CheckCircle2, ChevronRight } from "lucide-react";
import N8nConfigModal from "@/components/coach/N8nConfigModal";

export default function CoachPage() {
  const [coachData, setCoachData] = useState<CoachResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [isN8nModalOpen, setIsN8nModalOpen] = useState(false);

  // Interactive AI Coach Chat State
  const [userQuery, setUserQuery] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'coach'; text: string; time: string }[]>([]);

  const loadCoachData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/coach/plan");
      if (res.ok) {
        const data = await res.json();
        setCoachData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoachData();
  }, []);

  const handleAskCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim()) return;

    const queryText = userQuery;
    setUserQuery("");

    const nowStr = new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' });
    setChatMessages(prev => [...prev, { role: 'user', text: queryText, time: nowStr }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/v1/coach/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryText })
      });

      if (res.ok) {
        const data: CoachResponse = await res.json();
        setCoachData(data);
        setChatMessages(prev => [...prev, {
          role: 'coach',
          text: data.content_es,
          time: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  const metrics: RiderFitnessMetrics = coachData?.metrics || {
    ctl: 45,
    atl: 38,
    tsb: 7,
    formStatus: "Carga Productiva - Balance Óptimo",
    formColor: "#06B6D4",
    weeklyDistanceKm: 36.2,
    weeklyElevGainM: 170,
    avgHrLastRides: 138,
    avgWattsLastRides: 195
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* 1. Header Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-dark-card via-dark-card to-orange-950/40 border border-orange-500/30 space-y-5 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30">
              <BrainCircuit className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white">Entrenador Personal AI FREERIDE</h1>
                <span className="bg-orange-500/20 text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-500/30">
                  {coachData?.source === 'N8N_WORKFLOW' ? 'Engine: N8N Workflow' : 'Engine: Cycling Science AI'}
                </span>
              </div>
              <p className="text-xs text-dark-muted">Optimización fisiológica de carga (CTL / ATL / TSB) y seguimiento adaptativo</p>
            </div>
          </div>

          <button
            onClick={() => setIsN8nModalOpen(true)}
            className="self-start sm:self-auto flex items-center space-x-2 bg-dark-bg hover:bg-dark-border text-orange-400 border border-orange-500/30 text-xs font-semibold px-4 py-2.5 rounded-xl transition"
          >
            <Workflow className="w-4 h-4" />
            <span>Configurar Workflow N8N</span>
          </button>
        </div>

        <p className="text-xs sm:text-sm text-dark-muted max-w-3xl leading-relaxed">
          Tu entrenador personal analiza en tiempo real la telemetría de tu <strong className="text-white">Garmin Edge 130</strong> y tus rutas de <strong className="text-white">Strava Premium</strong>. Calcula tu fatiga acumulada, previene lesiones por sobrentrenamiento y diseña entrenamientos específicos para tus salidas de Carretera y MTB.
        </p>
      </div>

      {/* 2. Physiological Fitness & Load Dashboard (CTL / ATL / TSB) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Fitness CTL */}
        <div className="glass-panel p-5 rounded-2xl border border-dark-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-dark-muted font-medium">Estado de Forma (CTL)</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">{metrics.ctl} <span className="text-xs text-dark-muted font-normal">TSS</span></p>
          <div className="w-full bg-dark-bg h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, (metrics.ctl / 80) * 100)}%` }}></div>
          </div>
          <p className="text-[10px] text-dark-muted">Carga Crónica de 42 días</p>
        </div>

        {/* Fatigue ATL */}
        <div className="glass-panel p-5 rounded-2xl border border-dark-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-dark-muted font-medium">Fatiga Acumulada (ATL)</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">{metrics.atl} <span className="text-xs text-dark-muted font-normal">TSS</span></p>
          <div className="w-full bg-dark-bg h-1.5 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, (metrics.atl / 80) * 100)}%` }}></div>
          </div>
          <p className="text-[10px] text-dark-muted">Carga Aguda de 7 días</p>
        </div>

        {/* Form TSB */}
        <div className="glass-panel p-5 rounded-2xl border border-dark-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-dark-muted font-medium">Frescura / Form (TSB)</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">
            {metrics.tsb > 0 ? `+${metrics.tsb}` : metrics.tsb} <span className="text-xs text-dark-muted font-normal">TSS</span>
          </p>
          <p className="text-[11px] font-bold truncate" style={{ color: metrics.formColor }}>
            {metrics.formStatus}
          </p>
          <p className="text-[10px] text-dark-muted">CTL - ATL Balance</p>
        </div>

        {/* Weekly Volume */}
        <div className="glass-panel p-5 rounded-2xl border border-dark-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-dark-muted font-medium">Volumen Semanal</span>
            <Calendar className="w-4 h-4 text-orange-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">{metrics.weeklyDistanceKm} <span className="text-xs text-dark-muted font-normal">km</span></p>
          <p className="text-[11px] text-emerald-400 font-medium">+{metrics.weeklyElevGainM} m desnivel</p>
          <p className="text-[10px] text-dark-muted">Media HR: {metrics.avgHrLastRides} ppm</p>
        </div>
      </div>

      {/* 3. Interactive AI Personal Coach Assistant */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-dark-border space-y-6">
        <div className="flex items-center justify-between border-b border-dark-border pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Consultar a tu Entrenador AI</h2>
              <p className="text-xs text-dark-muted">Hazle cualquier pregunta sobre tu ritmo, alimentación o entrenamiento de hoy</p>
            </div>
          </div>

          <button
            onClick={loadCoachData}
            disabled={loading}
            className="p-2 text-dark-muted hover:text-white bg-dark-bg rounded-xl border border-dark-border transition"
            title="Recargar diagnóstico"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-400" : ""}`} />
          </button>
        </div>

        {/* Chat Conversation History */}
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {/* Initial Diagnosis */}
          {coachData && (
            <div className="bg-dark-bg/80 p-5 rounded-2xl border border-dark-border space-y-2">
              <div className="flex items-center space-x-2 text-xs text-orange-400 font-bold">
                <Sparkles className="w-4 h-4" />
                <span>{coachData.title}</span>
              </div>
              <div className="prose prose-invert max-w-none text-xs sm:text-sm text-dark-text leading-relaxed whitespace-pre-line">
                {coachData.content_es}
              </div>
            </div>
          )}

          {/* Interactive Chat Messages */}
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl text-xs sm:text-sm max-w-3xl space-y-1 ${
                msg.role === 'user'
                  ? "bg-orange-600/20 border border-orange-500/30 text-white ml-auto"
                  : "bg-dark-bg/90 border border-dark-border text-dark-text mr-auto"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-dark-muted mb-1">
                <span className="font-bold">{msg.role === 'user' ? "Tú" : "Entrenador AI FREERIDE"}</span>
                <span>{msg.time}</span>
              </div>
              <div className="whitespace-pre-line leading-relaxed">{msg.text}</div>
            </div>
          ))}

          {chatLoading && (
            <div className="p-4 bg-dark-bg/90 rounded-2xl border border-dark-border text-xs text-orange-400 flex items-center space-x-2 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>El Entrenador AI está procesando tus datos telemetricos y preparando tu respuesta...</span>
            </div>
          )}
        </div>

        {/* Input Query Form */}
        <form onSubmit={handleAskCoach} className="flex items-center space-x-3 pt-2">
          <input
            type="text"
            placeholder="Ej: ¿Qué entreno debo hacer hoy? / ¿Cómo gestiono los puertos en la ruta del sábado?"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            className="flex-1 bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-dark-muted focus:outline-none focus:border-orange-500"
          />

          <button
            type="submit"
            disabled={chatLoading || !userQuery.trim()}
            className="px-5 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-orange-600/20 disabled:opacity-50 flex items-center space-x-2"
          >
            <span>Enviar</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
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
              <p className="text-xs text-dark-muted">Programación personalizada en función de tu balance de frescura (TSB)</p>
            </div>
          </div>

          <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
            Fase: Base & Umbral
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coachData?.weekly_plan?.map((workout, idx) => (
            <div key={idx} className="bg-dark-bg/60 p-4 rounded-2xl border border-dark-border space-y-3 hover:border-orange-500/40 transition group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-orange-400 uppercase tracking-wider">{workout.day}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  workout.intensity === 'Descanso' ? 'bg-dark-border text-dark-muted' :
                  workout.intensity === 'Baja' ? 'bg-blue-500/20 text-blue-400' :
                  workout.intensity === 'Media' ? 'bg-emerald-500/20 text-emerald-400' :
                  workout.intensity === 'Alta' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {workout.intensity}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-orange-400 transition-colors">{workout.title}</h3>
                <p className="text-xs text-dark-muted mt-1 leading-relaxed">{workout.description}</p>
              </div>

              <div className="pt-2 border-t border-dark-border/60 flex items-center justify-between text-[11px]">
                <span className="text-dark-muted font-medium">{workout.target_hr_zone}</span>
                <span className="font-bold text-white">{workout.duration_min > 0 ? `${workout.duration_min} min` : "Descanso"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <N8nConfigModal
        isOpen={isN8nModalOpen}
        onClose={() => setIsN8nModalOpen(false)}
        onSaved={() => loadCoachData()}
      />
    </div>
  );
}
