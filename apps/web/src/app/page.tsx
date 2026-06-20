import { redirect } from 'next/navigation';
import { optionalContext } from '@/lib/server/context';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const sc = await optionalContext();
  if (!sc) redirect('/login');
  const role = sc.user.role;
  redirect(role === 'Admin' ? '/executive' : role === 'Manager' ? '/manager' : '/employee');
}
