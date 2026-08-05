import numpy as np
from scipy.ndimage import gaussian_filter1d
from typing import List, Dict, Any, Tuple
import math

class TelemetryProcessor:
    """
    Advanced cycling telemetry calculation & classification engine.
    Calculates gradient, moving time, power estimations, HR zones, and Road vs MTB classification.
    """

    @staticmethod
    def process(
        points: List[Dict[str, Any]],
        rider_weight_kg: float = 72.0,
        bike_weight_kg: float = 9.5,
        max_hr: int = 190
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        if not points:
            return {}, []

        n = len(points)
        timestamps = [p['timestamp'] for p in points]
        elapsed_times = np.array([p['elapsed_time_sec'] for p in points])
        lats = np.array([p['latitude'] for p in points])
        lons = np.array([p['longitude'] for p in points])
        altitudes = np.array([p['altitude_m'] for p in points])
        distances = np.array([p['distance_m'] for p in points])
        speeds = np.array([p['speed_kmh'] for p in points])
        hrs = np.array([p['heart_rate'] if p['heart_rate'] is not None else 0 for p in points])
        cadences = np.array([p['cadence'] if p['cadence'] is not None else 0 for p in points])

        # 1. Smooth Elevation Profile using Gaussian Filter to reduce GPS altitude noise
        smoothed_altitudes = gaussian_filter1d(altitudes, sigma=2.0) if n > 5 else altitudes

        # 2. Gradient / Slope % Calculation
        gradients = np.zeros(n)
        dist_deltas = np.diff(distances, prepend=distances[0])
        alt_deltas = np.diff(smoothed_altitudes, prepend=smoothed_altitudes[0])

        for i in range(1, n):
            if dist_deltas[i] > 1.0: # Minimum distance step to compute slope
                gradients[i] = (alt_deltas[i] / dist_deltas[i]) * 100.0
                # Clamp gradient to realistic cycling bounds [-30%, +35%]
                gradients[i] = max(-30.0, min(35.0, gradients[i]))
            else:
                gradients[i] = gradients[i-1]

        smoothed_gradients = gaussian_filter1d(gradients, sigma=1.5) if n > 5 else gradients

        # 3. Moving Time & Pause Detection
        time_deltas = np.diff(elapsed_times, prepend=elapsed_times[0])
        moving_mask = (speeds > 1.8) & (time_deltas < 30.0) # Speed > 1.8 km/h and no long pauses
        moving_time_sec = float(np.sum(time_deltas[moving_mask]))
        total_elapsed_time_sec = float(elapsed_times[-1] - elapsed_times[0]) if n > 1 else 0.0

        # 4. Elevation Gain / Loss
        elevation_gain = float(np.sum(np.maximum(alt_deltas, 0)))
        elevation_loss = float(np.sum(np.maximum(-alt_deltas, 0)))

        # 5. Estimated Power Physics Model (Watts)
        # P_total = P_gravity + P_rolling + P_air
        total_mass_kg = rider_weight_kg + bike_weight_kg
        g = 9.81
        c_rr = 0.005 # Rolling resistance coefficient (typical road/gravel/light MTB)
        c_da = 0.38  # Aerodynamic drag area (cycling drop/hoods)
        rho = 1.225  # Air density kg/m^3

        powers = np.zeros(n)
        for i in range(n):
            v = max(0.0, speeds[i] / 3.6) # speed in m/s
            slope_rad = math.atan(smoothed_gradients[i] / 100.0)
            
            p_gravity = total_mass_kg * g * v * math.sin(slope_rad)
            p_rolling = total_mass_kg * g * c_rr * v * math.cos(slope_rad)
            p_air = 0.5 * rho * c_da * (v ** 3)
            
            p_total = p_gravity + p_rolling + p_air
            # Power is non-negative during coasting unless braking
            powers[i] = max(0.0, p_total) if cadences[i] > 0 or speeds[i] > 5.0 else 0.0

        # 6. Normalized Power (NP) Calculation (30-second rolling average raised to 4th power)
        normalized_power = TelemetryProcessor._calculate_normalized_power(powers, time_deltas)

        # 7. Heart Rate Zone Distribution (Z1-Z5)
        hr_zones = {'z1': 0.0, 'z2': 0.0, 'z3': 0.0, 'z4': 0.0, 'z5': 0.0}
        valid_hr_count = 0
        for i in range(n):
            hr = hrs[i]
            dt = time_deltas[i]
            if hr > 30:
                valid_hr_count += 1
                hr_pct = (hr / max_hr) * 100.0
                if hr_pct < 60:
                    hr_zones['z1'] += dt
                elif hr_pct < 70:
                    hr_zones['z2'] += dt
                elif hr_pct < 80:
                    hr_zones['z3'] += dt
                elif hr_pct < 90:
                    hr_zones['z4'] += dt
                else:
                    hr_zones['z5'] += dt

        # 8. Cadence Distribution
        cadence_dist = {'coasting': 0.0, 'steady': 0.0, 'climbing_torque': 0.0, 'high_cadence': 0.0}
        valid_cad_count = 0
        for i in range(n):
            cad = cadences[i]
            dt = time_deltas[i]
            if speeds[i] > 1.0:
                valid_cad_count += 1
                if cad < 10:
                    cadence_dist['coasting'] += dt
                elif cad < 70 and smoothed_gradients[i] > 3.0:
                    cadence_dist['climbing_torque'] += dt
                elif cad > 95:
                    cadence_dist['high_cadence'] += dt
                else:
                    cadence_dist['steady'] += dt

        # Normalize distributions to percentage
        total_hr_time = sum(hr_zones.values()) or 1.0
        hr_zones_pct = {k: round((v / total_hr_time) * 100.0, 1) for k, v in hr_zones.items()}

        total_cad_time = sum(cadence_dist.values()) or 1.0
        cadence_dist_pct = {k: round((v / total_cad_time) * 100.0, 1) for k, v in cadence_dist.items()}

        # 9. Road vs MTB Classifier Logic
        activity_type, mtb_score = TelemetryProcessor._classify_road_vs_mtb(
            cadences=cadences,
            hrs=hrs,
            speeds=speeds,
            gradients=smoothed_gradients,
            elevation_gain=elevation_gain,
            distance_km=distances[-1] / 1000.0 if n > 0 else 0
        )

        # 10. Update points list with processed values
        processed_points = []
        for i in range(n):
            p = points[i].copy()
            p['altitude_m'] = round(float(smoothed_altitudes[i]), 1)
            p['gradient_pct'] = round(float(smoothed_gradients[i]), 1)
            p['estimated_power_w'] = round(float(powers[i]), 1)
            processed_points.append(p)

        # Build summary dict
        summary = {
            'total_elapsed_time_sec': round(total_elapsed_time_sec, 1),
            'moving_time_sec': round(moving_time_sec, 1),
            'total_distance_m': round(float(distances[-1]), 1) if n > 0 else 0.0,
            'elevation_gain_m': round(elevation_gain, 1),
            'elevation_loss_m': round(elevation_loss, 1),
            'avg_speed_kmh': round(float(np.mean(speeds[moving_mask])), 1) if np.any(moving_mask) else 0.0,
            'max_speed_kmh': round(float(np.max(speeds)), 1) if n > 0 else 0.0,
            'avg_hr': int(np.mean(hrs[hrs > 30])) if np.any(hrs > 30) else None,
            'max_hr': int(np.max(hrs)) if np.any(hrs > 30) else None,
            'avg_cadence': int(np.mean(cadences[cadences > 0])) if np.any(cadences > 0) else None,
            'max_cadence': int(np.max(cadences)) if np.any(cadences > 0) else None,
            'avg_watts_est': round(float(np.mean(powers[powers > 0])), 1) if np.any(powers > 0) else 0.0,
            'max_watts_est': round(float(np.max(powers)), 1) if n > 0 else 0.0,
            'normalized_power': round(normalized_power, 1),
            'activity_type': activity_type,
            'mtb_technical_score': round(mtb_score, 1),
            'hr_zone_distribution': hr_zones_pct,
            'cadence_distribution': cadence_dist_pct,
            'summary_polyline': TelemetryProcessor._encode_polyline(lats, lons)
        }

        return summary, processed_points

    @staticmethod
    def _calculate_normalized_power(powers: np.ndarray, time_deltas: np.ndarray) -> float:
        """Calculates 30s rolling NP"""
        if len(powers) < 30:
            return float(np.mean(powers)) if len(powers) > 0 else 0.0
        
        # 30-second window
        window = 30
        kernel = np.ones(window) / window
        smooth_powers = np.convolve(powers, kernel, mode='same')
        p4 = smooth_powers ** 4
        return float(np.mean(p4) ** 0.25)

    @staticmethod
    def _classify_road_vs_mtb(
        cadences: np.ndarray,
        hrs: np.ndarray,
        speeds: np.ndarray,
        gradients: np.ndarray,
        elevation_gain: float,
        distance_km: float
    ) -> Tuple[str, float]:
        """
        Differentiates between Road and Mountain Bike efforts.
        MTB markers:
        - High cadence variance (micro-stops, technical climbing bursts)
        - High elevation gain density per km (> 25m/km)
        - HR volatility (frequent spikes to Z4/Z5 on steep technical sections)
        - Low speed relative to steep gradient
        """
        score = 0.0 # 0 = Road, 10 = Pure Technical MTB
        
        if distance_km > 0:
            climb_density = elevation_gain / distance_km
            if climb_density > 25.0: # Very steep / punchy terrain
                score += 3.0
            elif climb_density > 15.0:
                score += 1.5

        # Cadence variability check (MTB has high std dev due to technical terrain)
        valid_cad = cadences[cadences > 0]
        if len(valid_cad) > 10:
            cad_std = np.std(valid_cad)
            if cad_std > 22.0:
                score += 3.0
            elif cad_std > 16.0:
                score += 1.5

        # Speed on climbs check (MTB speed drops drastically on technical climbs)
        steep_climbs = gradients > 7.0
        if np.any(steep_climbs):
            avg_climb_speed = np.mean(speeds[steep_climbs])
            if avg_climb_speed < 9.0: # Under 9 km/h on steep sections -> high MTB likelihood
                score += 2.5
            elif avg_climb_speed < 12.0:
                score += 1.0

        # HR Spikes (Frequent HR jumps)
        valid_hr = hrs[hrs > 30]
        if len(valid_hr) > 10:
            hr_diffs = np.abs(np.diff(valid_hr))
            spikes = np.sum(hr_diffs > 8) # HR jump > 8 bpm in 1-2 sec
            if spikes > 15:
                score += 1.5

        activity_type = "MOUNTAIN_BIKE" if score >= 4.5 else "ROAD_BIKE"
        return activity_type, min(10.0, score)

    @staticmethod
    def _encode_polyline(lats: np.ndarray, lons: np.ndarray, step: int = 5) -> str:
        """Encodes coordinates into Google Encoded Polyline string for lightweight map rendering"""
        if len(lats) == 0:
            return ""
            
        def encode_number(num):
            num = ~(num << 1) if num < 0 else num << 1
            chunks = []
            while num >= 0x20:
                chunks.append(chr((0x20 | (num & 0x1f)) + 63))
                num >>= 5
            chunks.append(chr(num + 63))
            return "".join(chunks)

        output = []
        prev_lat = 0
        prev_lon = 0

        # Downsample points by step for fast polyline
        sub_lats = lats[::step]
        sub_lons = lons[::step]

        for lat, lon in zip(sub_lats, sub_lons):
            late5 = int(round(lat * 1e5))
            lone5 = int(round(lon * 1e5))
            
            d_lat = late5 - prev_lat
            d_lon = lone5 - prev_lon
            
            output.append(encode_number(d_lat))
            output.append(encode_number(d_lon))
            
            prev_lat = late5
            prev_lon = lone5

        return "".join(output)
