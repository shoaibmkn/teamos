import { requireContext } from '@/lib/server/context';
import { fail, ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { taskId: string } }) {
  try {
    const { ctx, services } = await requireContext(req);
    const activity = await services.tasks.getActivity(ctx, params.taskId);
    return ok({ activity }, ctx.requestId);
  } catch (err) {
    return fail(err, reqId(req));
  }
}
