// Server-only runtime singleton. Builds repositories, wires services with the
// configured AI provider, and selects the data backend. Cached on globalThis so
// it survives Next.js hot reloads and serverless module reuse.
//
// Backend: TEAMOS_DATA_BACKEND=sheets uses Google Sheets (production); anything
// else uses the in-memory seeded backend (local dev / demo).

import 'server-only';
import {
  GeminiAiProvider,
  OfflineAiProvider,
  createInMemoryRepositories,
  createServices,
  newId,
  seedDemoOrg,
  type AiProvider,
  type Repositories,
  type SeededOrg,
  type Services,
} from '@teamos/core';
import { SheetsClient, sheetsConfigFromEnv } from './sheets/client';
import { createSheetsRepositories } from './sheets/repository';
import { createFileRepositories } from './file/repository';

export interface TeamOsRuntime {
  services: Services;
  repos: Repositories;
  org?: SeededOrg;
  aiMode: 'gemini' | 'offline';
  backend: 'sheets' | 'memory' | 'file';
}

async function seedAdminIfEmpty(repos: Repositories): Promise<void> {
  const email = process.env.TEAMOS_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return;
  if ((await repos.users.list()).length > 0) return;
  const now = new Date().toISOString();
  await repos.users.create({
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
  });
}

declare global {
  // eslint-disable-next-line no-var
  var __teamosRuntime__: Promise<TeamOsRuntime> | undefined;
}

function allowedDomains(): string[] {
  return (process.env.TEAMOS_ALLOWED_DOMAINS ?? 'example.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function selectAi(): { ai: AiProvider; mode: 'gemini' | 'offline' } {
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    return { ai: new GeminiAiProvider({ apiKey: key, model: process.env.GEMINI_MODEL }), mode: 'gemini' };
  }
  return { ai: new OfflineAiProvider(), mode: 'offline' };
}

async function build(): Promise<TeamOsRuntime> {
  const { ai, mode } = selectAi();
  const config = { allowedDomains: allowedDomains(), timezone: process.env.TEAMOS_TIMEZONE || 'UTC' };

  if (process.env.TEAMOS_DATA_BACKEND === 'sheets') {
    const cfg = sheetsConfigFromEnv();
    if (!cfg) {
      throw new Error('TEAMOS_DATA_BACKEND=sheets but TEAMOS_SPREADSHEET_ID / GOOGLE_SERVICE_ACCOUNT_* are missing.');
    }
    const repos = createSheetsRepositories(new SheetsClient(cfg));
    return { services: createServices({ repos, ai, config }), repos, aiMode: mode, backend: 'sheets' };
  }

  if (process.env.TEAMOS_DATA_BACKEND === 'file') {
    const path = process.env.TEAMOS_DATA_FILE || '/data/teamos.json';
    const repos = await createFileRepositories(path);
    await seedAdminIfEmpty(repos);
    return { services: createServices({ repos, ai, config }), repos, aiMode: mode, backend: 'file' };
  }

  const repos = createInMemoryRepositories();
  const org = await seedDemoOrg(repos);
  return { services: createServices({ repos, ai, config }), repos, org, aiMode: mode, backend: 'memory' };
}

export function getRuntime(): Promise<TeamOsRuntime> {
  if (!globalThis.__teamosRuntime__) {
    globalThis.__teamosRuntime__ = build();
  }
  return globalThis.__teamosRuntime__;
}
