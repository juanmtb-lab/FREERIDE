import { NextResponse } from 'next/server';
import { getStoredActivities } from '@/lib/storage';
import { syncStravaActivitiesLive } from '@/lib/strava_live';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id') || undefined;
  const isOwner = !userId || userId === 'principal' || userId === 'usr_jmtb' || userId === 'default';

  let activities = getStoredActivities(userId);

  if (activities.length === 0) {
    const hasStravaAuth = Boolean(request.headers.get('x-strava-auth'));
    if (isOwner || hasStravaAuth) {
      try {
        const synced = await syncStravaActivitiesLive({ request, userId });
        activities = synced.activities;
      } catch (err) {
        console.log('Live Strava sync on GET /activities error:', err);
      }
    }
  }

  const summaries = activities.map(({ telemetry_points, ...summary }) => summary);
  return NextResponse.json(summaries);
}
