import { NextResponse } from "next/server";
export function proxy(request) {
  const path = request.nextUrl.pathname,
    headers = new Headers(request.headers);
  headers.set("x-relay-path", path);
  const result = NextResponse.next({ request: { headers } });
  result.headers.set("X-Content-Type-Options", "nosniff");
  result.headers.set(
    "Referrer-Policy",
    path === "/track" || path.startsWith("/admin")
      ? "strict-origin"
      : "no-referrer",
  );
  if (
    ["/track", "/receipt", "/admin"].includes(path) ||
    path.startsWith("/admin/")
  ) {
    result.headers.set("Cache-Control", "private, no-store");
    result.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return result;
}
export const config = {
  matcher: ["/((?!api/|assets/|_next/|favicon.ico|app.js|operations.js).*)"],
};
