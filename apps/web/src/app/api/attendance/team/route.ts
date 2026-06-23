import { requireContext } from '@/lib/server/context';
import { fail, ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { ctx, services } = await requireContext(req);
    const team = await services.attendance.teamToday(ctx);
    return ok({ team }, ctx.requestId);
  } catch (err) {
    return fail(err, reqId(req));
  }
}
