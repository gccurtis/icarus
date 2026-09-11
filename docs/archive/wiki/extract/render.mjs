#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const wikiRoot = join(here, "..");

const escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const server = await createServer({
  root: wikiRoot,
  configFile: join(wikiRoot, "vite.config.ts"),
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true }
});

let failures = 0;
let rendered = 0;
try {
  const entry = await server.ssrLoadModule("/src/render-entry.tsx");
  const routes = entry.everyRoute();
  for (const { route, expects } of routes) {
    let html;
    try {
      html = entry.render(route);
    } catch (error) {
      failures += 1;
      console.log(`render  ${route}\n    threw: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    rendered += 1;
    if (html.includes("No page answers to that route")) {
      failures += 1;
      console.log(`render  ${route}\n    rendered the not-found page`);
      continue;
    }
    if (!html.includes(escapeHtml(expects)) && !html.includes(expects)) {
      failures += 1;
      console.log(`render  ${route}\n    rendered without "${expects}"`);
    }
  }
  const searches = entry.searches();
  for (const { query, expects, found } of searches) {
    if (!found.includes(expects)) {
      failures += 1;
      console.log(`search  "${query}"\n    expected ${expects} among the first ten, found ${found.slice(0, 3).join(", ") || "nothing"}`);
    }
  }
  console.log(`wiki render: ${routes.length} routes · ${rendered} rendered · ${searches.length} searches · ${failures} failures`);
} finally {
  await server.close();
}

process.exit(failures === 0 ? 0 : 1);
