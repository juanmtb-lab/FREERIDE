import { NextResponse } from 'next/server';
import { getStoredActivities } from '@/lib/storage';
import { syncStravaActivitiesLive } from '@/lib/strava_live';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  let activities = getStoredActivities();

  if (activities.length === 0) {
    try {
      const synced = await syncStravaActivitiesLive({ request });
      activities = synced.activities;
    } catch (err) {
      console.log('Live Strava sync on GET /activities error:', err);
    }
  }

  const summaries = activities.map(({ telemetry_points, ...summary }) => summary);
  return NextResponse.json(summaries);
}
