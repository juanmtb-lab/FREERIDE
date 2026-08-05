from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from db.session import get_db
from db.models import TelemetryPoint
from db.schemas import TelemetryPointOut

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])

@router.get("/{activity_id}", response_model=List[TelemetryPointOut])
async def get_activity_telemetry(
    activity_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns downsampled or full telemetry stream for 3D route rendering and playback.
    """
    result = await db.execute(
        select(TelemetryPoint)
        .where(TelemetryPoint.activity_id == activity_id)
        .order_by(TelemetryPoint.timestamp.asc())
    )
    points = result.scalars().all()
    if not points:
        raise HTTPException(status_code=404, detail="No se encontraron puntos de telemetría")
    return points
