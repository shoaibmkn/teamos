import { requireContext } from '@/lib/server/context';
import { fail, ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { ctx, services } = await requireContext(req);
    const users = await services.users.listAll(ctx);
    return ok({ users }, ctx.requestId);
  } catch (err) {
    return fail(err, reqId(req));
  }
}

export async function POST(req: Request) {
  try {
    const { ctx, services } = await requireContext(req);
    const body = await req.json().catch(() => ({}));
    const user = await services.users.createUser(ctx, body);
    return ok({ user }, ctx.requestId, 201);
  } catch (err) {
    return fail(err, reqId(req));
  }
}
