import { NextResponse } from 'next/server';
import { getStoredActivities } from '@/lib/storage';

export async function GET() {
  const activities = getStoredActivities();
  // Return summary without heavy telemetry_points array for list performance
  const summaries = activities.map(({ telemetry_points, ...summary }) => summary);
  return NextResponse.json(summaries);
}
