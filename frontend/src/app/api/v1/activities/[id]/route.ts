import { NextResponse } from 'next/server';
import { deleteActivityById } from '@/lib/storage';
import { fetchGarminActivityTelemetry } from '@/lib/garmin_live';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const activity = await fetchGarminActivityTelemetry(params.id, request);
    if (!activity) {
      return NextResponse.json({ detail: 'Actividad no encontrada' }, { status: 404 });
    }
    return NextResponse.json(activity);
  } catch (error: any) {
    console.error(`Error fetching activity detail ${params.id}:`, error);
    return NextResponse.json(
      { detail: error.message || 'Error al obtener los detalles de la actividad' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const deleted = deleteActivityById(params.id);
  return NextResponse.json({ deleted, id: params.id });
}
