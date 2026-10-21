import { NextResponse } from 'next/server';
import { getStravaSession, saveStravaSession } from '@/lib/strava_session';
import { syncStravaActivitiesLive } from '@/lib/strava_live';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const clientIdParam = url.searchParams.get('client_id');
  const clientSecretParam = url.searchParams.get('client_secret');

  if (!code) {
    return NextResponse.redirect(new URL('/?strava_error=missing_code', request.url));
  }

  const existing = getStravaSession(request);
  const clientId = clientIdParam || existing?.clientId || process.env.STRAVA_CLIENT_ID;
  const clientSecret = clientSecretParam || existing?.clientSecret || process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/?strava_error=missing_credentials', request.url));
  }

  try {
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL('/?strava_error=oauth_failed', request.url));
    }

    const tokenData = await tokenRes.json();
    const athlete = tokenData.athlete || {};
    const athleteName = [athlete.firstname, athlete.lastname].filter(Boolean).join(' ') || 'Atleta Strava';

    const saved = saveStravaSession({
      clientId,
      clientSecret,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_at,
      athleteName,
      athleteId: String(athlete.id || '')
    });

    await syncStravaActivitiesLive({
      clientId,
      clientSecret,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token
    });

    const encodedAuth = Buffer.from(JSON.stringify(saved), 'utf-8').toString('base64');
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('strava_connected', '1');
    redirectUrl.searchParams.set('strava_auth', encodedAuth);
    redirectUrl.searchParams.set('athlete', athleteName);

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error('Strava OAuth callback error:', err);
    return NextResponse.redirect(new URL('/?strava_error=server_error', request.url));
  }
}
