import FitParser from 'fit-file-parser';
import AdmZip from 'adm-zip';

export interface DecodedFitResult {
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
  telemetry_points: any[];
}

export async function decodeFitBuffer(buffer: Buffer, riderWeightKg = 72, maxHr = 190): Promise<DecodedFitResult | null> {
  try {
    let fitBytes: Buffer = buffer;

    // Check if buffer is a zip file containing .fit
    try {
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();
      for (const entry of zipEntries) {
        if (entry.entryName.toLowerCase().endsWith('.fit')) {
          fitBytes = entry.getData();
          break;
        }
      }
    } catch {
      // Not a zip file, process buffer directly
    }

    const fitParser = new FitParser({
      force: true,
      speedUnit: 'km/h',
      lengthUnit: 'm',
      temperatureUnit: 'celsius',
      elapsedRecordField: true,
    });

    const parsedData: any = await new Promise((resolve, reject) => {
      fitParser.parse(fitBytes as any, (error: any, data: any) => {
        if (error) reject(error);
        else resolve(data);
      });
    });

    if (!parsedData || !parsedData.records || parsedData.records.length === 0) {
      return null;
    }

    const records = parsedData.records;
    const points: any[] = [];

    let startTime: Date | null = null;
    let cumElevGain = 0;
    let cumElevLoss = 0;
    let prevAlt: number | null = null;

    const hrs: number[] = [];
    const cadences: number[] = [];
    const speeds: number[] = [];
    const powers: number[] = [];

    const hrZones = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
    const cadDist = { coasting: 0, steady: 0, climbing_torque: 0, high_cadence: 0 };

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      if (!rec.timestamp) continue;

      const time = new Date(rec.timestamp);
      if (!startTime) startTime = time;

      const elapsedSec = (time.getTime() - startTime.getTime()) / 1000;

      // Extract exact GPS coordinates
      const lat = rec.position_lat !== undefined ? rec.position_lat : 0;
      const lon = rec.position_long !== undefined ? rec.position_long : 0;
      const alt = rec.altitude !== undefined ? rec.altitude : 0;
      const dist = rec.distance !== undefined ? rec.distance : (points.length > 0 ? points[points.length - 1].distance_m : 0);
      const speedKmh = rec.speed !== undefined ? rec.speed : 0;

      if (lat === 0 && lon === 0) continue;

      // Elevation Gain / Loss
      if (prevAlt !== null) {
        const altDelta = alt - prevAlt;
        if (altDelta > 0.3) cumElevGain += altDelta;
        else if (altDelta < -0.3) cumElevLoss += Math.abs(altDelta);
      }

      // HR & Cadence
      const hr = rec.heart_rate !== undefined && rec.heart_rate > 30 ? rec.heart_rate : undefined;
      if (hr) hrs.push(hr);

      const cad = rec.cadence !== undefined && rec.cadence > 0 ? rec.cadence : undefined;
      if (cad) cadences.push(cad);

      speeds.push(speedKmh);

      // Gradient %
      let gradientPct = 0;
      if (points.length > 0) {
        const prevPt = points[points.length - 1];
        const distDelta = dist - prevPt.distance_m;
        if (distDelta > 2) {
          gradientPct = Math.max(-30, Math.min(35, ((alt - prevPt.altitude_m) / distDelta) * 100));
        }
      }

      // Estimated Power (Watts)
      const speedMs = speedKmh / 3.6;
      const slopeRad = Math.atan(gradientPct / 100);
      const massKg = riderWeightKg + 9.5;
      const pGravity = massKg * 9.81 * speedMs * Math.sin(slopeRad);
      const pRolling = massKg * 9.81 * 0.005 * speedMs * Math.cos(slopeRad);
      const pAir = 0.5 * 1.225 * 0.38 * Math.pow(speedMs, 3);
      const estWatts = rec.power !== undefined ? rec.power : Math.max(0, Math.round(pGravity + pRolling + pAir));

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
        distance_m: Math.round(dist),
        speed_kmh: parseFloat(speedKmh.toFixed(1)),
        heart_rate: hr,
        cadence: cad,
        gradient_pct: parseFloat(gradientPct.toFixed(1)),
        estimated_power_w: estWatts,
        temperature_c: rec.temperature
      });

      prevAlt = alt;
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

    // Calculate 30s rolling Normalized Power (NP)
    let normalizedPower = avgWatts * 1.07;
    if (powers.length >= 30) {
      let sumP4 = 0;
      for (let i = 15; i < powers.length - 15; i++) {
        const avg30 = powers.slice(i - 15, i + 15).reduce((a, b) => a + b, 0) / 30;
        sumP4 += Math.pow(avg30, 4);
      }
      normalizedPower = Math.pow(sumP4 / (powers.length - 30), 0.25);
    }

    // Auto-classify Road vs MTB
    let mtbScore = 0;
    const elevDensity = cumElevGain / Math.max(1, totalDistM / 1000);
    if (elevDensity > 22) mtbScore += 3.5;
    if (avgSpeedKmh < 16 && elevDensity > 14) mtbScore += 3.5;
    
    // Cadence variance check
    if (cadences.length > 10) {
      const meanCad = cadences.reduce((a, b) => a + b, 0) / cadences.length;
      const cadVar = Math.sqrt(cadences.reduce((a, b) => a + Math.pow(b - meanCad, 2), 0) / cadences.length);
      if (cadVar > 20) mtbScore += 3.0;
    }

    const activityType = mtbScore >= 4.5 ? 'MOUNTAIN_BIKE' : 'ROAD_BIKE';

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
      normalized_power: Math.round(normalizedPower),
      mtb_technical_score: parseFloat(mtbScore.toFixed(1)),
      hr_zone_distribution: hrZonePct,
      cadence_distribution: cadDistPct,
      telemetry_points: points
    };
  } catch (error) {
    console.error('Error decoding FIT buffer:', error);
    return null;
  }
}
