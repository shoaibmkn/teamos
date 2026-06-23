import { requireContext } from '@/lib/server/context';
import { fail, ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { ctx, services } = await requireContext(req);
    const notifications = await services.notifications.list(ctx, 30);
    const unread = notifications.filter((n) => !n.read).length;
    return ok({ notifications, unread }, ctx.requestId);
  } catch (err) {
    return fail(err, reqId(req));
  }
}
