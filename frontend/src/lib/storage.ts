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

export function getStoredActivities(): StoredActivity[] {
  try {
    const file = getDataFilePath();
    if (!fs.existsSync(file)) {
      return [];
    }
    const data = fs.readFileSync(file, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading freeride_data.json:', error);
    return [];
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
