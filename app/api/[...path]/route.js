import { handle } from "../../../server/api.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const GET = handle,
  POST = handle,
  PUT = handle,
  PATCH = handle,
  DELETE = handle;
