import { check } from "../shared/check.mjs";
import { capabilities, unitOf } from "../shared/trees.mjs";

/** The one runtime door a procedure may reach: the server graph, at its accessor. */
const RUNTIME_DOOR = "server/start.server";
/** `index` or `index.server` — naming the door explicitly is still the door. */
const isDoor = (rest) => rest.length === 0 || (rest.length === 1 && /^index(\.server)?$/.test(rest[0]));

const CLIENT_TREES = new Set([
  "views",
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
    "server-object-doors": "a server model object is named at its door, never a path inside it",
    "runtime-door": "the server graph is reached through start.server",
    "no-client": "nothing here imports a view or a client model",
    "no-sideways": "another capability is named at its door, never a path inside it"
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
            finding("server-object-doors", `names the model tree rather than an object: ${record.specifier}`);
          } else if (!isDoor(rest)) {
            finding("server-object-doors", `reaches past ${object}'s door: ${record.specifier}`);
          }
          continue;
        }

        if (name === "runtime") {
          const rest = segments.join("/");
          if (rest.startsWith("client")) {
            finding("no-client", `reaches the client runtime: ${record.specifier}`);
          } else if (rest !== RUNTIME_DOOR) {
            finding("runtime-door", `the server graph is reached at $runtime/${RUNTIME_DOOR}, not ${record.specifier}`);
          }
          continue;
        }

        if (name === "capabilities") {
          const [other, ...rest] = segments;
          if (!other || self?.name === other) continue;
          if (rest.length > 0) {
            finding("no-sideways", `reaches past ${other}'s door: ${record.specifier}`);
          }
        }
      }
    }
    return found;
  }
});
