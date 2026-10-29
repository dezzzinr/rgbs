# Relay 1.2 — mobile navigation, imagery and simplified controls

## Requested changes implemented

- Public navigation switches to a hamburger button on narrower screens (up to 1200px). The expanded menu includes services, about, shipping guide, resources, FAQ, contact, quote and tracking. It closes on Escape, outside click, navigation or a resize back to desktop. Escape returns focus to the button. The existing private-admin mobile sidebar remains available.
- Added three new AI-generated illustrative photographs: road freight, air cargo and a warehouse packing station. These appear alongside the existing sea-freight image on homepage service cards, resource cards and relevant guide/service pages. The imagery does not depict verified Relay facilities, fleet or staff. Guide-page images carry an illustrative-imagery caption. Images include alt text, dimensions and lazy loading.
- Removed the custom chat launcher, custom Chat settings button and settings dialog entirely. The configured native Smartsupp widget still loads immediately, including admin pages when enabled. There is no replacement custom chat button. If the optional provider is blocked or unavailable, it does not prevent website use. Provider privacy/recording settings still need review. The `?relay_chat=off` opt-out and existing session opt-out remain respected.
- Removed the visible Language text beside the selector on public and admin pages. The selected language name remains visible and the selector retains an accessible, translated aria-label for screen-reader users.
- Includes the previous React fetchpriority/fetchPriority parser fix.

## Installation

This is a complete project archive. Extract it into a separate folder, securely copy your existing `.env.local`, run `npm ci`, then `npm run dev`. Production: `npm run build` followed by `npm start`. Back up your local changes before replacing files. No database migration, reseed or administrator recreation is needed.

## Source changes

- `public/assets/public-menu.js` — accessible mobile disclosure controls
- `public/assets/interface-refresh.css` — mobile navigation and imagery layout
- `public/assets/livechat.js` — immediate provider loading without custom controls
- `public/assets/languages.js` — language selector without a visible label
- `public/assets/road-freight.jpg`, `air-freight.jpg`, `warehouse-packing.jpg` — generated illustrative images
- `scripts/refine-interface.mjs` — repeatable public markup/image updates
- `ui/pages.json` and generated widget manifest/bundles

`npm run content:build` now runs both content expansion and the interface refinement, so future content regeneration retains the hamburger and images. `npm run build` regenerates the ordered widget bundles.

Validation: 35 Node tests, 13 Playwright browser tests and the Next.js production build passed. Browser tests include the three new UI/image cases and the existing operations/payment/tracking/resource cases. Smartsupp provider loading was mocked, not tested with a live key. No live database, provider configuration or remote deployment was changed.
