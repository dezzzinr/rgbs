import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { migrations, upgradePlan, checkSchema } from "../server/schema.mjs";
test("Node migration plan upgrades 001 through 007 without changing existing users, sessions or tracking history", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "CREATE TABLE alembic_version(version_num VARCHAR(32) PRIMARY KEY);" +
        migrations[0].sql,
    );
    await db.exec(`INSERT INTO users VALUES('legacy-admin','legacy@example.com','Existing Admin','unchanged-existing-password-hash','admin');
 INSERT INTO sessions VALUES('unchanged-session-sha256','legacy-admin','2099-01-01T00:00:00.123456+00:00');
 INSERT INTO shipments(id,tracking_token,created_by,recipient,recipient_email,origin,origin_country,destination,destination_country,weight,mode,source,status,created_at,updated_at)
 VALUES('RLY-LEGACY','unchanged-private-tracking-token','legacy-admin','Private recipient','private@example.com','Private Lagos street','Nigeria','Private Berlin street','Germany',4.125,'air','own_network','in_transit','2026-01-01T00:00:00+00:00','2026-01-02T00:00:00+00:00');
 INSERT INTO events(shipment_id,status,location,public_note,actor_id,created_at) VALUES('RLY-LEGACY','in_transit','Lagos','Recorded before migration','legacy-admin','2026-01-02T00:00:00+00:00');`);
    const snapshot = {};
    for (const t of ["users", "sessions", "shipments", "events"])
      snapshot[t] = (await db.query("SELECT * FROM " + t)).rows;
    for (const migration of upgradePlan("001_global_shipping"))
      await db.exec(migration.sql);
    await checkSchema({ query: (s, p = []) => db.query(s, p) });
    for (const [table, records] of Object.entries(snapshot)) {
      const result = (await db.query("SELECT * FROM " + table)).rows;
      for (let i = 0; i < records.length; i++)
        for (const [column, value] of Object.entries(records[i]))
          assert.deepEqual(result[i][column], value, table + "." + column);
    }
    const event = (await db.query("SELECT * FROM events")).rows[0];
    assert.equal(event.map_public, false);
    const s = (await db.query("SELECT * FROM shipments")).rows[0];
    assert.equal(s.route_public, false);
    assert.equal(s.category, "parcel");
    assert.equal(upgradePlan("007_quote_requests").length, 0);
  } finally {
    await db.close();
  }
});
test("006 to 007 plan contains no reset, reseed, delete or drop statements", () => {
  const plan = upgradePlan("006_shipment_setup");
  assert.equal(plan.length, 1);
  assert.doesNotMatch(plan[0].sql, /\b(?:DROP|DELETE|TRUNCATE)\b/i);
  assert.throws(() => upgradePlan(null));
  assert.throws(() => upgradePlan("future_schema"));
});
