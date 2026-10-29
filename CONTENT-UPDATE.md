# Relay 1.1 — shipping content expansion

Reviewed 29 October 2026. This is an expansion of the Next.js project, not a replacement of its backend or a database migration.

## Added

Nine new public routes:

| Route | Content |
|---|---|
| `/shipping-resources` | Resource library, topic navigation and external further reading |
| `/packing-guide` | Packaging selection, internal protection, labelling, measurement and specialist-cargo cautions |
| `/international-shipping` | Cross-border preparation, documentation, responsibilities and confirmed partner-carrier context |
| `/customs-guide` | Descriptions, values, document preparation, customs roles and handling questions |
| `/shipping-costs` | Quote factors, inclusion/exclusion questions and a volume-weight arithmetic planner |
| `/restricted-items` | Acceptance-review prompts and non-exhaustive restricted/regulated-goods guidance |
| `/business-shipping` | Preparation for repeat shipments, customer orders, pallets and larger movements |
| `/delivery-help` | Milestone meanings, delays, change/return questions and payment-link safety |
| `/shipping-checklist` | Nine-step local-browser preparation checklist with progress, persistence, reset and print |

Existing pages now include a homepage resource section, service-mode planning comparison, preparation sections for land/sea/air, an expanded shipping guide, eight additional FAQs and a grouped resource footer. Public navigation includes Resources. The existing light Relay identity is retained.

The dimensional-weight planner requires actual measurements and an explicitly entered, confirmed divisor. It does not assume a universal carrier factor, apply carrier rounding/minimums, produce a shipping rate or create a quote. The checklist stores checkbox names locally only; it does not collect personal details, contact a server or schedule a shipment. Existing third-party chat behavior remains separately configurable and carries the privacy considerations documented in README.md.

## Research and attribution

The following public FedEx resources informed the selection of useful shipping education topics:

- [Shipping overview](https://www.fedex.com/en-us/shipping.html)
- [Packing resources](https://www.fedex.com/en-us/shipping/packing.html)
- [International shipping overview](https://www.fedex.com/en-us/shipping/international.html)
- [International preparation guide](https://www.fedex.com/en-us/shipping/international/how-to-ship.html)
- [Customs clearance guidance](https://www.fedex.com/en-us/shipping/international/customs-clearance.html)
- [Shipping cost factors](https://www.fedex.com/en-us/shipping/how-to-estimate-shipping-cost.html)

All new website prose is original Relay wording. FedEx text, photography, icons, logos, tariffs and service guarantees have not been copied. US-specific procedures, promotional discounts, geographic coverage figures, fixed transit times and claims of FedEx affiliation have not been adopted as Relay capabilities. The public resource library links to selected official pages as external further reading and explains the distinction.

Regulated-cargo examples are not an accepted-items list. Customs/document guidance is general and requires destination- and shipment-specific confirmation. No carrier booking, label generation, automatic pickup, return or refund functionality is implied.

## What did not change

No shipment, payment, quote, photo, authentication or database schema workflow was changed for this expansion. Private admin templates remain unchanged. No live Neon data was accessed, migrated, reset or reseeded; schema remains `007_quote_requests`. The existing Python source and previous ZIP remain separate.

## Editing and rebuilding

- Edit the subject-guide text in `ui/resources.json`.
- Edit the resource hub, checklist, homepage/service/FAQ additions or shared public navigation in `scripts/expand-content.mjs`.
- Run `npm run content:build` after those edits. The script replaces marked public sections rather than duplicating them. It leaves private admin templates alone.
- Edit layout styles in `public/assets/resources.css` and browser-only tools in `public/assets/resources.js`.
- `npm run build` prepares widget bundles for all 25 routes. Content authoring is not an automatic deployment-time rewrite.

The expanded guide prose is English. Core navigation/resource labels have translations for the existing eleven-language interface; this is not full translation of the new guides. Existing user-entered data is not translated.

## Install the update

Extract the full 1.1 archive into a separate working folder, copy your existing `.env.local` securely, run `npm ci`, `npm run db:check`, and `npm run dev`. Keep your old project/source backup. If your database is already at 007, **no migration, bootstrap or new admin is needed for this content update**. Do not overwrite your own custom changes without review. Follow README.md for production configuration and cutover.

## Validation

- 32 Node tests passed (backend/auth/payment/photo/quote/migration compatibility plus four content/link/source-boundary checks).
- 10 native Playwright tests passed, including responsive new routes, navigation, calculator and local checklist behavior.
- Next.js optimized production build passed.
- Production-default preview checked with demo disabled, including Arabic mobile overflow and browser error checks.
- No live provider verification or remote deployment was performed.
