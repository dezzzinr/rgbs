# Relay Global Shipping — Next.js / Node.js 1.4

A separate Node conversion of the completed Relay Python v0.9 application. **The Python project is not replaced or required.** This project contains no Python runtime, Python API, Python migration runner, SQLite production database, iframe portal, database reset or automatic reseeding.

## AJAX payments and navigation in 1.4

Pay As You Go now checks the payment API every 15 seconds while visible and offers an in-place Refresh payments button, preserving the panel and unfinished reference entries. Failed refreshes retain the last result with a stale-data warning. Track a shipment is included in the main navbar. The mobile menu is a vertical slide-in off-canvas drawer with backdrop, close/Escape controls, focus trapping, scroll locking, RTL direction and reduced-motion support. See **AJAX-NAVIGATION-UPDATE.md**. No database migration is required.

## Service catalogue in 1.3

All 20 core courier services and seven additional offerings are now published in a searchable catalogue with 27 dedicated service pages. Ten new photographs are used once each, alongside distinct service icons; previous photographic duplication across public pages has been removed. Service-specific enquiries prefill an editable note without automatically booking, charging, sending notifications or collecting COD. See **SERVICES-UPDATE.md** for the complete list, operational scope and content workflow. Existing Neon data, schema, authentication, tracking, payments, quotes and admin workflows are unchanged; no new migration is needed.

## Interface refresh in 1.2

Public mobile navigation now uses a hamburger button with an accessible expandable menu. Illustrative road, air and packing photography was added. Version 1.3 now allocates all public photographs uniquely rather than repeating them across cards and guides. The custom chat/settings button is completely removed while immediate configured Smartsupp loading remains. The language selector no longer has a visible “Language” label; it retains its accessible label. The earlier React `fetchPriority` normalization fix is included. See INTERFACE-UPDATE.md.

## Content expansion in 1.1

Nine new public resources cover packing, international shipping, customs/documents, cost factors, restricted items, business shipping, delivery help, a resource library and a printable checklist. The homepage, service pages, shipping guide and FAQs have also been expanded. See **CONTENT-UPDATE.md** for the complete page list, official FedEx research references and authoring instructions. The new copy is original Relay guidance; no FedEx branding, rates or unsupported services are adopted. No database migration is needed for this content update.

## What is included

- Next.js 16 App Router and React 19 server-rendered public pages, tracking, printable shipment summaries, operations dashboard and private quote inbox.
- Entire API implemented as **Node-runtime Next.js Route Handlers**, with `pg` parameterized PostgreSQL queries and transactions.
- Existing Neon schema through **`007_quote_requests`**, unchanged table and column names. Existing IDs, tracking links, users, password hashes, sessions, shipments, event/audit history, bulk results, payments, photos and quotes remain in place.
- Admin-only shipping across land, sea, air and multimodal journeys; own network and partner/FedEx reference workflows. **No automatic FedEx integration.**
- Server-side operations filtering, pagination, attention counters, safe CSV exports, atomic/idempotent bulk updates and activity history.
- Manual payment requests, milestone activation, claims, optimistic review and independently blocking per-request payment gates. A transfer reference never counts as verified money.
- Private R2/S3 photo uploads, image validation and metadata stripping, explicit public approval, private image delivery, removal tombstones and retryable storage purging.
- Manually recorded route milestones, explicit map publication, origin/destination route plans, Mapbox street maps and in-place AJAX refresh. **Not continuous GPS.**
- Core interface labels in English, French, Spanish, Arabic, Portuguese, German, Italian, Dutch, Simplified Chinese, Japanese and Hindi, including RTL. Long prose, native data, notes and many errors use English fallback; this is not complete translation of every page.
- Immediate optional Smartsupp loading on public **and private admin pages**, as previously approved. Provider credentials must still be configured and privacy settings reviewed.
- Public company/service/guide/FAQ/contact/legal pages, abuse-controlled quote intake and private, versioned admin review. Quotes do not automatically book, email or charge anyone.

### Frontend architecture — intentional compatibility islands

Public page markup is server-rendered as React components in the Next App Router. The familiar dashboard and the tested map, payment, translation, photo and chat interactions are retained as browser widget islands, rather than rewriting every interaction into React hooks. The dashboard's trusted static template is rendered as an HTML island to preserve its existing controls. There are **no embedded Python pages or iframes**. Navigation uses normal links/full document navigation; map refreshes use AJAX without reloading the document.

`ui/pages.json` contains the original trusted page markup and style/script lists. `scripts/build-widgets.mjs` creates ordered, content-hashed browser bundles before development/build, ensuring all admin extensions are installed before the first API response can render controls. Modify widgets in `public/app.js`, `public/operations.js` and `public/assets/*.js`, then rebuild. Modify page content in `ui/pages.json`; do not edit generated `relay-widgets-*.js` files.

## 1. Windows local setup — preserve your existing Neon database

Install a supported Node.js LTS version; **Node 24 LTS is recommended**. Open a new PowerShell/VS Code terminal after installation. Stop the Python server using port 3000, or run only one app on that port.

Extract the downloaded ZIP into your COURIER folder, keeping the old Python folder separate:

```powershell
cd "C:\Users\LOGICMIND COMPUTERS\Downloads\COURIER\relay-nextjs-v1"
node --version
npm --version
npm ci
Copy-Item .env.example .env.local
notepad .env.local
```

Set the real **existing** Neon database URLs, copied from Neon rather than typed manually:

```dotenv
DATABASE_URL=postgresql://...your-existing-pooled-Neon-URL...
DIRECT_DATABASE_URL=postgresql://...the-same-database-direct-URL...
RELAY_SECURE_COOKIES=false
RELAY_DEMO_MODE=false
```

Preserve the TLS parameters Neon provides. Percent-encode special password characters through Neon's generated URL. Neither database variable may have a `NEXT_PUBLIC_` prefix. Environment variables already set in PowerShell take precedence over `.env.local`; check for stale values if the wrong database appears to be used.

**Back up Neon / create a recovery branch before any migration.** Then:

```powershell
npm run db:status
npm run db:check
npm run dev
```

Visit:

- `http://localhost:3000/` — public website
- `http://localhost:3000/track` — customer tracking
- `http://localhost:3000/admin` — operations; use your **existing administrator email and password**
- `http://localhost:3000/admin/quotes` — private quote inbox

Next.js and the CLI scripts load `.env.local`; Python environment-loading commands are not needed. Restart the app after changing environment variables.

### Existing database is already at 007

`db:check` verifies the recognized revision and required tables/columns without changing records. **Do not bootstrap, reseed or create another admin.** There is no new migration needed merely to switch runtimes.

### Existing database is at a recognized earlier revision

The native Node migration runner accepts this exact linear history: `001_global_shipping` → `002_operations` → `003_milestone_payments` → `004_recorded_routes` → `005_public_map_pins` → `006_shipment_setup` → `007_quote_requests`.

After backing up and reviewing `db:status`:

```powershell
npm run db:upgrade -- --confirm-upgrade
npm run db:check
```

Only missing migrations are applied, transactionally, under a PostgreSQL advisory lock. The existing `alembic_version` ledger is retained; this is not an Alembic/Python dependency. Unknown, missing, multiple or inconsistent revisions are rejected. Do not manually stamp a revision, run the entire bootstrap SQL over existing tables, or drop tables to fix a failed check. The check is a compatibility check, not an exhaustive audit of custom constraints, indexes or database permissions.

### Brand-new, completely empty database only

Not needed for your existing Neon database:

```powershell
npm run db:bootstrap -- --confirm-bootstrap
npm run admin:create
```

Bootstrap refuses a database containing any tables. Admin creation asks for a masked password and confirmation, refuses existing email addresses and never changes an existing password.

### Sessions and old tracking links

Node verifies the exact Python scrypt format, including the ASCII hexadecimal salt and 64-byte digest. It uses the same `relay_session` cookie and SHA-256 session lookup. Old timestamps are parsed semantically, including UTC offsets/microseconds. Existing sessions remain valid until expiry **if the browser still sends the cookie on the same hostname**. A new hostname/domain requires signing in again; this does not mean accounts or sessions were deleted. Tracking tokens and shipment IDs do not change; links to the old domain need that domain retained or redirected appropriately.

## 2. Configure the real services

All environment names are in `.env.example`. The API only returns explicitly approved public configuration values.

### Mapbox

Set `RELAY_MAPBOX_PUBLIC_TOKEN` to a browser **`pk.*`** token; secret `sk.*` tokens are never exposed. Restrict its allowed website URLs, including your intended local/production hosts, in Mapbox. Default style: `mapbox://styles/mapbox/streets-v12`. Tiles and driving directions may incur charges. Land driving lines are only available where supported; sea/air/intercontinental connections must not be mistaken for road navigation. Without a token, the schematic route viewer remains available. Coordinates are manually entered; publish only approved milestone pins and route endpoints.

### Private Cloudflare R2 / S3-compatible storage

Use a private bucket, HTTPS endpoint and least-privilege server-only credentials:

```dotenv
RELAY_S3_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
RELAY_S3_BUCKET=your-private-bucket
RELAY_S3_REGION=auto
RELAY_S3_ACCESS_KEY_ID=...
RELAY_S3_SECRET_ACCESS_KEY=...
```

Keep the same bucket and object keys used by Python so existing photographs remain accessible. Do not enable public bucket access. Images are proxied through authorized API routes; no public/signed storage URLs or object keys are returned to customers. Uploads: 2 MB input image, 3 MB whole request, JPEG/PNG/WebP, one frame, up to 20 million pixels, rotated/flattened/resized to 1920 px and re-encoded as metadata-free JPEG. Eight active photos / 24 lifetime per shipment.

Removal commits the private tombstone **before** contacting storage. If storage deletion fails, access remains revoked and a later retry is required:

```powershell
npm run photos:purge -- --confirm-purge
```

This processes at most 100 already-removed photos per run. Run again for further batches. Database/storage backups and retention policies remain the operator's responsibility. Image upload plus object storage is not a distributed transaction; failed cleanup can require manual orphan-object reconciliation.

### Quote intake / Turnstile

Configure `RELAY_TURNSTILE_SITE_KEY`, `RELAY_TURNSTILE_SECRET`, exact comma-separated `RELAY_TURNSTILE_HOSTNAMES` (hostname only, no port/scheme/path), and preferably a random `RELAY_QUOTE_RATE_SECRET`. Turnstile is verified server-side for action `quote` and an approved hostname. Accepted enquiries are limited to five per 15-minute hashed-IP bucket in the shared database; production edge/WAF protection is also recommended.

On Vercel, the edge-forwarded client IP is used. On a self-hosted installation, the default conservative `local` bucket is shared; set `RELAY_TRUST_PROXY=true` **only behind a trusted reverse proxy that overwrites X-Forwarded-For**. Never trust arbitrary public-client proxy headers.

`RELAY_ALLOW_UNVERIFIED_QUOTES=true` is an explicit local-development bypass and is ignored on Vercel. Never use it on a publicly reachable self-hosted site. Without real protection/database configuration the production form is unavailable, not a fake successful demo.

### Immediate Smartsupp

Set `RELAY_SMARTSUPP_KEY` to the **website installation key**, not a REST API credential. Default `RELAY_SMARTSUPP_ADMIN_ENABLED=true` preserves your approved placement; set false to remove chat from private admin pages.

**Third-party JavaScript can read private dashboard content.** Disable recording in Smartsupp's dashboard and review data access, retention, processor agreements and local cookie/privacy obligations before enabling it. Analytics and marketing consent are initially false in our code; this does **not** prove recording is disabled. Smartsupp's own cookie-consent setting needs separate review. The custom chat launcher/settings button has been removed. Smartsupp supplies its own chat widget. The `?relay_chat=off` opt-out URL remains supported; there is no custom chat settings dialog.

### Manual payments and operational facts

Enter only verified banking instructions. Admins must check actual received funds, currency and amount before verifying a claim. Requests can independently block progress, activate at a milestone and be cancelled. Hold/cancellation remain available; shipment cancellation resolves pending requests without issuing refunds. Recorded events are not GPS or automated carrier updates. Legal/company pages are generic and require owner review; add real support details rather than invented offices/rates.

## 3. Tests and production build

No live database/provider secrets are required:

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

The Node backend/migration suite uses an isolated in-memory **PGlite PostgreSQL engine**, never your Neon URL. Browser tests start an explicitly enabled sample-only server, use mocked providers and refuse local `.env` files. Run browser tests in a clean checkout without `.env*` files other than `.env.example`, with port 3000 free. On Linux CI, use `npx playwright install --with-deps chromium`.

Production start after building:

```powershell
npm start
```

Verification at delivery: **35 Node backend/content/migration/HTML-prop tests + 13 native Playwright browser tests passed**; the eight previous Python-authored browser regression suites also passed against Next.js, with only hydration-ready waits, asset path and Next route-announcer selectors adapted. `npm audit --omit=dev` reported zero advisories at verification time. These are not a live Neon migration, a live Mapbox/Smartsupp/Turnstile/R2 test, a distributed concurrency stress test, or a Vercel deployment. The production build was tested locally. `/api/health` is a liveness/configuration report, not a database connectivity proof; run `db:check` for schema verification.

Demo data is disabled by default and always disabled on Vercel. The production app never silently substitutes samples for a failed database.

## 4. GitHub and Vercel

Use this directory as a **separate Node project/repository**, or keep it as a subdirectory in your existing repository and select `relay-nextjs-v1` as Vercel's Root Directory. Do not deploy the parent Python `vercel.json` as this Node app. GitHub pushes and remote deployment have not been performed for you.

Before committing:

```powershell
git status --short
git check-ignore .env.local node_modules .next
```

Commit project source, `package.json`, **`package-lock.json`**, `.env.example`, migrations, tests and assets. Do not commit `.env.local`, real credentials, runtime dependencies, `.next`, account exports or provider data. `.gitignore` is included. If creating a separate new repository, initialize it in this extracted folder, commit, add the remote URL from your own GitHub repository and push normally; do not force-push over your Python project.

In Vercel:

1. Import the intended repository; choose **Next.js**, with this directory as the project root.
2. Select Node.js **24.x** (or another currently supported LTS compatible with the dependencies).
3. Install command `npm ci`; build command `npm run build`; keep Next.js output settings at their defaults. No Python runtime or custom API rewrite is needed.
4. Add the existing **pooled** `DATABASE_URL` and provider variables to the intended environment. Set `RELAY_SECURE_COOKIES=true`, `RELAY_DEMO_MODE=false`, `RELAY_ALLOW_UNVERIFIED_QUOTES=false`.
5. Keep the direct database URL for controlled local/CI administrative tasks, not browser code. Build/start do **not** run migrations or create administrators.
6. Preview deployments should use a separate Neon preview branch/bucket, not your production database. The app is capable of real writes once connected.
7. Before switching production traffic, back up Neon, run `db:check`, compare record counts, sign in with the existing account, check a real tracking link, and verify private map/photo/payment behavior on a controlled test shipment.
8. Configure domain restrictions/Turnstile hostnames for the real domain, check provider dashboards and billing, then switch traffic only when satisfied. Retain the old Python deployment for rollback; do not run two administrative writers during cutover validation.

The runtime uses a small `pg` pool per server instance; use Neon's pooler and monitor total connection usage. Harden public production hosting with rate limits/WAF for login and uploads, monitoring, backups and incident handling. The custom header/HttpOnly/SameSite protections are not a substitute for deployment hardening or a security audit.

## Project map

- `app/` — Next.js App Router page layouts and Node API route entrypoint
- `server/` — authentication, SQL transactions, shipping, operations, payments, photos, quotes and schema inspection
- `ui/` — trusted static page sources and generated widget manifest
- `components/WidgetScripts.jsx` — post-hydration browser island loader
- `public/` — original UI logic, locally hosted fonts/icons/images and generated ordered widget bundles
- `migrations/007-bootstrap.sql` — exact PostgreSQL history through 007; never apply wholesale over existing data
- `scripts/` — native environment loading, safe schema tools, admin provisioning, photo purge and widget preparation
- `tests/` — Node/PGlite contract tests, Python-compatibility vectors, migration preservation and native Playwright tests

Existing font licenses and Natural Earth source attribution are preserved in the public assets.
