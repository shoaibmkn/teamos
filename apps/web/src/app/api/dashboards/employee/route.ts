import { requireContext } from '@/lib/server/context';
import { fail, ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { ctx, services } = await requireContext(req);
    const dashboard = await services.dashboards.employee(ctx);
    return ok(dashboard, ctx.requestId);
  } catch (err) {
    return fail(err, reqId(req));
  }
}
