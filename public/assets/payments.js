"use strict";
(() => {
  const e = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const label = (v) =>
    String(v || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  const active = (p) =>
    p.activated_at && ["requested", "submitted"].includes(p.status);
  const blocked = (s) =>
    (s.payments || []).some((p) => active(p) && p.blocks_progress);
  const stamp = () => new Date().toISOString();
  function rows() {
    let list;
    try {
      list = JSON.parse(localStorage.getItem("relayGlobalDemoV1"));
    } catch {}
    if (Array.isArray(list)) {
      if (typeof shipments !== "undefined") shipments = list;
      return list;
    }
    if (typeof shipments !== "undefined") return shipments;
    return window.relayDemoSeed?.() || [];
  }
  function save(list) {
    localStorage.setItem("relayGlobalDemoV1", JSON.stringify(list));
  }
  async function request(path, data) {
    const r = await fetch("/api" + path, {
      credentials: "same-origin",
      method: data ? "POST" : "GET",
      cache: "no-store",
      ...(!data ? { signal: AbortSignal.timeout(20000) } : {}),
      headers: { "Content-Type": "application/json", "X-Relay-Client": "web" },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const d = await r.json();
    if (!r.ok)
      throw Error(
        typeof d.detail === "string"
          ? d.detail
          : d.detail?.message || JSON.stringify(d.detail) || "Request failed.",
      );
    return d;
  }
  async function call(sid, isDemo, admin, action = "", data = null, pid = "") {
    if (!isDemo)
      return request(
        (admin ? "/shipments/" : "/track/") +
          encodeURIComponent(sid) +
          "/payments" +
          (pid ? "/" + encodeURIComponent(pid) : "") +
          (action ? "/" + action : ""),
        data,
      );
    const list = rows(),
      s = list.find(
        (s) =>
          s.id.toUpperCase() === sid.toUpperCase() || s.tracking_token === sid,
      );
    if (!s) throw Error("Demo shipment not found.");
    s.payments = s.payments || [];
    if (!data)
      return {
        items: s.payments.filter((p) => admin || p.activated_at),
        blocking: blocked(s),
        currencies: [
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
        ],
      };
    const now = stamp();
    let p = s.payments.find((p) => p.id === pid);
    if (!pid) {
      if (s.status === "cancelled")
        throw Error("Cancelled shipments cannot request payment.");
      if (
        s.status === "delivered" &&
        (data.blocks_progress || data.activate_at)
      )
        throw Error(
          "Delivered shipments allow only immediate non-blocking requests.",
        );
      if (s.payments.length >= 50) throw Error("Request limit reached.");
      p = {
        ...data,
        id: "PAY-DEMO-" + crypto.randomUUID().slice(0, 8),
        amount: Number(data.amount).toFixed(2),
        status: "requested",
        activated_at:
          !data.activate_at || data.activate_at === s.status ? now : null,
        created_at: now,
        updated_at: now,
        submissions: [],
        public_message: "",
        method: "manual_transfer",
      };
      p.transfer_memo = p.id;
      s.payments.unshift(p);
    } else if (!p) throw Error("Payment request not found.");
    else if (action === "submit") {
      if (!active(p) || s.status === "cancelled")
        throw Error("This request is not accepting references.");
      if (p.status === "submitted")
        throw Error("A reference is already under review.");
      p.submissions.unshift({
        id: crypto.randomUUID(),
        reference: data.reference,
        note: data.note,
        status: "submitted",
        created_at: now,
      });
      p.status = "submitted";
      p.public_message =
        "Reference received. Awaiting manual verification; this is not payment confirmation.";
      p.updated_at = now;
    } else if (action === "review") {
      if (p.updated_at !== data.expected_updated_at)
        throw Error("This request changed. Reopen payments and review again.");
      if (
        data.confirmation !== data.action.toUpperCase() ||
        data.review_note.trim().length < 5
      )
        throw Error(
          "Enter the exact confirmation and a meaningful review note.",
        );
      if (
        ["verified", "cancelled"].includes(p.status) ||
        (data.action !== "cancel" && p.status !== "submitted")
      )
        throw Error("This request can no longer be reviewed.");
      if (data.action === "reject" && data.public_message.trim().length < 5)
        throw Error("Explain the rejection to the customer.");
      p.status = {
        verify: "verified",
        reject: "requested",
        cancel: "cancelled",
      }[data.action];
      p.updated_at = now;
      p.public_message =
        data.public_message ||
        (data.action === "verify"
          ? "Payment verified manually by Relay."
          : "This payment request has been cancelled. Do not transfer funds.");
      if (data.action === "verify") p.verified_at = now;
      const sub = p.submissions.find((x) => x.status === "submitted");
      if (sub)
        Object.assign(sub, {
          status: {
            verify: "verified",
            reject: "rejected",
            cancel: "cancelled",
          }[data.action],
          reviewed_at: now,
          review_note: data.review_note,
        });
    }
    s.updated_at = now;
    save(list);
    return p;
  }
  function assertProgress(s, status) {
    if (
      status !== s.status &&
      !["on_hold", "cancelled"].includes(status) &&
      blocked(s)
    )
      throw Error(
        "Payment verification is required before this shipment can advance. Verify or cancel its blocking payment request first.",
      );
  }
  function afterStatus(s, status) {
    for (const p of s.payments || []) {
      if (!["requested", "submitted"].includes(p.status)) continue;
      if (status === "cancelled") {
        p.status = "cancelled";
        p.public_message = "Shipment cancelled. No automatic refund is issued.";
        p.updated_at = stamp();
        for (const sub of p.submissions || [])
          if (sub.status === "submitted") sub.status = "cancelled";
      } else if (!p.activated_at && p.activate_at === status) {
        p.activated_at = stamp();
        p.updated_at = stamp();
      }
    }
  }
  function card(p, admin = false) {
    const scheduled = !p.activated_at;
    return `<article class="pay-card" data-payment="${e(p.id)}"><div class="pay-card-top"><div><h4 class="pay-title">${e(p.title)}</h4><div class="pay-amount">${e(p.currency)} ${e(p.amount)}</div></div><span class="pay-tag ${scheduled ? "scheduled" : e(p.status)}">${relayIcon(scheduled ? "clock" : p.status === "verified" ? "check-circle" : p.status === "submitted" ? "clock" : "wallet", 13)} ${scheduled ? "Scheduled" : p.status === "submitted" ? "Awaiting verification" : p.status === "verified" ? "Verified" : label(p.status)}</span></div><div class="pay-gate ${!p.blocks_progress ? "clear" : ""}">${relayIcon(p.blocks_progress ? "pause" : "shield", 13)} <span>${["verified", "cancelled"].includes(p.status) ? "Resolved request · no longer holds shipment progress." : p.blocks_progress ? "Blocks further shipment progress until verified or cancelled." : "Informational request · does not block shipment progress."}${scheduled ? " Activates when " + e(label(p.activate_at)) + " is published." : ""}</span></div>${p.public_message ? `<div class="pay-public-message">${e(p.public_message)}</div>` : ""}${p.status === "requested" || admin ? `<div class="pay-bank"><div><label>Payee</label><strong>${e(p.payee_name)}</strong></div><div><label>Bank / transfer provider</label><strong>${e(p.bank_name)}</strong></div><div class="wide"><label>Account / transfer details</label><strong>${e(p.account_details)}</strong></div><div class="wide"><label>Payment memo</label><strong>${e(p.transfer_memo || p.id)}</strong></div><div class="wide"><label>Instructions</label><div class="pay-instructions">${e(p.instructions)}</div></div></div>` : ""}<div class="pay-meta"><span>${e(p.id)}</span>${p.verified_at ? "<span>Verified " + e(new Date(p.verified_at).toLocaleString()) + "</span>" : ""}</div>${!admin && p.status === "requested" ? `<div class="pay-actions"><span class="pay-info">Transfer the exact amount using your bank, then submit your reference. Relay does not collect funds on this page.</span><button class="button primary" data-submit-payment="${e(p.id)}">${relayIcon("bank", 15)} Submit transfer reference</button></div>` : ""}</article>`;
  }
  window.RelayPayments = {
    call,
    card,
    assertProgress,
    afterStatus,
    blocked,
    escape: e,
  };
  let context = null,
    generation = 0;
  async function show(ctx, force = false) {
    const root = document.getElementById("trackingResult");
    if (!root) return;
    const changed =
      !context ||
      context.reference !== ctx.reference ||
      context.demo !== ctx.demo;
    if (changed) {
      generation++;
      document.getElementById("payDialog")?.close();
    }
    context = ctx;
    const version = generation;
    let section = root.querySelector("#customerPayments");
    if (section && section.dataset.shipmentReference !== ctx.reference) {
      section.remove();
      section = null;
    }
    if (!section) {
      section = document.createElement("section");
      section.id = "customerPayments";
      section.className = "pay-section";
      section.dataset.shipmentReference = ctx.reference;
      section.setAttribute("aria-label", "Milestone payments");
      section.innerHTML =
        '<div class="pay-section-heading"><div><h3>Pay as your shipment moves.</h3><p>Manual transfers, requested at the right milestones. Only Relay administrators can verify received funds.</p></div><button type="button" class="button ghost" data-refresh-payments>Refresh payments</button></div><p class="pay-refresh-status" data-pay-status role="status" aria-live="polite">Checking milestone payments…</p><div data-pay-content></div>';
      root.append(section);
      section.querySelector("[data-refresh-payments]").onclick = () =>
        show(context, true);
    }
    if (section._paymentLoading) {
      if (force) section._paymentRefreshAgain = true;
      return;
    }
    if (!force && Date.now() - (section._lastPaymentAttempt || 0) < 1000)
      return;
    section._lastPaymentAttempt = Date.now();
    section._paymentLoading = true;
    section.setAttribute("aria-busy", "true");
    const button = section.querySelector("[data-refresh-payments]"),
      status = section.querySelector("[data-pay-status]");
    button.disabled = true;
    if (force) status.textContent = "Refreshing payment information…";
    try {
      const data = await call(ctx.reference, ctx.demo, false);
      if (version !== generation || !section.isConnected) return;
      const fingerprint = JSON.stringify([ctx.demo, data.blocking, data.items]);
      if (fingerprint !== section._paymentFingerprint) {
        section.querySelector("[data-pay-content]").innerHTML =
          `${ctx.demo ? '<div class="pay-warning"><strong>Demo only — do not send money.</strong> Requests and reviews are simulated in this browser. No real funds move.</div>' : ""}${data.blocking ? '<div class="pay-warning">A payment request is holding further shipment progress. Submitting a reference alone does not release the hold; Relay must verify the transfer.</div>' : ""}${data.items.length ? data.items.map((p) => card(p)).join("") : '<div class="pay-empty">No published payment requests for this shipment. Any future milestone requests appear here when activated.</div>'}<div class="pay-safety">Confirm unfamiliar or changed banking instructions with your known Relay contact before transferring. Never send passwords, PINs, card numbers or one-time codes. Anyone with your private tracking link can view these payment instructions.</div>`;
        section._paymentFingerprint = fingerprint;
        section.querySelectorAll("[data-submit-payment]").forEach(
          (b) =>
            (b.onclick = () =>
              submitDialog(
                ctx,
                data.items.find((p) => p.id === b.dataset.submitPayment),
              )),
        );
      }
      status.classList.remove("pay-error");
      const message =
        "Payment information up to date · checks automatically every 15 seconds.";
      if (status.textContent !== message) status.textContent = message;
    } catch (err) {
      if (version === generation && section.isConnected) {
        status.classList.add("pay-error");
        status.textContent =
          (section._paymentFingerprint
            ? "Could not refresh payments. Displayed information may be out of date. "
            : "Could not load payment information. ") +
          err.message +
          " Use Refresh payments to retry.";
      }
    } finally {
      section._paymentLoading = false;
      section.removeAttribute("aria-busy");
      button.disabled = false;
      if (section._paymentRefreshAgain) {
        section._paymentRefreshAgain = false;
        if (section.isConnected && version === generation) show(context, true);
      }
    }
  }

  function submitDialog(ctx, p) {
    if (document.getElementById("payDialog")?.open) return;
    const dialog = document.createElement("dialog");
    dialog.className = "pay-customer-dialog";
    dialog.id = "payDialog";
    dialog.innerHTML = `<h2>Tell us about your transfer.</h2><p>${e(p.title)}</p><div class="pay-amount">${e(p.currency)} ${e(p.amount)}</div><div class="pay-warning">${ctx.demo ? "Demo only. Do not send real money." : "Only submit after completing your bank transfer."} A reference is not proof of payment. Relay will check actual receipt before marking this request verified.</div><form class="pay-customer-form"><label for="transferReference">Bank transfer reference</label><input data-relay-attributes id="transferReference" name="reference" required minlength="3" maxlength="120" autocomplete="off" placeholder="Reference from your transfer confirmation"><label for="transferNote">Note to Relay (optional)</label><textarea data-relay-attributes id="transferNote" name="note" maxlength="300" rows="2" placeholder="Do not include bank passwords or sensitive details."></textarea><div class="pay-error" role="alert" hidden></div><div class="actions"><button class="button" type="button" data-close><span data-relay-ui>Cancel</span></button><button class="button primary" type="submit">Submit reference</button></div></form>`;
    document.body.appendChild(dialog);
    let busy = false;
    dialog.addEventListener("cancel", (event) => {
      if (busy) event.preventDefault();
    });
    dialog.addEventListener("close", () => dialog.remove());
    dialog.querySelector("[data-close]").onclick = () => dialog.close();
    dialog.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      busy = true;
      dialog.querySelectorAll("button").forEach((b) => (b.disabled = true));
      try {
        await call(
          ctx.reference,
          ctx.demo,
          false,
          "submit",
          Object.fromEntries(new FormData(event.target)),
          p.id,
        );
        dialog.close();
        if (context?.reference === ctx.reference) await show(ctx, true);
      } catch (err) {
        const error = dialog.querySelector(".pay-error");
        error.hidden = false;
        error.textContent = err.message;
      } finally {
        busy = false;
        dialog.querySelectorAll("button").forEach((b) => (b.disabled = false));
      }
    };
    dialog.showModal();
  }
  window.addEventListener("relay:shipment", (event) => show(event.detail));
  function poll(force = false) {
    if (
      !document.hidden &&
      context &&
      document.getElementById("customerPayments")?.dataset.shipmentReference ===
        context.reference
    )
      show(context, force);
  }
  let paymentTimer;
  function startPolling() {
    clearInterval(paymentTimer);
    paymentTimer = setInterval(() => poll(), 15000);
  }
  startPolling();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) poll(true);
  });
  window.addEventListener("pagehide", () => clearInterval(paymentTimer));
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      startPolling();
      poll(true);
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === "relayGlobalDemoV1" && context?.demo) poll(true);
  });
})();
