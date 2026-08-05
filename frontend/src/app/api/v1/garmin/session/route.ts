import { NextResponse } from 'next/server';
import { getGarminSession, clearGarminSession } from '@/lib/garmin_session';

export async function GET() {
  const session = getGarminSession();
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
