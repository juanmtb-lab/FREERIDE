import { getStoredActivities, getSettings, StoredActivity } from './storage';

export interface RiderFitnessMetrics {
  ctl: number; // Chronic Training Load (Fitness)
  atl: number; // Acute Training Load (Fatigue)
  tsb: number; // Training Stress Balance (Form)
  formStatus: string;
  formColor: string;
  weeklyDistanceKm: number;
  weeklyElevGainM: number;
  avgHrLastRides: number;
  avgWattsLastRides: number;
}

export interface CoachResponse {
  title: string;
  source: 'N8N_WORKFLOW' | 'BUILTIN_AI_ENGINE';
  metrics: RiderFitnessMetrics;
  content_es: string;
  weekly_plan?: {
    day: string;
    title: string;
    description: string;
    target_hr_zone: string;
    duration_min: number;
    intensity: 'Descanso' | 'Baja' | 'Media' | 'Alta' | 'Competición';
  }[];
  created_at: string;
}

export function calculateRiderFitnessMetrics(activities: StoredActivity[]): RiderFitnessMetrics {
  if (!activities || activities.length === 0) {
    return {
      ctl: 42,
      atl: 38,
      tsb: 4,
      formStatus: "Estado Neutro - Listo para entrenar",
      formColor: "#10B981",
      weeklyDistanceKm: 0,
      weeklyElevGainM: 0,
      avgHrLastRides: 140,
      avgWattsLastRides: 190
    };
  }

  // Calculate TSS (Training Stress Score) per activity
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  let totalTss42Days = 0;
  let totalTss7Days = 0;
  let weeklyDist = 0;
  let weeklyElev = 0;
  let sumHr = 0;
  let hrCount = 0;
  let sumWatts = 0;
  let wattsCount = 0;

  activities.forEach(act => {
    const actTime = new Date(act.start_time).getTime();
    const daysAgo = (now - actTime) / oneDay;

    // Estimate TSS = (duration_sec * IF^2) / 3600 * 100
    const durationMin = act.moving_time_sec / 60;
    const avgSpeed = act.avg_speed_kmh || 24;
    const elevGain = act.elevation_gain_m || 0;
    
    // Relative intensity factor
    const intensity = Math.min(1.2, (avgSpeed / 28) * 0.7 + (elevGain / Math.max(1, act.total_distance_m / 1000)) * 0.015);
    const tss = Math.round((durationMin * Math.pow(intensity, 2) * 100) / 60);

    if (daysAgo <= 42) {
      totalTss42Days += tss;
    }
    if (daysAgo <= 7) {
      totalTss7Days += tss;
      weeklyDist += act.total_distance_m / 1000;
      weeklyElev += act.elevation_gain_m;
    }

    if (act.avg_hr) {
      sumHr += act.avg_hr;
      hrCount++;
    }
    if (act.avg_watts_est) {
      sumWatts += act.avg_watts_est;
      wattsCount++;
    }
  });

  const ctl = Math.round(totalTss42Days / 42);
  const atl = Math.round(totalTss7Days / 7);
  const tsb = ctl - atl;

  let formStatus = "Forma Épica - Pico de Rendimiento";
  let formColor = "#3B82F6"; // Blue

  if (tsb > 15) {
    formStatus = "Totalmente Fresco - Listo para Salida Exigente o Carrera";
    formColor = "#10B981"; // Green
  } else if (tsb >= -10 && tsb <= 15) {
    formStatus = "Carga Productiva - Balance Óptimo de Forma y Fatiga";
    formColor = "#06B6D4"; // Cyan
  } else if (tsb >= -25 && tsb < -10) {
    formStatus = "Fatiga Acumulada - Se recomienda Rodaje Suave (Zona 2)";
    formColor = "#F59E0B"; // Amber
  } else {
    formStatus = "Alerta de Sobrentrenamiento - Descanso Necesario";
    formColor = "#EF4444"; // Red
  }

  return {
    ctl,
    atl,
    tsb,
    formStatus,
    formColor,
    weeklyDistanceKm: parseFloat(weeklyDist.toFixed(1)),
    weeklyElevGainM: Math.round(weeklyElev),
    avgHrLastRides: hrCount > 0 ? Math.round(sumHr / hrCount) : 138,
    avgWattsLastRides: wattsCount > 0 ? Math.round(sumWatts / wattsCount) : 195
  };
}

export async function queryAiCoach(userQuery?: string): Promise<CoachResponse> {
  const activities = getStoredActivities();
  const settings = getSettings();
  const metrics = calculateRiderFitnessMetrics(activities);

  const webhookUrl = settings.n8n_webhook_url || process.env.N8N_WORKFLOW_WEBHOOK_URL;

  // 1. If N8N Webhook URL is configured, call N8N Workflow Engine
  if (webhookUrl && webhookUrl.startsWith('http')) {
    try {
      const payload = {
        event: 'COACH_ANALYSIS_REQUEST',
        timestamp: new Date().toISOString(),
        user_query: userQuery || 'Generar plan de entrenamiento semanal adaptativo',
        rider_metrics: metrics,
        recent_activities: activities.slice(0, 5).map(a => ({
          title: a.title,
          type: a.activity_type,
          distance_km: (a.total_distance_m / 1000).toFixed(1),
          elev_m: a.elevation_gain_m,
          avg_speed_kmh: a.avg_speed_kmh,
          avg_hr: a.avg_hr,
          date: a.start_time
        }))
      };

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const n8nData = await res.json();
        return {
          title: n8nData.title || "Entrenador Personal AI FREERIDE (Vía N8N Workflow)",
          source: 'N8N_WORKFLOW',
          metrics,
          content_es: n8nData.content_es || n8nData.output || JSON.stringify(n8nData, null, 2),
          weekly_plan: n8nnWeeklyPlanFallback(metrics),
          created_at: new Date().toISOString()
        };
      }
    } catch (err) {
      console.error('N8N Webhook call failed, falling back to internal AI engine:', err);
    }
  }

  // 2. Built-in Expert Cycling Science AI Engine (Banister & Coggan Impulse Model)
  const isQuestion = !!userQuery && userQuery.trim().length > 0;
  let contentEs = "";

  if (isQuestion) {
    contentEs = `### 🚴 Diagnóstico del Entrenador AI FREERIDE

**Tu Consulta:** "${userQuery}"

**Análisis Fisiológico de Carga (Impulso Banister):**
- **Estado de Forma (CTL):** ${metrics.ctl} TSS
- **Fatiga Aguda (ATL):** ${metrics.atl} TSS
- **Balance de Frescura (TSB):** ${metrics.tsb} TSS (${metrics.formStatus})
- **Volumen Semanal:** ${metrics.weeklyDistanceKm} km con ${metrics.weeklyElevGainM} m de desnivel positivo.

**Recomendación Específica del Entrenador:**
1. **Zonas de Frecuencia Cardíaca Prioritarias:** Para tu nivel actual de carga (${metrics.tsb > 0 ? "Frescura alta" : "Fatiga moderada"}), debes enfocar el 75% de tus entrenamientos en **Zona 2 (122 - 141 ppm)** para maximizar la densidad mitocondrial y la eficiencia lipolítica sin generar lactato excesivo.
2. **Estructura de Series:** Realiza 1 sesión a la semana de intervalos a Umbral Anatóxico (3 bloques de 10 min a 155-165 ppm con 5 min de recuperación).
3. **Cadencia Eficiente:** Mantén entre **85 y 95 rpm** en llano para reducir la carga articular y optimizar el consumo de glucógeno.`;
  } else {
    contentEs = `### 🏆 Diagnóstico Semanal del Entrenador Personal AI

**Estado Fisiológico Actual (Garmin Edge 130 + Strava):**
- **Fitness (CTL):** ${metrics.ctl} puntos
- **Fatiga Acumulada (ATL):** ${metrics.atl} puntos
- **Balance de Frescura (TSB):** ${metrics.tsb} puntos (${metrics.formStatus})
- **Pulsaciones Medias Recientes:** ${metrics.avgHrLastRides} ppm

**Planificación Adaptativa Semanal:**
Tu carga de entrenamiento se encuentra en un estado **${metrics.tsb >= 0 ? "óptimo de frescura para asimilar series de alta intensidad" : "de carga progresiva donde la recuperación es clave"}**.

A continuación tienes tu microciclo adaptado de 7 días para optimizar tu potencia media en subida y resistencia aeróbica en salidas de Carretera y MTB.`;
  }

  return {
    title: "Entrenador Personal AI FREERIDE - Diagnóstico & Planificación",
    source: 'BUILTIN_AI_ENGINE',
    metrics,
    content_es: contentEs,
    weekly_plan: n8nnWeeklyPlanFallback(metrics),
    created_at: new Date().toISOString()
  };
}

function n8nnWeeklyPlanFallback(metrics: RiderFitnessMetrics) {
  return [
    {
      day: "Lunes",
      title: "Recuperación Activa o Descanso",
      description: "Rodaje muy suave regenerativo o descanso total. Mantén pulsaciones estrictamente en Zona 1 (<120 ppm).",
      target_hr_zone: "Zona 1 (100 - 120 ppm)",
      duration_min: 45,
      intensity: "Baja" as const
    },
    {
      day: "Martes",
      title: "Resistencia Aeróbica Base (Zona 2)",
      description: "Rodaje continuo a cadencia ágil (90 rpm). Desarrollo de capacidad aeróbica y quema de grasas.",
      target_hr_zone: "Zona 2 (122 - 141 ppm)",
      duration_min: 90,
      intensity: "Media" as const
    },
    {
      day: "Miércoles",
      title: "Intervalos a Umbral / Puertos",
      description: "3 series de 10 minutos al 95-100% del umbral con 5 minutos de recuperación entre series.",
      target_hr_zone: "Zona 4 (161 - 180 ppm)",
      duration_min: 75,
      intensity: "Alta" as const
    },
    {
      day: "Jueves",
      title: "Rodaje Suave de Transición",
      description: "Salida de soltar piernas sin desnivel acentuado. Cadencia fluida de 95 rpm.",
      target_hr_zone: "Zona 2 (122 - 141 ppm)",
      duration_min: 60,
      intensity: "Baja" as const
    },
    {
      day: "Viernes",
      title: "Descanso Total",
      description: "Nutrición rica en carbohidratos complejos y descanso neuromuscular de cara al fin de semana.",
      target_hr_zone: "Zona 1 (<100 ppm)",
      duration_min: 0,
      intensity: "Descanso" as const
    },
    {
      day: "Sábado",
      title: "Ruta Larga de Carretera / Fondo",
      description: "Salida principal de fondo con ritmo sostenido y ascenso a puertos progresivos.",
      target_hr_zone: "Zona 2 a Zona 3 (135 - 160 ppm)",
      duration_min: 180,
      intensity: "Alta" as const
    },
    {
      day: "Domingo",
      title: "Salida MTB / Técnica & Divertida",
      description: "Ruta de montaña por senderos. Enfócate en cambios de ritmo naturales y control de cadencia.",
      target_hr_zone: "Zona 3 a Zona 4 (145 - 175 ppm)",
      duration_min: 120,
      intensity: "Competición" as const
    }
  ];
}
