import { NextResponse } from 'next/server';
import { fetchStravaActivityTelemetry } from '@/lib/strava_live';
import { analyzeSingleActivityWithCoach } from '@/lib/n8n_coach';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    let fallbackActivity: any = null;
    let explicitWebhook: string | undefined;
    let athleteProfile: any = null;
    let riderMetrics: any = null;

    try {
      const body = await request.json();
      if (body) {
        if (body.activity) fallbackActivity = body.activity;
        if (body.webhook_url) explicitWebhook = body.webhook_url;
        if (body.athlete_profile) athleteProfile = body.athlete_profile;
        if (body.rider_metrics) riderMetrics = body.rider_metrics;
      }
    } catch {}

    const headerWebhook = request.headers.get('x-n8n-webhook-url') || undefined;
    const webhookUrl = explicitWebhook || headerWebhook;

    const activity = (await fetchStravaActivityTelemetry(params.id, request)) || fallbackActivity;
    if (!activity) {
      return NextResponse.json({ detail: 'Actividad no encontrada para analizar' }, { status: 404 });
    }

    const insight = await analyzeSingleActivityWithCoach(activity, {
      webhookUrlOverride: webhookUrl,
      request,
      athleteProfile,
      riderMetrics
    });
    return NextResponse.json(insight);
  } catch (error: any) {
    console.error(`Error analyzing activity ${params.id}:`, error);
    return NextResponse.json(
      { detail: error.message || 'Error al generar el análisis del entrenador' },
      { status: 500 }
    );
  }
}
