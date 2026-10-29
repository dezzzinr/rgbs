import crypto from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";
import Decimal from "decimal.js";
export class HttpError extends Error {
  constructor(status, detail, headers = {}) {
    super(typeof detail === "string" ? detail : "Request conflict");
    this.status = status;
    this.detail = detail;
    this.headers = headers;
  }
}
export const fail = (status, message, headers) => {
  throw new HttpError(status, message, headers);
};
export const hex = (n) => crypto.randomBytes(n).toString("hex"),
  token = (n) => crypto.randomBytes(n).toString("base64url");
export const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
export const configured = () => Boolean(process.env.DATABASE_URL?.trim());
let testAdapter;
export function setTestAdapter(adapter) {
  if (process.env.NODE_ENV !== "test")
    throw Error("Test adapter requires NODE_ENV=test");
  testAdapter = adapter;
}
export function databaseUrl(value) {
  if (!value)
    fail(
      503,
      "Neon is not connected. Set DATABASE_URL and verify database migration 007.",
    );
  const result = value
    .trim()
    .replace(/^postgresql\+psycopg:\/\//, "postgresql://");
  let url;
  try {
    url = new URL(result);
  } catch {
    fail(503, "Invalid database configuration");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname)
    fail(503, "Use a PostgreSQL database URL");
  return result;
}
export function pool() {
  if (!globalThis.__relayPool) {
    globalThis.__relayPool = new pg.Pool({
      connectionString: databaseUrl(process.env.DATABASE_URL),
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 8000,
    });
    globalThis.__relayPool.on("error", () =>
      console.error("Database pool connection failed"),
    );
  }
  return globalThis.__relayPool;
}
export async function tx(fn) {
  if (testAdapter) return testAdapter.transaction(fn);
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const output = await fn(c);
    await c.query("COMMIT");
    return output;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
export const rows = async (q, sql, values = []) =>
  (await q.query(sql, values)).rows;
export const one = async (q, sql, values = []) =>
  (await rows(q, sql, values))[0];
export async function stamp(q) {
  return (
    await one(
      q,
      `SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')||'+00:00' AS value`,
    )
  ).value;
}
export function now() {
  return new Date()
    .toISOString()
    .replace(/(\.\d{3})Z$/, (_, p) => p + "000+00:00");
}
export async function insert(q, table, values) {
  const keys = Object.keys(values);
  return one(
    q,
    `INSERT INTO ${table} (${keys.map((k) => '"' + k + '"').join(",")}) VALUES (${keys.map((_, i) => "$" + (i + 1)).join(",")}) RETURNING *`,
    Object.values(values),
  );
}
export async function patch(q, table, id, values) {
  const keys = Object.keys(values);
  if (!keys.length) return one(q, `SELECT * FROM ${table} WHERE id=$1`, [id]);
  return one(
    q,
    `UPDATE ${table} SET ${keys.map((k, i) => '"' + k + '"=$' + (i + 1)).join(",")} WHERE id=$${keys.length + 1} RETURNING *`,
    [...Object.values(values), id],
  );
}
// Internal table/column names only. No request data is ever used as an SQL identifier.
export const statuses = [
  "booked",
  "picked_up",
  "at_origin",
  "in_transit",
  "customs_clearance",
  "out_for_delivery",
  "delivered",
  "on_hold",
  "cancelled",
];
export const modes = ["land", "sea", "air", "multimodal"];
export const currencies = [
  "USD",
  "GBP",
  "EUR",
  "NGN",
  "CAD",
  "AUD",
  "AED",
  "CNY",
  "JPY",
  "CHF",
  "ZAR",
  "SGD",
  "GHS",
  "KES",
];
export const categories = [
  "documents",
  "parcel",
  "pallet",
  "container",
  "freight",
  "other",
];
export function text(value, max, min = 0, trim = false) {
  if (typeof value !== "string") fail(422, "Expected text");
  const v = trim ? value.trim() : value;
  if (v.length < min || v.length > max)
    fail(422, `Text must contain ${min}–${max} characters`);
  return v;
}
export function choice(value, values) {
  if (!values.includes(value)) fail(422, "Unsupported option");
  return value;
}
export function number(v, min, max) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    fail(422, "Invalid numeric value");
  return v;
}
export function bool(v) {
  if (typeof v !== "boolean") fail(422, "Expected true or false");
  return v;
}
export function integer(v, min, max) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max)
    fail(422, "Invalid pagination or version");
  return n;
}
export function date(v) {
  if (v === null || v === undefined || v === "") return null;
  if (
    typeof v !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v + "T00:00:00Z")) ||
    new Date(v + "T00:00:00Z").toISOString().slice(0, 10) !== v
  )
    fail(422, "Invalid date");
  return v;
}
export function aware(v) {
  if (v === null || v === undefined) return null;
  text(v, 40, 10);
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(v) || !Number.isFinite(Date.parse(v)))
    fail(422, "Arrival estimate requires an explicit timezone");
  return v;
}
export function money(v, dp = 2, positive = false) {
  let d;
  try {
    if (typeof v !== "number" && typeof v !== "string") throw Error();
    d = new Decimal(v);
    if (
      !d.isFinite() ||
      d.isNegative() ||
      (positive && d.isZero()) ||
      d.gt("999999999999.99") ||
      d.decimalPlaces() > dp
    )
      throw Error();
  } catch {
    fail(422, "Invalid amount or decimal precision");
  }
  return d.toFixed(dp);
}
export function uuid(v) {
  if (
    typeof v !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  )
    fail(422, "Invalid request identifier");
  return v.toLowerCase();
}
export function strict(data, fields) {
  if (Object.keys(data).some((k) => !fields.includes(k)))
    fail(422, "Unexpected request field");
}
export function pythonJson(value, compact = true) {
  function encode(v) {
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v))
      return "[" + v.map(encode).join(compact ? "," : ", ") + "]";
    return (
      "{" +
      Object.keys(v)
        .sort()
        .map((k) => JSON.stringify(k) + (compact ? ":" : ": ") + encode(v[k]))
        .join(compact ? "," : ", ") +
      "}"
    );
  }
  return encode(value).replace(
    /[\u007f-\uffff]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}
const scrypt = promisify(crypto.scrypt);
export async function hashPassword(password, salt = hex(16)) {
  const hash = await scrypt(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return salt + ":" + hash.toString("hex");
}
export async function verifyPassword(password, stored) {
  const valid = /^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(stored || "");
  const input = valid ? stored : "0".repeat(32) + ":" + "0".repeat(128);
  const generated = await hashPassword(password, input.split(":")[0]);
  return (
    crypto.timingSafeEqual(
      Buffer.from(generated.split(":")[1], "hex"),
      Buffer.from(input.split(":")[1], "hex"),
    ) && valid
  );
}
export async function admin(q, req) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)relay_session=([^;]*)/);
  let raw = "";
  try {
    raw = decodeURIComponent(match?.[1] || "");
  } catch {}
  const s = await one(q, "SELECT * FROM sessions WHERE token_hash=$1", [
    sha(raw),
  ]);
  if (
    !s ||
    !Number.isFinite(Date.parse(s.expires)) ||
    Date.parse(s.expires) <= Date.now()
  )
    fail(401, "Administrator sign-in required");
  const u = await one(q, "SELECT * FROM users WHERE id=$1", [s.user_id]);
  if (u?.role !== "admin") fail(403, "Administrator access required");
  return u;
}
export const safeUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
});
export async function shipment(q, id, lock = false) {
  const s = await one(
    q,
    "SELECT * FROM shipments WHERE id=$1" + (lock ? " FOR UPDATE" : ""),
    [id],
  );
  if (!s) fail(404, "Shipment not found");
  return s;
}
export async function reference(q, ref, lock = false) {
  if (ref.length > 100) fail(404, "Shipment not found");
  const s = await one(
    q,
    "SELECT * FROM shipments WHERE tracking_token=$1 OR id=$2" +
      (lock ? " FOR UPDATE" : ""),
    [ref, ref.toUpperCase()],
  );
  if (!s) fail(404, "Shipment not found. Check your tracking number.");
  return s;
}
export async function audit(q, sid, actor, action, changes) {
  return insert(q, "audit_log", {
    shipment_id: sid,
    actor_id: actor,
    action,
    changes: JSON.stringify(changes),
    created_at: await stamp(q),
  });
}
export const response = (body, status = 200, headers = {}) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
export async function readJson(req, max = 24000) {
  const body = await bounded(req, max);
  if (!body.length) return {};
  try {
    const out = JSON.parse(body.toString());
    if (!out || typeof out !== "object" || Array.isArray(out)) throw Error();
    return out;
  } catch {
    fail(422, "Invalid JSON request");
  }
}
export async function bounded(req, max) {
  const length = Number(req.headers.get("content-length"));
  if (length > max) fail(413, "Request too large");
  const reader = req.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  let size = 0;
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      fail(413, "Request too large");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}
