import { NextResponse } from 'next/server';
import { getStoredActivities } from '@/lib/storage';
import { syncGarminActivitiesLive } from '@/lib/garmin_live';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  let activities = getStoredActivities();

  // If storage is empty (e.g. cold serverless instance), sync from Garmin Connect automatically
  if (activities.length === 0) {
    try {
      const synced = await syncGarminActivitiesLive({ request });
      activities = synced.activities;
    } catch (err) {
      console.log('Live Garmin sync on GET /activities error:', err);
    }
  }

  const summaries = activities.map(({ telemetry_points, ...summary }) => summary);
  return NextResponse.json(summaries);
}
