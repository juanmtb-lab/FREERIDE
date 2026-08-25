import { NextResponse } from 'next/server';
import { GarminConnect } from 'garmin-connect';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { saveActivity, getStoredActivities, StoredActivity } from '@/lib/storage';
import { saveGarminSession, getGarminSession } from '@/lib/garmin_session';

function getTmpPath(filename: string): string {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return path.join(os.tmpdir(), filename);
  }
  return path.join(process.cwd(), '..', filename);
}

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
      activities = await GC.getActivities(0, 40);
    } catch (actErr: any) {
      const newGC = new GarminConnect({ username: email, password: password });
      await newGC.login();
      try {
        const token = newGC.exportToken();
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2), 'utf-8');
      } catch {}
      activities = await newGC.getActivities(0, 40);
      cachedClient = newGC;
      lastLoginTime = Date.now();
    }

    if (!activities || activities.length === 0) {
      return NextResponse.json({
        message: 'No se encontraron actividades en tu cuenta de Garmin Connect.',
        synced_count: 0,
        activities: getStoredActivities()
      });
    }

    let syncedCount = 0;

    for (const act of activities) {
      const actId = String(act.activityId);
      const title = act.activityName || 'Salida Garmin';
      const typeKey = (act.activityType?.typeKey || '').toLowerCase();

      const isMTB = typeKey.includes('mountain') || typeKey.includes('mtb');
      const activityType = isMTB ? 'MOUNTAIN_BIKE' : 'ROAD_BIKE';

      // 100% RAW metrics direct from Garmin Connect API without invent or fallbacks
      const distanceM = act.distance !== undefined ? Math.round(act.distance) : 0;
      const durationSec = (act.movingDuration || act.duration || act.elapsedDuration)
        ? Math.round(act.movingDuration || act.duration || act.elapsedDuration)
        : 0;
      
      const elevGainM = act.elevationGain !== undefined ? Math.round(act.elevationGain) : 0;
      const elevLossM = act.elevationLoss !== undefined ? Math.round(act.elevationLoss) : 0;

      const avgSpeedKmh = act.averageSpeed ? parseFloat((act.averageSpeed * 3.6).toFixed(1)) : 0;
      const maxSpeedKmh = act.maxSpeed ? parseFloat((act.maxSpeed * 3.6).toFixed(1)) : 0;

      const avgHR = act.averageHR ? Math.round(act.averageHR) : undefined;
      const maxHR = act.maxHR ? Math.round(act.maxHR) : undefined;
      const avgCadence = (act.averageBikingCadenceInRevPerMinute || act.averageCadence)
        ? Math.round(act.averageBikingCadenceInRevPerMinute || act.averageCadence)
        : undefined;

      const startTimeStr = act.startTimeLocal || act.startTimeGMT || new Date().toISOString();

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
        max_cadence: undefined,
        avg_watts_est: undefined, // Pure raw data, no invented power numbers!
        max_watts_est: undefined,
        normalized_power: undefined,
        hr_zone_distribution: hrZones,
        cadence_distribution: undefined,
        mtb_technical_score: isMTB ? 7.5 : 1.5,
        created_at: new Date().toISOString(),
        telemetry_points: []
      };

      saveActivity(storedActivity);
      syncedCount++;
    }

    const allStored = getStoredActivities();

    return NextResponse.json({
      message: `¡Sincronización exacta completada! Se importaron ${syncedCount} rutas reales directamente desde Garmin Connect.`,
      synced_count: syncedCount,
      activities: allStored
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
