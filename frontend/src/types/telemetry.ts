export interface TelemetryPoint {
  id: string;
  timestamp: string;
  elapsed_time_sec: number;
  latitude: number;
  longitude: number;
  altitude_m: number;
  distance_m: number;
  speed_kmh: number;
  heart_rate?: number;
  cadence?: number;
  gradient_pct: number;
  estimated_power_w: number;
  temperature_c?: number;
}

export interface ActivitySummary {
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
  gradient_distribution?: Record<string, number>;
  mtb_technical_score: number;
  summary_polyline?: string;
  created_at: string;
}

export interface ActivityDetail extends ActivitySummary {
  telemetry_points: TelemetryPoint[];
}

export interface AIInsight {
  id: string;
  user_id: string;
  activity_id?: string;
  insight_type: string;
  title: string;
  content_es: string;
  metrics_summary?: Record<string, any>;
  created_at: string;
}
