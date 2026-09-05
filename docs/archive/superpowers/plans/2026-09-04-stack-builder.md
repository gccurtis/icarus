# Stack Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A development surface at `/demo/stack-builder` where you drag component types into a stack, describe what each should show, save the manifest to a log, and generate a static HTML mock through OpenRouter that renders in an iframe.

**Architecture:** One development surface under `development-views/stack-builder/` plus three dev-only route handlers. The catalogue is a pure function over two `import.meta.glob` results. The stack is the one piece of reactive state, held in context. The mock is a real file on disk served by its own endpoint into a sandboxed iframe.

**Tech Stack:** Svelte 5 (runes), SvelteKit remote-free `+server.ts` handlers, vitest, `$authored-components/drag`, vendored shadcn `command`, OpenRouter chat completions.

**Spec:** [`docs/superpowers/specs/2026-09-04-stack-builder-design.md`](../specs/2026-09-04-stack-builder-design.md)

## Global Constraints

Every task's requirements implicitly include all of these.

- **No comments. Anywhere.** Not reasoning, not docstrings, not file headers, not section markers. The surrounding files are heavily commented and are pre-rule; do not match them. Reasoning goes in `stack-builder.md`.
- **`import type` for every type-only import.** `verbatimModuleSyntax: true` makes an inline `{ type X }` a runtime edge, which trips `client-server-separation`.
- **No relative imports, including in tests.** `$development-views/stack-builder/procedures/manifest`, never `./manifest`.
- **`procedures/` is rune-free.** `$state`/`$derived`/`$effect`/`$props` as an AST identifier anywhere in a `procedures/*.ts` fails `effects-declare-runes · others-declare-no-rune`. `.svelte.ts` does not exempt it — the check filters on `.ts`.
- **`shared/stack.svelte.ts` must be `.svelte.ts`.** A rune in a plain `.ts` under `shared/` compiles to an undefined call and fails at runtime, and no check catches it.
- **`shared/` constructs nothing at module load** and must export at least one value matching `/^(create|make|build|use|get)[A-Z]/`.
- **Surface root holds exactly:** `stack-builder.md`, `stack-builder.svelte`, `types.ts`, and the directories `components/ procedures/ shared/ test/`. A fourth root file is a finding; `index.ts` is separately banned.
- **No `.ts` file beside a route.** `routes/**/x.ts` resolves to no home and fails `module-has-one-home`. Shared server code lives at `procedures/log.server.ts`, which is server-home by filename even inside a client tree.
- **A `+server.ts` may not import a value from `development-views/`** — that tree is client by position, and server→client is `client-server-separation · server-takes-no-client-code`. `*.server.ts` under that tree is server by filename, so importing *that* is fine. Type-only imports are erased and always fine.
- **Never name a stylesheet through the alias.** `one-stylesheet-entry` regex-matches `$lib/styles/….css` in the raw text of every file under `src/`. Server code uses `src/lib/styles/...` path segments.
- **No literal colours and no `--theme-*`/`--palette-*`/`--chromatic-*` in any file under the surface, tests included.** `consumers-see-public-tokens-only` scans raw text. Only `--token-*` is public.
- **Grid tracks use the spacing unit**, `calc(var(--token-spacing-unit) * N)`, held in named custom properties on the root. Never bare `rem`.
- **Lint baseline is 32 findings across 6 checks, exit 1.** "Lint passes" is not available. The acceptance criterion is *no new finding names a stack-builder path*.
- **Commits stage an explicit file list.** Never `git add <dir>` — it sweeps concurrent work in other workstreams. Run `git diff --cached --name-status` and confirm every line before committing.

## File Structure

```text
app/src/lib/development-views/stack-builder/
├── stack-builder.md              written last; documented-paths-resolve reads it
├── stack-builder.svelte          the named grid, the one context, theme + revision
├── types.ts                      every shared type
├── components/
│   ├── components.md
│   ├── catalogue.svelte          left: filter + families + draggable rows
│   ├── stack-tree.svelte         centre-top: the drop zone and the rows
│   ├── entry-detail.svelte       centre-bottom: the selection's description
│   ├── generate-panel.svelte     right-top: model, generate, feedback, save/clear
│   └── mock-frame.svelte         right-bottom: the sandboxed iframe
├── procedures/
│   ├── procedures.md
│   ├── manifest.ts               pure node-tree operations
│   ├── catalogue.ts              pure: globbed modules → entries; the vendored six
│   ├── models.ts                 the ten model ids
│   ├── admission.ts              pure: is this client string safe as a path segment
│   ├── prompt.ts                 pure: payload → OpenRouter messages
│   └── log.server.ts             read/append the JSONL; server by filename
├── shared/
│   ├── shared.md
│   └── stack.svelte.ts           createStack / provideStack / stackOf
└── test/unit/
    ├── manifest.test.ts
    ├── catalogue.test.ts
    ├── admission.test.ts
    └── prompt.test.ts

app/src/routes/demo/stack-builder/
├── +page.svelte                  the two globs (must be literal) + the root
├── manifest/+server.ts           GET read · POST append
├── mock/+server.ts               GET serve · DELETE clear · POST save a copy
└── generate/+server.ts           POST a round → writes mock.html, appends a record
```

**Deferred to Task 9:** substacks. `stack-node.svelte` and the nesting operations do not exist until then, and nothing before it needs them.

---

### Task 1: Types, manifest operations, and the ignore rule

**Files:**
- Modify: `.gitignore`
- Create: `app/src/lib/development-views/stack-builder/types.ts`
- Create: `app/src/lib/development-views/stack-builder/procedures/manifest.ts`
- Test: `app/src/lib/development-views/stack-builder/test/unit/manifest.test.ts`

**Interfaces:**
- Produces: `StackNode`, `Manifest`, `CatalogueEntry`, `ModelChoice`, `LogRecord` and its three members; `insertAt`, `removeById`, `moveTo`, `findById`, `describeById`, `componentSources`.

- [ ] **Step 1: Add the ignore rule**

`.gitignore` has `logs/*.log` and `logs/*.jsonl`. A `*` does not cross a `/`, so `logs/stack-builder/plan.jsonl` and `logs/stack-builder/mocks/x.html` are both visible to git today. Add under the existing `logs/` lines:

```gitignore
logs/stack-builder/
```

- [ ] **Step 2: Write `types.ts`**

```ts
export type NodeSource = "authored" | "vendored";

export type ComponentNode = {
  kind: "component";
  id: string;
  source: NodeSource;
  name: string;
  path: string;
  description: string;
};

export type CustomNode = {
  kind: "custom";
  id: string;
  name: string;
  description: string;
};

export type SubstackNode = {
  kind: "substack";
  id: string;
  name: string;
  description: string;
  children: StackNode[];
};

export type StackNode = ComponentNode | CustomNode | SubstackNode;

export type Manifest = {
  slug: string;
  title: string;
  nodes: StackNode[];
};

export type CatalogueEntry = {
  id: string;
  source: NodeSource;
  name: string;
  family: string;
  path: string;
  reason: string;
};

export type ModelChoice = {
  id: string;
  label: string;
};

export type ManifestRecord = {
  at: string;
  kind: "manifest";
  title: string;
  nodes: StackNode[];
};

export type MockRecord = {
  at: string;
  kind: "mock";
  revision: number;
  model: string;
  feedback: string;
};

export type SavedRecord = {
  at: string;
  kind: "saved";
  file: string;
};

export type LogRecord = ManifestRecord | MockRecord | SavedRecord;

export type ComponentSource = {
  name: string;
  path: string;
};
```

- [ ] **Step 3: Write the failing test**

`test/unit/manifest.test.ts`. Test names are subject-first sentences, bare top-level `test()`, `node:assert/strict`.

```ts
import assert from "node:assert/strict";
import { test } from "vitest";
import {
  componentSources,
  describeById,
  findById,
  insertAt,
  moveTo,
  removeById
} from "$development-views/stack-builder/procedures/manifest";
import type { StackNode } from "$development-views/stack-builder/types";

const component = (id: string, over: Partial<StackNode> = {}): StackNode => ({
  kind: "component",
  id,
  source: "authored",
  name: "PanelStat",
  path: "src/lib/components/authored/panel/panel-stat.svelte",
  description: "",
  ...over
});

test("an insert lands at the index it names", () => {
  const nodes = [component("a"), component("b")];
  assert.deepEqual(
    insertAt(nodes, component("c"), 1).map((node) => node.id),
    ["a", "c", "b"]
  );
});

test("an insert past the end lands at the end", () => {
  const nodes = [component("a")];
  assert.deepEqual(
    insertAt(nodes, component("b"), 9).map((node) => node.id),
    ["a", "b"]
  );
});

test("a removal leaves the rest in order", () => {
  const nodes = [component("a"), component("b"), component("c")];
  assert.deepEqual(
    removeById(nodes, "b").map((node) => node.id),
    ["a", "c"]
  );
});

test("removing an id that is not there changes nothing", () => {
  const nodes = [component("a")];
  assert.deepEqual(removeById(nodes, "z"), nodes);
});

test("a move takes the node out before it puts it back, so the index means the result", () => {
  const nodes = [component("a"), component("b"), component("c")];
  assert.deepEqual(
    moveTo(nodes, "a", 2).map((node) => node.id),
    ["b", "c", "a"]
  );
});

test("moving a node onto itself is the identity", () => {
  const nodes = [component("a"), component("b")];
  assert.deepEqual(moveTo(nodes, "a", 0), nodes);
});

test("a description replaces only the node it names", () => {
  const nodes = [component("a"), component("b")];
  const after = describeById(nodes, "b", "the total");
  assert.equal(findById(after, "b")?.description, "the total");
  assert.equal(findById(after, "a")?.description, "");
});

test("the component sources are the component nodes, deduplicated by path", () => {
  const nodes = [
    component("a"),
    component("b"),
    component("c", { name: "PanelRow", path: "src/lib/components/authored/panel/panel-row.svelte" }),
    { kind: "custom", id: "d", name: "A banner", description: "" } as StackNode
  ];
  assert.deepEqual(
    componentSources(nodes).map((source) => source.name),
    ["PanelStat", "PanelRow"]
  );
});
```

- [ ] **Step 4: Run it and watch it fail**

```bash
nix develop ./infra/devshell --command sh -c 'cd app && pnpm test -- manifest'
```

Expected: FAIL, cannot resolve `$development-views/stack-builder/procedures/manifest`.

- [ ] **Step 5: Write `procedures/manifest.ts`**

```ts
import type { ComponentSource, StackNode } from "$development-views/stack-builder/types";

export const insertAt = (nodes: StackNode[], node: StackNode, at: number): StackNode[] => {
  const index = Math.max(0, Math.min(at, nodes.length));
  return [...nodes.slice(0, index), node, ...nodes.slice(index)];
};

export const removeById = (nodes: StackNode[], id: string): StackNode[] =>
  nodes.some((node) => node.id === id) ? nodes.filter((node) => node.id !== id) : nodes;

export const findById = (nodes: StackNode[], id: string): StackNode | undefined =>
  nodes.find((node) => node.id === id);

export const moveTo = (nodes: StackNode[], id: string, at: number): StackNode[] => {
  const node = findById(nodes, id);
  if (!node) return nodes;
  const without = nodes.filter((other) => other.id !== id);
  const index = Math.max(0, Math.min(at, without.length));
  if (without.length === nodes.length - 1 && nodes[index]?.id === id) return nodes;
  return [...without.slice(0, index), node, ...without.slice(index)];
};

export const describeById = (nodes: StackNode[], id: string, description: string): StackNode[] =>
  nodes.map((node) => (node.id === id ? { ...node, description } : node));

export const componentSources = (nodes: StackNode[]): ComponentSource[] => {
  const seen = new Set<string>();
  const found: ComponentSource[] = [];
  for (const node of nodes) {
    if (node.kind !== "component" || seen.has(node.path)) continue;
    seen.add(node.path);
    found.push({ name: node.name, path: node.path });
  }
  return found;
};
```

- [ ] **Step 6: Run the tests**

```bash
nix develop ./infra/devshell --command sh -c 'cd app && pnpm test -- manifest'
```

Expected: 8 passed.

- [ ] **Step 7: Commit**

```bash
git add .gitignore \
  app/src/lib/development-views/stack-builder/types.ts \
  app/src/lib/development-views/stack-builder/procedures/manifest.ts \
  app/src/lib/development-views/stack-builder/test/unit/manifest.test.ts
git diff --cached --name-status
git commit -m "feat(stack-builder): the manifest and its flat operations"
```

---

### Task 2: The catalogue, and the model list

**Files:**
- Create: `app/src/lib/development-views/stack-builder/procedures/catalogue.ts`
- Create: `app/src/lib/development-views/stack-builder/procedures/models.ts`
- Test: `app/src/lib/development-views/stack-builder/test/unit/catalogue.test.ts`

**Interfaces:**
- Consumes: `CatalogueEntry`, `ModelChoice` from Task 1.
- Produces: `catalogueFrom(indexes, files)`, `VENDORED`, `MODELS`.

The catalogue is a pure function rather than a reactive factory because it never changes after load. Two facts drive its shape:

1. `Object.keys` over the eight authored indexes yields **107** names, not 94 — eleven are chart helpers (`cagr`, `copyChart`, `SERIES_COLORS`…) and two are carousel-shelf aliases for components already listed. `typeof value === "function"` does not filter them; every export is a function and `markId` even has a component's arity. The only sound test is **identity against a `*/*.svelte` glob's default export**.
2. The glob pattern must be a literal at the call site, so this function receives the already-globbed records. Same reason `new Review(kind, modules)` takes its glob as an argument.

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { catalogueFrom, VENDORED } from "$development-views/stack-builder/procedures/catalogue";

const Panel = () => {};
const PanelRow = () => {};
const helper = () => {};

const indexes = {
  "/src/lib/components/authored/panel/index.ts": { Panel, PanelRow },
  "/src/lib/components/authored/chart/index.ts": { helper }
};

const files = {
  "/src/lib/components/authored/panel/panel.svelte": Panel,
  "/src/lib/components/authored/panel/panel-row.svelte": PanelRow
};

test("an export is a catalogue entry only when it is the default of a component file", () => {
  assert.deepEqual(
    catalogueFrom(indexes, files)
      .filter((entry) => entry.source === "authored")
      .map((entry) => entry.name),
    ["Panel", "PanelRow"]
  );
});

test("an authored entry carries the path of the file it was found in", () => {
  const entry = catalogueFrom(indexes, files).find((found) => found.name === "PanelRow");
  assert.equal(entry?.path, "src/lib/components/authored/panel/panel-row.svelte");
  assert.equal(entry?.family, "panel");
});

test("entries are sorted, because an eager glob's key order differs between dev and build", () => {
  const names = catalogueFrom(
    { "/src/lib/components/authored/panel/index.ts": { PanelRow, Panel } },
    files
  ).map((entry) => entry.name);
  assert.deepEqual(names.slice(0, 2), ["Panel", "PanelRow"]);
});

test("the six vendored entries are appended, each carrying its reason", () => {
  const vendored = catalogueFrom(indexes, files).filter((entry) => entry.source === "vendored");
  assert.equal(vendored.length, 6);
  assert.deepEqual(
    vendored.map((entry) => entry.name),
    ["accordion", "checkbox", "pagination", "separator", "tabs", "toggle"]
  );
  assert.ok(vendored.every((entry) => entry.reason.length > 0));
});

test("a vendored entry points at its index, which is the only path it may be entered at", () => {
  const entry = catalogueFrom(indexes, files).find((found) => found.name === "tabs");
  assert.equal(entry?.path, "src/lib/components/vendored/tabs/index.ts");
});

test("every entry id is unique", () => {
  const ids = catalogueFrom(indexes, files).map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("VENDORED is the curated six and nothing else", () => {
  assert.equal(VENDORED.length, 6);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
nix develop ./infra/devshell --command sh -c 'cd app && pnpm test -- catalogue'
```

Expected: FAIL, cannot resolve the module.

- [ ] **Step 3: Write `procedures/catalogue.ts`**

The `reason` is a data field, not a comment — the surface renders it, which is also what keeps it out of the banned comment territory.

```ts
import type { CatalogueEntry } from "$development-views/stack-builder/types";

export const VENDORED: readonly { name: string; reason: string }[] = [
  { name: "accordion", reason: "a disclosure list; PanelBranch is a tree node, not this" },
  { name: "checkbox", reason: "PanelToggle is a switch, PanelMarks is independent marks" },
  { name: "pagination", reason: "nothing in either family pages a list" },
  { name: "separator", reason: "real structure in a stack" },
  { name: "tabs", reason: "no authored word at all" },
  { name: "toggle", reason: "a pressed state, distinct from a switch" }
];

const familyOf = (key: string): string => key.split("/").slice(-2)[0] ?? "";

const trimmed = (key: string): string => key.replace(/^\//, "");

export const catalogueFrom = (
  indexes: Record<string, Record<string, unknown>>,
  files: Record<string, unknown>
): CatalogueEntry[] => {
  const pathOf = new Map<unknown, string>();
  for (const [key, value] of Object.entries(files)) {
    if (value !== undefined && !pathOf.has(value)) pathOf.set(value, trimmed(key));
  }

  const authored: CatalogueEntry[] = [];
  const claimed = new Set<string>();

  for (const [key, module] of Object.entries(indexes)) {
    const family = familyOf(key);
    for (const name of Object.keys(module).sort()) {
      const path = pathOf.get(module[name]);
      if (!path || claimed.has(path)) continue;
      claimed.add(path);
      authored.push({ id: `authored/${name}`, source: "authored", name, family, path, reason: "" });
    }
  }

  authored.sort((a, b) => a.name.localeCompare(b.name));

  const vendored = VENDORED.map(({ name, reason }) => ({
    id: `vendored/${name}`,
    source: "vendored" as const,
    name,
    family: "vendored",
    path: `src/lib/components/vendored/${name}/index.ts`,
    reason
  }));

  return [...authored, ...vendored];
};
```

- [ ] **Step 4: Run the tests**

```bash
nix develop ./infra/devshell --command sh -c 'cd app && pnpm test -- catalogue'
```

Expected: 7 passed.

- [ ] **Step 5: Write `procedures/models.ts`**

Verified against OpenRouter's live catalogue on 2026-09-04. A dead id fails at call time with the id named, and the fix is one line.

```ts
import type { ModelChoice } from "$development-views/stack-builder/types";

export const MODELS: readonly ModelChoice[] = [
  { id: "anthropic/claude-opus-5", label: "Claude Opus 5" },
  { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash" },
  { id: "openai/gpt-5.5", label: "GPT-5.5" },
  { id: "moonshotai/kimi-k3", label: "Kimi K3" },
  { id: "deepseek/deepseek-v4-pro-0813", label: "DeepSeek V4 Pro" },
  { id: "z-ai/glm-4.7", label: "GLM 4.7" },
  { id: "x-ai/grok-build-0.1", label: "Grok Build 0.1" },
  { id: "minimax/minimax-m2.7", label: "MiniMax M2.7" }
];

export const DEFAULT_MODEL = "anthropic/claude-sonnet-5";
```

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/development-views/stack-builder/procedures/catalogue.ts \
  app/src/lib/development-views/stack-builder/procedures/models.ts \
  app/src/lib/development-views/stack-builder/test/unit/catalogue.test.ts
git diff --cached --name-status
git commit -m "feat(stack-builder): the catalogue reads the vocabulary indexes"
```

---

### Task 3: Admission, and the log

**Files:**
- Create: `app/src/lib/development-views/stack-builder/procedures/admission.ts`
- Create: `app/src/lib/development-views/stack-builder/procedures/log.server.ts`
- Test: `app/src/lib/development-views/stack-builder/test/unit/admission.test.ts`

**Interfaces:**
- Produces: `isSafeName(value)`, `isSafeSourcePath(value)`; `logPath(slug)`, `readLog(slug)`, `appendLog(slug, record)`, `mockPath()`, `savedMockPath(name)`, `stylesText()`.

Two client strings become path segments — the manifest slug and the saved-mock name — and one becomes a file to read, the component source path. The store makes the same argument about table names and does not leave it as a claim; neither does this.

`log.server.ts` is the only legal home for code all three handlers share: a `routes/**/x.ts` has no home, a `routes/**/x.server.ts` is only reachable by a relative import the linter rejects, and `shared/` would impose its own export-name rule. A `*.server.ts` under a client tree is server by filename.

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { isSafeName, isSafeSourcePath } from "$development-views/stack-builder/procedures/admission";

test("a kebab name is admitted", () => {
  assert.equal(isSafeName("header-v2"), true);
  assert.equal(isSafeName("plan"), true);
});

test("a name that would escape the directory is refused", () => {
  for (const attempt of ["../users", "../../etc/passwd", "/etc/passwd", "a/../b", ".", ".."]) {
    assert.equal(isSafeName(attempt), false, attempt);
  }
});

test("a name that is not a kebab string is refused", () => {
  for (const attempt of ["Header", "a b", "a_b", "", "a".repeat(65), 7, null, undefined]) {
    assert.equal(isSafeName(attempt), false, String(attempt));
  }
});

test("a source path under the component trees is admitted", () => {
  assert.equal(isSafeSourcePath("src/lib/components/authored/panel/panel.svelte"), true);
  assert.equal(isSafeSourcePath("src/lib/components/vendored/tabs/index.ts"), true);
});

test("a source path outside the component trees, or reaching upward, is refused", () => {
  for (const attempt of [
    "src/lib/styles/app.css",
    "../.env",
    "src/lib/components/authored/../../../../.env",
    "/etc/passwd",
    "src/lib/components/authored/panel/panel.js",
    ""
  ]) {
    assert.equal(isSafeSourcePath(attempt), false, attempt);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
nix develop ./infra/devshell --command sh -c 'cd app && pnpm test -- admission'
```

Expected: FAIL, cannot resolve the module.

- [ ] **Step 3: Write `procedures/admission.ts`**

```ts
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SOURCE = /^src\/lib\/components\/(authored|vendored)\/[a-z0-9-]+\/[a-z0-9-]+\.(svelte|ts)$/;

export const isSafeName = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 64 && NAME.test(value);

export const isSafeSourcePath = (value: unknown): value is string =>
  typeof value === "string" && !value.includes("..") && SOURCE.test(value);
```

- [ ] **Step 4: Run the tests**

```bash
nix develop ./infra/devshell --command sh -c 'cd app && pnpm test -- admission'
```

Expected: 5 passed.

- [ ] **Step 5: Write `procedures/log.server.ts`**

The repository root is derived from `process.cwd()` exactly as the comments endpoint does, because `pnpm dev` runs from `app/`. `import.meta.url` must not be used — under Vite the module is bundled into `build/server/` and the derived directory exists and is wrong.

The eight stylesheet paths are written as `src/lib/styles/...` segments, never through the `$lib/styles` alias, which `one-stylesheet-entry` regex-matches in raw text. Their **order is load-bearing**: `celestial` and `cyberpunk` have identical specificity, so cyberpunk only wins by being second.

```ts
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

import type { LogRecord } from "$development-views/stack-builder/types";

const root = process.cwd().endsWith(`${sep}app`) ? resolve(process.cwd(), "..") : process.cwd();
const LOGS = join(root, "logs", "stack-builder");

const STYLES = [
  "chromatic-themes/celestial/celestial.css",
  "chromatic-themes/cyberpunk/cyberpunk.css",
  "chromatic-themes/slots.css",
  "semantic-tokens/color.css",
  "semantic-tokens/typography.css",
  "semantic-tokens/spacing.css",
  "semantic-tokens/shape.css",
  "semantic-tokens/motion.css"
];

export const logPath = (slug: string): string => join(LOGS, `${slug}.jsonl`);

export const mockPath = (): string => join(LOGS, "mock.html");

export const savedMockPath = (name: string): string => join(LOGS, "mocks", `${name}.html`);

export const readLog = async (slug: string): Promise<LogRecord[]> => {
  const path = logPath(slug);
  if (!existsSync(path)) return [];
  const raw = await readFile(path, "utf8");
  return raw.split("\n").flatMap((line) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line) as LogRecord];
    } catch {
      return [];
    }
  });
};

export const appendLog = async (slug: string, record: LogRecord): Promise<void> => {
  await mkdir(LOGS, { recursive: true });
  await appendFile(logPath(slug), `${JSON.stringify(record)}\n`, "utf8");
};

export const writeMock = async (html: string): Promise<void> => {
  await mkdir(dirname(mockPath()), { recursive: true });
  await appendFile(mockPath(), "", "utf8");
  await readFile(mockPath(), "utf8");
};

export const readSource = async (path: string): Promise<string> =>
  readFile(join(process.cwd(), path), "utf8");

export const stylesText = async (): Promise<string> => {
  const base = join(process.cwd(), "src", "lib", "styles");
  const parts = await Promise.all(STYLES.map((name) => readFile(join(base, name), "utf8")));
  return parts.join("\n");
};
```

Replace the placeholder `writeMock` above with a plain write:

```ts
import { writeFile } from "node:fs/promises";

export const writeMock = async (html: string): Promise<void> => {
  await mkdir(LOGS, { recursive: true });
  await writeFile(mockPath(), html, "utf8");
};

export const saveMock = async (name: string): Promise<string> => {
  const html = existsSync(mockPath()) ? await readFile(mockPath(), "utf8") : "";
  await mkdir(join(LOGS, "mocks"), { recursive: true });
  await writeFile(savedMockPath(name), html, "utf8");
  return `mocks/${name}.html`;
};

export const readMock = async (): Promise<string | undefined> =>
  existsSync(mockPath()) ? readFile(mockPath(), "utf8") : undefined;
```

- [ ] **Step 6: Typecheck**

```bash
nix develop ./infra/devshell --command sh -c 'cd app && pnpm typecheck'
```

Expected: no error naming a stack-builder path. Pre-existing errors in `stage.ts`, `overlay/index.ts` and `projection.test.ts` are someone else's in-flight work; leave them.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/development-views/stack-builder/procedures/admission.ts \
  app/src/lib/development-views/stack-builder/procedures/log.server.ts \
  app/src/lib/development-views/stack-builder/test/unit/admission.test.ts
git diff --cached --name-status
git commit -m "feat(stack-builder): admission for client-named paths, and the log"
```

---

### Task 4: The surface — grid, catalogue, stack, detail

**Files:**
- Create: `app/src/lib/development-views/stack-builder/shared/stack.svelte.ts`
- Create: `app/src/lib/development-views/stack-builder/stack-builder.svelte`
- Create: `app/src/lib/development-views/stack-builder/components/catalogue.svelte`
- Create: `app/src/lib/development-views/stack-builder/components/stack-tree.svelte`
- Create: `app/src/lib/development-views/stack-builder/components/entry-detail.svelte`
- Create: `app/src/routes/demo/stack-builder/+page.svelte`

**Interfaces:**
- Consumes: `catalogueFrom`, `VENDORED` (Task 2); `insertAt`, `removeById`, `moveTo`, `describeById`, `findById` (Task 1).
- Produces: `createStack(entries)`, `provideStack(stack)`, `stackOf()`; the four grid regions.

At the end of this task the surface builds a stack and does nothing else, which is useful on its own.

- [ ] **Step 1: Write `shared/stack.svelte.ts`**

Named `stackOf` rather than `stack` because a local called `stack` is what every consuming component wants to call its own variable. `createStack` satisfies `shared-hands-out-no-instance`'s export-name rule; nothing is constructed at module load.

```ts
import { getContext, setContext } from "svelte";

import {
  describeById,
  findById,
  insertAt,
  moveTo,
  removeById
} from "$development-views/stack-builder/procedures/manifest";
import type { CatalogueEntry, StackNode } from "$development-views/stack-builder/types";

export type Stack = ReturnType<typeof createStack>;

const KEY = Symbol("stack-builder-stack");

export const createStack = (entries: CatalogueEntry[]) => {
  let nodes = $state<StackNode[]>([]);
  let selectedId = $state("");
  let title = $state("Untitled stack");
  let minted = 0;

  const mint = (): string => {
    minted += 1;
    return `n${minted}`;
  };

  return {
    entries,
    get nodes(): StackNode[] {
      return nodes;
    },
    get title(): string {
      return title;
    },
    set title(next: string) {
      title = next;
    },
    get selectedId(): string {
      return selectedId;
    },
    get selected(): StackNode | undefined {
      return findById(nodes, selectedId);
    },
    select(id: string): void {
      selectedId = id;
    },
    add(entryId: string, at = nodes.length): void {
      const entry = entries.find((found) => found.id === entryId);
      if (!entry) return;
      const node: StackNode = {
        kind: "component",
        id: mint(),
        source: entry.source,
        name: entry.name,
        path: entry.path,
        description: ""
      };
      nodes = insertAt(nodes, node, at);
      selectedId = node.id;
    },
    addCustom(name: string): void {
      const node: StackNode = { kind: "custom", id: mint(), name, description: "" };
      nodes = insertAt(nodes, node, nodes.length);
      selectedId = node.id;
    },
    remove(id: string): void {
      nodes = removeById(nodes, id);
      if (selectedId === id) selectedId = nodes[0]?.id ?? "";
    },
    move(id: string, at: number): void {
      nodes = moveTo(nodes, id, at);
    },
    describe(id: string, description: string): void {
      nodes = describeById(nodes, id, description);
    },
    load(next: { title: string; nodes: StackNode[] }): void {
      title = next.title;
      nodes = next.nodes;
      selectedId = next.nodes[0]?.id ?? "";
      for (const node of next.nodes) {
        const n = Number(node.id.replace(/^n/, ""));
        if (Number.isFinite(n) && n > minted) minted = n;
      }
    }
  };
};

export const provideStack = (stack: Stack): void => {
  setContext(KEY, stack);
};

export const stackOf = (): Stack => getContext<Stack>(KEY);
```

- [ ] **Step 2: Write the route page**

The globs must be literal at the call site — Vite resolves them at build time and cannot see a variable, a constant, or a template. The spelling is `$lib/...`, matching the three existing review routes.

```svelte
<script lang="ts">
  import StackBuilder from "$development-views/stack-builder/stack-builder.svelte";

  const indexes = import.meta.glob("$lib/components/authored/*/index.ts", {
    eager: true
  }) as Record<string, Record<string, unknown>>;

  const files = import.meta.glob("$lib/components/authored/*/*.svelte", {
    eager: true,
    import: "default"
  }) as Record<string, unknown>;
</script>

<StackBuilder {indexes} {files} />
```

- [ ] **Step 3: Write `stack-builder.svelte`**

One track template, four regions. `minmax(0, …)` on both content rows — `minmax(auto, …)` sets the row's *minimum* to its content size, so a long description grows the grid past `100vh` and `overflow: hidden` clips it unreachably. Every region carries `min-width: 0; min-height: 0` or its `overflow: auto` never triggers. No child declares `grid-area`; the root wraps each one.

```svelte
<script lang="ts">
  import Catalogue from "$development-views/stack-builder/components/catalogue.svelte";
  import EntryDetail from "$development-views/stack-builder/components/entry-detail.svelte";
  import StackTree from "$development-views/stack-builder/components/stack-tree.svelte";
  import { catalogueFrom } from "$development-views/stack-builder/procedures/catalogue";
  import { createStack, provideStack } from "$development-views/stack-builder/shared/stack.svelte";

  let {
    indexes,
    files
  }: {
    indexes: Record<string, Record<string, unknown>>;
    files: Record<string, unknown>;
  } = $props();

  // svelte-ignore state_referenced_locally
  const stack = createStack(catalogueFrom(indexes, files));
  provideStack(stack);
</script>

<svelte:head><title>Stack builder — Icarus</title></svelte:head>

<div class="builder">
  <header class="head">
    <a href="/demo" class="text-caption text-interactive-text hover:underline">← Design system</a>
    <h1 class="text-h4 font-semibold">Stack builder</h1>
    <span class="text-caption text-ink-muted">
      {stack.entries.length} components · {stack.nodes.length} in the stack
    </span>
  </header>

  <aside class="list"><Catalogue /></aside>
  <main class="stack"><StackTree /></main>
  <section class="detail"><EntryDetail /></section>
  <aside class="ai"></aside>
</div>

<style>
  .builder {
    --builder-list: calc(var(--token-spacing-unit) * 72);
    --builder-ai: calc(var(--token-spacing-unit) * 96);
    --builder-detail: calc(var(--token-spacing-unit) * 56);

    display: grid;
    grid-template-columns: var(--builder-list) minmax(0, 1fr) var(--builder-ai);
    grid-template-rows: auto minmax(0, 1fr) minmax(0, var(--builder-detail));
    grid-template-areas:
      "head head head"
      "list stack ai"
      "list detail ai";
    height: 100vh;
    overflow: hidden;
    background-color: var(--token-surface-canvas);
    color: var(--token-ink-primary);
  }

  .head {
    grid-area: head;
    display: flex;
    align-items: baseline;
    gap: calc(var(--token-spacing-unit) * 3);
    border-bottom: 1px solid var(--token-border-subtle);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
  }

  .list {
    grid-area: list;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    border-inline-end: 1px solid var(--token-border-subtle);
    background-color: var(--token-surface-panel);
  }

  .stack {
    grid-area: stack;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    background-color: var(--token-surface-work);
  }

  .detail {
    grid-area: detail;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    border-block-start: 1px solid var(--token-border-subtle);
    background-color: var(--token-surface-panel);
  }

  .ai {
    grid-area: ai;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    border-inline-start: 1px solid var(--token-border-subtle);
    background-color: var(--token-surface-panel);
  }
</style>
```

- [ ] **Step 4: Write `components/catalogue.svelte`**

`Draggable` is only draggable when `destinations.length > 0 && onplace !== undefined` — both halves are required, or the row renders with no grip and no menu. Families are disclosures that open in place, never a drill-down with a back control.

```svelte
<script lang="ts">
  import { Draggable } from "$authored-components/drag";
  import { stackOf } from "$development-views/stack-builder/shared/stack.svelte";
  import { Input } from "$vendored-components/input";

  const stack = stackOf();

  let filter = $state("");
  let open = $state<Record<string, boolean>>({});

  const matching = $derived(
    stack.entries.filter((entry) =>
      `${entry.name} ${entry.family}`.toLowerCase().includes(filter.trim().toLowerCase())
    )
  );

  const families = $derived(
    [...new Set(matching.map((entry) => entry.family))].map((family) => ({
      family,
      entries: matching.filter((entry) => entry.family === family)
    }))
  );

  const DESTINATIONS = [{ value: "stack", label: "Add to the stack" }];
</script>

<div class="flex flex-col gap-2 p-3">
  <Input bind:value={filter} placeholder="Filter components" aria-label="Filter components" />

  {#each families as group (group.family)}
    <button
      type="button"
      class="text-caption text-ink-muted flex items-center gap-2 pt-2 text-left font-semibold tracking-wide uppercase"
      aria-expanded={open[group.family] !== false}
      onclick={() => (open[group.family] = open[group.family] === false)}
    >
      {group.family}
      <span class="text-ink-muted tabular-nums">{group.entries.length}</span>
    </button>

    {#if open[group.family] !== false}
      {#each group.entries as entry (entry.id)}
        <Draggable
          id={entry.id}
          label={entry.name}
          destinations={DESTINATIONS}
          onplace={() => stack.add(entry.id)}
        >
          <div class="min-w-0">
            <div class="text-body-sm truncate">{entry.name}</div>
            {#if entry.reason}
              <div class="text-caption text-ink-muted truncate">{entry.reason}</div>
            {/if}
          </div>
        </Draggable>
      {/each}
    {/if}
  {/each}
</div>
```

- [ ] **Step 5: Write `components/stack-tree.svelte`**

`DropZone` renders its `children` only when `count > 0`, and lays them out `flex flex-wrap items-center gap-1` — a wrapping chip row. A vertical stack needs its own `flex flex-col` wrapper inside the snippet.

A catalogue entry id and a stack node id arrive through the same transfer, so the drop handler distinguishes them by prefix: catalogue ids are `authored/…` or `vendored/…`, node ids are `n1`, `n2`.

```svelte
<script lang="ts">
  import { Draggable, DropZone } from "$authored-components/drag";
  import { stackOf } from "$development-views/stack-builder/shared/stack.svelte";
  import { Button } from "$vendored-components/button";

  const stack = stackOf();

  const receive = (dragged: string, at: number) => {
    if (dragged.includes("/")) stack.add(dragged, at);
    else stack.move(dragged, at);
  };

  const additions = $derived([{ value: "custom", label: "Add a custom entry…" }]);
</script>

<div class="flex flex-col gap-3 p-3">
  <DropZone
    label="The stack"
    empty="Drag a component here, or add one from the menu"
    count={stack.nodes.length}
    {additions}
    onadd={() => stack.addCustom("A custom entry")}
    ondrop={(dragged) => receive(dragged, stack.nodes.length)}
  >
    <div class="flex w-full flex-col gap-1">
      {#each stack.nodes as node, index (node.id)}
        <div class:selected={node.id === stack.selectedId}>
          <Draggable
            id={node.id}
            label={node.name}
            destinations={[
              { value: "up", label: "Move up" },
              { value: "down", label: "Move down" }
            ]}
            onplace={(where) => stack.move(node.id, where === "up" ? index - 1 : index + 1)}
            onreceive={(dragged) => receive(dragged, index)}
          >
            <button
              type="button"
              class="flex w-full min-w-0 items-baseline gap-2 text-left"
              onclick={() => stack.select(node.id)}
            >
              <span class="text-body-sm truncate">{node.name}</span>
              <span class="text-caption text-ink-muted truncate">
                {node.description || "no description yet"}
              </span>
            </button>
          </Draggable>
        </div>
      {/each}
    </div>
  </DropZone>

  {#if stack.selected}
    <Button variant="ghost" size="sm" onclick={() => stack.remove(stack.selectedId)}>
      Remove {stack.selected.name}
    </Button>
  {/if}
</div>

<style>
  .selected {
    border-radius: var(--token-radius-control);
    background-color: var(--token-surface-selection);
  }
</style>
```

- [ ] **Step 6: Write `components/entry-detail.svelte`**

```svelte
<script lang="ts">
  import { stackOf } from "$development-views/stack-builder/shared/stack.svelte";
  import { Textarea } from "$vendored-components/textarea";

  const stack = stackOf();
</script>

<div class="flex h-full flex-col gap-2 p-3">
  {#if stack.selected}
    <div class="flex items-baseline gap-2">
      <span class="text-body-sm font-semibold">{stack.selected.name}</span>
      <span class="text-caption text-ink-muted font-mono">
        {stack.selected.kind === "component" ? stack.selected.path : stack.selected.kind}
      </span>
    </div>
    <Textarea
      class="flex-1"
      placeholder="What should this show?"
      aria-label="What this entry should show"
      value={stack.selected.description}
      oninput={(event) => stack.describe(stack.selectedId, event.currentTarget.value)}
    />
  {:else}
    <p class="text-caption text-ink-muted">Select an entry to describe what it shows.</p>
  {/if}
</div>
```

- [ ] **Step 7: Run it**

```bash
nix develop ./infra/devshell --command sh -c 'cd app && pnpm dev'
```

Open `http://localhost:3000/demo/stack-builder`. Expected: the catalogue lists ~100 entries grouped by family; dragging one into the centre zone adds it; the menu path adds it too; selecting a row lets you type a description into the bottom pane; reordering by drag and by menu both work.

- [ ] **Step 8: Lint and typecheck**

```bash
nix develop ./infra/devshell --command node app/scripts/lint.mjs surfaces across
nix develop ./infra/devshell --command sh -c 'cd app && pnpm typecheck'
```

Expected: no finding names a stack-builder path. The baseline 32 findings are unchanged.

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/development-views/stack-builder/shared/stack.svelte.ts \
  app/src/lib/development-views/stack-builder/stack-builder.svelte \
  app/src/lib/development-views/stack-builder/components/catalogue.svelte \
  app/src/lib/development-views/stack-builder/components/stack-tree.svelte \
  app/src/lib/development-views/stack-builder/components/entry-detail.svelte \
  app/src/routes/demo/stack-builder/+page.svelte
git diff --cached --name-status
git commit -m "feat(stack-builder): a stack is built by drag and described in prose"
```

---

### Task 5: Saving and reopening a manifest

**Files:**
- Create: `app/src/routes/demo/stack-builder/manifest/+server.ts`
- Modify: `app/src/lib/development-views/stack-builder/stack-builder.svelte`

**Interfaces:**
- Consumes: `readLog`, `appendLog` (Task 3); `isSafeName` (Task 3).
- Produces: `GET /demo/stack-builder/manifest?slug=<slug>` → `{ records }`; `POST` `{ slug, title, nodes }` → 201.

`error()` from `@sveltejs/kit` throws and is typed `never` — write it as a bare statement, with no `throw` and no `return`. It reaches the client as `{"message":"…"}`, so the client reads `.message` rather than showing the envelope.

- [ ] **Step 1: Write the handler**

```ts
import { dev } from "$app/environment";
import { error, json } from "@sveltejs/kit";

import { isSafeName } from "$development-views/stack-builder/procedures/admission";
import { appendLog, readLog } from "$development-views/stack-builder/procedures/log.server";
import type { ManifestRecord, StackNode } from "$development-views/stack-builder/types";

import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  if (!dev) return new Response("not found", { status: 404 });

  const slug = url.searchParams.get("slug") ?? "";
  if (!isSafeName(slug)) error(400, "a slug is lower-case words joined by hyphens");

  return json({ records: await readLog(slug) });
};

export const POST: RequestHandler = async ({ request }) => {
  if (!dev) return new Response("not found", { status: 404 });

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") error(400, "expected a JSON object");

  const { slug, title, nodes } = body as Record<string, unknown>;
  if (!isSafeName(slug)) error(400, "a slug is lower-case words joined by hyphens");
  if (typeof title !== "string" || !title.trim()) error(400, "a stack carries a title");
  if (!Array.isArray(nodes)) error(400, "nodes is an array");

  const record: ManifestRecord = {
    at: new Date().toISOString(),
    kind: "manifest",
    title: title.trim(),
    nodes: nodes as StackNode[]
  };

  await appendLog(slug, record);
  return json(record, { status: 201 });
};
```

- [ ] **Step 2: Add the slug, save and open controls to the head**

In `stack-builder.svelte`, add to the `<script>`:

```ts
  let slug = $state("untitled");
  let saving = $state("");

  const save = async () => {
    saving = "";
    const response = await fetch("/demo/stack-builder/manifest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, title: stack.title, nodes: stack.nodes })
    });
    if (!response.ok) {
      const said = (await response.json().catch(() => ({}))) as { message?: string };
      saving = said.message ?? `save refused (${response.status})`;
    }
  };

  const open = async () => {
    saving = "";
    const response = await fetch(`/demo/stack-builder/manifest?slug=${slug}`);
    if (!response.ok) {
      saving = `no stack called ${slug}`;
      return;
    }
    const body = (await response.json()) as { records: { kind: string; title: string; nodes: [] }[] };
    const last = [...body.records].reverse().find((record) => record.kind === "manifest");
    if (last) stack.load({ title: last.title, nodes: last.nodes });
    else saving = `no stack called ${slug}`;
  };
```

And to the header markup, after the title:

```svelte
    <Input class="w-40" bind:value={slug} aria-label="Stack name" />
    <Button variant="outline" size="sm" onclick={save}>Save</Button>
    <Button variant="ghost" size="sm" onclick={open}>Open</Button>
    {#if saving}<span class="text-caption text-danger-text">{saving}</span>{/if}
```

with `import { Button } from "$vendored-components/button";` and `import { Input } from "$vendored-components/input";` added.

- [ ] **Step 3: Verify by hand**

With the dev server up: build a two-entry stack, type a slug, Save, reload the page, Open. Expected: the stack comes back with its descriptions. Then:

```bash
cat logs/stack-builder/untitled.jsonl
git status --porcelain logs/
```

Expected: one JSON object per line; `git status` shows nothing under `logs/`.

- [ ] **Step 4: Commit**

```bash
git add app/src/routes/demo/stack-builder/manifest/+server.ts \
  app/src/lib/development-views/stack-builder/stack-builder.svelte
git diff --cached --name-status
git commit -m "feat(stack-builder): a stack is saved to a log and reopened"
```

---

### Task 6: The mock file and its frame

**Files:**
- Create: `app/src/routes/demo/stack-builder/mock/+server.ts`
- Create: `app/src/lib/development-views/stack-builder/components/mock-frame.svelte`
- Modify: `app/src/lib/development-views/stack-builder/stack-builder.svelte`

**Interfaces:**
- Consumes: `readMock`, `writeMock`, `saveMock`, `stylesText` (Task 3); `isSafeName` (Task 3).
- Produces: `GET /demo/stack-builder/mock?theme=&r=` → `text/html`; `DELETE` → clears; `POST` `{ name }` → saves a copy.

Four behaviours with no template anywhere in the repo. Three things the design would otherwise get wrong:

1. **`mock.html` cannot be committed** — `logs/stack-builder/` is now ignored, and a fresh checkout has no file. GET **synthesizes an empty themed document when the file is absent**, which is the same code path DELETE produces. There is no placeholder to hand-write.
2. **The iframe would appear frozen after a generation** — the URL is fixed and the browser re-serves from cache. The response sets `cache-control: no-store` *and* the client puts a revision counter in the URL.
3. **A same-origin iframe gives CSS isolation, not script isolation.** A model-generated `<script>` could reach `window.parent` and mutate the builder. `sandbox=""` blocks scripts and leaves CSS working. `allow-scripts allow-same-origin` together must never be used.

- [ ] **Step 1: Write the handler**

```ts
import { dev } from "$app/environment";
import { error, json } from "@sveltejs/kit";

import { isSafeName } from "$development-views/stack-builder/procedures/admission";
import {
  readMock,
  saveMock,
  stylesText,
  writeMock
} from "$development-views/stack-builder/procedures/log.server";

import type { RequestHandler } from "./$types";

const THEMES = ["celestial", "cyberpunk"];

const document = (css: string, theme: string, body: string): string =>
  `<!doctype html>\n<html lang="en" data-theme="${theme}">\n<head><meta charset="utf-8"><style>${css}</style></head>\n<body>${body}</body>\n</html>\n`;

const EMPTY = `<p style="color: var(--token-ink-muted); font-family: var(--token-font-sans); padding: 2rem">Nothing generated yet.</p>`;

export const GET: RequestHandler = async ({ url }) => {
  if (!dev) return new Response("not found", { status: 404 });

  const asked = url.searchParams.get("theme") ?? "celestial";
  const theme = THEMES.includes(asked) ? asked : "celestial";
  const held = await readMock();
  const html = held ?? document(await stylesText(), theme, EMPTY);

  return new Response(html.replace(/data-theme="[a-z]+"/, `data-theme="${theme}"`), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
};

export const DELETE: RequestHandler = async ({ url }) => {
  if (!dev) return new Response("not found", { status: 404 });

  const asked = url.searchParams.get("theme") ?? "celestial";
  const theme = THEMES.includes(asked) ? asked : "celestial";
  await writeMock(document(await stylesText(), theme, EMPTY));
  return json({ cleared: true });
};

export const POST: RequestHandler = async ({ request }) => {
  if (!dev) return new Response("not found", { status: 404 });

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") error(400, "expected a JSON object");

  const { name } = body as Record<string, unknown>;
  if (!isSafeName(name)) error(400, "a name is lower-case words joined by hyphens");

  return json({ file: await saveMock(name) }, { status: 201 });
};
```

- [ ] **Step 2: Write `components/mock-frame.svelte`**

```svelte
<script lang="ts">
  let { theme, revision }: { theme: string; revision: number } = $props();

  const src = $derived(`/demo/stack-builder/mock?theme=${theme}&r=${revision}`);
</script>

<iframe {src} title="The generated mock" sandbox="" class="h-full w-full border-0"></iframe>
```

- [ ] **Step 3: Mount it and add the theme control**

In `stack-builder.svelte`, add to the `<script>`:

```ts
  import MockFrame from "$development-views/stack-builder/components/mock-frame.svelte";
  import { storedTheme } from "$surfaces/top-bar/effects/apply-theme.svelte";

  let theme = $state(storedTheme());
  let revision = $state(0);
```

and fill the `ai` region:

```svelte
  <aside class="ai">
    <div class="border-border-subtle flex items-center gap-2 border-b p-2">
      <Button
        variant="ghost"
        size="sm"
        onclick={() => (theme = theme === "celestial" ? "cyberpunk" : "celestial")}
      >
        {theme}
      </Button>
    </div>
    <MockFrame {theme} {revision} />
  </aside>
```

- [ ] **Step 4: Verify by hand**

Open the page. Expected: the right column shows "Nothing generated yet." in the token ink colour, and pressing the theme button flips the mock's background with the tokens resolving. Then:

```bash
curl -s -o /dev/null -w '%{http_code} %{size_download} %{content_type}\n' \
  'http://localhost:3000/demo/stack-builder/mock?theme=cyberpunk'
```

Expected: `200`, roughly 35,000 bytes, `text/html; charset=utf-8`.

- [ ] **Step 5: Commit**

```bash
git add app/src/routes/demo/stack-builder/mock/+server.ts \
  app/src/lib/development-views/stack-builder/components/mock-frame.svelte \
  app/src/lib/development-views/stack-builder/stack-builder.svelte
git diff --cached --name-status
git commit -m "feat(stack-builder): the mock is a file, served into a sandboxed frame"
```

---

### Task 7: The prompt, and the generation round

**Files:**
- Create: `app/src/lib/development-views/stack-builder/procedures/prompt.ts`
- Create: `app/src/routes/demo/stack-builder/generate/+server.ts`
- Create: `app/src/lib/development-views/stack-builder/components/generate-panel.svelte`
- Test: `app/src/lib/development-views/stack-builder/test/unit/prompt.test.ts`
- Modify: `app/src/lib/development-views/stack-builder/stack-builder.svelte`

**Interfaces:**
- Consumes: `componentSources` (Task 1); `MODELS`, `DEFAULT_MODEL` (Task 2); `isSafeSourcePath`, `readSource`, `stylesText`, `writeMock`, `appendLog`, `readLog` (Task 3).
- Produces: `buildMessages(input)`; `POST /demo/stack-builder/generate`.

Three things fixed here:

- **The key is `env.OPENROUTER_API_KEY` from `$env/dynamic/private`.** Verified on 2026-09-04: `process.env.OPENROUTER_API_KEY` is `undefined`, and `$env/static/private` would fail the *build* when the variable is absent. The key resolves because `svelte.config.js` sets `kit.env.dir = ".."`.
- **The CSS text is passed into `buildMessages` as an argument, never imported by it.** Under vitest a `?raw` CSS import evaluates to the empty string, so a test asserting anything about the brief would pass vacuously.
- **The server reads the component sources itself** from paths the client sends, each admitted by `isSafeSourcePath`. The alternative — a client-side `?raw` glob — puts 353 KB of component source into the browser bundle on every page load.

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { buildMessages } from "$development-views/stack-builder/procedures/prompt";
import type { StackNode } from "$development-views/stack-builder/types";

const nodes: StackNode[] = [
  {
    kind: "component",
    id: "n1",
    source: "authored",
    name: "PanelStat",
    path: "src/lib/components/authored/panel/panel-stat.svelte",
    description: "the total number of findings"
  },
  { kind: "custom", id: "n2", name: "A verdict ribbon", description: "pass or fail, in one line" }
];

const input = {
  title: "Findings flank",
  nodes,
  brief: ":root { --token-ink-primary: black }",
  sources: [{ name: "PanelStat", path: "a/b.svelte", text: "<script>let {}</script>" }]
};

test("the system message forbids utility classes and names the token vocabulary", () => {
  const { system } = buildMessages(input);
  assert.match(system, /--token-/);
  assert.match(system, /class/i);
});

test("the user message carries every entry's name and description", () => {
  const { user } = buildMessages(input);
  assert.match(user, /PanelStat/);
  assert.match(user, /the total number of findings/);
  assert.match(user, /A verdict ribbon/);
  assert.match(user, /pass or fail, in one line/);
});

test("the brief is carried verbatim, because it is the token vocabulary", () => {
  assert.match(buildMessages(input).user, /--token-ink-primary: black/);
});

test("a custom entry is marked as having no component behind it", () => {
  assert.match(buildMessages(input).user, /no component/i);
});

test("component source is included under the name it was found for", () => {
  const { user } = buildMessages(input);
  assert.match(user, /a\/b\.svelte/);
  assert.match(user, /let \{\}/);
});

test("without feedback the round asks for a mock, with feedback it asks for a revision", () => {
  assert.doesNotMatch(buildMessages(input).user, /revise/i);
  const revised = buildMessages({ ...input, previous: "<p>old</p>", feedback: "too heavy" });
  assert.match(revised.user, /revise/i);
  assert.match(revised.user, /too heavy/);
  assert.match(revised.user, /<p>old<\/p>/);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
nix develop ./infra/devshell --command sh -c 'cd app && pnpm test -- prompt'
```

Expected: FAIL, cannot resolve the module.

- [ ] **Step 3: Write `procedures/prompt.ts`**

```ts
import type { StackNode } from "$development-views/stack-builder/types";

export type PromptInput = {
  title: string;
  nodes: StackNode[];
  brief: string;
  sources: readonly { name: string; path: string; text: string }[];
  previous?: string;
  feedback?: string;
};

const SYSTEM = [
  "You produce a single static HTML fragment: the body of a mock screen.",
  "Return only HTML. No markdown fence, no commentary, no <html>, <head> or <body> tag.",
  "You may include one <style> element at the top of your output.",
  "Every colour, size, radius, font and duration must be a var(--token-*) reference.",
  "Never use a Tailwind or utility class name. The document has no utility stylesheet;",
  "a class name will render unstyled. Write CSS in your <style> element instead.",
  "Never include a <script>. The frame is sandboxed and it will not run.",
  "Match the markup and structure of the component sources you are given."
].join("\n");

const entry = (node: StackNode, index: number): string => {
  const what = node.description.trim() || "(nothing said)";
  if (node.kind === "custom") {
    return `${index + 1}. ${node.name} — no component in our vocabulary; invent it.\n   Shows: ${what}`;
  }
  if (node.kind === "substack") {
    const inner = node.children.map((child, at) => `   ${entry(child, at)}`).join("\n");
    return `${index + 1}. ${node.name} — a group.\n   Shows: ${what}\n${inner}`;
  }
  return `${index + 1}. ${node.name} (${node.path})\n   Shows: ${what}`;
};

export const buildMessages = (input: PromptInput): { system: string; user: string } => {
  const stack = input.nodes.map(entry).join("\n");

  const sources = input.sources
    .map((source) => `--- ${source.name} · ${source.path}\n${source.text}`)
    .join("\n\n");

  const task =
    input.feedback && input.previous
      ? [
          "Revise the mock below. Change what the feedback asks for and leave the rest alone.",
          "",
          `Feedback: ${input.feedback}`,
          "",
          "The mock to revise:",
          input.previous
        ].join("\n")
      : "Produce the mock.";

  const user = [
    `# The screen: ${input.title}`,
    "",
    "## The stack, top to bottom",
    stack,
    "",
    "## The token vocabulary — these are the only colours, sizes and fonts that exist",
    input.brief,
    "",
    "## The components named above, as they are actually written",
    sources,
    "",
    "## Task",
    task
  ].join("\n");

  return { system: SYSTEM, user };
};
```

- [ ] **Step 4: Run the tests**

```bash
nix develop ./infra/devshell --command sh -c 'cd app && pnpm test -- prompt'
```

Expected: 6 passed.

- [ ] **Step 5: Write `generate/+server.ts`**

```ts
import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { error, json } from "@sveltejs/kit";

import { isSafeName, isSafeSourcePath } from "$development-views/stack-builder/procedures/admission";
import {
  appendLog,
  readLog,
  readMock,
  readSource,
  stylesText,
  writeMock
} from "$development-views/stack-builder/procedures/log.server";
import { buildMessages } from "$development-views/stack-builder/procedures/prompt";
import type { MockRecord, StackNode } from "$development-views/stack-builder/types";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

const bodyOf = (html: string): string =>
  html.replace(/^[\s\S]*?<body>/, "").replace(/<\/body>[\s\S]*$/, "");

export const POST: RequestHandler = async ({ request }) => {
  if (!dev) return new Response("not found", { status: 404 });

  const key = env.OPENROUTER_API_KEY;
  if (!key) error(500, "OPENROUTER_API_KEY is not set — check .env and kit.env.dir");

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") error(400, "expected a JSON object");

  const { slug, title, nodes, model, feedback, sources, theme } = body as Record<string, unknown>;
  if (!isSafeName(slug)) error(400, "a slug is lower-case words joined by hyphens");
  if (typeof title !== "string" || !title.trim()) error(400, "a stack carries a title");
  if (!Array.isArray(nodes) || nodes.length === 0) error(400, "the stack is empty");
  if (typeof model !== "string" || !model.includes("/")) error(400, "a model id names a provider");
  if (!Array.isArray(sources)) error(400, "sources is an array");

  const asked = sources as { name?: unknown; path?: unknown }[];
  for (const source of asked) {
    if (!isSafeSourcePath(source.path)) error(400, `refused source path: ${String(source.path)}`);
  }

  const brief = await stylesText();
  const read = await Promise.all(
    asked.map(async (source) => ({
      name: String(source.name),
      path: source.path as string,
      text: await readSource(source.path as string)
    }))
  );

  const said = typeof feedback === "string" ? feedback.trim() : "";
  const previous = said ? bodyOf((await readMock()) ?? "") : "";

  const { system, user } = buildMessages({
    title: title.trim(),
    nodes: nodes as StackNode[],
    brief,
    sources: read,
    ...(said && previous ? { previous, feedback: said } : {})
  });

  const answer = await fetch(ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  if (!answer.ok) error(502, `${model} refused it (${answer.status}): ${await answer.text()}`);

  const payload = (await answer.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) error(502, `${model} returned no content`);

  const html = content.replace(/^```(?:html)?\n?/, "").replace(/```$/, "");
  const wanted = theme === "cyberpunk" ? "cyberpunk" : "celestial";
  const document = `<!doctype html>\n<html lang="en" data-theme="${wanted}">\n<head><meta charset="utf-8"><style>${brief}</style></head>\n<body>${html}</body>\n</html>\n`;

  await writeMock(document);

  const records = await readLog(slug);
  const revision = records.filter((record) => record.kind === "manifest").length;
  const record: MockRecord = {
    at: new Date().toISOString(),
    kind: "mock",
    revision,
    model,
    feedback: said
  };
  await appendLog(slug, record);

  return json(record, { status: 201 });
};
```

Add `import type { RequestHandler } from "./$types";` with the other imports.

- [ ] **Step 6: Write `components/generate-panel.svelte`**

```svelte
<script lang="ts">
  import { componentSources } from "$development-views/stack-builder/procedures/manifest";
  import { DEFAULT_MODEL, MODELS } from "$development-views/stack-builder/procedures/models";
  import { stackOf } from "$development-views/stack-builder/shared/stack.svelte";
  import { Button } from "$vendored-components/button";
  import { Textarea } from "$vendored-components/textarea";

  let {
    slug,
    theme,
    ongenerated
  }: { slug: string; theme: string; ongenerated: () => void } = $props();

  const stack = stackOf();

  let model = $state(DEFAULT_MODEL);
  let feedback = $state("");
  let running = $state(false);
  let failure = $state("");

  const generate = async () => {
    running = true;
    failure = "";
    try {
      const response = await fetch("/demo/stack-builder/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          theme,
          model,
          feedback,
          title: stack.title,
          nodes: stack.nodes,
          sources: componentSources(stack.nodes)
        })
      });
      if (!response.ok) {
        const said = (await response.json().catch(() => ({}))) as { message?: string };
        failure = said.message ?? `generation failed (${response.status})`;
        return;
      }
      feedback = "";
      ongenerated();
    } catch {
      failure = "the dev server is unreachable";
    } finally {
      running = false;
    }
  };

  const clear = async () => {
    await fetch(`/demo/stack-builder/mock?theme=${theme}`, { method: "DELETE" });
    ongenerated();
  };

  const save = async () => {
    failure = "";
    const response = await fetch("/demo/stack-builder/mock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: slug })
    });
    if (!response.ok) {
      const said = (await response.json().catch(() => ({}))) as { message?: string };
      failure = said.message ?? `save refused (${response.status})`;
    }
  };
</script>

<div class="flex flex-col gap-2 p-2">
  <select
    bind:value={model}
    aria-label="Model"
    class="border-border-subtle bg-surface-elevated text-body-sm rounded-control border p-1"
  >
    {#each MODELS as choice (choice.id)}
      <option value={choice.id}>{choice.label}</option>
    {/each}
  </select>

  <Textarea
    bind:value={feedback}
    rows={3}
    placeholder="What should change? Leave empty for a first pass."
    aria-label="Feedback for the next round"
  />

  <div class="flex items-center gap-2">
    <Button size="sm" disabled={running || stack.nodes.length === 0} onclick={generate}>
      {running ? "Generating…" : feedback.trim() ? "Revise" : "Generate"}
    </Button>
    <Button variant="outline" size="sm" onclick={save}>Save</Button>
    <Button variant="ghost" size="sm" onclick={clear}>Clear</Button>
  </div>

  {#if failure}
    <p class="text-caption text-danger-text">{failure}</p>
  {/if}
</div>
```

- [ ] **Step 7: Mount it**

In `stack-builder.svelte`, put `<GeneratePanel {slug} {theme} ongenerated={() => (revision += 1)} />` above `<MockFrame {theme} {revision} />` inside the `ai` region, beside the theme button.

- [ ] **Step 8: Verify by hand**

Build a three-entry stack with descriptions, pick a model, Generate. Expected: the iframe fills with a themed mock within a few seconds. Type feedback, press Revise, and expect a changed mock rather than a fresh one. Press Save and check `logs/stack-builder/mocks/<slug>.html` exists.

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/development-views/stack-builder/procedures/prompt.ts \
  app/src/lib/development-views/stack-builder/test/unit/prompt.test.ts \
  app/src/routes/demo/stack-builder/generate/+server.ts \
  app/src/lib/development-views/stack-builder/components/generate-panel.svelte \
  app/src/lib/development-views/stack-builder/stack-builder.svelte
git diff --cached --name-status
git commit -m "feat(stack-builder): a manifest becomes a mock through OpenRouter"
```

---

### Task 8: The documents

**Files:**
- Create: `app/src/lib/development-views/stack-builder/stack-builder.md`
- Create: `app/src/lib/development-views/stack-builder/components/components.md`
- Create: `app/src/lib/development-views/stack-builder/procedures/procedures.md`
- Create: `app/src/lib/development-views/stack-builder/shared/shared.md`

Written **last**, because `documented-paths-resolve` resolves every markdown link and every backticked multi-segment path with a known extension against the filesystem. A document naming a file that does not exist yet is a new finding.

Two spelling rules: resolution bases stop at `app/`, so a repo-root path needs `../../../../docs/…`; and the check currently has 5 findings, so the verification is *still 5, none naming stack-builder*.

Keep them conceptual. The `StackNode` union, the grid block and the record shapes live in the source and the spec; repeating them here creates the stale second copy the house rule exists to prevent.

- [ ] **Step 1: Write `stack-builder.md`**

Follow `review.md`'s section order: Purpose, Boundary, Public Contract, Dependencies (with `Object` and `Capability` column headers), Directory Documents, Rendered States, Accessibility, Layout and Overflow, View Invariants. Say, in prose and once each:

- why the manifest names a component rather than rendering one;
- why the mock is a file and not `srcdoc`, and why the frame is sandboxed;
- why the token layer is read from disk per request rather than imported;
- why the catalogue's vendored half is six entries and not forty-three;
- that the mock renders in the system font, because `@font-face` is per-document and the builder's IBM Plex does not reach the frame.

- [ ] **Step 2: Write the three concern documents**

`components.md` carries the component tree as a fenced block. `procedures.md` names all six procedures with input, transformation and output — a procedure's own document is the one place the tree is the point. `shared.md` says why the stack is the only shared state and why it dies with the mount.

- [ ] **Step 3: Verify**

```bash
nix develop ./infra/devshell --command node app/scripts/lint.mjs surfaces
```

Expected: `documented-paths-resolve` still reports exactly 5 findings, none naming a stack-builder path.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/development-views/stack-builder/stack-builder.md \
  app/src/lib/development-views/stack-builder/components/components.md \
  app/src/lib/development-views/stack-builder/procedures/procedures.md \
  app/src/lib/development-views/stack-builder/shared/shared.md
git diff --cached --name-status
git commit -m "docs(stack-builder): what the surface owns and what it does not"
```

---

### Task 9: Substacks

Last, because nesting is the one interaction with no precedent in the codebase and nothing before it depends on it.

**Files:**
- Modify: `app/src/lib/development-views/stack-builder/procedures/manifest.ts`
- Modify: `app/src/lib/development-views/stack-builder/test/unit/manifest.test.ts`
- Create: `app/src/lib/development-views/stack-builder/components/stack-node.svelte`
- Modify: `app/src/lib/development-views/stack-builder/components/stack-tree.svelte`
- Modify: `app/src/lib/development-views/stack-builder/shared/stack.svelte.ts`

**The drag components do not compose for a tree, and this is the whole difficulty.** Four measured facts:

1. **A `Draggable` must not contain a `Draggable`.** `dragstart` bubbles and there is no `stopPropagation` anywhere in that path, so the outer handler overwrites the inner id with its own — dragging a child silently drags its parent.
2. **A substack's `DropZone` must not sit inside that substack's `Draggable`.** The drop fires the zone's `ondrop`, then the enclosing `Draggable.receive` fires `onreceive` for the same drop. The draggable header must be a **sibling** of the zone, not its ancestor.
3. **Nested `DropZone`s both fire.** Neither calls `stopPropagation`, so a drop into a substack also reaches the root zone and the node is added twice.
4. **`accepts` is consulted only at drop time, never on dragover**, so a zone highlights for a drag it will refuse — including a substack dragged into itself.

- [ ] **Step 1: Write the failing tests**

Add to `manifest.test.ts`: inserting into a substack by parent id; removing a substack removes its children; moving a node out of a substack to the root; refusing to move a substack into its own descendant; `componentSources` walking into substacks.

- [ ] **Step 2: Extend `procedures/manifest.ts`**

Add `insertInto(nodes, parentId, node, at)`, `moveInto(nodes, id, parentId, at)` and `isDescendant(nodes, id, ofId)`, and make `removeById`, `findById`, `describeById` and `componentSources` recurse. Keep every one of them pure and rune-free.

- [ ] **Step 3: Write `components/stack-node.svelte`**

One node. A substack renders its `Draggable` header and its `DropZone` as **siblings**, never nested. The zone's `ondrop` calls `event.stopPropagation()` before delegating — wrap the handler rather than relying on the vocabulary.

- [ ] **Step 4: Verify by hand**

Expected: dragging a child of a substack moves the child, not the substack; dropping into a substack adds one node, not two; dragging a substack into itself is refused.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/development-views/stack-builder/procedures/manifest.ts \
  app/src/lib/development-views/stack-builder/test/unit/manifest.test.ts \
  app/src/lib/development-views/stack-builder/components/stack-node.svelte \
  app/src/lib/development-views/stack-builder/components/stack-tree.svelte \
  app/src/lib/development-views/stack-builder/shared/stack.svelte.ts
git diff --cached --name-status
git commit -m "feat(stack-builder): a stack holds a stack"
```

---

## Verification

Run at the end of every task, not only at the end:

```bash
nix develop ./infra/devshell --command sh -c 'cd app && pnpm test'
nix develop ./infra/devshell --command sh -c 'cd app && pnpm typecheck'
nix develop ./infra/devshell --command node app/scripts/lint.mjs
```

- **test:** all stack-builder tests pass. No baseline to regress — this is the first tested development-view.
- **typecheck:** no error naming a stack-builder path. `stage.ts`, `overlay/index.ts` and `projection.test.ts` have pre-existing errors from in-flight slide-deck work; leave them alone.
- **lint:** the baseline is **32 findings across 6 checks, exit 1**. The criterion is that no finding names a stack-builder path — not a clean run, which is not available.
