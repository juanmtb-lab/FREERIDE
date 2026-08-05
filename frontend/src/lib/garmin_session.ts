import fs from 'fs';
import path from 'path';

const SESSION_FILE = path.join(process.cwd(), '..', 'freeride_garmin_session.json');

export interface GarminSessionData {
  email: string;
  password?: string;
  connectedAt: string;
}

export function saveGarminSession(email: string, password?: string): void {
  const data: GarminSessionData = {
    email,
    password,
    connectedAt: new Date().toISOString()
  };
  fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function getGarminSession(): GarminSessionData | null {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null;
    const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearGarminSession(): void {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
  } catch {}
}
