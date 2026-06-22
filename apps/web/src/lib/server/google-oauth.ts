// Minimal Google OAuth (authorization-code flow) for Workspace sign-in. Reuses
// the existing httpOnly cookie session. Client id/secret are server-only. No
// heavyweight auth framework — just the official google-auth-library to build
// the consent URL, exchange the code, and verify the id token.

import 'server-only';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export function googleConfigFromEnv(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Base URL of the deployment, used to build the OAuth redirect URI. */
export function baseUrl(req: Request): string {
  const fromEnv = process.env.NEXTAUTH_URL || process.env.TEAMOS_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const url = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? url.host;
  return `${proto}://${host}`;
}

export function redirectUri(req: Request): string {
  return `${baseUrl(req)}/api/auth/google/callback`;
}

function client(config: GoogleOAuthConfig, redirect: string): OAuth2Client {
  return new OAuth2Client({ clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: redirect });
}

export function buildAuthUrl(config: GoogleOAuthConfig, redirect: string, state: string): string {
  return client(config, redirect).generateAuthUrl({
    access_type: 'online',
    prompt: 'select_account',
    scope: ['openid', 'email', 'profile'],
    state,
  });
}

/** Exchange the auth code and return the verified Workspace email. */
export async function emailFromCode(config: GoogleOAuthConfig, redirect: string, code: string): Promise<string> {
  const c = client(config, redirect);
  const { tokens } = await c.getToken(code);
  if (!tokens.id_token) throw new Error('No id_token returned by Google.');
  const ticket = await c.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId });
  const payload = ticket.getPayload();
  if (!payload?.email || payload.email_verified === false) {
    throw new Error('Google account email not verified.');
  }
  return payload.email;
}
