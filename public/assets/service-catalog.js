"use strict";
(() => {
  const search = document.getElementById("serviceSearch");
  const cards = Array.from(document.querySelectorAll("[data-service-card]"));
  const filters = Array.from(
    document.querySelectorAll("[data-service-filter]"),
  );
  let category = "all";
  function apply() {
    const query = (search?.value || "").trim().toLowerCase();
    let shown = 0;
    for (const card of cards) {
      const matches =
        (category === "all" || card.dataset.group === category) &&
        (!query || card.dataset.search.includes(query));
      card.hidden = !matches;
      if (matches) shown++;
    }
    const count = document.getElementById("serviceCount");
    if (count) count.textContent = shown + " / " + cards.length + " services";
    const empty = document.getElementById("serviceEmpty");
    if (empty) empty.hidden = shown !== 0;
  }
  if (search) {
    search.addEventListener("input", apply);
    for (const button of filters)
      button.addEventListener("click", () => {
        category = button.dataset.serviceFilter;
        for (const item of filters)
          item.setAttribute("aria-pressed", String(item === button));
        apply();
      });
    apply();
  }
  const form = document.getElementById("quoteForm"),
    slug = new URL(location.href).searchParams.get("service");
  if (form && slug && /^[a-z0-9-]{1,80}$/.test(slug)) {
    fetch("/assets/service-catalog.json", { credentials: "same-origin" })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((services) => {
        const title = Object.hasOwn(services, slug) ? services[slug] : null;
        if (!title) return;
        const notice = document.createElement("p");
        notice.className = "selected-service-note";
        notice.id = "selectedServiceNote";
        notice.textContent = "Service enquiry: " + title;
        form.prepend(notice);
        const notes = form.elements.namedItem("notes");
        if (notes && !notes.value)
          notes.value = "Service requested: " + title + "\n";
      })
      .catch(() => {});
  }
})();
