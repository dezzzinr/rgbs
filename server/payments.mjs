import {
  fail,
  rows,
  one,
  insert,
  patch,
  stamp,
  hex,
  text,
  choice,
  bool,
  money,
  currencies,
  statuses,
  shipment,
  reference,
  audit,
  response,
} from "./core.mjs";
export async function blocking(q, sid) {
  return Boolean(
    await one(
      q,
      `SELECT id FROM payment_requests WHERE shipment_id=$1 AND activated_at IS NOT NULL AND blocks_progress=true AND status IN ('requested','submitted') LIMIT 1`,
      [sid],
    ),
  );
}
export async function ensureProgress(q, s, next) {
  if (["on_hold", "cancelled"].includes(next) || next === s.status) return;
  if (await blocking(q, s.id))
    fail(
      409,
      "Payment verification is required before this shipment can advance. Verify or cancel the blocking payment request first.",
    );
}
export async function afterStatus(q, s, next, actor) {
  const list = await rows(
    q,
    `SELECT * FROM payment_requests WHERE shipment_id=$1 AND status IN ('requested','submitted') ORDER BY id FOR UPDATE`,
    [s.id],
  );
  for (const p of list) {
    if (next === "cancelled") {
      const time = await stamp(q);
      await patch(q, "payment_requests", p.id, {
        status: "cancelled",
        updated_at: time,
        public_message:
          "Payment request cancelled because the shipment was cancelled.",
      });
      await q.query(
        `UPDATE payment_submissions SET status='cancelled',reviewed_at=$1,reviewed_by=$2,review_note=$3 WHERE payment_id=$4 AND status='submitted'`,
        [
          time,
          actor,
          "Shipment cancelled; no automatic refund is issued.",
          p.id,
        ],
      );
      await audit(q, s.id, actor, "payment_cancelled", {
        payment_id: p.id,
        title: p.title,
        reason: "Shipment cancelled",
      });
    } else if (!p.activated_at && p.activate_at === next) {
      const time = await stamp(q);
      await patch(q, "payment_requests", p.id, {
        activated_at: time,
        updated_at: time,
      });
      await audit(q, s.id, actor, "payment_activated", {
        payment_id: p.id,
        title: p.title,
        milestone: next,
        blocks_progress: p.blocks_progress,
      });
    }
  }
}
export function publicPayment(p) {
  return {
    ...Object.fromEntries(
      [
        "id",
        "title",
        "currency",
        "payee_name",
        "bank_name",
        "account_details",
        "instructions",
        "blocks_progress",
        "activate_at",
        "activated_at",
        "status",
        "public_message",
        "created_at",
        "updated_at",
        "verified_at",
        "amount",
      ].map((k) => [k, p[k]]),
    ),
    transfer_memo: p.id,
    method: "manual_transfer",
  };
}
function createInput(d) {
  const v = {
    title: text(d.title, 120, 3, true),
    amount: money(d.amount, 2, true),
    currency: choice(text(d.currency, 3, 3).toUpperCase(), currencies),
    payee_name: text(d.payee_name, 160, 2, true),
    bank_name: text(d.bank_name, 160, 2, true),
    account_details: text(d.account_details, 500, 3, true),
    instructions: text(d.instructions, 1500, 5, true),
    blocks_progress: bool(d.blocks_progress ?? false),
    activate_at:
      d.activate_at == null
        ? null
        : choice(
            d.activate_at,
            statuses.filter((s) => s !== "cancelled"),
          ),
  };
  if (v.currency === "JPY" && !v.amount.endsWith(".00"))
    fail(422, "JPY requires whole yen");
  if (v.blocks_progress && v.activate_at === "delivered")
    fail(422, "A post-delivery request cannot block progress");
  return v;
}
export async function paymentsRoute(q, req, p, d, user) {
  const pub = p[0] === "track";
  if (!["track", "shipments"].includes(p[0]) || p[2] !== "payments")
    return null;
  const method = req.method;
  if (method === "GET" && p.length === 3) {
    const s = pub ? await reference(q, p[1]) : await shipment(q, p[1]);
    const list = await rows(
      q,
      `SELECT * FROM payment_requests WHERE shipment_id=$1 ${pub ? "AND activated_at IS NOT NULL" : ""} ORDER BY created_at DESC,id`,
      [s.id],
    );
    const output = [];
    for (const item of list) {
      const v = publicPayment(item);
      if (!pub)
        v.submissions = await rows(
          q,
          "SELECT * FROM payment_submissions WHERE payment_id=$1 ORDER BY created_at DESC,id",
          [item.id],
        );
      output.push(v);
    }
    return response({
      items: output,
      blocking: await blocking(q, s.id),
      ...(pub ? { verification: "manual" } : { currencies }),
    });
  }
  if (!pub && method === "POST" && p.length === 3) {
    const v = createInput(d),
      s = await shipment(q, p[1], true);
    if (s.status === "cancelled")
      fail(409, "Cannot request payment on a cancelled shipment");
    if (
      s.status === "delivered" &&
      (v.blocks_progress || ![null, "delivered"].includes(v.activate_at))
    )
      fail(
        409,
        "Delivered shipments support only immediately visible, non-blocking requests",
      );
    if (
      Number(
        (
          await one(
            q,
            "SELECT count(*) AS n FROM payment_requests WHERE shipment_id=$1",
            [s.id],
          )
        ).n,
      ) >= 50
    )
      fail(409, "Limit of 50 payment requests per shipment reached");
    const time = await stamp(q);
    const pay = await insert(q, "payment_requests", {
      ...v,
      id: "PAY-" + hex(8).toUpperCase(),
      shipment_id: s.id,
      created_by: user.id,
      status: "requested",
      activated_at:
        v.activate_at === null || v.activate_at === s.status ? time : null,
      created_at: time,
      updated_at: time,
      public_message: "",
    });
    await patch(q, "shipments", s.id, { updated_at: time });
    await audit(q, s.id, user.id, "payment_created", {
      payment_id: pay.id,
      title: pay.title,
      amount: pay.amount,
      currency: pay.currency,
      blocks_progress: pay.blocks_progress,
      activate_at: pay.activate_at,
    });
    return response(publicPayment(pay), 201);
  }
  if (p.length !== 5 || method !== "POST") return null;
  const s = pub
    ? await reference(q, p[1], true)
    : await shipment(q, p[1], true);
  const pay = await one(
    q,
    "SELECT * FROM payment_requests WHERE shipment_id=$1 AND id=$2 FOR UPDATE",
    [s.id, p[3]],
  );
  if (!pay) fail(404, "Payment request not found");
  const time = await stamp(q);
  if (pub && p[4] === "submit") {
    const ref = text(d.reference, 120, 3, true),
      note = text(d.note ?? "", 300);
    if (
      s.status === "cancelled" ||
      !pay.activated_at ||
      ["verified", "cancelled"].includes(pay.status)
    )
      fail(409, "This payment request is not accepting references");
    const current = await one(
      q,
      `SELECT * FROM payment_submissions WHERE payment_id=$1 AND status='submitted'`,
      [pay.id],
    );
    if (pay.status === "submitted") {
      if (current?.reference === ref && current.note === note)
        return response({
          status: "submitted",
          message: "Reference already received; awaiting admin verification.",
        });
      fail(
        409,
        "A payment reference is already under review. Contact Relay if it needs correction.",
      );
    }
    if (
      Number(
        (
          await one(
            q,
            "SELECT count(*) AS n FROM payment_submissions WHERE payment_id=$1",
            [pay.id],
          )
        ).n,
      ) >= 20
    )
      fail(429, "Submission limit reached. Contact Relay for assistance.");
    await insert(q, "payment_submissions", {
      id: hex(16),
      payment_id: pay.id,
      reference: ref,
      note,
      status: "submitted",
      created_at: time,
      review_note: "",
    });
    await patch(q, "payment_requests", pay.id, {
      status: "submitted",
      updated_at: time,
      public_message:
        "Reference received. Awaiting manual verification; this is not payment confirmation.",
    });
    await patch(q, "shipments", s.id, { updated_at: time });
    return response({
      status: "submitted",
      message:
        "Reference received. Relay must verify the transfer before marking it paid.",
    });
  }
  if (!pub && p[4] === "review") {
    const action = choice(d.action, ["verify", "reject", "cancel"]),
      expected = text(d.expected_updated_at, 40, 10),
      review = text(d.review_note, 500, 5, true),
      publicMessage = text(d.public_message ?? "", 300);
    if (d.confirmation !== action.toUpperCase())
      fail(
        422,
        "Type " + action.toUpperCase() + " to confirm the review decision",
      );
    if (pay.updated_at !== expected)
      fail(409, "Payment changed. Refresh it before reviewing.");
    if (["verified", "cancelled"].includes(pay.status))
      fail(409, "This payment request is already resolved");
    const current = await one(
      q,
      `SELECT * FROM payment_submissions WHERE payment_id=$1 AND status='submitted' ORDER BY created_at DESC FOR UPDATE`,
      [pay.id],
    );
    if (action !== "cancel" && (pay.status !== "submitted" || !current))
      fail(
        409,
        "A submitted payment reference is required before verification or rejection",
      );
    if (action === "reject" && publicMessage.trim().length < 5)
      fail(422, "Give the customer a public explanation for resubmission");
    const outcome = {
      verify: "verified",
      reject: "rejected",
      cancel: "cancelled",
    }[action];
    const changes = {
      status: action === "reject" ? "requested" : outcome,
      public_message:
        publicMessage.trim() ||
        (action === "verify"
          ? "Payment verified by Relay operations."
          : "This payment request has been cancelled. Do not make a transfer for it."),
      updated_at: time,
    };
    if (action === "verify") {
      changes.verified_at = time;
      changes.verified_by = user.id;
    }
    const result = await patch(q, "payment_requests", pay.id, changes);
    if (current)
      await patch(q, "payment_submissions", current.id, {
        status: outcome,
        reviewed_at: time,
        reviewed_by: user.id,
        review_note: review,
      });
    await patch(q, "shipments", s.id, { updated_at: time });
    await audit(q, s.id, user.id, "payment_" + outcome, {
      payment_id: pay.id,
      title: pay.title,
      review_note: review,
      public_message: changes.public_message,
    });
    return response(publicPayment(result));
  }
  return null;
}
