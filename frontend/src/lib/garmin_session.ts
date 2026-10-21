import fs from 'fs';
import path from 'path';
import os from 'os';

function getSessionFilePath(): string {
  const filename = 'freeride_garmin_session.json';
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return path.join(os.tmpdir(), filename);
  }
  return path.join(process.cwd(), '..', filename);
}

export interface GarminTokensData {
  oauth1: any;
  oauth2: any;
}

export interface GarminSessionData {
  email: string;
  password?: string;
  tokens?: GarminTokensData;
  connectedAt: string;
}

export function saveGarminSession(email: string, password?: string, tokens?: GarminTokensData): GarminSessionData {
  const current = getGarminSession();
  const data: GarminSessionData = {
    email: email || current?.email || '',
    password: password || current?.password,
    tokens: tokens || current?.tokens,
    connectedAt: new Date().toISOString()
  };

  try {
    const file = getSessionFilePath();
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving Garmin session:', error);
  }

  return data;
}

export function getGarminSession(request?: Request): GarminSessionData | null {
  // 1. Check request headers sent by client localStorage (solves Vercel serverless cold starts)
  if (request) {
    try {
      const authHeader = request.headers.get('x-garmin-auth');
      if (authHeader) {
        const decoded = JSON.parse(Buffer.from(authHeader, 'base64').toString('utf-8'));
        if (decoded && decoded.email && (decoded.password || decoded.tokens)) {
          // Persist into this container's /tmp as well
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

  // 2. Check local /tmp file
  try {
    const file = getSessionFilePath();
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.email) {
        return parsed;
      }
    }
  } catch {}

  // 3. Check Vercel Environment Variables fallback
  if (process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD) {
    return {
      email: process.env.GARMIN_EMAIL,
      password: process.env.GARMIN_PASSWORD,
      connectedAt: new Date().toISOString()
    };
  }

  return null;
}

export function clearGarminSession(): void {
  try {
    const file = getSessionFilePath();
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    const tokenFile = path.join(os.tmpdir(), 'freeride_garmin_token.json');
    if (fs.existsSync(tokenFile)) {
      fs.unlinkSync(tokenFile);
    }
  } catch {}
}
