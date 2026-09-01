import { check } from "../shared/check.mjs";
import { capabilities, unitOf } from "../shared/trees.mjs";

/** The runtime entries a procedure may reach: the server graph, and the gate. */
const RUNTIME_ENTRIES = new Set(["server/start.server", "server/scope.server"]);
/** `index` or `index.server` — naming the index explicitly is still the index. */
const isIndex = (rest) => rest.length === 0 || (rest.length === 1 && /^index(\.server)?$/.test(rest[0]));
/** A capability that crosses to the server is entered at `index.remote`. */
const isCapabilityIndex = (rest) =>
  rest.length === 0 || (rest.length === 1 && /^index(\.remote)?$/.test(rest[0]));

const CLIENT_TREES = new Set([
  "surfaces",
  "app-views",
  "development-views",
  "panels",
  "workspaces",
  "modals",
  "authored-components",
  "vendored-components",
  "development-components"
]);

export default check({
  name: "capability-imports",
  says: "Where a capability may reach.",
  subjects: {
    "server-object-index": "a server model object is named at its index, never a path inside it",
    "runtime-entry": "the server graph is reached through start.server",
    "no-client": "nothing here imports a view or a client model",
    "no-sideways": "another capability is named at its index, never a path inside it"
  },
  run(tree) {
    const units = capabilities(tree);
    const found = [];

    for (const path of tree.under(tree.path("capabilities"))) {
      if (!/\.(ts|js|svelte)$/.test(path)) continue;
      const self = unitOf(tree, units, path);

      for (const record of tree.imports(path)) {
        const target = tree.aliasTarget(record.specifier);
        if (!target) continue;
        const { tree: name, segments } = target;
        const finding = (subject, message) =>
          found.push({ subject, path, line: record.line, message });

        if (CLIENT_TREES.has(name)) {
          finding("no-client", `reaches the client: ${record.specifier}`);
          continue;
        }

        if (name === "model") {
          const [environment, object, ...rest] = segments;
          if (environment === "client") {
            finding("no-client", `reaches a client model object: ${record.specifier}`);
          } else if (!object) {
            finding("server-object-index", `names the model tree rather than an object: ${record.specifier}`);
          } else if (!isIndex(rest)) {
            finding("server-object-index", `reaches past ${object}'s index: ${record.specifier}`);
          }
          continue;
        }

        if (name === "runtime") {
          const rest = segments.join("/");
          if (rest.startsWith("client")) {
            finding("no-client", `reaches the client runtime: ${record.specifier}`);
          } else if (!RUNTIME_ENTRIES.has(rest)) {
            finding("runtime-entry", `$runtime is reached at ${[...RUNTIME_ENTRIES].join(" or ")}, not ${record.specifier}`);
          }
          continue;
        }

        if (name === "capabilities") {
          const [other, ...rest] = segments;
          if (!other || self?.name === other) continue;
          if (!isCapabilityIndex(rest)) {
            finding("no-sideways", `reaches past ${other}'s index: ${record.specifier}`);
          }
        }
      }
    }
    return found;
  }
});
