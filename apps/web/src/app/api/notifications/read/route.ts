import { requireContext } from '@/lib/server/context';
import { fail, ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { ctx, services } = await requireContext(req);
    const body = (await req.json().catch(() => ({}))) as { id?: string; all?: boolean };
    if (body.all) await services.notifications.markAllRead(ctx);
    else if (body.id) await services.notifications.markRead(ctx, body.id);
    return ok({ ok: true }, ctx.requestId);
  } catch (err) {
    return fail(err, reqId(req));
  }
}
