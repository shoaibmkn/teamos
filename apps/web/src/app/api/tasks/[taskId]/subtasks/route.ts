import { requireContext } from '@/lib/server/context';
import { fail, ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { taskId: string } }) {
  try {
    const { ctx, services } = await requireContext(req);
    const subtasks = await services.subtasks.list(ctx, params.taskId);
    return ok({ subtasks }, ctx.requestId);
  } catch (err) {
    return fail(err, reqId(req));
  }
}

export async function POST(req: Request, { params }: { params: { taskId: string } }) {
  try {
    const { ctx, services } = await requireContext(req);
    const body = await req.json().catch(() => ({}));
    const subtask = await services.subtasks.add(ctx, params.taskId, body);
    return ok({ subtask }, ctx.requestId, 201);
  } catch (err) {
    return fail(err, reqId(req));
  }
}
