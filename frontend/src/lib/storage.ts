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
  // Strava integration fields (Unified single activity)
  strava_id?: string;
  strava_url?: string;
  suffer_score?: number;
  segment_efforts?: any[];
}

export interface FreerideSettings {
  n8n_webhook_url?: string;
  strava_access_token?: string;
  strava_athlete_id?: string;
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
    // Always return sorted newest first by start_time
    parsed.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
    return parsed;
  } catch (error) {
    console.error('Error reading freeride_data.json:', error);
    return [];
  }
}

// Single Unified Activity Merging Engine (Garmin + Strava without duplicates)
export function saveActivity(activity: StoredActivity): void {
  try {
    const file = getDataFilePath();
    const activities = getStoredActivities();

    const actTime = new Date(activity.start_time).getTime();

    // Check if an activity matching the same start time (within 5 minutes) already exists
    const duplicateIndex = activities.findIndex(existing => {
      if (existing.id === activity.id) return true;
      if (existing.strava_id && activity.strava_id && existing.strava_id === activity.strava_id) return true;
      
      const existingTime = new Date(existing.start_time).getTime();
      const timeDiffMs = Math.abs(existingTime - actTime);
      const distDiffPct = Math.abs(existing.total_distance_m - activity.total_distance_m) / Math.max(1, existing.total_distance_m);

      return timeDiffMs < 5 * 60 * 1000 && distDiffPct < 0.08;
    });

    if (duplicateIndex !== -1) {
      // Merge Strava / Garmin metadata into the existing single activity
      const existing = activities[duplicateIndex];
      const merged: StoredActivity = {
        ...existing,
        ...activity,
        // Keep telemetry points if new activity has them
        telemetry_points: activity.telemetry_points?.length ? activity.telemetry_points : existing.telemetry_points,
        // Merge Strava fields
        strava_id: activity.strava_id || existing.strava_id,
        strava_url: activity.strava_url || existing.strava_url,
        suffer_score: activity.suffer_score || existing.suffer_score,
        segment_efforts: activity.segment_efforts || existing.segment_efforts
      };
      activities[duplicateIndex] = merged;
    } else {
      activities.unshift(activity);
    }

    // Always sort by start_time descending (newest first)
    activities.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

    fs.writeFileSync(file, JSON.stringify(activities, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving activity:', error);
  }
}

export function getActivityById(id: string): StoredActivity | null {
  const activities = getStoredActivities();
  return activities.find(a => a.id === id || a.strava_id === id) || null;
}

// Settings storage for N8N Webhook & Strava Token
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
