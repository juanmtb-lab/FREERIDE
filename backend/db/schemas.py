from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

class UserBase(BaseModel):
    email: str
    name: str
    weight_kg: float = 72.0
    bike_weight_kg: float = 9.5
    max_hr: int = 190
    resting_hr: int = 55
    ftp_watts: int = 250

class UserCreate(UserBase):
    pass

class UserOut(UserBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

class TelemetryPointOut(BaseModel):
    id: str
    timestamp: datetime
    elapsed_time_sec: float
    latitude: float
    longitude: float
    altitude_m: float
    distance_m: float
    speed_kmh: float
    heart_rate: Optional[int] = None
    cadence: Optional[int] = None
    gradient_pct: float = 0.0
    estimated_power_w: float = 0.0
    temperature_c: Optional[float] = None

    class Config:
        from_attributes = True

class ActivityBase(BaseModel):
    title: str
    description: Optional[str] = None
    activity_type: str = "UNKNOWN"
    file_type: str = "FIT"

class ActivityOut(ActivityBase):
    id: str
    user_id: str
    start_time: datetime
    total_elapsed_time_sec: float
    moving_time_sec: float
    total_distance_m: float
    elevation_gain_m: float
    elevation_loss_m: float
    avg_speed_kmh: float
    max_speed_kmh: float
    avg_hr: Optional[int] = None
    max_hr: Optional[int] = None
    avg_cadence: Optional[int] = None
    max_cadence: Optional[int] = None
    avg_watts_est: Optional[float] = None
    max_watts_est: Optional[float] = None
    normalized_power: Optional[float] = None
    intensity_factor: Optional[float] = None
    training_stress_score: Optional[float] = None
    hr_zone_distribution: Optional[Dict[str, float]] = None
    cadence_distribution: Optional[Dict[str, float]] = None
    gradient_distribution: Optional[Dict[str, float]] = None
    mtb_technical_score: float = 0.0
    summary_polyline: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ActivityDetailOut(ActivityOut):
    telemetry_points: List[TelemetryPointOut] = []

class AIInsightOut(BaseModel):
    id: str
    user_id: str
    activity_id: Optional[str] = None
    insight_type: str
    title: str
    content_es: str
    metrics_summary: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class FitnessBaselineOut(BaseModel):
    id: str
    user_id: str
    date: datetime
    ctl: float
    atl: float
    tsb: float

    class Config:
        from_attributes = True
