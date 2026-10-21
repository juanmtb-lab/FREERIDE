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

function getSettingsFilePath(): string {
  const filename = 'freeride_settings.json';
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
  file_type: 'FIT' | 'GPX' | 'TCX';
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

export interface FreerideSettings {
  n8n_webhook_url?: string;
  rider_weight_kg?: number;
  rider_max_hr?: number;
  rider_ftp?: number;
}

export function getStoredActivities(): StoredActivity[] {
  try {
    const file = getDataFilePath();
    if (!fs.existsSync(file)) {
      return [];
    }
    const data = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      return [];
    }
    parsed.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
    return parsed;
  } catch (error) {
    console.error('Error reading freeride_data.json:', error);
    return [];
  }
}

export function saveActivitiesBatch(newActivities: StoredActivity[]): StoredActivity[] {
  try {
    const file = getDataFilePath();
    const existingList = getStoredActivities();
    const map = new Map<string, StoredActivity>();

    for (const item of existingList) {
      map.set(String(item.id), item);
    }

    for (const activity of newActivities) {
      const idKey = String(activity.id);
      const existing = map.get(idKey);
      if (existing) {
        map.set(idKey, {
          ...existing,
          ...activity,
          telemetry_points:
            activity.telemetry_points && activity.telemetry_points.length > 0
              ? activity.telemetry_points
              : existing.telemetry_points || [],
          hr_zone_distribution:
            activity.hr_zone_distribution && Object.keys(activity.hr_zone_distribution).length > 0
              ? activity.hr_zone_distribution
              : existing.hr_zone_distribution,
          avg_watts_est: activity.avg_watts_est ?? existing.avg_watts_est,
          max_watts_est: activity.max_watts_est ?? existing.max_watts_est,
          normalized_power: activity.normalized_power ?? existing.normalized_power,
          max_cadence: activity.max_cadence ?? existing.max_cadence,
          cadence_distribution: activity.cadence_distribution ?? existing.cadence_distribution,
        });
      } else {
        map.set(idKey, activity);
      }
    }

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    );

    try {
      fs.writeFileSync(file, JSON.stringify(merged, null, 2), 'utf-8');
    } catch (writeErr) {
      console.error('Error writing batch activities to disk:', writeErr);
    }

    return merged;
  } catch (error) {
    console.error('Error in saveActivitiesBatch:', error);
    return newActivities;
  }
}

export function saveActivity(activity: StoredActivity): StoredActivity {
  const merged = saveActivitiesBatch([activity]);
  return merged.find(a => String(a.id) === String(activity.id)) || activity;
}

export function getActivityById(id: string): StoredActivity | null {
  const activities = getStoredActivities();
  return activities.find(a => String(a.id) === String(id)) || null;
}

export function deleteActivityById(id: string): boolean {
  try {
    const file = getDataFilePath();
    const activities = getStoredActivities();
    const filtered = activities.filter(a => String(a.id) !== String(id));
    fs.writeFileSync(file, JSON.stringify(filtered, null, 2), 'utf-8');
    return filtered.length < activities.length;
  } catch (error) {
    console.error('Error deleting activity:', error);
    return false;
  }
}

export function getSettings(): FreerideSettings {
  try {
    const file = getSettingsFilePath();
    if (!fs.existsSync(file)) return {};
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveSettings(settings: Partial<FreerideSettings>): FreerideSettings {
  try {
    const file = getSettingsFilePath();
    const current = getSettings();
    const updated = { ...current, ...settings };
    fs.writeFileSync(file, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  } catch (error) {
    console.error('Error saving settings:', error);
    return getSettings();
  }
}
