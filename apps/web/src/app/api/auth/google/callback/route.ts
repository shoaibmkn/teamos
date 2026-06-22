import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isAppError } from '@teamos/core';
import { baseUrl, emailFromCode, googleConfigFromEnv, redirectUri } from '@/lib/server/google-oauth';
import { getRuntime } from '@/lib/server/runtime';
import { setSessionCookie } from '@/lib/server/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const home = baseUrl(req);
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const saved = cookies().get('teamos_oauth_state')?.value;
  cookies().delete('teamos_oauth_state');

  const config = googleConfigFromEnv();
  if (!config) return NextResponse.redirect(`${home}/login?error=google_not_configured`);
  if (!code || !state || state !== saved) return NextResponse.redirect(`${home}/login?error=oauth_state`);

  try {
    const email = await emailFromCode(config, redirectUri(req), code);
    const { services } = await getRuntime();
    const user = await services.users.resolveActiveByEmail(email);
    setSessionCookie(user.id);
    return NextResponse.redirect(`${home}/`);
  } catch (err) {
    const reason = isAppError(err) ? err.code : 'oauth_failed';
    return NextResponse.redirect(`${home}/login?error=${encodeURIComponent(reason)}`);
  }
}
