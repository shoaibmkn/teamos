import { requireContext } from '@/lib/server/context';
import { fail, ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { ctx, services } = await requireContext(req);
    const detail = await services.workflows.getInstance(ctx, params.id);
    return ok(detail, ctx.requestId);
  } catch (err) {
    return fail(err, reqId(req));
  }
}
