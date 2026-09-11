import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { objects } from "../shared/trees.mjs";

const INDEXES = { client: "index.ts", server: "index.server.ts" };
const DEFINITIONS = ["definition.ts", "definition.svelte.ts"];
const DIRECTORIES = new Set(["methods", "test"]);

export default check({
  name: "object-layout",
  says: "What an object does lives under methods/; its root holds only what it is.",
  subjects: {
    "required-files": "the index, types, definition and constructor all exist",
    "permitted-root-entries": "nothing else sits at the object root",
    "index-matches-environment":
      "a server object's index carries .server, so a browser import of it fails at build rather than at runtime"
  },
  run(tree) {
    const found = [];
    for (const { name, path, environment } of objects(tree)) {
      const files = tree.filesIn(path);
      const index = INDEXES[environment];

      if (!files.includes(index)) {
        const other = Object.values(INDEXES).find((candidate) => files.includes(candidate));
        found.push({
          subject: other ? "index-matches-environment" : "required-files",
          path,
          message: other ? `a ${environment} object's index is ${index}, not ${other}` : `no ${index}`
        });
      }
      if (!files.includes("types.ts")) {
        found.push({ subject: "required-files", path, message: "no types.ts" });
      }
      const migrated = files.includes("state.ts") || files.includes("port.ts");
      if (migrated) {
        for (const required of ["state.ts", "port.ts"]) {
          if (!files.includes(required)) {
            found.push({ subject: "required-files", path, message: `no ${required}` });
          }
        }
        for (const legacy of [...DEFINITIONS, "constructor.ts"]) {
          if (!files.includes(legacy)) continue;
          found.push({
            subject: "permitted-root-entries",
            path: join(path, legacy),
            message: "a migrated model has state.ts and port.ts, not a compatibility surface"
          });
        }
      } else {
        if (!DEFINITIONS.some((candidate) => files.includes(candidate))) {
          found.push({ subject: "required-files", path, message: `no ${DEFINITIONS.join(" or ")}` });
        }
        if (!files.includes("constructor.ts")) {
          found.push({ subject: "required-files", path, message: "no constructor.ts" });
        }
      }

      const permitted = migrated
        ? new Set([index, "types.ts", "state.ts", "port.ts", `${name}.md`])
        : new Set([index, "types.ts", "constructor.ts", `${name}.md`, ...DEFINITIONS]);
      for (const file of files) {
        if (permitted.has(file)) continue;
        found.push({
          subject: "permitted-root-entries",
          path: join(path, file),
          message: "what an object does lives under methods/"
        });
      }
      for (const directory of tree.dirsIn(path)) {
        if (DIRECTORIES.has(directory)) continue;
        found.push({
          subject: "permitted-root-entries",
          path: join(path, directory),
          message: `an object root holds ${[...DIRECTORIES].join("/ and ")}/`
        });
      }
    }
    return found;
  }
});
