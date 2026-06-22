import { requireContext } from '@/lib/server/context';
import { fail, ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: { userId: string } }) {
  try {
    const { ctx, services } = await requireContext(req);
    const body = await req.json().catch(() => ({}));
    const user = await services.users.updateUser(ctx, params.userId, body);
    return ok({ user }, ctx.requestId);
  } catch (err) {
    return fail(err, reqId(req));
  }
}
