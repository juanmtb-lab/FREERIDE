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

export interface GarminSessionData {
  email: string;
  password?: string;
  connectedAt: string;
}

export function saveGarminSession(email: string, password?: string): void {
  try {
    const file = getSessionFilePath();
    const data: GarminSessionData = {
      email,
      password,
      connectedAt: new Date().toISOString()
    };
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving Garmin session:', error);
  }
}

export function getGarminSession(): GarminSessionData | null {
  try {
    const file = getSessionFilePath();
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearGarminSession(): void {
  try {
    const file = getSessionFilePath();
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch {}
}
