import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { baseUrl, buildAuthUrl, googleConfigFromEnv, redirectUri } from '@/lib/server/google-oauth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const config = googleConfigFromEnv();
  const home = baseUrl(req);
  if (!config) return NextResponse.redirect(`${home}/login?error=google_not_configured`);

  const state = randomUUID();
  cookies().set('teamos_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });
  return NextResponse.redirect(buildAuthUrl(config, redirectUri(req), state));
}
