import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/storage';

export async function GET() {
  const settings = getSettings();
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updated = saveSettings(body);
    return NextResponse.json({
      message: 'Configuración guardada correctamente',
      settings: updated
    });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message || 'Error al guardar la configuración' }, { status: 400 });
  }
}
