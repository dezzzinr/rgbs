import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement } from "react";
import fs from "node:fs";
import parseHtml from "../components/parseHtml.mjs";

test("HTML fetchpriority becomes React fetchPriority and preserves other image props", () => {
  const image = parseHtml('<img src="/photo.jpg" alt="Freight" width="1000" height="1000" fetchpriority="high"/>');
  assert.equal(image.props.fetchPriority, "high");
  assert.equal(Object.hasOwn(image.props, "fetchpriority"), false);
  assert.equal(image.props.src, "/photo.jpg");
  assert.equal(image.props.alt, "Freight");
  assert.equal(image.props.width, "1000");
});

test("nested HTML and camel-case source both produce canonical React props", () => {
  for (const spelling of ["fetchpriority", "fetchPriority"]) {
    const section = parseHtml(`<section><img src="/x.jpg" ${spelling}="low"/><p>Preserved text</p></section>`);
    assert.equal(section.props.children[0].props.fetchPriority, "low");
    assert.equal(section.props.children[1].props.children, "Preserved text");
  }
});

test("homepage rendering produces no invalid fetchpriority DOM-property warning", () => {
  const pages = JSON.parse(fs.readFileSync(new URL("../ui/pages.json", import.meta.url)));
  const errors = [], original = console.error;
  console.error = (...args) => errors.push(args.map(String).join(" "));
  let html;
  try { html = renderToStaticMarkup(parseHtml(pages["/"].body)); }
  finally { console.error = original; }
  assert.ok(html.includes('fetchPriority="high"') || html.includes('fetchpriority="high"'));
  assert.equal(errors.some(message => /Invalid DOM property|fetchpriority/.test(message)), false, errors.join("\n"));
});
