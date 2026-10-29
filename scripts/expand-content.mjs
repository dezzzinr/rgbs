import fs from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const load = (p) => JSON.parse(fs.readFileSync(root + "/" + p, "utf8"));
const pages = load("ui/pages.json"),
  content = load("ui/resources.json");
const E = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const ui = (s, tag = "span", cls = "") =>
  `<${tag} data-relay-ui${cls ? ` class="${cls}"` : ""}>${E(s)}</${tag}>`;
const link = (url, title, cls = "") =>
  `<a href="${url}"${cls ? ` class="${cls}"` : ""} data-relay-ui>${E(title)}</a>`;
let header = pages["/about"].body.match(/<header\b[\s\S]*?<\/header>/)[0];
if (!header.includes('href="/shipping-resources"')) {
  header = header.replace(
    /(<a[^>]*href="\/contact"[^>]*>Contact<\/a>)/g,
    `${link("/shipping-resources", "Resources")}$1`,
  );
}
const groups = [
  [
    "Services",
    [
      ["/services/land", "Land freight"],
      ["/services/sea", "Sea freight"],
      ["/services/air", "Air freight"],
      ["/business-shipping", "Business shipping"],
      ["/about", "About us"],
    ],
  ],
  [
    "Shipping resources",
    [
      ["/shipping-resources", "All shipping guides"],
      ["/packing-guide", "Packing guide"],
      ["/international-shipping", "International shipping"],
      ["/customs-guide", "Customs and documents"],
      ["/restricted-items", "Restricted items"],
      ["/shipping-costs", "Shipping costs"],
    ],
  ],
  [
    "Customer tools",
    [
      ["/track", "Track a shipment"],
      ["/quote", "Request a quote"],
      ["/shipping-checklist", "Shipment checklist"],
      ["/delivery-help", "Delivery help"],
      ["/faq", "FAQ"],
      ["/contact", "Contact"],
    ],
  ],
];
const footer = `<footer class="site-footer"><div class="container"><div class="footer-top"><div class="footer-brand"><a class="brand" href="/"><span class="brand-mark">↗</span><span>relay.</span></a>${ui("Across borders. Beyond expectations.", "p")}<p class="resource-footer-note">Human-led shipping. Clear preparation.<br>Manually published milestones.</p></div><nav class="footer-links resource-footer-links" aria-label="Footer navigation">${groups.map(([title, links]) => `<div>${ui(title, "h2")}${links.map(([url, t]) => link(url, t)).join("")}</div>`).join("")}</nav></div><div class="footer-bottom"><span>${link("/privacy", "Privacy")} · ${link("/terms", "Website terms")} · ${link("/admin", "Admin workspace")}</span>${ui("Shipping coordinated by people. Progress made clear.")}<span>© 2026 Relay logistics</span></div></div></footer>`;
const hero = (k, h, intro) =>
  `<section class="page-hero"><div>${ui(k, "div", "eyebrow")}${ui(h, "h1")}<p>${E(intro)}</p></div>${link("/quote", "Request a quote", "button primary")}</section>`;
const card = (url, title, description, i = 0) =>
  `<a class="editorial-card resource-card" href="${url}"><span class="editorial-number">${String(i + 1).padStart(2, "0")} / ↗</span>${ui(title, "h3")}<p>${E(description)}</p>${ui("Explore guide", "span", "editorial-link")}</a>`;
const labels = Object.fromEntries(content.pages.map((p) => [p.path, p.title]));
Object.assign(labels, {
  "/shipping-resources": "Shipping resources",
  "/shipping-checklist": "Shipment checklist",
  "/quote": "Request a quote",
  "/track": "Track a shipment",
  "/faq": "FAQ",
  "/contact": "Contact",
  "/services": "Our services",
  "/shipping-guide": "Shipping guide",
});
const short = {
  "/packing-guide":
    "Choose protective packaging, secure the contents and measure the finished package.",
  "/international-shipping":
    "Plan the cross-border details before your goods are ready for collection.",
  "/customs-guide":
    "Prepare clear descriptions, documents and questions for a customs review.",
  "/shipping-costs":
    "Understand the details behind a quote, with a volume-weight planning tool.",
  "/restricted-items":
    "Know when an item needs an acceptance review before you pack or pay.",
  "/business-shipping":
    "Prepare consistent information for customer orders, pallets and repeat enquiries.",
  "/delivery-help":
    "Read milestones, ask about delays and verify unexpected payment requests.",
};
const disclaimer = `<div class="resource-note"><strong>Preparation guidance, not a service commitment.</strong> Requirements vary by cargo, route, carrier and destination. Confirm arrangements with Relay before dispatch. These guides do not establish rates, guaranteed transit times, cargo acceptance, insurance coverage or customs approval.</div>`;
const related = (paths) =>
  `<section class="resource-related"><div class="resource-section-heading">${ui("Keep planning", "h2")}${link("/shipping-resources", "All shipping guides")}</div><div class="editorial-grid">${paths.map((url, i) => card(url, labels[url], short[url] || "Open the next step in your shipping preparation.", i)).join("")}</div></section>`;
const dimensions = `<form id="dimensionPlanner" class="dimension-planner"><div class="planner-grid">${[
  ["length", "Length (cm)"],
  ["width", "Width (cm)"],
  ["height", "Height (cm)"],
  ["actual", "Actual weight (kg)"],
  ["divisor", "Confirmed divisor (cm³/kg)"],
]
  .map(
    ([name, label]) =>
      `<label>${ui(label)}<input type="number" name="${name}" min="0.001" max="1000000" step="any" inputmode="decimal" required autocomplete="off"></label>`,
  )
  .join(
    "",
  )}</div><p class="planner-hint">For one rectangular package. Enter a divisor confirmed by your shipping contact. There is no universal factor, and no carrier rounding or minimum-charge rule is applied here.</p><button class="button primary" type="submit" data-relay-ui>Calculate planning weight</button><output id="dimensionResult" for="length width height actual divisor" aria-live="polite"></output><p class="planner-hint">Illustration only—not a price, quote, carrier rating or booking.</p></form>`;
function addPage(path, title, body, description) {
  pages[path] = {
    ...pages["/about"],
    title: title + " — Relay",
    description,
    body:
      header +
      `<main class="content-page container resource-page">${body}</main>` +
      footer,
    bodyAttrs: { "data-page": "business", "data-route": path },
    scripts: [
      "/assets/languages.js",
      "/assets/livechat.js",
      "/assets/business.js",
      "/assets/resources.js",
    ],
  };
}
for (const p of content.pages) {
  const article = p.sections
    .map(
      (section, i) =>
        `<section class="resource-article-section" id="section-${i + 1}">${ui(section.title, "h2")}${(section.paragraphs || []).map((s) => `<p>${E(s)}</p>`).join("")}${section.items ? `<ul>${section.items.map((s) => `<li>${E(s)}</li>`).join("")}</ul>` : ""}${section.tool === "dimensions" ? dimensions : ""}</section>`,
    )
    .join("");
  const toc = `<aside class="resource-toc" aria-label="Guide contents">${ui("In this guide", "h2")}<nav>${p.sections.map((s, i) => link("#section-" + (i + 1), s.title)).join("")}</nav><div class="resource-toc-bottom">${link("/shipping-checklist", "Open the checklist", "button ghost")}</div></aside>`;
  addPage(
    p.path,
    p.title,
    `<nav class="resource-breadcrumb" aria-label="Breadcrumb">${link("/", "Home")}<span aria-hidden="true">/</span>${link("/shipping-resources", "Shipping resources")}</nav>` +
      hero(p.kicker, p.heading, p.intro) +
      `<div class="resource-columns"><article class="resource-article">${article}${disclaimer}</article>${toc}</div>` +
      related(p.related),
    p.intro,
  );
}
const sourceLinks = [
  [
    "https://www.fedex.com/en-us/shipping/packing.html",
    "FedEx packing resources",
  ],
  [
    "https://www.fedex.com/en-us/shipping/international/how-to-ship.html",
    "FedEx international shipping guide",
  ],
  [
    "https://www.fedex.com/en-us/shipping/international/customs-clearance.html",
    "FedEx customs guidance",
  ],
  [
    "https://www.fedex.com/en-us/shipping/how-to-estimate-shipping-cost.html",
    "FedEx shipping-cost information",
  ],
];
addPage(
  "/shipping-resources",
  "Shipping resources",
  hero(
    "THE RELAY SHIPPING LIBRARY",
    "A better-prepared shipment starts here.",
    "Practical guides for the decisions before collection and the questions during delivery. Find the right topic, prepare your details, then speak with your shipping contact.",
  ) +
    `<nav class="resource-jump-links" aria-label="Resource categories">${link("#prepare", "Prepare your shipment")}${link("#borders", "Cross-border guidance")}${link("#support", "Business and delivery help")}</nav><section id="prepare"><div class="resource-section-heading">${ui("Before the first mile", "h2")}${link("/shipping-checklist", "Open the checklist")}</div><div class="editorial-grid">${["/packing-guide", "/shipping-costs", "/shipping-checklist"].map((url, i) => card(url, labels[url], short[url] || "Work through a practical, printable checklist. Progress stays in your browser.", i)).join("")}</div></section><section id="borders"><div class="resource-section-heading">${ui("When your shipment crosses a border", "h2")}</div><div class="editorial-grid">${["/international-shipping", "/customs-guide", "/restricted-items"].map((url, i) => card(url, labels[url], short[url], i)).join("")}</div></section><section id="support"><div class="resource-section-heading">${ui("Keep the next step clear", "h2")}</div><div class="editorial-grid">${["/business-shipping", "/delivery-help", "/shipping-guide"].map((url, i) => card(url, labels[url], short[url] || "See the preparation stages from your first enquiry to shipment handover.", i)).join("")}</div></section><section class="resource-references" id="references">${ui("Further reading", "h2")}<p>These original Relay guides were informed by public carrier education resources, including the FedEx pages below. External pages describe that provider’s services and rules—not Relay’s commitments. No FedEx text, photography or brand assets have been reproduced here.</p><ul>${sourceLinks.map(([url, title]) => `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${E(title)} ↗</a></li>`).join("")}</ul><p>Reviewed 29 October 2026. Check the relevant authorities and the confirmed carrier for current requirements.</p></section>` +
    disclaimer,
  "Packing, international shipping, customs, costs, restricted items and delivery guidance from Relay.",
);
const checklist = [
  [
    "Know the goods",
    "Describe the contents, item count and any regulated or special-care products.",
  ],
  [
    "Check acceptance",
    "Confirm that the exact cargo can travel on the intended route and mode.",
  ],
  [
    "Confirm both ends",
    "Check sender and recipient addresses, usable contacts and access constraints.",
  ],
  [
    "Measure the packed pieces",
    "Record package count, outside dimensions and packed weights.",
  ],
  [
    "Review the documents",
    "Confirm invoice, packing information and destination-specific supporting requirements.",
  ],
  [
    "Clarify charges and responsibilities",
    "Ask what the quotation includes, who handles customs, and who pays destination charges.",
  ],
  [
    "Prepare the packaging",
    "Secure contents, remove old labels and follow agreed labelling instructions.",
  ],
  [
    "Confirm collection arrangements",
    "Agree readiness and handover details with your shipping contact; this checklist does not schedule a pickup.",
  ],
  [
    "Keep the reference safe",
    "After registration, retain your Relay reference and share its private link only with the intended people.",
  ],
];
addPage(
  "/shipping-checklist",
  "Shipment checklist",
  hero(
    "A SMALL CHECK BEFORE A BIG JOURNEY",
    "Your before-you-ship checklist.",
    "Use this preparation aid with your shipping contact. Tick the items you have reviewed, then print a copy if useful. It does not create a booking or establish that a shipment has been accepted.",
  ) +
    `<div class="checklist-layout"><section class="checklist-paper" aria-label="Preparation checklist"><div class="checklist-toolbar"><p id="checklistProgress" role="status" aria-live="polite">0 of ${checklist.length} preparation steps reviewed</p><div><button type="button" class="button ghost" id="printChecklist" disabled data-relay-ui>Print checklist</button><button type="button" class="text-button" id="resetChecklist" disabled data-relay-ui>Reset</button></div></div><form id="shipmentChecklist">${checklist.map(([t, d], i) => `<label class="checklist-item"><input type="checkbox" name="step-${i}" value="reviewed"><span>${ui(t, "strong")}<span>${E(d)}</span></span></label>`).join("")}</form><p class="planner-hint" id="checklistPrivacy">Progress is saved only in this browser. No personal details are requested and no information is submitted to Relay.</p><noscript>JavaScript enables the progress counter and buttons. You can still read this checklist and print using your browser menu.</noscript></section><aside class="checklist-aside">${ui("Ready to discuss the details?", "h2")}<p>Use the quote form to share your route, cargo type and total weight. Include package dimensions and timing needs in the notes.</p>${link("/quote", "Request a quote", "button primary")}<p>Check the current destination and carrier requirements before handing over goods.</p></aside></div>` +
    disclaimer +
    related(["/packing-guide", "/customs-guide", "/restricted-items"]),
  "A printable browser-only preparation checklist for packing, documents, acceptance and shipment handover.",
);
// Append content using explicit markers so authoring can be rerun safely.
function append(path, id, html) {
  const page = pages[path],
    start = `<!--relay-${id}-start-->`,
    end = `<!--relay-${id}-end-->`;
  const expression = new RegExp(start + "[\\s\\S]*?" + end, "g");
  page.body = page.body.replace(expression, "");
  page.body = page.body.replace("</main>", start + html + end + "</main>");
}
const quick = `<section class="container resource-home" aria-label="Shipping resources"><div class="resource-section-heading"><div>${ui("PREPARE WITH CONFIDENCE", "div", "eyebrow")}${ui("A little planning goes a long way.", "h2")}</div>${link("/shipping-resources", "All shipping guides", "button ghost")}</div><div class="editorial-grid">${["/packing-guide", "/international-shipping", "/shipping-costs"].map((url, i) => card(url, labels[url], short[url], i)).join("")}</div><div class="resource-callout"><div>${ui("Good preparation. One step at a time.", "h3")}<p>Work through the shipment checklist before discussing collection, documents and charges with your shipping contact.</p></div>${link("/shipping-checklist", "Open the checklist", "button primary")}</div></section>`;
append("/", "home-resources", quick);
append(
  "/shipping-guide",
  "expanded-guide",
  `<section class="resource-guide-extension">${hero("PUT THE DETAILS TOGETHER", "From enquiry to handover.", "Start by describing the goods and route. Then review acceptance, packing, documents and charges with your shipping contact. Booking and collection arrangements require confirmation.").replace(/<h1/g, "<h2").replace(/<\/h1/g, "</h2")}<div class="editorial-grid">${content.pages
    .slice(0, 6)
    .map((p, i) => card(p.path, p.title, short[p.path], i))
    .join(
      "",
    )}</div><div class="resource-callout"><div>${ui("Keep the preparation in one place.", "h3")}<p>Use the printable checklist, or browse delivery help if a shipment is already moving.</p></div>${link("/shipping-checklist", "Open the checklist", "button primary")}</div></section>`,
);
const table = `<section class="resource-service-comparison"><div class="resource-section-heading">${ui("Match the mode to the movement.", "h2")}</div><p class="resource-intro">Use this as a conversation starter. Cargo acceptance, availability, timing and charges need an individual review—not a fixed promise by transport mode.</p><div class="resource-table-wrap"><table><caption>Transport planning considerations</caption><thead><tr><th scope="col">Mode</th><th scope="col">What to discuss</th><th scope="col">Prepare for review</th></tr></thead><tbody>${[
  [
    "/services/land",
    "Land",
    "Regional movements, road connections and the final delivery leg.",
    "Vehicle access, package or pallet dimensions, collection and delivery constraints.",
  ],
  [
    "/services/sea",
    "Sea",
    "Ocean routing and cargo that may move through ports and onward handling.",
    "Cargo volume, weights, port preferences, documentation and handling requirements.",
  ],
  [
    "/services/air",
    "Air",
    "Air transport where the goods, route and requested timing make it appropriate.",
    "Packed sizes, accurate product descriptions, restrictions and required documents.",
  ],
  [
    "/quote",
    "Multimodal",
    "A journey combining two or more transport methods.",
    "The complete route, transfer points, cargo readiness and delivery priorities.",
  ],
]
  .map(
    ([url, mode, a, b]) =>
      `<tr><th scope="row">${link(url, mode)}</th><td>${E(a)}</td><td>${E(b)}</td></tr>`,
  )
  .join("")}</tbody></table></div></section>`;
append(
  "/services",
  "mode-comparison",
  table +
    related(["/business-shipping", "/shipping-costs", "/restricted-items"]),
);
for (const mode of ["land", "sea", "air"])
  append(
    "/services/" + mode,
    "service-preparation",
    `<section class="resource-service-preparation"><div class="resource-section-heading">${ui("Before you request this movement", "h2")}</div><div class="resource-callout"><div><h3>Share the route, not just the destination.</h3><p>Include origin and destination cities and countries, packed piece dimensions and weights, ready date, required timing and any handling constraints. Operations must review the proposed service before confirming arrangements.</p></div>${link("/quote", "Request a quote", "button primary")}</div></section>` +
      related([
        "/packing-guide",
        "/shipping-costs",
        mode === "land" ? "/shipping-checklist" : "/international-shipping",
      ]),
  );
const extraFaq = [
  [
    "What information helps with a shipping quotation?",
    "Share origin and destination, mode, cargo type and packed weight. Add piece counts, individual dimensions, ready dates and special handling in the notes. Operations reviews availability and pricing; submitting the form is not a booking.",
  ],
  [
    "Can a large lightweight box affect the charge?",
    "Some services consider a volume-based weight as well as scale weight. Ask which divisor, rounding and minimum rules apply. The shipping-cost guide includes an arithmetic planner, not a carrier rate calculator.",
  ],
  [
    "Do you accept batteries, perfume or food?",
    "Do not assume acceptance. These and other goods may be restricted, prohibited or require specialist arrangements. Discuss the exact contents, quantity, route and packaging with operations before collection.",
  ],
  [
    "Which customs documents will I need?",
    "The required documents depend on the goods, transaction and countries involved. Prepare accurate descriptions, values, origin and party details, then confirm the specific invoice, permits and supporting documents with your shipping contact.",
  ],
  [
    "Are customs duties included in a shipping quote?",
    "Not necessarily. Confirm what the quotation includes and who is responsible for duties, taxes, clearance and destination charges before dispatch. This website does not calculate official customs assessments.",
  ],
  [
    "Can I schedule a pickup or print a carrier label here?",
    "Not automatically. Contact operations to confirm readiness and collection arrangements. Only administrators create shipments; the website does not currently offer self-service pickup scheduling or carrier label generation.",
  ],
  [
    "Can you change a delivery address or arrange a return?",
    "Ask your known shipping contact before moving the goods or attempting a reroute. Changes and return arrangements require shipment-specific review. This site does not automatically reschedule, issue return labels or refund a payment.",
  ],
  [
    "Are these FedEx services or guarantees?",
    "No. Relay’s guides are original preparation information. A carrier such as FedEx applies only when confirmed for your shipment, under the applicable service rules. No FedEx affiliation, automatic integration or carrier guarantee is established by these pages.",
  ],
];
append(
  "/faq",
  "more-questions",
  `<section class="resource-faq-extension"><div class="resource-section-heading">${ui("Before you ship—and when plans change", "h2")}</div><div class="faq-stack">${extraFaq.map(([q, a]) => `<details><summary data-relay-ui>${E(q)}</summary><p>${E(a)}</p></details>`).join("")}</div></section>` +
    related(["/shipping-resources", "/shipping-checklist", "/delivery-help"]),
);
labels["/shipping-resources"] = "Shipping resources";
// Shared navigation and styles; private admin templates and data workflows are untouched.
for (const [route, page] of Object.entries(pages)) {
  if (route.startsWith("/admin")) continue;
  page.body = page.body
    .replace(/<header\b[\s\S]*?<\/header>/, header)
    .replace(/<footer\b[\s\S]*?<\/footer>/, footer);
  const style = '<link rel="stylesheet" href="/assets/resources.css">';
  if (!page.styles.some((s) => s.includes("/assets/resources.css")))
    page.styles.push(style);
}
fs.writeFileSync(
  root + "/ui/pages.json",
  JSON.stringify(pages, null, 2) + "\n",
);
console.log(
  "Expanded Relay content: " +
    content.pages.length +
    " subject guides, resource hub, interactive checklist, homepage/service/FAQ additions.",
);
