# TeamOS — Google Apps Script Backend (MVP target)

This is the documented MVP API layer from [ADR-0001](../../architecture/adr/0001-target-mvp-architecture.md):
Google Apps Script as the HTTP API, Google Sheets as the datastore, Google Drive
for evidence files, and Gemini (server-side) for advisory AI. It implements the
same contract as the runnable `@teamos/web` backend and enforces the same rules
(RBAC, validation, append-only activity, immutable evidence, no hard deletes,
AI-advisory boundary).

> The web app in `apps/web` runs this contract today on an in-memory backend so
> the product is verifiable without a Google project. This folder is the
> production data path: deploy it, then point the web app at it with
> `TEAMOS_DATA_BACKEND=sheets` and `TEAMOS_APPS_SCRIPT_URL=<web app url>`.

## Files

| File | Responsibility |
| --- | --- |
| `appsscript.json` | Manifest: V8 runtime, OAuth scopes, domain-scoped web app |
| `Constants.gs` | Enums, ID strategy, error model |
| `Repository.gs` | All Sheets/Drive access (ADR-0002), `setup()` provisioning |
| `Services.gs` | RBAC, validation, task/evidence/workflow use cases |
| `Dashboards.gs` | Dashboard computation + AI summary use case |
| `Ai.gs` | Gemini advisory provider + offline fallback (ADR-0003) |
| `Code.gs` | `doGet`/`doPost` router, `setup()`, `seedDemo()` |

## Deploy with clasp

```bash
npm install -g @google/clasp
clasp login
clasp create --type webapp --title "TeamOS API" --rootDir apps/appsscript
clasp push
```

Then in the Apps Script editor:

1. Run `setup()` once to create the spreadsheet and tabs. It stores the new
   spreadsheet id in the `TEAMOS_SPREADSHEET_ID` script property.
2. (Optional) Run `seedDemo()` to insert a demo org for manual testing.
3. **Project Settings → Script properties**, add:
   - `TEAMOS_ALLOWED_DOMAINS` — comma-separated Workspace domains (e.g. `acme.com`).
   - `GEMINI_API_KEY` — optional; omit to use the deterministic offline summarizer.
   - `GEMINI_MODEL` — optional, defaults to `gemini-1.5-flash`.
4. **Deploy → New deployment → Web app**, execute as needed for your identity
   model (see below), access **Anyone within <domain>**.

## Secrets

`GEMINI_API_KEY` and the spreadsheet id live only in script properties — never
in the frontend (security-model.md). Logs avoid tokens, raw prompts with
sensitive data, and evidence contents.

## Endpoints

Base URL is the web app `/exec` URL. Path is appended (`.../exec/tasks`).
ContentService always returns HTTP 200; read `ok` / `error.code` from the JSON
envelope. Apps Script web apps accept GET and POST only, so the PATCH in the
REST spec is sent here as `POST /tasks/{id}/status`.

| Method | Path | Use case |
| --- | --- | --- |
| GET | `/me` | Current user + permissions |
| GET | `/tasks` | List visible tasks |
| POST | `/tasks` | Create task (manager/admin) |
| POST | `/tasks/{id}/status` | Update status (PATCH equivalent) |
| GET | `/tasks/{id}/activity` | Task activity timeline |
| GET/POST | `/tasks/{id}/evidence` | List / add evidence |
| GET/POST | `/workflow-templates` | List / create templates |
| POST | `/workflow-instances` | Start instance |
| GET | `/workflow-instances/{id}` | Instance detail |
| GET | `/dashboards/{employee\|manager\|executive}` | Dashboards |
| POST | `/ai/summaries` | Generate advisory summary |

## Identity note

The router resolves the caller via `Session.getActiveUser().getEmail()` and
maps it to an internal `Users` row. Within a single Workspace domain this
returns the signed-in user. For a hardened cross-user deployment where the
script executes as the deployer (so end users never gain Sheet access), put an
identity-aware proxy (IAP or a signed identity token verified here) in front and
pass the verified email — the rest of the contract is unchanged.
