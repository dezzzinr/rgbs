import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
const root = new URL("../", import.meta.url),
  pages = JSON.parse(fs.readFileSync(new URL("ui/pages.json", root))),
  services = JSON.parse(
    fs.readFileSync(new URL("ui/services.json", root)),
  ).services;
test("all 20 core services and seven additional offerings have dedicated public pages", () => {
  assert.equal(services.length, 27);
  assert.equal(new Set(services.map((s) => s.slug)).size, 27);
  for (const s of services) {
    const p = pages["/services/" + s.slug];
    assert.ok(p, s.slug);
    assert.equal((p.body.match(/<h1[\s>]/g) || []).length, 1);
    assert.ok(p.body.includes(s.title.replaceAll("&", "&amp;")));
    assert.ok(p.body.includes("/quote?service=" + s.slug));
    assert.equal((p.body.match(/<h2[\s>]/g) || []).length >= 4, true);
    assert.ok(s.prepare.length >= 3);
  }
});
test("catalogue includes every service and the intended category/search controls", () => {
  assert.equal(
    (pages["/services"].body.match(/data-service-card /g) || []).length,
    27,
  );
  assert.match(pages["/services"].body, /id="serviceSearch"/);
  assert.match(pages["/services"].body, /data-service-filter="all"/);
  for (const s of services)
    assert.ok(
      pages["/services"].body.includes('href="/services/' + s.slug + '"'),
    );
});
test("all public photographic placements are unique and refer to distinct files", () => {
  const sources = new Set(),
    hashes = new Set();
  let count = 0;
  for (const [path, page] of Object.entries(pages)) {
    if (path.startsWith("/admin")) continue;
    for (const m of page.body.matchAll(/<img\b[^>]*src="([^"]+)"[^>]*>/g)) {
      const src = m[1];
      assert.ok(!sources.has(src), "Repeated photo placement: " + src);
      sources.add(src);
      const file = new URL("public" + src, root);
      assert.ok(fs.existsSync(file), "Missing image " + src);
      const hash = crypto
        .createHash("sha256")
        .update(fs.readFileSync(file))
        .digest("hex");
      assert.ok(!hashes.has(hash), "Repeated image bytes: " + src);
      hashes.add(hash);
      count++;
    }
  }
  assert.equal(count, 14);
  assert.equal(
    [...sources].filter((s) => s.startsWith("/assets/services/")).length,
    10,
  );
});
test("service copy distinguishes offered operations from unimplemented website automation", () => {
  for (const [slug, pattern] of [
    ["cash-on-delivery", /does not automatically collect/],
    ["delivery-notifications", /does not automatically send SMS/],
    ["proof-of-delivery", /does not capture electronic recipient signatures/],
    ["delivery-insurance-declared-value", /does not issue an insurance policy/],
  ])
    assert.match(pages["/services/" + slug].body, pattern);
  assert.match(
    pages["/services/same-day-delivery"].body,
    /not a universal same-day guarantee/,
  );
});
