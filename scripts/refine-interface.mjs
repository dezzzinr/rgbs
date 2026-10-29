import fs from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const file = root + "/ui/pages.json",
  pages = JSON.parse(fs.readFileSync(file, "utf8"));
const navLinks = [
  ["/services", "Our services"],
  ["/about", "About us"],
  ["/shipping-guide", "Shipping guide"],
  ["/shipping-resources", "Resources"],
  ["/faq", "FAQ"],
  ["/contact", "Contact"],
  ["/quote", "Request a quote"],
  ["/track", "Track a shipment"],
];
const toggle =
  '<button type="button" class="public-menu-toggle" id="publicMenuToggle" aria-controls="publicMobileNav" aria-expanded="false" aria-label="Open navigation"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>';
const panel =
  '<nav id="publicMobileNav" class="public-mobile-nav" aria-label="Mobile navigation" hidden>' +
  navLinks
    .map(([url, title]) => `<a href="${url}" data-relay-ui>${title}</a>`)
    .join("") +
  "</nav>";
const photos = {
  "/services/land": [
    "road-freight.jpg",
    "Cargo truck travelling on a countryside highway",
  ],
  "/services/sea": [
    "global-freight.jpg",
    "Container ship at a freight harbour",
  ],
  "/services/air": [
    "air-freight.jpg",
    "Cargo aircraft with airport loading equipment",
  ],
  "/services": [
    "road-freight.jpg",
    "Road transport alongside a green landscape",
  ],
  "/packing-guide": [
    "warehouse-packing.jpg",
    "Parcel preparation with protective packaging at a packing station",
  ],
  "/international-shipping": [
    "air-freight.jpg",
    "Aircraft and freight handling equipment at an airport",
  ],
  "/customs-guide": [
    "global-freight.jpg",
    "Container freight preparing for an international journey",
  ],
  "/shipping-costs": [
    "warehouse-packing.jpg",
    "Packed cartons ready for measurement and shipment preparation",
  ],
  "/restricted-items": [
    "warehouse-packing.jpg",
    "Careful parcel preparation at a warehouse packing station",
  ],
  "/business-shipping": [
    "warehouse-packing.jpg",
    "Organised packing station for business shipments",
  ],
  "/delivery-help": [
    "road-freight.jpg",
    "Unbranded cargo vehicle travelling along a road",
  ],
  "/shipping-resources": [
    "warehouse-packing.jpg",
    "Protective materials and cartons at a packing station",
  ],
  "/shipping-guide": [
    "road-freight.jpg",
    "Road freight travelling through the countryside",
  ],
  "/shipping-checklist": [
    "warehouse-packing.jpg",
    "A parcel being prepared with packing materials",
  ],
  "/quote": [
    "air-freight.jpg",
    "Air cargo handling equipment beside a freight aircraft",
  ],
};
const image = (photo, cls) =>
  `<img class="${cls}" src="/assets/${photo[0]}" alt="${photo[1]}" width="1440" height="810" loading="lazy" decoding="async">`;
for (const [route, page] of Object.entries(pages)) {
  if (route.startsWith("/admin")) continue;
  page.body = page.body.replace(
    /(<nav\b[^>]*class="site-nav"[^>]*>)([\s\S]*?)(<\/nav>)/g,
    (all, start, links, end) =>
      start +
      links +
      (links.includes('href="/track"')
        ? ""
        : '<a href="/track" data-relay-ui>Track a shipment</a>') +
      end,
  );

  page.body = page.body.replace(
    /<details class="site-mobile-nav">[\s\S]*?<\/details>/,
    panel,
  );
  if (
    page.body.includes('id="publicMobileNav"') &&
    !page.body.includes('id="publicMenuToggle"')
  )
    page.body = page.body.replace(
      /(<div class="nav-tools">[\s\S]*?)(<\/div>)/,
      "$1" + toggle + "$2",
    );
  if (photos[route] && !page.body.includes('id="editorialVisual"')) {
    const figure =
      '<figure class="editorial-visual" id="editorialVisual">' +
      image(photos[route], "editorial-visual-image") +
      "<figcaption>Illustrative logistics imagery.</figcaption></figure>";
    page.body = page.body.replace(
      /(<section class="page-hero">[\s\S]*?<\/section>)/,
      "$1" + figure,
    );
  }
  // Give resource cards and the homepage service cards relevant photography.
  page.body = page.body.replace(
    /(<a class="editorial-card resource-card" href="([^"]+)">)(?!<img)/g,
    (match, open, url) =>
      photos[url] ? open + image(photos[url], "resource-card-image") : match,
  );
  if (route === "/" && !page.body.includes('class="service-picture"')) {
    let i = 0;
    const picks = [
      photos["/services/land"],
      photos["/services/sea"],
      photos["/services/air"],
    ];
    page.body = page.body.replace(
      /<article class="service-card">/g,
      (match) =>
        match +
        '<div class="service-picture">' +
        image(picks[i++ % 3], "service-photo") +
        "</div>",
    );
  }
  if (!page.styles.some((s) => s.includes("/assets/interface-refresh.css")))
    page.styles.push(
      '<link rel="stylesheet" href="/assets/interface-refresh.css">',
    );
  if (!page.scripts.includes("/assets/public-menu.js"))
    page.scripts.push("/assets/public-menu.js");
}
fs.writeFileSync(file, JSON.stringify(pages, null, 2) + "\n");
console.log("Applied mobile navigation and editorial photography.");
