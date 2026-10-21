import { NextResponse } from 'next/server';
import { syncGarminActivitiesLive } from '@/lib/garmin_live';
import { getGarminSession } from '@/lib/garmin_session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    let email: string | undefined;
    let password: string | undefined;

    try {
      const body = await request.json();
      if (body) {
        email = body.email?.trim();
        password = body.password;
      }
    } catch {}

    const existing = getGarminSession(request);
    if (!email) email = existing?.email;
    if (!password) password = existing?.password;

    if (!email || (!password && !existing?.tokens)) {
      return NextResponse.json(
        { detail: 'Por favor introduce tu correo y contraseña de Garmin Connect.' },
        { status: 400 }
      );
    }

    const { activities, syncedCount, session } = await syncGarminActivitiesLive({
      email,
      password,
      request
    });

    const summaries = activities.map(({ telemetry_points, ...summary }) => summary);

    // Encode session for client-side persistence across Vercel serverless cold starts
    const encodedAuth = session
      ? Buffer.from(JSON.stringify(session), 'utf-8').toString('base64')
      : undefined;

    return NextResponse.json({
      message: `¡Sincronización completada! Se han actualizado ${syncedCount} rutas reales desde Garmin Connect.`,
      synced_count: syncedCount,
      activities: summaries,
      garmin_auth: encodedAuth,
      email: session?.email || email
    });
  } catch (error: any) {
    console.error('Garmin Sync Error:', error);
    let userDetail = error.message || 'Error al conectar con Garmin Connect';
    if (
      String(error).includes('429') ||
      String(error).includes('rate_limited') ||
      String(error).includes('Cloudflare')
    ) {
      userDetail =
        'Garmin Connect ha limitado temporalmente las peticiones seguidas. Espera 45 segundos e inténtalo de nuevo.';
    } else if (String(error).includes('401') || String(error).includes('credentials') || String(error).includes(' ticket')) {
      userDetail =
        'Correo o contraseña de Garmin Connect incorrectos. Verifica tus datos e inténtalo de nuevo.';
    }
    return NextResponse.json({ detail: userDetail }, { status: 400 });
  }
}
