// Server-only runtime singleton. Builds repositories, seeds the demo org, and
// wires services with the configured AI provider. Cached on globalThis so it
// survives Next.js hot reloads and serverless module reuse.
//
// Backend selection: defaults to the in-memory seeded backend (runnable now).
// The documented Sheets/Apps Script backend plugs in here by swapping repos.

import 'server-only';
import {
  GeminiAiProvider,
  OfflineAiProvider,
  createInMemoryRepositories,
  createServices,
  seedDemoOrg,
  type AiProvider,
  type Repositories,
  type SeededOrg,
  type Services,
} from '@teamos/core';

export interface TeamOsRuntime {
  services: Services;
  repos: Repositories;
  org: SeededOrg;
  aiMode: 'gemini' | 'offline';
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
    return {
      ai: new GeminiAiProvider({ apiKey: key, model: process.env.GEMINI_MODEL }),
      mode: 'gemini',
    };
  }
  return { ai: new OfflineAiProvider(), mode: 'offline' };
}

async function build(): Promise<TeamOsRuntime> {
  const repos = createInMemoryRepositories();
  const org = await seedDemoOrg(repos);
  const { ai, mode } = selectAi();
  const services = createServices({ repos, ai, config: { allowedDomains: allowedDomains() } });
  return { services, repos, org, aiMode: mode };
}

export function getRuntime(): Promise<TeamOsRuntime> {
  if (!globalThis.__teamosRuntime__) {
    globalThis.__teamosRuntime__ = build();
  }
  return globalThis.__teamosRuntime__;
}
