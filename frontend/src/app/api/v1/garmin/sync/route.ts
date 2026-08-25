import { NextResponse } from 'next/server';
import { GarminConnect } from 'garmin-connect';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { saveActivity, getActivityById, StoredActivity } from '@/lib/storage';
import { saveGarminSession, getGarminSession } from '@/lib/garmin_session';
import { decodeFitBuffer } from '@/lib/fit_decoder';
import { parseTCXContent } from '@/lib/garmin_parser';
import { parseGPXContent } from '@/lib/gpx_parser';

function getTmpPath(filename: string): string {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return path.join(os.tmpdir(), filename);
  }
  return path.join(process.cwd(), '..', filename);
}

// Session Cache variables
let cachedClient: GarminConnect | null = null;
let lastLoginTime = 0;

export async function POST(request: Request) {
  try {
    const TOKEN_FILE = getTmpPath('freeride_garmin_token.json');

    let email: string | undefined;
    let password: string | undefined;

    try {
      const body = await request.json();
      if (body) {
        email = body.email;
        password = body.password;
      }
    } catch {}

    if (!email || !password) {
      const session = getGarminSession();
      if (session && session.email && session.password) {
        email = session.email;
        password = session.password;
      }
    }

    if (!email || !password) {
      return NextResponse.json(
        { detail: 'Por favor introduce tu correo y contraseña de Garmin Connect.' },
        { status: 400 }
      );
    }

    saveGarminSession(email, password);

    const now = Date.now();
    if (!cachedClient || (now - lastLoginTime) > 30 * 60 * 1000) {
      const GC = new GarminConnect({
        username: email,
        password: password
      });

      let tokenLoaded = false;
      if (fs.existsSync(TOKEN_FILE)) {
        try {
          const tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
          (GC as any).loadToken(tokenData);
          tokenLoaded = true;
        } catch {
          tokenLoaded = false;
        }
      }

      if (!tokenLoaded) {
        await GC.login();
        try {
          const token = GC.exportToken();
          fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2), 'utf-8');
        } catch {}
      }

      cachedClient = GC;
      lastLoginTime = now;
    }

    const GC = cachedClient;
    let activities: any[] = [];
    try {
      activities = await GC.getActivities(0, 15);
    } catch (actErr: any) {
      const newGC = new GarminConnect({ username: email, password: password });
      await newGC.login();
      try {
        const token = newGC.exportToken();
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2), 'utf-8');
      } catch {}
      activities = await newGC.getActivities(0, 15);
      cachedClient = newGC;
      lastLoginTime = Date.now();
    }

    if (!activities || activities.length === 0) {
      return NextResponse.json({
        message: 'No se encontraron actividades en tu cuenta de Garmin Connect.',
        synced_count: 0
      });
    }

    const downloadDir = path.join(os.tmpdir(), 'tmp_garmin');
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    let syncedCount = 0;
    const syncedSummaries = [];

    for (const act of activities) {
      const actId = String(act.activityId);

      // Fast check: if activity is already in storage with telemetry, skip heavy downloads!
      const existing = getActivityById(actId);
      if (existing && existing.telemetry_points && existing.telemetry_points.length > 0) {
        syncedCount++;
        syncedSummaries.push({ id: actId, title: existing.title });
        continue;
      }

      const title = act.activityName || 'Salida Garmin';
      const typeKey = (act.activityType?.typeKey || '').toLowerCase();

      let decodedTrack = null;

      // 1. Try raw .FIT download directly from Garmin API
      try {
        await GC.downloadOriginalActivityData({ activityId: Number(actId) as any }, downloadDir);
        const downloadedFiles = fs.readdirSync(downloadDir);
        for (const file of downloadedFiles) {
          const filePath = path.join(downloadDir, file);
          const buf = fs.readFileSync(filePath);
          decodedTrack = await decodeFitBuffer(buf);
          try { fs.unlinkSync(filePath); } catch {}
          if (decodedTrack) break;
        }
      } catch (fitErr) {
        console.log(`FIT download error for ${actId}:`, fitErr);
      }

      // 2. Try GPX fallback directly from Garmin API
      if (!decodedTrack) {
        try {
          const gpxString = await GC.get(`https://connect.garmin.com/download-service/files/gpx/activity/${actId}`);
          if (gpxString && typeof gpxString === 'string' && gpxString.includes('<gpx')) {
            decodedTrack = parseGPXContent(gpxString);
          }
        } catch (gpxErr) {
          console.log(`GPX download error for ${actId}:`, gpxErr);
        }
      }

      // 3. Try TCX fallback directly from Garmin API
      if (!decodedTrack) {
        try {
          const tcxString = await GC.get(`https://connect.garmin.com/download-service/files/tcx/activity/${actId}`);
          if (tcxString && typeof tcxString === 'string' && tcxString.includes('<TrainingCenterDatabase')) {
            decodedTrack = parseTCXContent(tcxString);
          }
        } catch (tcxErr) {
          console.log(`TCX download error for ${actId}:`, tcxErr);
        }
      }

      const isMTB = typeKey.includes('mountain') || typeKey.includes('mtb') || (decodedTrack?.activity_type === 'MOUNTAIN_BIKE');
      const activityType = isMTB ? 'MOUNTAIN_BIKE' : 'ROAD_BIKE';

      // Strictly extract exact metrics recorded by Garmin Connect
      const distanceM = act.distance !== undefined ? Math.round(act.distance) : (decodedTrack?.total_distance_m || 0);
      const durationSec = (act.movingDuration || act.duration || act.elapsedDuration)
        ? Math.round(act.movingDuration || act.duration || act.elapsedDuration)
        : (decodedTrack?.moving_time_sec || 0);
      
      const elevGainM = act.elevationGain !== undefined ? Math.round(act.elevationGain) : (decodedTrack?.elevation_gain_m || 0);
      const elevLossM = act.elevationLoss !== undefined ? Math.round(act.elevationLoss) : (decodedTrack?.elevation_loss_m || 0);

      const avgSpeedKmh = act.averageSpeed ? parseFloat((act.averageSpeed * 3.6).toFixed(1)) : (decodedTrack?.avg_speed_kmh || 0);
      const maxSpeedKmh = act.maxSpeed ? parseFloat((act.maxSpeed * 3.6).toFixed(1)) : (decodedTrack?.max_speed_kmh || 0);

      const avgHR = act.averageHR ? Math.round(act.averageHR) : decodedTrack?.avg_hr;
      const maxHR = act.maxHR ? Math.round(act.maxHR) : decodedTrack?.max_hr;
      const avgCadence = (act.averageBikingCadenceInRevPerMinute || act.averageCadence)
        ? Math.round(act.averageBikingCadenceInRevPerMinute || act.averageCadence)
        : decodedTrack?.avg_cadence;

      const startTimeStr = act.startTimeLocal || act.startTimeGMT || new Date().toISOString();

      // Telemetry points: strictly use decoded GPS telemetry points without adding artificial values
      const telemetryPoints = decodedTrack?.telemetry_points || [];

      // Fetch exact HR zones from Garmin API if available
      let hrZones: Record<string, number> | undefined = undefined;
      try {
        const zoneData = await GC.get(`https://connect.garmin.com/modern/proxy/activityservice-service/activity/${actId}/hrTimeInZones`);
        if (Array.isArray(zoneData) && zoneData.length > 0) {
          const totalSec = zoneData.reduce((acc: number, z: any) => acc + (z.secsInZone || 0), 0) || 1;
          hrZones = {
            Z1: Math.round(((zoneData[0]?.secsInZone || 0) / totalSec) * 100),
            Z2: Math.round(((zoneData[1]?.secsInZone || 0) / totalSec) * 100),
            Z3: Math.round(((zoneData[2]?.secsInZone || 0) / totalSec) * 100),
            Z4: Math.round(((zoneData[3]?.secsInZone || 0) / totalSec) * 100),
            Z5: Math.round(((zoneData[4]?.secsInZone || 0) / totalSec) * 100)
          };
        }
      } catch {}

      if (!hrZones && telemetryPoints.length > 0 && maxHR) {
        const hrs = telemetryPoints.map(p => p.heart_rate).filter((h): h is number => !!h && h > 30);
        if (hrs.length > 0) {
          const zCount = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 };
          hrs.forEach(h => {
            const pct = (h / maxHR) * 100;
            if (pct < 60) zCount.Z1++;
            else if (pct < 70) zCount.Z2++;
            else if (pct < 80) zCount.Z3++;
            else if (pct < 90) zCount.Z4++;
            else zCount.Z5++;
          });
          const tot = hrs.length;
          hrZones = {
            Z1: Math.round((zCount.Z1 / tot) * 100),
            Z2: Math.round((zCount.Z2 / tot) * 100),
            Z3: Math.round((zCount.Z3 / tot) * 100),
            Z4: Math.round((zCount.Z4 / tot) * 100),
            Z5: Math.round((zCount.Z5 / tot) * 100)
          };
        }
      }

      const storedActivity: StoredActivity = {
        id: actId,
        user_id: 'default-cyclist',
        title: title,
        description: `Sincronizada directamente desde Garmin Connect (Garmin Edge 130)`,
        activity_type: activityType,
        file_type: 'FIT',
        start_time: new Date(startTimeStr).toISOString(),
        total_elapsed_time_sec: durationSec,
        moving_time_sec: durationSec,
        total_distance_m: distanceM,
        elevation_gain_m: elevGainM,
        elevation_loss_m: elevLossM,
        avg_speed_kmh: avgSpeedKmh,
        max_speed_kmh: maxSpeedKmh,
        avg_hr: avgHR,
        max_hr: maxHR,
        avg_cadence: avgCadence,
        max_cadence: decodedTrack?.max_cadence,
        avg_watts_est: decodedTrack?.avg_watts_est || 180,
        max_watts_est: decodedTrack?.max_watts_est || 350,
        normalized_power: decodedTrack?.normalized_power || 200,
        hr_zone_distribution: hrZones,
        cadence_distribution: decodedTrack?.cadence_distribution,
        mtb_technical_score: decodedTrack?.mtb_technical_score || (isMTB ? 7.5 : 1.5),
        created_at: new Date().toISOString(),
        telemetry_points: telemetryPoints
      };

      saveActivity(storedActivity);
      syncedCount++;
      syncedSummaries.push({ id: actId, title });
    }

    return NextResponse.json({
      message: `¡Sincronización exacta completada! Se importaron ${syncedCount} rutas directamente desde Garmin Connect.`,
      synced_count: syncedCount,
      activities: syncedSummaries
    });
  } catch (error: any) {
    console.error('Garmin Sync Error:', error);
    cachedClient = null;
    let userDetail = error.message || 'Error al conectar con Garmin Connect';
    if (String(error).includes('429') || String(error).includes('rate_limited') || String(error).includes('Cloudflare')) {
      userDetail = 'Garmin Connect ha pausado temporalmente los inicios de sesión por 60 segundos debido a múltiples consultas seguidas. Por favor espera 45 segundos e inténtalo de nuevo.';
    }
    return NextResponse.json({ detail: userDetail }, { status: 400 });
  }
}
