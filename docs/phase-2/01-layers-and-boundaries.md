# 01 · Layers and Boundaries

*Verified against source at commit ef6d462, 2026-08-09.*

Everything under `apps/backend/src` lives in one of six numbered directories. This page states
what each one owns, what it actually imports (measured, not intended), how the alias map that
carries those imports is built, where the boundary is deliberately inverted, and how the single
composition root assembles the result. Where the code breaks its own rule, the rule and the
break are both named.

The backend is **236 TypeScript files / 47,936 lines**. Nothing here is enforced by a linter —
there is no ESLint, Biome, or dependency-cruiser configuration anywhere in the repository. The
boundaries hold because `tsc` resolves them and a handful of hand-written regression tests read
the repository as text. That is the whole enforcement story, and §8 sets out exactly what it does
and does not cover.

---

## 1 · The six numbered directories

| Layer | Files | Lines | Owns | Imports (measured) |
| --- | ---: | ---: | --- | --- |
| [`0-platform`](../../apps/backend/src/0-platform) | 52 | 9,301 | Reusable in-process runtimes injected into capabilities: Formula, Rich Text, Knowledge, Intelligence, the `Logger` interface, the Knowledge SQLite adapter, and an empty Web Retrieval scaffold | `#platform` 58 (self), `#formula` 1 |
| [`0-utils`](../../apps/backend/src/0-utils) | 9 | 1,632 | Config loading, `RequestEnvelope`, Job types, `JobRegistry`, `JobScheduler`, the internal-job runtime, the shared revision-history DDL and retention scheduler | `#utils` 7 (self), `#platform` 1 |
| [`1-init`](../../apps/backend/src/1-init) | 24 | 1,680 | The composition root: construction order, the concrete `create*` factories, the cross-capability adapters, startup and shutdown lifecycle | everything concrete — 18 alias families, 141 statements |
| [`2-transport`](../../apps/backend/src/2-transport) | 1 | 125 | The single Fastify wildcard handler and envelope normalisation | `#utils` 3, `#platform` 1 |
| [`3-capabilities`](../../apps/backend/src/3-capabilities) | 133 | 32,246 | Domain types, invariants, application services, owned ports, persistence, projections — 13 capability directories | `#utils` 29, `#platform` 26, `#rich-text` 15, `#context` 9, `#formula` 4, `#derived-outputs` 3 |
| [`4-job-wiring`](../../apps/backend/src/4-job-wiring) | 16 | 2,938 | Exact `METHOD path` → job-factory mappings, wire validation, queue and response-mode choice, internal-stage registration | `#utils` 27, `#platform` 10, then 15 more families totalling 28 statements — including exactly **one `#init`** |
| `src/index.ts` | 1 | 14 | Process entry point: two `dotenv` loads, then `startBackend()` | `#init` 1 |

`0-platform` and `0-utils` are peers at level 0, not ordered relative to each other. The
directory split is by role: `0-platform` holds *runtimes that get injected into capabilities*;
`0-utils` holds *transport-neutral primitives that no capability injects*.

The four subdirectories of `0-utils` are `config`, `jobs`, `persistence`, `types`. The seven of
`0-platform` are `database`, `formula`, `intelligence`, `knowledge`, `observability`,
`rich-text`, `web-retrieval` — the last of which contains **zero TypeScript** (a `.gitkeep` and a
six-page `docs/` package) and is imported by nothing.

### Why 4 sits above 3 in number but below it in the call graph

`4-job-wiring` calls into `3-capabilities`, so under a strict "higher number imports lower
number" reading it should be numbered 2.5. The numbering instead encodes **adaptation distance
from the domain and construction position**. Job wiring is the outermost adapter, furthest from
the domain core, and it is the last thing registered during startup; capabilities are the
innermost thing that is not a shared primitive. Reading the digits as import direction fails on
two edges and reading them as distance-from-domain fails on none:

```text
0-platform  ─┐
0-utils     ─┴─→  1-init  ─→  2-transport
                     │             │
                     ├──────→ 4-job-wiring ──→ 3-capabilities
                     └────────────────────────→ 3-capabilities
```

`1-init` is the other edge that breaks a naive numeric reading: it imports `#job-wiring/*` 13
times and reaches into every capability. That is not a violation — it is what a composition root
is. `1-init` is the one layer permitted to know every concrete class in the tree, including
concrete SQLite store classes, and it is the only layer that does.

---

## 2 · The measured import graph

Counted with `grep -rhoE 'from "#[a-z-]+' <layer> --include=*.ts`, aggregated by alias family:

| From layer | Alias families it imports (statement count) |
| --- | --- |
| `0-platform` | `#platform` 58, `#formula` 1 |
| `0-utils` | `#utils` 7, `#platform` 1 |
| `1-init` | `#platform` 35, `#utils` 25, `#init` 24, `#job-wiring` 13, `#formula` 7, `#derived-outputs` 5, `#context` 5, `#connector` 5, `#structured-data` 4, `#rich-text` 4, `#activity` 4, `#investigation` 2, `#general-files` 2, `#document` 2, `#transport` 1, `#templates` 1, `#persona` 1, `#comments` 1 |
| `2-transport` | `#utils` 3, `#platform` 1 |
| `3-capabilities` | `#utils` 29, `#platform` 26, `#rich-text` 15, `#context` 9, `#formula` 4, `#derived-outputs` 3 |
| `4-job-wiring` | `#utils` 27, `#platform` 10, `#document` 4, `#capabilities` 4, `#formula` 3, `#derived-outputs` 3, `#context` 3, `#structured-data` 2, `#templates` 1, `#persona` 1, `#job-wiring` 1, `#investigation` 1, **`#init` 1**, `#general-files` 1, `#connector` 1, `#comments` 1, `#activity` 1 |

Five facts fall out of that table. All five are clean; the one violation is §2.1.

- **`0-platform` and `0-utils` never import upward.** No `#init`, `#transport`, `#capabilities`,
  `#job-wiring`, or capability-module alias appears in either directory.
- **`2-transport` imports only `#utils` (3) and `#platform` (1).** The whole transport layer
  ([`registerHttpTransport.ts`](../../apps/backend/src/2-transport/registerHttpTransport.ts), 125
  lines) knows no capability by name. See
  [02 · Request and job runtime](02-request-and-job-runtime.md).
- **`3-capabilities` never imports `1-init`, `2-transport`, or `4-job-wiring`.**
- **Zero deep relative imports escape a module.**
  `grep -rnE 'from "\.\./\.\./\.\.' src --include=*.ts` returns **0** matches. Relative imports
  never leave their own module directory; everything longer goes through an alias.
- **Every cross-capability import inside layer 3 is `import type`.** Layer 3 makes 31 cross-module
  alias imports in total: 19 into platform barrels (`#rich-text` 15, `#formula` 4) and **12 into
  another capability** (`#context` 9, `#derived-outputs` 3). All 12 are type-only, and none of the
  31 reaches an `application/` or `persistence/` path — every one lands on a barrel or a
  `types.ts`. The single value-level cross-module import in the whole of layer 3 is
  `document/application/documentService.ts:4` — `import { formatFormulaValue, toWire } from
  "#formula"` — and Formula is `0-platform`, not a capability.

### 2.1 The one measured violation

There is exactly one backward-pointing import in the tree. Layer 4 imports layer 1:

```ts
// apps/backend/src/4-job-wiring/structured-data/registerStructuredDataEndpoints.ts:8
import type { FormulaNameResolver } from "#init/create/formula-name-resolver.js";
```

([`registerStructuredDataEndpoints.ts:8`](../../apps/backend/src/4-job-wiring/structured-data/registerStructuredDataEndpoints.ts))

It is `import type`, so the statement is erased at build time and no runtime cycle exists. It is
still a genuine structural dependency of job wiring on the composition root, and it exists for
one reason: the `FormulaNameResolver` **interface** is declared inside
[`1-init/create/formula-name-resolver.ts:15-18`](../../apps/backend/src/1-init/create/formula-name-resolver.ts)
alongside its 438-line implementation, rather than in a capability or in `0-utils`. Structured
Data's endpoint group needs the type to name its parameter, and there is nowhere lower to get it
from.

Every other placement in the tree obeys the numbering. This is the single exception, and moving
the interface — to `0-utils/types/` or to `#structured-data` — would remove it.

### 2.2 The deliberate inversion: `ContextEntry`

`ContextEntry` reads at every call site as if the Context capability owns it. It does not.

[`3-capabilities/context/types.ts:1-7`](../../apps/backend/src/3-capabilities/context/types.ts),
verbatim:

```ts
// Context capability types.
// ContextEntry is defined in knowledge/types.ts (the platform layer that needs it).
// Context imports it from there to avoid duplicating the atom.

import type { ContextEntry } from "#platform/knowledge/types.js";

export type { ContextEntry };
```

The declaration is at
[`0-platform/knowledge/types.ts:85`](../../apps/backend/src/0-platform/knowledge/types.ts):

```ts
/** The shared resource-reference atom used by Context and scope-aware retrieval. */
export interface ContextEntry {
  id: string;
  kind: string;  // e.g. "document", "context"
}
```

Six capabilities import it — Document (4 files), Templates, Persona, Slides, Structured Data,
Derived Outputs — and all six import it from `#context` or `#context/types.js`. Ownership reads
correctly at the call site while the dependency arrow stays 3 → 0. If Context declared it, every
one of those six would be a 3 → 3 edge and Knowledge, a platform module, would need it back.

The superseded design page states this backwards — `phase-1/runtime/repository-boundaries.md:170`
says *"`ContextEntry` belongs to Context and is re-exported for Knowledge"*. It is exactly
inverted, and the archive is not current.

---

## 3 · The alias map

Deep relative imports are replaced by Node subpath imports declared in
`apps/backend/package.json` `"imports"` and mirrored in `apps/backend/tsconfig.json`
`compilerOptions.paths`.

**32 aliases.** The two maps were compared programmatically at HEAD:

```text
imports entries: 32   tsconfig paths entries: 32
in imports not in paths: []      in paths not in imports: []
same order: true
condition key shapes: [ 'development|types|default' ]
dev-vs-paths mismatches: 0
```

Every entry has exactly three conditions in declaration order `development` → `types` →
`default`, and every `development` target is byte-identical to the corresponding `paths` target.
Node picks the first matching key; `types` is a TypeScript-only condition Node never activates.
Therefore:

| Runner | Condition selected | Resolves to |
| --- | --- | --- |
| plain `node` (`pnpm start`) | `default` | `./dist/**` |
| `node --conditions=development` (`pnpm dev`, `pnpm test`) | `development` | `./src/**` |
| `tsc` (`pnpm build`, `pnpm typecheck`) | `types`, and `paths` agrees | `./src/**` |

Dropping `--conditions=development` silently runs the compiled tree instead of source, with no
error and no warning. That failure mode and the `dist/` staleness hazard belong to
[09 · Configuration](09-configuration.md) and [00 · Orientation](00-orientation.md); what matters
here is that the alias map is the mechanism.

### 3.1 The full table

`Uses` counts `from "<alias>…"` statements in `src/**/*.ts`. Tests use relative paths and
reference the aliases only as strings in `package.json` assertions, with one exception noted in
§3.4.

| # | Alias | `development` / `types` target | `default` target | Uses |
| ---: | --- | --- | --- | ---: |
| 1 | `#utils/*` | `./src/0-utils/*` | `./dist/0-utils/*` | 91 |
| 2 | `#init/*` | `./src/1-init/*` | `./dist/1-init/*` | 26 |
| 3 | `#transport/*` | `./src/2-transport/*` | `./dist/2-transport/*` | 1 |
| 4 | `#capabilities/*` | `./src/3-capabilities/*` | `./dist/3-capabilities/*` | 4 |
| 5 | `#job-wiring/*` | `./src/4-job-wiring/*` | `./dist/4-job-wiring/*` | 14 |
| 6 | `#platform/*` | `./src/0-platform/*` | `./dist/0-platform/*` | 131 |
| 7 | `#formula` | `./src/0-platform/formula/index.ts` | `./dist/0-platform/formula/index.js` | 12 |
| 8 | `#formula/*` | `./src/0-platform/formula/*` | `./dist/0-platform/formula/*` | 3 |
| 9 | `#structured-data` | `./src/3-capabilities/structured-data/index.ts` | `./dist/…/index.js` | 3 |
| 10 | `#structured-data/*` | `./src/3-capabilities/structured-data/*` | `./dist/…/*` | 3 |
| 11 | `#context` | `./src/3-capabilities/context/index.ts` | `./dist/…/index.js` | 15 |
| 12 | `#context/*` | `./src/3-capabilities/context/*` | `./dist/…/*` | 2 |
| 13 | `#rich-text` | `./src/0-platform/rich-text/index.ts` | `./dist/0-platform/rich-text/index.js` | 18 |
| 14 | `#rich-text/*` | `./src/0-platform/rich-text/*` | `./dist/0-platform/rich-text/*` | 1 |
| 15 | `#derived-outputs` | `./src/3-capabilities/derived-outputs/index.ts` | `./dist/…/index.js` | 11 |
| 16 | `#derived-outputs/*` | `./src/3-capabilities/derived-outputs/*` | `./dist/…/*` | **0** |
| 17 | `#activity` | `./src/3-capabilities/activity/index.ts` | `./dist/…/index.js` | 5 |
| 18 | `#activity/*` | `./src/3-capabilities/activity/*` | `./dist/…/*` | **0** |
| 19 | `#persona` | `./src/3-capabilities/persona/index.ts` | `./dist/…/index.js` | 2 |
| 20 | `#persona/*` | `./src/3-capabilities/persona/*` | `./dist/…/*` | **0** |
| 21 | `#comments` | `./src/3-capabilities/comments/index.ts` | `./dist/…/index.js` | 2 |
| 22 | `#comments/*` | `./src/3-capabilities/comments/*` | `./dist/…/*` | **0** |
| 23 | `#templates` | `./src/3-capabilities/templates/index.ts` | `./dist/…/index.js` | 2 |
| 24 | `#templates/*` | `./src/3-capabilities/templates/*` | `./dist/…/*` | **0** |
| 25 | `#document` | `./src/3-capabilities/document/index.ts` | `./dist/…/index.js` | 6 |
| 26 | `#document/*` | `./src/3-capabilities/document/*` | `./dist/…/*` | **0** |
| 27 | `#general-files` | `./src/3-capabilities/general-files/index.ts` | `./dist/…/index.js` | 3 |
| 28 | `#general-files/*` | `./src/3-capabilities/general-files/*` | `./dist/…/*` | **0** |
| 29 | `#connector` | `./src/3-capabilities/connector/index.ts` | `./dist/…/index.js` | 6 |
| 30 | `#connector/*` | `./src/3-capabilities/connector/*` | `./dist/…/*` | **0** |
| 31 | `#investigation` | `./src/3-capabilities/investigation/index.ts` | `./dist/…/index.js` | 3 |
| 32 | `#investigation/*` | `./src/3-capabilities/investigation/*` | `./dist/…/*` | **0** |

Total: **364 alias-carried import statements**. All 13 bare-alias `index.ts` targets exist; no
alias points at a missing path.

Two families:

- **Six layer aliases** (rows 1–6), wildcard only, one per numbered directory.
- **Thirteen module aliases** (rows 7–32), each a bare specifier plus a wildcard. The bare form
  resolves to the module's curated `index.ts` barrel; the wildcard reaches inside it.

Every import in `.ts` source carries a `.js` extension, including alias imports, because
`tsconfig.base.json` sets `"module": "NodeNext"` and `"moduleResolution": "NodeNext"`.

### 3.2 Nine wildcards with zero uses; six of them pinned by tests

`#derived-outputs/*`, `#activity/*`, `#persona/*`, `#comments/*`, `#templates/*`, `#document/*`,
`#general-files/*`, `#connector/*`, `#investigation/*` — nine of the thirteen module wildcards
are never used anywhere in `src`. They exist for symmetry with their bare form.

They are not free to delete. **Six of the nine are asserted to exist by tests** that read
`package.json` directly:

| Test file | Aliases asserted | Zero-use wildcards among them |
| --- | --- | --- |
| `test/capabilities/runtime-wiring.test.ts:19-31` | `#general-files`, `#general-files/*`, `#connector`, `#connector/*`, `#templates`, `#templates/*` | 3 |
| `test/capabilities/activity-wiring.test.ts:26-30` | `#activity`, `#activity/*` | 1 |
| `test/capabilities/persona-wiring.test.ts:64-68` | `#persona`, `#persona/*` | 1 |
| `test/capabilities/comments-wiring.test.ts:26-30` | `#comments`, `#comments/*` | 1 |

The remaining three zero-use wildcards (`#derived-outputs/*`, `#document/*`,
`#investigation/*`) are unpinned and unused: removing them today would break nothing.

Not asserted by any test: `#document`, `#investigation`, `#structured-data`, `#context`,
`#formula`, `#rich-text`, `#derived-outputs`, and all six layer aliases — including
`#utils/*` and `#platform/*`, the two most heavily used specifiers in the codebase.

### 3.3 `#capabilities/*` covers a 32,246-line layer with four import statements

The layer alias for the largest layer in the backend is used by exactly four imports, all in one
file, all pointing into `3-capabilities/built-in/`:

```ts
// apps/backend/src/4-job-wiring/registerBuiltInEndpointMappings.ts:1-4
import { runAuditCapability }      from "#capabilities/built-in/auditCapability.js";
import { runEchoCapability }       from "#capabilities/built-in/echoCapability.js";
import { runHealthCapability }     from "#capabilities/built-in/healthCapability.js";
import { runQueueStatusCapability } from "#capabilities/built-in/queueStatusCapability.js";
```

Nothing is broken by this. Of the 13 capability directories, **11 have an `index.ts` barrel and
their own bare alias**; `built-in/` has neither, which is exactly what `#capabilities/*` is for;
and `slides/` has neither and is reached by nothing at all. But the layer alias does not mean
what its name suggests — in practice it is the built-in-capability alias, and it is the only one
of the six layer wildcards whose usage is confined to a single directory.

### 3.4 Directories with no dedicated alias

| Directory | Alias | Reached by | Status |
| --- | --- | --- | --- |
| `3-capabilities/built-in/` | none | `#capabilities/built-in/*.js` (4 imports) | fine — this is what `#capabilities/*` exists for |
| **`3-capabilities/slides/`** | **none** | **nothing outside itself imports it** | **unwired** |
| `0-platform/database/` | none | `#platform/database/knowledge-store.js` | by design |
| `0-platform/intelligence/` | none | `#platform/intelligence/*.js` | by design |
| `0-platform/knowledge/` | none | `#platform/knowledge/*.js` | by design |
| `0-platform/observability/` | none | `#platform/observability/logger.js` | by design |
| `0-platform/web-retrieval/` | none | never imported | empty scaffold, zero TypeScript |

**Slides has no alias because nothing needs one.** `3-capabilities/slides/` is 15 files and
6,765 lines with 87 passing tests, and it has no `index.ts`, no `application/` service, no
`1-init/create/slides.ts`, no `4-job-wiring/slides/`, no `docs/` package, and no mention in
`startBackend.ts`. The string `slides` appears in `package.json` zero times. Its only importers
in the repository are its own two test files, which reach it by relative path
(`../../src/3-capabilities/slides/…`). `tsconfig.json`'s `include` is `["src/**/*.ts"]`, so it is
typechecked on every build; no request can reach it. See
[07-capabilities/slides.md](07-capabilities/slides.md).

The only other reference to Slides anywhere in `src/` is a comment in
`templates/ports/templatableResource.ts:32-33` naming `slides::deck` and `slides::slide` as an
example of compound registry kinds.

### 3.5 Wildcard uses that bypass a barrel which already exports the symbol

Nine of the alias uses reach *into* a module through its wildcard. Three are necessary; six are
not:

| Use site | Specifier | Barrel exports it? |
| --- | --- | --- |
| `1-init/create/formula-name-resolver.ts:11`, `4-job-wiring/structured-data/registerStructuredDataEndpoints.ts:7` | `#formula/resolver.js` → `normalizeKey` | **No** — necessary |
| `1-init/create/formula-name-resolver.ts:12` | `#formula/value-identity.js` → `formulaValueDigest` | **No** — necessary |
| `1-init/create/structured-data.ts:3-5` | `#structured-data/structured-data.js`, `#structured-data/sqlite-store.js` | Yes — `index.ts` exports `createStructuredData`, `StructuredData`, and `SQLiteDataStore` |
| `1-init/create/rich-text.ts:7` | `#rich-text/engine.js` → `createRichText` | Yes — `index.ts:3` re-exports it |
| `3-capabilities/structured-data/types.ts:4`, `3-capabilities/derived-outputs/domain/model.ts:4` | `#context/types.js` → `ContextEntry` | Yes — `#context` re-exports it |

Six redundant deep specifiers, none of them harmful, all of them a divergence from the pattern
the other 355 alias imports follow. The Structured Data and Rich Text cases are the composition
root importing a concrete class it is entitled to import — through the wrong door.

Every other capability barrel does export its concrete SQLite store class (`SQLiteActivityStore`,
`SQLiteCommentStore`, `SQLiteConnectorStore`, `SQLiteContextStore`, `SQLiteDerivedOutputStore`,
`SQLiteDocumentStore`, `SQLiteGeneralFileStore`, `SQLiteInvestigationStore`,
`SQLitePersonaStore`, `SQLiteTemplateStore`), and `1-init/create/*.ts` imports each from the
bare alias. The barrel deliberately exposes the concrete store *because the composition root is
the only consumer that may construct one*.

---

## 4 · Narrow inbound ports

The rule the code follows: **a consumer declares the interface it needs, in its own directory,
naming only the methods it calls.** The provider satisfies it structurally. No shared "public
API" interface travels between capabilities, and no capability imports another's service class.

Document is the worked example. It has four files in
[`document/ports/`](../../apps/backend/src/3-capabilities/document/ports), and the split between
inbound integration ports and the outbound persistence port is stark:

| Port file | Lines | Interface | Methods | Satisfied by | Methods on the satisfier | Direction |
| --- | ---: | --- | ---: | --- | ---: | --- |
| `formulaResolver.ts` | 5 | `DocumentFormulaResolver` | **1** (`buildSnapshot`) | `FormulaNameResolverImpl` (`1-init`) | 2 | inbound |
| `activityPublisher.ts` | 11 | `DocumentActivityPublisher` | **1** (`publish`) | a hand-written adapter in `1-init/create/document.ts:24-52` | — | inbound |
| `derivedOutputs.ts` | 27 | `DocumentDerivedOutputs` | **7** | `DerivedOutputService` | 10 | inbound |
| `documentStore.ts` | 204 | `DocumentStore`, plus 4 commit-record types and 1 result union | **49** | `SQLiteDocumentStore` | — | outbound |

Read the top three rows together: 43 lines of interface stand between Document and the rest of
the runtime, and each one is strictly narrower than what satisfies it. `DocumentFormulaResolver`
declares `buildSnapshot()` and not `getIssue()`, even though the object it receives has both.
`DocumentDerivedOutputs` declares 7 of `DerivedOutputService`'s 10 methods — it omits
`recordKnowledgeSourceMutation`, `pruneHistory`, and `purgeExpired`, which belong to the
composition root and the retention sweep, not to Document.

The fourth row is the counter-shape: the store port is 204 lines and 49 methods because Document
owns its persistence outright and the port is a contract with itself, not a boundary with a peer.
Narrow applies to what you consume; wide is correct for what you own.

The Activity port is the smallest of the three, and Document, Comments, and Templates each
declare their own copy of it rather than share one:

```ts
// apps/backend/src/3-capabilities/comments/ports/activityPublisher.ts — 6 lines, complete
import type { CommentCommittedTransaction } from "../domain/model.js";

/** Narrow source-side Activity port; Comments never imports the Activity runtime. */
export interface CommentActivityPublisher {
  publish(transaction: CommentCommittedTransaction): Promise<void>;
}
```

`templates/ports/activityPublisher.ts` is the same six lines with `Template` substituted;
Document's is 11 lines with a longer docblock. Three near-identical files, deliberately not
shared, because the transaction type in each signature is the capability's own.

### 4.1 Two places that use structural satisfaction instead of an adapter

Where an adapter would only forward calls, composition passes the object directly and the
interface exists purely so the line typechecks.

**`ContextManager` satisfies `PersonaContextPort`.** The port's header
([`persona/ports/personaContext.ts:1-16`](../../apps/backend/src/3-capabilities/persona/ports/personaContext.ts))
is the clearest statement of the narrowing rule in the repository:

```ts
// The narrow slice of Context that Persona consumes.
//
// Satisfied structurally by ContextManager, which has many more methods. Persona
// states exactly what it uses: it manages one private wrapper record per persona
// and never reads Context for any other reason. There is deliberately no get(),
// resolve(), combine(), or list() here — expanding a context reference into
// retrievable content is the consumer's job, not Persona's.
//
// There is also no update(). A changed context is never applied by mutating the
// existing wrapper in place — Persona always declares a brand-new wrapper and,
// once its own record's CAS write has committed to the new wrapper, deletes the
// old one. A fresh declare() can never itself go stale (it always starts at
// revision 1), which is what makes this ordering immune to the partial-write
// gap described in docs/invariants.md: either side losing its race leaves, at
// worst, one harmless orphaned wrapper — never a persona record pointing at a
// stale or missing one.
```

`PersonaContextPort` declares **3** methods (`declare`, `delete`, `purge`);
`ContextManager` declares **13**. The port is passed at `startBackend.ts:64` with no adapter.

**`DocumentCapability` satisfies `TemplatableResource`.**
[`templates/ports/templatableResource.ts:3-28`](../../apps/backend/src/3-capabilities/templates/ports/templatableResource.ts):

```ts
/**
 * What a resource capability must be able to do for Templates to make templates
 * out of it. Not an adapter: there is no object implementing this by hand in
 * `1-init`. The resource capability's own runtime satisfies it **structurally**,
 * and composition is one line —
 *
 * ```ts
 * templateResources.register(document);
 * ```
 *
 * The interface exists so that line typechecks. Without it the registry would be
 * `Record<string, any>` and a missing or renamed method would surface at runtime
 * as "undefined is not a function" inside a serial job. Typing the registry as
 * `DocumentCapability` is the other alternative and fails twice over: Templates
 * would import a capability, and the registry could never hold a second kind.
 *
 * Same pattern as `ContextManager` satisfying `PersonaContextPort`.
 * …
 */
```

Both seams currently harbour a defect that this pattern makes easy to miss, because both test
suites substitute a double for the port and the double does not behave like the real object:
Templates→Document `logicalDelete` always throws, and Persona→Context wrapper replacement always
returns HTTP 500. Neither is a flaw in the pattern; both are recorded in
[11 · Known issues](11-known-issues.md).

### 4.2 The same technique inside `0-utils`, applied inconsistently

`JobScheduler` needs a logger but `0-utils` should not depend on `0-platform`. It declares its
own three-method interface — no `info` — and defaults it to a no-op:

```ts
// apps/backend/src/0-utils/jobs/scheduler.ts:18-28
export interface JobSchedulerLogger {
  debug(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

const NOOP_LOGGER: JobSchedulerLogger = { … };
```

The platform `Logger` satisfies it structurally and `1-init/create/scheduler.ts` passes it
straight in.

The other file in the same layer that needs a logger does the opposite. Line 1 of
`0-utils/persistence/resourceRetentionScheduler.ts` is the single `0-utils` → `0-platform` edge
in the whole codebase:

```ts
import type { Logger } from "#platform/observability/logger.js";
```

It is `import type`, so nothing is coupled at runtime, and the layer rule permits a level-0
directory to import another level-0 directory. But two files in one layer solve the identical
problem two different ways, and only one of them documents why.

---

## 5 · The composition root

[`1-init/startBackend.ts`](../../apps/backend/src/1-init/startBackend.ts) is **238 lines** and
exports one symbol: `startBackend(): Promise<void>`. It is the only place in the codebase where
concrete objects are wired together. **There is no DI container and no service locator** —
composition is a flat sequence of `const x = createX(deps)` statements. The backend's five
runtime dependencies are `@icarus/shared`, `better-sqlite3`, `dotenv`, `fastify`, and `yaml`;
none of them is a framework that could do this for you.

`1-init/create/` holds **23 files, 1,442 lines**. Nineteen of the 23 declare a `logger: Logger`
parameter; the four that do not are `config.ts`, `app.ts`, `registry.ts`, and `logger.ts` itself.
Sixteen of the 23 are thin factories of 4 to 30 lines; nine of those open a single SQLite file
and call the capability's own `create*`. The other seven carry real logic:
[`formula-name-resolver.ts`](../../apps/backend/src/1-init/create/formula-name-resolver.ts) (438
lines — an adapter, not a factory, pointing Structured Data at Formula so neither package depends
on the other),
[`resource-reader.ts`](../../apps/backend/src/1-init/create/resource-reader.ts) (349 lines, the
cross-capability resource registry),
[`connectorSyncScheduler.ts`](../../apps/backend/src/1-init/create/connectorSyncScheduler.ts)
(117 lines, a stateful class owning four interval timers),
[`templates.ts`](../../apps/backend/src/1-init/create/templates.ts) (79),
[`document.ts`](../../apps/backend/src/1-init/create/document.ts) (75),
[`comments.ts`](../../apps/backend/src/1-init/create/comments.ts) (53) — each a factory plus a
hand-written `CommittedTransaction → ActivityTransactionInput` translation adapter — and
[`logger.ts`](../../apps/backend/src/1-init/create/logger.ts) (71, factory plus daily-rollover
write-stream management).

### 5.1 Construction order, with line numbers

Lines 48–50 sit **outside** the `try` block. Everything from 54 on is inside it.

| Line | Constructed / done | Dependencies passed |
| ---: | --- | --- |
| 48 | `config = await createConfig()` | — |
| 49 | `logger = createLogger(config)` | `config` |
| 50 | `startedAt = performance.now()` | — |
| 51 | `try {` | — |
| 54 | `activity` | `config`, `logger` |
| 55 | `comments` | `config`, **`activity`**, `logger` |
| 56 | `intelligence` | `config`, `logger` |
| 60 | `contextManager` | `config`, `logger` |
| 61 | `resourceRegistry` | **`contextManager`**, `logger` |
| 64 | `personas` | `config`, **`contextManager`**, `logger` |
| 65–70 | `knowledge` | `config.projectId`, **`intelligence`**, `logger`, **`resourceRegistry`** |
| 71 | `investigation` | `config`, **`knowledge`**, `logger` |
| 72 | `resourceRegistry.registerInvestigation(investigation)` | ← **back-fill 1** |
| 73 | `formula` | `config`, `logger` |
| 74 | `structuredData` | `config`, `logger` |
| 75–78 | `formulaResolver` | **`formula`**, **`structuredData`**, `logger`, `{userId, projectId}` |
| 79 | `richText` | `config`, `logger` |
| 80 | `generalFiles` | `config`, **`knowledge`**, `logger` |
| 81–85 | `{ service: connector, store: connectorStore }` | `config`, **`knowledge`**, `logger` |
| 86 | `resourceRegistry.registerGeneralFiles(generalFiles)` | ← **back-fill 2** |
| 87 | `resourceRegistry.registerConnector(connector)` | ← **back-fill 3** |
| 88–94 | `derivedOutputs` | `config`, **`knowledge`**, **`intelligence`**, **`resourceRegistry`**, `logger` |
| 95–97 | `knowledge.onSourceMutation(m => derivedOutputs.recordKnowledgeSourceMutation(m))` | the one subscription in the tree |
| 98 | `app = createApp()` | Fastify with `logger: false` |
| 99 | `scheduler` | `config`, `logger` |
| 100 | `registry = createRegistry(scheduler)` | also registers the 4 built-in endpoints |
| 101 | `documentJobs = new SchedulerInternalJobsRuntime<DocumentInternalJobIntent>(scheduler)` | — |
| 102–111 | `document` | `config`, `richText`, `formula`, `formulaResolver`, `derivedOutputs`, `activity`, `documentJobs`, `logger` |
| 112 | `registerDocumentInternalJobs(documentJobs, document)` | the 7 internal intents |
| 115 | `templateResources = createTemplateResourceRegistry()` | — |
| 119 | `templateResources.register(document)` | **the only registrant** |
| 120 | `templates` | `config`, `templateResources`, `activity`, `logger` |
| 123–147 | `retentionScheduler` | `config.retention`, **11 bound ports**, `logger` |
| 149–174 | `logger.info("Backend starting", { … })` | 24 fields, 17 of them `Boolean(x)` readiness flags |
| 176–186 | 11 `register*Endpoints(...)` calls | registry ← each capability |
| 188–195 | 4 awaited recovery calls, each logging a count | see §5.4 |
| 197–202 | `syncScheduler = new ConnectorSyncScheduler(...)` | `connectorStore`, `scheduler`, `connector`, `logger` |
| 204 | `registerHttpTransport(app, { scheduler, registry, logger })` | — |
| 206–209 | `await app.listen({ host, port })` | — |
| 213 | `await retentionScheduler.start()` | one immediate awaited sweep, then `setInterval().unref()` |
| 214 | `syncScheduler.start()` | four timers, **not** `unref()`ed |
| 216 | `logger.info("Backend listening", { port })` | — |
| 220–227 | `shutdown` closure | see §5.5 |
| 228–229 | `process.once("SIGTERM" / "SIGINT", …)` | registered only after `listen` resolves |
| 230–237 | `catch` → `logger.error("backend.start.failed", …)` → rethrow | — |

Sixteen capability and platform runtimes, three schedulers, the Fastify instance, the endpoint
registry, two composition-time registries, and one internal-jobs runtime — all constructed here,
in one pass, with no lazy initialisation anywhere.

### 5.2 Which orderings are load-bearing

Reordering any of these breaks the process:

| # | Constraint | Why |
| ---: | --- | --- |
| 1 | `config` (48) → `logger` (49) → everything | `logger` is a parameter to 19 of the 23 `create/` files |
| 2 | `contextManager` (60) before `resourceRegistry` (61) and `personas` (64) | constructor arguments |
| 3 | **`resourceRegistry` (61) before `knowledge` (65)** | the cycle-breaker — see §5.3 |
| 4 | `intelligence` (56) before `knowledge` (65) and `derivedOutputs` (88) | constructor arguments |
| 5 | `knowledge` (65) before `investigation`, `generalFiles`, `connector`, `derivedOutputs` | constructor arguments |
| 6 | `formula` (73) + `structuredData` (74) before `formulaResolver` (75) | constructor arguments |
| 7 | `richText`, `formula`, `formulaResolver`, `derivedOutputs`, `activity`, `documentJobs` before `document` (102) | eight-argument constructor |
| 8 | `scheduler` (99) before `registry` (100), `documentJobs` (101), `syncScheduler` (197) | `GET /health/queues`'s factory closes over `scheduler.getState()` |
| 9 | `document` (102) before `templateResources.register(document)` (119) and `templates` (120) | value must exist to register |
| 10 | `activity` (54) before `comments` (55), `document` (102), `templates` (120) | each builds an `ActivityPublisher` adapter over it |
| 11 | `templates` (120) before the retention port array (123–147) | binds both `templates` and the `templates-orphans` closure |
| 12 | **`registerHttpTransport` (204) before `app.listen` (206)** | Fastify refuses route registration after listening |
| 13 | **`app.listen` (206) before both `.start()` calls (213, 214)** | commented at `:210-212`; one half is test-enforced |

Constraint 1's comment, at `startBackend.ts:52-53`, states the ordering rationale for the very
first line inside the `try`:

```ts
// Activity has no resource dependency and is created before resource
// integrations eventually publish their accepted transactions into it.
```

Constraint 13's comment, `startBackend.ts:210-212`:

```ts
// Start recurring work only after the transport has bound successfully.
// Otherwise a listen failure would leave interval timers keeping the
// failed startup process alive.
```

Only half of constraint 13 is enforced. `runtime-wiring.test.ts:212-222` reads
`startBackend.ts` as text and asserts
`source.indexOf("syncScheduler.start()") > source.indexOf("await app.listen")`. **There is no
equivalent assertion for `retentionScheduler.start()`**, so moving line 213 above line 206 would
fail nothing in the suite even though the comment forbids it.

**Orderings that read as load-bearing and are not:**

- The three `resourceRegistry.register*` back-fills (72, 86, 87) precede `derivedOutputs` (88),
  but the registry is a mutable object read at request time. Any order before the first request
  works. The placement is for readability.
- The 11 `register*Endpoints` calls (176–186) precede `registerHttpTransport` (204), but the
  registry is consulted per request. Registration could legally happen any time before the first
  request arrives.
- The `logger.info("Backend starting", …)` block (149–174) is a `Boolean(x)` readiness dump of
  17 runtime objects. It is diagnostics only, it asserts nothing, and a `false` in it would not
  stop startup.

### 5.3 The two-phase `resourceRegistry`

There is one construction cycle in the graph and it is broken by mutation, not by laziness.
Knowledge needs a `KnowledgeResourceResolver`; the concrete resolver needs General Files,
Connector, and Investigation; all three need Knowledge. Line 61 creates the registry empty and
lines 72, 86, and 87 fill it in.

[`resource-reader.ts:45-60`](../../apps/backend/src/1-init/create/resource-reader.ts):

```ts
/**
 * Mutable only during composition. Once startup registers the concrete
 * capabilities, callers use this object through the narrow ResourceReader and
 * KnowledgeResourceResolver interfaces.
 */
export type RuntimeResourceRegistry = ResourceReader &
  KnowledgeResourceResolver & {
    registerGeneralFiles(service: GeneralFileService): void;
    registerConnector(service: ConnectorService): void;
    registerInvestigation(runtime: InvestigationRuntime): void;
  };

class ResourceRegistry implements RuntimeResourceRegistry {
  private generalFiles?: GeneralFileService;
  private connector?: ConnectorService;
  private investigation?: InvestigationRuntime;
```

Three optional private fields, three setters, and every read path null-guards them — so a request
arriving before a back-fill degrades to "resource not found" rather than throwing. The mutability
is confined to the composition root by the type: the object is handed out under two *narrower*
interfaces, and neither of them can see the setters.

| Handed to | As | Line | Used for |
| --- | --- | ---: | --- |
| `Knowledge` | `KnowledgeResourceResolver` | 65–70 | `resolve(entries)` — Context leaves → Knowledge source IDs |
| `DerivedOutputService` | `ResourceReader` | 88–94 | `describeSource`, `list`, `read` |

`startBackend.ts:57-59` states the intent:

```ts
// The registry is composed before Knowledge and populated once concrete
// resource capabilities exist. It resolves Context leaves to source IDs and
// supplies the same trusted identities to Derived Output tools.
```

This object is the **single** place mapping Context entries to Knowledge source IDs, and the
**single** enforcement point for scoped-read authorisation: `read()` refuses any resource absent
from the frozen `KnowledgeScopeManifest`, logs `resources.read.denied` at
`resource-reader.ts:176`, and returns `null`. It owns three source-ID prefixes
(`resource-reader.ts:17-19`): `general-file:`, `connector:`, `finding:`.

The same shape appears once more, for Templates. `create/templates.ts:16-37` builds a
`RuntimeTemplateResourceRegistry` that is mutable during composition and handed to Templates as
the read-only `TemplatableResourceRegistry`. `templateResources.kinds()` returns `["document"]`
at runtime — one registrant, from `startBackend.ts:119`, under the comment quoted in §4.1.

### 5.4 Crash recovery runs before `listen`

Four awaited calls at lines 188–195, each logging a count. All four target methods exist:

| Call | Log message | Implementation |
| --- | --- | --- |
| `document.recoverPendingAttempts()` | `document.attempts.recovered` | `document/application/documentService.ts:1966` |
| `document.publishPendingActivity()` | `document.activity.recovered` | `document/application/documentService.ts:801` |
| `comments.publishPendingActivity()` | `comments.activity.recovered` | `comments/application/commentService.ts:194` |
| `templates.publishPendingActivity()` | `templates.activity.recovered` | `templates/application/templateService.ts:232` |

They are awaited **before** `app.listen` (206), so recovery is complete before the first request
can arrive. For Templates this drain is the *only* Activity publication path — it does not
publish post-commit, and its drain loop `break`s on the first failure.

### 5.5 Retention wiring: 11 ports, in an order that is load-bearing

`new ResourceRetentionScheduler(config.retention, [ …11 ports… ], logger)` at lines 123–147.
The array order is the sweep order, and `startBackend.ts:121-122` says why:

```ts
// Parent resources precede their owned resources so retention can cascade
// through ownership before a generic child sweep sees the same history.
```

```text
document → persona → templates → templates-orphans → investigation → derived-outputs
→ comments → connector → general-files → structured-data → context
```

Ten are capability services bound by name; the eleventh is a synthetic closure
(`startBackend.ts:134-137`) carrying the longest comment in the file:

```ts
// Rides the retention sweep rather than owning a timer: it is the same
// shape of work — conservative, cutoff-driven, reaping what nothing
// references — and a second scheduler would be a second thing to
// configure, observe, and shut down. The retention cutoff doubles as the
// grace period that tells an orphan from a registration in flight.
bindResourceRetentionPort("templates-orphans", {
  pruneHistory: () => 0,
  purgeExpired: (cutoff) => templates.collectOrphanedResources(cutoff)
}),
```

`bindResourceRetentionPort` exists so the composition root never names a capability's concrete
retention type
([`resourceRetentionScheduler.ts:26-29`](../../apps/backend/src/0-utils/persistence/resourceRetentionScheduler.ts)):

```ts
/**
 * Binds capability methods without leaking their receiver. This also keeps the
 * composition root independent of every capability's concrete retention type.
 */
```

**Activity and Knowledge are deliberately absent** — Activity is an append-only ledger and
Knowledge is a rebuildable derived index; neither declares `pruneHistory`/`purgeExpired`. Sweep
mechanics belong to [04 · State and persistence](04-state-and-persistence.md).

### 5.6 Shutdown, and the two things it does not do

`startBackend.ts:218-229`, complete:

```ts
// Flush buffered log writes on shutdown so a killed process does not lose
// its tail of in-flight log entries.
const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  logger.info("Backend shutting down", { signal });
  syncScheduler.stop();
  await retentionScheduler.stop();
  await app.close();
  await logger.close?.();
  process.exit(0);
};
process.once("SIGTERM", (signal) => void shutdown(signal));
process.once("SIGINT", (signal) => void shutdown(signal));
```

Clear the Connector timers → clear the retention timer and await any active sweep → close Fastify
(which drains in-flight HTTP) → flush the log write stream → exit 0. `logger.close?.()` is
optional-chained because `NoopLogger` has no `close`.

Two gaps, stated plainly:

- **No SQLite connection is ever closed.** Six store classes expose a `close()` method —
  `SQLiteActivityStore`, `SQLiteCommentStore`, `SQLiteInvestigationStore`, `SQLiteDocumentStore`,
  `SQLiteSlidesStore`, `SQLiteKnowledgeStore` (`SQLiteTemplateStore` has none). **None is called
  anywhere outside tests.** `process.exit(0)` is reached with all 12 database handles open; the
  `-wal` and `-shm` files left in `apps/backend/data/` are the visible consequence.
- **In-flight jobs are not drained.** `app.close()` waits for HTTP requests, but a *deferred*
  job's follow-up `work()` holds its queue slot after the response has already been sent, and
  nothing awaits it. `JobScheduler` has no `stop()`, `drain()`, `cancel()`, or `AbortSignal` —
  there is no operator lever at all. A hung job holds its slot until the process dies.

A third, smaller gap: the handlers are registered with `process.once` and only **after**
`app.listen` resolves, so a `SIGINT` during startup gets Node's default behaviour.

### 5.7 Startup failure is completely silent

`createConfig()` (48) and `createLogger()` (49) are **outside** the `try`. `loadBackendConfig`
throws on a missing file, on malformed YAML, and — because `parse("")` returns `null` and
`loadBackendConfig.ts:389` reads `parsed.server` unguarded — with a raw `TypeError` on an empty
or comment-only configuration file. That error never reaches the `catch` at line 230, so
`logger.error("backend.start.failed", …)` never fires. `src/index.ts:12-14` then discards it:

```ts
void startBackend().catch(() => {
  process.exitCode = 1;
});
```

`console.*` is forbidden by `runtime-wiring.test.ts:202-210`, which greps `src/index.ts` and
`0-utils/jobs/scheduler.ts` for `console.(debug|info|log|warn|error)(`. **A misconfigured backend
therefore exits 1 with no output on any stream and no entry in any log file.** Details in
[09 · Configuration](09-configuration.md) and [11 · Known issues](11-known-issues.md).

---

## 6 · The placement laws, reconciled against the code

The archived design page (`phase-1/runtime/repository-boundaries.md`, superseded) stated these as
"dependency rules". Each is repeated here with what HEAD actually does.

| Stated law | Status at ef6d462 | Evidence |
| --- | --- | --- |
| Domain modules are pure and deterministic | **Holds.** No `3-capabilities/*/domain/` file imports `better-sqlite3`, `node:fs`, or the logger | `grep -rn "better-sqlite3\|node:fs" src/3-capabilities/*/domain/` → 0 |
| Application services sequence ports, idempotency, history admission, async stages | **Holds** | see [03 · Capability anatomy](03-capability-anatomy.md) |
| Persistence implements the capability-owned store interface | **Holds.** Every `persistence/SQLite*Store` implements a `ports/*Store` interface in the same capability | — |
| Capability A consumes B through the narrow interface A needs; it does not import B's persistence | **Holds, strictly.** All 12 cross-capability imports inside layer 3 are `import type`; none of the 31 cross-module imports reaches an `application/` or `persistence/` path | §2 |
| Platform services do not import product capabilities | **Holds.** `0-platform` imports only `#platform` (58) and `#formula` (1) | §2 |
| Transport performs no domain mutation | **Holds.** `2-transport` imports only `#utils` and `#platform`; it registers one route and never names a capability | §2 |
| Job wiring performs no domain reduction | **Holds** for reduction; job wiring does own request validation and status-code mapping | [02 · Request and job runtime](02-request-and-job-runtime.md) |
| Logger calls cannot change domain outputs | **Holds for sink errors only.** `create/logger.ts:41-42` installs a stream `error` handler that writes to stderr; but `writeEntry` is `JSON.stringify(entry)` with no guard (`create/logger.ts:51`), so a circular reference or a `bigint` in `data` throws into the caller's stack | `create/logger.ts:39-53` |
| Rebuildable indexes never become sources of truth | **Holds.** Knowledge is the only rebuildable index and has no revision-history table; its level-index feature is entirely dead | [06 · Platform services](06-platform-services.md) |
| Capabilities own their own storage | **Holds with one documented exception** — see below | `0-utils/persistence/likePattern.ts` |
| `ContextEntry` belongs to Context and is re-exported for Knowledge | **Inverted.** It is declared in `0-platform/knowledge/types.ts:85` and re-exported by Context | §2.2 |
| Job-wiring files are named `register<Capability>EndpointMappings.ts` | **False.** Of the 12 files that call `registry.register`, **3** use the `EndpointMappings` suffix (connector, general-files, built-in) and **9** use `Endpoints` | §7 |
| `create<Capability>Jobs.ts` / `<capability>JobPayloads.ts` per capability | **Document only.** No other capability has either file | §7 |
| Capability shape is `domain/ application/ ports/ persistence/ index.ts` | **Followed by the layered capabilities.** `context` and `structured-data` are flat; `derived-outputs` is hybrid; `built-in` is four functions; `slides` has `domain/ persistence/ ports/` and no `application/` | [03 · Capability anatomy](03-capability-anatomy.md) |
| `JobDefinition` has `id`, `queueType`, `responseMode`, `execute(signal?: AbortSignal)` | **False in every particular.** There is no `execute`, no `AbortSignal`, and no generic parameter anywhere in the job runtime; `id` is added by `JobRegistry.createJob`, not declared by the factory | [02 · Request and job runtime](02-request-and-job-runtime.md) |
| Register mappings in `startBackend.ts` after every prerequisite has been constructed | **Holds** — this is exactly what lines 176–186 do | §5.1 |

### 6.1 The one place the storage-ownership rule gives way, and why

[`0-utils/persistence/likePattern.ts:1-21`](../../apps/backend/src/0-utils/persistence/likePattern.ts)
is the codebase's clearest statement of a placement decision, including its cost:

```ts
/**
 * SQL `LIKE` treats `%` and `_` as wildcards, so caller-supplied text used as a
 * substring filter has to be escaped or it silently stops being a substring
 * filter: searching for `50%` matches every row, and `report_final` also matches
 * `reportXfinal`.
 *
 * **This lives in `0-utils` rather than in each capability's persistence**, which
 * is the one place this codebase's "capabilities own their own storage" rule
 * gives way. The reason is history: Templates and General Files each grew a name
 * filter independently, and they disagreed — one escaped and one did not, so the
 * same query returned different results depending on which capability answered
 * it. Four copies of a four-line function is cheap; four copies that disagree is
 * a class of bug nobody goes looking for.
 *
 * Every call site must also declare the escape character, because SQLite has no
 * default one:
 *
 * ```sql
 * WHERE name LIKE ? ESCAPE '\'
 * ```
 */
```

The exported `LIKE_ESCAPE_CHARACTER` constant that follows is itself **dead** — every call site
hard-codes `ESCAPE '\'` rather than interpolating it.

---

## 7 · Naming, as actually practised

The naming convention is real but not uniform, and the divergences are worth knowing before you
go looking for a file.

**`1-init/create/`** uses `create<Thing>` when the bare name is free (`createConfig`, `createApp`,
`createLogger`, `createFormula`, `createKnowledge`, `createIntelligence`, `createScheduler`,
`createRegistry`) and `create<Thing>Instance` when the capability already exports a
`create<Thing>` (`createStructuredDataInstance`, `createRichTextInstance`,
`createContextManagerInstance`, `createActivityInstance`, `createPersonaInstance`,
`createGeneralFilesInstance`, `createConnectorInstance`, `createDocumentInstance`,
`createCommentsInstance`, `createTemplatesInstance`, `createDerivedOutputServiceInstance`,
`createInvestigationRuntimeInstance`). Two break both patterns: `createResourceReader` returns a
registry, not a reader, and `createFormulaNameResolver` returns an adapter.

**`4-job-wiring/`** is 16 files. Twelve call `registry.register`, and they use two different
suffixes:

| Suffix | Count | Files |
| --- | ---: | --- |
| `…Endpoints.ts` | 9 | activity, comments, context, derived-outputs, document, investigation, persona, structured-data, templates |
| `…EndpointMappings.ts` | 3 | `connector/registerConnectorEndpointMappings.ts`, `general-files/registerGeneralFileEndpointMappings.ts`, `registerBuiltInEndpointMappings.ts` (at the layer root) |
| `…EndpointMappings.ts`, registers nothing | 1 | `internal/registerEndpointMappings.ts` |
| Document-only extras | 3 | `createDocumentJobs.ts`, `documentJobPayloads.ts`, `registerDocumentInternalJobs.ts` |

The two `EndpointMappings` files export functions named `registerConnectorEndpoints` and
`registerGeneralFileEndpoints` — the file name and the export it contains disagree, which is why
`startBackend.ts:18-19` reads as it does.

`4-job-wiring/formula/` and `4-job-wiring/name-manager/` contain **zero files**. Git does not
track empty directories, so they exist only in this working tree and will not appear in a fresh
clone. Formula is a `0-platform` service with no endpoints; nothing called "name-manager" exists
anywhere in the repository.

### 7.1 The fan-out point that fans out to one thing

`1-init/create/registry.ts:6`:

```ts
// Build one process-wide endpoint registry, then load every job-wiring group.
```

`4-job-wiring/internal/registerEndpointMappings.ts:9-10`:

```ts
// Keep initialization stable: it calls this one function while this file
// fans out to each endpoint-registration group added under job wiring.
```

Neither statement is true. `registerEndpointMappings` calls exactly one function —
`registerBuiltInEndpointMappings(registry, scheduler)` — and all 11 capability endpoint groups are
registered directly from `startBackend.ts:176-186`, bypassing the fan-out point entirely. The
intent was abandoned without either comment being updated. This is a code-versus-comment
contradiction inside the module, not documentation drift.

---

## 8 · What actually enforces any of this

Nothing enforces the layer rules mechanically. There is no linter configuration, no
dependency-direction check, and **no CI configuration anywhere in the repository** — no
`.github/`, no pipeline file. Nothing runs `pnpm test` or `pnpm typecheck` on a push.

What does exist:

| Mechanism | What it catches | What it misses |
| --- | --- | --- |
| `pnpm typecheck` (`tsc --noEmit`) | Every unresolvable alias, every structural-satisfaction break, every port mismatch in `src/**` | `include` is `["src/**/*.ts"]` — **`test/` is never typechecked** |
| The composition smoke test (`runtime-wiring.test.ts:57`, `await import("#init/startBackend.js")`) | An unresolvable import in the composition graph whose binding is *used* at runtime | esbuild elides unused and type-only imports before Node resolves them |
| Four alias-existence tests | Deletion of 12 named aliases from `package.json` | The other 20, including all six layer aliases |
| `runtime-wiring.test.ts:33-38` | Removal of `--conditions` from the **`dev`** script | The `test` script, which also needs it |
| `runtime-wiring.test.ts:202-210` | `console.*` in `src/index.ts` and `0-utils/jobs/scheduler.ts` | The other 234 source files |
| `runtime-wiring.test.ts:212-222` | `syncScheduler.start()` moving above `await app.listen` | `retentionScheduler.start()`, under the same comment |

The composition smoke test carries the most honest statement of a test's own limits in the
repository (`runtime-wiring.test.ts:40-55`), and it is worth reading in full before trusting a
green suite:

```ts
// Every other test in the suite imports concrete modules directly, so a broken
// composition root is invisible to them: the tree can fail `tsc` and fail to boot
// while the suite stays green. That is exactly what happened while Slide carried a
// barrel re-exporting a service file that was never written.
//
// The import is dynamic rather than top-level on purpose. A static import that
// failed would take the whole file down with it, hiding the other assertions here
// behind a module-load error; this way a broken graph is one failing test with a
// readable message.
//
// Known limit, verified by deliberately breaking startBackend both ways: this
// catches an unresolvable import whose binding is *used* at runtime, but not one
// that is unused or type-only — esbuild elides those before Node ever resolves
// them. `tsc` is what covers that case, which is the argument for running
// `pnpm typecheck` alongside `pnpm test` rather than treating this as a
// substitute for it.
```

Measured at HEAD on 2026-08-09: typecheck clean, 444/444 tests pass, module graph resolves. See
[10 · Verified status](10-verified-status.md).

---

## 9 · Where to go next

| Question | Page |
| --- | --- |
| How a request becomes a job, and the queue model | [02 · Request and job runtime](02-request-and-job-runtime.md) |
| What is inside one capability directory | [03 · Capability anatomy](03-capability-anatomy.md) |
| Tables, revisions, the retention sweep | [04 · State and persistence](04-state-and-persistence.md) |
| What `0-platform` actually provides | [06 · Platform services](06-platform-services.md) |
| Per-capability detail, all 13 | [07-capabilities/README.md](07-capabilities/README.md) |
| Naming, testing, and the house rules | [08 · Conventions](08-conventions.md) |
| The config loader's sharp edges | [09 · Configuration](09-configuration.md) |
| Defects named on this page, in full | [11 · Known issues](11-known-issues.md) |

The superseded design pages for this material are archived, and each is wrong in its own way.
They are listed here so nobody cites them by accident:

| Archived page | What it gets wrong |
| --- | --- |
| `phase-1/runtime/repository-boundaries.md` | Inverts `ContextEntry` ownership (`:170`); shows a `JobDefinition` with `id` and `execute(signal?: AbortSignal)` that exists nowhere (`:138-145`); states a job-wiring naming convention 3 of 12 files follow (`:131-136`); omits `rich-text/` from `0-platform` and `persistence/` from `0-utils`. Its final "Register mappings in `startBackend.ts` after every prerequisite has been constructed" is still exactly right |
| `phase-1/runtime/backend-map.md` | Its `3-capabilities/` inventory (`:51-78`) names 15 directories that do not exist; `4-job-wiring/internal/InternalJobDispatcher.ts` (`:79-82`) is not a file. Its layer-placement statement at `:8` does hold |
| `phase-1/claude-notes/01-layers-and-boundaries.md` | Lists 9 module aliases (there are 13); says `startBackend.ts` is 173 lines (238) and `resource-reader.ts` is 281 (349); shows `RuntimeResourceRegistry` with two register methods (three); describes a `#capabilities/slide/index.js` import that exists nowhere in the tree |
| `phase-1/backend-architecture.md` | Names the layers `src/init`, `src/transport`, `src/job-wiring`, `src/capabilities` — none of which is a directory — omits `0-platform` and `0-utils` entirely, and lists a `#config/*` alias that has never existed |

Do not cite any of them as current.
