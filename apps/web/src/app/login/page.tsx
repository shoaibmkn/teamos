import { redirect } from 'next/navigation';
import { optionalContext } from '@/lib/server/context';
import { LoginPanel } from '@/components/client/LoginPanel';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const sc = await optionalContext();
  if (sc) redirect('/');

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-base font-bold text-white">T</span>
          <span className="text-2xl font-semibold">TeamOS</span>
        </div>
        <LoginPanel />
        <p className="mt-4 text-center text-xs muted">
          Evidence-driven work. Immutable audit. Advisory AI that never mutates records.
        </p>
      </div>
    </main>
  );
}
