// Generates public/index.html at build time so its version stays in sync
// with package.json. Runs as part of the Vercel build step (see package.json's "build").

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>sniffies-notify-server</title>
  </head>
  <body>
    <p>This is an API-only Vercel project running sniffies-projects V${version}.</p>
  </body>
</html>
`;

mkdirSync(new URL("../public", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/index.html", import.meta.url), html);

console.log(`[generate-index] wrote public/index.html for v${version}`);
