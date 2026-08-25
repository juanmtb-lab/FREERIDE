import { NextResponse } from 'next/server';
import { getSettings, saveSettings, saveActivity, StoredActivity } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    let accessToken: string | undefined;
    try {
      const body = await request.json();
      if (body && body.access_token) {
        accessToken = body.access_token;
      }
    } catch {}

    if (!accessToken) {
      const settings = getSettings();
      accessToken = settings.strava_access_token;
    }

    if (!accessToken) {
      return NextResponse.json({
        detail: 'Por favor introduce tu Access Token de Strava Premium.'
      }, { status: 400 });
    }

    // Save token in settings
    saveSettings({ strava_access_token: accessToken });

    // Fetch activities from Strava API
    const stravaRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=10', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!stravaRes.ok) {
      const errText = await stravaRes.text();
      return NextResponse.json({
        detail: `Error al conectar con la API de Strava: ${errText || 'Token inválido o expirado'}`
      }, { status: 400 });
    }

    const stravaActivities = await stravaRes.json();

    if (!Array.isArray(stravaActivities) || stravaActivities.length === 0) {
      return NextResponse.json({
        message: 'No se encontraron actividades recientes en tu cuenta de Strava.',
        synced_count: 0
      });
    }

    let mergedCount = 0;
    const summaries = [];

    for (const stAct of stravaActivities) {
      const isRide = stAct.type === 'Ride' || stAct.type === 'VirtualRide' || stAct.type === 'EBikeRide';
      if (!isRide) continue;

      const actId = String(stAct.id);
      const isMTB = (stAct.sport_type || stAct.type || '').toLowerCase().includes('mountain');
      const activityType = isMTB ? 'MOUNTAIN_BIKE' : 'ROAD_BIKE';

      const distanceM = Math.round(stAct.distance || 0);
      const durationSec = Math.round(stAct.moving_time || stAct.elapsed_time || 0);
      const elevGainM = Math.round(stAct.total_elevation_gain || 0);
      const avgSpeedKmh = stAct.average_speed ? parseFloat((stAct.average_speed * 3.6).toFixed(1)) : 0;
      const maxSpeedKmh = stAct.max_speed ? parseFloat((stAct.max_speed * 3.6).toFixed(1)) : 0;

      const avgHR = stAct.average_heartrate ? Math.round(stAct.average_heartrate) : undefined;
      const maxHR = stAct.max_heartrate ? Math.round(stAct.max_heartrate) : undefined;

      const stored: StoredActivity = {
        id: `strava-${actId}`,
        user_id: 'default-cyclist',
        title: stAct.name || 'Salida Strava',
        description: `Importada desde Strava Premium`,
        activity_type: activityType,
        file_type: 'FIT',
        start_time: new Date(stAct.start_date || stAct.start_date_local).toISOString(),
        total_elapsed_time_sec: durationSec,
        moving_time_sec: durationSec,
        total_distance_m: distanceM,
        elevation_gain_m: elevGainM,
        elevation_loss_m: elevGainM,
        avg_speed_kmh: avgSpeedKmh,
        max_speed_kmh: maxSpeedKmh,
        avg_hr: avgHR,
        max_hr: maxHR,
        avg_watts_est: stAct.average_watts ? Math.round(stAct.average_watts) : undefined,
        max_watts_est: stAct.max_watts ? Math.round(stAct.max_watts) : undefined,
        mtb_technical_score: isMTB ? 7.2 : 1.5,
        created_at: new Date().toISOString(),
        telemetry_points: [],
        // Strava Premium fields
        strava_id: actId,
        strava_url: `https://www.strava.com/activities/${actId}`,
        suffer_score: stAct.suffer_score
      };

      // Calls saveActivity which automatically merges into existing Garmin activity if timestamps match!
      saveActivity(stored);
      mergedCount++;
      summaries.push({ id: actId, name: stAct.name });
    }

    return NextResponse.json({
      message: `¡Sincronización con Strava Premium completada! Se combinaron ${mergedCount} rutas sin duplicar salidas.`,
      synced_count: mergedCount,
      activities: summaries
    });
  } catch (error: any) {
    console.error('Strava Sync Error:', error);
    return NextResponse.json({ detail: error.message || 'Error al sincronizar con Strava' }, { status: 400 });
  }
}
