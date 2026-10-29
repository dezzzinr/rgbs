import {
  fail,
  rows,
  one,
  insert,
  patch,
  stamp,
  sha,
  pythonJson,
  uuid,
  text,
  choice,
  integer,
  date,
  statuses,
  modes,
  audit,
  response,
} from "./core.mjs";
import { ensureProgress, afterStatus } from "./payments.mjs";
const pay = `EXISTS(SELECT 1 FROM payment_requests p WHERE p.shipment_id=s.id AND p.activated_at IS NOT NULL AND (p.status='submitted' OR (p.blocks_progress=true AND p.status='requested')))`;
const today = () => new Date().toISOString().slice(0, 10);
const overdue = (day) =>
  `(s.status NOT IN ('delivered','cancelled') AND s.estimated_delivery IS NOT NULL AND s.estimated_delivery < ${day})`;
function filters(url) {
  const u = url.searchParams,
    values = [],
    clauses = [];
  const param = (v) => {
    values.push(v);
    return "$" + values.length;
  };
  const like = (v) => "%" + v.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
  const q = text(u.get("q") || "", 120, 0, true);
  if (q) {
    const p = param(like(q));
    clauses.push(
      "(" +
        [
          "id",
          "recipient",
          "recipient_email",
          "origin",
          "origin_country",
          "destination",
          "destination_country",
          "carrier",
          "external_tracking",
        ]
          .map((k) => `s.${k} ILIKE ${p} ESCAPE '\\'`)
          .join(" OR ") +
        ")",
    );
  }
  for (const [key, allowed] of [
    ["status", statuses],
    ["mode", modes],
    ["source", ["own_network", "partner"]],
  ]) {
    const v = u.get(key);
    if (v) clauses.push("s." + key + "=" + param(choice(v, allowed)));
  }
  for (const [key, column] of [
    ["origin", "origin_country"],
    ["destination", "destination_country"],
  ]) {
    const v = text(u.get(key) || "", 80, 0, true);
    if (v) clauses.push(`s.${column} ILIKE ${param(like(v))} ESCAPE '\\'`);
  }
  const from = date(u.get("eta_from")),
    to = date(u.get("eta_to"));
  if (from && to && from > to)
    fail(422, "Arrival date from must not be after arrival date to");
  if (from) clauses.push("s.estimated_delivery>=" + param(from));
  if (to) clauses.push("s.estimated_delivery<=" + param(to));
  const attention = u.get("attention");
  if (attention) {
    choice(attention, ["all", "overdue", "customs", "on_hold", "payments"]);
    const ov = ["all", "overdue"].includes(attention)
      ? overdue(param(today()))
      : "false";
    clauses.push(
      {
        all: `(${ov} OR s.status IN ('customs_clearance','on_hold') OR ${pay})`,
        overdue: ov,
        customs: `s.status='customs_clearance'`,
        on_hold: `s.status='on_hold'`,
        payments: pay,
      }[attention],
    );
  }
  const sort = choice(u.get("sort") || "newest", [
    "newest",
    "oldest",
    "updated",
    "eta_soon",
    "eta_latest",
  ]);
  return {
    where: clauses.length ? "WHERE " + clauses.join(" AND ") : "",
    values,
    order: {
      newest: "s.created_at DESC,s.id DESC",
      oldest: "s.created_at,s.id",
      updated: "s.updated_at DESC,s.id DESC",
      eta_soon: "s.estimated_delivery ASC NULLS LAST,s.id",
      eta_latest: "s.estimated_delivery DESC NULLS LAST,s.id",
    }[sort],
  };
}
export async function operationsRoute(q, req, p, d, user, url) {
  if (p[0] !== "operations") return null;
  const time = today();
  if (req.method === "GET" && p[1] === "summary") {
    const ov = overdue("$1"),
      counts = {
        total: "true",
        active: `s.status NOT IN ('booked','delivered','cancelled','on_hold')`,
        delivered: `s.status='delivered'`,
        attention: `(${ov} OR s.status IN ('customs_clearance','on_hold') OR ${pay})`,
        overdue: ov,
        customs: `s.status='customs_clearance'`,
        on_hold: `s.status='on_hold'`,
        payments: pay,
      };
    const result = await one(
      q,
      "SELECT " +
        Object.entries(counts)
          .map(([k, v]) => `count(*) FILTER(WHERE ${v})::int AS ${k}`)
          .join(",") +
        " FROM shipments s",
      [time],
    );
    return response({ ...result, as_of_date: time, date_basis: "UTC" });
  }
  if (req.method === "GET" && ["shipments", "export"].includes(p[1])) {
    const f = filters(url);
    const total = Number(
      (
        await one(
          q,
          "SELECT count(*) AS n FROM shipments s " + f.where,
          f.values,
        )
      ).n,
    );
    if (p[1] === "export") {
      if (total > 10000)
        fail(
          413,
          "More than 10,000 shipments match. Narrow your filters before exporting.",
        );
      const list = await rows(
        q,
        `SELECT s.* FROM shipments s ${f.where} ORDER BY ${f.order} LIMIT 10001`,
        f.values,
      );
      if (list.length > 10000)
        fail(
          413,
          "The result grew beyond 10,000 shipments. Narrow your filters.",
        );
      const cell = (v) => {
        let s = String(v ?? "");
        if (/^[=+\-@]/.test(s.trimStart()) || /^[\t\r\n]/.test(s)) s = "'" + s;
        return '"' + s.replaceAll('"', '""') + '"';
      };
      const fields = [
        "id",
        "recipient",
        "recipient_email",
        "origin",
        "origin_country",
        "destination",
        "destination_country",
        "mode",
        "weight",
        "status",
        "estimated_delivery",
      ];
      const header = [
        "Tracking ID",
        "Recipient",
        "Email",
        "Origin",
        "Origin country",
        "Destination",
        "Destination country",
        "Method",
        "Weight kg",
        "Status",
        "Estimated delivery",
      ];
      const csv =
        "\ufeff" +
        [header, ...list.map((s) => fields.map((k) => s[k]))]
          .map((r) => r.map(cell).join(","))
          .join("\r\n") +
        "\r\n";
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="relay-filtered-shipments.csv"',
        },
      });
    }
    const limit = integer(url.searchParams.get("limit") ?? 25, 1, 100),
      offset = integer(url.searchParams.get("offset") ?? 0, 0, 10000000);
    const list = await rows(
      q,
      `SELECT s.*,${pay} AS needs_payment FROM shipments s ${f.where} ORDER BY ${f.order} LIMIT $${f.values.length + 1} OFFSET $${f.values.length + 2}`,
      [...f.values, limit, offset],
    );
    const items = list.map((s) => {
      const reasons = [];
      if (
        !["delivered", "cancelled"].includes(s.status) &&
        s.estimated_delivery &&
        s.estimated_delivery < time
      )
        reasons.push("overdue");
      if (s.status === "customs_clearance") reasons.push("customs");
      if (s.status === "on_hold") reasons.push("on_hold");
      if (s.needs_payment) reasons.push("payments");
      delete s.needs_payment;
      return { ...s, attention_reasons: reasons };
    });
    return response({
      items,
      total,
      limit,
      offset,
      as_of_date: time,
      date_basis: "UTC",
    });
  }
  if (req.method === "POST" && p[1] === "bulk-events") {
    const id = uuid(d.request_id),
      status = choice(d.status, statuses),
      location = text(d.location ?? "", 160),
      note = text(d.public_note, 500, 5, true),
      confirmation = text(d.confirmation, 40, 1);
    if (!Array.isArray(d.items) || d.items.length < 1 || d.items.length > 50)
      fail(422, "Select 1–50 shipments");
    const items = d.items.map((i) => ({
      id: text(i.id, 40, 5),
      expected_updated_at: text(i.expected_updated_at, 40, 10),
    }));
    if (new Set(items.map((i) => i.id)).size !== items.length)
      fail(422, "Shipment references must be unique");
    const verb =
      { delivered: "DELIVER", cancelled: "CANCEL" }[status] || "PUBLISH";
    if (confirmation !== verb + " " + items.length)
      fail(
        422,
        "Type " +
          verb +
          " " +
          items.length +
          " to confirm the exact batch size",
      );
    items.sort((a, b) => a.id.localeCompare(b.id, "en"));
    const digest = sha(
      pythonJson({ items, status, location, public_note: note, confirmation }),
    );
    const reserved = await one(
      q,
      "INSERT INTO bulk_operations(id,actor_id,body_hash,result,created_at) VALUES($1,$2,$3,NULL,$4) ON CONFLICT(id) DO NOTHING RETURNING id",
      [id, user.id, digest, await stamp(q)],
    );
    if (!reserved) {
      const old = await one(q, "SELECT * FROM bulk_operations WHERE id=$1", [
        id,
      ]);
      if (!old || old.actor_id !== user.id || old.body_hash !== digest)
        fail(
          409,
          "This operation reference was already used for a different request. Refresh and review again.",
        );
      if (!old.result)
        fail(
          409,
          "The operation is still pending. Retry the same request shortly.",
        );
      return response({ ...JSON.parse(old.result), replayed: true });
    }
    const list = await rows(
      q,
      "SELECT * FROM shipments WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE",
      [items.map((i) => i.id)],
    );
    if (list.length !== items.length)
      fail(409, "A selected shipment no longer exists. Nothing was updated.");
    const conflicts = list.filter(
      (s) =>
        ["delivered", "cancelled"].includes(s.status) ||
        s.updated_at !== items.find((i) => i.id === s.id).expected_updated_at,
    );
    if (conflicts.length)
      fail(409, {
        message:
          "Selected shipments changed or are closed. Nothing was updated. Refresh and review again.",
        shipment_ids: conflicts.map((s) => s.id),
      });
    for (const s of list) await ensureProgress(q, s, status);
    const timestamp = await stamp(q);
    for (const s of list) {
      await patch(q, "shipments", s.id, { status, updated_at: timestamp });
      await afterStatus(q, s, status, user.id);
      await insert(q, "events", {
        shipment_id: s.id,
        status,
        location: location.trim(),
        public_note: note,
        actor_id: user.id,
        created_at: timestamp,
        map_public: false,
      });
      await audit(q, s.id, user.id, "bulk_tracking_event", {
        bulk_operation_id: id,
        status,
        location: location.trim(),
        public_note: note,
      });
    }
    const result = {
      operation_id: id,
      updated: list.length,
      shipment_ids: list.map((s) => s.id),
      status,
      updated_at: timestamp,
    };
    await patch(q, "bulk_operations", id, { result: JSON.stringify(result) });
    return response({ ...result, replayed: false });
  }
  return null;
}
