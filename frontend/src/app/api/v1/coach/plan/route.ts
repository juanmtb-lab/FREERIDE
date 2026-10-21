import { NextResponse } from 'next/server';
import { queryAiCoach } from '@/lib/n8n_coach';
import { getStoredActivities } from '@/lib/storage';
import { syncStravaActivitiesLive } from '@/lib/strava_live';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    if (getStoredActivities().length === 0) {
      try {
        await syncStravaActivitiesLive({ request });
      } catch {}
    }
    const coachResponse = await queryAiCoach();
    return NextResponse.json(coachResponse);
  } catch (error: any) {
    console.error('Error generating AI Coach plan:', error);
    return NextResponse.json(
      { detail: error.message || 'Error al conectar con el Entrenador AI' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}
    if (getStoredActivities().length === 0 && (!body.activities || body.activities.length === 0)) {
      try {
        await syncStravaActivitiesLive({ request });
      } catch {}
    }
    const query = body.query;
    const coachResponse = await queryAiCoach(query, body.activities);
    return NextResponse.json(coachResponse);
  } catch (error: any) {
    console.error('Error querying AI Coach:', error);
    return NextResponse.json(
      { detail: error.message || 'Error al consultar al Entrenador AI' },
      { status: 500 }
    );
  }
}
