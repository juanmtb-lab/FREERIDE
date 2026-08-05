import os
import asyncio
from typing import List, Dict, Any
from datetime import datetime, timedelta

class GarminConnectSyncService:
    """
    Automated Garmin Connect Sync Service for FREERIDE.
    Supports auto-downloading activities from Garmin Connect cloud or USB folder watch.
    """

    def __init__(self, email: str = "", password: str = ""):
        self.email = email or os.getenv("GARMIN_EMAIL", "")
        self.password = password or os.getenv("GARMIN_PASSWORD", "")
        self.api = None

    def login(self) -> bool:
        """Authenticates with Garmin Connect"""
        if not self.email or not self.password:
            return False
        try:
            from garminconnect import Garmin
            self.api = Garmin(self.email, self.password)
            self.api.login()
            return True
        except Exception as e:
            print(f"Error al iniciar sesión en Garmin Connect: {e}")
            return False

    def fetch_latest_fit_files(self, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Fetches the last N activities from Garmin Connect and downloads raw .FIT bytes
        """
        if not self.api:
            if not self.login():
                return []

        downloaded_activities = []
        try:
            activities = self.api.get_activities(0, limit)
            for act in activities:
                act_id = act.get('activityId')
                act_name = act.get('activityName', 'Garmin Ride')
                
                # Download raw FIT file bytes from Garmin Connect API
                fit_data = self.api.download_activity(act_id, dl_fmt=self.api.ActivityDownloadFormat.ORIGINAL)
                
                downloaded_activities.append({
                    'activity_id': str(act_id),
                    'title': act_name,
                    'fit_bytes': fit_data
                })
        except Exception as e:
            print(f"Error al descargar actividades de Garmin Connect: {e}")

        return downloaded_activities

    @staticmethod
    def scan_usb_garmin_folder(drive_path: str = "E:\\GARMIN\\ACTIVITY") -> List[str]:
        """
        Scans a connected Garmin Edge 130 via USB for new .FIT files
        """
        if not os.path.exists(drive_path):
            return []

        fit_files = []
        for file in os.listdir(drive_path):
            if file.lower().endswith(".fit"):
                fit_files.append(os.path.join(drive_path, file))
        return fit_files
