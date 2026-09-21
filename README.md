# SpendScope — Personal Expense Tracker

Full-stack MVP for tracking personal spending against a monthly budget. Each signed-in user only ever sees their own data. There is no sharing, inviting, or public links.

## Suggested stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS | Fast local DX, typed UI, easy to style a responsive light theme |
| Backend | Node.js + Express + TypeScript | Straightforward HTTP + WebSocket on one process |
| Auth | Passport.js Google OAuth 2.0 + GitHub OAuth | Real SSO, session cookies persist across refresh |
| Database | SQLite via Prisma | Zero extra services for local run |
| Realtime | `ws` WebSocket server | Two-way budget alerts without a message broker |
| Tests | Vitest + Supertest + `ws` | SSO is stubbed; no Google/GitHub network calls |

Sessions are HTTP-only cookies stored in memory on the API process. Restarting the backend requires signing in again.

## How to run locally

Requires Node.js 20+.

```bash
cp backend/.env.example backend/.env
# Fill in SESSION_SECRET plus Google and GitHub OAuth credentials (see below).

npm install
npm run install:all
npm run prisma:generate
npm run db:push
npm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:4000](http://localhost:4000)
- WebSocket: `ws://localhost:4000/ws` (the Vite dev server proxies `/api` and `/ws`)

Run the two processes separately if you prefer:

```bash
npm run dev:backend
npm run dev:frontend
```

### How to run tests

Tests use an isolated SQLite file (`backend/prisma/test.db`) and a mock SSO endpoint. They never call Google or GitHub.

```bash
npm test
```

Or from the backend folder: `npm test`.

## Category deletion behavior

**Deletion is blocked** if the category still has transactions.

- The API returns `409` with a clear message.
- The Categories screen also prevents the delete and explains that transactions must be reassigned or deleted first.
- Prisma enforces this at the database level (`onDelete: Restrict`).
- There is no automatic reassignment to an “Uncategorized” category.

## Authentication

SSO only (Google and GitHub). There is no email/password signup.

On first successful sign-in the backend **creates a local user automatically**, keyed by `(provider, provider_user_id)`. Stored fields:

- `provider`
- `providerUserId`
- `email` (optional — GitHub may omit it)
- `displayName`
- `avatarUrl` (optional)

Google and GitHub identities are **not linked**. Signing in with both providers creates two separate accounts.

Sessions are cookie-based (`connect.sid`, HTTP-only, SameSite=Lax) and survive page refresh. Logout is available in the app header/sidebar.

Automated tests use `POST /api/auth/test/login`, which is enabled only when `AUTH_TEST_MODE=true` or `NODE_ENV=test`. When that flag is on, the login screen also shows **Mock Google** / **Mock GitHub** buttons so you can exercise the app locally without creating OAuth apps. Leave `AUTH_TEST_MODE=false` when using real Google and GitHub SSO.

### Google OAuth credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Authorized JavaScript origin: `http://localhost:5173`
4. Authorized redirect URI: `http://localhost:4000/api/auth/google/callback`
5. Put the values in `backend/.env`:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
```

### GitHub OAuth credentials

1. GitHub → Settings → Developer settings → [OAuth Apps](https://github.com/settings/developers) → New OAuth App.
2. Homepage URL: `http://localhost:5173`
3. Authorization callback URL: `http://localhost:4000/api/auth/github/callback`
4. Put the values in `backend/.env`:

```
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=http://localhost:4000/api/auth/github/callback
```

Required environment variables (also listed in `backend/.env.example`):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma SQLite path, e.g. `file:./prisma/dev.db` |
| `PORT` | API port (default `4000`) |
| `CLIENT_URL` | Frontend origin for CORS and OAuth redirects |
| `SESSION_SECRET` | Cookie signing secret |
| `CURRENCY` | Display/storage currency (default `USD`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | Google SSO |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_CALLBACK_URL` | GitHub SSO |
| `AUTH_TEST_MODE` | Expose mock SSO for tests (`true`/`false`) |

## HTTP API (short)

All category, transaction, and budget routes require an authenticated session. Data is always scoped to `req.user.id`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness |
| `GET` | `/api/config` | `{ currency }` |
| `GET` | `/api/auth/providers` | Which SSO providers are configured |
| `GET` | `/api/auth/google` | Start Google SSO |
| `GET` | `/api/auth/google/callback` | Google OAuth callback |
| `GET` | `/api/auth/github` | Start GitHub SSO |
| `GET` | `/api/auth/github/callback` | GitHub OAuth callback |
| `GET` | `/api/auth/me` | Current user, or `401` |
| `POST` | `/api/auth/logout` | Destroy session |
| `POST` | `/api/auth/test/login` | Mock SSO (test mode only) |
| `GET/POST` | `/api/categories` | List / create |
| `PATCH/DELETE` | `/api/categories/:id` | Rename / delete (blocked if in use) |
| `GET/POST` | `/api/transactions` | List (search + filters) / create |
| `PATCH/DELETE` | `/api/transactions/:id` | Edit any field / delete |
| `GET/PUT/DELETE` | `/api/budgets/:month` | Month summary (`YYYY-MM`) / set / clear |

Transaction list query params: `q` (title or notes), `categoryId`, `dateFrom`, `dateTo`, `minAmount`, `maxAmount`.

Month summary fields: `hasBudget`, `budget`, `spent`, `remaining`, `usagePercent`. If no budget is set, `hasBudget` is `false` and the numeric budget fields are `null` so the UI can show **No budget set** instead of fake zeros.

Validation errors return `400` with Zod `details`. Authorization failures return `401`. Cross-user access is treated as `404` / empty lists (no data leak).

## WebSocket protocol

- URL: `ws://localhost:4000/ws` (or `/ws` through the Vite/nginx proxy)
- Auth: the same session cookie as the HTTP API. Unauthenticated upgrades receive `401` and are closed.
- Alerts are computed for the **current calendar month only**.
- If no budget is set for that month, **no threshold alerts are generated**.
- Thresholds: **50%**, **80%**, **100%**.
- Each threshold fires **once per user per month**. Editing or deleting transactions after a threshold was crossed does not re-send that threshold.
- Alerts are evaluated when a socket opens and after a transaction is created, updated, or deleted.

### Server → client

```json
{ "type": "connected", "userId": "..." }

{ "type": "subscribed", "count": 1 }

{
  "type": "budget_alert",
  "month": "2026-09",
  "threshold": 80,
  "usagePercent": 82.5,
  "spent": 825,
  "budget": 1000,
  "remaining": 175,
  "currency": "USD",
  "message": "Heads up: 80% of your 2026-09 budget is spent."
}

{ "type": "ack_ok", "month": "2026-09", "threshold": 80, "acknowledged": true }
```

### Client → server (required two-way messages)

The UI sends **`subscribe` on connect** and **`ack` when the user dismisses an alert**. Both change server behavior:

**`subscribe`** — server re-loads unacknowledged current-month alerts and pushes them to this socket.

```json
{ "type": "subscribe" }
```

**`ack`** — marks that threshold as acknowledged so it is not re-delivered on the next connection.

```json
{ "type": "ack", "month": "2026-09", "threshold": 80 }
```

A `ping` / `pong` keepalive is also supported.

## Containerization

Docker Compose is included:

```bash
docker compose up --build
```

UI: [http://localhost:8080](http://localhost:8080) · API: [http://localhost:4000](http://localhost:4000)

Update OAuth callback URLs if you use the Compose frontend port (`8080`) as `CLIENT_URL`.
