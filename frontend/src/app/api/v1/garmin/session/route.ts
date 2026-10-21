import { NextResponse } from 'next/server';
import { getGarminSession, clearGarminSession } from '@/lib/garmin_session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const session = getGarminSession(request);
  if (session && session.email) {
    return NextResponse.json({
      connected: true,
      email: session.email,
      connectedAt: session.connectedAt
    });
  }
  return NextResponse.json({ connected: false });
}

export async function DELETE() {
  clearGarminSession();
  return NextResponse.json({ message: 'Sesión de Garmin cerrada' });
}
