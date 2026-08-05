import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any

class TrainingLoadEngine:
    """
    Calculates Training Stress Metrics:
    - Intensity Factor (IF = NP / FTP)
    - Training Stress Score (TSS = (sec * NP * IF) / (FTP * 3600) * 100)
    - Chronic Training Load (CTL / Fitness - 42-day Exponential Weighted Moving Average)
    - Acute Training Load (ATL / Fatigue - 7-day Exponential Weighted Moving Average)
    - Training Stress Balance (TSB / Form = CTL - ATL)
    """

    @staticmethod
    def calculate_activity_stress(
        duration_sec: float,
        normalized_power: float,
        ftp_watts: int = 250
    ) -> Dict[str, float]:
        if ftp_watts <= 0 or normalized_power <= 0:
            return {'intensity_factor': 0.0, 'training_stress_score': 0.0}

        intensity_factor = normalized_power / float(ftp_watts)
        tss = (duration_sec * normalized_power * intensity_factor) / (ftp_watts * 3600.0) * 100.0

        return {
            'intensity_factor': round(intensity_factor, 2),
            'training_stress_score': round(tss, 1)
        }

    @staticmethod
    def compute_ctl_atl_tsb(
        daily_tss_history: List[Dict[str, Any]] # [{'date': 'YYYY-MM-DD', 'tss': float}]
    ) -> List[Dict[str, Any]]:
        """
        Computes rolling CTL, ATL, and TSB values over a chronological sequence of days.
        """
        if not daily_tss_history:
            return []

        # Sort by date
        sorted_history = sorted(daily_tss_history, key=lambda x: x['date'])

        ctl = 0.0 # 42-day time constant (k_ctl = 1 - exp(-1/42) ≈ 0.0235)
        atl = 0.0 # 7-day time constant (k_atl = 1 - exp(-1/7) ≈ 0.1331)

        time_constant_ctl = 42.0
        time_constant_atl = 7.0

        alpha_ctl = 2.0 / (time_constant_ctl + 1.0)
        alpha_atl = 2.0 / (time_constant_atl + 1.0)

        results = []
        for entry in sorted_history:
            tss = float(entry.get('tss', 0.0))
            ctl = ctl + alpha_ctl * (tss - ctl)
            atl = atl + alpha_atl * (tss - atl)
            tsb = ctl - atl

            results.append({
                'date': entry['date'],
                'ctl': round(ctl, 1),
                'atl': round(atl, 1),
                'tsb': round(tsb, 1),
                'tss': round(tss, 1)
            })

        return results
