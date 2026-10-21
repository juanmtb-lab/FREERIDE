import { getStoredActivities, getSettings, StoredActivity } from './storage';
import { AIInsight } from '@/types/telemetry';

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
      ctl: 0,
      atl: 0,
      tsb: 0,
      formStatus: 'Sincroniza Garmin Connect para calcular tu carga',
      formColor: '#10B981',
      weeklyDistanceKm: 0,
      weeklyElevGainM: 0,
      avgHrLastRides: 0,
      avgWattsLastRides: 0
    };
  }

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
    const daysAgo = Math.max(0, (now - actTime) / oneDay);

    const durationMin = act.moving_time_sec / 60;
    const avgSpeed = act.avg_speed_kmh || 24;
    const elevGain = act.elevation_gain_m || 0;

    const intensity = Math.min(
      1.2,
      (avgSpeed / 28) * 0.7 + (elevGain / Math.max(1, act.total_distance_m / 1000)) * 0.015
    );
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

  let formStatus = 'Forma Épica - Pico de Rendimiento';
  let formColor = '#3B82F6';

  if (tsb > 15) {
    formStatus = 'Totalmente Fresco - Listo para Salida Exigente';
    formColor = '#10B981';
  } else if (tsb >= -10 && tsb <= 15) {
    formStatus = 'Carga Productiva - Balance Óptimo de Forma y Fatiga';
    formColor = '#06B6D4';
  } else if (tsb >= -25 && tsb < -10) {
    formStatus = 'Fatiga Acumulada - Se recomienda Rodaje Suave (Zona 2)';
    formColor = '#F59E0B';
  } else {
    formStatus = 'Alerta de Sobrentrenamiento - Descanso Necesario';
    formColor = '#EF4444';
  }

  return {
    ctl,
    atl,
    tsb,
    formStatus,
    formColor,
    weeklyDistanceKm: parseFloat(weeklyDist.toFixed(1)),
    weeklyElevGainM: Math.round(weeklyElev),
    avgHrLastRides: hrCount > 0 ? Math.round(sumHr / hrCount) : 0,
    avgWattsLastRides: wattsCount > 0 ? Math.round(sumWatts / wattsCount) : 0
  };
}

export async function analyzeSingleActivityWithCoach(activity: StoredActivity): Promise<AIInsight> {
  const settings = getSettings();
  const webhookUrl = settings.n8n_webhook_url || process.env.N8N_WORKFLOW_WEBHOOK_URL;

  const distKm = (activity.total_distance_m / 1000).toFixed(2);
  const durMin = Math.round(activity.moving_time_sec / 60);
  const hrText = activity.avg_hr
    ? `${activity.avg_hr} bpm (Máx: ${activity.max_hr || '--'} bpm)`
    : 'No registrado';
  const z = activity.hr_zone_distribution || {};

  if (webhookUrl && webhookUrl.startsWith('http')) {
    try {
      const payload = {
        event: 'SINGLE_ACTIVITY_ANALYSIS',
        timestamp: new Date().toISOString(),
        activity: {
          id: activity.id,
          title: activity.title,
          type: activity.activity_type,
          start_time: activity.start_time,
          distance_km: Number(distKm),
          moving_time_min: durMin,
          elevation_gain_m: activity.elevation_gain_m,
          avg_speed_kmh: activity.avg_speed_kmh,
          max_speed_kmh: activity.max_speed_kmh,
          avg_hr: activity.avg_hr,
          max_hr: activity.max_hr,
          avg_cadence: activity.avg_cadence,
          hr_zones: z
        }
      };

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const n8nData = await res.json();
        return {
          id: `insight-${activity.id}`,
          user_id: activity.user_id,
          activity_id: activity.id,
          insight_type: 'N8N_ACTIVITY_ANALYSIS',
          title: n8nData.title || `Análisis Fisiológico N8N: ${activity.title}`,
          content_es: n8nData.content_es || n8nData.output || JSON.stringify(n8nData, null, 2),
          created_at: new Date().toISOString()
        };
      }
    } catch (err) {
      console.error('N8N activity analysis webhook error, using internal engine:', err);
    }
  }

  const zonesSummary =
    Object.keys(z).length > 0
      ? `Z1: ${z.Z1 ?? z.z1 ?? 0}% | Z2: ${z.Z2 ?? z.z2 ?? 0}% | Z3: ${z.Z3 ?? z.z3 ?? 0}% | Z4: ${z.Z4 ?? z.z4 ?? 0}% | Z5: ${z.Z5 ?? z.z5 ?? 0}%`
      : 'Calculado según frecuencia cardíaca media y máxima';

  const z4z5 = (Number(z.Z4 ?? z.z4 ?? 0) + Number(z.Z5 ?? z.z5 ?? 0));
  const recoveryAdvice =
    z4z5 > 25
      ? 'Sesión de alta exigencia glucolítica (>25% en Z4-Z5). Se recomienda 24-36h de rodaje regenerativo en Zona 1/2 y reposición de 1.2g/kg de carbohidratos.'
      : 'Carga aeróbica controlada predominantemente en Zonas 2 y 3. Excelente estímulo oxidativo; mañana puedes afrontar una sesión de intensidad o fondo sin fatiga residual excesiva.';

  const contentEs = `📋 Diagnóstico Fisiológico de la Salida: "${activity.title}"

• Distancia y Duración Real (Strava): ${distKm} km en ${durMin} minutos (${activity.avg_speed_kmh} km/h media, máx ${activity.max_speed_kmh} km/h).
• Desnivel Acumulado: +${activity.elevation_gain_m} m (${Math.round(activity.elevation_gain_m / Math.max(1, Number(distKm)))} m/km de ratio vertical).
• Respuesta Cardíaca: ${hrText}${activity.avg_cadence ? ` | Cadencia media: ${activity.avg_cadence} rpm` : ''}.
• Distribución en Zonas Strava: ${zonesSummary}.

💡 Recomendación del Entrenador AI:
${recoveryAdvice}`;

  return {
    id: `insight-${activity.id}`,
    user_id: activity.user_id,
    activity_id: activity.id,
    insight_type: 'ACTIVITY_ANALYSIS',
    title: `Análisis Fisiológico: ${activity.title}`,
    content_es: contentEs,
    created_at: new Date().toISOString()
  };
}

export async function queryAiCoach(userQuery?: string): Promise<CoachResponse> {
  const activities = getStoredActivities();
  const settings = getSettings();
  const metrics = calculateRiderFitnessMetrics(activities);

  const webhookUrl = settings.n8n_webhook_url || process.env.N8N_WORKFLOW_WEBHOOK_URL;

  if (webhookUrl && webhookUrl.startsWith('http')) {
    try {
      const payload = {
        event: 'COACH_ANALYSIS_REQUEST',
        timestamp: new Date().toISOString(),
        user_query: userQuery || 'Generar plan de entrenamiento semanal adaptativo',
        rider_metrics: metrics,
        recent_activities: activities.slice(0, 15).map(a => ({
          id: a.id,
          title: a.title,
          type: a.activity_type,
          distance_km: (a.total_distance_m / 1000).toFixed(1),
          elev_m: a.elevation_gain_m,
          avg_speed_kmh: a.avg_speed_kmh,
          avg_hr: a.avg_hr,
          max_hr: a.max_hr,
          avg_cadence: a.avg_cadence,
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
          title: n8nData.title || 'Entrenador Personal AI FREERIDE (Vía N8N Workflow)',
          source: 'N8N_WORKFLOW',
          metrics,
          content_es: n8nData.content_es || n8nData.output || JSON.stringify(n8nData, null, 2),
          weekly_plan: n8nData.weekly_plan || n8nnWeeklyPlanFallback(metrics),
          created_at: new Date().toISOString()
        };
      }
    } catch (err) {
      console.error('N8N Webhook call failed, falling back to internal AI engine:', err);
    }
  }

  const isQuestion = !!userQuery && userQuery.trim().length > 0;
  let contentEs = '';

  if (isQuestion) {
    contentEs = `### 🚴 Diagnóstico del Entrenador AI FREERIDE

**Tu Consulta:** "${userQuery}"

**Análisis Fisiológico de Carga (Historial Real de Strava):**
- **Estado de Forma (CTL):** ${metrics.ctl} TSS
- **Fatiga Aguda (ATL):** ${metrics.atl} TSS
- **Balance de Frescura (TSB):** ${metrics.tsb} TSS (${metrics.formStatus})
- **Volumen Reciente (7 días):** ${metrics.weeklyDistanceKm} km con +${metrics.weeklyElevGainM} m de desnivel positivo.

**Recomendación Específica del Entrenador:**
1. **Zonas de Frecuencia Cardíaca Prioritarias:** Según tu historial de Strava (${metrics.avgHrLastRides > 0 ? `media reciente de ${metrics.avgHrLastRides} bpm` : 'sensor cardíaco'}), mantén el 75% del volumen semanal en **Zona 2** para optimizar la base aeróbica sin disparar la fatiga aguda (ATL).
2. **Estructura de Series:** Incluye 1 sesión semanal de intervalos en Zona 4 (3 bloques de 10 min al umbral con 5 min de recuperación activa en Zona 1).
3. **Cadencia Eficiente:** Mantén entre **85 y 92 rpm** en llano y >75 rpm en subida para proteger la musculatura e incrementar la eficiencia mecánica.`;
  } else {
    contentEs = `### 🏆 Diagnóstico Semanal del Entrenador Personal AI

**Estado Fisiológico Actual (Strava API v3):**
- **Fitness (CTL):** ${metrics.ctl} puntos
- **Fatiga Acumulada (ATL):** ${metrics.atl} puntos
- **Balance de Frescura (TSB):** ${metrics.tsb} puntos (${metrics.formStatus})
- **Pulsaciones Medias Recientes:** ${metrics.avgHrLastRides > 0 ? `${metrics.avgHrLastRides} bpm` : 'Sincronizado con Strava'}
- **Total Actividades Analizadas:** ${activities.length} entrenamientos reales

**Planificación Adaptativa Semanal:**
Tu carga de entrenamiento se encuentra en un estado **${metrics.tsb >= 0 ? 'óptimo de frescura para asimilar series de intensidad' : 'de carga acumulada donde priorizar la Zona 2 y el descanso es clave'}**.`;
  }

  return {
    title: 'Entrenador Personal AI FREERIDE - Diagnóstico & Planificación',
    source: 'BUILTIN_AI_ENGINE',
    metrics,
    content_es: contentEs,
    weekly_plan: n8nnWeeklyPlanFallback(metrics),
    created_at: new Date().toISOString()
  };
}

function n8nnWeeklyPlanFallback(_metrics: RiderFitnessMetrics) {
  return [
    {
      day: 'Lunes',
      title: 'Recuperación Activa o Descanso',
      description: 'Rodaje muy suave regenerativo o descanso total. Mantén pulsaciones estrictamente en Zona 1 (<120 bpm).',
      target_hr_zone: 'Zona 1 (100 - 120 bpm)',
      duration_min: 45,
      intensity: 'Baja' as const
    },
    {
      day: 'Martes',
      title: 'Resistencia Aeróbica Base (Zona 2)',
      description: 'Rodaje continuo a cadencia ágil (88-92 rpm). Desarrollo de capacidad aeróbica y eficiencia lipolítica.',
      target_hr_zone: 'Zona 2 (122 - 142 bpm)',
      duration_min: 90,
      intensity: 'Media' as const
    },
    {
      day: 'Miércoles',
      title: 'Intervalos a Umbral / Subida',
      description: '3 series de 10 minutos al 95-100% del umbral anaeróbico con 5 minutos de recuperación entre series.',
      target_hr_zone: 'Zona 4 (160 - 175 bpm)',
      duration_min: 75,
      intensity: 'Alta' as const
    },
    {
      day: 'Jueves',
      title: 'Rodaje Suave de Transición',
      description: 'Salida para soltar piernas en terreno llano. Cadencia fluida sin superar Zona 2.',
      target_hr_zone: 'Zona 2 (120 - 138 bpm)',
      duration_min: 60,
      intensity: 'Baja' as const
    },
    {
      day: 'Viernes',
      title: 'Descanso Total',
      description: 'Hidratación, carga de carbohidratos complejos y descanso neuromuscular previo al fin de semana.',
      target_hr_zone: 'Descanso',
      duration_min: 0,
      intensity: 'Descanso' as const
    },
    {
      day: 'Sábado',
      title: 'Ruta de Fondo en Carretera',
      description: 'Salida principal de fondo con ritmo sostenido en llano y progresivo en ascensiones.',
      target_hr_zone: 'Zona 2 a Zona 3 (135 - 158 bpm)',
      duration_min: 150,
      intensity: 'Alta' as const
    },
    {
      day: 'Domingo',
      title: 'Salida MTB / Técnica & Cambios de Ritmo',
      description: 'Ruta por montaña o terreno variado trabajando control técnico y estímulos cortos.',
      target_hr_zone: 'Zona 3 a Zona 4 (145 - 172 bpm)',
      duration_min: 120,
      intensity: 'Competición' as const
    }
  ];
}
