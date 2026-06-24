# TeamOS — Working Context (read first)

> Single source of truth to resume work from any chat. Keep updated after each change.
> Last updated: 2026-06-24.

## What it is
AI-native team operating system: work tracking with evidence-driven completion, immutable audit, RBAC (Admin/Manager/Employee), AI advisory summaries. Built from the spec in `docs/` + `architecture/`.

## Where
- Repo: `D:\OpenClaw\teamos` → GitHub `github.com/shoaibmkn/teamos` (single branch `main`).
- **LIVE:** https://teamos.srv1192236.hstgr.cloud (Hostinger VPS, Docker+Traefik, auto-SSL).
- User: shoaibmkn / shoaib@upenergygroup.com. Wants fully-free, minimal, clean VC.

## Stack / layout (npm workspaces monorepo)
- `packages/core` — framework-agnostic domain: entities, RBAC, validation, services, AI boundary. **36 vitest tests.** No data-source coupling (ADR-0002 repository pattern).
- `apps/web` — Next.js 14 App Router PWA. API routes call core services.
- `apps/appsscript` — documented Apps Script+Sheets backend (alt, not used live).
- Backends (swappable via `TEAMOS_DATA_BACKEND`): `memory` (demo seed, default), `sheets` (Google Sheets API), `file` (JSON on disk — used live for persistence). All in `apps/web/src/lib/server/{sheets,file}`.

## Features built (all live, tested)
Dashboards (Employee/Manager/Executive) · task assign + priority sort · Task 360 (subtasks/checklist + per-task chat + lifecycle timeline + evidence) · daily check-in/out + on-the-clock green dot · assessment + 6-month CSV export · People (user mgmt) · **notifications** (bell: chat/assign/status alerts) · **manager-led team mgmt** (managers add/archive own reports) · AI summaries (offline default, Gemini optional) · light+dark theme · PWA.

## Auth status
- Code DONE: Google OAuth (`/api/auth/google/*`) + dev-login. Login page shows both via `/api/auth/config`.
- LIVE currently: `TEAMOS_DEV_LOGIN=true` (demo accounts). Persistence = file backend.
- TO ENABLE GOOGLE LOGIN: create a Google OAuth client (their Google Cloud), then set env (below) + `TEAMOS_DEV_LOGIN=false` + redeploy. Seeded admin = `TEAMOS_ADMIN_EMAIL`.

## VPS deploy (see also memory `teamos_vps_deploy.md`)
- VPS `srv1192236.hstgr.cloud` / `72.61.239.50`, Ubuntu 24.04, Docker. SSH: `ssh -i ~/.ssh/teamos_vps root@72.61.239.50`.
- Edge = Traefik (`n8n_default` network, resolver `mytlschallenge`). Co-hosted (DON'T touch): n8n, traefik, openclaw, hermes-*.
- Wildcard `*.srv1192236.hstgr.cloud` → VPS (no DNS setup).
- Container `teamos`, persistent volume `teamos_data:/data`.

### Redeploy (after code change)
```
cd /d/OpenClaw/teamos
tar czf /tmp/teamos-src.tar.gz --exclude=node_modules --exclude='*/node_modules' --exclude=.next --exclude='*/.next' --exclude=.git --exclude='*.tsbuildinfo' --exclude='apps/web/public/walkthrough.html' .
scp -i ~/.ssh/teamos_vps /tmp/teamos-src.tar.gz root@72.61.239.50:/tmp/
ssh -i ~/.ssh/teamos_vps root@72.61.239.50 'rm -rf /opt/teamos && mkdir -p /opt/teamos && tar xzf /tmp/teamos-src.tar.gz -C /opt/teamos && cd /opt/teamos && docker build -t teamos:latest . && docker rm -f teamos && docker run -d --name teamos --restart unless-stopped -v teamos_data:/data --network n8n_default --label traefik.enable=true --label "traefik.http.routers.teamos.rule=Host(\`teamos.srv1192236.hstgr.cloud\`)" --label traefik.http.routers.teamos.entrypoints=web,websecure --label traefik.http.routers.teamos.tls=true --label traefik.http.routers.teamos.tls.certresolver=mytlschallenge --label traefik.http.services.teamos.loadbalancer.server.port=3000 -e TEAMOS_DATA_BACKEND=file -e TEAMOS_DATA_FILE=/data/teamos.json -e TEAMOS_ADMIN_EMAIL=shoaib@upenergygroup.com -e TEAMOS_ALLOWED_DOMAINS=upenergygroup.com -e TEAMOS_TIMEZONE=Africa/Kampala -e TEAMOS_DEV_LOGIN=true teamos:latest'
```

## Robustness (live)
`/api/health` probe + Docker HEALTHCHECK (container shows `healthy`). Security headers on all routes. `TEAMOS_TIMEZONE` for correct check-in dates. **Daily data backup** on VPS: cron 01:00 → `/usr/local/bin/teamos-backup.sh` copies the volume's `teamos.json` to `/opt/teamos-backups` (keeps last 14).

### Env vars (container)
`TEAMOS_DATA_BACKEND=file` · `TEAMOS_DATA_FILE=/data/teamos.json` · `TEAMOS_ADMIN_EMAIL` · `TEAMOS_ALLOWED_DOMAINS` · `TEAMOS_DEV_LOGIN` (false in prod). For Google login add: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `NEXTAUTH_URL=https://teamos.srv1192236.hstgr.cloud`. AI: `GEMINI_API_KEY` (optional). All server-side only.

### Enable Google login (manual, ~10 min, free)
1. console.cloud.google.com → project → OAuth consent screen (Internal).
2. Credentials → OAuth client ID → Web app. Redirect URI: `https://teamos.srv1192236.hstgr.cloud/api/auth/google/callback`.
3. Add `GOOGLE_OAUTH_CLIENT_ID/SECRET` + `NEXTAUTH_URL` to the `docker run` env, set `TEAMOS_DEV_LOGIN=false`, redeploy. First admin = `TEAMOS_ADMIN_EMAIL`; add team via People.

## Quality gates
`npm test` (core, 36) · `npm run typecheck` · `npm run build`. All green. Commit only when green; single `main`; no junk files (an indexer drops zero-byte files in root — keep out of commits).

## Pending
1. Enable Google login (manual step above). 2. Daily/weekly planner. 3. Employee screen redesign (mockup focus-card+week-strip). 4. Workflow-create UI form. 5. Daily auto-digest + stale-waiting flag. 6. Timezone (currently UTC) for attendance.

## Moat (honest)
No moat as generic tool. Value = internal ROI for UpEnergy ops + (if pursued) deep vertical fit (carbon/field-QC/audit ops) where evidence+immutable-audit+price beat Asana/ClickUp.
