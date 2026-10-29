import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const pages = JSON.parse(
  fs.readFileSync(new URL("../ui/pages.json", import.meta.url)),
);
const resources = JSON.parse(
  fs.readFileSync(new URL("../ui/resources.json", import.meta.url)),
);
const guidePaths = [
  ...resources.pages.map((p) => p.path),
  "/shipping-resources",
  "/shipping-checklist",
];
test("nine new shipping resources have unique main headings, useful content and correct shared assets", () => {
  for (const path of guidePaths) {
    const p = pages[path];
    assert.ok(p, path);
    assert.equal((p.body.match(/<h1[\s>]/g) || []).length, 1, path);
    assert.ok(p.scripts.includes("/assets/resources.js"));
    assert.ok(p.styles.some((s) => s.includes("/assets/resources.css")));
    assert.ok(p.description.length > 50);
    assert.ok(!p.body.includes(">undefined<"));
    const main = p.body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];
    assert.ok(
      main
        .replace(/<[^>]*>/g, " ")
        .split(/\s+/)
        .filter(Boolean).length > 200,
      path,
    );
  }
});
test("all internal page links resolve without inventing services or customer tools", () => {
  for (const [path, p] of Object.entries(pages)) {
    for (const match of p.body.matchAll(/href="(\/[^"#?]*)[^\"]*"/g)) {
      const target = match[1];
      if (target.startsWith("/assets/")) continue;
      assert.ok(pages[target], path + " -> " + target);
    }
  }
});
test("carrier research references are external and no FedEx assets are embedded", () => {
  const hub = pages["/shipping-resources"].body;
  assert.match(
    hub,
    /https:\/\/www\.fedex\.com\/en-us\/shipping\/packing\.html/,
  );
  for (const path of guidePaths) {
    assert.doesNotMatch(
      pages[path].body,
      /<(?:img|script)[^>]+(?:fedex\.com|bfldr\.com)/i,
    );
  }
  assert.match(
    pages["/international-shipping"].body,
    /does not currently provide automatic FedEx tracking/,
  );
  assert.match(
    pages["/restricted-items"].body,
    /do not mean that Relay accepts/,
  );
});
test("new tools are browser-only and navigation preserves private/admin behavior", () => {
  assert.match(pages["/shipping-costs"].body, /Confirmed divisor/);
  assert.match(
    pages["/shipping-checklist"].body,
    /No personal details are requested/,
  );
  const code = fs.readFileSync(
    new URL("../public/assets/resources.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(code, /\bfetch\s*\(|XMLHttpRequest|sendBeacon/);
  for (const path of ["/admin", "/admin/quotes"])
    assert.ok(!pages[path].scripts.includes("/assets/resources.js"));
  for (const path of ["/", ...guidePaths])
    assert.match(pages[path].body, /href="\/shipping-resources"/);
});
