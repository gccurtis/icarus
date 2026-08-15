#!/usr/bin/env node
/**
 * Writes the fixture trees the lint tests run against.
 *
 * Generated rather than committed as hundreds of near-identical stub files: the
 * point of a fixture is the ONE thing wrong with it, and that is legible here
 * and invisible in a directory listing. `clean` is the compliant baseline and
 * every other fixture is `clean` plus a single deliberate defect, so a rule that
 * fires on the wrong fixture is a rule that is testing the wrong thing.
 *
 * Run by the test file itself; there is no need to invoke it directly.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const write = (root, path, contents = "") => {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
};

/**
 * The deployment root for a fixture, as a sibling of its capabilities root.
 *
 * It has to sit outside, because `discover` walks every directory under the
 * capabilities root and would read a `convex/` inside it as a capability.
 */
export const functionsRootFor = (root) => `${root}__convex`;

/** The capability's public surface: what an untrusted caller can reach. */
const writeDoor = (root, contents) =>
  write(functionsRootFor(root), "capabilities/thing.ts", contents);

const DOOR = `import { projectMutation, projectQuery } from "$convex/functions";
export const define = projectMutation({ args: {}, handler: () => null });
export const list = projectQuery({ args: {}, handler: () => null });
`;

/**
 * A compliant capability: two registered functions, a promoted shared
 * procedure, a nested supporting procedure, and a table fragment.
 */
const clean = (root) => {
  write(root, "data/thing/overview.md", "# Thing Overview\n");
  write(root, "data/thing/errors.ts", "export class ThingError extends Error {}\n");
  write(root, "data/thing/schema.ts", "export const thingTables = {};\n");

  write(root, "data/thing/types/types.md", "# Thing Types\n");
  write(root, "data/thing/types/thing.ts", "export interface Thing { readonly id: string }\n");

  write(root, "data/thing/api/api.md", "# Thing API\n");
  write(root, "data/thing/api/shared/shared.md", "# Thing Shared Procedures\n");
  write(root, "data/thing/api/shared/find-thing.ts", "export const findThing = async () => {};\n");

  write(
    root,
    "data/thing/api/define/define.md",
    "# API: `define`\n\n## Procedure Tree\n\n```text\ndefine(ctx, input)\n" +
      "├── findThing()         ../shared/find-thing.ts\n" +
      "└── canonical()         canonical/canonical.ts\n```\n"
  );
  write(root, "data/thing/api/define/define.ts", "export const define = async () => {};\n");
  write(root, "data/thing/api/define/canonical/canonical.ts", "export const canonical = () => {};\n");
  write(root, "data/thing/api/define/canonical/guard.ts", "export const guard = () => {};\n");

  write(root, "data/thing/api/list/list.md", "# API: `list`\n");
  // Carries the one aliased import in the fixture, so the path rules have
  // something real to resolve. A handler reaching its capability's own types is
  // the most ordinary import there is.
  write(
    root,
    "data/thing/api/list/list.ts",
    'import type { Thing } from "$thing/types/thing";\n' +
      "export const list = async (): Promise<Thing[]> => [];\n"
  );

  write(root, "data/thing/test/unit/api/list/list.test.ts", "// covered elsewhere\n");

  writeDoor(root, DOOR);
};

/** Each fixture is `clean` plus exactly one defect. */
export const FIXTURES = {
  clean,

  "unknown-directory": (root) => {
    clean(root);
    write(root, "data/thing/domain/aggregate.ts", "export const x = 1;\n");
  },

  "stray-root-file": (root) => {
    clean(root);
    write(root, "data/thing/runtime.ts", "export const x = 1;\n");
  },

  "api-missing-entry": (root) => {
    clean(root);
    write(root, "data/thing/api/archive/archive.md", "# API: `archive`\n");
  },

  // An api/ directory the door never registers is unreachable code.
  "surface-mismatch": (root) => {
    clean(root);
    writeDoor(
      root,
      'import { projectMutation } from "$convex/functions";\n' +
        "export const define = projectMutation({ args: {}, handler: () => null });\n"
    );
  },

  // A registration with no api/ directory hides a procedure inline. There are
  // no exemptions to this.
  "surface-extra-export": (root) => {
    clean(root);
    writeDoor(root, `${DOOR}export const archive = projectMutation({ args: {}, handler: () => null });\n`);
  },

  // A capability with no door at all is unreachable in its entirety.
  "no-deployment-door": (root) => {
    clean(root);
    rmSync(join(functionsRootFor(root), "capabilities/thing.ts"));
  },

  // A capability holds handlers; registering inside one puts a public function
  // where the door list does not describe it.
  "capability-registers": (root) => {
    clean(root);
    write(
      root,
      "data/thing/api/list/paginate.ts",
      'import { query } from "$convex/_generated/server";\n' +
        "export const paginate = query({ args: {}, handler: () => null });\n"
    );
  },

  "missing-document": (root) => {
    clean(root);
    rmSync(join(root, "data/thing/types/types.md"));
  },

  "misplaced-document": (root) => {
    clean(root);
    write(root, "data/thing/types/model.md", "# Model\n");
  },

  "not-kebab-case": (root) => {
    clean(root);
    write(root, "data/thing/types/thingModel.ts", "export interface ThingModel {}\n");
  },

  "test-outside-test-dir": (root) => {
    clean(root);
    write(root, "data/thing/api/list/list.test.ts", "// beside the code it covers\n");
  },

  "procedure-tree-dangling": (root) => {
    clean(root);
    write(
      root,
      "data/thing/api/list/list.md",
      "# API: `list`\n\n## Procedure Tree\n\n```text\nlist(scope)\n" +
        "└── paginate()        paginate.ts\n```\n"
    );
  }
};

/** Builds every fixture under `into`, replacing whatever was there. */
export const buildFixtures = (into) => {
  rmSync(into, { recursive: true, force: true });
  for (const [name, build] of Object.entries(FIXTURES)) {
    const root = join(into, name);
    mkdirSync(root, { recursive: true });
    build(root);
  }
  return into;
};
