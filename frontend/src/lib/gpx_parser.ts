import { XMLParser } from 'fast-xml-parser';
import { RawTelemetryPoint, ParsedGarminTrack } from './garmin_parser';

export function parseGPXContent(gpxString: string, riderWeightKg = 72, maxHr = 190): ParsedGarminTrack | null {
  try {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const parsed = parser.parse(gpxString);

    const trk = parsed.gpx?.trk;
    if (!trk) return null;

    const trkseg = Array.isArray(trk.trkseg) ? trk.trkseg[0] : trk.trkseg;
    if (!trkseg || !trkseg.trkpt) return null;

    const rawPoints = Array.isArray(trkseg.trkpt) ? trkseg.trkpt : [trkseg.trkpt];
    if (rawPoints.length === 0) return null;

    const points: RawTelemetryPoint[] = [];
    let startTime: Date | null = null;
    let cumElevGain = 0;
    let cumElevLoss = 0;
    let prevAlt: number | null = null;
    let prevDist = 0;
    let prevLat = 0;
    let prevLon = 0;

    const hrs: number[] = [];
    const cadences: number[] = [];
    const speeds: number[] = [];
    const powers: number[] = [];

    const hrZones = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
    const cadDist = { coasting: 0, steady: 0, climbing_torque: 0, high_cadence: 0 };

    for (let i = 0; i < rawPoints.length; i++) {
      const pt = rawPoints[i];
      const lat = parseFloat(pt['@_lat']);
      const lon = parseFloat(pt['@_lon']);
      const alt = pt.ele !== undefined ? parseFloat(pt.ele) : 0;
      const timeStr = pt.time;

      if (isNaN(lat) || isNaN(lon)) continue;

      const time = timeStr ? new Date(timeStr) : new Date();
      if (!startTime) startTime = time;
      const elapsedSec = (time.getTime() - startTime.getTime()) / 1000;

      // Distance calculation (haversine)
      let distDelta = 0;
      if (i > 0 && prevLat !== 0) {
        const radlat1 = (Math.PI * prevLat) / 180;
        const radlat2 = (Math.PI * lat) / 180;
        const theta = prevLon - lon;
        const radtheta = (Math.PI * theta) / 180;
        let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        if (dist > 1) dist = 1;
        dist = Math.acos(dist);
        dist = (dist * 180) / Math.PI;
        dist = dist * 60 * 1.1515 * 1.609344 * 1000; // in meters
        distDelta = Math.max(0, dist);
      }
      const cumDist = prevDist + distDelta;

      // Speed calculation
      let speedKmh = 0;
      if (i > 0) {
        const prevPt = points[points.length - 1];
        const dt = elapsedSec - prevPt.elapsed_time_sec;
        if (dt > 0) {
          speedKmh = (distDelta / dt) * 3.6;
        }
      }

      // Elevation Gain / Loss
      if (prevAlt !== null) {
        const altDelta = alt - prevAlt;
        if (altDelta > 0.3) cumElevGain += altDelta;
        else if (altDelta < -0.3) cumElevLoss += Math.abs(altDelta);
      }

      // HR & Cadence extraction from extensions
      let hr: number | undefined = undefined;
      let cad: number | undefined = undefined;

      const ext = pt.extensions?.['gpxtpx:TrackPointExtension'] || pt.extensions?.TrackPointExtension || pt.extensions;
      if (ext) {
        if (ext['gpxtpx:hr'] !== undefined || ext.hr !== undefined) {
          hr = parseInt(ext['gpxtpx:hr'] || ext.hr);
          if (hr > 30) hrs.push(hr);
        }
        if (ext['gpxtpx:cad'] !== undefined || ext.cad !== undefined) {
          cad = parseInt(ext['gpxtpx:cad'] || ext.cad);
          if (cad > 0) cadences.push(cad);
        }
      }

      // Gradient %
      let gradientPct = 0;
      if (distDelta > 2 && prevAlt !== null) {
        gradientPct = Math.max(-30, Math.min(35, ((alt - prevAlt) / distDelta) * 100));
      }

      // Estimated Power (Watts)
      const speedMs = speedKmh / 3.6;
      const slopeRad = Math.atan(gradientPct / 100);
      const massKg = riderWeightKg + 9.5;
      const pGravity = massKg * 9.81 * speedMs * Math.sin(slopeRad);
      const pRolling = massKg * 9.81 * 0.005 * speedMs * Math.cos(slopeRad);
      const pAir = 0.5 * 1.225 * 0.38 * Math.pow(speedMs, 3);
      const estWatts = Math.max(0, Math.round(pGravity + pRolling + pAir));

      speeds.push(speedKmh);
      powers.push(estWatts);

      // HR Zones
      if (hr) {
        const pct = (hr / maxHr) * 100;
        if (pct < 60) hrZones.z1++;
        else if (pct < 70) hrZones.z2++;
        else if (pct < 80) hrZones.z3++;
        else if (pct < 90) hrZones.z4++;
        else hrZones.z5++;
      }

      // Cadence Distribution
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
        distance_m: Math.round(cumDist),
        speed_kmh: parseFloat(speedKmh.toFixed(1)),
        heart_rate: hr,
        cadence: cad,
        gradient_pct: parseFloat(gradientPct.toFixed(1)),
        estimated_power_w: estWatts
      });

      prevAlt = alt;
      prevDist = cumDist;
      prevLat = lat;
      prevLon = lon;
    }

    if (points.length === 0) return null;

    const totalDistM = points[points.length - 1].distance_m;
    const totalTimeSec = points[points.length - 1].elapsed_time_sec;

    const validSpeeds = speeds.filter(s => s > 1.5);
    const avgSpeedKmh = validSpeeds.length > 0 ? validSpeeds.reduce((a, b) => a + b, 0) / validSpeeds.length : 0;
    const maxSpeedKmh = Math.max(...speeds, 0);

    const avgHr = hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : undefined;
    const maxHrVal = hrs.length > 0 ? Math.max(...hrs) : undefined;

    const avgCad = cadences.length > 0 ? Math.round(cadences.reduce((a, b) => a + b, 0) / cadences.length) : undefined;
    const maxCadVal = cadences.length > 0 ? Math.max(...cadences) : undefined;

    const avgWatts = powers.length > 0 ? Math.round(powers.reduce((a, b) => a + b, 0) / powers.length) : 0;
    const maxWatts = Math.max(...powers, 0);

    const elevDensity = cumElevGain / Math.max(1, totalDistM / 1000);
    const activityType = (elevDensity > 20 || avgSpeedKmh < 15) ? 'MOUNTAIN_BIKE' : 'ROAD_BIKE';

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
      total_distance_m: Math.round(totalDistM),
      elevation_gain_m: Math.round(cumElevGain),
      elevation_loss_m: Math.round(cumElevLoss),
      moving_time_sec: Math.round(totalTimeSec),
      avg_speed_kmh: parseFloat(avgSpeedKmh.toFixed(1)),
      max_speed_kmh: parseFloat(maxSpeedKmh.toFixed(1)),
      avg_hr: avgHr,
      max_hr: maxHrVal,
      avg_cadence: avgCad,
      max_cadence: maxCadVal,
      avg_watts_est: avgWatts,
      max_watts_est: maxWatts,
      normalized_power: Math.round(avgWatts * 1.07),
      mtb_technical_score: activityType === 'MOUNTAIN_BIKE' ? 7.5 : 2.0,
      hr_zone_distribution: hrZonePct,
      cadence_distribution: cadDistPct,
      telemetry_points: points
    };
  } catch (err) {
    console.error('Error parsing GPX XML:', err);
    return null;
  }
}
