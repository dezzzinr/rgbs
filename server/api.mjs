import {
  HttpError,
  fail,
  configured,
  modes,
  tx,
  one,
  insert,
  text,
  token,
  sha,
  verifyPassword,
  admin,
  safeUser,
  response,
  readJson,
  bounded,
} from "./core.mjs";
import { shippingRoute } from "./shipping.mjs";
import { paymentsRoute } from "./payments.mjs";
import { photosRoute, storageConfigured } from "./photos.mjs";
import { operationsRoute } from "./operations.mjs";
import { quotesRoute, quoteConfig } from "./quotes.mjs";
const changing = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export function publicConfig() {
  const email = process.env.RELAY_SUPPORT_EMAIL?.trim() || "";
  return {
    database_configured: configured(),
    demo_available:
      !configured() &&
      process.env.RELAY_DEMO_MODE === "true" &&
      !process.env.VERCEL,
    admin_only: true,
    modes,
    carrier_connected: false,
    support_email:
      email.length <= 254 &&
      /^[A-Za-z0-9.!#$%&*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(
        email,
      )
        ? email
        : null,
  };
}
export function features() {
  const token = process.env.RELAY_MAPBOX_PUBLIC_TOKEN?.trim() || "",
    style = process.env.RELAY_MAPBOX_STYLE?.trim() || "";
  return {
    mapbox_public_token: /^pk\.[A-Za-z0-9._-]+$/.test(token) ? token : "",
    mapbox_style: /^mapbox:\/\/styles\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(
      style,
    )
      ? style
      : "mapbox://styles/mapbox/streets-v12",
    photos_configured: storageConfigured(),
    photo_limit: 8,
    photo_max_bytes: 2 * 1024 * 1024,
  };
}
const sessionCookie = (value, age) =>
  `relay_session=${value}; Path=/; Max-Age=${age}; HttpOnly; SameSite=Lax${(process.env.RELAY_SECURE_COOKIES ?? "true").toLowerCase() === "true" ? "; Secure" : ""}`;
export async function handle(req) {
  const ctx = { after: [], rollback: [] };
  let result;
  try {
    const url = new URL(req.url),
      p = url.pathname
        .replace(/^\/api\/?/, "")
        .split("/")
        .filter(Boolean)
        .map(decodeURIComponent),
      path = p.join("/");
    if (changing.has(req.method) && req.headers.get("x-relay-client") !== "web")
      fail(403, "Missing client header");
    if (req.method === "GET") {
      if (path === "health")
        return decorate(
          response({
            status: "ok",
            database_configured: configured(),
            version: "1.4.0",
            runtime: "nodejs",
            schema: "007",
          }),
        );
      if (path === "config") return decorate(response(publicConfig()));
      if (path === "features") return decorate(response(features()));
      if (path === "site-tools") {
        let key = process.env.RELAY_SMARTSUPP_KEY?.trim() || "";
        if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) key = "";
        return decorate(
          response({
            smartsupp_key: key,
            smartsupp_admin_enabled:
              (
                process.env.RELAY_SMARTSUPP_ADMIN_ENABLED ?? "true"
              ).toLowerCase() === "true",
          }),
        );
      }
      if (path === "quote-config") return decorate(response(quoteConfig()));
    }
    if (path === "auth/register" && req.method === "POST")
      fail(
        403,
        "Public registration is disabled. Shipments are created and managed only by administrators.",
      );
    const isUpload =
      p[0] === "shipments" &&
      p[2] === "photos" &&
      p.length === 3 &&
      req.method === "POST";
    let body = {};
    if (changing.has(req.method)) {
      if (isUpload) {
        const bytes = await bounded(req, 3 * 1024 * 1024);
        try {
          body = await new Request(req.url, {
            method: "POST",
            headers: req.headers,
            body: bytes,
          }).formData();
        } catch {
          fail(422, "Invalid multipart form");
        }
      } else body = await readJson(req);
    }
    result = await tx(async (q) => {
      if (path === "auth/login" && req.method === "POST") {
        const email = text(body.email, 254, 5).trim().toLowerCase(),
          password = text(body.password, 128, 12);
        const user = await one(q, "SELECT * FROM users WHERE email=$1", [
          email,
        ]);
        const ok = await verifyPassword(password, user?.password);
        if (!user || !ok || user.role !== "admin")
          fail(401, "Invalid administrator credentials");
        const raw = token(48),
          expiry = new Date(Date.now() + 43200000).toISOString();
        await q.query(
          "DELETE FROM sessions WHERE expires::timestamptz<=CURRENT_TIMESTAMP",
        );
        await insert(q, "sessions", {
          token_hash: sha(raw),
          user_id: user.id,
          expires: expiry,
        });
        return response(safeUser(user), 200, {
          "Set-Cookie": sessionCookie(raw, 43200),
        });
      }
      if (path === "auth/logout" && req.method === "POST") {
        const raw =
          (req.headers.get("cookie") || "").match(
            /(?:^|;\s*)relay_session=([^;]*)/,
          )?.[1] || "";
        await q.query("DELETE FROM sessions WHERE token_hash=$1", [sha(raw)]);
        return response(null, 204, { "Set-Cookie": sessionCookie("", 0) });
      }
      const privateRoute =
        ["shipments", "operations", "admin", "integrations"].includes(p[0]) ||
        path === "auth/me";
      const user = privateRoute ? await admin(q, req) : null;
      if (path === "auth/me" && req.method === "GET")
        return response(safeUser(user));
      if (path === "integrations" && req.method === "GET")
        return response({
          fedex: {
            connected: false,
            message:
              "Optional future carrier adapter. Manual administrator tracking is available for all modes.",
          },
        });
      for (const fn of [quotesRoute, operationsRoute, paymentsRoute]) {
        const out = await fn(q, req, p, body, user, url);
        if (out) return out;
      }
      const photo = await photosRoute(q, req, p, body, user, ctx);
      if (photo) return photo;
      const shipping = await shippingRoute(q, req, p, body, user, url);
      if (shipping) return shipping;
      fail(404, "API endpoint not found");
    });
    for (const callback of ctx.after) await callback();
    if (ctx.finalBody) result = response(ctx.finalBody, result.status);
  } catch (e) {
    for (const undo of ctx.rollback) await undo().catch(() => {});
    if (e instanceof HttpError)
      result = response({ detail: e.detail }, e.status, e.headers);
    else {
      console.error("Relay API failure:", e.name, e.code || "");
      result = response(
        {
          detail:
            "Database or service unavailable, or migrations pending. Contact the administrator.",
        },
        503,
      );
    }
  }
  return decorate(result);
}
function decorate(res) {
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
