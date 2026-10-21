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
        user_query: userQuery || 'Generar perfil de entrenamiento y plan semanal adaptativo',
        rider_metrics: metrics,
        recent_activities: activities.slice(0, 25).map(a => ({
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
    contentEs = `### 🎯 Protocolo de Test FTP & Umbral (LTHR) Adaptado a tu Perfil

**Por qué este test está diseñado específicamente para ti:**
Analizando tus **${metrics.totalActivities || 249} salidas en Strava** (**${metrics.dominantDiscipline}**, media de **${metrics.avgDistanceKm} km**, ratio de **${metrics.elevRatioMPerKm} m/km**, **FC Media ${metrics.avgHrLastRides} bpm** y **FC Máxima real de ${maxHr} bpm**), el protocolo ideal para ti es el **Test de 20 Minutos de Allen & Coggan en subida tendida constante (3% - 5%) o llano limpio**.

---

#### 📋 Estructura Exacta de la Sesión (Duración Total: 65 min)

1. **Fase 1 · Calentamiento Progresivo (20 min):**
   - Rodaje suave aumentando progresivamente de **Zona 1 (${z1Low}-${z1High} bpm)** a **Zona 2 (${z2Low}-${z2High} bpm)** con cadencia fluida (85-90 rpm).
2. **Fase 2 · Activación Neuromuscular (3 × 1 min):**
   - Realiza 3 aceleraciones de 1 minuto a cadencia alta (**100-105 rpm**) sin llegar a bloquear las piernas, recuperando 1 minuto suave en Zona 1 entre cada una.
3. **Fase 3 · Esfuerzo de Desbloqueo / Vaciado Anaeróbico (5 min fuertes + 10 min suaves):**
   - **5 minutos a ritmo alto en Zona 4-5 (${z4Low}-${z5Low} bpm):** Imprescindible para agotar tu reserva anaeróbica (AWC) y evitar que los primeros minutos del test falseen tu FTP por exceso.
   - **10 minutos de recuperación activa en Zona 1 (<${z1High} bpm)** hasta que tu pulso baje de **${z1High} bpm**.
4. **Fase 4 · 🔥 BLOQUE CENTRAL: TEST FTP 20 MINUTOS (Esfuerzo Máximo Sostenido):**
   - **Minutos 0 a 5 (Control de salida):** Arranca de menos a más. Clava tu pulso entre **${z4Low} y ${estLthr} bpm** sin cebarte en los primeros 3 minutos.
   - **Minutos 5 a 15 (Crucero de Umbral):** Estabiliza la cadencia (**82-88 rpm** si es en subida tendida, **90-94 rpm** si es en llano) manteniendo tus pulsaciones en torno a tu umbral estimado (**${estLthr}-${z4High} bpm**).
   - **Minutos 15 a 20 (Vaciado Final):** Incrementa progresivamente el ritmo hasta dar el 100% en los últimos 3 minutos (alcanzarás **${z4High}-${maxHr} bpm**).
5. **Fase 5 · Enfriamiento Regenerativo (10 min):**
   - Rodaje muy suave en **Zona 1 (<${z1High} bpm)** soltando piernas.

---

#### 🧮 Cómo Calcular tus Zonas Exactas al Terminar:
- **Tu FTP Oficial (W):** Multiplica la **Potencia Media de esos 20 min × 0.95** (puedes usar la calculadora interactiva que tienes justo debajo en esta misma pantalla).
- **Tu Pulso de Umbral Lactato (LTHR):** Multiplica la **FC Media de esos 20 min × 0.95** (para tu FC Máx de **${maxHr} bpm**, tu LTHR real estará muy cerca de **${estLthr} bpm**).`;
  } else if (isQuestion) {
    contentEs = `### 🚴 Diagnóstico Personalizado del Entrenador AI FREERIDE

**Tu Consulta:** "${userQuery}"

**Tu Perfil de Entrenamiento Real (Basado en ${metrics.totalActivities || 0} actividades de Strava):**
- **Arquetipo Ciclista Detectado:** ${metrics.riderProfileType} (${metrics.dominantDiscipline})
- **Distancia Media por Salida:** ${metrics.avgDistanceKm} km (Récord histórico: ${metrics.maxDistanceKm} km)
- **Desnivel Medio:** +${metrics.avgElevationM} m por ruta (${metrics.elevRatioMPerKm} m/km de ratio vertical | Máximo: +${metrics.maxElevationM} m)
- **Pulsaciones Reales en Strava:** Media histórica de **${metrics.avgHrLastRides} bpm** | Máxima registrada: **${maxHr} bpm** | Umbral LTHR estimado: **~${estLthr} bpm**
- **Carga Fisiológica Actual:** CTL ${metrics.ctl} | ATL ${metrics.atl} | TSB ${metrics.tsb} (${metrics.formStatus})

**Recomendación Específica para tu Perfil:**
1. **Control de Zonas Cardíacas (sobre tu FC Máx registrada de ${maxHr} bpm):** Mantén el 75% de tu volumen semanal en **Zona 2 (${z2Low}-${z2High} bpm)** para consolidar tu eficiencia aeróbica sin disparar la fatiga aguda, evitando abusar de la Zona 3 (${z3Low}-${z3High} bpm).
2. **Trabajo Específico de Umbral:** Dado tu ratio de desnivel de **${metrics.elevRatioMPerKm} m/km**, incluye 1 sesión semanal de series en subida en **Zona 4 (${z4Low}-${z4High} bpm)** (3×10 min con 5 min de recuperación) para elevar tu potencia sostenida en ascensión.
3. **Progresión de Fondo:** Tu distancia media actual es de **${metrics.avgDistanceKm} km** (con récord de **${metrics.maxDistanceKm} km**). Para dar un salto de calidad en resistencia, programa una salida larga de fin de semana de **${Math.round(Math.max(45, (metrics.avgDistanceKm || 35) * 1.25))} km** manteniendo hidratación y 60g de carbohidratos por hora.`;
  } else {
    contentEs = `### 🏆 Tu Perfil de Entrenamiento Histórico & Recomendaciones (Strava API v3)

**1. Radiografía de tu Historial en Strava (${metrics.totalActivities || 0} actividades analizadas):**
- **Perfil de Ciclista:** **${metrics.riderProfileType}**
- **Distribución de Disciplinas:** ${metrics.dominantDiscipline}
- **Volumen por Salida:** Media de **${metrics.avgDistanceKm} km** y **+${metrics.avgElevationM} m** por entrenamiento (Ruta más larga: **${metrics.maxDistanceKm} km** | Mayor desnivel: **+${metrics.maxElevationM} m**).
- **Exigencia Vertical:** **${metrics.elevRatioMPerKm} m/km** a una velocidad media histórica de **${metrics.avgSpeedKmh} km/h**.
- **Respuesta Fisiológica Real:** FC media histórica de **${metrics.avgHrLastRides > 0 ? `${metrics.avgHrLastRides} bpm` : 'registrada en Strava'}** (FC Máx observada: **${maxHr} bpm** | Umbral LTHR estimado: **${estLthr} bpm**)${metrics.avgWattsLastRides > 0 ? ` | Potencia media: **${metrics.avgWattsLastRides} W**` : ''}${metrics.avgCadenceRpm ? ` | Cadencia media: **${metrics.avgCadenceRpm} rpm**` : ''}.
- **Estado de Carga (CTL / ATL / TSB):** Fitness **${metrics.ctl}** | Fatiga **${metrics.atl}** | Balance **${metrics.tsb}** (${metrics.formStatus}).

**2. Recomendaciones Clave Según tu Perfil:**
- **Polarización del Entrenamiento:** Tienes una FC media histórica de **${metrics.avgHrLastRides} bpm** sobre una máxima de **${maxHr} bpm**, lo que indica que ruedas muy cerca de la frontera entre Zona 2 y Zona 3. Dedica tus salidas entre semana a **Zona 2 estricta (${z2Low}-${z2High} bpm)** y reserva las energías para 1 día de series en **Zona 4 (${z4Low}-${z4High} bpm)** y la salida larga del fin de semana.
- **Optimización en Subidas (${metrics.elevRatioMPerKm} m/km):** En puertos y repechos, busca mantener una cadencia ágil (>78 rpm en subida, 88-92 rpm en llano) para retrasar la fatiga muscular periférica.
- **Protocolo de Test FTP Disponible:** Usa el generador de **Test FTP de 20 minutos** justo debajo para calibrar tus vatios (W/kg) y tu pulso de umbral exacto.`;
  }

  return {
    title: 'Entrenador Personal AI FREERIDE - Perfil & Planificación',
    source: 'BUILTIN_AI_ENGINE',
    metrics,
    content_es: contentEs,
    weekly_plan: n8nnWeeklyPlanFallback(metrics),
    created_at: new Date().toISOString()
  };
}

function n8nnWeeklyPlanFallback(metrics: RiderFitnessMetrics) {
  const maxHr = metrics.maxObservedHr || 185;
  const z1Low = Math.round(maxHr * 0.50);
  const z1High = Math.round(maxHr * 0.60);
  const z2Low = Math.round(maxHr * 0.62);
  const z2High = Math.round(maxHr * 0.73);
  const z3Low = Math.round(maxHr * 0.74);
  const z3High = Math.round(maxHr * 0.82);
  const z4Low = Math.round(maxHr * 0.83);
  const z4High = Math.round(maxHr * 0.91);

  const avgDist = metrics.avgDistanceKm || 35;
  const baseDurMin = Math.max(60, Math.min(120, Math.round((avgDist / Math.max(18, metrics.avgSpeedKmh || 22)) * 60)));
  const longRideMin = Math.max(110, Math.min(240, Math.round(baseDurMin * 1.45)));

  return [
    {
      day: 'Lunes',
      title: 'Recuperación Activa o Descanso',
      description: 'Rodaje muy suave regenerativo o descanso total para asimilar la carga del fin de semana.',
      target_hr_zone: `Zona 1 (${z1Low} - ${z1High} bpm)`,
      duration_min: 45,
      intensity: 'Baja' as const
    },
    {
      day: 'Martes',
      title: 'Resistencia Aeróbica Base (Zona 2)',
      description: `Rodaje continuo adaptado a tu perfil (${metrics.riderProfileType || 'Ciclista'}). Mantén cadencia ágil (88-92 rpm) sin superar el techo aeróbico.`,
      target_hr_zone: `Zona 2 (${z2Low} - ${z2High} bpm)`,
      duration_min: baseDurMin,
      intensity: 'Media' as const
    },
    {
      day: 'Miércoles',
      title: 'Series de Umbral & Fuerza en Subida',
      description: `3 bloques de 10 minutos al umbral anaeróbico en subida (adaptado a tu ratio de ${metrics.elevRatioMPerKm || 12} m/km) con 5 min de recuperación en Z1.`,
      target_hr_zone: `Zona 4 (${z4Low} - ${z4High} bpm)`,
      duration_min: 75,
      intensity: 'Alta' as const
    },
    {
      day: 'Jueves',
      title: 'Rodaje Aeróbico de Transición',
      description: 'Salida fluida en terreno llano o ligeramente ondulado para oxigenar piernas manteniendo pulsaciones controladas.',
      target_hr_zone: `Zona 2 (${z2Low} - ${z2High} bpm)`,
      duration_min: 60,
      intensity: 'Baja' as const
    },
    {
      day: 'Viernes',
      title: 'Descanso Total & Supercompensación',
      description: 'Hidratación, movilidad articular y descanso neuromuscular previo al bloque de volumen del fin de semana.',
      target_hr_zone: 'Descanso Total',
      duration_min: 0,
      intensity: 'Descanso' as const
    },
    {
      day: 'Sábado',
      title: 'Salida de Gran Fondo (Resistencia Específica)',
      description: `Ruta larga progresiva buscando superar tu media habitual de ${avgDist} km con ritmo sostenido en ascensiones.`,
      target_hr_zone: `Zona 2 a Zona 3 (${z2Low} - ${z3High} bpm)`,
      duration_min: longRideMin,
      intensity: 'Alta' as const
    },
    {
      day: 'Domingo',
      title: 'Salida MTB / Técnica & Cambios de Ritmo',
      description: 'Ruta por terreno variado o montaña trabajando control técnico, agilidad y estímulos cortos en repechos.',
      target_hr_zone: `Zona 3 a Zona 4 (${z3Low} - ${z4High} bpm)`,
      duration_min: Math.round(baseDurMin * 1.15),
      intensity: 'Competición' as const
    }
  ];
}
