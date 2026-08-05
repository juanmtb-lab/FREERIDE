from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime

from db.session import get_db
from db.models import Activity, TelemetryPoint, User, ActivityType, FileType
from db.schemas import ActivityOut, ActivityDetailOut, ActivityBase
from parsers.fit_parser import FITParser
from parsers.gpx_parser import GPXParser
from parsers.telemetry_processor import TelemetryProcessor
from ai.coach_service import AICoachService

router = APIRouter(prefix="/activities", tags=["Activities"])

async def get_or_create_default_user(db: AsyncSession) -> User:
    result = await db.execute(select(User).limit(1))
    user = result.scalars().first()
    if not user:
        user = User(
            email="cyclist@freeride.app",
            name="Ciclista FREERIDE",
            weight_kg=72.0,
            bike_weight_kg=9.5,
            max_hr=190,
            resting_hr=55,
            ftp_watts=250
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


@router.post("/upload", response_model=ActivityOut)
async def upload_activity(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    user = await get_or_create_default_user(db)
    file_bytes = await file.read()
    filename = file.filename.lower()

    if filename.endswith(".fit"):
        header, raw_points = FITParser.parse_fit_bytes(file_bytes)
        file_type_enum = FileType.FIT.value
    elif filename.endswith(".gpx"):
        header, raw_points = GPXParser.parse_gpx_bytes(file_bytes)
        file_type_enum = FileType.GPX.value
    else:
        raise HTTPException(status_code=400, detail="Formato de archivo no soportado. Sube un archivo .FIT o .GPX")

    if not raw_points:
        raise HTTPException(status_code=400, detail="No se encontraron datos de telemetría válidos en el archivo.")

    # Process telemetry
    summary, processed_points = TelemetryProcessor.process(
        points=raw_points,
        rider_weight_kg=user.weight_kg,
        bike_weight_kg=user.bike_weight_kg,
        max_hr=user.max_hr
    )

    activity_title = title or file.filename.rsplit('.', 1)[0].replace('_', ' ').replace('-', ' ').title()

    activity = Activity(
        user_id=user.id,
        title=activity_title,
        description=description,
        activity_type=summary['activity_type'],
        file_type=file_type_enum,
        start_time=header['start_time'],
        total_elapsed_time_sec=summary['total_elapsed_time_sec'],
        moving_time_sec=summary['moving_time_sec'],
        total_distance_m=summary['total_distance_m'],
        elevation_gain_m=summary['elevation_gain_m'],
        elevation_loss_m=summary['elevation_loss_m'],
        avg_speed_kmh=summary['avg_speed_kmh'],
        max_speed_kmh=summary['max_speed_kmh'],
        avg_hr=summary['avg_hr'],
        max_hr=summary['max_hr'],
        avg_cadence=summary['avg_cadence'],
        max_cadence=summary['max_cadence'],
        avg_watts_est=summary['avg_watts_est'],
        max_watts_est=summary['max_watts_est'],
        normalized_power=summary['normalized_power'],
        hr_zone_distribution=summary['hr_zone_distribution'],
        cadence_distribution=summary['cadence_distribution'],
        mtb_technical_score=summary['mtb_technical_score'],
        summary_polyline=summary['summary_polyline']
    )

    db.add(activity)
    await db.flush() # Populate activity.id

    # Add Telemetry Points
    telemetry_objs = [
        TelemetryPoint(
            activity_id=activity.id,
            timestamp=pt['timestamp'],
            elapsed_time_sec=pt['elapsed_time_sec'],
            latitude=pt['latitude'],
            longitude=pt['longitude'],
            altitude_m=pt['altitude_m'],
            distance_m=pt['distance_m'],
            speed_kmh=pt['speed_kmh'],
            heart_rate=pt['heart_rate'],
            cadence=pt['cadence'],
            gradient_pct=pt['gradient_pct'],
            estimated_power_w=pt['estimated_power_w'],
            temperature_c=pt['temperature_c']
        )
        for pt in processed_points
    ]

    db.add_all(telemetry_objs)
    await db.commit()
    await db.refresh(activity)

    return activity


@router.get("", response_model=List[ActivityOut])
async def list_activities(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Activity)
        .order_by(Activity.start_time.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{activity_id}", response_model=ActivityDetailOut)
async def get_activity_detail(
    activity_id: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Activity)
        .options(selectinload(Activity.telemetry_points))
        .where(Activity.id == activity_id)
    )
    activity = result.scalars().first()
    if not activity:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    return activity


@router.delete("/{activity_id}")
async def delete_activity(
    activity_id: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Activity).where(Activity.id == activity_id))
    activity = result.scalars().first()
    if not activity:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    await db.delete(activity)
    await db.commit()
    return {"message": "Actividad eliminada con éxito"}
