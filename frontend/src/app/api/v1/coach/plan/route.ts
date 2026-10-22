import { NextResponse } from 'next/server';
import { queryAiCoach } from '@/lib/n8n_coach';
import { getStoredActivities } from '@/lib/storage';
import { syncStravaActivitiesLive } from '@/lib/strava_live';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id') || undefined;
    const isOwner = !userId || userId === 'principal' || userId === 'usr_jmtb' || userId === 'default';

    if (isOwner && getStoredActivities(userId).length === 0) {
      try {
        await syncStravaActivitiesLive({ request, userId });
      } catch {}
    }
    const coachResponse = await queryAiCoach(undefined, undefined, { request, userId });
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
    const userId = request.headers.get('x-user-id') || undefined;
    const isOwner = !userId || userId === 'principal' || userId === 'usr_jmtb' || userId === 'default';

    let body: any = {};
    try {
      body = await request.json();
    } catch {}
    if (isOwner && getStoredActivities(userId).length === 0 && (!body.activities || body.activities.length === 0)) {
      try {
        await syncStravaActivitiesLive({ request, userId });
      } catch {}
    }
    const query = body.query;
    const coachResponse = await queryAiCoach(query, body.activities, { request, userId, webhookUrlOverride: body.webhook_url });
    return NextResponse.json(coachResponse);
  } catch (error: any) {
    console.error('Error querying AI Coach:', error);
    return NextResponse.json(
      { detail: error.message || 'Error al consultar al Entrenador AI' },
      { status: 500 }
    );
  }
}
