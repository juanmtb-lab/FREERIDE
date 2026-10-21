import { NextResponse } from 'next/server';
import { syncStravaActivitiesLive } from '@/lib/strava_live';
import { getStravaSession, saveStravaSession } from '@/lib/strava_session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    let clientId: string | undefined;
    let clientSecret: string | undefined;
    let accessToken: string | undefined;
    let refreshToken: string | undefined;

    try {
      const body = await request.json();
      if (body) {
        clientId = body.client_id?.trim();
        clientSecret = body.client_secret?.trim();
        accessToken = body.access_token?.trim();
        refreshToken = body.refresh_token?.trim();
      }
    } catch {}

    const existing = getStravaSession(request);
    if (!clientId) clientId = existing?.clientId;
    if (!clientSecret) clientSecret = existing?.clientSecret;
    if (!accessToken) accessToken = existing?.accessToken;
    if (!refreshToken) refreshToken = existing?.refreshToken;

    if (!accessToken && !(clientId && clientSecret && refreshToken)) {
      return NextResponse.json(
        {
          detail:
            'Introduce tu Access Token de Strava, o bien tu Client ID + Client Secret + Refresh Token desde strava.com/settings/api.'
        },
        { status: 400 }
      );
    }

    if (clientId || clientSecret || accessToken || refreshToken) {
      saveStravaSession({
        clientId,
        clientSecret,
        accessToken: accessToken || '',
        refreshToken
      });
    }

    const { activities, syncedCount, session } = await syncStravaActivitiesLive({
      clientId,
      clientSecret,
      accessToken,
      refreshToken,
      request
    });

    const summaries = activities.map(({ telemetry_points, ...summary }) => summary);

    const encodedAuth = session
      ? Buffer.from(JSON.stringify(session), 'utf-8').toString('base64')
      : undefined;

    return NextResponse.json({
      message: `¡Sincronización con Strava completada! Se han importado ${syncedCount} entrenamientos reales.`,
      synced_count: syncedCount,
      activities: summaries,
      strava_auth: encodedAuth,
      athleteName: session?.athleteName || 'Atleta Strava'
    });
  } catch (error: any) {
    console.error('Strava Sync Error:', error);
    return NextResponse.json(
      { detail: error.message || 'Error al sincronizar con la API de Strava' },
      { status: 400 }
    );
  }
}
