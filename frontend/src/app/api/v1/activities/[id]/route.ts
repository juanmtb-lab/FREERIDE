import { NextResponse } from 'next/server';
import { getActivityById } from '@/lib/storage';
import { syncGarminActivitiesLive } from '@/lib/garmin_live';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  let activity = getActivityById(params.id);

  if (!activity) {
    try {
      // Trigger live sync to fetch activity from Garmin Connect API
      await syncGarminActivitiesLive();
      activity = getActivityById(params.id);
    } catch (err) {
      console.error('Error live syncing for activity detail:', err);
    }
  }

  if (!activity) {
    return NextResponse.json({ detail: 'Actividad no encontrada' }, { status: 404 });
  }

  return NextResponse.json(activity);
}
