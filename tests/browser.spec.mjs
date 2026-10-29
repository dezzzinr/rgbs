import { test, expect } from "@playwright/test";
import fs from "node:fs";
import crypto from "node:crypto";
async function admin(page) {
  await page.goto("/admin");
  await page.waitForFunction(
    () => typeof ops !== "undefined" && ops.ready && !ops.loading,
  );
}
test("public pages render, ordinary links work, mobile layouts have no overflow", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of [
    "/",
    "/about",
    "/services",
    "/services/land",
    "/services/sea",
    "/services/air",
    "/shipping-guide",
    "/faq",
    "/contact",
    "/quote",
    "/privacy",
    "/terms",
  ]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator("[data-relay-language]")).toBeVisible();
    for (const width of [390, 720, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
test("admin creates a shipment and publishes a milestone without losing widget controls", async ({
  page,
}) => {
  await admin(page);
  await page.locator("#newShipmentBtn").click();
  for (const [name, value] of Object.entries({
    recipient: "Node browser test",
    recipient_email: "test@example.com",
    origin: "Lagos",
    origin_country: "Nigeria",
    destination: "Berlin",
    destination_country: "Germany",
    weight: "5.1",
  }))
    await page.locator("[name=" + name + "]").fill(value);
  await page.locator("[name=mode]").selectOption("air");
  await page.locator("#shipmentForm button.primary").click();
  await expect(page.locator("#rows tr")).toHaveCount(7);
  await page.locator("#rows tr").first().locator("button").click();
  await expect(page.locator("#managePayments")).toBeVisible();
  await expect(page.locator("#recordedRouteButton")).toBeVisible();
  await page.locator("#addMilestone").click();
  await page.locator("[name=status]").selectOption("customs_clearance");
  await page
    .locator("[name=public_note]")
    .fill("Documents received for customs clearance");
  await page.locator("#eventForm button.primary").click();
  await expect(page.locator(".modal")).toContainText("Documents received");
});
test("operations filters, selection cap, confirmed atomic demo batch and history", async ({
  page,
}) => {
  await admin(page);
  await page.evaluate(() => {
    const base = makeSamples();
    const extra = Array.from({ length: 70 }, (_, i) => ({
      ...structuredClone(base[0]),
      id: "RLY-DEMO-FIXTURE-" + String(i).padStart(4, "0"),
      tracking_token: "demo-fixture-" + i,
      recipient: "Fixture Recipient " + i,
      estimated_delivery: "2030-12-01",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    localStorage.setItem(
      "relayGlobalDemoV1",
      JSON.stringify([...base, ...extra]),
    );
  });
  await page.reload();
  await page.waitForFunction(
    () =>
      typeof ops !== "undefined" &&
      ops.ready &&
      !ops.loading &&
      ops.total === 76,
  );
  await page.locator("#opsPageSize").selectOption("100");
  await page.waitForFunction(() => ops.items.length === 76);
  await page.locator("#opsSelectAll").click();
  expect(await page.evaluate(() => ops.selected.size)).toBe(50);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.locator("#modeFilter").selectOption("sea");
  await page.waitForFunction(() => !ops.loading && ops.total === 2);
  await page.locator("#opsSelectAll").check();
  await page.locator("#opsBulkButton").click();
  await page
    .locator("#bulkNote")
    .fill("Ocean cargo transfer confirmed by operations");
  await page.locator("#opsBulkForm button.primary").click();
  await page.locator("#bulkConfirmation").fill("PUBLISH 2");
  await page.locator("#opsPublish").click();
  await page.waitForFunction(
    () => !window.opsBusy && !document.getElementById("opsConfirmForm"),
  );
  await expect(page.locator("#rows .pill.in_transit")).toHaveCount(2);
  await page.locator("#rows tr").first().locator("button").click();
  await page.locator("#opsActivityButton").click();
  await expect(
    page.getByText("Bulk milestone published", { exact: true }),
  ).toBeVisible();
});
test("manual payment gate, customer reference, verification, privacy and mobile drawer", async ({
  page,
  context,
}) => {
  await admin(page);
  await page.evaluate(() => details("RLY-DEMO-20481"));
  await page.locator("#managePayments").click();
  await page.locator("#createPayment").click();
  for (const [id, value] of Object.entries({
    paymentTitle: "Customs clearance balance",
    paymentAmount: "250.10",
    paymentPayee: "DEMO Payee",
    paymentBank: "DEMO Bank",
    paymentAccount: "DEMO ONLY DO NOT TRANSFER",
    paymentInstructions: "Demonstration only. No money moves.",
  }))
    await page.locator("#" + id).fill(value);
  await page.locator("#paymentBlocking").check();
  await page.locator("#paymentCreateForm button.primary").click();
  await expect(page.locator(".pay-card")).toContainText("USD 250.10");
  await page
    .getByRole("button", { name: "Back to shipment", exact: true })
    .click();
  await page.locator("#addMilestone").click();
  await page
    .locator("#eventForm select[name=status]")
    .selectOption("out_for_delivery");
  await page.locator("#eventForm button.primary").click();
  await expect(page.locator("#formError")).toContainText(
    "Payment verification is required",
  );
  await page.keyboard.press("Escape");
  const customer = await context.newPage();
  await customer.goto("/track?ref=RLY-DEMO-20481");
  await customer.locator("[data-submit-payment]").click();
  await customer.locator("#transferReference").fill("DEMO-TRANSFER-123");
  await customer.locator("#payDialog button[type=submit]").click();
  await expect(
    customer.getByText("Awaiting verification", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => paymentManager("RLY-DEMO-20481"));
  await page.locator("[data-review=verify]").click();
  await page
    .locator("#paymentReviewNote")
    .fill("DEMO reconciliation only; no real funds");
  await page.locator("#paymentConfirmation").fill("VERIFY");
  await page.locator("#paymentReviewForm button.primary").click();
  await expect(page.locator(".pay-tag.verified")).toBeVisible();
  await customer.reload();
  await expect(customer.locator(".pay-tag.verified")).toBeVisible();
  await expect(customer.locator("#customerPayments")).not.toContainText(
    "DEMO-TRANSFER-123",
  );
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#mobileMenu").click();
  await expect(page.locator("#mobileMenu")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#mobileMenu")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
test("unapproved coordinates remain private; admin approval exposes exactly one pin", async ({
  page,
  context,
}) => {
  await admin(page);
  await page.evaluate(() => {
    const s = shipments.find((s) => s.id === "RLY-DEMO-20481");
    s.events.forEach((e) => (e.map_public = false));
    s.route_public = false;
    persistDemo();
  });
  const customer = await context.newPage();
  await customer.goto("/track?ref=RLY-DEMO-20481");
  await expect(customer.locator("#customerRoute .route-map-svg")).toBeVisible();
  await expect(customer.locator("#customerRoute [data-point]")).toHaveCount(0);
  await page.evaluate(() => details("RLY-DEMO-20481"));
  await page.locator("#recordedRouteButton").click();
  page.on("dialog", (d) => d.accept());
  await page.locator('#routeModalResult [data-share="0"]').click();
  await expect(
    page.getByRole("button", { name: "Hide pin", exact: true }),
  ).toBeVisible();
  await customer.reload();
  await expect(customer.locator("#customerRoute [data-point]")).toHaveCount(1);
  for (const width of [390, 720, 1440]) {
    await customer.setViewportSize({ width, height: 844 });
    expect(
      await customer.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("eleven core languages, RTL and immediate single Smartsupp loader", async ({
  page,
  context,
}) => {
  await context.route("**/api/site-tools", (r) =>
    r.fulfill({
      json: { smartsupp_key: "a".repeat(40), smartsupp_admin_enabled: true },
    }),
  );
  await context.route("https://www.smartsuppchat.com/loader.js?*", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: "window.__chatLoaded=(window.__chatLoaded||0)+1;",
    }),
  );
  await page.goto("/");
  await page.waitForFunction(() => window.__chatLoaded === 1);
  const catalog = JSON.parse(fs.readFileSync("public/assets/languages.json"));
  for (const language of [
    "fr",
    "es",
    "ar",
    "pt",
    "de",
    "it",
    "nl",
    "zh",
    "ja",
    "hi",
    "en",
  ]) {
    await page.locator("[data-relay-language]").selectOption(language);
    await expect(page.locator(".site-nav a").first()).toHaveText(
      catalog["Our services"][language],
    );
    expect(await page.evaluate(() => document.documentElement.lang)).toBe(
      language,
    );
  }
  await page.locator("[data-relay-language]").selectOption("ar");
  expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
  await admin(page);
  await page.waitForFunction(() => window.__chatLoaded === 1);
  expect(
    await page.evaluate(() => Array.from(window.smartsupp._, (x) => [...x])),
  ).toEqual([
    ["analyticsConsent", false],
    ["marketingConsent", false],
  ]);
});
test("quote form security token, accepted reference, safe private review and version", async ({
  page,
  context,
}) => {
  await context.route("**/api/quote-config", (r) =>
    r.fulfill({
      json: { accepting_requests: true, turnstile_site_key: "site-test" },
    }),
  );
  await context.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?*",
    (r) =>
      r.fulfill({
        contentType: "application/javascript",
        body: "window.turnstile={render:(id,o)=>{setTimeout(()=>o.callback('test-token'),0);return 1},reset:()=>{}};relayQuoteChallengeReady()",
      }),
  );
  let submitted;
  await context.route("**/api/quotes", (r) => {
    submitted = r.request().postDataJSON();
    return r.fulfill({
      status: 201,
      json: { reference: "RQ-TEST-ONLY", received: true, replayed: false },
    });
  });
  await page.goto("/quote");
  for (const [name, value] of Object.entries({
    name: "Customer Example",
    email: "customer@example.com",
    origin: "Lagos",
    destination: "Berlin",
    weight: "5.125",
  }))
    await page.locator("[name=" + name + "]").fill(value);
  await page.locator("[name=consent]").check();
  await page.locator("#quoteSubmit").click();
  await expect(page.getByText("RQ-TEST-ONLY", { exact: true })).toBeVisible();
  expect(submitted.turnstile_token).toBe("test-token");
  const q = {
    id: crypto.randomUUID(),
    reference: "RQ-TEST-ONLY",
    name: "<img src=x onerror=alert(1)>",
    email: "customer@example.com",
    phone: "",
    origin: "Lagos",
    destination: "Berlin",
    mode: "air",
    category: "parcel",
    weight: "5.125",
    notes: "<script>alert(1)</script>",
    status: "new",
    admin_note: "",
    amount: null,
    currency: "USD",
    version: 1,
    created_at: "2026-10-28T10:00:00Z",
    history: [],
  };
  const updates = [];
  await context.route("**/api/admin/quotes**", (r) => {
    if (r.request().method() === "PUT") {
      const d = r.request().postDataJSON();
      updates.push(d);
      Object.assign(q, d);
      q.version++;
      return r.fulfill({ json: { saved: true, version: q.version } });
    }
    return r.fulfill({
      json: r
        .request()
        .url()
        .split("?")[0]
        .endsWith("/" + q.id)
        ? q
        : { total: 1, items: [q] },
    });
  });
  await page.goto("/admin/quotes");
  await page.locator("[data-review]").click();
  await expect(page.locator("#quoteRows img")).toHaveCount(0);
  await expect(page.locator("#quoteDetail script")).toHaveCount(0);
  await page.locator("#quoteReview [name=status]").selectOption("quoted");
  await page.locator("#quoteReview [name=amount]").fill("150.50");
  await page.locator("#quoteReview button[type=submit]").click();
  await expect(page.getByText("Review saved.", { exact: false })).toBeVisible();
  expect(updates[0].expected_version).toBe(1);
});
test("AJAX map refresh preserves DOM and displays stale-data warning on failure", async ({
  page,
  context,
}) => {
  await context.route("**/api/config", (r) =>
    r.fulfill({ json: { database_configured: true, demo_available: false } }),
  );
  const shipment = {
    id: "RLY-TEST",
    status: "in_transit",
    mode: "land",
    source: "own_network",
    origin_country: "Nigeria",
    destination_country: "Nigeria",
    estimated_delivery: "2027-01-01",
    updated_at: "2026-10-28T10:00:00Z",
    events: [],
  };
  const route = {
    shipment_id: "RLY-TEST",
    status: "in_transit",
    mode: "land",
    event_count: 1,
    unmapped_count: 0,
    latest_event_mapped: true,
    points: [
      {
        latitude: 6.5,
        longitude: 3.3,
        location: "Approved Lagos",
        status: "in_transit",
        created_at: "2026-10-28T10:00:00Z",
      },
    ],
  };
  let fail = false,
    documents = 0;
  await context.route("**/api/track/test-ref", (r) =>
    r.fulfill({ json: shipment }),
  );
  await context.route("**/api/track/test-ref/route", (r) =>
    r.fulfill({
      status: fail ? 503 : 200,
      json: fail ? { detail: "Temporary route failure" } : route,
    }),
  );
  page.on("request", (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) documents++;
  });
  await page.goto("/track?ref=test-ref");
  await expect(page.locator("#customerRoute .route-map-svg")).toBeVisible();
  await page.evaluate(
    () =>
      (window.__mapNode = document.querySelector(
        "#customerRoute .route-map-svg",
      )),
  );
  await page.locator("[data-map-refresh]").click();
  await page.waitForFunction(
    () => !document.querySelector("[data-map-refresh]").disabled,
  );
  expect(
    await page.evaluate(
      () =>
        window.__mapNode ===
        document.querySelector("#customerRoute .route-map-svg"),
    ),
  ).toBe(true);
  route.points[0].location = "Updated approved hub";
  await page.locator("[data-map-refresh]").click();
  await expect(page.locator("#customerRoute")).toContainText(
    "Updated approved hub",
  );
  fail = true;
  await page.locator("[data-map-refresh]").click();
  await expect(page.locator(".ajax-route-warning")).toBeVisible();
  await expect(page.locator("#customerRoute .route-map-svg")).toBeVisible();
  expect(documents).toBe(1);
});

test("new resource guides are readable and responsive, with working internal navigation", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of [
    "/shipping-resources",
    "/packing-guide",
    "/international-shipping",
    "/customs-guide",
    "/shipping-costs",
    "/restricted-items",
    "/business-shipping",
    "/delivery-help",
    "/shipping-checklist",
  ]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator("[data-relay-language]")).toBeVisible();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.goto("/packing-guide");
  await page.locator(".resource-toc nav a").first().click();
  expect(page.url()).toContain("#section-1");
  await page
    .locator('.resource-breadcrumb a[href="/shipping-resources"]')
    .click();
  await expect(page.locator("main h1")).toContainText(
    "better-prepared shipment",
  );
  expect(errors).toEqual([]);
});

test("planning calculator uses an explicitly entered divisor; checklist is local, persistent and printable", async ({
  page,
}) => {
  await page.goto("/shipping-costs");
  for (const [name, value] of Object.entries({
    length: "50",
    width: "40",
    height: "30",
    actual: "8",
    divisor: "5000",
  }))
    await page.locator("#dimensionPlanner [name=" + name + "]").fill(value);
  await page.locator("#dimensionPlanner button").click();
  await expect(page.locator("#dimensionResult")).toContainText("12 kg");
  await expect(page.locator("#dimensionResult")).toContainText(
    "Planning arithmetic only",
  );
  await page.locator("#dimensionPlanner [name=length]").fill("20");
  await expect(page.locator("#dimensionResult")).toBeEmpty();
  await page.goto("/shipping-checklist");
  await page.locator("#shipmentChecklist input").nth(0).check();
  await page.locator("#shipmentChecklist input").nth(1).check();
  await expect(page.locator("#checklistProgress")).toContainText("2 / 9");
  await page.reload();
  await expect(page.locator("#checklistProgress")).toContainText("2 / 9");
  await expect(page.locator("#shipmentChecklist input").nth(0)).toBeChecked();
  await page.evaluate(() => {
    window.__printCount = 0;
    window.print = () => window.__printCount++;
  });
  await page.locator("#printChecklist").click();
  expect(await page.evaluate(() => window.__printCount)).toBe(1);
  await page.locator("#resetChecklist").click();
  await expect(page.locator("#checklistProgress")).toContainText("0 / 9");
  await expect(page.locator("#resetChecklist")).toBeDisabled();
});

test("public mobile hamburger supports open, Escape, navigation and desktop reset", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const button = page.locator("#publicMenuToggle"),
    panel = page.locator("#publicMobileNav");
  await expect(button).toBeVisible();
  await expect(panel).toBeHidden();
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(button).toBeFocused();
  await button.click();
  await panel.locator('a[href="/shipping-resources"]').click();
  await expect(page.locator("main h1")).toContainText("better-prepared");
  await page.locator("#publicMenuToggle").click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator("#publicMobileNav")).toBeHidden();
  await expect(page.locator("#publicMenuToggle")).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("[data-relay-language]").selectOption("ar");
  await page.locator("#publicMenuToggle").click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("language selector has no visible Language label; chat loads without custom settings UI", async ({
  page,
  context,
}) => {
  await context.route("**/api/site-tools", (r) =>
    r.fulfill({
      json: { smartsupp_key: "a".repeat(40), smartsupp_admin_enabled: true },
    }),
  );
  await context.route("https://www.smartsuppchat.com/loader.js?*", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: "window.__chatLoaded=(window.__chatLoaded||0)+1;",
    }),
  );
  for (const path of ["/", "/packing-guide", "/admin"]) {
    await page.goto(path);
    await page.waitForFunction(() => window.__chatLoaded === 1);
    await expect(page.locator(".relay-language>span")).toHaveCount(0);
    await expect(page.locator("[data-relay-language]")).toHaveAccessibleName(
      "Language",
    );
    await expect(
      page.locator(".relay-chat-launch,.relay-chat-tools,.relay-chat-dialog"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Chat settings", exact: true }),
    ).toHaveCount(0);
  }
});
test("new shipping photographs load on homepage cards and guide pages", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".service-picture img")).toHaveCount(3);
  for (const image of await page.locator(".service-picture img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((n) => n.naturalWidth))
      .toBeGreaterThan(0);
  }
  for (const path of ["/services/air", "/services/land"]) {
    await page.goto(path);
    const image = page.locator(".editorial-visual img");
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((n) => n.naturalWidth))
      .toBeGreaterThan(0);
  }
});

test("all 27 services are searchable, filterable and linked to dedicated service pages", async ({
  page,
}) => {
  await page.goto("/services");
  await expect(page.locator("[data-service-card]")).toHaveCount(27);
  await page.locator("#serviceSearch").fill("COD");
  await expect(page.locator("[data-service-card]:visible")).toHaveCount(1);
  await expect(page.locator("[data-service-card]:visible")).toContainText(
    "Cash on delivery",
  );
  await page.locator("#serviceSearch").fill("");
  await page.locator('[data-service-filter="Customer care"]').click();
  await expect(page.locator("[data-service-card]:visible")).toHaveCount(3);
  await page.locator('[data-service-filter="all"]').click();
  await expect(page.locator("[data-service-card]:visible")).toHaveCount(27);
  await page.locator("#serviceSearch").fill("Warehousing");
  await page.locator("[data-service-card]:visible h3 a").click();
  await expect(page.locator("main h1")).toHaveText("Warehousing and storage");
  for (const path of [
    "/services/cash-on-delivery",
    "/services/proof-of-delivery",
    "/services/delivery-insurance-declared-value",
  ]) {
    await page.goto(path);
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});

test("service-specific enquiry prepopulates only an editable note, not a booking or payment", async ({
  page,
}) => {
  await page.goto("/services/cash-on-delivery");
  await page.locator(".courier-enquiry a.button").click();
  await expect(page.locator("#selectedServiceNote")).toContainText(
    "Cash on delivery (COD)",
  );
  await expect(page.locator("#quoteForm [name=notes]")).toHaveValue(
    "Service requested: Cash on delivery (COD)\n",
  );
  await expect(page.locator("#quoteSubmit")).toBeDisabled();
  await page
    .locator("#quoteForm [name=notes]")
    .fill("Please discuss the remittance terms first.");
  await expect(page.locator("#quoteForm [name=notes]")).toHaveValue(
    "Please discuss the remittance terms first.",
  );
});

test("public navigation uses a vertical modal off-canvas drawer and includes tracking", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("#publicMenuToggle").click();
  const panel = page.locator("#publicMobileNav");
  await expect(panel).toHaveAttribute("aria-modal", "true");
  await expect(panel.locator(".public-drawer-close")).toBeFocused();
  await expect
    .poll(() =>
      panel.evaluate((n) => Math.round(n.getBoundingClientRect().right)),
    )
    .toBe(390);
  const box = await panel.boundingBox();
  expect(box.y).toBe(0);
  expect(box.width).toBeLessThan(390);
  expect(box.height).toBe(844);
  expect(await panel.evaluate((n) => getComputedStyle(n).position)).toBe(
    "fixed",
  );
  const links = await panel
    .locator("a")
    .evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().top));
  expect(links.every((y, i) => i === 0 || y > links[i - 1])).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect(panel.locator("a").last()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(panel.locator(".public-drawer-close")).toBeFocused();
  expect(await page.locator("main").evaluate((n) => n.inert)).toBe(true);
  await panel.locator(".public-drawer-close").click();
  await expect(panel).toBeHidden();
  await expect(page.locator("#publicMenuToggle")).toBeFocused();
  expect(await page.locator("main").evaluate((n) => n.inert)).toBe(false);
  await page.locator("#publicMenuToggle").click();
  await page
    .locator(".public-menu-backdrop")
    .click({ position: { x: 10, y: 300 } });
  await expect(panel).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.site-nav a[href="/track"]')).toBeVisible();
});

test("payments poll and refresh through AJAX while preserving the page, panel and unfinished reference", async ({
  page,
  context,
}) => {
  await context.route("**/api/config", (r) =>
    r.fulfill({ json: { database_configured: true, demo_available: false } }),
  );
  await context.route("**/api/track/ajax-pay", (r) =>
    r.fulfill({
      json: {
        id: "RLY-AJAX",
        status: "in_transit",
        mode: "land",
        source: "own_network",
        origin_country: "Nigeria",
        destination_country: "Nigeria",
        updated_at: "2026-10-29T10:00:00Z",
        events: [],
      },
    }),
  );
  let status = "requested",
    fail = false,
    calls = 0,
    documents = 0;
  await context.route("**/api/track/ajax-pay/payments", (r) => {
    calls++;
    return r.fulfill({
      status: fail ? 503 : 200,
      json: fail
        ? { detail: "Temporary payment service failure" }
        : {
            blocking: status !== "verified",
            items: [
              {
                id: "PAY-AJAX",
                title: "Milestone balance",
                currency: "USD",
                amount: "100.00",
                status,
                activated_at: "2026-10-29T10:00:00Z",
                blocks_progress: true,
                payee_name: "Test payee",
                bank_name: "Test bank",
                account_details: "Test account",
                instructions: "Test only",
              },
            ],
          },
    });
  });
  page.on("request", (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) documents++;
  });
  await page.clock.install();
  await page.goto("/track?ref=ajax-pay");
  await expect(page.locator("[data-submit-payment]")).toBeVisible();
  await page.evaluate(() => {
    window.__paymentPanel = document.getElementById("customerPayments");
    window.__paymentDocument = document.documentElement;
  });
  await page.locator("[data-submit-payment]").click();
  await page.locator("#transferReference").fill("KEEP-MY-REFERENCE");
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/track/ajax-pay")),
    page.evaluate(() => document.getElementById("refreshTracking").click()),
  ]);
  await expect(page.locator("#transferReference")).toHaveValue(
    "KEEP-MY-REFERENCE",
  );
  expect(
    await page.evaluate(
      () =>
        window.__paymentPanel === document.getElementById("customerPayments"),
    ),
  ).toBe(true);
  status = "submitted";
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/payments")),
    page.evaluate(() =>
      document.querySelector("[data-refresh-payments]").click(),
    ),
  ]);
  await expect(page.locator(".pay-tag.submitted")).toBeVisible();
  await expect(page.locator("#transferReference")).toHaveValue(
    "KEEP-MY-REFERENCE",
  );
  await page.locator("#payDialog [data-close]").click();
  status = "verified";
  const before = calls;
  await page.clock.fastForward(15001);
  await expect(page.locator(".pay-tag.verified")).toBeVisible();
  expect(calls).toBeGreaterThan(before);
  fail = true;
  await page.locator("[data-refresh-payments]").click();
  await expect(page.locator("[data-pay-status]")).toContainText(
    "may be out of date",
  );
  await expect(page.locator(".pay-tag.verified")).toBeVisible();
  fail = false;
  await page.locator("[data-refresh-payments]").click();
  await expect(page.locator("[data-pay-status]")).toContainText("up to date");
  expect(documents).toBe(1);
  expect(
    await page.evaluate(
      () =>
        window.__paymentDocument === document.documentElement &&
        window.__paymentPanel === document.getElementById("customerPayments"),
    ),
  ).toBe(true);
});
