import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Text, JSON, Boolean, Enum
from sqlalchemy.orm import relationship
import enum
from db.session import Base

class ActivityType(str, enum.Enum):
    ROAD_BIKE = "ROAD_BIKE"
    MOUNTAIN_BIKE = "MOUNTAIN_BIKE"
    GRAVEL = "GRAVEL"
    UNKNOWN = "UNKNOWN"

class FileType(str, enum.Enum):
    FIT = "FIT"
    GPX = "GPX"

class InsightType(str, enum.Enum):
    POST_RIDE_ANALYSIS = "POST_RIDE_ANALYSIS"
    WEEKLY_PLAN = "WEEKLY_PLAN"
    RECOVERY_ADVICE = "RECOVERY_ADVICE"

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    weight_kg = Column(Float, default=72.0)
    bike_weight_kg = Column(Float, default=9.5)
    max_hr = Column(Integer, default=190)
    resting_hr = Column(Integer, default=55)
    ftp_watts = Column(Integer, default=250)
    created_at = Column(DateTime, default=datetime.utcnow)

    activities = relationship("Activity", back_populates="user", cascade="all, delete-orphan")
    fitness_baselines = relationship("FitnessBaseline", back_populates="user", cascade="all, delete-orphan")
    ai_insights = relationship("AIInsight", back_populates="user", cascade="all, delete-orphan")


class Activity(Base):
    __tablename__ = "activities"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    activity_type = Column(String, default=ActivityType.UNKNOWN.value)
    file_type = Column(String, default=FileType.FIT.value)
    start_time = Column(DateTime, nullable=False)
    
    # Global Telemetry Summaries
    total_elapsed_time_sec = Column(Float, default=0.0)
    moving_time_sec = Column(Float, default=0.0)
    total_distance_m = Column(Float, default=0.0)
    elevation_gain_m = Column(Float, default=0.0)
    elevation_loss_m = Column(Float, default=0.0)
    avg_speed_kmh = Column(Float, default=0.0)
    max_speed_kmh = Column(Float, default=0.0)
    avg_hr = Column(Integer, nullable=True)
    max_hr = Column(Integer, nullable=True)
    avg_cadence = Column(Integer, nullable=True)
    max_cadence = Column(Integer, nullable=True)
    avg_watts_est = Column(Float, nullable=True)
    max_watts_est = Column(Float, nullable=True)
    normalized_power = Column(Float, nullable=True)
    intensity_factor = Column(Float, nullable=True)
    training_stress_score = Column(Float, nullable=True)
    
    # Advanced Distributions & Classifications
    hr_zone_distribution = Column(JSON, nullable=True) # {z1: sec, z2: sec, z3: sec, z4: sec, z5: sec}
    cadence_distribution = Column(JSON, nullable=True) # {coasting: %, steady: %, climbing_burst: %, sprint: %}
    gradient_distribution = Column(JSON, nullable=True) # {flat: %, mild_climb: %, steep_climb: %, downhill: %}
    mtb_technical_score = Column(Float, default=0.0) # 0 to 10 scale of MTB technicality
    summary_polyline = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="activities")
    telemetry_points = relationship("TelemetryPoint", back_populates="activity", cascade="all, delete-orphan")
    ai_insights = relationship("AIInsight", back_populates="activity", cascade="all, delete-orphan")


class TelemetryPoint(Base):
    __tablename__ = "telemetry_points"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    activity_id = Column(String, ForeignKey("activities.id"), index=True, nullable=False)
    timestamp = Column(DateTime, nullable=False)
    elapsed_time_sec = Column(Float, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    altitude_m = Column(Float, nullable=False)
    distance_m = Column(Float, nullable=False)
    speed_kmh = Column(Float, default=0.0)
    heart_rate = Column(Integer, nullable=True)
    cadence = Column(Integer, nullable=True)
    gradient_pct = Column(Float, default=0.0)
    estimated_power_w = Column(Float, default=0.0)
    temperature_c = Column(Float, nullable=True)

    activity = relationship("Activity", back_populates="telemetry_points")


class FitnessBaseline(Base):
    __tablename__ = "fitness_baselines"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    ctl = Column(Float, default=0.0) # Chronic Training Load / Fitness
    atl = Column(Float, default=0.0) # Acute Training Load / Fatigue
    tsb = Column(Float, default=0.0) # Training Stress Balance / Form
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="fitness_baselines")


class AIInsight(Base):
    __tablename__ = "ai_insights"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    activity_id = Column(String, ForeignKey("activities.id"), nullable=True)
    insight_type = Column(String, default=InsightType.POST_RIDE_ANALYSIS.value)
    title = Column(String, nullable=False)
    content_es = Column(Text, nullable=False) # Spanish response
    metrics_summary = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="ai_insights")
    activity = relationship("Activity", back_populates="ai_insights")
