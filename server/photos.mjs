import sharp from "sharp";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {
  fail,
  one,
  rows,
  insert,
  patch,
  stamp,
  hex,
  text,
  bool,
  shipment,
  reference,
  audit,
  response,
  tx,
} from "./core.mjs";
export const MAX = 2 * 1024 * 1024;
let testStore;
export function setTestStore(store) {
  if (process.env.NODE_ENV !== "test") throw Error("Tests only");
  testStore = store;
}
export const storageConfigured = () =>
  Boolean(
    testStore ||
    [
      "RELAY_S3_ENDPOINT",
      "RELAY_S3_BUCKET",
      "RELAY_S3_ACCESS_KEY_ID",
      "RELAY_S3_SECRET_ACCESS_KEY",
    ].every((k) => process.env[k]),
  );
function store() {
  if (testStore) return testStore;
  if (!storageConfigured())
    fail(503, "Private photo storage is not configured.");
  const endpoint = process.env.RELAY_S3_ENDPOINT;
  if (!endpoint.startsWith("https://"))
    fail(503, "Photo storage requires HTTPS");
  const client = new S3Client({
    endpoint,
    region: process.env.RELAY_S3_REGION || "auto",
    credentials: {
      accessKeyId: process.env.RELAY_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.RELAY_S3_SECRET_ACCESS_KEY,
    },
    maxAttempts: 2,
    requestHandler: { requestTimeout: 12000, connectionTimeout: 4000 },
  });
  const Bucket = process.env.RELAY_S3_BUCKET;
  return {
    put: async (key, bytes) =>
      client.send(
        new PutObjectCommand({
          Bucket,
          Key: key,
          Body: bytes,
          ContentType: "image/jpeg",
          CacheControl: "private, no-store",
        }),
      ),
    get: async (key) => {
      const object = await client.send(
        new GetObjectCommand({ Bucket, Key: key }),
      );
      if (object.ContentLength > MAX) {
        object.Body?.destroy();
        fail(503, "Photo unavailable");
      }
      const chunks = [];
      let size = 0;
      try {
        for await (const chunk of object.Body) {
          size += chunk.length;
          if (size > MAX) fail(503, "Photo unavailable");
          chunks.push(Buffer.from(chunk));
        }
      } finally {
        object.Body?.destroy();
      }
      return Buffer.concat(chunks);
    },
    delete: async (key) =>
      client.send(new DeleteObjectCommand({ Bucket, Key: key })),
  };
}
export async function sanitize(bytes) {
  if (!bytes.length || bytes.length > MAX)
    fail(413, "Upload a photo up to 2 MB after compression");
  try {
    const meta = await sharp(bytes, {
      limitInputPixels: 20_000_000,
      animated: true,
    }).metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format) ||
      (meta.pages ?? 1) !== 1
    )
      fail(422, "Use a non-animated JPEG, PNG or WebP image");
    const { data, info } = await sharp(bytes, { limitInputPixels: 20_000_000 })
      .rotate()
      .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    if (data.length > MAX)
      fail(413, "Photo is too complex. Resize before uploading");
    return { data, width: info.width, height: info.height };
  } catch (e) {
    if (e.status) throw e;
    fail(422, "Invalid or oversized JPEG, PNG or WebP image");
  }
}
export const photoMetadata = (p, pub = false) =>
  Object.fromEntries(
    (pub
      ? ["id", "caption", "width", "height", "created_at"]
      : [
          "id",
          "caption",
          "width",
          "height",
          "created_at",
          "updated_at",
          "byte_size",
          "public",
        ]
    ).map((k) => [k, p[k]]),
  );
async function getPhoto(q, sid, pid, pub = false) {
  const p = await one(
    q,
    `SELECT * FROM shipment_photos WHERE shipment_id=$1 AND id=$2 AND deleted_at IS NULL ${pub ? "AND public=true" : "FOR UPDATE"}`,
    [sid, pid],
  );
  if (!p) fail(404, "Photo not found");
  return p;
}
export async function image(p) {
  let bytes;
  try {
    bytes = await store().get(p.object_key);
  } catch (e) {
    if (e.status) throw e;
    fail(503, "Photo storage unavailable");
  }
  return new Response(bytes, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'inline; filename="shipment-photo.jpg"',
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function purgePhoto(p) {
  try {
    await store().delete(p.object_key);
    await tx(async (q) =>
      patch(q, "shipment_photos", p.id, { purged_at: await stamp(q) }),
    );
    return true;
  } catch {
    return false;
  }
}
export async function photosRoute(q, req, p, d, user, ctx) {
  const pub = p[0] === "track";
  if (!["track", "shipments"].includes(p[0]) || p[2] !== "photos") return null;
  const s = pub
    ? await reference(q, p[1])
    : await shipment(q, p[1], req.method !== "GET");
  if (req.method === "GET" && p.length === 3) {
    const list = await rows(
      q,
      `SELECT * FROM shipment_photos WHERE shipment_id=$1 AND deleted_at IS NULL ${pub ? "AND public=true" : ""} ORDER BY created_at,id`,
      [s.id],
    );
    return response({
      items: list.map((v) => photoMetadata(v, pub)),
      ...(!pub
        ? {
            storage_configured: storageConfigured(),
            limit: 8,
            max_upload_bytes: MAX,
          }
        : {}),
    });
  }
  if (req.method === "GET" && p.length === 5 && p[4] === "image")
    return image(await getPhoto(q, s.id, p[3], pub));
  if (pub) return null;
  if (req.method === "POST" && p.length === 3) {
    const client = store();
    const n = await one(
      q,
      "SELECT count(*) AS total,count(*) FILTER (WHERE deleted_at IS NULL) AS active FROM shipment_photos WHERE shipment_id=$1",
      [s.id],
    );
    if (Number(n.total) >= 24) fail(409, "Lifetime photo limit reached");
    if (Number(n.active) >= 8)
      fail(409, "Maximum 8 active photos per shipment");
    const file = d.get("file");
    if (!file || typeof file.arrayBuffer !== "function")
      fail(422, "Select an image file");
    const caption = text(d.get("caption") ?? "", 160, 0, true);
    if (file.size > MAX) fail(413, "Upload a photo up to 2 MB");
    const clean = await sanitize(Buffer.from(await file.arrayBuffer()));
    const time = await stamp(q),
      id = hex(16),
      key = "relay/shipments/" + s.id + "/" + id + ".jpg";
    try {
      await client.put(key, clean.data);
    } catch {
      fail(503, "Photo upload failed. No photo has been published");
    }
    ctx.rollback.push(() => client.delete(key).catch(() => {}));
    const result = await insert(q, "shipment_photos", {
      id,
      shipment_id: s.id,
      created_by: user.id,
      object_key: key,
      caption,
      public: false,
      byte_size: clean.data.length,
      width: clean.width,
      height: clean.height,
      created_at: time,
      updated_at: time,
    });
    await patch(q, "shipments", s.id, { updated_at: time });
    await audit(q, s.id, user.id, "photo_uploaded", {
      photo_id: id,
      public: false,
    });
    return response(photoMetadata(result), 201);
  }
  if (p.length === 4 && ["PUT", "DELETE"].includes(req.method)) {
    const photo = await getPhoto(q, s.id, p[3]);
    const caption = text(d.caption ?? "", 160, 0, true);
    bool(d.public ?? false);
    text(d.expected_updated_at, 40, 10);
    if (photo.updated_at !== d.expected_updated_at)
      fail(409, "Photo changed. Refresh before reviewing");
    const time = await stamp(q);
    if (req.method === "DELETE") {
      if (d.confirmation !== "DELETE")
        fail(422, "Type DELETE to remove a photo");
      await patch(q, "shipment_photos", photo.id, {
        deleted_at: time,
        public: false,
        updated_at: time,
      });
      await patch(q, "shipments", s.id, { updated_at: time });
      await audit(q, s.id, user.id, "photo_removed", { photo_id: photo.id });
      ctx.after.push(async () => {
        ctx.finalBody = {
          removed: true,
          storage_purged: await purgePhoto(photo),
        };
      });
      return response({ removed: true, storage_purged: false });
    }
    if (d.confirmation !== (d.public ? "PUBLISH" : "PRIVATE"))
      fail(422, "Confirm photo visibility");
    const result = await patch(q, "shipment_photos", photo.id, {
      caption,
      public: d.public,
      updated_at: time,
    });
    await patch(q, "shipments", s.id, { updated_at: time });
    await audit(q, s.id, user.id, "photo_reviewed", {
      photo_id: photo.id,
      public: d.public,
      caption,
    });
    return response(photoMetadata(result));
  }
  return null;
}
