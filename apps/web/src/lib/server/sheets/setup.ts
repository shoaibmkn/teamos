// One-time provisioning for the Sheets backend: ensure every tab exists with
// its header row, and seed the first admin user so the initial Google sign-in
// resolves to an account. Idempotent — safe to run repeatedly.

import 'server-only';
import { newId } from '@teamos/core';
import type { User } from '@teamos/core';
import { SHEET_COLUMNS, SHEET_NAMES } from './schema';
import { SheetsClient } from './client';

export interface SetupResult {
  createdTabs: string[];
  seededAdmin: string | null;
}

export async function ensureSheetsStructure(client: SheetsClient, adminEmail?: string): Promise<SetupResult> {
  const existing = new Set(await client.listTabTitles());
  const createdTabs: string[] = [];

  for (const tab of SHEET_NAMES) {
    if (!existing.has(tab)) {
      await client.addTab(tab);
      createdTabs.push(tab);
    }
    await client.setHeader(tab, SHEET_COLUMNS[tab]);
  }

  let seededAdmin: string | null = null;
  const email = adminEmail?.trim();
  if (email) {
    const users = await client.getRows('Users');
    const exists = users.some((r) => (r[1] ?? '').toLowerCase() === email.toLowerCase());
    if (!exists) {
      const now = new Date().toISOString();
      const admin: User = {
        id: newId('user'),
        email,
        displayName: email.split('@')[0] ?? 'Admin',
        role: 'Admin',
        status: 'Active',
        department: 'Operations',
        createdAt: now,
        createdBy: 'system',
        updatedAt: now,
        updatedBy: 'system',
      };
      await client.appendRow(
        'Users',
        SHEET_COLUMNS.Users.map((h) => (admin as unknown as Record<string, unknown>)[h] ?? '') as (string | number)[],
      );
      seededAdmin = admin.id;
    }
  }

  return { createdTabs, seededAdmin };
}
