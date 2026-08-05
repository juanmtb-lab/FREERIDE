import fitparse
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple

class FITParser:
    """
    Parser for Garmin Edge 130 and standard FIT files.
    Extracts raw telemetry records (timestamp, lat, lon, altitude, distance, speed, HR, cadence, temp).
    """

    @staticmethod
    def parse_fit_bytes(fit_content: bytes) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        fitfile = fitparse.FitFile(fit_content)
        
        telemetry_points = []
        start_time = None
        
        for record in fitfile.get_messages('record'):
            data = {}
            for record_data in record:
                if record_data.value is not None:
                    data[record_data.name] = record_data.value
            
            # Require basic location or timestamp data
            if 'timestamp' not in data:
                continue
                
            timestamp = data['timestamp']
            if isinstance(timestamp, datetime):
                # Ensure UTC timestamp
                if timestamp.tzinfo is None:
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
            else:
                continue
                
            if start_time is None:
                start_time = timestamp
                
            # Convert Garmin semicircles to degrees if needed
            lat = data.get('position_lat')
            lon = data.get('position_long')
            if lat is not None and abs(lat) > 180:
                lat = lat * (180.0 / (2**31))
            if lon is not None and abs(lon) > 180:
                lon = lon * (180.0 / (2**31))
                
            altitude = data.get('altitude', 0.0)
            if altitude is None:
                altitude = 0.0
                
            distance = data.get('distance', 0.0)
            if distance is None:
                distance = 0.0
                
            speed_ms = data.get('speed', 0.0)
            if speed_ms is None:
                speed_ms = 0.0
            speed_kmh = speed_ms * 3.6
            
            heart_rate = data.get('heart_rate')
            cadence = data.get('cadence')
            temperature = data.get('temperature')
            
            telemetry_points.append({
                'timestamp': timestamp,
                'elapsed_time_sec': (timestamp - start_time).total_seconds(),
                'latitude': lat if lat is not None else 0.0,
                'longitude': lon if lon is not None else 0.0,
                'altitude_m': float(altitude),
                'distance_m': float(distance),
                'speed_kmh': float(speed_kmh),
                'heart_rate': int(heart_rate) if heart_rate is not None else None,
                'cadence': int(cadence) if cadence is not None else None,
                'temperature_c': float(temperature) if temperature is not None else None,
            })
            
        header_info = {
            'start_time': start_time or datetime.now(timezone.utc),
            'record_count': len(telemetry_points)
        }
        
        return header_info, telemetry_points
