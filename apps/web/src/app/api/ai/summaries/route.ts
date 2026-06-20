// Advisory summary generation. The service enforces the AI boundary: this
// endpoint can only produce summary records, never mutate source data
// (ADR-0003). AI_UNAVAILABLE is returned as a structured error if Gemini fails.

import { requireContext } from '@/lib/server/context';
import { fail, ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { ctx, services } = await requireContext(req);
    const body = await req.json().catch(() => ({}));
    const result = await services.ai.generateSummary(ctx, body);
    return ok(result, ctx.requestId, 201);
  } catch (err) {
    return fail(err, reqId(req));
  }
}
