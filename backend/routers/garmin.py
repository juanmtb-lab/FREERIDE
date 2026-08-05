from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from db.session import get_db
from db.models import Activity, TelemetryPoint, User, FileType
from parsers.fit_parser import FITParser
from parsers.telemetry_processor import TelemetryProcessor
from services.garmin_sync import GarminConnectSyncService

router = APIRouter(prefix="/garmin", tags=["Garmin Connect Sync"])

class GarminLoginRequest(BaseModel):
    email: str
    password: str

@router.post("/sync")
async def sync_garmin_connect(
    req: GarminLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Connects to Garmin Connect account, fetches latest .FIT activity files,
    and automatically ingests them into FREERIDE.
    """
    sync_service = GarminConnectSyncService(email=req.email, password=req.password)
    if not sync_service.login():
        raise HTTPException(
            status_code=401,
            detail="No se pudo iniciar sesión en Garmin Connect. Verifica tu email y contraseña."
        )

    downloaded = sync_service.fetch_latest_fit_files(limit=3)
    if not downloaded:
        return {"message": "No se encontraron nuevas actividades en Garmin Connect.", "synced_count": 0}

    # Fetch default user
    from routers.activities import get_or_create_default_user
    user = await get_or_create_default_user(db)

    synced_count = 0
    for item in downloaded:
        try:
            header, raw_points = FITParser.parse_fit_bytes(item['fit_bytes'])
            if not raw_points:
                continue

            summary, processed_points = TelemetryProcessor.process(
                points=raw_points,
                rider_weight_kg=user.weight_kg,
                bike_weight_kg=user.bike_weight_kg,
                max_hr=user.max_hr
            )

            activity = Activity(
                user_id=user.id,
                title=item['title'],
                activity_type=summary['activity_type'],
                file_type=FileType.FIT.value,
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
            await db.flush()

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
            synced_count += 1
        except Exception as e:
            print(f"Error procesando actividad de Garmin: {e}")

    await db.commit()
    return {"message": f"Sincronización completada con éxito.", "synced_count": synced_count}
