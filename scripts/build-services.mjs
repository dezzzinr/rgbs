import fs from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const pageFile = root + "/ui/pages.json",
  pages = JSON.parse(fs.readFileSync(pageFile, "utf8"));
const services = JSON.parse(
  fs.readFileSync(root + "/ui/services.json", "utf8"),
).services;
const E = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const paths = {
  package: "M3 7l9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10",
  document: "M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6M9 16h6",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  bolt: "M14 2 4 14h7l-1 8 10-13h-7l1-7",
  door: "M4 21h16M7 21V3h10v18M13 12h1",
  route:
    "M5 5h1m12 14h1M7 5h8a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h8M3 3h4v4H3V3Zm14 14h4v4h-4v-4",
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18",
  bag: "M5 7h14l1 14H4L5 7Zm4 0V6a3 3 0 0 1 6 0v1",
  pickup: "M3 9h12v10H3V9Zm12 4h4l3 4v2h-7M6 19v2m12-2v2M8 2v5m-3-3 3 3 3-3",
  rider:
    "M9 17a4 4 0 1 1-8 0 4 4 0 0 1 8 0m14 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0M5 17l5-8h6l3 8M10 9l4 8H5m10-12h3l2 4",
  wallet: "M3 6h17v15H3V6Zm0 0V3h14v3m-2 6h7v5h-7v-5m3 2v1",
  warehouse: "M3 21V9l9-6 9 6v12M7 21V11h10v10M7 15h10M7 18h10",
  truck: "M2 5h12v13H2V5Zm12 5h4l4 5v3h-8M5 18v3m13-3v3",
  pin: "M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 0 1 14 0m-5-1a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  signature: "M3 21h18M4 16 15 5l4 4L8 20H4v-4M14 6l4 4M3 5h6",
  return: "M8 5 3 10l5 5M3 10h11a6 6 0 0 1 0 12h-3",
  boxes: "M3 13h8v8H3v-8Zm10 0h8v8h-8v-8ZM8 3h8v8H8V3m4 0v4M7 13v4m10-4v4",
  care: "M12 20S3 15 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 11-9 11",
  wrap: "M3 9h18v12H3V9Zm9 0v12M2 6h20v3H2V6m10 0C7 6 5 3 8 2c3-1 4 4 4 4m0 0s1-5 4-4c3 1 1 4-4 4",
  building: "M3 21h18M5 21V3h10v18m0-12h5v12M8 7h4M8 11h4M8 15h4M9 21v-3h3v3",
  bell: "M5 17h14l-2-4V9a5 5 0 0 0-10 0v4l-2 4m5 3h4M12 2v2",
  calendar: "M3 5h18v16H3V5m4-3v6m10-6v6M3 10h18M7 14h2m4 0h2m-8 4h2",
  contract: "M5 3h14v18H5V3m4 5h6m-6 4h6m-6 4h3m2 0 2 2 4-4",
  vehicle: "M3 7h18v12H3V7Zm2 0 2-4h10l2 4M6 19v3m12-3v3M6 12h3m6 0h3",
  shield: "M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6l-9-4m-4 10 3 3 5-6",
  customs: "M5 3h10l4 4v14H5V3m10 0v5h4M8 12h8M8 16h3m2 0 2 2 4-4",
  stops:
    "M5 5h3m8 7h3M5 19h3M8 5h6a3.5 3.5 0 0 1 0 7h-3a3.5 3.5 0 0 0 0 7h5M3 3h4v4H3V3m14 7h4v4h-4v-4M3 17h4v4H3v-4",
};
const icon = (s) =>
  `<svg class="courier-icon" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[s.icon]}"/></svg>`;
const servicePath = (s) => "/services/" + s.slug,
  request = (s) => "/quote?service=" + s.slug;
const link = (url, title, cls = "") =>
  `<a href="${url}"${cls ? ` class="${cls}"` : ""}>${E(title)}</a>`;
const image = (s) =>
  `<img src="/assets/services/${s.image}" alt="${E(s.alt)}" width="1440" height="810" loading="lazy" decoding="async">`;
const homeSlugs = [
  "dispatch-rider-services",
  "ecommerce-delivery",
  "international-shipping",
];
// Remove earlier repeated photographic placements; keep four legacy photos once.
for (const [path, p] of Object.entries(pages)) {
  if (path.startsWith("/admin")) continue;
  p.body = p.body
    .replace(/<figure class="editorial-visual"[\s\S]*?<\/figure>/g, "")
    .replace(/<img[^>]*class="resource-card-image"[^>]*>/g, "")
    .replace(/<div class="service-picture">[\s\S]*?<\/div>/g, "");
  if (path === "/about")
    p.body = p.body
      .replace(
        /src="\/assets\/global-freight.jpg"/g,
        'src="/assets/warehouse-packing.jpg"',
      )
      .replace(
        'alt="Global freight transport"',
        'alt="Illustrative parcel packing at a warehouse station"',
      );
  if (["/services/land", "/services/air"].includes(path)) {
    const name = path.endsWith("land") ? "road-freight" : "air-freight";
    p.body = p.body.replace(
      /(<section class="page-hero">[\s\S]*?<\/section>)/,
      `$1<figure class="editorial-visual"><img class="editorial-visual-image" src="/assets/${name}.jpg" alt="Illustrative ${name === "road-freight" ? "road cargo transport" : "air cargo handling"}" width="1440" height="810" loading="lazy" decoding="async"><figcaption>Illustrative logistics imagery.</figcaption></figure>`,
    );
  }
}
const base = pages["/shipping-resources"],
  header = base.body.match(/<header\b[\s\S]*?<\/header>/)[0],
  footer = base.body.match(/<footer\b[\s\S]*?<\/footer>/)[0];
const styles = [...base.styles];
if (!styles.some((s) => s.includes("/assets/services.css")))
  styles.push('<link rel="stylesheet" href="/assets/services.css">');
const scripts = [
  "/assets/languages.js",
  "/assets/livechat.js",
  "/assets/business.js",
  "/assets/public-menu.js",
  "/assets/service-catalog.js",
];
const hero = (k, t, d) =>
  `<section class="page-hero"><div><div class="eyebrow">${E(k)}</div><h1>${E(t)}</h1><p>${E(d)}</p></div>${link("/quote", "Discuss your shipment", "button primary")}</section>`;
function page(path, title, description, main) {
  pages[path] = {
    ...base,
    title: title + " — Relay",
    description,
    body:
      header +
      '<main class="content-page container courier-page">' +
      main +
      "</main>" +
      footer,
    styles,
    scripts,
    bodyAttrs: { "data-page": "business", "data-route": path },
  };
}
const groups = [...new Set(services.map((s) => s.group))];
const card = (s) =>
  `<article class="courier-card" data-service-card data-group="${E(s.group)}" data-search="${E((s.title + " " + s.description).toLowerCase())}">${s.image && !homeSlugs.includes(s.slug) ? `<a href="${servicePath(s)}" class="courier-card-photo">${image(s)}</a>` : `<div class="courier-card-symbol">${icon(s)}</div>`}<div class="courier-card-content"><span class="courier-group">${E(s.group)}</span><h3>${link(servicePath(s), s.title)}</h3><p>${E(s.description)}</p><div class="courier-card-links">${link(servicePath(s), "Explore service ↗")}${link(request(s), "Enquire")}</div></div></article>`;
page(
  "/services",
  "Courier services",
  "Explore Relay’s parcel, rider, business, international, storage, fulfilment and specialist courier services.",
  hero(
    "ONE TEAM. MORE WAYS TO MOVE.",
    "Courier services for your everyday. And your bigger plans.",
    "From a document across the city to business stock, international parcels and specialist handling, Relay offers a coordinated way forward. Choose a service and talk through the details with operations.",
  ) +
    `<section class="courier-intro-band"><div><strong>20 core services</strong><span>Personal parcels to business logistics</span></div><div><strong>7 additional offerings</strong><span>Support around the movement</span></div><div><strong>Arranged by people</strong><span>Confirm scope, timing and terms</span></div></section><section aria-labelledby="catalogTitle"><div class="resource-section-heading"><h2 id="catalogTitle">Find the right service.</h2><p id="serviceCount" role="status" aria-live="polite">27 services</p></div><div class="service-filter-tools"><label for="serviceSearch">Search services<input id="serviceSearch" type="search" placeholder="Try documents, COD or storage" autocomplete="off"></label><div class="service-filter-buttons" role="group" aria-label="Service categories"><button type="button" data-service-filter="all" aria-pressed="true">All services</button>${groups.map((g) => `<button type="button" data-service-filter="${E(g)}" aria-pressed="false">${E(g)}</button>`).join("")}</div></div><div class="courier-grid">${services.map(card).join("")}</div><p id="serviceEmpty" hidden>No services match this search. Try another term or choose All services.</p></section><section class="courier-steps"><h2>From a service idea to a confirmed arrangement.</h2><ol><li><strong>Tell us what needs to move.</strong><span>Include the locations, cargo details, timing and the service you need.</span></li><li><strong>Review the practical details.</strong><span>Operations confirms acceptance, availability, scope, charges and applicable terms.</span></li><li><strong>Confirm the handover.</strong><span>Collection, delivery, reporting and any supporting services are arranged with your contact.</span></li></ol></section><div class="resource-note"><strong>Offered by Relay. Confirmed for your shipment.</strong>Services are arranged through operations. Route eligibility, capacity, collection windows, specific requirements and terms must be confirmed. This website does not automatically book riders, collect COD, issue policies, manage inventory or send notifications.</div><section class="courier-modes"><h2>Ways your shipment can travel.</h2><div class="page-actions">${link("/services/land", "Land freight", "button ghost")}${link("/services/sea", "Sea freight", "button ghost")}${link("/services/air", "Air freight", "button ghost")}</div></section>`,
);
for (const s of services) {
  const others = services
    .filter((o) => o.group === s.group && o.slug !== s.slug)
    .slice(0, 3);
  page(
    servicePath(s),
    s.title,
    s.description,
    `<nav class="resource-breadcrumb" aria-label="Breadcrumb">${link("/", "Home")}<span aria-hidden="true">/</span>${link("/services", "Our services")}</nav>` +
      hero(s.group.toUpperCase(), s.title, s.description) +
      `<div class="courier-detail-layout"><article><section class="resource-article-section"><div class="courier-detail-icon">${icon(s)}</div><h2>A service built around the details.</h2><p>${E(s.details)}</p></section><section class="resource-article-section"><h2>What to share with operations</h2><ul>${s.prepare.map((p) => `<li>${E(p)}</li>`).join("")}</ul></section><section class="courier-service-note"><h2>Important to know</h2><p>${E(s.note)}</p></section><section class="resource-article-section"><h2>How to arrange ${E(s.title.toLowerCase())}</h2><p>Send an enquiry with your route, item details and requirements, or speak with your known Relay contact. Operations will review the scope and explain the applicable availability, timing, charges and terms before arrangements are confirmed.</p><p>Tell us the service name in your request. Do not include passwords, payment credentials or sensitive identity documents in public enquiry notes.</p></section></article><aside class="courier-enquiry"><span class="eyebrow">LET’S PLAN THE NEXT STEP</span><h2>Make this service part of your shipment.</h2><p>Share your requirements. We’ll review the movement and the supporting arrangements with you.</p>${link(request(s), "Enquire about this service", "button primary")}${link("/services", "Explore all services", "text-button")}<p class="planner-hint">An enquiry is not a confirmed booking or payment.</p></aside></div><section class="courier-related"><h2>Other ways we can help</h2><div class="courier-related-links">${others.map((o) => link(servicePath(o), o.title)).join("")}${link("/services", "View all 27 services ↗")}</div></section>`,
  );
}
// Three distinct homepage photographs, not reused in the catalogue or other pages.
const start = "<!--courier-showcase-start-->",
  end = "<!--courier-showcase-end-->";
let home = pages["/"].body.replace(
  new RegExp(start + "[\\s\\S]*?" + end, "g"),
  "",
);
const showcase = `${start}<section class="container courier-home"><div class="resource-section-heading"><div><div class="eyebrow">EVERYDAY ERRANDS. BUSINESS AMBITIONS.</div><h2>More than a parcel from A to B.</h2></div>${link("/services", "Explore all 27 services", "button ghost")}</div><div class="service-grid">${homeSlugs
  .map((slug) => services.find((s) => s.slug === slug))
  .map(
    (s) =>
      `<article class="service-card courier-home-card"><div class="service-picture">${image(s)}</div><h3>${link(servicePath(s), s.title)}</h3><p>${E(s.description)}</p>${link(request(s), "Discuss this service ↗", "courier-home-link")}</article>`,
  )
  .join(
    "",
  )}</div><p class="courier-image-note">Illustrative logistics imagery. Service scope and arrangements are confirmed with operations.</p></section>${end}`;
home = home.replace("</main>", showcase + "</main>");
pages["/"].body = home;
// Make the selected service visible on the existing enquiry form, without changing API fields.
for (const path of ["/", "/quote", "/business-shipping"]) {
  const p = pages[path];
  if (!p.scripts.includes("/assets/service-catalog.js"))
    p.scripts.push("/assets/service-catalog.js");
  if (!p.styles.some((s) => s.includes("/assets/services.css")))
    p.styles.push('<link rel="stylesheet" href="/assets/services.css">');
}
fs.writeFileSync(
  root + "/public/assets/service-catalog.json",
  JSON.stringify(
    Object.fromEntries(services.map((s) => [s.slug, s.title])),
    null,
    2,
  ) + "\n",
);
fs.writeFileSync(pageFile, JSON.stringify(pages, null, 2) + "\n");
console.log(
  "Published all 27 services and dedicated pages; unique public photographic placements retained.",
);
