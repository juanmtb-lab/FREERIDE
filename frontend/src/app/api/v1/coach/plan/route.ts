import { NextResponse } from 'next/server';
import { queryAiCoach } from '@/lib/n8n_coach';

export async function GET() {
  try {
    const coachResponse = await queryAiCoach();
    return NextResponse.json(coachResponse);
  } catch (error: any) {
    console.error('Error generating AI Coach plan:', error);
    return NextResponse.json({ detail: error.message || 'Error al conectar con el Entrenador AI' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: any = {};
    try { body = await request.json(); } catch {}
    const query = body.query;
    const coachResponse = await queryAiCoach(query);
    return NextResponse.json(coachResponse);
  } catch (error: any) {
    console.error('Error querying AI Coach:', error);
    return NextResponse.json({ detail: error.message || 'Error al consultar al Entrenador AI' }, { status: 500 });
  }
}
