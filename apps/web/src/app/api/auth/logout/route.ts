import { clearSessionCookie } from '@/lib/server/session';
import { ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  clearSessionCookie();
  return ok({ loggedOut: true }, reqId(req));
}
