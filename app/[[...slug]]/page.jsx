import { notFound } from "next/navigation";
import parseHtml from "../../components/parseHtml.mjs";
import pages from "../../ui/pages.json";
import bundles from "../../ui/bundles.json";
import WidgetScripts from "../../components/WidgetScripts";
export const dynamic = "force-dynamic";
async function route(params) {
  const p = await params;
  return "/" + (p.slug || []).join("/");
}
export async function generateMetadata({ params }) {
  const path = await route(params),
    p = pages[path];
  if (!p) return { title: "Page not found — Relay" };
  return {
    title: p.title,
    description: p.description,
    referrer:
      path === "/track" || path.startsWith("/admin")
        ? "strict-origin"
        : "no-referrer",
    robots:
      ["/track", "/receipt"].includes(path) || path.startsWith("/admin")
        ? { index: false, follow: false }
        : undefined,
  };
}
export default async function Page({ params }) {
  const path = await route(params),
    page = pages[path];
  if (!page) notFound();
  return (
    <>
      {path === "/admin" ? (
        <div
          style={{ display: "contents" }}
          dangerouslySetInnerHTML={{ __html: page.body }}
        />
      ) : (
        parseHtml(page.body)
      )}
      <WidgetScripts key={path} sources={[bundles[path]]} />
    </>
  );
}
