"use strict";
(() => {
  // Smartsupp supplies its own chat widget. No custom launcher/settings UI.
  const initialChatOff =
    new URL(location.href).searchParams.get("relay_chat") === "off";
  async function boot() {
    try {
      let optedOut = initialChatOff;
      try {
        optedOut ||= sessionStorage.getItem("relay.chat.disabled.v1") === "1";
      } catch {}
      if (optedOut || window.__relaySmartsuppStarted) return;
      const response = await fetch("/api/site-tools", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) return;
      const config = await response.json();
      if (
        !config.smartsupp_key ||
        (location.pathname.startsWith("/admin") &&
          !config.smartsupp_admin_enabled) ||
        window.__relaySmartsuppStarted
      )
        return;
      window.__relaySmartsuppStarted = true;
      window._smartsupp = {
        ...(window._smartsupp || {}),
        key: config.smartsupp_key,
      };
      if (!window.smartsupp) {
        const stub = function () {
          stub._.push(arguments);
        };
        stub._ = [];
        window.smartsupp = stub;
      }
      window.smartsupp("analyticsConsent", false);
      window.smartsupp("marketingConsent", false);
      // Recording/privacy settings still require review in the provider dashboard.
      const script = document.createElement("script");
      script.src = "https://www.smartsuppchat.com/loader.js?";
      script.async = true;
      script.charset = "utf-8";
      script.referrerPolicy = "origin";
      script.dataset.relaySmartsupp = "true";
      script.onerror = () => {
        script.remove();
        console.warn("Optional live chat could not load.");
      };
      document.head.append(script);
    } catch {
      /* Optional chat must never prevent tracking or administrator sign-in. */
    }
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
