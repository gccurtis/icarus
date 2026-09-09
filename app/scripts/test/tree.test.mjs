import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { breaking, discard, sandbox } from "./sandbox.mjs";

let base;

before(() => {
  base = sandbox();
});

after(() => discard(base));

test("the import graph distinguishes all-type named imports from value imports", async () => {
  await breaking(
    base,
    [{
      path: "src/lib/type-import-probe.ts",
      write:
        `import { type One, type Two as LocalTwo } from "$model/client/commands";\n` +
        `import { type Three, createCommands as build } from "$model/client/commands";\n` +
        `void build;\n`
    }],
    (tree) => {
      const imports = tree.imports(`${tree.base}/src/lib/type-import-probe.ts`);
      assert.equal(imports[0].type, true);
      assert.equal(imports[1].type, false);
    }
  );
});

test("Svelte imports use the same type-only classification", async () => {
  await breaking(
    base,
    [{
      path: "src/lib/type-import-probe.svelte",
      write:
        `<script lang="ts">\n` +
        `  import { type Command } from "$model/client/commands";\n` +
        `  import { type CommandId, createCommands } from "$model/client/commands";\n` +
        `</script>\n`
    }],
    (tree) => {
      const imports = tree.imports(`${tree.base}/src/lib/type-import-probe.svelte`);
      assert.equal(imports[0].type, true);
      assert.equal(imports[1].type, false);
    }
  );
});
