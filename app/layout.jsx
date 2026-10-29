import { headers } from "next/headers";
import parseHtml from "../components/parseHtml.mjs";
import pages from "../ui/pages.json";
export default async function RootLayout({ children }) {
  const h = await headers(),
    page = pages[h.get("x-relay-path")] || pages["/"];
  const attrs = { ...page.bodyAttrs };
  if (attrs.class) {
    attrs.className = attrs.class;
    delete attrs.class;
  }
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/assets/favicon.svg" />
        {page.styles.map((s, i) => (
          <Style key={i} source={s} />
        ))}
      </head>
      <body {...attrs} suppressHydrationWarning>
        {children}
        <noscript>
          <p style={{ padding: 20 }}>
            JavaScript is required for tracking, shipment management and quote
            submission.
          </p>
        </noscript>
      </body>
    </html>
  );
}
function Style({ source }) {
  return parseHtml(source);
}
