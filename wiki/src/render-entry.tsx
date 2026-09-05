import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";

import { App } from "./App";
import { checks, files, fileRoute } from "./data";
import browserTrees from "./browser-trees.json";
import { PAGES } from "./pages/registry";
import { search } from "./search";

export const render = (url: string): string =>
  renderToString(
    <StaticRouter location={url}>
      <App />
    </StaticRouter>
  );

export const everyRoute = (): { route: string; expects: string }[] => [
  ...PAGES.filter((page) => !page.route.startsWith("/browse/")).map((page) => ({ route: page.route, expects: page.title })),
  ...browserTrees.trees.map((tree) => ({ route: `/browse/${tree}`, expects: "files" })),
  ...files.map((entry) => ({ route: fileRoute(entry.id), expects: entry.id })),
  ...checks.checks.map((check) => ({ route: `/checks/${check.tree}/${check.name}`, expects: check.says.slice(0, 40) }))
];

export const searches = (): { query: string; expects: string; found: string[] }[] =>
  [
    { query: "workspace-state definition", expects: "/files/src/lib/model/client/workspace-state/definition.svelte.ts" },
    { query: "objects-are-built-in-order", expects: "/checks/runtime/objects-are-built-in-order" },
    { query: "--token-ink-primary", expects: "/design-system/tokens#--token-ink-primary" },
    { query: "submitDocumentChanges", expects: "/trees/capabilities#document" },
    { query: "documentSnapshots", expects: "/data-model#table-documentSnapshots" },
    { query: "one crossing", expects: "/architecture#the-one-crossing" },
    { query: "Nothing survives a call", expects: "/checks/capabilities/capability-holds-nothing" },
    { query: "PanelRow", expects: "/trees/components#panel" }
  ].map((entry) => ({ ...entry, found: search(entry.query, 10).map((result) => result.route) }));
