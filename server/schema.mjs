import fs from "node:fs";
import { one, rows } from "./core.mjs";
export const schemaSql = fs.readFileSync(
  new URL("../migrations/007-bootstrap.sql", import.meta.url),
  "utf8",
);
const chunks = schemaSql.split(/^-- Running upgrade .* -> /m);
export const migrations = chunks.slice(1).map((chunk) => ({
  revision: chunk.slice(0, chunk.indexOf("\n")).trim(),
  sql: chunk
    .slice(chunk.indexOf("\n") + 1)
    .replace(/\bCOMMIT;\s*$/, "")
    .trim(),
}));
export const head = migrations.at(-1).revision;
export function upgradePlan(revision) {
  const index = migrations.findIndex((m) => m.revision === revision);
  if (index < 0)
    throw Error("Unknown or missing Alembic revision. No changes were made.");
  return migrations.slice(index + 1);
}
export const expected = {};
for (const match of schemaSql.matchAll(
  /CREATE TABLE (\w+) \(([\s\S]*?)\n\);/g,
)) {
  expected[match[1]] = [
    ...match[2].matchAll(
      /^\s{4}(\w+)\s+(?:VARCHAR|TEXT|FLOAT|INTEGER|SERIAL|NUMERIC|BOOLEAN)/gm,
    ),
  ].map((v) => v[1]);
}
for (const match of schemaSql.matchAll(/ALTER TABLE (\w+) ADD COLUMN (\w+)/g))
  expected[match[1]].push(match[2]);
export async function inspect(q) {
  const tables = (
    await rows(
      q,
      `SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_type='BASE TABLE'`,
    )
  ).map((r) => r.table_name);
  let revision = null;
  if (tables.includes("alembic_version")) {
    const all = await rows(q, "SELECT version_num FROM alembic_version");
    if (all.length !== 1)
      throw Error(
        "Expected exactly one Alembic revision. Review this database manually.",
      );
    revision = all[0].version_num;
  }
  return { tables, revision };
}
export async function checkSchema(q) {
  const state = await inspect(q);
  if (state.revision !== head)
    throw Error(
      "Expected Alembic revision " +
        head +
        "; found " +
        (state.revision || "none") +
        ". No data was changed.",
    );
  const columns = await rows(
      q,
      `SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=current_schema()`,
    ),
    missing = [];
  for (const [table, names] of Object.entries(expected))
    for (const name of names)
      if (
        !columns.some((c) => c.table_name === table && c.column_name === name)
      )
        missing.push(table + "." + name);
  if (missing.length)
    throw Error("Schema is incomplete: " + missing.join(", "));
  return state;
}
