import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), '..', 'freeride_data.json');

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
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading freeride_data.json:', error);
    return [];
  }
}

export function saveActivity(activity: StoredActivity): void {
  const activities = getStoredActivities();
  // Filter out duplicate by id or title
  const filtered = activities.filter(a => a.id !== activity.id);
  filtered.unshift(activity);
  fs.writeFileSync(DATA_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
}

export function getActivityById(id: string): StoredActivity | null {
  const activities = getStoredActivities();
  return activities.find(a => a.id === id) || null;
}
