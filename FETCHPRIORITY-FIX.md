# fetchpriority React warning hotfix

1. Stop the running Next.js server (Ctrl+C).
2. Extract this ZIP directly INTO your existing Next.js project folder (the folder containing package.json). Allow replacement of app/layout.jsx and app/[[...slug]]/page.jsx. If you have customised those files, merge the small import/function-call changes instead.
3. Confirm components/parseHtml.mjs exists after extraction.
4. Restart using npm run dev. For production, run npm run build and then npm start.

No dependency installation, environment changes, database migration or data reset is needed.

If a previous build warning remains, stop the server and remove only the generated .next directory before restarting:

PowerShell:
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev

Cause: HTML uses fetchpriority, but React requires the camel-case DOM prop fetchPriority. Merely changing casing inside HTML is not reliable because HTML parsing can lowercase attribute names again. The shared parser now recreates affected elements with the canonical React prop and removes the lowercase prop, preserving all other props and children.

Changed application files:
- components/parseHtml.mjs (new shared normalizer)
- app/[[...slug]]/page.jsx (use the normalizer for page markup)
- app/layout.jsx (use the same normalizer for parsed head markup)

Regression tests: tests/html-props.test.mjs.
Validation: all 35 Node tests and Next.js production build passed. No live database was accessed or changed.
