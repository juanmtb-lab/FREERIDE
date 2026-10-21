import { NextResponse } from 'next/server';
import { saveActivity, StoredActivity } from '@/lib/storage';
import { decodeFitBuffer } from '@/lib/fit_decoder';
import { parseGPXContent } from '@/lib/gpx_parser';
import { parseTCXContent } from '@/lib/garmin_parser';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title =
      (formData.get('title') as string) ||
      (file ? file.name.replace(/\.[^/.]+$/, '') : 'Salida Garmin Edge 130');
    const description = (formData.get('description') as string) || 'Archivo subido manualmente';

    if (!file) {
      return NextResponse.json({ detail: 'No se proporcionó ningún archivo' }, { status: 400 });
    }

    const fileNameLower = file.name.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let decoded: any = null;
    let fileType: 'FIT' | 'GPX' | 'TCX' = 'FIT';

    if (fileNameLower.endsWith('.gpx')) {
      fileType = 'GPX';
      decoded = parseGPXContent(buffer.toString('utf-8'));
    } else if (fileNameLower.endsWith('.tcx')) {
      fileType = 'TCX';
      decoded = parseTCXContent(buffer.toString('utf-8'));
    } else {
      fileType = 'FIT';
      decoded = await decodeFitBuffer(buffer);
    }

    if (!decoded || !decoded.telemetry_points || decoded.telemetry_points.length === 0) {
      return NextResponse.json(
        { detail: 'No se pudieron extraer puntos de telemetría válidos del archivo (.FIT, .GPX o .TCX).' },
        { status: 400 }
      );
    }

    const actId = `upload-${Date.now()}`;
    const firstPointTime = decoded.telemetry_points[0]?.timestamp || new Date().toISOString();

    const storedActivity: StoredActivity = {
      id: actId,
      user_id: 'default-cyclist',
      title: title,
      description: description,
      activity_type: decoded.activity_type,
      file_type: fileType,
      start_time: firstPointTime,
      total_elapsed_time_sec: decoded.moving_time_sec,
      moving_time_sec: decoded.moving_time_sec,
      total_distance_m: decoded.total_distance_m,
      elevation_gain_m: decoded.elevation_gain_m,
      elevation_loss_m: decoded.elevation_loss_m,
      avg_speed_kmh: decoded.avg_speed_kmh,
      max_speed_kmh: decoded.max_speed_kmh,
      avg_hr: decoded.avg_hr,
      max_hr: decoded.max_hr,
      avg_cadence: decoded.avg_cadence,
      max_cadence: decoded.max_cadence,
      avg_watts_est: decoded.avg_watts_est,
      max_watts_est: decoded.max_watts_est,
      normalized_power: decoded.normalized_power,
      hr_zone_distribution: decoded.hr_zone_distribution,
      cadence_distribution: decoded.cadence_distribution,
      mtb_technical_score: decoded.mtb_technical_score,
      created_at: new Date().toISOString(),
      telemetry_points: decoded.telemetry_points
    };

    saveActivity(storedActivity);
    return NextResponse.json(storedActivity);
  } catch (error: any) {
    return NextResponse.json(
      { detail: error.message || 'Error al procesar el archivo de telemetría' },
      { status: 500 }
    );
  }
}
