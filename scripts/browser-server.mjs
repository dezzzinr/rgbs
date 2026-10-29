import { spawn } from "node:child_process";
const env = { ...process.env };
for (const key of Object.keys(env))
  if (key.startsWith("RELAY_")) delete env[key];
env.RELAY_DEMO_MODE = "true";
for (const k of [
  "DATABASE_URL",
  "DIRECT_DATABASE_URL",
  "VERCEL",
  "RELAY_SMARTSUPP_KEY",
  "RELAY_MAPBOX_PUBLIC_TOKEN",
])
  delete env[k];
// Refuse local .env files: browser tests must never touch production services.
import fs from "node:fs";
if (
  [".env", ".env.local", ".env.production", ".env.production.local"].some((p) =>
    fs.existsSync(p),
  )
) {
  console.error(
    "Run browser tests in a clean checkout without .env files. The tests use browser-only sample data and mocked providers.",
  );
  process.exit(1);
}
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "0.0.0.0",
    "--port",
    "3000",
  ],
  { env, stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
