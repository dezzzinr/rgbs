# AJAX payments and off-canvas navigation — version 1.4

## Pay As You Go

The customer tracking payment panel now refreshes independently through the existing authenticated/private-reference payment API. It checks every 15 seconds while the page is visible, refreshes when returning to the tab and includes a **Refresh payments** button. Payment GET requests bypass the browser cache and have a timeout.

The panel itself is retained during ordinary tracking refreshes. Unchanged payment content is not rebuilt; an open reference dialog and its editable values remain intact. Concurrent requests are suppressed and results belonging to an earlier shipment are ignored. If an explicit refresh is requested during an active request, it is queued. Successful reference submissions request fresh payment state without a document reload. Polling pauses in hidden tabs and is stopped on page exit, with restoration on back-forward-cache return.

If a payment fetch fails, the last successful information remains visible with an explicit stale-data warning and a retry button. No failed request is treated as successful, and no polling result itself confirms receipt of funds. Administrators still verify payments manually. Existing per-request payment gates, review permissions, transfer-reference privacy, API fields and database schema are unchanged. The admin payment manager already uses API requests; these new automatic checks are for the customer tracking payment panel.

## Navigation

- **Track a shipment** is now inside the main desktop navbar on public pages with the standard header, in addition to the existing tracking action and mobile link.
- The mobile/tablet menu is now a vertical side drawer, sliding in from the right in LTR or the left in RTL layouts.
- A backdrop, explicit close button, Escape handling, focus trapping, background inertness and scroll locking make the drawer behave as a modal off-canvas menu.
- Navigation closes the drawer. Switching to desktop resets it. Reduced-motion preferences disable the animation.
- Existing design, language selector, immediate configured Smartsupp, service pages and nonduplicated photography remain intact.

## Verification

- 39 Node backend/content/migration tests passed.
- 17 native Playwright tests passed.
- Optimized production build passed.
- New browser coverage tests fixed-position vertical layout, drawer focus wrapping, background inertness/restoration, backdrop closing and the desktop tracking link.
- A mocked production-mode payment test checks real AJAX GET calls, automatic polling, panel/document identity, draft preservation while tracking/payment data refreshes, stale-data handling and recovery. It asserts that only the initial document navigation occurs.
- Existing regression tests still cover backend operations, payment verification/privacy, maps, quote handling, responsive guides, service filters, languages and chat UI.

No migration, reset/reseed or provider key change is required. Real Neon/provider connections were not used in these checks. Use your existing production environment variables and database. Install with `npm ci`, build with `npm run build`, then start with `npm start` or deploy through the existing workflow.
