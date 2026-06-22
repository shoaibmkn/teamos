// Low-level Google Sheets client. Server-only. Authenticates with a service
// account (JWT) and talks to the Sheets REST API. The service-account key lives
// only in server env — never in the frontend (security-model.md).

import 'server-only';
import { JWT } from 'google-auth-library';
import type { SheetName } from './schema';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface SheetsConfig {
  spreadsheetId: string;
  clientEmail: string;
  privateKey: string;
}

export function sheetsConfigFromEnv(): SheetsConfig | null {
  const spreadsheetId = process.env.TEAMOS_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // Private key is stored with literal \n in env; restore real newlines.
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!spreadsheetId || !clientEmail || !privateKey) return null;
  return { spreadsheetId, clientEmail, privateKey };
}

export class SheetsClient {
  private readonly jwt: JWT;
  private readonly spreadsheetId: string;

  constructor(config: SheetsConfig) {
    this.spreadsheetId = config.spreadsheetId;
    this.jwt = new JWT({ email: config.clientEmail, key: config.privateKey, scopes: [SCOPE] });
  }

  private async token(): Promise<string> {
    const t = await this.jwt.getAccessToken();
    if (!t.token) throw new Error('Failed to obtain Google access token.');
    return t.token;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}/${this.spreadsheetId}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Sheets API ${method} ${path} failed: ${res.status} ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  /** All data rows of a tab (excluding the header row), as raw string cells. */
  async getRows(tab: SheetName): Promise<string[][]> {
    const range = encodeURIComponent(`${tab}!A2:ZZ`);
    const json = await this.call<{ values?: string[][] }>('GET', `/values/${range}`);
    return json.values ?? [];
  }

  async appendRow(tab: SheetName, row: (string | number)[]): Promise<void> {
    const range = encodeURIComponent(`${tab}!A1`);
    await this.call('POST', `/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      values: [row],
    });
  }

  /** Update a specific 1-based data row (row 1 = first data row under header). */
  async updateRow(tab: SheetName, dataRowIndex: number, row: (string | number)[]): Promise<void> {
    const sheetRow = dataRowIndex + 1; // +1 for header offset
    const range = encodeURIComponent(`${tab}!A${sheetRow}`);
    await this.call('PUT', `/values/${range}?valueInputOption=RAW`, { values: [row] });
  }

  async listTabTitles(): Promise<string[]> {
    const json = await this.call<{ sheets?: { properties?: { title?: string } }[] }>(
      'GET',
      '?fields=sheets.properties.title',
    );
    return (json.sheets ?? []).map((s) => s.properties?.title ?? '').filter(Boolean);
  }

  async addTab(title: string): Promise<void> {
    await this.call('POST', ':batchUpdate', { requests: [{ addSheet: { properties: { title } } }] });
  }

  async setHeader(tab: SheetName, headers: readonly string[]): Promise<void> {
    const range = encodeURIComponent(`${tab}!A1`);
    await this.call('PUT', `/values/${range}?valueInputOption=RAW`, { values: [headers] });
  }
}
