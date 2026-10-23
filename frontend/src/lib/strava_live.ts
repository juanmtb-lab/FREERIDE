import {
  getStravaSession,
  saveStravaSession,
  refreshStravaTokenIfNeeded,
  StravaSessionData
} from './strava_session';
import { saveActivity, saveActivitiesBatch, getStoredActivities, getActivityById, StoredActivity } from './storage';

const STRAVA_API = 'https://www.strava.com/api/v3';

async function stravaFetchWithAuth(
  url: string,
  session: StravaSessionData,
  userId?: string
): Promise<{ res: Response; session: StravaSessionData }> {
  let activeSession = await refreshStravaTokenIfNeeded(session, false, userId);

  let res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${activeSession.accessToken}`
    },
    cache: 'no-store'
  });

  // If 401 Unauthorized and we have refresh credentials, force a token refresh once
  if (res.status === 401 && activeSession.refreshToken && activeSession.clientId && activeSession.clientSecret) {
    activeSession = await refreshStravaTokenIfNeeded(activeSession, true, userId);
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${activeSession.accessToken}`
      },
      cache: 'no-store'
    });
  }

  return { res, session: activeSession };
}

export async function syncStravaActivitiesLive(options?: {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  request?: Request;
  userId?: string;
}): Promise<{
  activities: StoredActivity[];
  syncedCount: number;
  session: StravaSessionData | null;
}> {
  const userId = options?.userId || options?.request?.headers?.get('x-user-id') || undefined;
  let session = getStravaSession(options?.request, userId);

  if (options?.accessToken || options?.refreshToken || options?.clientId || options?.clientSecret) {
    session = saveStravaSession({
      clientId: options.clientId || session?.clientId,
      clientSecret: options.clientSecret || session?.clientSecret,
      accessToken: options.accessToken || session?.accessToken || '',
      refreshToken: options.refreshToken || session?.refreshToken
    }, userId);
  }

  if (!session || (!session.accessToken && !session.refreshToken)) {
    return {
      activities: getStoredActivities(userId),
      syncedCount: 0,
      session: null
    };
  }

  // If user provided clientId + clientSecret + refreshToken without accessToken, refresh immediately
  session = await refreshStravaTokenIfNeeded(session, !session.accessToken, userId);

  // 1. Fetch Athlete Profile to verify token and get athlete name
  try {
    const { res: athleteRes, session: updatedSession } = await stravaFetchWithAuth(
      `${STRAVA_API}/athlete`,
      session,
      userId
    );
    session = updatedSession;
    if (athleteRes.ok) {
      const athlete = await athleteRes.json();
      const fullName = [athlete.firstname, athlete.lastname].filter(Boolean).join(' ') || athlete.username || 'Ciclista Strava';
      session = saveStravaSession({
        ...session,
        athleteName: fullName,
        athleteId: String(athlete.id || '')
      }, userId);
    }
  } catch (e) {
    console.log('Could not fetch Strava athlete profile:', e);
  }

  // 2. Fetch up to 600 historical activities from Strava (3 pages of 200)
  const allStravaActivities: any[] = [];

  for (let page = 1; page <= 3; page++) {
    const { res, session: updatedSession } = await stravaFetchWithAuth(
      `${STRAVA_API}/athlete/activities?per_page=200&page=${page}`,
      session,
      userId
    );
    session = updatedSession;

    if (!res.ok) {
      if (page === 1) {
        const errText = await res.text();
        if (res.status === 401 || errText.includes('activity:read_permission')) {
          throw new Error(
            `El token de Strava no tiene permiso de lectura de actividades (activity:read_all). Usa el botón naranja "Autorizar con Strava en 1 Clic (OAuth2 Completo)" con tu Client ID y Client Secret.`
          );
        }
        throw new Error(
          `Error al conectar con Strava (${res.status}): Verifica tus credenciales OAuth. ${errText}`
        );
      }
      break;
    }

    const pageItems = await res.json();
    if (!Array.isArray(pageItems) || pageItems.length === 0) {
      break;
    }

    allStravaActivities.push(...pageItems);
    if (pageItems.length < 200) {
      break;
    }
  }

  const parsedBatch: StoredActivity[] = [];

  for (const stAct of allStravaActivities) {
    if (!stAct || !stAct.id) continue;

    const actId = String(stAct.id);
    const sportRaw = String(stAct.sport_type || stAct.type || '').toLowerCase();
    const nameRaw = String(stAct.name || '').toLowerCase();

    let activityType: 'ROAD_BIKE' | 'MOUNTAIN_BIKE' | 'GRAVEL' | 'UNKNOWN' = 'ROAD_BIKE';
    if (
      sportRaw.includes('mountain') ||
      sportRaw.includes('mtb') ||
      sportRaw.includes('trail') ||
      nameRaw.includes('mtb') ||
      nameRaw.includes('btt') ||
      nameRaw.includes('montaña')
    ) {
      activityType = 'MOUNTAIN_BIKE';
    } else if (sportRaw.includes('gravel') || nameRaw.includes('gravel')) {
      activityType = 'GRAVEL';
    }

    const distanceM = Math.round(stAct.distance || 0);
    const movingSec = Math.round(stAct.moving_time || stAct.elapsed_time || 0);
    const elapsedSec = Math.round(stAct.elapsed_time || stAct.moving_time || 0);
    const elevGainM = Math.round(stAct.total_elevation_gain || 0);

    const avgSpeedKmh = stAct.average_speed ? parseFloat((stAct.average_speed * 3.6).toFixed(1)) : 0;
    const maxSpeedKmh = stAct.max_speed ? parseFloat((stAct.max_speed * 3.6).toFixed(1)) : 0;

    const avgHR = stAct.average_heartrate ? Math.round(stAct.average_heartrate) : undefined;
    const maxHR = stAct.max_heartrate ? Math.round(stAct.max_heartrate) : undefined;
    const avgCadence = stAct.average_cadence ? Math.round(stAct.average_cadence) : undefined;

    const avgWatts = stAct.average_watts ? Math.round(stAct.average_watts) : undefined;
    const maxWatts = stAct.max_watts ? Math.round(stAct.max_watts) : undefined;
    const normWatts = stAct.weighted_average_watts
      ? Math.round(stAct.weighted_average_watts)
      : avgWatts;

    const startTimeIso = new Date(stAct.start_date_local || stAct.start_date || new Date()).toISOString();

    const stored: StoredActivity = {
      id: actId,
      user_id: userId || 'usr_jmtb',
      title: stAct.name || 'Entrenamiento Strava',
      description: 'Sincronizada oficialmente desde Strava API v3',
      activity_type: activityType,
      file_type: 'FIT',
      start_time: startTimeIso,
      total_elapsed_time_sec: elapsedSec,
      moving_time_sec: movingSec,
      total_distance_m: distanceM,
      elevation_gain_m: elevGainM,
      elevation_loss_m: elevGainM,
      avg_speed_kmh: avgSpeedKmh,
      max_speed_kmh: maxSpeedKmh,
      avg_hr: avgHR,
      max_hr: maxHR,
      avg_cadence: avgCadence,
      avg_watts_est: avgWatts,
      max_watts_est: maxWatts,
      normalized_power: normWatts,
      mtb_technical_score: activityType === 'MOUNTAIN_BIKE' ? 7.5 : 1.5,
      summary_polyline: stAct.map?.summary_polyline,
      created_at: new Date().toISOString(),
      telemetry_points: []
    };

    parsedBatch.push(stored);
  }

  const mergedActivities = saveActivitiesBatch(parsedBatch, userId);

  return {
    activities: mergedActivities,
    syncedCount: parsedBatch.length,
    session
  };
}

export async function fetchStravaActivityTelemetry(
  actId: string,
  request?: Request
): Promise<StoredActivity | null> {
  const userId = request?.headers?.get('x-user-id') || undefined;
  const cleanId = String(actId).replace(/^strava-/, '');
  let activity = getActivityById(actId, userId) || getActivityById(cleanId, userId);

  if (
    activity &&
    activity.telemetry_points &&
    activity.telemetry_points.length > 5 &&
    activity.hr_zone_distribution &&
    Object.keys(activity.hr_zone_distribution).length > 0
  ) {
    return activity;
  }

  let session = getStravaSession(request);
  if (!session || (!session.accessToken && !session.refreshToken)) {
    return activity;
  }

  // If the activity summary itself is missing on this serverless container, fetch it from Strava first
  if (!activity && /^\d+$/.test(cleanId)) {
    try {
      const { res: detailRes, session: updatedSession } = await stravaFetchWithAuth(
        `${STRAVA_API}/activities/${cleanId}`,
        session
      );
      session = updatedSession;
      if (detailRes.ok) {
        const stAct = await detailRes.json();
        const sportRaw = String(stAct.sport_type || stAct.type || '').toLowerCase();
        const isMTB = sportRaw.includes('mountain') || sportRaw.includes('mtb');
        activity = {
          id: cleanId,
          user_id: userId || 'usr_jmtb',
          title: stAct.name || 'Entrenamiento Strava',
          description: stAct.description || 'Sincronizada desde Strava API v3',
          activity_type: isMTB ? 'MOUNTAIN_BIKE' : 'ROAD_BIKE',
          file_type: 'FIT',
          start_time: new Date(stAct.start_date_local || stAct.start_date || new Date()).toISOString(),
          total_elapsed_time_sec: Math.round(stAct.elapsed_time || stAct.moving_time || 0),
          moving_time_sec: Math.round(stAct.moving_time || stAct.elapsed_time || 0),
          total_distance_m: Math.round(stAct.distance || 0),
          elevation_gain_m: Math.round(stAct.total_elevation_gain || 0),
          elevation_loss_m: Math.round(stAct.total_elevation_gain || 0),
          avg_speed_kmh: stAct.average_speed ? parseFloat((stAct.average_speed * 3.6).toFixed(1)) : 0,
          max_speed_kmh: stAct.max_speed ? parseFloat((stAct.max_speed * 3.6).toFixed(1)) : 0,
          avg_hr: stAct.average_heartrate ? Math.round(stAct.average_heartrate) : undefined,
          max_hr: stAct.max_heartrate ? Math.round(stAct.max_heartrate) : undefined,
          avg_cadence: stAct.average_cadence ? Math.round(stAct.average_cadence) : undefined,
          avg_watts_est: stAct.average_watts ? Math.round(stAct.average_watts) : undefined,
          max_watts_est: stAct.max_watts ? Math.round(stAct.max_watts) : undefined,
          normalized_power: stAct.weighted_average_watts
            ? Math.round(stAct.weighted_average_watts)
            : stAct.average_watts
            ? Math.round(stAct.average_watts)
            : undefined,
          mtb_technical_score: isMTB ? 7.5 : 1.5,
          summary_polyline: stAct.map?.summary_polyline,
          created_at: new Date().toISOString(),
          telemetry_points: []
        };
      }
    } catch (e) {
      console.error(`Error fetching Strava activity summary ${cleanId}:`, e);
    }
  }

  if (!activity) return null;

  // Only query Strava Streams if cleanId is a numeric Strava Activity ID
  if (!/^\d+$/.test(cleanId)) {
    return activity;
  }

  let telemetryPoints: any[] = activity.telemetry_points || [];
  let hrZones: Record<string, number> | undefined = activity.hr_zone_distribution;
  let computedAvgWatts = activity.avg_watts_est;
  let computedMaxWatts = activity.max_watts_est;
  let computedMaxCad = activity.max_cadence;

  // 1. Fetch 100% Real Second-by-Second Telemetry Streams from Strava API v3
  try {
    const streamKeys = 'time,distance,latlng,altitude,velocity_smooth,heartrate,cadence,watts,temp,grade_smooth';
    const { res: streamsRes, session: updatedSession } = await stravaFetchWithAuth(
      `${STRAVA_API}/activities/${cleanId}/streams?keys=${streamKeys}&key_by_type=true`,
      session
    );
    session = updatedSession;

    if (streamsRes.ok) {
      const streams = await streamsRes.json();
      const timeArr: number[] = streams.time?.data || [];
      const distArr: number[] = streams.distance?.data || [];
      const altArr: number[] = streams.altitude?.data || [];
      const velArr: number[] = streams.velocity_smooth?.data || [];
      const hrArr: number[] = streams.heartrate?.data || [];
      const cadArr: number[] = streams.cadence?.data || [];
      const wattsArr: number[] = streams.watts?.data || [];
      const gradeArr: number[] = streams.grade_smooth?.data || [];
      const tempArr: number[] = streams.temp?.data || [];
      const latlngArr: [number, number][] = streams.latlng?.data || [];

      const length = Math.max(
        timeArr.length,
        distArr.length,
        altArr.length,
        velArr.length,
        hrArr.length
      );

      if (length > 0) {
        const startTs = new Date(activity.start_time).getTime();
        const pts: any[] = [];
        const validPowers: number[] = [];
        const validCads: number[] = [];

        for (let i = 0; i < length; i++) {
          const elapsedSec = timeArr[i] !== undefined ? timeArr[i] : i;
          const distM = distArr[i] !== undefined ? Math.round(distArr[i]) : 0;
          const altM = altArr[i] !== undefined ? Math.round(altArr[i] * 10) / 10 : 0;
          const speedMs = velArr[i] !== undefined ? Number(velArr[i]) : 0;
          const speedKmh = parseFloat((speedMs * 3.6).toFixed(1));
          const hr = hrArr[i] !== undefined && hrArr[i] > 30 ? Math.round(hrArr[i]) : undefined;
          const cad = cadArr[i] !== undefined && cadArr[i] >= 0 ? Math.round(cadArr[i]) : undefined;
          const gradePct = gradeArr[i] !== undefined ? parseFloat(Number(gradeArr[i]).toFixed(1)) : 0;
          const tempC = tempArr[i] !== undefined ? Math.round(tempArr[i]) : undefined;

          // Use Strava's real watts stream (power meter or Strava estimated power), or physics fallback
          let powerW: number;
          if (wattsArr[i] !== undefined && wattsArr[i] !== null) {
            powerW = Math.max(0, Math.round(wattsArr[i]));
          } else {
            const slopeRad = Math.atan(gradePct / 100);
            const massKg = 72 + 9.5;
            const pGrav = massKg * 9.81 * speedMs * Math.sin(slopeRad);
            const pRoll = massKg * 9.81 * 0.005 * speedMs * Math.cos(slopeRad);
            const pAir = 0.5 * 1.225 * 0.38 * Math.pow(speedMs, 3);
            powerW = speedKmh > 1.5 ? Math.max(0, Math.round(pGrav + pRoll + pAir)) : 0;
          }

          if (powerW > 0) validPowers.push(powerW);
          if (cad && cad > 0) validCads.push(cad);

          const lat = latlngArr[i]?.[0] ?? 0;
          const lon = latlngArr[i]?.[1] ?? 0;

          pts.push({
            id: `pt-${i}`,
            timestamp: new Date(startTs + elapsedSec * 1000).toISOString(),
            elapsed_time_sec: elapsedSec,
            latitude: lat,
            longitude: lon,
            altitude_m: altM,
            distance_m: distM,
            speed_kmh: speedKmh,
            heart_rate: hr,
            cadence: cad,
            gradient_pct: gradePct,
            estimated_power_w: powerW,
            temperature_c: tempC
          });
        }

        telemetryPoints = pts;
        if (!computedAvgWatts && validPowers.length > 0) {
          computedAvgWatts = Math.round(validPowers.reduce((a, b) => a + b, 0) / validPowers.length);
        }
        if (!computedMaxWatts && validPowers.length > 0) {
          computedMaxWatts = Math.max(...validPowers);
        }
        if (!computedMaxCad && validCads.length > 0) {
          computedMaxCad = Math.max(...validCads);
        }
      }
    }
  } catch (streamErr) {
    console.error(`Error fetching Strava streams for ${cleanId}:`, streamErr);
  }

  // 2. Fetch Official Strava Activity Heart Rate Zones (/api/v3/activities/{id}/zones)
  try {
    const { res: zonesRes } = await stravaFetchWithAuth(
      `${STRAVA_API}/activities/${cleanId}/zones`,
      session
    );
    if (zonesRes.ok) {
      const zonesData = await zonesRes.json();
      if (Array.isArray(zonesData)) {
        const hrZoneObj = zonesData.find((z: any) => z.type === 'heartrate');
        const buckets = hrZoneObj?.distribution_buckets;
        if (Array.isArray(buckets) && buckets.length > 0) {
          const totalTime = buckets.reduce((acc: number, b: any) => acc + (b.time || 0), 0);
          if (totalTime > 0) {
            hrZones = {
              Z1: Math.round(((buckets[0]?.time || 0) / totalTime) * 100),
              Z2: Math.round(((buckets[1]?.time || 0) / totalTime) * 100),
              Z3: Math.round(((buckets[2]?.time || 0) / totalTime) * 100),
              Z4: Math.round(((buckets[3]?.time || 0) / totalTime) * 100),
              Z5: Math.round(((buckets[4]?.time || 0) / totalTime) * 100)
            };
          }
        }
      }
    }
  } catch (zoneErr) {
    console.log(`Strava zones fallback for ${cleanId}:`, zoneErr);
  }

  // 3. If Strava /zones endpoint didn't return HR buckets, compute exact Z1-Z5 from real heart_rate stream
  if ((!hrZones || Object.keys(hrZones).length === 0) && telemetryPoints.length > 0) {
    const validHrs = telemetryPoints
      .map((p: any) => p.heart_rate)
      .filter((h: any): h is number => typeof h === 'number' && h > 35);
    if (validHrs.length > 0) {
      const refMax = Math.max(activity.max_hr || 185, ...validHrs);
      const counts = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 };
      for (const h of validHrs) {
        const pct = (h / refMax) * 100;
        if (pct < 60) counts.Z1++;
        else if (pct < 70) counts.Z2++;
        else if (pct < 80) counts.Z3++;
        else if (pct < 90) counts.Z4++;
        else counts.Z5++;
      }
      const tot = validHrs.length;
      hrZones = {
        Z1: Math.round((counts.Z1 / tot) * 100),
        Z2: Math.round((counts.Z2 / tot) * 100),
        Z3: Math.round((counts.Z3 / tot) * 100),
        Z4: Math.round((counts.Z4 / tot) * 100),
        Z5: Math.round((counts.Z5 / tot) * 100)
      };
    }
  }

  const updatedActivity: StoredActivity = {
    ...activity,
    id: cleanId,
    telemetry_points: telemetryPoints,
    hr_zone_distribution: hrZones,
    avg_watts_est: computedAvgWatts,
    max_watts_est: computedMaxWatts,
    normalized_power: activity.normalized_power ?? computedAvgWatts,
    max_cadence: computedMaxCad
  };

  return saveActivity(updatedActivity, userId);
}
