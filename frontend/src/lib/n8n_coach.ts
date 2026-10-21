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
  // Historical Training Profile across all Strava activities
  totalActivities?: number;
  riderProfileType?: string;
  dominantDiscipline?: string;
  avgDistanceKm?: number;
  maxDistanceKm?: number;
  avgElevationM?: number;
  maxElevationM?: number;
  elevRatioMPerKm?: number;
  avgSpeedKmh?: number;
  maxObservedHr?: number;
  avgCadenceRpm?: number;
  ridesPerWeekAvg?: number;
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
      formStatus: 'Sincroniza Strava para analizar tu perfil de entrenamiento',
      formColor: '#10B981',
      weeklyDistanceKm: 0,
      weeklyElevGainM: 0,
      avgHrLastRides: 0,
      avgWattsLastRides: 0,
      totalActivities: 0,
      riderProfileType: 'Pendiente de sincronizar historial Strava',
      dominantDiscipline: 'Sin datos',
      avgDistanceKm: 0,
      maxDistanceKm: 0,
      avgElevationM: 0,
      maxElevationM: 0,
      elevRatioMPerKm: 0,
      avgSpeedKmh: 0,
      maxObservedHr: 0,
      avgCadenceRpm: 0,
      ridesPerWeekAvg: 0
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
  let maxObservedHr = 0;
  let sumWatts = 0;
  let wattsCount = 0;
  let sumCadence = 0;
  let cadenceCount = 0;

  let totalDistKm = 0;
  let maxDistKm = 0;
  let totalElevM = 0;
  let maxElevM = 0;
  let sumSpeed = 0;
  let speedCount = 0;
  let mtbCount = 0;
  let roadCount = 0;

  let oldestTime = now;
  let newestTime = 0;

  activities.forEach(act => {
    const actTime = new Date(act.start_time).getTime();
    if (actTime < oldestTime) oldestTime = actTime;
    if (actTime > newestTime) newestTime = actTime;

    const daysAgo = Math.max(0, (now - actTime) / oneDay);

    const distKm = (act.total_distance_m || 0) / 1000;
    const elevGain = act.elevation_gain_m || 0;
    const durationMin = (act.moving_time_sec || 0) / 60;
    const avgSpeed = act.avg_speed_kmh || 20;

    totalDistKm += distKm;
    if (distKm > maxDistKm) maxDistKm = distKm;
    totalElevM += elevGain;
    if (elevGain > maxElevM) maxElevM = elevGain;

    if (act.avg_speed_kmh && act.avg_speed_kmh > 0) {
      sumSpeed += act.avg_speed_kmh;
      speedCount++;
    }

    if (act.activity_type === 'MOUNTAIN_BIKE') {
      mtbCount++;
    } else {
      roadCount++;
    }

    const intensity = Math.min(
      1.2,
      (avgSpeed / 26) * 0.7 + (elevGain / Math.max(1, distKm)) * 0.015
    );
    const tss = Math.round((durationMin * Math.pow(intensity, 2) * 100) / 60);

    if (daysAgo <= 42) {
      totalTss42Days += tss;
    }
    if (daysAgo <= 7) {
      totalTss7Days += tss;
      weeklyDist += distKm;
      weeklyElev += elevGain;
    }

    if (act.avg_hr && act.avg_hr > 0) {
      sumHr += act.avg_hr;
      hrCount++;
    }
    if (act.max_hr && act.max_hr > maxObservedHr) {
      maxObservedHr = act.max_hr;
    }
    if (act.avg_watts_est && act.avg_watts_est > 0) {
      sumWatts += act.avg_watts_est;
      wattsCount++;
    }
    if (act.avg_cadence && act.avg_cadence > 0) {
      sumCadence += act.avg_cadence;
      cadenceCount++;
    }
  });

  // If the user hasn't ridden in the last 42 days, compute CTL/ATL relative to their most recent active window so historical profile is always meaningful
  if (totalTss42Days === 0 && newestTime > 0) {
    activities.forEach(act => {
      const actTime = new Date(act.start_time).getTime();
      const daysFromLast = Math.max(0, (newestTime - actTime) / oneDay);
      const distKm = (act.total_distance_m || 0) / 1000;
      const elevGain = act.elevation_gain_m || 0;
      const durationMin = (act.moving_time_sec || 0) / 60;
      const avgSpeed = act.avg_speed_kmh || 20;
      const intensity = Math.min(
        1.2,
        (avgSpeed / 26) * 0.7 + (elevGain / Math.max(1, distKm)) * 0.015
      );
      const tss = Math.round((durationMin * Math.pow(intensity, 2) * 100) / 60);
      if (daysFromLast <= 42) totalTss42Days += tss;
      if (daysFromLast <= 7) {
        totalTss7Days += tss;
        weeklyDist += distKm;
        weeklyElev += elevGain;
      }
    });
  }

  const ctl = Math.round(totalTss42Days / 42);
  const atl = Math.round(totalTss7Days / 7);
  const tsb = ctl - atl;

  const totalCount = activities.length;
  const avgDistanceKm = parseFloat((totalDistKm / totalCount).toFixed(1));
  const avgElevationM = Math.round(totalElevM / totalCount);
  const elevRatioMPerKm = parseFloat((totalElevM / Math.max(1, totalDistKm)).toFixed(1));
  const avgSpeedKmh = speedCount > 0 ? parseFloat((sumSpeed / speedCount).toFixed(1)) : 0;
  const avgCadenceRpm = cadenceCount > 0 ? Math.round(sumCadence / cadenceCount) : 0;

  const spanWeeks = Math.max(1, (Math.max(now, newestTime) - oldestTime) / (7 * oneDay));
  const ridesPerWeekAvg = parseFloat((totalCount / spanWeeks).toFixed(1));

  const mtbPct = Math.round((mtbCount / totalCount) * 100);
  const roadPct = 100 - mtbPct;
  const dominantDiscipline =
    mtbPct >= 70
      ? `Especialista MTB (${mtbPct}% MTB / ${roadPct}% Carretera)`
      : roadPct >= 70
      ? `Especialista Carretera (${roadPct}% Carretera / ${mtbPct}% MTB)`
      : `Ciclista Híbrido (${mtbPct}% MTB / ${roadPct}% Carretera)`;

  let riderProfileType = 'Ciclista Polivalente de Resistencia';
  if (elevRatioMPerKm >= 18) {
    riderProfileType = mtbPct >= 50 ? 'Escalador Puro & Trail MTB' : 'Escalador de Alta Montaña';
  } else if (avgDistanceKm >= 55) {
    riderProfileType = 'Especialista en Gran Fondo & Resistencia Aeróbica';
  } else if (avgSpeedKmh >= 26) {
    riderProfileType = 'Rodador de Potencia & Ritmo Sostenido';
  } else if (mtbPct >= 60) {
    riderProfileType = 'Rider XC / Maratón MTB';
  }

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
    avgWattsLastRides: wattsCount > 0 ? Math.round(sumWatts / wattsCount) : 0,
    totalActivities: totalCount,
    riderProfileType,
    dominantDiscipline,
    avgDistanceKm,
    maxDistanceKm: parseFloat(maxDistKm.toFixed(1)),
    avgElevationM,
    maxElevationM: Math.round(maxElevM),
    elevRatioMPerKm,
    avgSpeedKmh,
    maxObservedHr: maxObservedHr || 185,
    avgCadenceRpm,
    ridesPerWeekAvg
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
        response_format_instruction:
          'Responde SIEMPRE en español en máximo 4 líneas cortas con viñetas. Directo al grano: métricas clave y pauta concreta para mañana.',
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
          title: n8nData.title || `Diagnóstico Rápido: ${activity.title}`,
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
      ? `Z1 ${z.Z1 ?? z.z1 ?? 0}% · Z2 ${z.Z2 ?? z.z2 ?? 0}% · Z3 ${z.Z3 ?? z.z3 ?? 0}% · Z4 ${z.Z4 ?? z.z4 ?? 0}% · Z5 ${z.Z5 ?? z.z5 ?? 0}%`
      : 'Segun pulso medio/máx';

  const z4z5 = Number(z.Z4 ?? z.z4 ?? 0) + Number(z.Z5 ?? z.z5 ?? 0);
  const recoveryAdvice =
    z4z5 > 25
      ? 'Alta carga en Z4-Z5 (>25%). Mañana: 45-60 min regenerativos en Z1 (<115 bpm) o descanso.'
      : 'Carga aeróbica controlada (Z2-Z3). Mañana estás listo para meter series de umbral o salida de fondo.';

  const contentEs = `• **Resumen:** ${distKm} km (${durMin} min) · +${activity.elevation_gain_m} m · ${activity.avg_speed_kmh} km/h.
• **Fisiología:** FC ${hrText}${activity.avg_cadence ? ` · ${activity.avg_cadence} rpm` : ''} (${zonesSummary}).
• **Pauta Mañana:** ${recoveryAdvice}`;

  return {
    id: `insight-${activity.id}`,
    user_id: activity.user_id,
    activity_id: activity.id,
    insight_type: 'ACTIVITY_ANALYSIS',
    title: `Diagnóstico Rápido: ${activity.title}`,
    content_es: contentEs,
    created_at: new Date().toISOString()
  };
}

export async function queryAiCoach(
  userQuery?: string,
  clientActivities?: StoredActivity[]
): Promise<CoachResponse> {
  let activities = getStoredActivities();
  if ((!activities || activities.length === 0) && Array.isArray(clientActivities) && clientActivities.length > 0) {
    activities = clientActivities;
  }
  const settings = getSettings();
  const metrics = calculateRiderFitnessMetrics(activities);

  const webhookUrl = settings.n8n_webhook_url || process.env.N8N_WORKFLOW_WEBHOOK_URL;

  if (webhookUrl && webhookUrl.startsWith('http')) {
    try {
      const payload = {
        event: 'COACH_ANALYSIS_REQUEST',
        timestamp: new Date().toISOString(),
        response_format_instruction:
          'Responde SIEMPRE en español en máximo 4-5 líneas cortas con viñetas. Sé ultra específico con duraciones (min), pulsaciones (bpm) y cadencia (rpm). Cero introducciones ni texto largo.',
        user_query: userQuery || 'Resumen corto de perfil y entreno clave de hoy',
        rider_metrics: metrics,
        recent_activities: activities.slice(0, 20).map(a => ({
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
          title: n8nData.title || 'Ficha Directa del Entrenador AI (N8N)',
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

  const maxHr = metrics.maxObservedHr || 183;
  const z1Low = Math.round(maxHr * 0.50);
  const z1High = Math.round(maxHr * 0.60);
  const z2Low = Math.round(maxHr * 0.62);
  const z2High = Math.round(maxHr * 0.73);
  const z3Low = Math.round(maxHr * 0.74);
  const z3High = Math.round(maxHr * 0.81);
  const z4Low = Math.round(maxHr * 0.82);
  const z4High = Math.round(maxHr * 0.91);
  const z5Low = Math.round(maxHr * 0.92);
  const estLthr = Math.round(maxHr * 0.895);

  const isQuestion = !!userQuery && userQuery.trim().length > 0;
  const qLower = (userQuery || '').toLowerCase();
  let contentEs = '';

  if (isQuestion && (qLower.includes('ftp') || qLower.includes('test') || qLower.includes('umbral'))) {
    contentEs = `🎯 **Test FTP 20 min (Subida constante 3-5% o llano · Total: 55 min)**
• **1. Calentamiento (15m):** ${z1Low}-${z2High} bpm (88 rpm) + 3×1m a 100 rpm (1m suave).
• **2. Vaciado Previo (10m):** 5m fuerte a **${z4Low}-${z5Low} bpm** + 5m suave (<${z1High} bpm).
• **3. 🔥 BLOQUE TEST (20m):** Min 0-5 a **${z4Low}-${estLthr} bpm** → Min 5-15 a **${estLthr}-${z4High} bpm** → Min 15-20 **a tope (${z4High}-${maxHr} bpm)**.
• **4. Resultado:** Multiplica tus W medios y bpm medios de esos 20m × **0.95** en la calculadora inferior.`;
  } else if (isQuestion && (qLower.includes('puerto') || qLower.includes('subi') || qLower.includes('montaña') || qLower.includes('escalar'))) {
    contentEs = `⛰️ **Sesión Específica de Puertos (75 min · Tu ratio actual: ${metrics.elevRatioMPerKm} m/km)**
• **Calentamiento (15m):** Rodaje progresivo en Z2 (${z2Low}-${z2High} bpm) a 90 rpm.
• **Serie Principal:** **3 × 10 min en subida (4-6%)** clavando pulso en **Z4 (${z4Low}-${z4High} bpm)** a 78-82 rpm sentado (Rec: 5m bajando/llano a <${z1High} bpm).
• **Vuelta a la calma (15m):** Soltar piernas en Z1 (<${z1High} bpm).`;
  } else if (isQuestion && (qLower.includes('100') || qLower.includes('larga') || qLower.includes('fondo') || qLower.includes('nutri') || qLower.includes('comer'))) {
    contentEs = `🚴 **Pauta Gran Fondo +100 km (Tu récord: ${metrics.maxDistanceKm} km | Media: ${metrics.avgDistanceKm} km)**
• **Km 0 a 60 (Ahorro):** Prohibido pasar de **${z2High} bpm (Z2)** en llano ni de **${z3High} bpm (Z3)** en subidas.
• **Km 60 a Meta:** Sube a **Z3-Z4 (${z3Low}-${z4High} bpm)** manteniendo >82 rpm.
• **Nutrición Exacta:** 60g HC/hora (1 gel o barrita cada 45 min desde el min 45 + 500ml sales/hora).`;
  } else if (isQuestion && (qLower.includes('zona') || qLower.includes('pulso') || qLower.includes('frecuencia') || qLower.includes('polariza'))) {
    contentEs = `⚡ **Tus Zonas Reales (FC Máx: ${maxHr} bpm · Umbral LTHR: ~${estLthr} bpm)**
• **Z1 Recup:** ${z1Low}-${z1High} bpm | **Z2 Base (haz aquí el 75%):** ${z2Low}-${z2High} bpm | **Z3 Tempo:** ${z3Low}-${z3High} bpm
• **Z4 Umbral (Series):** ${z4Low}-${z4High} bpm | **Z5 VO2max:** ${z5Low}-${maxHr} bpm
• **Corrección clave:** Tu media histórica es **${metrics.avgHrLastRides} bpm** (Z3 baja). Rueda entre semana a **<${z2High} bpm** para ganar base sin fatiga.`;
  } else if (isQuestion) {
    contentEs = `🚴 **Pauta Directa para Hoy (${metrics.riderProfileType})**
• **Estado Actual:** TSB ${metrics.tsb} (${metrics.formStatus}) · Media histórica ${metrics.avgDistanceKm} km (${metrics.avgHrLastRides} bpm).
• **Sesión Recomendada (75 min):** 15m Z2 (${z2Low}-${z2High} bpm) + **3×8m en Z4 (${z4Low}-${z4High} bpm a 85 rpm, rec 4m Z1)** + 15m Z1 (<${z1High} bpm).
• **Objetivo:** Elevar tu velocidad de crucero (${metrics.avgSpeedKmh} km/h) sin acumular fatiga basura en Z3.`;
  } else {
    contentEs = `• **Perfil (${metrics.totalActivities || 0} rutas):** ${metrics.riderProfileType} · Media **${metrics.avgDistanceKm} km** (+${metrics.avgElevationM} m) · **${metrics.avgSpeedKmh} km/h**.
• **Fisiología Real:** FC Media **${metrics.avgHrLastRides} bpm** | FC Máx **${maxHr} bpm** | Umbral LTHR est. **${estLthr} bpm**.
• **Foco de Mejora:** Baja el pulso en rodajes suaves a **Z2 (${z2Low}-${z2High} bpm)** y concentra la intensidad en 1 día de **Z4 (${z4Low}-${z4High} bpm)**.
• **Siguiente Paso:** Haz el **Test FTP de 20 min** inferior o sigue tu microciclo de 7 días.`;
  }

  return {
    title: 'Ficha Técnica Directa · Entrenador AI',
    source: 'BUILTIN_AI_ENGINE',
    metrics,
    content_es: contentEs,
    weekly_plan: n8nnWeeklyPlanFallback(metrics),
    created_at: new Date().toISOString()
  };
}

function n8nnWeeklyPlanFallback(metrics: RiderFitnessMetrics) {
  const maxHr = metrics.maxObservedHr || 183;
  const z1Low = Math.round(maxHr * 0.50);
  const z1High = Math.round(maxHr * 0.60);
  const z2Low = Math.round(maxHr * 0.62);
  const z2High = Math.round(maxHr * 0.73);
  const z3Low = Math.round(maxHr * 0.74);
  const z3High = Math.round(maxHr * 0.81);
  const z4Low = Math.round(maxHr * 0.82);
  const z4High = Math.round(maxHr * 0.91);

  const avgDist = metrics.avgDistanceKm || 35;
  const baseDurMin = Math.max(60, Math.min(105, Math.round((avgDist / Math.max(20, metrics.avgSpeedKmh || 24)) * 60)));
  const longRideMin = Math.max(120, Math.min(210, Math.round(baseDurMin * 1.5)));

  return [
    {
      day: 'Lunes',
      title: 'Regenerativo Z1',
      description: `Soltar piernas en llano a 90 rpm sin pasar de ${z1High} bpm.`,
      target_hr_zone: `Z1 (${z1Low}-${z1High} bpm)`,
      duration_min: 45,
      intensity: 'Baja' as const
    },
    {
      day: 'Martes',
      title: 'Base Aeróbica Z2',
      description: `Rodaje continuo a 88-92 rpm clavando pulso entre ${z2Low} y ${z2High} bpm.`,
      target_hr_zone: `Z2 (${z2Low}-${z2High} bpm)`,
      duration_min: baseDurMin,
      intensity: 'Media' as const
    },
    {
      day: 'Miércoles',
      title: 'Series Umbral Z4 (3×10m)',
      description: `15m Z2 + 3×10 min subida al umbral (${z4Low}-${z4High} bpm, rec 5m Z1) + 10m Z1.`,
      target_hr_zone: `Z4 (${z4Low}-${z4High} bpm)`,
      duration_min: 75,
      intensity: 'Alta' as const
    },
    {
      day: 'Jueves',
      title: 'Transición Aeróbica',
      description: `Salida suave en terreno llano manteniendo cadencia ágil (>90 rpm).`,
      target_hr_zone: `Z2 (${z2Low}-${z2High} bpm)`,
      duration_min: 60,
      intensity: 'Baja' as const
    },
    {
      day: 'Viernes',
      title: 'Descanso Total',
      description: 'Descanso muscular e hidratación previo al fin de semana.',
      target_hr_zone: 'Descanso',
      duration_min: 0,
      intensity: 'Descanso' as const
    },
    {
      day: 'Sábado',
      title: `Fondo Progresivo (${Math.round(avgDist * 1.3)} km)`,
      description: `Llano en Z2 (${z2Low}-${z2High} bpm) y puertos a ritmo constante en Z3 (${z3Low}-${z3High} bpm).`,
      target_hr_zone: `Z2-Z3 (${z2Low}-${z3High} bpm)`,
      duration_min: longRideMin,
      intensity: 'Alta' as const
    },
    {
      day: 'Domingo',
      title: 'Cambios de Ritmo / Grupetta',
      description: `Ruta libre con estímulos cortos en repechos llegando a ${z4High} bpm.`,
      target_hr_zone: `Z3-Z4 (${z3Low}-${z4High} bpm)`,
      duration_min: Math.round(baseDurMin * 1.15),
      intensity: 'Competición' as const
    }
  ];
}
