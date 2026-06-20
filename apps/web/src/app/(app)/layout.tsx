import { redirect } from 'next/navigation';
import { optionalContext } from '@/lib/server/context';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sc = await optionalContext();
  if (!sc) redirect('/login');

  return (
    <AppShell user={{ displayName: sc.user.displayName, role: sc.user.role, email: sc.user.email }}>
      {children}
    </AppShell>
  );
}
