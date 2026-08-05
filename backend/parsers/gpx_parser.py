import gpxpy
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple
from geopy.distance import geodesic

class GPXParser:
    """
    Fallback Parser for standard GPX activity files.
    """

    @staticmethod
    def parse_gpx_bytes(gpx_content: bytes) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        gpx = gpxpy.parse(gpx_content.decode('utf-8', errors='ignore'))
        
        telemetry_points = []
        start_time = None
        cum_distance = 0.0
        prev_point = None
        
        for track in gpx.tracks:
            for segment in track.segments:
                for point in segment.points:
                    timestamp = point.time
                    if timestamp is None:
                        continue
                    if timestamp.tzinfo is None:
                        timestamp = timestamp.replace(tzinfo=timezone.utc)
                        
                    if start_time is None:
                        start_time = timestamp
                        
                    lat = point.latitude
                    lon = point.longitude
                    altitude = point.elevation or 0.0
                    
                    if prev_point is not None:
                        dist_delta = geodesic(
                            (prev_point['lat'], prev_point['lon']),
                            (lat, lon)
                        ).meters
                        cum_distance += dist_delta
                        time_delta = (timestamp - prev_point['timestamp']).total_seconds()
                        speed_kmh = (dist_delta / time_delta * 3.6) if time_delta > 0 else 0.0
                    else:
                        speed_kmh = 0.0
                        
                    prev_point = {
                        'lat': lat,
                        'lon': lon,
                        'timestamp': timestamp
                    }
                    
                    # Extract extension fields (HR / Cadence) if present
                    heart_rate = None
                    cadence = None
                    for ext in point.extensions:
                        tag = ext.tag.lower()
                        if 'hr' in tag or 'heartrate' in tag:
                            try:
                                heart_rate = int(ext.text)
                            except (ValueError, TypeError):
                                pass
                        elif 'cadence' in tag or 'cad' in tag:
                            try:
                                cadence = int(ext.text)
                            except (ValueError, TypeError):
                                pass
                                
                    telemetry_points.append({
                        'timestamp': timestamp,
                        'elapsed_time_sec': (timestamp - start_time).total_seconds(),
                        'latitude': lat,
                        'longitude': lon,
                        'altitude_m': float(altitude),
                        'distance_m': float(cum_distance),
                        'speed_kmh': float(speed_kmh),
                        'heart_rate': heart_rate,
                        'cadence': cadence,
                        'temperature_c': None,
                    })
                    
        header_info = {
            'start_time': start_time or datetime.now(timezone.utc),
            'record_count': len(telemetry_points)
        }
        
        return header_info, telemetry_points
