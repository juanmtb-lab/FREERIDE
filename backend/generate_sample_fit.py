import math
from datetime import datetime, timedelta, timezone

def generate_sample_gpx():
    """Generates a realistic sample cycling GPX file with 3D elevation pass, HR, and cadence data"""
    start_lat = 40.4168 # Sierra de Guadarrama / Madrid mountain pass
    start_lon = -3.7038
    start_time = datetime.now(timezone.utc) - timedelta(hours=3)
    
    num_points = 300
    points_xml = []
    
    curr_dist = 0
    curr_alt = 650.0 # meters starting altitude
    
    for i in range(num_points):
        t = start_time + timedelta(seconds=i * 5) # Every 5 seconds
        
        # Climb profile: up to 1200m and down
        progress = i / num_points
        if progress < 0.6:
            # Climbing section (slope 4% - 10%)
            slope = 0.06 + 0.03 * math.sin(i / 10.0)
            speed_kmh = 14.0 + 4.0 * math.cos(i / 5.0)
            hr = int(145 + 30 * (progress / 0.6) + 10 * math.sin(i / 4.0))
            cadence = int(75 + 15 * math.sin(i / 6.0))
        else:
            # Descending section
            slope = -0.07 - 0.02 * math.cos(i / 8.0)
            speed_kmh = 42.0 + 10.0 * math.sin(i / 7.0)
            hr = int(125 + 15 * math.sin(i / 5.0))
            cadence = int(40 + 35 * math.sin(i / 3.0))

        dist_step = (speed_kmh / 3.6) * 5 # meters moved in 5 seconds
        curr_dist += dist_step
        curr_alt += dist_step * slope
        
        # Slight GPS path curvature
        lat = start_lat + (curr_dist / 111000.0) * math.cos(i / 20.0)
        lon = start_lon + (curr_dist / (111000.0 * math.cos(math.radians(start_lat)))) * math.sin(i / 20.0)
        
        pt_str = f"""        <trkpt lat="{lat:.6f}" lon="{lon:.6f}">
          <ele>{curr_alt:.1f}</ele>
          <time>{t.strftime('%Y-%m-%dT%H:%M:%SZ')}</time>
          <extensions>
            <gpxtpx:TrackPointExtension>
              <gpxtpx:hr>{hr}</gpxtpx:hr>
              <gpxtpx:cad>{cadence}</gpxtpx:cad>
            </gpxtpx:TrackPointExtension>
          </extensions>
        </trkpt>"""
        points_xml.append(pt_str)

    gpx_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin Edge 130" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk>
    <name>Puerto de Montaña - Garmin Edge 130 Test Ride</name>
    <type>Cycling</type>
    <trkseg>
{"\n".join(points_xml)}
    </trkseg>
  </trk>
</gpx>
"""

    with open("sample_garmin_ride.gpx", "w", encoding="utf-8") as f:
        f.write(gpx_content)
    print("Generated sample_garmin_ride.gpx successfully!")

if __name__ == "__main__":
    generate_sample_gpx()
