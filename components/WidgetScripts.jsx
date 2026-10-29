"use client";
import { useEffect, useRef } from "react";
// Preserve the existing tested map/payment/admin widgets. Scripts are classic,
// ordered, same-origin assets; navigation uses normal links, not an iframe.
export default function WidgetScripts({ sources }) {
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    (async () => {
      try {
        for (const src of sources)
          await new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = src;
            s.async = false;
            s.onload = resolve;
            s.onerror = () => reject(Error("Unable to load " + src));
            document.body.append(s);
          });
      } catch {
        const n = document.createElement("div");
        n.setAttribute("role", "alert");
        n.style.cssText = "padding:16px;background:#fff0df;color:#602c10";
        n.textContent =
          "Some website tools could not load. Reload this page or contact Relay support.";
        document.body.prepend(n);
      }
    })();
  }, [sources]);
  return null;
}
