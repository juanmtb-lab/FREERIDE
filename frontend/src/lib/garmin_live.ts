import { GarminConnect } from 'garmin-connect';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getGarminSession, saveGarminSession, GarminSessionData } from './garmin_session';
import { saveActivity, getStoredActivities, getActivityById, StoredActivity } from './storage';
import { parseGPXContent } from './gpx_parser';
import { parseTCXContent } from './garmin_parser';
import { decodeFitBuffer } from './fit_decoder';

function getTmpPath(filename: string): string {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return path.join(os.tmpdir(), filename);
  }
  return path.join(process.cwd(), '..', filename);
}

let cachedClient: GarminConnect | null = null;
let cachedEmail: string | null = null;
let lastLoginTime = 0;

async function getAuthenticatedGarminClient(options?: {
  email?: string;
  password?: string;
  request?: Request;
}): Promise<{ client: GarminConnect; session: GarminSessionData } | null> {
  const existingSession = getGarminSession(options?.request);
  const email = options?.email || existingSession?.email;
  const password = options?.password || existingSession?.password;
  const savedTokens = existingSession?.tokens;

  if (!email || (!password && !savedTokens)) {
    return null;
  }

  const TOKEN_FILE = getTmpPath('freeride_garmin_token.json');
  const now = Date.now();

  if (
    cachedClient &&
    cachedEmail === email &&
    now - lastLoginTime < 25 * 60 * 1000 &&
    !options?.password
  ) {
    return {
      client: cachedClient,
      session: existingSession || { email, password, connectedAt: new Date().toISOString() }
    };
  }

  const GC = new GarminConnect({
    username: email,
    password: password || 'token-auth'
  });

  let tokenLoaded = false;

  // 1. Try tokens from session / request header first
  if (savedTokens && savedTokens.oauth1 && savedTokens.oauth2 && !options?.password) {
    try {
      GC.loadToken(savedTokens.oauth1, savedTokens.oauth2);
      tokenLoaded = true;
    } catch {
      tokenLoaded = false;
    }
  }

  // 2. Try tokens from /tmp token file
  if (!tokenLoaded && fs.existsSync(TOKEN_FILE) && !options?.password) {
    try {
      const tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
      if (tokenData && tokenData.oauth1 && tokenData.oauth2) {
        GC.loadToken(tokenData.oauth1, tokenData.oauth2);
        tokenLoaded = true;
      }
    } catch {
      tokenLoaded = false;
    }
  }

  // 3. Login with credentials if tokens weren't loaded
  if (!tokenLoaded) {
    if (!password) return null;
    await GC.login(email, password);
    try {
      const exported = GC.exportToken();
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(exported, null, 2), 'utf-8');
      const updatedSession = saveGarminSession(email, password, exported);
      cachedClient = GC;
      cachedEmail = email;
      lastLoginTime = now;
      return { client: GC, session: updatedSession };
    } catch {}
  }

  const updatedSession = saveGarminSession(email, password, savedTokens);
  cachedClient = GC;
  cachedEmail = email;
  lastLoginTime = now;
  return { client: GC, session: updatedSession };
}

function parseGarminActivityDetailsJson(details: any, riderWeightKg = 72) {
  if (
    !details ||
    !Array.isArray(details.metricDescriptors) ||
    !Array.isArray(details.activityDetailMetrics) ||
    details.activityDetailMetrics.length === 0
  ) {
    return null;
  }

  const indexMap: Record<string, number> = {};
  for (const desc of details.metricDescriptors) {
    if (desc && desc.key !== undefined && typeof desc.metricsIndex === 'number') {
      indexMap[desc.key] = desc.metricsIndex;
    }
  }

  const idxTimestamp = indexMap['directTimestamp'];
  const idxElapsed = indexMap['sumElapsedDuration'] ?? indexMap['sumMovingDuration'];
  const idxDist = indexMap['sumDistance'];
  const idxSpeed = indexMap['directSpeed'];
  const idxHr = indexMap['directHeartRate'];
  const idxElev = indexMap['directElevation'] ?? indexMap['directUncorrectedElevation'];
  const idxCad = indexMap['directBikeCadence'] ?? indexMap['directRunCadence'] ?? indexMap['directDoubleCadence'];
  const idxPower = indexMap['directPower'];
  const idxTemp = indexMap['directAirTemperature'];
  const idxLat = indexMap['directLatitude'];
  const idxLon = indexMap['directLongitude'];

  const points: any[] = [];
  let startTs: number | null = null;
  let prevDist = 0;
  let prevAlt: number | null = null;

  const hrs: number[] = [];
  const cadences: number[] = [];
  const powers: number[] = [];

  const rawRows = details.activityDetailMetrics;

  for (let i = 0; i < rawRows.length; i++) {
    const m = rawRows[i]?.metrics;
    if (!Array.isArray(m)) continue;

    const rawTs = idxTimestamp !== undefined ? m[idxTimestamp] : null;
    if (rawTs && startTs === null) startTs = rawTs;

    const elapsedSec =
      idxElapsed !== undefined && m[idxElapsed] !== null
        ? Math.round(m[idxElapsed])
        : rawTs && startTs
        ? Math.round((rawTs - startTs) / 1000)
        : i * 2;

    const distM =
      idxDist !== undefined && m[idxDist] !== null && m[idxDist] !== undefined
        ? Math.round(m[idxDist])
        : prevDist;

    const speedMs =
      idxSpeed !== undefined && m[idxSpeed] !== null && m[idxSpeed] !== undefined
        ? Number(m[idxSpeed])
        : 0;
    const speedKmh = parseFloat((speedMs * 3.6).toFixed(1));

    const altM: number =
      idxElev !== undefined && m[idxElev] !== null && m[idxElev] !== undefined
        ? Math.round(Number(m[idxElev]) * 10) / 10
        : prevAlt ?? 0;

    const hrRaw = idxHr !== undefined && m[idxHr] !== null ? Math.round(Number(m[idxHr])) : undefined;
    const hr = hrRaw && hrRaw > 30 ? hrRaw : undefined;
    if (hr) hrs.push(hr);

    const cadRaw = idxCad !== undefined && m[idxCad] !== null ? Math.round(Number(m[idxCad])) : undefined;
    const cad = cadRaw !== undefined && cadRaw >= 0 ? cadRaw : undefined;
    if (cad && cad > 0) cadences.push(cad);

    // Calculate gradient % over a smoothed distance delta
    let gradientPct = 0;
    const distDelta = distM - prevDist;
    if (prevAlt !== null && distDelta > 3) {
      gradientPct = Math.max(-25, Math.min(28, ((altM - prevAlt) / distDelta) * 100));
    }

    // Use direct power sensor if present, or physics-based power calculation from real speed & slope
    let powerW: number;
    if (idxPower !== undefined && m[idxPower] !== null && m[idxPower] !== undefined) {
      powerW = Math.max(0, Math.round(Number(m[idxPower])));
    } else {
      const slopeRad = Math.atan(gradientPct / 100);
      const massKg = riderWeightKg + 9.5;
      const pGravity = massKg * 9.81 * speedMs * Math.sin(slopeRad);
      const pRolling = massKg * 9.81 * 0.005 * speedMs * Math.cos(slopeRad);
      const pAir = 0.5 * 1.225 * 0.38 * Math.pow(speedMs, 3);
      powerW = speedKmh > 1.5 ? Math.max(0, Math.round(pGravity + pRolling + pAir)) : 0;
    }
    if (powerW > 0) powers.push(powerW);

    const tempC =
      idxTemp !== undefined && m[idxTemp] !== null && m[idxTemp] !== undefined
        ? Math.round(Number(m[idxTemp]))
        : undefined;

    const lat = idxLat !== undefined && m[idxLat] !== null ? Number(m[idxLat]) : 0;
    const lon = idxLon !== undefined && m[idxLon] !== null ? Number(m[idxLon]) : 0;

    points.push({
      id: `pt-${i}`,
      timestamp: rawTs ? new Date(rawTs).toISOString() : new Date().toISOString(),
      elapsed_time_sec: elapsedSec,
      latitude: lat,
      longitude: lon,
      altitude_m: altM,
      distance_m: distM,
      speed_kmh: speedKmh,
      heart_rate: hr,
      cadence: cad,
      gradient_pct: parseFloat(gradientPct.toFixed(1)),
      estimated_power_w: powerW,
      temperature_c: tempC
    });

    if (distM > prevDist) prevDist = distM;
    if (idxElev !== undefined && m[idxElev] !== null) prevAlt = altM;
  }

  if (points.length === 0) return null;

  const avgWatts = powers.length > 0 ? Math.round(powers.reduce((a, b) => a + b, 0) / powers.length) : undefined;
  const maxWatts = powers.length > 0 ? Math.max(...powers) : undefined;
  const maxCadence = cadences.length > 0 ? Math.max(...cadences) : undefined;

  return {
    telemetry_points: points,
    avg_watts_est: avgWatts,
    max_watts_est: maxWatts,
    normalized_power: avgWatts ? Math.round(avgWatts * 1.06) : undefined,
    max_cadence: maxCadence
  };
}

export async function syncGarminActivitiesLive(options?: {
  email?: string;
  password?: string;
  request?: Request;
}): Promise<{
  activities: StoredActivity[];
  syncedCount: number;
  session: GarminSessionData | null;
}> {
  const auth = await getAuthenticatedGarminClient(options);
  if (!auth) {
    return {
      activities: getStoredActivities(),
      syncedCount: 0,
      session: null
    };
  }

  let { client: GC, session } = auth;
  const TOKEN_FILE = getTmpPath('freeride_garmin_token.json');

  let rawActivities: any[] = [];
  try {
    rawActivities = await GC.getActivities(0, 50);
  } catch (err) {
    // Token might have expired; re-login if we have password
    if (session.password) {
      const freshGC = new GarminConnect({ username: session.email, password: session.password });
      await freshGC.login(session.email, session.password);
      try {
        const exported = freshGC.exportToken();
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(exported, null, 2), 'utf-8');
        session = saveGarminSession(session.email, session.password, exported);
      } catch {}
      rawActivities = await freshGC.getActivities(0, 50);
      cachedClient = freshGC;
      cachedEmail = session.email;
      lastLoginTime = Date.now();
      GC = freshGC;
    } else {
      throw err;
    }
  }

  if (!rawActivities || !Array.isArray(rawActivities)) {
    return {
      activities: getStoredActivities(),
      syncedCount: 0,
      session
    };
  }

  // Filter activities from August 5, 2026 onwards (or all if user has older rides they want, but prioritize >= Aug 4 2026 to avoid old test data)
  const cutoffTime = new Date('2026-08-04T00:00:00Z').getTime();
  let syncedCount = 0;

  for (const act of rawActivities) {
    if (!act || !act.activityId) continue;

    const startTimeStr = act.startTimeLocal || act.startTimeGMT || new Date().toISOString();
    const actTimestamp = new Date(startTimeStr).getTime();
    if (actTimestamp < cutoffTime) continue;

    const actId = String(act.activityId);
    const title = act.activityName || 'Salida Garmin';
    const typeKey = (act.activityType?.typeKey || '').toLowerCase();
    const isMTB = typeKey.includes('mountain') || typeKey.includes('mtb') || typeKey.includes('bouldering') || typeKey.includes('off_road');
    const activityType = isMTB ? 'MOUNTAIN_BIKE' : 'ROAD_BIKE';

    const distanceM = act.distance !== undefined && act.distance !== null ? Math.round(act.distance) : 0;
    const durationSec = (act.movingDuration || act.duration || act.elapsedDuration)
      ? Math.round(act.movingDuration || act.duration || act.elapsedDuration)
      : 0;
    const elapsedSec = (act.elapsedDuration || act.duration || durationSec)
      ? Math.round(act.elapsedDuration || act.duration || durationSec)
      : durationSec;

    const elevGainM = act.elevationGain !== undefined && act.elevationGain !== null ? Math.round(act.elevationGain) : 0;
    const elevLossM = act.elevationLoss !== undefined && act.elevationLoss !== null ? Math.round(act.elevationLoss) : 0;

    const avgSpeedKmh = act.averageSpeed ? parseFloat((act.averageSpeed * 3.6).toFixed(1)) : 0;
    const maxSpeedKmh = act.maxSpeed ? parseFloat((act.maxSpeed * 3.6).toFixed(1)) : 0;

    const avgHR = act.averageHR ? Math.round(act.averageHR) : undefined;
    const maxHR = act.maxHR ? Math.round(act.maxHR) : undefined;
    const avgCadence = (act.averageBikingCadenceInRevPerMinute || act.averageCadence)
      ? Math.round(act.averageBikingCadenceInRevPerMinute || act.averageCadence)
      : undefined;
    const maxCadence = (act.maxBikingCadenceInRevPerMinute || act.maxCadence)
      ? Math.round(act.maxBikingCadenceInRevPerMinute || act.maxCadence)
      : undefined;

    const avgPower = act.avgPower ? Math.round(act.avgPower) : undefined;
    const maxPower = act.maxPower ? Math.round(act.maxPower) : undefined;
    const normPower = act.normPower ? Math.round(act.normPower) : undefined;

    // Check if Garmin summary already includes hrTimeInZones
    let hrZones: Record<string, number> | undefined = undefined;
    const z1 = act.hrTimeInZone_1;
    const z2 = act.hrTimeInZone_2;
    const z3 = act.hrTimeInZone_3;
    const z4 = act.hrTimeInZone_4;
    const z5 = act.hrTimeInZone_5;
    if (
      typeof z1 === 'number' ||
      typeof z2 === 'number' ||
      typeof z3 === 'number' ||
      typeof z4 === 'number' ||
      typeof z5 === 'number'
    ) {
      const s1 = z1 || 0;
      const s2 = z2 || 0;
      const s3 = z3 || 0;
      const s4 = z4 || 0;
      const s5 = z5 || 0;
      const tot = s1 + s2 + s3 + s4 + s5;
      if (tot > 0) {
        hrZones = {
          Z1: Math.round((s1 / tot) * 100),
          Z2: Math.round((s2 / tot) * 100),
          Z3: Math.round((s3 / tot) * 100),
          Z4: Math.round((s4 / tot) * 100),
          Z5: Math.round((s5 / tot) * 100)
        };
      }
    }

    const storedActivity: StoredActivity = {
      id: actId,
      user_id: 'default-cyclist',
      title: title,
      description: `Sincronizada desde Garmin Connect (Garmin Edge 130)`,
      activity_type: activityType,
      file_type: 'FIT',
      start_time: new Date(startTimeStr).toISOString(),
      total_elapsed_time_sec: elapsedSec,
      moving_time_sec: durationSec,
      total_distance_m: distanceM,
      elevation_gain_m: elevGainM,
      elevation_loss_m: elevLossM,
      avg_speed_kmh: avgSpeedKmh,
      max_speed_kmh: maxSpeedKmh,
      avg_hr: avgHR,
      max_hr: maxHR,
      avg_cadence: avgCadence,
      max_cadence: maxCadence,
      avg_watts_est: avgPower,
      max_watts_est: maxPower,
      normalized_power: normPower,
      hr_zone_distribution: hrZones,
      cadence_distribution: undefined,
      mtb_technical_score: isMTB ? 7.5 : 1.5,
      created_at: new Date().toISOString(),
      telemetry_points: [] // Will preserve existing telemetry_points in saveActivity or load on demand
    };

    saveActivity(storedActivity);
    syncedCount++;
  }

  return {
    activities: getStoredActivities(),
    syncedCount,
    session
  };
}

export async function fetchGarminActivityTelemetry(
  actId: string,
  request?: Request
): Promise<StoredActivity | null> {
  let activity = getActivityById(actId);

  // If activity already has real telemetry points and HR zones, return immediately
  if (
    activity &&
    activity.telemetry_points &&
    activity.telemetry_points.length > 5 &&
    activity.hr_zone_distribution &&
    Object.keys(activity.hr_zone_distribution).length > 0
  ) {
    return activity;
  }

  const auth = await getAuthenticatedGarminClient({ request });
  if (!auth) {
    return activity;
  }

  const { client: GC } = auth;

  // If the activity summary itself wasn't in storage yet (e.g. cold container), fetch its summary from Garmin first
  if (!activity) {
    try {
      const actSummary: any = await GC.get(`https://connectapi.garmin.com/activity-service/activity/${actId}`);
      if (actSummary && (actSummary.activityId || actSummary.summaryDTO)) {
        const dto = actSummary.summaryDTO || actSummary;
        const typeKey = (actSummary.activityTypeDTO?.typeKey || actSummary.activityType?.typeKey || '').toLowerCase();
        const isMTB = typeKey.includes('mountain') || typeKey.includes('mtb');
        const startTimeStr = dto.startTimeLocal || dto.startTimeGMT || new Date().toISOString();

        activity = {
          id: String(actSummary.activityId || actId),
          user_id: 'default-cyclist',
          title: actSummary.activityName || 'Salida Garmin',
          description: 'Sincronizada desde Garmin Connect (Garmin Edge 130)',
          activity_type: isMTB ? 'MOUNTAIN_BIKE' : 'ROAD_BIKE',
          file_type: 'FIT',
          start_time: new Date(startTimeStr).toISOString(),
          total_elapsed_time_sec: Math.round(dto.elapsedDuration || dto.duration || 0),
          moving_time_sec: Math.round(dto.movingDuration || dto.duration || 0),
          total_distance_m: Math.round(dto.distance || 0),
          elevation_gain_m: Math.round(dto.elevationGain || 0),
          elevation_loss_m: Math.round(dto.elevationLoss || 0),
          avg_speed_kmh: dto.averageSpeed ? parseFloat((dto.averageSpeed * 3.6).toFixed(1)) : 0,
          max_speed_kmh: dto.maxSpeed ? parseFloat((dto.maxSpeed * 3.6).toFixed(1)) : 0,
          avg_hr: dto.averageHR ? Math.round(dto.averageHR) : undefined,
          max_hr: dto.maxHR ? Math.round(dto.maxHR) : undefined,
          avg_cadence: (dto.averageBikeCadence || dto.averageBikingCadenceInRevPerMinute)
            ? Math.round(dto.averageBikeCadence || dto.averageBikingCadenceInRevPerMinute)
            : undefined,
          max_cadence: (dto.maxBikeCadence || dto.maxBikingCadenceInRevPerMinute)
            ? Math.round(dto.maxBikeCadence || dto.maxBikingCadenceInRevPerMinute)
            : undefined,
          avg_watts_est: dto.averagePower ? Math.round(dto.averagePower) : undefined,
          max_watts_est: dto.maxPower ? Math.round(dto.maxPower) : undefined,
          normalized_power: dto.normalizedPower ? Math.round(dto.normalizedPower) : undefined,
          mtb_technical_score: isMTB ? 7.5 : 1.5,
          created_at: new Date().toISOString(),
          telemetry_points: []
        };
      }
    } catch (e) {
      console.error(`Error fetching single activity summary ${actId}:`, e);
    }
  }

  if (!activity) return null;

  let decodedTelemetry: any = null;

  // 1. Primary Method: Official Garmin Connect Activity Details JSON (exact data used by Garmin Connect charts)
  try {
    const detailsJson = await GC.get(
      `https://connectapi.garmin.com/activity-service/activity/${actId}/details?maxChartSize=1000&maxPolylineSize=1000`
    );
    decodedTelemetry = parseGarminActivityDetailsJson(detailsJson);
  } catch (detailsErr) {
    console.log(`Garmin details endpoint fallback for ${actId}:`, detailsErr);
  }

  // 2. Fallback Method A: Official Garmin Connect TCX Export
  if (!decodedTelemetry || !decodedTelemetry.telemetry_points?.length) {
    try {
      const tcxData = await GC.get(`https://connectapi.garmin.com/download-service/export/tcx/activity/${actId}`);
      if (tcxData && typeof tcxData === 'string' && tcxData.includes('TrainingCenterDatabase')) {
        decodedTelemetry = parseTCXContent(tcxData);
      }
    } catch (tcxErr) {
      console.log(`Garmin TCX export fallback for ${actId}:`, tcxErr);
    }
  }

  // 3. Fallback Method B: Official Garmin Connect GPX Export
  if (!decodedTelemetry || !decodedTelemetry.telemetry_points?.length) {
    try {
      const gpxData = await GC.get(`https://connectapi.garmin.com/download-service/export/gpx/activity/${actId}`);
      if (gpxData && typeof gpxData === 'string' && gpxData.includes('<gpx')) {
        decodedTelemetry = parseGPXContent(gpxData);
      }
    } catch (gpxErr) {
      console.log(`Garmin GPX export fallback for ${actId}:`, gpxErr);
    }
  }

  // 4. Fallback Method C: Original FIT ZIP Download
  if (!decodedTelemetry || !decodedTelemetry.telemetry_points?.length) {
    try {
      const downloadDir = path.join(os.tmpdir(), `garmin_fit_${actId}`);
      await GC.downloadOriginalActivityData({ activityId: Number(actId) as any }, downloadDir, 'zip');
      if (fs.existsSync(downloadDir)) {
        const files = fs.readdirSync(downloadDir);
        for (const f of files) {
          const fp = path.join(downloadDir, f);
          const buf = fs.readFileSync(fp);
          decodedTelemetry = await decodeFitBuffer(buf);
          try { fs.unlinkSync(fp); } catch {}
          if (decodedTelemetry?.telemetry_points?.length) break;
        }
      }
    } catch (fitErr) {
      console.log(`Garmin FIT download fallback for ${actId}:`, fitErr);
    }
  }

  // 5. Fetch Official Garmin Heart Rate Time in Zones
  let hrZones = activity.hr_zone_distribution;
  try {
    const zoneData: any = await GC.get(
      `https://connectapi.garmin.com/activity-service/activity/${actId}/hrTimeInZones`
    );
    if (Array.isArray(zoneData) && zoneData.length > 0) {
      const sorted = [...zoneData].sort((a, b) => (a.zoneNumber || 0) - (b.zoneNumber || 0));
      const totalSec = sorted.reduce((acc: number, z: any) => acc + (z.secsInZone || 0), 0);
      if (totalSec > 0) {
        const zMap: Record<string, number> = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 };
        for (const z of sorted) {
          const zNum = z.zoneNumber;
          if (zNum >= 1 && zNum <= 5) {
            zMap[`Z${zNum}`] = Math.round(((z.secsInZone || 0) / totalSec) * 100);
          }
        }
        hrZones = zMap;
      }
    }
  } catch (zErr) {
    console.log(`Garmin hrTimeInZones fallback for ${actId}:`, zErr);
  }

  const telemetryPoints = decodedTelemetry?.telemetry_points || activity.telemetry_points || [];

  // Calculate HR zones from real heart_rate points if hrTimeInZones wasn't returned
  if ((!hrZones || Object.keys(hrZones).length === 0) && telemetryPoints.length > 0) {
    const validHrs = telemetryPoints.map((p: any) => p.heart_rate).filter((h: any): h is number => typeof h === 'number' && h > 35);
    if (validHrs.length > 0) {
      const refMaxHr = Math.max(activity.max_hr || 185, ...validHrs);
      const counts = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 };
      for (const h of validHrs) {
        const pct = (h / refMaxHr) * 100;
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
    telemetry_points: telemetryPoints,
    hr_zone_distribution: hrZones,
    avg_watts_est: activity.avg_watts_est ?? decodedTelemetry?.avg_watts_est,
    max_watts_est: activity.max_watts_est ?? decodedTelemetry?.max_watts_est,
    normalized_power: activity.normalized_power ?? decodedTelemetry?.normalized_power,
    max_cadence: activity.max_cadence ?? decodedTelemetry?.max_cadence
  };

  return saveActivity(updatedActivity);
}
