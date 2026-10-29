import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import sharp from "sharp";
import { PGlite } from "@electric-sql/pglite";
import {
  setTestAdapter,
  tx,
  sha,
  hashPassword,
  verifyPassword,
  pythonJson,
} from "../server/core.mjs";
import { handle, publicConfig, features } from "../server/api.mjs";
import { setTestStore, sanitize } from "../server/photos.mjs";
import {
  schemaSql,
  head,
  migrations,
  upgradePlan,
  checkSchema,
} from "../server/schema.mjs";
const vectors = JSON.parse(
  fs.readFileSync(new URL("./python-vectors.json", import.meta.url)),
);
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
process.env.RELAY_SECURE_COOKIES = "false";
const cookie = "relay_session=python-existing-session-2026",
  db = new PGlite();
let objects = new Map(),
  deleted = [];
const shipping = {
  recipient: "Private recipient",
  recipient_email: "private@example.com",
  origin: "PRIVATE Lagos warehouse street",
  origin_country: "Nigeria",
  destination: "PRIVATE Berlin address",
  destination_country: "Germany",
  weight: 5.125,
  mode: "air",
};
const payment = {
  title: "Customs fee",
  amount: "20.50",
  currency: "USD",
  payee_name: "Relay Logistics",
  bank_name: "Test Bank",
  account_details: "Test account 12345",
  instructions: "Transfer the exact requested amount",
  blocks_progress: true,
  activate_at: null,
};
const quote = () => ({
  request_id: crypto.randomUUID(),
  name: "Customer Example",
  email: "CUSTOMER@example.com",
  origin: "Lagos",
  destination: "Berlin",
  mode: "air",
  category: "parcel",
  weight: "5.125",
  consent: true,
  notes: "Handle carefully",
  website: "",
  turnstile_token: "",
});
async function call(path, method = "GET", body, options = {}) {
  const headers = {
    "x-relay-client": "web",
    ...(options.auth === false ? {} : { cookie }),
    ...options.headers,
  };
  let encoded;
  if (body instanceof FormData) encoded = body;
  else if (body !== undefined) {
    encoded = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }
  const res = await handle(
    new Request("http://relay.test/api/" + path, {
      method,
      headers,
      body: encoded,
    }),
  );
  const content =
    res.status === 204
      ? null
      : res.headers.get("content-type")?.includes("application/json")
        ? await res.json()
        : await res.text();
  return { status: res.status, data: content, headers: res.headers };
}
async function create(extra = {}) {
  const r = await call("shipments", "POST", { ...shipping, ...extra });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data;
}
async function pay(s, extra = {}) {
  const r = await call("shipments/" + s.id + "/payments", "POST", {
    ...payment,
    ...extra,
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data;
}
const ev = (s, status = "in_transit", extra = {}) =>
  call("shipments/" + s.id + "/events", "POST", {
    status,
    public_note: "Public progress update",
    ...extra,
  });
const listPay = (s) => call("shipments/" + s.id + "/payments");
before(async () => {
  await db.exec(schemaSql);
  setTestAdapter({
    transaction: (fn) =>
      db.transaction((c) =>
        fn({ query: (sql, params = []) => c.query(sql, params) }),
      ),
  });
});
after(() => db.close());
beforeEach(async () => {
  delete process.env.VERCEL;
  delete process.env.RELAY_MAPBOX_PUBLIC_TOKEN;
  delete process.env.RELAY_TURNSTILE_SITE_KEY;
  delete process.env.RELAY_TURNSTILE_SECRET;
  delete process.env.RELAY_TURNSTILE_HOSTNAMES;
  process.env.RELAY_ALLOW_UNVERIFIED_QUOTES = "false";
  objects = new Map();
  deleted = [];
  setTestStore({
    put: async (k, v) => objects.set(k, v),
    get: async (k) => {
      if (!objects.has(k)) throw Error("Missing");
      return objects.get(k);
    },
    delete: async (k) => {
      deleted.push(k);
      objects.delete(k);
    },
  });
  await db.exec(
    "TRUNCATE users RESTART IDENTITY CASCADE; TRUNCATE quote_rate_limits;",
  );
  await db.query(
    "INSERT INTO users(id,email,name,password,role) VALUES($1,$2,$3,$4,$5)",
    ["admin1", "admin@example.com", "Existing Admin", vectors.stored, "admin"],
  );
  await db.query(
    "INSERT INTO sessions(token_hash,user_id,expires) VALUES($1,$2,$3)",
    [
      sha("python-existing-session-2026"),
      "admin1",
      "2099-01-01T12:00:00.123456+00:00",
    ],
  );
});
test("exact Python scrypt and canonical Unicode JSON compatibility", async () => {
  assert.equal(
    await hashPassword(vectors.password, vectors.stored.split(":")[0]),
    vectors.stored,
  );
  assert.equal(await verifyPassword(vectors.password, vectors.stored), true);
  assert.equal(await verifyPassword("wrong", vectors.stored), false);
  assert.equal(await verifyPassword(vectors.password, "malformed"), false);
  assert.equal(pythonJson(vectors.json), vectors.compact);
  assert.equal(pythonJson(vectors.json, false), vectors.spaced);
});
test("existing Python cookie works; expiry is parsed, not lexically compared", async () => {
  assert.equal((await call("auth/me")).data.email, "admin@example.com");
  await db.query("UPDATE sessions SET expires=$1", [
    "2020-01-01T00:00:00.000001+00:00",
  ]);
  assert.equal((await call("auth/me")).status, 401);
});
test("login preserves existing password; cookie/logout/CSRF contract", async () => {
  const r = await call(
    "auth/login",
    "POST",
    { email: "ADMIN@example.com", password: vectors.password },
    { auth: false },
  );
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);
  assert.equal("password" in r.data, false);
  assert.equal(
    (
      await call(
        "auth/login",
        "POST",
        { email: "unknown@example.com", password: vectors.password },
        { auth: false },
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await call("shipments", "POST", shipping, {
        headers: { "x-relay-client": "" },
      })
    ).status,
    403,
  );
  assert.equal((await call("auth/register", "POST", {})).status, 403);
  assert.equal((await call("auth/logout", "POST")).status, 204);
  assert.equal((await call("auth/me")).status, 401);
});
test("private routes reject unauthenticated requests", async () => {
  for (const p of [
    "shipments",
    "operations/summary",
    "admin/quotes",
    "integrations",
  ])
    assert.equal(
      (await call(p, "GET", undefined, { auth: false })).status,
      401,
    );
});
test("create/edit preserve IDs, tokens, initial event, audit and omitted extras", async () => {
  const s = await create({
    shipping_charge: "150.00",
    category: "freight",
    contents_description: "Private cargo",
  });
  assert.match(s.id, /^RLY-[A-F0-9]{20}$/);
  assert.equal(s.shipping_charge, "150.00");
  const r = await call("shipments/" + s.id, "PUT", {
    ...shipping,
    recipient: "Updated recipient",
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.shipping_charge, "150.00");
  assert.equal(r.data.category, "freight");
  assert.equal(r.data.tracking_token, s.tracking_token);
  assert.equal((await call("shipments/" + s.id)).data.events.length, 1);
  assert.equal((await call("shipments/" + s.id + "/audit")).data.length, 2);
});
test("partner validation and own-network clearing", async () => {
  assert.equal(
    (await call("shipments", "POST", { ...shipping, source: "partner" }))
      .status,
    422,
  );
  const s = await create({
    source: "partner",
    carrier: "FedEx",
    external_tracking: "EXTERNAL-TEST",
  });
  assert.equal(s.carrier, "FedEx");
  const r = await call("shipments/" + s.id, "PUT", {
    ...shipping,
    carrier: "Remove",
    external_tracking: "Remove",
  });
  assert.equal(r.data.carrier, null);
  assert.equal(r.data.external_tracking, null);
});
test("public tracking projection never contains recipient, addresses or staff", async () => {
  const s = await create({
    contents_description: "PRIVATE cargo",
    shipping_charge: "123.45",
  });
  const r = await call("track/" + s.tracking_token, "GET", undefined, {
    auth: false,
  });
  assert.equal(r.status, 200);
  const value = JSON.stringify(r.data);
  for (const term of [
    "PRIVATE",
    "private@example.com",
    "recipient",
    "created_by",
    "tracking_token",
    "shipping_charge",
  ])
    assert.equal(value.includes(term), false, term);
  assert.equal(r.data.events.length, 1);
  assert.equal((await call("track/" + s.id.toLowerCase())).status, 200);
  assert.equal(r.headers.get("cache-control"), "private, no-store");
});
test("coordinates are private by default; approval and route endpoints are opt-in", async () => {
  const s = await create({
    route_origin_lat: 6.5,
    route_origin_lon: 3.4,
    route_destination_lat: 52.5,
    route_destination_lon: 13.4,
  });
  await ev(s, "in_transit", {
    latitude: 11.123,
    longitude: 12.456,
    location: "Private recorded coordinate",
  });
  let pub = (await call("track/" + s.id + "/route")).data;
  assert.equal(pub.points.length, 0);
  assert.equal(pub.route_plan, null);
  assert.equal(pub.live, false);
  const full = (await call("shipments/" + s.id + "/route")).data;
  assert.equal(full.points.length, 1);
  const id = full.points[0].event_id;
  const visibility = "shipments/" + s.id + "/events/" + id + "/map-visibility";
  assert.equal(
    (
      await call(visibility, "PUT", {
        map_public: true,
        expected_public: false,
        confirmation: "PUBLISH",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call(visibility, "PUT", {
        map_public: false,
        expected_public: false,
        confirmation: "HIDE",
      })
    ).status,
    409,
  );
  pub = (await call("track/" + s.id + "/route")).data;
  assert.equal(pub.points.length, 1);
  assert.equal("event_id" in pub.points[0], false);
  assert.equal("map_public" in pub.points[0], false);
});
test("published endpoints require labels and paired finite coordinates", async () => {
  for (const extra of [
    { route_origin_lat: 4 },
    { route_public: true },
    { estimated_arrival_at: "2026-11-20T12:00:00" },
    { shipping_charge: "1.001" },
    { shipping_charge: "1.50", charge_currency: "JPY" },
  ])
    assert.equal(
      (await call("shipments", "POST", { ...shipping, ...extra })).status,
      422,
    );
  const s = await create({
    route_origin_label: "Lagos",
    route_destination_label: "Berlin",
    route_origin_lat: 6.5,
    route_origin_lon: 3.4,
    route_destination_lat: 52.5,
    route_destination_lon: 13.4,
    route_public: true,
    estimated_arrival_at: "2026-11-20T12:00:00+01:00",
  });
  assert.equal(
    (await call("track/" + s.id + "/route")).data.route_plan.origin.label,
    "Lagos",
  );
});
test("operations search, literal wildcard, filters, summary, paging and CSV safety", async () => {
  await create({ recipient: "=SUM(1,2)", estimated_delivery: "2020-01-01" });
  await create({ recipient: "Literal 100% customer", mode: "sea" });
  assert.equal((await call("operations/shipments?q=100%25")).data.total, 1);
  assert.equal(
    (await call("operations/shipments?mode=sea&limit=1&offset=0")).data.items
      .length,
    1,
  );
  assert.equal(
    (await call("operations/shipments?attention=customs")).status,
    200,
  );
  assert.equal(
    (await call("operations/shipments?attention=payments")).status,
    200,
  );
  assert.equal(
    (await call("operations/shipments?attention=overdue")).data.total,
    1,
  );
  const summary = (await call("operations/summary")).data;
  assert.equal(summary.total, 2);
  assert.equal(summary.overdue, 1);
  assert.equal((await call("operations/shipments?limit=101")).status, 422);
  const csv = await call("operations/export");
  assert.match(csv.data, /'=SUM\(1,2\)/);
  assert.equal(
    (await call("operations/shipments?eta_from=2027-01-01&eta_to=2026-01-01"))
      .status,
    422,
  );
});
function batch(items, extra = {}) {
  return {
    request_id: crypto.randomUUID(),
    items: items.map((s) => ({ id: s.id, expected_updated_at: s.updated_at })),
    status: "in_transit",
    location: "Lagos → 東京 😀",
    public_note: "Accepted transfer update",
    confirmation: "PUBLISH " + items.length,
    ...extra,
  };
}
test("bulk is atomic, replay-safe, rejects changed request and stale selection", async () => {
  const a = await create(),
    b = await create(),
    body = batch([a, b]);
  let r = await call("operations/bulk-events", "POST", body);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.updated, 2);
  r = await call("operations/bulk-events", "POST", body);
  assert.equal(r.data.replayed, true);
  assert.equal((await call("shipments/" + a.id)).data.events.length, 2);
  assert.equal(
    (
      await call("operations/bulk-events", "POST", {
        ...body,
        public_note: "Different request content",
      })
    ).status,
    409,
  );
  assert.equal(
    (await call("operations/bulk-events", "POST", batch([a, b]))).status,
    409,
  );
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM bulk_operations")).rows[0]
      .n,
    1,
  );
});
test("bulk blocked by one payment rolls every shipment back", async () => {
  const a = await create(),
    b = await create();
  await pay(b);
  const fresh = (await call("shipments/" + b.id)).data;
  assert.equal(
    (await call("operations/bulk-events", "POST", batch([a, fresh]))).status,
    409,
  );
  assert.equal((await call("shipments/" + a.id)).data.status, "booked");
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM bulk_operations")).rows[0]
      .n,
    0,
  );
});
test("legacy completed bulk result can replay without touching history", async () => {
  const s = await create(),
    body = batch([s]),
    canonical = {
      items: body.items,
      status: body.status,
      location: body.location,
      public_note: body.public_note,
      confirmation: body.confirmation,
    };
  await db.query(
    "INSERT INTO bulk_operations(id,actor_id,body_hash,result,created_at) VALUES($1,$2,$3,$4,$5)",
    [
      body.request_id,
      "admin1",
      sha(pythonJson(canonical)),
      JSON.stringify({
        updated: 1,
        shipment_ids: [s.id],
        status: "in_transit",
      }),
      "2026-10-29T12:00:00+00:00",
    ],
  );
  assert.equal(
    (await call("operations/bulk-events", "POST", body)).data.replayed,
    true,
  );
  assert.equal((await call("shipments/" + s.id)).data.events.length, 1);
});
test("payment gate cannot be bypassed by unverified reference", async () => {
  const s = await create(),
    p = await pay(s);
  assert.equal((await ev(s)).status, 409);
  const submitted = await call(
    "track/" + s.id + "/payments/" + p.id + "/submit",
    "POST",
    { reference: "BANK-REFERENCE", note: "Sent" },
  );
  assert.equal(submitted.status, 200);
  assert.equal((await ev(s)).status, 409);
  assert.equal(
    (
      await call("track/" + s.id + "/payments/" + p.id + "/submit", "POST", {
        reference: "BANK-REFERENCE",
        note: "Sent",
      })
    ).status,
    200,
  );
  const current = (await listPay(s)).data.items[0];
  const reviewed = await call(
    "shipments/" + s.id + "/payments/" + p.id + "/review",
    "POST",
    {
      action: "verify",
      expected_updated_at: current.updated_at,
      review_note: "Bank statement matched",
      confirmation: "VERIFY",
    },
  );
  assert.equal(reviewed.status, 200);
  assert.equal((await ev(s)).status, 201);
});
test("future payment activates at milestone; hold/cancel remain possible", async () => {
  const s = await create();
  await pay(s, { activate_at: "customs_clearance" });
  assert.equal(
    (await call("track/" + s.id + "/payments")).data.items.length,
    0,
  );
  assert.equal((await ev(s, "customs_clearance")).status, 201);
  assert.equal((await call("track/" + s.id + "/payments")).data.blocking, true);
  assert.equal((await ev(s, "out_for_delivery")).status, 409);
  assert.equal((await ev(s, "on_hold")).status, 201);
  assert.equal((await ev(s, "cancelled")).status, 201);
  assert.equal((await listPay(s)).data.items[0].status, "cancelled");
  assert.equal((await ev(s)).status, 409);
});
test("payment review optimistic locking and rejection explanation", async () => {
  const s = await create(),
    p = await pay(s);
  await call("track/" + s.id + "/payments/" + p.id + "/submit", "POST", {
    reference: "BANK-REFERENCE",
  });
  const path = "shipments/" + s.id + "/payments/" + p.id + "/review";
  assert.equal(
    (
      await call(path, "POST", {
        action: "verify",
        expected_updated_at: p.updated_at,
        review_note: "Bank statement matched",
        confirmation: "VERIFY",
      })
    ).status,
    409,
  );
  const fresh = (await listPay(s)).data.items[0];
  assert.equal(
    (
      await call(path, "POST", {
        action: "reject",
        expected_updated_at: fresh.updated_at,
        review_note: "No funds found",
        public_message: "",
        confirmation: "REJECT",
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await call(path, "POST", {
        action: "reject",
        expected_updated_at: fresh.updated_at,
        review_note: "No funds found",
        public_message: "Please check your reference",
        confirmation: "REJECT",
      })
    ).status,
    200,
  );
  assert.equal((await listPay(s)).data.items[0].status, "requested");
});
test("quote intake unavailable without protection; Vercel ignores dev bypass", async () => {
  assert.equal(
    (await call("quotes", "POST", quote(), { auth: false })).status,
    503,
  );
  process.env.RELAY_ALLOW_UNVERIFIED_QUOTES = "true";
  process.env.VERCEL = "1";
  assert.equal(
    (await call("quotes", "POST", quote(), { auth: false })).status,
    503,
  );
});
test("quote intake replay, strict validation, private review and optimistic version", async () => {
  process.env.RELAY_ALLOW_UNVERIFIED_QUOTES = "true";
  const data = quote(),
    r = await call("quotes", "POST", data, { auth: false });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.match(r.data.reference, /^RQ-/);
  assert.equal(
    (await call("quotes", "POST", data, { auth: false })).data.replayed,
    true,
  );
  assert.equal(
    (
      await call(
        "quotes",
        "POST",
        { ...data, notes: "changed" },
        { auth: false },
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        "quotes",
        "POST",
        { ...quote(), unexpected: "field" },
        { auth: false },
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await call(
        "quotes",
        "POST",
        { ...quote(), consent: false },
        { auth: false },
      )
    ).status,
    422,
  );
  const items = (await call("admin/quotes")).data.items;
  assert.equal(items.length, 1);
  assert.equal(items[0].email, "customer@example.com");
  const path = "admin/quotes/" + data.request_id;
  assert.equal(
    (
      await call(path, "PUT", {
        expected_version: 1,
        status: "quoted",
        amount: null,
        currency: "USD",
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await call(path, "PUT", {
        expected_version: 1,
        status: "quoted",
        amount: "200.00",
        currency: "USD",
        admin_note: "Contact separately",
      })
    ).status,
    200,
  );
  assert.equal(
    (await call(path, "PUT", { expected_version: 1, status: "closed" })).status,
    409,
  );
  assert.equal((await call(path)).data.history.length, 2);
});
test("quote database rate limit shared across requests", async () => {
  process.env.RELAY_ALLOW_UNVERIFIED_QUOTES = "true";
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await call("quotes", "POST", quote(), { auth: false })).status,
      201,
    );
  assert.equal(
    (await call("quotes", "POST", quote(), { auth: false })).status,
    429,
  );
});
test("Turnstile verifies action and exact hostname server-side", async () => {
  const original = globalThis.fetch;
  process.env.RELAY_TURNSTILE_SITE_KEY = "site_key";
  process.env.RELAY_TURNSTILE_SECRET = "server-secret";
  process.env.RELAY_TURNSTILE_HOSTNAMES = "relay.example";
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: true,
          action: "wrong",
          hostname: "relay.example",
        }),
      );
    assert.equal(
      (
        await call(
          "quotes",
          "POST",
          { ...quote(), turnstile_token: "token" },
          { auth: false },
        )
      ).status,
      422,
    );
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: true,
          action: "quote",
          hostname: "evil.example",
        }),
      );
    assert.equal(
      (
        await call(
          "quotes",
          "POST",
          { ...quote(), turnstile_token: "token" },
          { auth: false },
        )
      ).status,
      503,
    );
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: true,
          action: "quote",
          hostname: "relay.example",
        }),
      );
    assert.equal(
      (
        await call(
          "quotes",
          "POST",
          { ...quote(), turnstile_token: "token" },
          { auth: false },
        )
      ).status,
      201,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("photo sanitization strips metadata; private until explicitly approved; removal revokes before purge", async () => {
  const s = await create();
  const input = await sharp({
    create: {
      width: 80,
      height: 60,
      channels: 4,
      background: { r: 0, g: 150, b: 50, alpha: 0.5 },
    },
  })
    .png()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const clean = await sanitize(input);
  const meta = await sharp(clean.data).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.exif, undefined);
  const form = new FormData();
  form.set("file", new Blob([input], { type: "image/png" }), "private.png");
  form.set("caption", "A shipment photograph");
  const uploaded = await call("shipments/" + s.id + "/photos", "POST", form);
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.data));
  const p = uploaded.data;
  assert.equal(p.public, false);
  assert.equal((await call("track/" + s.id + "/photos")).data.items.length, 0);
  assert.equal(
    (await call("track/" + s.id + "/photos/" + p.id + "/image")).status,
    404,
  );
  assert.equal(
    (
      await call("shipments/" + s.id + "/photos/" + p.id, "PUT", {
        caption: "Approved photo",
        public: true,
        expected_updated_at: p.updated_at,
        confirmation: "PUBLISH",
      })
    ).status,
    200,
  );
  const published = (await call("track/" + s.id + "/photos")).data.items[0];
  assert.equal("object_key" in published, false);
  assert.equal("created_by" in published, false);
  assert.equal(
    (await call("track/" + s.id + "/photos/" + p.id + "/image")).status,
    200,
  );
  const fresh = (await call("shipments/" + s.id + "/photos")).data.items[0];
  const removed = await call(
    "shipments/" + s.id + "/photos/" + p.id,
    "DELETE",
    { expected_updated_at: fresh.updated_at, confirmation: "DELETE" },
  );
  assert.equal(removed.status, 200);
  assert.equal(removed.data.storage_purged, true);
  assert.equal(deleted.length, 1);
  assert.equal(
    (await call("track/" + s.id + "/photos/" + p.id + "/image")).status,
    404,
  );
});
test("photo parser rejects disguised SVG and oversized uploads", async () => {
  await assert.rejects(
    sanitize(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>',
      ),
    ),
  );
  await assert.rejects(sanitize(Buffer.alloc(2 * 1024 * 1024 + 1)));
  const s = await create();
  const form = new FormData();
  form.set("file", new Blob(["not an image"]), "fake.jpg");
  assert.equal(
    (await call("shipments/" + s.id + "/photos", "POST", form)).status,
    422,
  );
  assert.equal(objects.size, 0);
});
test("no public secret tokens; production never enables demo", async () => {
  process.env.RELAY_MAPBOX_PUBLIC_TOKEN = "sk.secret";
  assert.equal(features().mapbox_public_token, "");
  process.env.RELAY_DEMO_MODE = "true";
  assert.equal(publicConfig().demo_available, false);
  delete process.env.DATABASE_URL;
  process.env.VERCEL = "1";
  assert.equal(publicConfig().demo_available, false);
  process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
});
test("schema adoption is no-op at 007 and unknown revisions are rejected", async () => {
  await tx(checkSchema);
  assert.equal(head, "007_quote_requests");
  assert.equal(upgradePlan(head).length, 0);
  assert.throws(() => upgradePlan("unknown"));
  assert.deepEqual(
    upgradePlan("006_shipment_setup").map((m) => m.revision),
    ["007_quote_requests"],
  );
  assert.equal(migrations.length, 7);
});
test("legacy quote replay accepts equivalent stored Decimal formatting, never changed enquiry fields", async () => {
  process.env.RELAY_ALLOW_UNVERIFIED_QUOTES = "true";
  const data = quote();
  data.weight = "5.0000";
  assert.equal(
    (await call("quotes", "POST", data, { auth: false })).status,
    201,
  );
  await db.query("UPDATE quote_requests SET payload_hash=$1 WHERE id=$2", [
    sha("legacy Python Decimal representation"),
    data.request_id,
  ]);
  const retry = await call(
    "quotes",
    "POST",
    { ...data, weight: "5.000" },
    { auth: false },
  );
  assert.equal(retry.status, 201);
  assert.equal(retry.data.replayed, true);
  assert.equal(
    (
      await call(
        "quotes",
        "POST",
        { ...data, destination: "Paris" },
        { auth: false },
      )
    ).status,
    409,
  );
});
test("failed object deletion leaves a committed private tombstone for retry", async () => {
  const s = await create(),
    input = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "#008855" },
    })
      .jpeg()
      .toBuffer();
  const form = new FormData();
  form.set("file", new Blob([input]), "example.jpg");
  let p = (await call("shipments/" + s.id + "/photos", "POST", form)).data;
  p = (
    await call("shipments/" + s.id + "/photos/" + p.id, "PUT", {
      caption: "Approved",
      public: true,
      expected_updated_at: p.updated_at,
      confirmation: "PUBLISH",
    })
  ).data;
  setTestStore({
    put: async () => {},
    get: async () => input,
    delete: async () => {
      const record = (
        await db.query(
          "SELECT public,deleted_at FROM shipment_photos WHERE id=$1",
          [p.id],
        )
      ).rows[0];
      assert.equal(record.public, false);
      assert.ok(record.deleted_at);
      throw Error("Provider unavailable");
    },
  });
  const result = await call("shipments/" + s.id + "/photos/" + p.id, "DELETE", {
    expected_updated_at: p.updated_at,
    confirmation: "DELETE",
  });
  assert.deepEqual(result.data, { removed: true, storage_purged: false });
  assert.equal(
    (await call("track/" + s.id + "/photos/" + p.id + "/image")).status,
    404,
  );
  assert.equal(
    (await call("shipments/" + s.id + "/photos")).data.items.length,
    0,
  );
  assert.equal(
    (
      await db.query("SELECT purged_at FROM shipment_photos WHERE id=$1", [
        p.id,
      ])
    ).rows[0].purged_at,
    null,
  );
});
