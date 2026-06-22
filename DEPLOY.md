# Deploy TeamOS — free stack (Vercel + Google Sheets + Google login)

This gets TeamOS live for your internal team at zero cost. Data lives in one
Google Sheet, sign-in is Google Workspace, hosting is Vercel.

```
Team browser ──> Vercel (Next.js)  ──> Google Sheets (data, service account)
                       │             └─ Google OAuth (Workspace login)
                       └─ Gemini (optional, advisory AI)
```

You'll need: a Google account (ideally Workspace admin) and a Vercel account
(sign up free with GitHub). ~20 minutes.

---

## 1. Create the database (a Google Sheet)

1. Create a new blank Google Sheet (e.g. "TeamOS DB").
2. Copy its **ID** from the URL: `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`.

The tabs are created automatically in step 6 — leave it blank.

## 2. Service account (lets the server read/write the Sheet)

1. Go to <https://console.cloud.google.com> → create or pick a project.
2. **APIs & Services → Library →** enable **Google Sheets API**.
3. **APIs & Services → Credentials → Create credentials → Service account.**
4. Open the service account → **Keys → Add key → JSON**. A JSON file downloads.
5. From that JSON note two values: `client_email` and `private_key`.
6. **Share the Sheet** (step 1) with the `client_email` as **Editor**.

## 3. Google OAuth (team sign-in)

1. **APIs & Services → OAuth consent screen** → User type **Internal** (your
   Workspace) → fill app name + support email → save.
2. **Credentials → Create credentials → OAuth client ID → Web application.**
3. Under **Authorized redirect URIs** add (you can edit after deploy):
   - `https://YOUR-APP.vercel.app/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback` (for local testing)
4. Copy the **Client ID** and **Client secret**.

## 4. Deploy to Vercel

1. <https://vercel.com> → **Add New → Project →** import `shoaibmkn/teamos`.
2. **Root Directory:** `apps/web` (Vercel detects Next.js and installs the
   workspace from the repo root automatically).
3. Add the environment variables from section 5, then **Deploy**.
4. Note your URL, e.g. `https://teamos-xyz.vercel.app`. Put it back into the
   OAuth redirect URI (step 3) and into `NEXTAUTH_URL`, then redeploy.

## 5. Environment variables (Vercel → Settings → Environment Variables)

| Variable | Value |
| --- | --- |
| `TEAMOS_DATA_BACKEND` | `sheets` |
| `TEAMOS_SPREADSHEET_ID` | the Sheet ID from step 1 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the JSON |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | `private_key` from the JSON — paste the whole thing including the `\n` sequences |
| `GOOGLE_OAUTH_CLIENT_ID` | from step 3 |
| `GOOGLE_OAUTH_CLIENT_SECRET` | from step 3 |
| `NEXTAUTH_URL` | your Vercel URL, e.g. `https://teamos-xyz.vercel.app` |
| `TEAMOS_ALLOWED_DOMAINS` | your Workspace domain, e.g. `upenergygroup.com` |
| `TEAMOS_ADMIN_EMAIL` | your email (seeded as the first Admin) |
| `TEAMOS_SETUP_TOKEN` | any random string (used once in step 6) |
| `TEAMOS_DEV_LOGIN` | `false` (hides demo accounts in production) |
| `GEMINI_API_KEY` | optional — leave empty to use the offline summarizer |

The private key contains newlines. The simplest reliable form is the single
line with literal `\n` exactly as it appears in the JSON file — the app
restores the newlines at runtime.

## 6. Provision the Sheet (run once)

After the deploy is live, create the tabs + seed yourself as Admin:

```bash
curl -X POST "https://YOUR-APP.vercel.app/api/admin/setup?token=YOUR_SETUP_TOKEN"
```

Expected: `{"ok":true,"data":{"createdTabs":[...],"seededAdmin":"usr_..."}}`.
Re-running is safe.

## 7. First sign-in

1. Open `https://YOUR-APP.vercel.app`.
2. **Continue with Google** → sign in with your Workspace email (the
   `TEAMOS_ADMIN_EMAIL`).
3. You land as **Admin → People** → add your team (name, email, role, manager).
4. Each teammate then signs in with Google and sees their own work.

---

## Local development against Sheets (optional)

Create `apps/web/.env.local` with the same variables plus
`NEXTAUTH_URL=http://localhost:3000`, then `npm run dev`. Keep
`TEAMOS_DATA_BACKEND` unset (or `memory`) to use the seeded demo backend with
one-click demo logins instead.

## Notes

- **Secrets** live only in Vercel env — never shipped to the browser.
- **Sheets limits:** great for a small team. Under heavy load, swap in a
  PostgreSQL repository behind the same interface (ADR-0002) — no business-logic
  changes.
- **Roll back** anytime: Vercel keeps every deployment.
