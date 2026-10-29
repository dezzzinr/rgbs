import "./env.mjs";
import { tx, pool, one, rows } from "../server/core.mjs";
import {
  schemaSql,
  head,
  migrations,
  inspect,
  checkSchema,
  upgradePlan,
  expected,
} from "../server/schema.mjs";
const [command, ...flags] = process.argv.slice(2);
try {
  if (!["status", "check", "upgrade", "bootstrap"].includes(command))
    throw Error("Use npm run db:status, db:check, db:upgrade or db:bootstrap");
  if (
    ["upgrade", "bootstrap"].includes(command) &&
    !flags.includes("--confirm-" + command)
  )
    throw Error(
      "Back up Neon first. Then explicitly add -- --confirm-" +
        command +
        ". Bootstrap accepts ONLY an empty database. Upgrade applies ONLY missing known migrations.",
    );
  await tx(async (q) => {
    if (["upgrade", "bootstrap"].includes(command))
      await q.query("SELECT pg_advisory_xact_lock(74281620)");
    const state = await inspect(q);
    if (command === "bootstrap") {
      if (state.tables.length)
        throw Error(
          "Database is not empty. Bootstrap refused; do not reset or drop existing tables.",
        );
      await q.query(
        schemaSql.replace(/^BEGIN;\s*/, "").replace(/COMMIT;\s*$/, ""),
      );
      console.log("Created an empty database at " + head);
    }
    if (command === "upgrade") {
      for (const migration of upgradePlan(state.revision)) {
        console.log("Applying " + migration.revision);
        await q.query(migration.sql);
      }
      console.log("At " + head + "; existing records preserved.");
    }
    if (command !== "status") {
      await checkSchema(q);
      console.log("Schema compatibility check passed: " + head);
    } else
      console.log(
        "Alembic revision:",
        state.revision || "none",
        "; target:",
        head,
      );
    for (const table of Object.keys(expected).filter(
      (t) => t !== "alembic_version" && state.tables.includes(t),
    )) {
      const value = await one(q, `SELECT count(*) AS n FROM ${table}`);
      console.log(table + ": " + value.n + " records");
    }
  });
} catch (e) {
  console.error(
    e.code
      ? "Database connection or migration failed (" +
          e.code +
          "). Transaction rolled back."
      : e.message,
  );
  process.exitCode = 1;
} finally {
  if (globalThis.__relayPool) await pool().end();
}
