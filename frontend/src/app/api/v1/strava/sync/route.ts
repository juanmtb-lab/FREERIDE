import { NextResponse } from 'next/server';
import { syncStravaActivitiesLive } from '@/lib/strava_live';
import {
  getStravaSession,
  saveStravaSession,
  exchangeStravaCodeForToken
} from '@/lib/strava_session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id') || undefined;
    const isOwner = !userId || userId === 'principal' || userId === 'usr_jmtb' || userId === 'default';

    let clientId: string | undefined;
    let clientSecret: string | undefined;
    let accessToken: string | undefined;
    let refreshToken: string | undefined;
    let oauthCode: string | undefined;

    try {
      const body = await request.json();
      if (body) {
        clientId = body.client_id?.trim();
        clientSecret = body.client_secret?.trim();
        accessToken = body.access_token?.trim();
        refreshToken = body.refresh_token?.trim();
        oauthCode = body.code?.trim();
      }
    } catch {}

    const existing = getStravaSession(request);
    if (!clientId) clientId = existing?.clientId || (isOwner ? process.env.STRAVA_CLIENT_ID : undefined);
    if (!clientSecret) clientSecret = existing?.clientSecret || (isOwner ? process.env.STRAVA_CLIENT_SECRET : undefined);
    if (!accessToken) accessToken = existing?.accessToken || (isOwner ? process.env.STRAVA_ACCESS_TOKEN : undefined);
    if (!refreshToken) refreshToken = existing?.refreshToken || (isOwner ? process.env.STRAVA_REFRESH_TOKEN : undefined);

    // If returning from 1-click Strava OAuth2 authorize screen with ?code=...
    if (oauthCode) {
      if (!clientId || !clientSecret) {
        return NextResponse.json(
          {
            detail:
              'Para completar la autorización de Strava, introduce tu Client ID y Client Secret en el formulario de conexión.'
          },
          { status: 400 }
        );
      }

      const oauthSession = await exchangeStravaCodeForToken(oauthCode, clientId, clientSecret, userId);
      accessToken = oauthSession.accessToken;
      refreshToken = oauthSession.refreshToken;
    }

    if (!accessToken && !(clientId && clientSecret && refreshToken)) {
      return NextResponse.json(
        {
          detail:
            'Introduce tu Client ID y Client Secret y pulsa "Autorizar con Strava en 1 Clic", o bien introduce tu Access Token y Refresh Token desde strava.com/settings/api.'
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
      }, userId);
    }

    const { activities, syncedCount, session } = await syncStravaActivitiesLive({
      clientId,
      clientSecret,
      accessToken,
      refreshToken,
      request,
      userId
    });

    const summaries = activities.map(({ telemetry_points, ...summary }) => summary);

    const encodedAuth = session
      ? Buffer.from(JSON.stringify(session), 'utf-8').toString('base64')
      : undefined;

    return NextResponse.json({
      message: `¡Sincronización con Strava completada! Se han importado ${syncedCount} entrenamientos reales de tu historial.`,
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
