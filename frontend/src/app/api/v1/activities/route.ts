import { NextResponse } from 'next/server';
import { getStoredActivities } from '@/lib/storage';
import { syncGarminActivitiesLive } from '@/lib/garmin_live';

export async function GET() {
  try {
    // Attempt live sync from Garmin Connect API if session is active
    await syncGarminActivitiesLive();
  } catch (err) {
    console.log('Live Garmin sync on GET /activities error:', err);
  }

  const activities = getStoredActivities();
  const summaries = activities.map(({ telemetry_points, ...summary }) => summary);
  return NextResponse.json(summaries);
}
