import { NextResponse } from 'next/server';
import { getStravaSession, clearStravaSession } from '@/lib/strava_session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const session = getStravaSession(request);
  if (session && (session.accessToken || session.refreshToken)) {
    return NextResponse.json({
      connected: true,
      athleteName: session.athleteName || 'Atleta Strava',
      clientId: session.clientId || '',
      connectedAt: session.connectedAt
    });
  }
  return NextResponse.json({ connected: false });
}

export async function DELETE() {
  clearStravaSession();
  return NextResponse.json({ message: 'Sesión de Strava desconectada' });
}
