import {
  fail,
  one,
  rows,
  insert,
  patch,
  stamp,
  hex,
  token,
  statuses,
  modes,
  currencies,
  categories,
  text,
  choice,
  number,
  bool,
  date,
  aware,
  money,
  integer,
  shipment,
  reference,
  audit,
  response,
} from "./core.mjs";
import { ensureProgress, afterStatus } from "./payments.mjs";
export const extras = [
  "category",
  "contents_description",
  "shipping_charge",
  "charge_currency",
  "payment_method",
  "estimated_arrival_at",
  "route_origin_label",
  "route_destination_label",
  "route_origin_lat",
  "route_origin_lon",
  "route_destination_lat",
  "route_destination_lon",
  "route_public",
];
export function shipmentInput(d) {
  const v = {
    recipient: text(d.recipient, 120, 2),
    recipient_email: text(d.recipient_email ?? "", 254),
    origin: text(d.origin, 300, 2),
    origin_country: text(d.origin_country, 80, 2),
    destination: text(d.destination, 300, 2),
    destination_country: text(d.destination_country, 80, 2),
    weight: number(d.weight, Number.MIN_VALUE, 1000000),
    mode: choice(d.mode, modes),
    source: choice(d.source ?? "own_network", ["own_network", "partner"]),
    carrier: d.carrier ?? null,
    external_tracking: d.external_tracking ?? null,
    estimated_delivery: date(d.estimated_delivery),
    category: choice(d.category ?? "parcel", categories),
    contents_description: text(d.contents_description ?? "", 1000),
    shipping_charge:
      d.shipping_charge == null ? null : money(d.shipping_charge),
    charge_currency: choice(
      (d.charge_currency ?? "USD").toUpperCase(),
      currencies,
    ),
    payment_method: choice(d.payment_method ?? "not_set", [
      "not_set",
      "bank_transfer",
      "cash",
      "card",
      "other",
    ]),
    estimated_arrival_at: aware(d.estimated_arrival_at),
    route_public: bool(d.route_public ?? false),
  };
  if (v.source === "partner") {
    v.carrier = text(v.carrier, 80, 1, true);
    v.external_tracking = text(v.external_tracking, 100, 1, true);
  } else {
    v.carrier = null;
    v.external_tracking = null;
  }
  if (
    v.charge_currency === "JPY" &&
    v.shipping_charge &&
    !v.shipping_charge.endsWith(".00")
  )
    fail(422, "JPY charges require whole yen");
  for (const end of ["origin", "destination"]) {
    v["route_" + end + "_label"] = text(
      d["route_" + end + "_label"] ?? "",
      160,
    );
    for (const [axis, limit] of [
      ["lat", 90],
      ["lon", 180],
    ])
      v["route_" + end + "_" + axis] =
        d["route_" + end + "_" + axis] == null
          ? null
          : number(d["route_" + end + "_" + axis], -limit, limit);
    if (
      (v["route_" + end + "_lat"] === null) !==
      (v["route_" + end + "_lon"] === null)
    )
      fail(422, "Provide both coordinates for each endpoint");
  }
  if (
    v.route_public &&
    (v.route_origin_lat === null ||
      v.route_destination_lat === null ||
      v.route_origin_label.trim().length < 2 ||
      v.route_destination_label.trim().length < 2)
  )
    fail(
      422,
      "Published endpoints require both pins and meaningful public labels",
    );
  return v;
}
export function eventInput(d) {
  const v = {
    status: choice(d.status, statuses),
    location: text(d.location ?? "", 160),
    public_note: text(d.public_note ?? "", 500),
    map_public: bool(d.map_public ?? false),
    latitude: d.latitude == null ? null : number(d.latitude, -90, 90),
    longitude: d.longitude == null ? null : number(d.longitude, -180, 180),
  };
  if (
    (v.latitude === null) !== (v.longitude === null) ||
    (v.map_public && v.latitude === null)
  )
    fail(422, "A map pin requires both coordinates");
  return v;
}
export async function addEvent(q, s, d, actor, action = "tracking_event") {
  if (["delivered", "cancelled"].includes(s.status))
    fail(
      409,
      "This shipment is closed. Its delivery history cannot be overwritten.",
    );
  await ensureProgress(q, s, d.status);
  const time = await stamp(q);
  await patch(q, "shipments", s.id, { status: d.status, updated_at: time });
  await afterStatus(q, s, d.status, actor);
  const e = await insert(q, "events", {
    ...d,
    shipment_id: s.id,
    actor_id: actor,
    created_at: time,
  });
  await audit(q, s.id, actor, action, d);
  return e;
}
export function routeExtras(s, pub) {
  return {
    estimated_arrival_at: s.estimated_arrival_at,
    estimated_delivery: s.estimated_delivery,
    route_plan:
      (!pub || s.route_public) &&
      s.route_origin_lat !== null &&
      s.route_destination_lat !== null
        ? {
            origin: {
              latitude: s.route_origin_lat,
              longitude: s.route_origin_lon,
              label: s.route_origin_label || "Origin",
            },
            destination: {
              latitude: s.route_destination_lat,
              longitude: s.route_destination_lon,
              label: s.route_destination_label || "Destination",
            },
            public: s.route_public,
          }
        : null,
  };
}
export async function routeData(q, s, pub = false) {
  const events = await rows(
    q,
    "SELECT * FROM events WHERE shipment_id=$1 ORDER BY id",
    [s.id],
  );
  const mapped = (e) =>
    e.latitude !== null && e.longitude !== null && (!pub || e.map_public);
  const points = events
    .filter(mapped)
    .map((e) => ({
      ...(pub ? {} : { event_id: e.id, map_public: e.map_public }),
      latitude: e.latitude,
      longitude: e.longitude,
      location: e.location,
      status: e.status,
      created_at: e.created_at,
    }));
  return {
    shipment_id: s.id,
    status: s.status,
    mode: s.mode,
    points,
    event_count: events.length,
    unmapped_count: events.length - points.length,
    latest_event_mapped: Boolean(events.length && mapped(events.at(-1))),
    ...(!pub ? { updated_at: s.updated_at } : {}),
    source: pub ? "admin_approved_milestones" : "admin_recorded_milestones",
    live: false,
    ...routeExtras(s, pub),
  };
}
export async function shippingRoute(q, req, p, d, user, url) {
  const method = req.method;
  if (p[0] === "track" && p.length >= 2) {
    const s = await reference(q, p[1]);
    if (method === "GET" && p.length === 3 && p[2] === "route")
      return response(await routeData(q, s, true));
    if (method === "GET" && p.length === 2) {
      const events = await rows(
        q,
        "SELECT status,location,public_note,created_at FROM events WHERE shipment_id=$1 ORDER BY id",
        [s.id],
      );
      const v = Object.fromEntries(
        [
          "id",
          "estimated_arrival_at",
          "category",
          "status",
          "mode",
          "source",
          "origin_country",
          "destination_country",
          "carrier",
          "estimated_delivery",
          "updated_at",
        ].map((k) => [k, s[k]]),
      );
      return response({
        ...v,
        carrier_connected: false,
        tracking_source: "Relay operations — manually updated by admins",
        events,
      });
    }
    return null;
  }
  if (p[0] !== "shipments") return null;
  if (p.length === 1 && method === "GET") {
    const limit = integer(url.searchParams.get("limit") ?? 500, 1, 500),
      offset = integer(url.searchParams.get("offset") ?? 0, 0, 10000000);
    return response(
      await rows(
        q,
        "SELECT * FROM shipments ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        [limit, offset],
      ),
    );
  }
  if (p.length === 1 && method === "POST") {
    const input = shipmentInput(d),
      time = await stamp(q);
    const s = await insert(q, "shipments", {
      ...input,
      id: "RLY-" + hex(10).toUpperCase(),
      tracking_token: token(24),
      created_by: user.id,
      status: "booked",
      created_at: time,
      updated_at: time,
    });
    await insert(q, "events", {
      shipment_id: s.id,
      status: "booked",
      location: input.origin_country,
      public_note: "Shipment registered with Relay",
      actor_id: user.id,
      created_at: time,
      map_public: false,
    });
    await audit(q, s.id, user.id, "created", {
      mode: s.mode,
      source: s.source,
    });
    return response(s, 201);
  }
  if (p.length < 2) return null;
  const sid = p[1];
  if (p.length === 2 && method === "GET") {
    const s = await shipment(q, sid);
    return response({
      ...s,
      events: await rows(
        q,
        "SELECT * FROM events WHERE shipment_id=$1 ORDER BY id",
        [sid],
      ),
    });
  }
  if (p.length === 2 && method === "PUT") {
    const s = await shipment(q, sid, true),
      v = shipmentInput(d);
    for (const key of extras) if (!Object.hasOwn(d, key)) delete v[key];
    const changes = {};
    for (const [k, value] of Object.entries(v))
      if (String(s[k]) !== String(value))
        changes[k] = { from: s[k], to: value };
    if (!Object.keys(changes).length) return response(s);
    const result = await patch(q, "shipments", sid, {
      ...v,
      updated_at: await stamp(q),
    });
    await audit(q, sid, user.id, "edited", changes);
    return response(result);
  }
  if (p[2] === "events" && p.length === 3 && method === "POST")
    return response(
      await addEvent(q, await shipment(q, sid, true), eventInput(d), user.id),
      201,
    );
  if (p[2] === "route" && p.length === 3 && method === "GET")
    return response(await routeData(q, await shipment(q, sid)));
  if (p[2] === "audit" && p.length === 3 && method === "GET") {
    await shipment(q, sid);
    const limit = integer(url.searchParams.get("limit") ?? 50, 1, 100),
      offset = integer(url.searchParams.get("offset") ?? 0, 0, 10000000);
    return response(
      await rows(
        q,
        "SELECT a.*,u.name AS actor_name FROM audit_log a JOIN users u ON u.id=a.actor_id WHERE shipment_id=$1 ORDER BY a.id DESC LIMIT $2 OFFSET $3",
        [sid, limit, offset],
      ),
    );
  }
  if (
    p[2] === "events" &&
    p[4] === "map-visibility" &&
    p.length === 5 &&
    method === "PUT"
  ) {
    await shipment(q, sid, true);
    const e = await one(
      q,
      "SELECT * FROM events WHERE id=$1 AND shipment_id=$2 FOR UPDATE",
      [integer(p[3], 1, 2147483647), sid],
    );
    if (!e) fail(404, "Milestone not found");
    if (e.latitude === null || e.longitude === null)
      fail(409, "Milestone has no recorded coordinates");
    bool(d.map_public);
    bool(d.expected_public);
    if (d.confirmation !== (d.map_public ? "PUBLISH" : "HIDE"))
      fail(422, "Confirm the visibility decision");
    if (e.map_public !== d.expected_public)
      fail(409, "Map visibility changed. Refresh before reviewing.");
    if (e.map_public !== d.map_public) {
      await patch(q, "events", e.id, { map_public: d.map_public });
      await patch(q, "shipments", sid, { updated_at: await stamp(q) });
      await audit(q, sid, user.id, "map_visibility", {
        event_id: e.id,
        map_public: d.map_public,
      });
    }
    return response({ event_id: e.id, map_public: d.map_public });
  }
  return null;
}
