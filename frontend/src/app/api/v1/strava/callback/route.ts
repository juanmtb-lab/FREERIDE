import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const redirectUrl = new URL('/', request.url);
  if (error) {
    redirectUrl.searchParams.set('strava_error', error);
    return NextResponse.redirect(redirectUrl);
  }
  if (code) {
    redirectUrl.searchParams.set('code', code);
  }
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }

  return NextResponse.redirect(redirectUrl);
}
