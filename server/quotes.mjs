import crypto from "node:crypto";
import Decimal from "decimal.js";
import {
  configured,
  fail,
  one,
  rows,
  insert,
  stamp,
  hex,
  sha,
  pythonJson,
  uuid,
  text,
  choice,
  bool,
  money,
  categories,
  modes,
  currencies,
  integer,
  strict,
  response,
} from "./core.mjs";
const quoteCurrencies = [...currencies, "INR", "BRL"];
export const devQuotes = () =>
  process.env.RELAY_ALLOW_UNVERIFIED_QUOTES === "true" && !process.env.VERCEL;
export const protectedQuotes = () =>
  Boolean(
    process.env.RELAY_TURNSTILE_SITE_KEY?.trim() &&
    process.env.RELAY_TURNSTILE_SECRET?.trim(),
  );
export function quoteConfig() {
  const key = process.env.RELAY_TURNSTILE_SITE_KEY?.trim() || "",
    valid = /^[A-Za-z0-9_-]{1,100}$/.test(key);
  return {
    accepting_requests:
      configured() &&
      ((protectedQuotes() &&
        valid &&
        Boolean(process.env.RELAY_TURNSTILE_HOSTNAMES?.trim())) ||
        devQuotes()),
    turnstile_site_key: valid && protectedQuotes() ? key : "",
  };
}
export async function verifyChallenge(value) {
  if (devQuotes()) return;
  if (!protectedQuotes())
    fail(
      503,
      "Online quote requests are not configured. Please contact Relay support.",
    );
  if (!value) fail(422, "Complete the security check");
  let result;
  try {
    const r = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({
          secret: process.env.RELAY_TURNSTILE_SECRET,
          response: value,
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!r.ok) throw Error();
    result = await r.json();
  } catch {
    fail(503, "Security verification unavailable. Please retry.");
  }
  if (!result.success || result.action !== "quote")
    fail(422, "Security check expired or failed. Please retry.");
  const allowed = (process.env.RELAY_TURNSTILE_HOSTNAMES || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.includes(String(result.hostname || "").toLowerCase()))
    fail(503, "Quote security hostname configuration needs attention");
}
export function quoteInput(d) {
  strict(d, [
    "request_id",
    "name",
    "email",
    "phone",
    "origin",
    "destination",
    "mode",
    "category",
    "weight",
    "notes",
    "consent",
    "website",
    "turnstile_token",
  ]);
  uuid(d.request_id);
  if (!bool(d.consent))
    fail(422, "Permission to contact you about this request is required");
  if (text(d.website ?? "", 200, 0, true))
    fail(422, "Unable to accept this request");
  text(d.turnstile_token ?? "", 2048);
  const email = text(d.email, 254, 5, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fail(422, "Enter a valid email address");
  let weight;
  try {
    const value = new Decimal(d.weight);
    if (
      !value.isFinite() ||
      value.lte(0) ||
      value.gt(1000000) ||
      value.decimalPlaces() > 3
    )
      throw Error();
    const raw = String(d.weight).trim();
    weight = value.toFixed(
      raw.includes(".") && !/[eE]/.test(raw)
        ? Math.min(raw.split(".")[1].length, 3)
        : value.decimalPlaces(),
    );
  } catch {
    fail(422, "Invalid weight or decimal precision");
  }
  return {
    name: text(d.name, 120, 2, true),
    email,
    phone: text(d.phone ?? "", 40, 0, true),
    origin: text(d.origin, 160, 2, true),
    destination: text(d.destination, 160, 2, true),
    mode: choice(d.mode, modes),
    category: choice(d.category, categories),
    weight,
    notes: text(d.notes ?? "", 1500, 0, true),
  };
}
function sameLegacyQuote(record, values) {
  return Object.entries(values).every(([key, value]) =>
    key === "weight"
      ? new Decimal(record.weight).eq(value)
      : record[key] === value,
  );
}
async function rateLimit(q, req) {
  let ip = "local";
  if (process.env.VERCEL)
    ip = (
      req.headers.get("x-vercel-forwarded-for") ||
      req.headers.get("x-forwarded-for") ||
      "unknown"
    )
      .split(",")[0]
      .trim();
  else if (process.env.RELAY_TRUST_PROXY === "true")
    ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const bucket = Math.floor(Date.now() / 900000),
    secret =
      process.env.RELAY_QUOTE_RATE_SECRET ||
      process.env.RELAY_TURNSTILE_SECRET ||
      "local-development-only";
  const key = crypto
    .createHmac("sha256", secret)
    .update(ip + ":" + bucket)
    .digest("hex");
  const out = await one(
    q,
    "INSERT INTO quote_rate_limits(id,hits,expires) VALUES($1,1,$2) ON CONFLICT(id) DO UPDATE SET hits=quote_rate_limits.hits+1 RETURNING hits",
    [key, (bucket + 1) * 900],
  );
  if (out.hits > 5)
    fail(429, "Too many requests. Please try again later.", {
      "Retry-After": "900",
    });
  await q.query("DELETE FROM quote_rate_limits WHERE expires<$1", [
    Math.floor(Date.now() / 1000),
  ]);
}
export async function quotesRoute(q, req, p, d, user, url) {
  const method = req.method;
  if (p.length === 1 && p[0] === "quotes" && method === "POST") {
    const values = quoteInput(d),
      id = uuid(d.request_id),
      digest = sha(pythonJson(values, false));
    const old = await one(q, "SELECT * FROM quote_requests WHERE id=$1", [id]);
    if (old) {
      if (old.payload_hash !== digest && !sameLegacyQuote(old, values))
        fail(
          409,
          "This request identifier was already used. Start a new request.",
        );
      return response(
        { reference: old.reference, received: true, replayed: true },
        201,
      );
    }
    await verifyChallenge(d.turnstile_token || "");
    await rateLimit(q, req);
    const time = await stamp(q),
      reference = "RQ-" + hex(6).toUpperCase();
    const created = await one(
      q,
      `INSERT INTO quote_requests(id,reference,payload_hash,name,email,phone,origin,destination,mode,category,weight,notes,status,version,created_at,updated_at,admin_note,currency) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'new',1,$13,$13,'','USD') ON CONFLICT(id) DO NOTHING RETURNING id`,
      [
        id,
        reference,
        digest,
        values.name,
        values.email,
        values.phone,
        values.origin,
        values.destination,
        values.mode,
        values.category,
        values.weight,
        values.notes,
        time,
      ],
    );
    if (!created) {
      const previous = await one(
        q,
        "SELECT * FROM quote_requests WHERE id=$1",
        [id],
      );
      if (
        !previous ||
        (previous.payload_hash !== digest && !sameLegacyQuote(previous, values))
      )
        fail(409, "Request identifier conflict");
      return response(
        { reference: previous.reference, received: true, replayed: true },
        201,
      );
    }
    await insert(q, "quote_activity", {
      id: hex(12),
      quote_id: id,
      actor_id: null,
      status: "new",
      note: "Quote request received",
      created_at: time,
    });
    return response({ reference, received: true, replayed: false }, 201);
  }
  if (p[0] !== "admin" || p[1] !== "quotes") return null;
  if (method === "GET" && p.length === 2) {
    const status = url.searchParams.get("status") || "";
    if (status) choice(status, ["new", "reviewing", "quoted", "closed"]);
    const offset = integer(url.searchParams.get("offset") ?? 0, 0, 10000000),
      limit = integer(url.searchParams.get("limit") ?? 25, 1, 100);
    const condition = status ? "WHERE status=$1" : "",
      args = status ? [status] : [];
    const total = Number(
      (
        await one(
          q,
          "SELECT count(*) AS n FROM quote_requests " + condition,
          args,
        )
      ).n,
    );
    return response({
      total,
      items: await rows(
        q,
        `SELECT * FROM quote_requests ${condition} ORDER BY created_at DESC,id LIMIT $${args.length + 1} OFFSET $${args.length + 2}`,
        [...args, limit, offset],
      ),
    });
  }
  if (method === "GET" && p.length === 3) {
    const v = await one(q, "SELECT * FROM quote_requests WHERE id=$1", [p[2]]);
    if (!v) fail(404, "Request not found");
    return response({
      ...v,
      history: await rows(
        q,
        "SELECT * FROM quote_activity WHERE quote_id=$1 ORDER BY created_at,id",
        [v.id],
      ),
    });
  }
  if (method === "PUT" && p.length === 3) {
    strict(d, [
      "expected_version",
      "status",
      "admin_note",
      "amount",
      "currency",
    ]);
    const status = choice(d.status, ["new", "reviewing", "quoted", "closed"]),
      note = text(d.admin_note ?? "", 2000, 0, true),
      currency = choice(d.currency ?? "USD", quoteCurrencies),
      amount = d.amount == null ? null : money(d.amount),
      version = integer(d.expected_version, 1, 2147483647);
    if (status === "quoted" && amount === null)
      fail(422, "Record an amount before marking a request quoted");
    if (currency === "JPY" && amount && !amount.endsWith(".00"))
      fail(422, "JPY requires a whole amount");
    const time = await stamp(q);
    const out = await one(
      q,
      "UPDATE quote_requests SET status=$1,admin_note=$2,amount=$3,currency=$4,version=version+1,updated_at=$5 WHERE id=$6 AND version=$7 RETURNING version",
      [status, note, amount, currency, time, p[2], version],
    );
    if (!out)
      fail(409, "Request changed or no longer exists. Refresh before saving.");
    await insert(q, "quote_activity", {
      id: hex(12),
      quote_id: p[2],
      actor_id: user.id,
      status,
      note: JSON.stringify({ admin_note: note, amount, currency }),
      created_at: time,
    });
    return response({ saved: true, version: out.version });
  }
  return null;
}
