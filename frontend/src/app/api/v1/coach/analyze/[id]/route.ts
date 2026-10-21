import { NextResponse } from 'next/server';
import { fetchGarminActivityTelemetry } from '@/lib/garmin_live';
import { analyzeSingleActivityWithCoach } from '@/lib/n8n_coach';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    let fallbackActivity: any = null;
    try {
      const body = await request.json();
      if (body && body.activity) {
        fallbackActivity = body.activity;
      }
    } catch {}

    const activity = (await fetchGarminActivityTelemetry(params.id, request)) || fallbackActivity;
    if (!activity) {
      return NextResponse.json({ detail: 'Actividad no encontrada para analizar' }, { status: 404 });
    }

    const insight = await analyzeSingleActivityWithCoach(activity);
    return NextResponse.json(insight);
  } catch (error: any) {
    console.error(`Error analyzing activity ${params.id}:`, error);
    return NextResponse.json(
      { detail: error.message || 'Error al generar el análisis del entrenador' },
      { status: 500 }
    );
  }
}
