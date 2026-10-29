import "./env.mjs";
import { tx, pool, rows } from "../server/core.mjs";
import { checkSchema } from "../server/schema.mjs";
import { purgePhoto, storageConfigured } from "../server/photos.mjs";
try {
  if (!process.argv.includes("--confirm-purge"))
    throw Error(
      "Use npm run photos:purge -- --confirm-purge. Only already-removed photos are eligible.",
    );
  if (!storageConfigured()) throw Error("Private storage is not configured");
  const removed = await tx(async (q) => {
    await checkSchema(q);
    return rows(
      q,
      "SELECT * FROM shipment_photos WHERE deleted_at IS NOT NULL AND purged_at IS NULL ORDER BY deleted_at LIMIT 100",
    );
  });
  let success = 0;
  for (const photo of removed) if (await purgePhoto(photo)) success++;
  console.log(
    "Purged " +
      success +
      " of " +
      removed.length +
      " pending removed photos. Run again for remaining batches.",
  );
  if (success < removed.length) process.exitCode = 1;
} catch (e) {
  console.error(
    e.code
      ? "Database or storage operation failed (" + e.code + ")."
      : e.message,
  );
  process.exitCode = 1;
} finally {
  if (globalThis.__relayPool) await pool().end();
}
