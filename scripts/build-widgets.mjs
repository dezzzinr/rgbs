import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
const root = fileURLToPath(new URL("..", import.meta.url));
const pages = JSON.parse(
    fs.readFileSync(path.join(root, "ui/pages.json"), "utf8"),
  ),
  bundles = {};
for (const file of fs.readdirSync(path.join(root, "public/assets")))
  if (/^relay-widgets-[a-f0-9]+\.js$/.test(file))
    fs.unlinkSync(path.join(root, "public/assets", file));
for (const [route, page] of Object.entries(pages)) {
  const code = page.scripts
    .map(
      (src) =>
        "\n;\n// " +
        src +
        "\n" +
        fs.readFileSync(path.join(root, "public", src.slice(1)), "utf8"),
    )
    .join("\n");
  const name =
    "relay-widgets-" +
    crypto.createHash("sha256").update(code).digest("hex").slice(0, 16) +
    ".js";
  fs.writeFileSync(path.join(root, "public/assets", name), code);
  bundles[route] = "/assets/" + name;
}
fs.writeFileSync(
  path.join(root, "ui/bundles.json"),
  JSON.stringify(bundles, null, 2) + "\n",
);
console.log(
  "Prepared ordered widget bundles for " +
    Object.keys(pages).length +
    " Next.js pages.",
);
