"use strict";
(() => {
  const button = document.getElementById("publicMenuToggle"),
    panel = document.getElementById("publicMobileNav");
  if (!button || !panel) return;
  const T = (text) => window.RelayI18n?.t(text) || text;
  const heading = document.createElement("div");
  heading.className = "public-drawer-heading";
  const title = document.createElement("span");
  title.textContent = "Navigation";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "public-drawer-close";
  closeButton.setAttribute("aria-label", T("Close navigation"));
  closeButton.textContent = "×";
  heading.append(title, closeButton);
  panel.prepend(heading);
  const backdrop = document.createElement("div");
  backdrop.className = "public-menu-backdrop";
  backdrop.hidden = true;
  backdrop.setAttribute("aria-hidden", "true");
  panel.parentElement.append(backdrop);
  let timer,
    inerted = [];
  const isOpen = () => button.getAttribute("aria-expanded") === "true";
  function lock() {
    let node = panel;
    while (
      node.parentElement &&
      node.parentElement !== document.documentElement
    ) {
      for (const sibling of node.parentElement.children) {
        if (
          sibling !== node &&
          sibling !== backdrop &&
          !["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)
        ) {
          inerted.push([sibling, sibling.inert]);
          sibling.inert = true;
        }
      }
      node = node.parentElement;
    }
  }
  function close(returnFocus = false) {
    const wasOpen = isOpen();
    clearTimeout(timer);
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", T("Open navigation"));
    panel.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    panel.inert = true;
    panel.removeAttribute("aria-modal");
    panel.removeAttribute("role");
    document.body.classList.remove("public-drawer-open");
    for (const [node, previous] of inerted) node.inert = previous;
    inerted = [];
    const hide = () => {
      panel.hidden = true;
      backdrop.hidden = true;
    };
    if (!wasOpen || matchMedia("(prefers-reduced-motion: reduce)").matches)
      hide();
    else timer = setTimeout(hide, 240);
    if (returnFocus && wasOpen) button.focus();
  }
  function open() {
    clearTimeout(timer);
    panel.hidden = false;
    panel.inert = false;
    backdrop.hidden = false;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", T("Close navigation"));
    lock();
    document.body.classList.add("public-drawer-open");
    void panel.offsetWidth;
    panel.classList.add("is-open");
    backdrop.classList.add("is-open");
    closeButton.focus();
  }
  button.addEventListener("click", () => (isOpen() ? close(true) : open()));
  closeButton.addEventListener("click", () => close(true));
  backdrop.addEventListener("click", () => close(true));
  document.addEventListener("keydown", (event) => {
    if (!isOpen()) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      const items = [
        ...panel.querySelectorAll("a[href],button:not([disabled])"),
      ];
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  panel.addEventListener("click", (event) => {
    if (event.target.closest("a")) close();
  });
  matchMedia("(min-width:1201px)").addEventListener("change", (event) => {
    if (event.matches) close();
  });
  window.addEventListener("relay:language", () => {
    button.setAttribute(
      "aria-label",
      T(isOpen() ? "Close navigation" : "Open navigation"),
    );
    closeButton.setAttribute("aria-label", T("Close navigation"));
  });
})();
