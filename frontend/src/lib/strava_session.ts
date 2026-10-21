import fs from 'fs';
import path from 'path';
import os from 'os';

function getSessionFilePath(): string {
  const filename = 'freeride_strava_session.json';
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return path.join(os.tmpdir(), filename);
  }
  return path.join(process.cwd(), '..', filename);
}

export interface StravaSessionData {
  clientId?: string;
  clientSecret?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  athleteName?: string;
  athleteId?: string;
  connectedAt: string;
}

export function saveStravaSession(partial: Partial<StravaSessionData>): StravaSessionData {
  const current = getStravaSession();
  const data: StravaSessionData = {
    clientId: partial.clientId ?? current?.clientId ?? process.env.STRAVA_CLIENT_ID,
    clientSecret: partial.clientSecret ?? current?.clientSecret ?? process.env.STRAVA_CLIENT_SECRET,
    accessToken: partial.accessToken ?? current?.accessToken ?? process.env.STRAVA_ACCESS_TOKEN ?? '',
    refreshToken: partial.refreshToken ?? current?.refreshToken ?? process.env.STRAVA_REFRESH_TOKEN,
    expiresAt: partial.expiresAt ?? current?.expiresAt,
    athleteName: partial.athleteName ?? current?.athleteName,
    athleteId: partial.athleteId ?? current?.athleteId,
    connectedAt: new Date().toISOString()
  };

  try {
    const file = getSessionFilePath();
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving Strava session:', error);
  }

  return data;
}

export function getStravaSession(request?: Request): StravaSessionData | null {
  // 1. Hydrate from client header (solves Vercel serverless cold starts)
  if (request) {
    try {
      const authHeader = request.headers.get('x-strava-auth');
      if (authHeader) {
        const decoded = JSON.parse(Buffer.from(authHeader, 'base64').toString('utf-8'));
        if (decoded && (decoded.accessToken || decoded.refreshToken)) {
          try {
            const file = getSessionFilePath();
            if (!fs.existsSync(file)) {
              fs.writeFileSync(file, JSON.stringify(decoded, null, 2), 'utf-8');
            }
          } catch {}
          return decoded;
        }
      }
    } catch {}
  }

  // 2. Read from /tmp session file
  try {
    const file = getSessionFilePath();
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.accessToken || parsed.refreshToken)) {
        return parsed;
      }
    }
  } catch {}

  // 3. Fallback to Vercel Environment Variables
  if (process.env.STRAVA_ACCESS_TOKEN || (process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET && process.env.STRAVA_REFRESH_TOKEN)) {
    return {
      clientId: process.env.STRAVA_CLIENT_ID,
      clientSecret: process.env.STRAVA_CLIENT_SECRET,
      accessToken: process.env.STRAVA_ACCESS_TOKEN || '',
      refreshToken: process.env.STRAVA_REFRESH_TOKEN,
      connectedAt: new Date().toISOString()
    };
  }

  return null;
}

export async function refreshStravaTokenIfNeeded(
  session: StravaSessionData,
  forceRefresh = false
): Promise<StravaSessionData> {
  const nowSec = Math.floor(Date.now() / 1000);
  const isExpired =
    forceRefresh ||
    !session.accessToken ||
    (session.expiresAt !== undefined && session.expiresAt > 0 && session.expiresAt - nowSec < 300);

  if (!isExpired) {
    return session;
  }

  const clientId = session.clientId || process.env.STRAVA_CLIENT_ID;
  const clientSecret = session.clientSecret || process.env.STRAVA_CLIENT_SECRET;
  const refreshToken = session.refreshToken || process.env.STRAVA_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return session;
  }

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al renovar token de Strava: ${errText}`);
  }

  const tokenData = await res.json();
  return saveStravaSession({
    clientId,
    clientSecret,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || refreshToken,
    expiresAt: tokenData.expires_at,
    athleteName: session.athleteName,
    athleteId: session.athleteId
  });
}

export function clearStravaSession(): void {
  try {
    const file = getSessionFilePath();
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch {}
}
