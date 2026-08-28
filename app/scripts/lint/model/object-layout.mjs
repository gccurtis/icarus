import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { objects } from "../shared/trees.mjs";

const DOORS = { client: "index.ts", server: "index.server.ts" };
const DEFINITIONS = ["definition.ts", "definition.svelte.ts"];
const DIRECTORIES = new Set(["methods", "test"]);

export default check({
  name: "object-layout",
  says: "What an object does lives under methods/; its root holds only what it is.",
  subjects: {
    "required-files": "the door, types, definition and constructor all exist",
    "permitted-root-entries": "nothing else sits at the object root",
    "door-matches-environment":
      "a server object's door carries .server, so a browser import of it fails at build rather than at runtime"
  },
  run(tree) {
    const found = [];
    for (const { name, path, environment } of objects(tree)) {
      const files = tree.filesIn(path);
      const door = DOORS[environment];

      if (!files.includes(door)) {
        const other = Object.values(DOORS).find((candidate) => files.includes(candidate));
        found.push({
          subject: other ? "door-matches-environment" : "required-files",
          path,
          message: other ? `a ${environment} object's door is ${door}, not ${other}` : `no ${door}`
        });
      }
      if (!files.includes("types.ts")) {
        found.push({ subject: "required-files", path, message: "no types.ts" });
      }
      if (!DEFINITIONS.some((candidate) => files.includes(candidate))) {
        found.push({ subject: "required-files", path, message: `no ${DEFINITIONS.join(" or ")}` });
      }
      if (!files.includes("constructor.ts")) {
        found.push({ subject: "required-files", path, message: "no constructor.ts" });
      }

      const permitted = new Set([door, "types.ts", "constructor.ts", `${name}.md`, ...DEFINITIONS]);
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
