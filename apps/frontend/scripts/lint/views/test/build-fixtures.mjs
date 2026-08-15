/**
 * A valid view tree, generated rather than committed.
 *
 * There is no real `src/lib/views` to copy yet, and there would be no reason to
 * copy it if there were: a fixture built from one description keeps the valid
 * contract in a single place, so a change to the standard edits this file rather
 * than a dozen near-identical trees.
 *
 * The fixture is deliberately maximal. Every concern is present, the component
 * tree nests twice, one procedure is complex, and one view composes another
 * through its root — so a rule that fires on legitimate structure is caught by
 * the valid case rather than by production months later.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const FILES = {
  // ---- workspace: exercises every concern ----
  "workspace/workspace.md": `# Workspace

The work surface for the active tab.

## Public Contract

- **Entry:** [workspace.svelte](workspace.svelte)
- **Types:** [types.ts](types.ts)
`,

  "workspace/workspace.svelte": `<script lang="ts">
  import DocumentEditor from "$views/document-editor/document-editor.svelte";
  import EmptyState from "$views/workspace/components/empty-state.svelte";
  import type { WorkspaceProps } from "$views/workspace/types";

  let { kind }: WorkspaceProps = $props();
</script>

{#if kind === "document"}
  <DocumentEditor />
{:else}
  <EmptyState />
{/if}
`,

  "workspace/types.ts": `export type WorkspaceProps = {
  kind: "document" | "empty";
};
`,

  "workspace/components/components.md": `# Workspace Components

## Component Tree

\`\`\`text
workspace.svelte
├── empty-state.svelte
└── tab-header/tab-header.svelte
    └── tab-header/components/tab-title.svelte
\`\`\`

## Key Selection

| Key value | Renders |
| --- | --- |
| \`document\` | the document editor view |
| \`empty\` | empty-state.svelte |
`,

  "workspace/components/empty-state.svelte": `<p>Nothing open.</p>
`,

  "workspace/components/tab-header/tab-header.svelte": `<script lang="ts">
  import TabTitle from "$views/workspace/components/tab-header/components/tab-title.svelte";
</script>

<header><TabTitle /></header>
`,

  "workspace/components/tab-header/components/tab-title.svelte": `<h1>Title</h1>
`,

  "workspace/interactions/interactions.md": `# Workspace Interactions

## Interaction Tree

\`\`\`text
open-document.ts
└── format-title()    ../procedures/format-title.ts
\`\`\`
`,

  "workspace/interactions/open-document.ts": `import { formatTitle } from "$views/workspace/procedures/format-title";

export const openDocument = (name: string): string => formatTitle(name);
`,

  "workspace/effects/effects.md": `# Workspace Effects

## Effect Tree

\`\`\`text
track-selection.svelte.ts
\`\`\`
`,

  "workspace/effects/track-selection.svelte.ts": `export const trackSelection = (read: () => string): void => {
  $effect(() => {
    console.log(read());
  });
};
`,

  "workspace/procedures/procedures.md": `# Workspace Procedures

## Procedure Tree

\`\`\`text
format-title.ts
reconcile-selection/reconcile-selection.ts
└── reconcile-selection/map-ranges.ts
\`\`\`
`,

  "workspace/procedures/format-title.ts": `export const formatTitle = (name: string): string => name.trim();
`,

  "workspace/procedures/reconcile-selection/reconcile-selection.ts": `import { mapRanges } from "$views/workspace/procedures/reconcile-selection/map-ranges";

export const reconcileSelection = (ranges: number[]): number[] => mapRanges(ranges);
`,

  "workspace/procedures/reconcile-selection/map-ranges.ts": `export const mapRanges = (ranges: number[]): number[] => [...ranges].sort();
`,

  "workspace/shared/shared.md": `# Workspace Shared State

## Construction

- **Constructor:** [create-shared.svelte.ts](create-shared.svelte.ts)
- **Types:** [types.ts](types.ts)
`,

  "workspace/shared/types.ts": `export type WorkspaceShared = {
  readonly selected: string;
};
`,

  "workspace/shared/create-shared.svelte.ts": `import type { WorkspaceShared } from "$views/workspace/shared/types";

export const createWorkspaceShared = (): WorkspaceShared => {
  let selected = $state("");
  return {
    get selected() {
      return selected;
    }
  };
};
`,

  "workspace/test/unit/format-title.test.ts": `import { expect, test } from "vitest";
import { formatTitle } from "$views/workspace/procedures/format-title";

test("trims", () => {
  expect(formatTitle(" a ")).toBe("a");
});
`,

  // ---- document-editor: the composed view ----
  "document-editor/document-editor.md": `# Document Editor

Renders one document.

## Public Contract

- **Entry:** [document-editor.svelte](document-editor.svelte)
`,

  "document-editor/document-editor.svelte": `<article>Document</article>
`,

  "document-editor/types.ts": `export type DocumentEditorProps = {
  resourceId: string;
};
`
};

/** Builds the valid tree in a throwaway directory and returns its roots. */
export const buildFixture = () => {
  const packageRoot = mkdtempSync(join(tmpdir(), "icarus-view-lint-"));
  const views = join(packageRoot, "src", "lib", "views");

  for (const [path, contents] of Object.entries(FILES)) {
    const target = join(views, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }

  return {
    packageRoot,
    views,
    scope: {
      views,
      source: join(packageRoot, "src"),
      base: packageRoot,
      aliases: { $views: "src/lib/views", $lib: "src/lib" }
    }
  };
};

export const removeFixture = ({ packageRoot }) => rmSync(packageRoot, { recursive: true, force: true });

// ------------------------------------------------------------- mutations ----

/** Adds a file, creating parents. The mutation most rules are broken by. */
export const write = ({ views }, path, contents = "") => {
  const target = join(views, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
  return target;
};

export const remove = ({ views }, path) => rmSync(join(views, path), { recursive: true, force: true });

export const rename = (fixture, from, to) => {
  const source = readFileSync(join(fixture.views, from), "utf8");
  remove(fixture, from);
  write(fixture, to, source);
};

export const replace = ({ views }, path, before, after) => {
  const target = join(views, path);
  const text = readFileSync(target, "utf8");
  if (!text.includes(before)) throw new Error(`fixture text not found in ${path}: ${before}`);
  writeFileSync(target, text.replace(before, after));
};
