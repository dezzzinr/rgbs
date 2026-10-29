"use strict";
(() => {
  const $ = (id) => document.getElementById(id),
    esc = (s) =>
      String(s ?? "").replace(
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
  const label = (s) =>
    String(s || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  const paths = {
    plane: '<path d="m22 2-7 20-4-9-9-4L22 2ZM11 13l6-6"/>',
    ship: '<path d="M5 13V6h14v7M9 6V3h6v3m-3 4v10M2 14l10-4 10 4-4 6H6l-4-6Zm0 8c2-2 4-2 6 0 2-2 4-2 6 0 2-2 4-2 6 0"/>',
    truck:
      '<path d="M2 5h12v12H2V5Zm12 5h4l4 4v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    globe:
      '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    calendar:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 5h3"/>',
    doc: '<path d="M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 13h8m-8 4h6"/>',
    refresh:
      '<path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v1"/>',
  };
  const icon = (k) =>
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[k] || paths.globe}</svg>`;
  const modeIcon = (m) =>
    icon({ land: "truck", sea: "ship", air: "plane" }[m] || "globe");
  let config = {},
    demo = false,
    reference = "",
    current = null,
    inFlight = false,
    toastTimer,
    refreshTimer;
  function toast(t) {
    $("toast").textContent = t;
    $("toast").classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.add("hidden"), 5000);
  }
  async function api(path, signal) {
    const r = await fetch("/api" + path, {
      cache: "no-store",
      signal: signal || AbortSignal.timeout(20000),
      credentials: "same-origin",
    });
    let d;
    try {
      d = await r.json();
    } catch {
      throw Error(
        "Tracking is temporarily unavailable. Please try again shortly.",
      );
    }
    if (!r.ok)
      throw Error(
        typeof d.detail === "string"
          ? d.detail
          : "Tracking is temporarily unavailable. Please try again shortly.",
      );
    return d;
  }
  function normalized(value) {
    let s = value.trim();
    if (/^https?:\/\//i.test(s)) {
      try {
        s = new URL(s).searchParams.get("ref") || "";
      } catch {
        s = "";
      }
    }
    if (!s || s.length > 100)
      throw Error(
        "Enter a valid Relay tracking number or private tracking link.",
      );
    return s;
  }
  function demoRows() {
    try {
      const list = JSON.parse(
        localStorage.getItem("relayGlobalDemoV1") || "null",
      );
      if (Array.isArray(list) && list.length) return list;
    } catch {}
    return window.relayDemoSeed ? window.relayDemoSeed() : [];
  }
  function publicCopy(s) {
    return {
      id: s.id,
      estimated_arrival_at: s.estimated_arrival_at,
      category: s.category,
      status: s.status,
      mode: s.mode,
      source: s.source,
      carrier: s.carrier,
      origin_country: s.origin_country,
      destination_country: s.destination_country,
      estimated_delivery: s.estimated_delivery,
      updated_at: s.updated_at,
      events: (s.events || []).map((e) => ({
        status: e.status,
        location: e.location,
        public_note: e.public_note,
        created_at: e.created_at,
      })),
      tracking_source: "Sample milestones — demonstration only",
      carrier_connected: false,
    };
  }
  async function fetchShipment(ref, signal) {
    if (demo) {
      const s = demoRows().find(
        (s) =>
          String(s.id).toUpperCase() === ref.toUpperCase() ||
          s.tracking_token === ref,
      );
      if (!s)
        throw Error(
          "No shipment found. Check the reference or try RLY-DEMO-20481 in demo mode.",
        );
      return publicCopy(s);
    }
    return api("/track/" + encodeURIComponent(ref), signal);
  }
  function timeLabel(s) {
    const d = new Date(s);
    return Number.isNaN(d.valueOf())
      ? "Date unavailable"
      : d.toLocaleString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
        });
  }
  function dateLabel(s, long = false) {
    if (!s) return "To be confirmed";
    const d = new Date(s + "T12:00:00");
    return Number.isNaN(d.valueOf())
      ? "To be confirmed"
      : d.toLocaleDateString("en-GB", {
          day: "numeric",
          month: long ? "long" : "short",
          year: "numeric",
        });
  }
  function etaInfo(s) {
    if (s.status === "delivered")
      return {
        title: "Journey complete",
        value: "Delivered",
        explain:
          "Delivery has been recorded by Relay operations. See the latest milestone for details.",
      };
    if (s.status === "cancelled")
      return {
        title: "Shipment cancelled",
        value: "Cancelled",
        explain:
          "No arrival estimate is active for this shipment. Contact your sender or Relay shipping contact for assistance.",
      };
    if (s.status === "on_hold")
      return {
        title: "Delivery estimate",
        value: "Under review",
        explain:
          "Your shipment is on hold. Any previous estimate may change. Please check the latest milestone or contact your shipping contact.",
      };
    if (s.estimated_arrival_at) {
      const passed = new Date(s.estimated_arrival_at) < new Date();
      return {
        title: passed ? "Previous arrival estimate" : "Estimated arrival",
        value: timeLabel(s.estimated_arrival_at),
        explain: passed
          ? "This published estimate has passed. Await a revised estimate from operations."
          : "Published by Relay operations. Displayed in your local timezone; not a guarantee or a Mapbox driving-time estimate.",
      };
    }
    if (!s.estimated_delivery)
      return {
        title: "Estimated arrival",
        value: "To be confirmed",
        explain:
          "An arrival estimate has not yet been published. Please check back for an update.",
      };
    const today = new Date(),
      localDay = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
      ].join("-");
    const passed = s.estimated_delivery < localDay;
    return {
      title: passed ? "Previous arrival estimate" : "Estimated arrival",
      value: dateLabel(s.estimated_delivery),
      explain: passed
        ? "This estimate has passed. A revised arrival date has not been published. Contact your sender or Relay shipping contact."
        : "Provided by Relay operations. Transit, customs and delivery conditions may change this estimate.",
    };
  }
  function badge(s) {
    return `<span class="badge ${esc(s)}"><span data-relay-enum>${esc(label(s))}</span></span>`;
  }
  function supportMarkup(s) {
    const href = config.support_email
      ? "mailto:" +
        encodeURIComponent(config.support_email) +
        "?subject=" +
        encodeURIComponent("Shipment enquiry — " + s.id)
      : "/#support";
    return `<section class="support-card"><h3>${icon("help")} &nbsp; A little help along the way?</h3><p>Have a question about this delivery? Keep your tracking reference handy and contact ${config.support_email ? "Relay support" : "your sender or Relay shipping contact"}.</p><a href="${esc(href)}">${config.support_email ? "Contact Relay support" : "Visit the help center"} ↗</a></section>`;
  }
  function trackingHTML(s) {
    const eta = etaInfo(s),
      history = [...(s.events || [])].reverse();
    const completed =
      {
        booked: 1,
        picked_up: 2,
        at_origin: 2,
        in_transit: 3,
        customs_clearance: 3,
        out_for_delivery: 4,
        delivered: 5,
      }[s.status] || 1;
    return `<div class="track-layout"><section class="panel"><div class="shipment-header"><div><div class="overline"><span data-relay-ui>YOUR SHIPMENT</span></div><h2>${esc(s.id)}</h2></div>${badge(s.status)}</div><div class="route-summary"><div class="country-label"><small><span data-relay-ui>FROM</span></small>${esc(s.origin_country)}</div><div class="route-connector">${modeIcon(s.mode)}</div><div class="country-label end"><small><span data-relay-ui>TO</span></small>${esc(s.destination_country)}</div></div><div class="milestone-bar" aria-hidden="true">${Array.from({ length: 5 }, (_, i) => `<span class="${i < completed ? "complete" : ""}"></span>`).join("")}</div><div class="shipment-context"><span>${modeIcon(s.mode)} ${esc(label(s.mode))} shipping</span><span>${icon("globe")} ${s.source === "partner" ? "Carrier partner" : "Relay network"}</span></div><div class="timeline-head"><h3><span data-relay-ui>Your shipment journey</span></h3><small><span data-relay-ui>Latest update first</span></small></div><div class="timeline-list">${history.length ? history.map((e) => `<article class="event"><div class="event-top"><h4><span data-relay-enum>${esc(label(e.status))}</span></h4><time datetime="${esc(e.created_at)}">${esc(timeLabel(e.created_at))}</time></div>${e.location ? `<div class="event-location">${esc(e.location)}</div>` : ""}${e.public_note ? `<p>${esc(e.public_note)}</p>` : ""}</article>`).join("") : '<article class="event"><h4><span data-relay-ui>No milestones published yet.</span></h4></article>'}</div><div class="timeline-foot"><span>${demo ? "Sample milestones · not actual shipping activity" : "Milestones published by Relay operations · not GPS"}</span><span id="refreshStatus"><span data-relay-ui>Refreshes every 15 seconds</span></span></div></section><aside class="track-sidebar"><section class="panel sidebar-panel"><div class="eta-icon">${icon("calendar")}</div><span class="eta-label" data-relay-ui>${esc(eta.title)}</span><div class="eta-day" data-relay-ui>${esc(eta.value)}</div><p class="eta-explain">${esc(eta.explain)}</p><hr class="sidebar-divider"><div class="sidebar-meta"><span><span data-relay-ui>Shipping method</span></span><strong><span data-relay-enum>${esc(label(s.mode))}</span></strong></div><div class="sidebar-meta"><span><span data-relay-ui>Last shipment update</span></span><strong>${esc(timeLabel(s.updated_at))}</strong></div>${s.source === "partner" ? `<div class="sidebar-meta"><span><span data-relay-ui>Carrier reference</span></span><strong>${esc(s.carrier || "Partner carrier")}</strong></div><p class="small-note" style="font-size:10px;color:#97a387;line-height:1.8">Carrier automation is not connected. Relay operations publishes updates manually.</p>` : ""}<hr class="sidebar-divider"><a class="button" href="/receipt?ref=${encodeURIComponent(reference)}">${icon("doc")} Shipment summary ↗</a><button class="button ghost" id="copyTracking">${icon("copy")} Copy tracking link</button><button class="button ghost" id="refreshTracking">${icon("refresh")} Refresh tracking</button><p class="sidebar-note"><span data-relay-ui>No account needed. Share this reference only with people you trust.</span></p></section>${supportMarkup(s)}</aside></div>`;
  }
  function bindTracking() {
    const copy = $("copyTracking");
    if (copy)
      copy.onclick = async () => {
        const url =
          location.origin + "/track?ref=" + encodeURIComponent(reference);
        try {
          await navigator.clipboard.writeText(url);
          toast("Private tracking link copied.");
        } catch {
          toast("Copy the current page address to share this tracking result.");
        }
      };
    const refresh = $("refreshTracking");
    if (refresh) refresh.onclick = () => loadTracking(true);
  }
  function showError(message, stale = false) {
    const e = $("trackingError");
    if (e) {
      e.textContent = stale
        ? "We couldn’t refresh this shipment. The details below may be out of date. " +
          message
        : message;
      e.classList.remove("hidden");
    }
  }
  function clearError() {
    $("trackingError")?.classList.add("hidden");
  }
  async function loadTracking(background = false) {
    if (!reference || inFlight || (background && document.hidden)) return;
    inFlight = true;
    const requested = reference;
    const button = $("trackSubmit");
    if (button && !background) {
      button.disabled = true;
      button.textContent = "Tracking…";
    }
    clearError();
    try {
      const s = await fetchShipment(requested);
      if (requested !== reference) return;
      current = s;
      const retainedMap = $("customerRoute"),
        retainedPayments = $("customerPayments");
      if (retainedMap) retainedMap.remove();
      if (retainedPayments) retainedPayments.remove();
      $("trackingResult").innerHTML = trackingHTML(s);
      if (retainedMap && retainedMap.dataset.shipmentReference === requested)
        $("trackingResult").append(retainedMap);
      if (
        retainedPayments &&
        retainedPayments.dataset.shipmentReference === requested
      )
        $("trackingResult").insertBefore(
          retainedPayments,
          retainedMap?.isConnected ? retainedMap : null,
        );
      bindTracking();
      window.relayPaymentContext = { reference, shipment: s, demo };
      window.dispatchEvent(
        new CustomEvent("relay:shipment", {
          detail: window.relayPaymentContext,
        }),
      );
      history.replaceState(
        null,
        "",
        "/track?ref=" + encodeURIComponent(reference),
      );
      document.title = label(s.status) + " · " + s.id + " — Relay";
    } catch (e) {
      if (requested !== reference) return;
      showError(e.message, Boolean(background && current));
      if (!background) {
        current = null;
        $("trackingResult").innerHTML =
          '<section class="tracking-empty"><div class="round-icon">' +
          icon("help") +
          '</div><h2>Let’s double-check that reference.</h2><p>Use the reference exactly as it appears in your confirmation, or paste your private tracking link. If you still need help, contact your sender.</p><a href="/#support" class="button ghost">Visit the help center ↗</a></section>';
      } else if ($("refreshStatus"))
        $("refreshStatus").textContent =
          "Refresh unavailable · information may be stale";
    } finally {
      inFlight = false;
      if (button && !background) {
        button.disabled = false;
        button.innerHTML = "Track ↗";
      }
    }
  }
  function receiptHTML(s) {
    const eta = etaInfo(s);
    return `<div class="receipt-title"><div><a class="brand" href="/"><span class="brand-mark">↗</span><span>relay<span class="brand-dot">.</span></span></a><p style="margin-top:10px">Global logistics · Land, sea and air</p></div><div><h1><span data-relay-ui>Shipment summary</span></h1><div class="receipt-id">${esc(s.id)}</div></div></div><div class="receipt-grid"><div><label><span data-relay-ui>Origin</span></label><strong>${esc(s.origin_country)}</strong></div><div><label><span data-relay-ui>Destination</span></label><strong>${esc(s.destination_country)}</strong></div><div><label><span data-relay-ui>Shipping method</span></label><strong><span data-relay-enum>${esc(label(s.mode))}</span></strong></div><div><label><span data-relay-ui>Shipment status</span></label><strong><span data-relay-enum>${esc(label(s.status))}</span></strong></div><div><label>${esc(eta.title)}</label><strong>${esc(eta.value)}</strong></div><div><label><span data-relay-ui>Last shipment update</span></label><strong>${esc(timeLabel(s.updated_at))}</strong></div></div><p style="font-size:11px;line-height:1.9">${esc(eta.explain)}</p><h3 style="font-size:14px;margin-top:30px"><span data-relay-ui>Published tracking milestones</span></h3><table><thead><tr><th><span data-relay-ui>DATE & TIME</span></th><th><span data-relay-ui>MILESTONE</span></th><th><span data-relay-ui>PUBLIC LOCATION / UPDATE</span></th></tr></thead><tbody>${(s.events || []).map((e) => `<tr><td>${esc(timeLabel(e.created_at))}</td><td><span data-relay-enum>${esc(label(e.status))}</span></td><td>${esc(e.location || "—")}${e.public_note ? `<small>${esc(e.public_note)}</small>` : ""}</td></tr>`).join("")}</tbody></table><div class="receipt-disclaimer"><strong>Shipment information only.</strong> This summary is not an invoice, payment receipt, bill of lading or proof of delivery. It includes only public tracking information, not recipient contact details or full addresses. Arrival dates are estimates, not guarantees.<br>Generated in your browser: ${esc(timeLabel(new Date().toISOString()))}.${demo ? "<br><strong>DEMO DOCUMENT — sample shipment data only.</strong>" : ""}</div>`;
  }
  async function receipt() {
    try {
      const value = new URLSearchParams(location.search).get("ref") || "";
      reference = normalized(value);
      const s = await fetchShipment(reference);
      current = s;
      $("receiptResult").innerHTML = receiptHTML(s);
      $("backToTracking").href = "/track?ref=" + encodeURIComponent(reference);
      $("printSummary").disabled = false;
      $("printSummary").onclick = () => window.print();
    } catch (e) {
      showError(e.message);
      $("receiptResult").innerHTML =
        '<h2 style="font-size:23px">No shipment summary available.</h2><p style="font-size:12px">Open your shipment’s tracking page, then choose “Shipment summary.”</p>';
    }
  }
  async function init() {
    const page = document.body.dataset.page;
    try {
      config = await api("/config");
      demo = Boolean(config.demo_available);
      if (demo) {
        $("environment").classList.add("visible");
        if ($("demoHint")) $("demoHint").hidden = false;
      }
      if (config.support_email && $("supportContact"))
        $("supportContact").innerHTML =
          '<a class="button ghost" href="mailto:' +
          esc(encodeURIComponent(config.support_email)) +
          '">Contact Relay support ↗</a>';
    } catch {
      if (page !== "home")
        showError(
          "We couldn’t check service availability. Please try again shortly.",
        );
    }
    const demoFill = $("demoFill");
    if (demoFill)
      demoFill.onclick = () => {
        $("trackingReference").value = "RLY-DEMO-20481";
        $("trackingReference").focus();
      };
    if (page === "home") {
      $("homeTrack").onsubmit = (e) => {
        e.preventDefault();
        try {
          const ref = normalized($("trackingReference").value);
          location.href = "/track?ref=" + encodeURIComponent(ref);
        } catch (e) {
          toast(e.message);
        }
      };
      return;
    }
    if (page === "receipt") {
      await receipt();
      return;
    }
    $("trackingForm").onsubmit = async (e) => {
      e.preventDefault();
      try {
        const next = normalized($("trackingReference").value);
        if (inFlight) {
          toast("Please wait for the current tracking request to finish.");
          return;
        }
        reference = next;
        current = null;
        await loadTracking(false);
      } catch (e) {
        showError(e.message);
      }
    };
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref) {
      $("trackingReference").value = ref;
      try {
        reference = normalized(ref);
        $("trackingResult").innerHTML =
          '<div class="panel skeleton" role="status" aria-label="Loading shipment"><div class="loading-pulse"></div><div class="loading-pulse"></div><div class="loading-pulse"></div></div>';
        await loadTracking();
      } catch (e) {
        showError(e.message);
        $("trackingResult").innerHTML = "";
      }
    }
    refreshTimer = setInterval(() => {
      if (current) loadTracking(true);
    }, 15000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && reference && current) loadTracking(true);
    });
    window.addEventListener("pagehide", () => clearInterval(refreshTimer));
  }
  init();
})();
