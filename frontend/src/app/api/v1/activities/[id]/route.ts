import { NextResponse } from 'next/server';
import { getActivityById } from '@/lib/storage';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const activity = getActivityById(params.id);
  if (!activity) {
    return NextResponse.json({ detail: 'Actividad no encontrada' }, { status: 404 });
  }
  return NextResponse.json(activity);
}
