# Relay service catalogue — version 1.3

## Included

- All **20 core courier services and seven additional offerings**, confirmed as offered by the owner.
- A searchable, category-filtered `/services` catalogue and **27 dedicated service pages** (52 page templates in total).
- Every service has a description, practical preparation checklist, specific conditions and an enquiry link.
- Service-specific quote links display the selected service and populate an editable existing notes field. The quote API/schema are unchanged. An enquiry does not confirm a booking or payment.
- Three new homepage service highlights: dispatch riders, e-commerce delivery and international shipping.
- **10 new, unique AI-generated illustrative photographs**, each used exactly once. There are 14 distinct photographic placements sitewide, including the four previous photos now allocated once each. Other services use distinct line-icon designs. Repeated guide/card photographs from version 1.2 were removed to respect the no-duplicates request.
- Mobile hamburger, eleven core interface languages with English fallback, accessible language selection and immediate configured Smartsupp remain intact. No custom chat settings UI was reintroduced.

## All 27 offerings

1. Parcel delivery
2. Document delivery
3. Same-day delivery
4. Express delivery
5. Door-to-door delivery
6. Interstate delivery
7. International shipping
8. E-commerce delivery
9. Pickup services
10. Dispatch rider services
11. Cash on delivery (COD)
12. Warehousing and storage
13. Freight and bulk cargo
14. Shipment tracking
15. Proof of delivery
16. Returns and reverse logistics
17. Fulfilment services
18. Specialized delivery
19. Packaging services
20. Business-to-business delivery
21. Delivery notifications (SMS, email or phone)
22. Scheduled and recurring deliveries
23. Bulk business contracts
24. Dedicated vehicles and riders
25. Delivery insurance / declared-value coverage
26. Customs documentation assistance
27. Multi-location collection

## Operational scope, not invented automation

All services are presented as offered, not planned. Operations confirms eligibility, timing, capacity, price and terms for each arrangement. Same-day/express service is not an unconditional route-wide guarantee. Specialist handling and temperature-sensitive requirements must be assessed and agreed before collection. Coverage is subject to confirmed terms and is not automatically issued by this website. Customs documents must be checked for the relevant destination; this does not invent a brokerage integration.

This release does **not** implement automated rider dispatch, COD collection/reconciliation, stock or fulfilment management, e-commerce order imports, electronic recipient-signature capture, automatic SMS/email, insurance issuance or partner carrier booking APIs. Existing admin-controlled tracking, milestones, payment requests, approved photos and quote review are preserved. These services are arranged through the team using the agreed operational workflow.

Photographs are AI-generated illustrations, not evidence of Relay-owned vehicles, staff or facilities. No photograph is repeated in the public templates. Icon reuse between a service’s own catalogue/detail presentations is ordinary UI navigation, not duplicate photography.

## Authoring

- `ui/services.json`: all service copy, groups, preparation checklists, operational notes and icon/photo references.
- `scripts/build-services.mjs`: builds the catalogue, detail pages, homepage highlights and service-name JSON for enquiry prefill.
- `public/assets/services.css`: responsive styling.
- `public/assets/service-catalog.js`: local search/filter controls and selected-service enquiry notes.
- `public/assets/services/*.jpg`: ten new service photos.

Run `npm run content:build` after changing content. It runs the existing resource and interface generators before the service generator. The complete workflow was run twice and produced identical `ui/pages.json` hashes. Run `npm run build` afterward. `npm run services:build` is available for rebuilding only the service layer.

## Verified

- 39 Node tests passed, including all 27 dedicated routes, catalogue controls, no duplicate photo paths or image bytes, file existence and operational limitations.
- 15 native Playwright tests passed, including catalogue filtering, dedicated-page navigation, 390/768/1440-pixel detail layouts and editable service-specific quote notes. Existing backend/browser regressions remain covered.
- Optimized production build passed.
- `npm audit --omit=dev`: zero reported vulnerabilities at verification time.
- No migration, database reset/reseed, live database access or provider configuration change. Real Neon, Mapbox, R2, Turnstile, Smartsupp and carrier services were not live-tested.

## Install / update

Use the complete 1.3 project ZIP as the application source. Preserve your real deployment environment variables and use the existing Neon database; do not reset it. From the project directory run `npm ci`, `npm run build`, then `npm start` (or deploy through your existing GitHub/Vercel workflow). Follow README.md and MIGRATION-CHECKLIST.md for production configuration. No new database migration is required for this release.
