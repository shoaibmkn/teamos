import type { ReactNode } from 'react';
import type { Role } from '@teamos/core';
import { NavLinks, type NavItem } from './client/NavLinks';
import { ThemeToggle } from './client/ThemeToggle';
import { LogoutButton } from './client/LogoutButton';

function navFor(role: Role): NavItem[] {
  const myWork: NavItem = { href: '/employee', label: 'My Work', icon: '✓' };
  const team: NavItem = { href: '/manager', label: 'Team', icon: '◫' };
  const exec: NavItem = { href: '/executive', label: 'Executive', icon: '▲' };
  const workflows: NavItem = { href: '/workflows', label: 'Workflows', icon: '⇄' };

  if (role === 'Admin') return [exec, team, myWork, workflows];
  if (role === 'Manager') return [team, myWork, workflows];
  return [myWork, workflows];
}

export function AppShell({
  user,
  children,
}: {
  user: { displayName: string; role: Role; email: string };
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl">
      <aside
        className="hidden w-64 shrink-0 flex-col border-r p-4 md:flex"
        style={{ borderColor: 'rgb(var(--border))' }}
      >
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">T</span>
          <span className="text-lg font-semibold">TeamOS</span>
        </div>

        <NavLinks items={navFor(user.role)} />

        <div className="mt-auto space-y-2 pt-6">
          <div className="card p-3">
            <div className="truncate text-sm font-medium">{user.displayName}</div>
            <div className="truncate text-xs muted">{user.email}</div>
            <span className="badge mt-2 bg-brand-500/15 text-brand-300">{user.role}</span>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex items-center justify-between gap-3 border-b px-5 py-3"
          style={{ borderColor: 'rgb(var(--border))' }}
        >
          <div className="md:hidden flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">T</span>
            <span className="font-semibold">TeamOS</span>
          </div>
          <div className="hidden text-sm muted md:block">AI-native team operating system</div>
          <ThemeToggle />
        </header>
        <main className="flex-1 p-5">{children}</main>
      </div>
    </div>
  );
}
