from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional

from db.session import get_db
from db.models import Activity, User, AIInsight, InsightType
from db.schemas import AIInsightOut
from ai.coach_service import AICoachService
from analytics.training_load import TrainingLoadEngine

router = APIRouter(prefix="/coach", tags=["AI Coach"])

@router.post("/analyze/{activity_id}", response_model=AIInsightOut)
async def generate_activity_insight(
    activity_id: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Activity).where(Activity.id == activity_id))
    activity = result.scalars().first()
    if not activity:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")

    user_result = await db.execute(select(User).where(User.id == activity.user_id))
    user = user_result.scalars().first()

    activity_dict = {
        'title': activity.title,
        'activity_type': activity.activity_type,
        'moving_time_sec': activity.moving_time_sec,
        'total_distance_m': activity.total_distance_m,
        'elevation_gain_m': activity.elevation_gain_m,
        'avg_speed_kmh': activity.avg_speed_kmh,
        'max_speed_kmh': activity.max_speed_kmh,
        'avg_hr': activity.avg_hr,
        'max_hr': activity.max_hr,
        'avg_cadence': activity.avg_cadence,
        'avg_watts_est': activity.avg_watts_est,
        'normalized_power': activity.normalized_power,
        'hr_zone_distribution': activity.hr_zone_distribution,
        'cadence_distribution': activity.cadence_distribution,
        'mtb_technical_score': activity.mtb_technical_score
    }

    user_dict = {
        'name': user.name if user else 'Ciclista',
        'weight_kg': user.weight_kg if user else 72.0,
        'max_hr': user.max_hr if user else 190,
        'ftp_watts': user.ftp_watts if user else 250
    }

    spanish_analysis = await AICoachService.analyze_activity(activity_dict, user_dict)

    insight = AIInsight(
        user_id=activity.user_id,
        activity_id=activity.id,
        insight_type=InsightType.POST_RIDE_ANALYSIS.value,
        title=f"Análisis Entrenador - {activity.title}",
        content_es=spanish_analysis,
        metrics_summary=activity_dict
    )

    db.add(insight)
    await db.commit()
    await db.refresh(insight)

    return insight


@router.get("/plan", response_model=AIInsightOut)
async def get_weekly_plan(
    db: AsyncSession = Depends(get_db)
):
    user_result = await db.execute(select(User).limit(1))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Fetch recent activities to estimate TSS
    act_result = await db.execute(select(Activity).where(Activity.user_id == user.id))
    activities = act_result.scalars().all()

    daily_tss = []
    for act in activities:
        tss_data = TrainingLoadEngine.calculate_activity_stress(
            duration_sec=act.moving_time_sec,
            normalized_power=act.normalized_power or act.avg_watts_est or 150,
            ftp_watts=user.ftp_watts
        )
        daily_tss.append({
            'date': act.start_time.strftime('%Y-%m-%d'),
            'tss': tss_data['training_stress_score']
        })

    load_trends = TrainingLoadEngine.compute_ctl_atl_tsb(daily_tss)
    latest_load = load_trends[-1] if load_trends else {'ctl': 40.0, 'atl': 45.0, 'tsb': -5.0}

    spanish_plan = await AICoachService.generate_weekly_plan(
        user_profile={'name': user.name, 'weight_kg': user.weight_kg, 'ftp_watts': user.ftp_watts},
        load_metrics=latest_load
    )

    insight = AIInsight(
        user_id=user.id,
        insight_type=InsightType.WEEKLY_PLAN.value,
        title="Plan Semanal Adaptativo FREERIDE",
        content_es=spanish_plan,
        metrics_summary=latest_load
    )

    db.add(insight)
    await db.commit()
    await db.refresh(insight)

    return insight


@router.get("/insights", response_model=List[AIInsightOut])
async def list_insights(
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AIInsight)
        .order_by(AIInsight.created_at.desc())
        .limit(10)
    )
    return result.scalars().all()
