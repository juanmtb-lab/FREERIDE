import { XMLParser } from 'fast-xml-parser';

export interface RawTelemetryPoint {
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
}

export interface ParsedGarminTrack {
  activity_type: 'ROAD_BIKE' | 'MOUNTAIN_BIKE' | 'GRAVEL';
  total_distance_m: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  moving_time_sec: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  avg_hr?: number;
  max_hr?: number;
  avg_cadence?: number;
  max_cadence?: number;
  avg_watts_est: number;
  max_watts_est: number;
  normalized_power: number;
  mtb_technical_score: number;
  hr_zone_distribution: Record<string, number>;
  cadence_distribution: Record<string, number>;
  telemetry_points: RawTelemetryPoint[];
}

export function parseTCXContent(tcxString: string, riderWeightKg = 72, maxHr = 190): ParsedGarminTrack | null {
  try {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const parsed = parser.parse(tcxString);

    const activities = parsed.TrainingCenterDatabase?.Activities?.Activity;
    if (!activities) return null;

    const activity = Array.isArray(activities) ? activities[0] : activities;
    const lap = Array.isArray(activity.Lap) ? activity.Lap[0] : activity.Lap;
    if (!lap || !lap.Track || !lap.Track.Trackpoint) return null;

    const rawTrackpoints = Array.isArray(lap.Track.Trackpoint) ? lap.Track.Trackpoint : [lap.Track.Trackpoint];

    const points: RawTelemetryPoint[] = [];
    let startTime: Date | null = null;
    let cumElevGain = 0;
    let cumElevLoss = 0;
    let prevAlt: number | null = null;
    let prevDist = 0;
    let prevTime: Date | null = null;

    const hrs: number[] = [];
    const cadences: number[] = [];
    const speeds: number[] = [];
    const powers: number[] = [];

    const hrZones = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
    const cadDist = { coasting: 0, steady: 0, climbing_torque: 0, high_cadence: 0 };

    for (let i = 0; i < rawTrackpoints.length; i++) {
      const tp = rawTrackpoints[i];
      if (!tp.Time) continue;

      const time = new Date(tp.Time);
      if (!startTime) startTime = time;

      const elapsedSec = (time.getTime() - startTime.getTime()) / 1000;

      const lat = tp.Position?.LatitudeDegrees ? parseFloat(tp.Position.LatitudeDegrees) : 0;
      const lon = tp.Position?.LongitudeDegrees ? parseFloat(tp.Position.LongitudeDegrees) : 0;
      const alt = tp.AltitudeMeters ? parseFloat(tp.AltitudeMeters) : 0;
      const dist = tp.DistanceMeters ? parseFloat(tp.DistanceMeters) : prevDist;

      if (lat === 0 && lon === 0) continue; // Skip unlocated points

      // Calculate elevation gain & loss
      if (prevAlt !== null) {
        const altDelta = alt - prevAlt;
        if (altDelta > 0.4) cumElevGain += altDelta;
        else if (altDelta < -0.4) cumElevLoss += Math.abs(altDelta);
      }

      // Calculate speed
      let speedKmh = 0;
      if (prevTime !== null && prevDist > 0) {
        const dt = (time.getTime() - prevTime.getTime()) / 1000;
        const dd = dist - prevDist;
        if (dt > 0 && dd >= 0) {
          speedKmh = (dd / dt) * 3.6;
        }
      }

      // Extract HR & Cadence
      let hr: number | undefined = undefined;
      if (tp.HeartRateBpm?.Value) {
        hr = parseInt(tp.HeartRateBpm.Value);
        if (hr > 30) hrs.push(hr);
      }

      let cad: number | undefined = undefined;
      if (tp.Cadence) {
        cad = parseInt(tp.Cadence);
        if (cad > 0) cadences.push(cad);
      }

      // Calculate slope %
      let gradientPct = 0;
      const distDelta = dist - prevDist;
      if (distDelta > 2 && prevAlt !== null) {
        gradientPct = Math.max(-30, Math.min(35, ((alt - prevAlt) / distDelta) * 100));
      }

      // Estimate Power physics model
      const speedMs = speedKmh / 3.6;
      const slopeRad = Math.atan(gradientPct / 100);
      const massKg = riderWeightKg + 9.5; // rider + bike
      const pGravity = massKg * 9.81 * speedMs * Math.sin(slopeRad);
      const pRolling = massKg * 9.81 * 0.005 * speedMs * Math.cos(slopeRad);
      const pAir = 0.5 * 1.225 * 0.38 * Math.pow(speedMs, 3);
      const estWatts = Math.max(0, Math.round(pGravity + pRolling + pAir));

      speeds.push(speedKmh);
      powers.push(estWatts);

      // HR Zones breakdown
      if (hr) {
        const pct = (hr / maxHr) * 100;
        if (pct < 60) hrZones.z1++;
        else if (pct < 70) hrZones.z2++;
        else if (pct < 80) hrZones.z3++;
        else if (pct < 90) hrZones.z4++;
        else hrZones.z5++;
      }

      // Cadence breakdown
      if (cad !== undefined) {
        if (cad < 10) cadDist.coasting++;
        else if (cad < 70 && gradientPct > 3) cadDist.climbing_torque++;
        else if (cad > 95) cadDist.high_cadence++;
        else cadDist.steady++;
      }

      points.push({
        id: `pt-${i}`,
        timestamp: time.toISOString(),
        elapsed_time_sec: elapsedSec,
        latitude: lat,
        longitude: lon,
        altitude_m: Math.round(alt * 10) / 10,
        distance_m: Math.round(dist),
        speed_kmh: parseFloat(speedKmh.toFixed(1)),
        heart_rate: hr,
        cadence: cad,
        gradient_pct: parseFloat(gradientPct.toFixed(1)),
        estimated_power_w: estWatts
      });

      prevAlt = alt;
      prevDist = dist;
      prevTime = time;
    }

    if (points.length === 0) return null;

    const totalDistM = points[points.length - 1].distance_m;
    const totalTimeSec = points[points.length - 1].elapsed_time_sec;
    const movingTimeSec = totalTimeSec * 0.94;

    const validSpeeds = speeds.filter(s => s > 1.5);
    const avgSpeedKmh = validSpeeds.length > 0 ? validSpeeds.reduce((a, b) => a + b, 0) / validSpeeds.length : 0;
    const maxSpeedKmh = Math.max(...speeds, 0);

    const avgHr = hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : undefined;
    const maxHrVal = hrs.length > 0 ? Math.max(...hrs) : undefined;

    const avgCad = cadences.length > 0 ? Math.round(cadences.reduce((a, b) => a + b, 0) / cadences.length) : undefined;
    const maxCadVal = cadences.length > 0 ? Math.max(...cadences) : undefined;

    const avgWatts = powers.length > 0 ? Math.round(powers.reduce((a, b) => a + b, 0) / powers.length) : 0;
    const maxWatts = Math.max(...powers, 0);
    const normalizedPower = Math.round(avgWatts * 1.07);

    // Auto-classify Road vs MTB
    let mtbScore = 0;
    const elevDensity = (cumElevGain / Math.max(1, totalDistM / 1000));
    if (elevDensity > 22) mtbScore += 3.5;
    if (avgSpeedKmh < 16 && elevDensity > 15) mtbScore += 3.5;
    if (avgCad && avgCad < 70) mtbScore += 2.0;

    const activityType = mtbScore >= 4.5 ? 'MOUNTAIN_BIKE' : 'ROAD_BIKE';

    // Normalize percentage distributions
    const totalHrCount = Object.values(hrZones).reduce((a, b) => a + b, 0) || 1;
    const hrZonePct = Object.fromEntries(
      Object.entries(hrZones).map(([k, v]) => [k, Math.round((v / totalHrCount) * 100)])
    );

    const totalCadCount = Object.values(cadDist).reduce((a, b) => a + b, 0) || 1;
    const cadDistPct = Object.fromEntries(
      Object.entries(cadDist).map(([k, v]) => [k, Math.round((v / totalCadCount) * 100)])
    );

    return {
      activity_type: activityType,
      total_distance_m: totalDistM,
      elevation_gain_m: Math.round(cumElevGain),
      elevation_loss_m: Math.round(cumElevLoss),
      moving_time_sec: Math.round(movingTimeSec),
      avg_speed_kmh: parseFloat(avgSpeedKmh.toFixed(1)),
      max_speed_kmh: parseFloat(maxSpeedKmh.toFixed(1)),
      avg_hr: avgHr,
      max_hr: maxHrVal,
      avg_cadence: avgCad,
      max_cadence: maxCadVal,
      avg_watts_est: avgWatts,
      max_watts_est: maxWatts,
      normalized_power: normalizedPower,
      mtb_technical_score: parseFloat(mtbScore.toFixed(1)),
      hr_zone_distribution: hrZonePct,
      cadence_distribution: cadDistPct,
      telemetry_points: points
    };
  } catch (err) {
    console.error('Error parsing Garmin TCX file:', err);
    return null;
  }
}
