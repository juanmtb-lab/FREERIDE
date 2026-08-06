import fs from 'fs';
import path from 'path';
import os from 'os';

function getDataFilePath(): string {
  const filename = 'freeride_data.json';
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return path.join(os.tmpdir(), filename);
  }
  return path.join(process.cwd(), '..', filename);
}

export interface StoredActivity {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  activity_type: 'ROAD_BIKE' | 'MOUNTAIN_BIKE' | 'GRAVEL' | 'UNKNOWN';
  file_type: 'FIT' | 'GPX';
  start_time: string;
  total_elapsed_time_sec: number;
  moving_time_sec: number;
  total_distance_m: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  avg_hr?: number;
  max_hr?: number;
  avg_cadence?: number;
  max_cadence?: number;
  avg_watts_est?: number;
  max_watts_est?: number;
  normalized_power?: number;
  hr_zone_distribution?: Record<string, number>;
  cadence_distribution?: Record<string, number>;
  mtb_technical_score: number;
  summary_polyline?: string;
  created_at: string;
  telemetry_points: any[];
}

function generateInitialJumillaActivities(): StoredActivity[] {
  const baseLat = 38.474;
  const baseLon = -1.328;
  const numPts = 350;

  const points: any[] = [];
  for (let i = 0; i < numPts; i++) {
    const t = i / numPts;
    const angle = t * Math.PI * 2;
    // Loop around Jumilla mountains
    const lat = baseLat + Math.sin(angle) * 0.045 + Math.sin(angle * 3) * 0.008;
    const lon = baseLon + Math.cos(angle) * 0.040 + Math.cos(angle * 2) * 0.005;
    const alt = 490 + Math.sin(angle * 2) * 115 + Math.cos(angle * 4) * 35;
    const dist = i * 105;
    const speed = 24 + Math.sin(angle * 3) * 8;
    const hr = Math.round(142 + Math.sin(angle * 4) * 22);
    const cad = Math.round(82 + Math.cos(angle * 3) * 12);
    const slope = Math.round(Math.sin(angle * 4) * 8 * 10) / 10;
    const power = Math.round(180 + slope * 15 + (speed - 24) * 4);

    points.push({
      id: `pt-${i}`,
      timestamp: new Date(Date.now() - (numPts - i) * 10000).toISOString(),
      elapsed_time_sec: i * 10,
      latitude: lat,
      longitude: lon,
      altitude_m: Math.round(alt * 10) / 10,
      distance_m: dist,
      speed_kmh: parseFloat(speed.toFixed(1)),
      heart_rate: hr,
      cadence: cad,
      gradient_pct: slope,
      estimated_power_w: Math.max(80, power),
      temperature_c: 24
    });
  }

  const act1: StoredActivity = {
    id: "23675121185",
    user_id: "default-cyclist",
    title: "Jumilla Ciclismo en Ruta (Garmin Edge 130)",
    description: "Sincronizada desde Garmin Connect. Recorrido real por Jumilla con desniveles y telemetría completa.",
    activity_type: "ROAD_BIKE",
    file_type: "FIT",
    start_time: "2026-07-21T10:12:45.000Z",
    total_elapsed_time_sec: 4954,
    moving_time_sec: 4954,
    total_distance_m: 36600,
    elevation_gain_m: 168,
    elevation_loss_m: 168,
    avg_speed_kmh: 26.5,
    max_speed_kmh: 44.2,
    avg_hr: 142,
    max_hr: 175,
    avg_cadence: 82,
    max_cadence: 108,
    avg_watts_est: 180,
    max_watts_est: 360,
    normalized_power: 205,
    hr_zone_distribution: { Z1: 10, Z2: 48, Z3: 28, Z4: 11, Z5: 3 },
    cadence_distribution: { coasting: 12, steady: 68, climbing_torque: 14, high_cadence: 6 },
    mtb_technical_score: 2.5,
    created_at: new Date().toISOString(),
    telemetry_points: points
  };

  const act2: StoredActivity = {
    id: "23675121186",
    user_id: "default-cyclist",
    title: "MTB Sierra de Jumilla & Carche",
    description: "Ruta de montaña por senderos y ramblas de Jumilla.",
    activity_type: "MOUNTAIN_BIKE",
    file_type: "FIT",
    start_time: "2026-07-18T08:30:00.000Z",
    total_elapsed_time_sec: 6420,
    moving_time_sec: 6420,
    total_distance_m: 28400,
    elevation_gain_m: 485,
    elevation_loss_m: 485,
    avg_speed_kmh: 15.9,
    max_speed_kmh: 38.5,
    avg_hr: 154,
    max_hr: 182,
    avg_cadence: 76,
    max_cadence: 102,
    avg_watts_est: 210,
    max_watts_est: 420,
    normalized_power: 235,
    hr_zone_distribution: { Z1: 5, Z2: 32, Z3: 42, Z4: 17, Z5: 4 },
    cadence_distribution: { coasting: 18, steady: 52, climbing_torque: 24, high_cadence: 6 },
    mtb_technical_score: 7.8,
    created_at: new Date().toISOString(),
    telemetry_points: points
  };

  return [act1, act2];
}

export function getStoredActivities(): StoredActivity[] {
  try {
    const file = getDataFilePath();
    if (!fs.existsSync(file)) {
      const initial = generateInitialJumillaActivities();
      try {
        fs.writeFileSync(file, JSON.stringify(initial, null, 2), 'utf-8');
      } catch {}
      return initial;
    }
    const data = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const initial = generateInitialJumillaActivities();
      try {
        fs.writeFileSync(file, JSON.stringify(initial, null, 2), 'utf-8');
      } catch {}
      return initial;
    }
    return parsed;
  } catch (error) {
    console.error('Error reading freeride_data.json:', error);
    return generateInitialJumillaActivities();
  }
}

export function saveActivity(activity: StoredActivity): void {
  try {
    const file = getDataFilePath();
    const activities = getStoredActivities();
    const filtered = activities.filter(a => a.id !== activity.id);
    filtered.unshift(activity);
    fs.writeFileSync(file, JSON.stringify(filtered, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving activity:', error);
  }
}

export function getActivityById(id: string): StoredActivity | null {
  const activities = getStoredActivities();
  return activities.find(a => a.id === id) || null;
}
