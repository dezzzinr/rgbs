# Verification — Node 1.2

Verified 29 October 2026 against the source in this archive.

| Check | Result |
|---|---|
| Node backend/content/migration suite (`npm test`) | 39 passed |
| Native Playwright suite (`npm run test:browser`) | 17 passed |
| Next.js optimized production build | Passed |
| Production dependency audit (`npm audit --omit=dev`) | 0 reported vulnerabilities at verification time |
| Previous Node 1.0 browser regression suites against Next.js | All 8 passed in the earlier release; only Next hydration waits, asset path and route-announcer selector adaptations |
| Production-default startup | Demo disabled; no simulated database success; quote submission unavailable without its required configuration |

Local test environment: Node 20.20.2, Next.js 16.4.3, React 19.3.1, Linux. Node 24 LTS is the recommended install/deployment version and the included CI target. Dependency versions/integrities are recorded in package-lock.json.

Backend tests execute the actual Node route logic using an isolated PGlite PostgreSQL engine. Compatibility vectors were generated with Python's standard-library scrypt/JSON, but executing these tests requires only Node. Migration tests apply the original PostgreSQL schema history through 007 and compare pre-existing record fields before/after upgrading.

Coverage includes legacy passwords and cookies, expiry parsing, admin authorization and mutation headers, tracking privacy, omitted-field preservation, manual payment gates/claims/reviews, atomic/idempotent bulk updates, route pin approval, safe CSV export, quote protection/rate limiting/review/versioning, private image sanitization/publication/removal and failed-purge tombstones.

Browser tests additionally cover the nine new resource routes, local-only checklist persistence/printing and the explicit-divisor planning calculator. Browser tests cover responsive public pages, creation and milestones, operations bulk/history, manual payment claim/verification, private map pins, eleven core languages/RTL, immediate chat, quote intake/private review and AJAX map persistence/failure warnings. Additional previous regression checks covered photo setup/approval/removal and mocked Mapbox behavior.

## Not performed

- No connection to, inspection of or migration against the user's real Neon database.
- No live R2, Mapbox, Turnstile, Smartsupp or FedEx integration verification.
- No multi-instance PostgreSQL concurrency/load test or independent security audit.
- No GitHub push, DNS/domain switch or Vercel deployment.

Follow README.md and MIGRATION-CHECKLIST.md before production cutover. Test providers and a controlled real shipment in your own environment; use a separate Neon branch for preview/testing.

Interface refresh checks cover hamburger open/close, Escape focus return, navigation, desktop reset, Arabic overflow, image loading, absence of the custom chat/settings UI and an accessible language selector without a visible label. Smartsupp is mocked for these tests; no live key was supplied.

Service catalogue checks cover all 27 dedicated pages, searchable/category-filtered listings, unique image URLs and image bytes across all 14 public photo placements, selected-service editable enquiry notes, 390/768/1440-pixel service detail layouts and explicit limits on website automation. Running the full content generation pipeline twice produced identical page JSON. See SERVICES-UPDATE.md.

Version 1.4 adds verified AJAX payment polling/manual refresh, preservation of payment-panel and document identity and reference drafts during updates, stale-data recovery, plus vertical off-canvas geometry, focus trapping, backdrop/close controls and navbar tracking. See AJAX-NAVIGATION-UPDATE.md.
