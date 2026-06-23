import { requireContext } from '@/lib/server/context';
import { fail, ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { ctx, services } = await requireContext(req);
    const body = await req.json().catch(() => ({}));
    const log = await services.attendance.checkOut(ctx, body);
    return ok({ log }, ctx.requestId);
  } catch (err) {
    return fail(err, reqId(req));
  }
}
