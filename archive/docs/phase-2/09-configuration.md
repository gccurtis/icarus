# 09 · Configuration

*Verified against source at commit ef6d462, 2026-08-09.*

Everything tunable in the Icarus backend lives in one YAML file, is read once by one 653-line
loader, and is then passed by hand as a function argument. There is no configuration service, no
reload, no schema validation library, no layering of environment-specific files, and — with a
single exception described in §8 — no environment variables.

This page is the complete reference that has never existed. The shipped
[`etc/README.md`](../../apps/backend/etc/README.md) documents **7 keys across 4 of the 13 sections
in the file** and says so itself; everything else has only ever been readable in the loader's
`DEFAULT_CONFIG`. Every default below is transcribed from that constant with its line number, and
every "effect" column names the file and line that actually reads the value.

The superseded pages are
[phase-1/claude-notes/00-orientation.md](../phase-1/claude-notes/00-orientation.md) — whose
config-section list at L105-109 names a section the YAML does not contain (`derivedOutputs`) and
omits the one that matters most (`logging.detail`) — and
[phase-1/platform/observability.md](../phase-1/platform/observability.md), whose central rule
(L84, L143: *"Never logged. User content, prompts, provider bodies, Formula source, persona section
text, comment bodies"*) is contradicted by the current default. Do not use either for
configuration facts.

---

## 1 · The four artefacts

| Path | Size | Role |
| --- | ---: | --- |
| [`apps/backend/etc/configuration.yaml`](../../apps/backend/etc/configuration.yaml) | 212 lines | The one configuration file. Tracked in git. 13 top-level keys, 52 leaf values. |
| [`apps/backend/src/0-utils/config/loadBackendConfig.ts`](../../apps/backend/src/0-utils/config/loadBackendConfig.ts) | 653 lines | Type declarations, `DEFAULT_CONFIG`, six typed parsers, and the loader. |
| [`apps/backend/etc/README.md`](../../apps/backend/etc/README.md) | 31 lines | Documents 7 keys in 4 sections. Its "Notes" section was re-checked line by line and every operational claim in it is true. |
| `<repo>/.env` | 1 key | Untracked (`.gitignore:4`). Holds `OPENROUTER_API_KEY` and nothing else. `.gitignore:6` reserves `!.env.example`; **no `.env.example` exists.** |

Counting convention for "52 leaf values": each of `intelligence.inference.routes` and
`intelligence.reasoning.routes` counts as one leaf. Expanded, the file additionally carries 18
route objects × 6 fields = 108 route fields. The loader's `BackendConfig` type has one more scalar
leaf than the file does (`logging.detail`) and one more section (`derivedOutputs`), so the full
type surface is **53 scalar leaves + 2 route arrays**.

---

## 2 · How configuration reaches the process

```text
src/index.ts:8         loadEnv()                      ← dotenv, from process cwd
src/index.ts:10        loadEnv({ path: <repo>/.env }) ← dotenv, from the repo root
src/index.ts:12        startBackend()
  startBackend.ts:48     config = await createConfig()
    create/config.ts:4     loadBackendConfig()        ← no argument, always the default path
      loadBackendConfig.ts:386  readFile(configPath, "utf-8")
      loadBackendConfig.ts:387  parse(source)          ← the `yaml` package
      loadBackendConfig.ts:389-518  per-field merge over DEFAULT_CONFIG
  startBackend.ts:49     logger = createLogger(config)
  startBackend.ts:54-147 config passed by hand into every factory
```

Load-bearing facts about that chain:

- **`loadBackendConfig` is called exactly once**, from
  [`create/config.ts:3-4`](../../apps/backend/src/1-init/create/config.ts), with no argument. The
  `configPath` parameter exists (`loadBackendConfig.ts:385`) but production never supplies one; the
  only caller that does is a test (`templates.test.ts:2173`).
- **There is no way to point the process at a different file.** No CLI flag, no environment
  variable, no search path.
- **There is no reload.** `grep -rn "fs.watch\|watchFile\|chokidar" src` returns nothing, and there
  is no `SIGHUP` handler. Changing the YAML requires a restart.
- **`config` is never stored globally.** It is a parameter. Exactly **18 source files reference
  the `BackendConfig` type**: the declaring file, and 17 in `src/1-init/create/` — 16 of which
  take `config: BackendConfig` as a parameter, plus `config.ts`, which returns it. **No file under
  `src/3-capabilities/` or `src/0-platform/` references it at all.** Capabilities declare their own
  structurally identical config interfaces and receive a narrow slice — see §6.
- **The default path is module-relative** (`loadBackendConfig.ts:260-261`):

```ts
const moduleDir = dirname(fileURLToPath(import.meta.url));
const defaultConfigPath = resolve(moduleDir, "../../../etc/configuration.yaml");
```

From `src/0-utils/config/` and from `dist/0-utils/config/` that resolves to the same
`apps/backend/etc/configuration.yaml`, whatever the process working directory is. Contrast the
database and log paths, which are cwd-relative — see sharp edge **E9**.

### 2.1 The `.env` chain

[`src/index.ts:6-10`](../../apps/backend/src/index.ts), verbatim comment:

```ts
// Load env from cwd first, then from repo root so local root-level .env works
// for both `pnpm --filter backend ...` and direct package execution.
loadEnv();
const moduleDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(moduleDir, "../../../.env") });
```

`dotenv@16.6.1` does not override an already-set key. Measured precedence, highest first:

| Rank | Source |
| --- | --- |
| 1 | A variable already present in `process.env` |
| 2 | `<cwd>/.env` |
| 3 | `<repo>/.env` |

Only one variable is ever read from that environment (§8).

---

## 3 · Shape at a glance

`BackendConfig` (`loadBackendConfig.ts:103-136`) has **14 top-level fields**. The shipped YAML has
**13 top-level keys**. The one difference is `derivedOutputs`.

| # | `BackendConfig` field | In shipped YAML? | Leaves | Reference |
| ---: | --- | --- | ---: | --- |
| 1 | `server` | yes (`:4-8`) | 2 | [§4.1](#41-server) |
| 2 | `workerPool` | yes (`:10-12`) | 1 | [§4.2](#42-workerpool) |
| 3 | `queue` | yes (`:14-18`) | 2 | [§4.3](#43-queue) |
| 4 | `logging` | yes (`:20-26`), **3 of its 4 keys** | 4 | [§4.4](#44-logging) |
| 5 | `intelligence` | yes (`:28-152`) | 5 + 2 arrays | [§4.5](#45-intelligence) |
| 6 | `formula` | yes (`:155-168`) | 13 | [§4.6](#46-formula) |
| 7 | `structuredData` | yes (`:171-176`) | 5 | [§4.7](#47-structureddata) |
| 8 | `richText` | yes (`:179-182`) | 3 | [§4.8](#48-richtext) |
| 9 | `context` | yes (`:185-187`) | 2 | [§4.9](#49-context) |
| 10 | `derivedOutputs` | **no** | 2 | [§4.10](#410-derivedoutputs) |
| 11 | `document` | yes (`:190-202`) | 10 | [§4.11](#411-document) |
| 12 | `retention` | yes (`:206-208`) | 2 | [§4.12](#412-retention) |
| 13 | `projectId` | yes (`:211`) | 1 | [§4.13](#413-projectid-and-userid) |
| 14 | `userId` | yes (`:212`) | 1 | [§4.13](#413-projectid-and-userid) |

**`derivedOutputs` is absent from the file, not from the loader.** The loader reads
`parsed.derivedOutputs` at `loadBackendConfig.ts:406-407` and applies it at `:516`, so a
`derivedOutputs:` block in the YAML *is* honoured. Measured — this file:

```yaml
derivedOutputs:
  maxPlanQueries: 3
  maxToolRounds: 2
```

yields `{"maxPlanQueries":3,"maxToolRounds":2}`. This corrects the ground-truth phrasing "a
defaults-only section, not a YAML section": it is defaults-only *in practice*, because nothing has
ever written it into the file, but the loader honours it in full.

Two file-level comments in the YAML are worth preserving verbatim:

- `configuration.yaml:154` —
  `# Formula engine limits — all values are required; none are hardcoded in the engine.`
- `configuration.yaml:204-205` —
  `# Resource revision-history retention. This does not prune Activity,`
  `# transaction outboxes, command receipts, or delegated claims.`

---

## 4 · Section reference

Every "Default" cell cites its line in `DEFAULT_CONFIG`
([`loadBackendConfig.ts:163-258`](../../apps/backend/src/0-utils/config/loadBackendConfig.ts));
every "Effect" cell cites the file and line that reads the value at runtime. Where the shipped
value differs from the default, the shipped value is shown in bold.

All numeric fields go through `parseNumber` and therefore must be **a finite number ≥ 1** — see
[§5](#5--the-parsers) and sharp edges **E1** and **E2**.

### 4.1 `server`

| Field | Type | Default | Shipped | Effect |
| --- | --- | --- | --- | --- |
| `host` | non-empty string | `"0.0.0.0"` (`:165`) | `0.0.0.0` | Bind interface, passed straight to `app.listen({host, port})` (`startBackend.ts:206-209`). Also echoed in the `Backend starting` manifest (`startBackend.ts:150`). |
| `port` | number ≥ 1 | `4000` (`:166`) | `4000` | TCP port for Fastify (`startBackend.ts:208`), and the value in the `Backend listening` record (`startBackend.ts:216`). |

Assembled at `loadBackendConfig.ts:427-430`. Nothing checks that `port` is an integer or below
65536 — see **E2**.

### 4.2 `workerPool`

| Field | Type | Default | Shipped | Effect |
| --- | --- | --- | --- | --- |
| `concurrentWorkers` | number ≥ 1 | `4` (`:169`) | `4` | Maximum jobs running simultaneously on the **concurrent** queue: `this.concurrentActive < this.config.concurrentWorkers` (`0-utils/jobs/scheduler.ts:168`). Injected at `create/scheduler.ts:13`. Reported by `GET /health/queues` through `JobScheduler.getState()` (`scheduler.ts:140`). |

It does **not** affect the serial queue, which runs exactly one job at a time by construction
(`scheduler.ts:144-164`) regardless of this value. See
[02-request-and-job-runtime.md](02-request-and-job-runtime.md).

### 4.3 `queue`

| Field | Type | Default | Shipped | Effect |
| --- | --- | --- | --- | --- |
| `serialMaxSize` | number ≥ 1 | `1000` (`:172`) | `1000` | Maximum **waiting** depth of the serial queue. `if (queue.length >= queueMaxSize)` at `scheduler.ts:88` logs `job.queue.capacity` and throws `QueueCapacityError`. |
| `concurrentMaxSize` | number ≥ 1 | `1000` (`:173`) | `1000` | Same, for the concurrent queue (`scheduler.ts:84-96`). |

`QueueCapacityError` becomes **HTTP 429** with body `{error, queueType}` and **no `Retry-After`
header** (`2-transport/registerHttpTransport.ts:96-111`). Capacity bounds *waiting* depth only — a
job that has begun executing has already been shifted out of the array.

Assembled at `loadBackendConfig.ts:438-449`.

### 4.4 `logging`

| Field | Type | Default | Shipped | Effect |
| --- | --- | --- | --- | --- |
| `enabled` | boolean | `true` (`:176`) | `true` | `false` returns a `NoopLogger` from `create/logger.ts:19-21`, and **every other field in this section becomes inert** — no directory is created, no stream is opened. Comment at `create/logger.ts:17-18`: *"When logging is disabled the caller gets a no-op implementation. Nothing else in the codebase needs to check whether logging is enabled."* |
| `level` | non-empty string | `"info"` (`:177`) | **`debug`** | Cast to `LogLevel` at `create/logger.ts:66`, ranked at `0-platform/observability/logger.ts:88`, and compared at `logger.ts:117`. **Never validated** — see **E6**. |
| `directory` | non-empty string | `"logs"` (`:178`) | `logs` | `mkdirSync(dir, {recursive:true})` (`create/logger.ts:26`) then `createWriteStream(join(dir, "backend-YYYY-MM-DD.log"), {flags:"a"})` (`create/logger.ts:40`). **cwd-relative** — see **E9**. |
| `detail` | `"shape" \| "content"` | `"content"` (`:180`) | **absent → `content`** | Decides whether records labelled `{detail:"content"}` are written to disk at all (`logger.ts:123`). **The most consequential value on this page — see [§7](#7--loggingdetail--the-content-switch).** |

Assembled at `loadBackendConfig.ts:450-466`. The shipped file sets `level: debug` while
`DEFAULT_CONFIG` says `info` (`configuration.yaml:24` vs `loadBackendConfig.ts:177`), so a reader
of the defaults predicts the wrong verbosity — sharp edge **E7**.

`logging.detail` is the only field in `BackendConfig` that is normalised after parsing rather than
merely validated, and the only one carrying an explicit fail-open rule
(`loadBackendConfig.ts:458-465`).

### 4.5 `intelligence`

#### `intelligence.providers.openrouter`

| Field | Type | Default | Shipped | Effect |
| --- | --- | --- | --- | --- |
| `apiKey` | non-empty string | `"replace-with-openrouter-api-key"` (`:185`, via the constant at `:8`) | the placeholder | `Authorization: Bearer <key>` on every provider request (`0-platform/intelligence/openrouter/provider.ts:260`). **The only value in the tree an environment variable can override — see §8.** |
| `baseUrl` | non-empty string | `"https://openrouter.ai/api/v1"` (`:186`) | same | Prefix concatenated with the request path in the `fetch` template literal at `provider.ts:256`. No trailing-slash handling. |
| `timeoutMs` | number ≥ 1 | `30000` (`:187`) | `30000` | `setTimeout(() => controller.abort(), this.config.timeoutMs)` (`provider.ts:250`), cleared in a `finally` (`provider.ts:282`). |

`provider.ts:245-247` throws `"OpenRouter API key is missing"` when `!this.config.apiKey`. That
branch is **unreachable from any configuration path**: `parseString` rejects the empty string
(`loadBackendConfig.ts:280-282`), the default is a non-empty placeholder, and the environment
override requires a non-empty string. An unconfigured backend therefore sends the literal
placeholder and gets a provider-side rejection, not a local diagnostic.

#### `intelligence.inference.routes` and `intelligence.reasoning.routes`

Both are arrays of route objects with this shape (`IntelligenceCastRouteConfig`,
`loadBackendConfig.ts:10-17`):

| Route field | Type | Default source | Effect |
| --- | --- | --- | --- |
| `purpose` | non-empty string | `"general"` (`:150`) | Lowercased and trimmed into the lookup key (`intelligence.ts:83-89`); a whitespace-only value falls back to `"general"`. |
| `strength` | `low \| medium \| high` | the 3×3 grid (`:147-148`) | Part of the lookup key. |
| `speed` | `low \| medium \| high` | the 3×3 grid (`:147-148`) | Part of the lookup key. |
| `provider` | non-empty string | `"openrouter"` (`:191`, `:194`) | Selects the provider object; an unknown name throws `Intelligence provider '<name>' is not configured` (`intelligence.ts:392-397`). |
| `model` | non-empty string | inference `"openai/gpt-4.1-mini"` (`:191`), reasoning `"openai/gpt-4.1"` (`:194`) | Sent as the request `model`. |
| `effort` | optional `low \| medium \| high` | inference `"low"` (`:191`), reasoning `"medium"` (`:194`) | Forwarded to the provider (`intelligence.ts:134,155,173,198,299`). |

The defaults are generated, not written out: `buildDefaultCastRoutes`
(`loadBackendConfig.ts:140-161`) emits the full cross-product of
`INTELLIGENCE_TIERS = ["low","medium","high"]` (`:138`) — **9 routes per table, 18 in total**, all
with `purpose: "general"` and identical provider/model/effort. The shipped YAML writes all 18 out
by hand (`configuration.yaml:36-148`) and they match the defaults exactly.

Lookup is an exact-match `Map` keyed `"<purpose>|<strength>|<speed>"`
(`intelligence.ts:88-89, 123-124, 350-365`). A missing combination throws
`No configured <kind> cast route for '<key>'` at call time. Route-table behaviour is sharp edge
**E10**.

In the running system only **two** of the 18 routes are ever resolved — both reasoning routes,
both from Derived Outputs: `general|medium|high` for planning
(`3-capabilities/derived-outputs/derived-outputs.ts:819`) and `general|high|medium` for synthesis
(`derived-outputs.ts:942-947`). **No production caller resolves an inference route at all**; see
[06-platform-services.md](06-platform-services.md).

#### `intelligence.embedding`

| Field | Type | Default | Shipped | Effect |
| --- | --- | --- | --- | --- |
| `provider` | non-empty string | `"openrouter"` (`:197`) | `openrouter` | Provider for `Intelligence.embed` (`intelligence.ts:257`). Bypasses the route table entirely. |
| `model` | non-empty string | `"openai/text-embedding-3-small"` (`:198`) | same | Embedding model (`intelligence.ts:259`). Reached only through Knowledge's `IntelligenceEmbedder` (`0-platform/knowledge/embedder.ts:17`). |

Both are echoed into the startup manifest (`startBackend.ts:155-156`).

### 4.6 `formula`

Injected whole as `FormulaLimits` at `create/formula.ts:7`. The engine's own declaration carries
the rule (`0-platform/formula/limits.ts:1`):
`// FormulaLimits — all values come from config, none hardcoded in the engine.`

| Field | Default | Effect (enforcement site) |
| --- | ---: | --- |
| `maxSourceBytes` | `65536` (`:204`) | `if (source.length > limits.maxSourceBytes)` → parse diagnostic (`formula/parser.ts:656-660`). **Counts UTF-16 code units, not bytes**, despite the name. |
| `maxTokens` | `4096` (`:205`) | `tokens.length - 1 > limits.maxTokens` → parse diagnostic (`parser.ts:663-667`). |
| `maxNodes` | `2048` (`:206`) | AST node budget (`parser.ts:72-73`). |
| `maxDepth` | `64` (`:207`) | Parse nesting depth (`parser.ts:82-84`). |
| `maxSteps` | `1000000` (`:208`) | Evaluator step budget (`evaluator.ts:56-57`). |
| `maxCallDepth` | `32` (`:209`) | Function-call depth (`evaluator.ts:381-383`). |
| `maxFields` | `256` (`:210`) | Fields in a constructed record (`evaluator.ts:168-169`). |
| `maxRows` | `100000` (`:211`) | Rows in a constructed table (`evaluator.ts:153-154`). |
| `maxCells` | `1000000` (`:212`) | Output cell count (`engine.ts:261-267`). |
| `maxOutputBytes` | `1048576` (`:213`) | Serialised output size (`engine.ts:274-280`). |
| `maxIntegerBits` | `4096` (`:214`) | **Nothing. Dead.** The only reference outside the loader is the copy at `engine.ts:124`. `grep -rn maxIntegerBits src` returns 5 hits, none of them a comparison. |
| `maxPowerMagnitude` | `1000` (`:215`) | Exponent magnitude for `^` (`evaluator.ts:248-249`) and `POWER` (`builtins.ts:200-201`). |
| `maxRoundingPlaces` | `20` (`:216`) | `ROUND` places (`builtins.ts:220-221`). Bounds **positive** places only; a negative place escapes as a `RangeError` surfaced as `numeric_error`. |

Assembled by `parseFormulaConfig` (`loadBackendConfig.ts:522-538`).

### 4.7 `structuredData`

Injected at `create/structured-data.ts:16`. The capability re-declares the same shape locally as
`StructuredDataConfig` (`3-capabilities/structured-data/structured-data.ts:28-34`).

| Field | Default | Effect |
| --- | ---: | --- |
| `maxDisplayNameBytes` | `256` (`:219`) | UTF-8 byte length of an entry display name (`structured-data/validation.ts:70-73`), called from `structured-data.ts:189` and `:259`. **Field names inside a schema do not use it** — `validation.ts:118` passes a hard-coded `256`. |
| `maxEntries` | `10000` (`:220`) | `if (all.length >= this.config.maxEntries) throw` on declare (`structured-data.ts:195-196`). The check is not atomic with the insert. |
| `maxFieldsPerCollection` | `256` (`:221`) | Schema width (`validation.ts:101-107`), from `structured-data.ts:220` and `:353`. |
| `maxRowsPerCollection` | `100000` (`:222`) | Row count on write and on append (`validation.ts:185-192`, `:223-230`), from `structured-data.ts:226`, `:359`, `:391`. |
| `maxBodyBytes` | `65536` (`:223`) | Formula source size for a Structured Data entry (`structured-data.ts:203`, `:331`). Independent of `formula.maxSourceBytes`. |

Assembled by `parseStructuredDataConfig` (`loadBackendConfig.ts:540-548`).

### 4.8 `richText`

Injected as `{defaults: DEFAULT_STYLE, limits: config.richText}` at `create/rich-text.ts:15-18`.

| Field | Default | Effect |
| --- | ---: | --- |
| `maxAtomsPerContent` | `10000` (`:226`) | `0-platform/rich-text/validate.ts:55-59`. |
| `maxMarksPerContent` | `5000` (`:227`) | `validate.ts:62-66`. |
| `maxMarkRangeSpan` | `1000` (`:228`) | **Nothing. Dead.** Declared at `rich-text/types.ts:140`, never compared anywhere. The module's own docs say so: `rich-text/docs/types.md:85` — *"`maxMarkRangeSpan` is currently stored but never read"* — and Formula's docs disclaim it too (`formula/docs/invariants.md:58`). |

A second, independent copy of these three numbers exists as `DEFAULT_LIMITS`
(`rich-text/types.ts:143-147`) and `DEFAULT_CONFIG` (`:163-166`), both exported on the barrel
(`rich-text/index.ts:34`). The only importer is `rich-text/engine.ts:28`, which **never uses the
symbol** — a dead import. Nothing keeps that copy in step with `loadBackendConfig.ts:225-229`;
today they agree.

Assembled by `parseRichTextLimitsConfig` (`loadBackendConfig.ts:647-653`).

### 4.9 `context`

Injected at `create/context.ts:11`; re-declared locally as `ContextManagerConfig`
(`3-capabilities/context/context.ts:13-16`), whose inline comments are the clearest statement of
intent: `// default 100,000` and `// default 10 — cycle guard`.

| Field | Default | Effect |
| --- | ---: | --- |
| `maxEntriesPerContext` | `100000` (`:231`) | Rejects oversized declares, updates and compositions with `ContextValidationError` (`context.ts:109-113`, `:136-140`, `:255-259`). |
| `maxResolveDepth` | `10` (`:232`) | Recursion bound in `resolve`: `if (depth > this.config.maxResolveDepth) return;` (`context.ts:191`). **It returns silently** — a context graph deeper than the limit yields a truncated result with no diagnostic and no log line. |

Assembled by `parseContextConfig` (`loadBackendConfig.ts:550-555`).

### 4.10 `derivedOutputs`

**Present in `BackendConfig` and in the loader; absent from the shipped YAML.** Injected at
`create/derived-outputs.ts:28`; re-declared locally as `DerivedOutputConfig`
(`3-capabilities/derived-outputs/derived-outputs.ts:41-44`).

| Field | Default | Effect |
| --- | ---: | --- |
| `maxPlanQueries` | `8` (`:235`) | Query budget passed into planning (`derived-outputs.ts:827`). |
| `maxToolRounds` | `8` (`:236`) | Tool-loop round cap passed into `reasonWithToolsStructured` (`derived-outputs.ts:951`); exceeding it throws `Reasoning tool loop exceeded max rounds (<n>)` (`0-platform/intelligence/intelligence.ts:347`). |

Assembled by `parseDerivedOutputConfig` (`loadBackendConfig.ts:557-562`).

### 4.11 `document`

Injected as the third argument to `createDocumentCapability` at `create/document.ts:74`;
re-declared locally as `DocumentHistoryRetention` and `DocumentLimits`
(`3-capabilities/document/domain/model.ts:756-770`).

#### `document.history`

| Field | Default | Effect |
| --- | ---: | --- |
| `retainedBaseCount` | `5` (`:240`) | Base snapshots kept per document; passed to `store.pruneHistory` (`documentService.ts:2019`), applied at `sqliteDocumentStore.ts:583-586`. |
| `retainedChangeSetCount` | `1000` (`:241`) | Two effects. (1) **Compaction trigger**: `if (head.revision - head.baseSeq >= retainedChangeSetCount)` dispatches a compaction intent (`documentService.ts:1165-1169`). (2) The compaction cutoff revision (`documentService.ts:1980-1983`) and the ChangeSet prune boundary (`sqliteDocumentStore.ts:579-582`). |
| `retainedTerminalAttemptCount` | `1000` (`:242`) | Terminal attempt rows kept per document (`sqliteDocumentStore.ts:652`). |

**A second, stricter validation exists downstream.** `sqliteDocumentStore.ts:559-567`:

```ts
for (const value of [
  retainedBaseCount,
  retainedChangeSetCount,
  retainedTerminalAttemptCount
]) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("Document history retention values must be positive safe integers");
  }
}
```

The config loader permits non-integers (**E2**). So `retainedBaseCount: 2.5` starts the process
happily and then throws on the first compaction — long after startup, inside a job. This is the
only place in the tree that re-checks a configuration value, and it re-checks it more strictly than
the loader did.

#### `document.limits`

| Field | Default | Effect (all in `document/domain/validation.ts`) |
| --- | ---: | --- |
| `maxRowsPerDocument` | `10000` (`:245`) | `:393-395` |
| `maxBlocksPerRow` | `32` (`:246`) | `:346-348` |
| `maxStylesPerDocument` | `256` (`:247`) | `:133-135` |
| `maxNestingDepth` | `16` (`:248`) | `:338-340` |
| `maxAtomsPerBlockContent` | `10000` (`:249`) | `:203-205` |
| `maxTableRows` | `1000` (`:250`) | `:246` |
| `maxTableColumns` | `256` (`:251`) | `:247` |

All seven produce validation *diagnostics*, not throws, in the snapshot validator. Assembled by
`parseDocumentConfig` (`loadBackendConfig.ts:564-627`) — the only sub-parser that descends two
levels.

### 4.12 `retention`

The one section whose interface carries doc comments in the loader itself
(`loadBackendConfig.ts:96-101`).

| Field | Type | Default | Shipped | Effect |
| --- | --- | ---: | --- | --- |
| `revisionRetentionDays` | number ≥ 1 | `30` (`:255`) | `30` | `cutoff = now - revisionRetentionDays × 86_400_000`, formatted ISO, computed **once per sweep** and passed to all 11 ports (`0-utils/persistence/resourceRetentionScheduler.ts:97-99`). Declared as *"Age after which superseded revisions and deleted resource histories expire."* |
| `sweepIntervalHours` | number ≥ 1 | `24` (`:256`) | `24` | `setInterval(…, sweepIntervalHours × 3_600_000)`, then `unref()`ed (`resourceRetentionScheduler.ts:62-66`). Declared as *"Wall-clock cadence for the process-wide retention sweep."* |

Both values are echoed in the `retention.scheduler.started` record
(`resourceRetentionScheduler.ts:67-70`). `retentionScheduler.start()` runs **one immediate sweep**
before arming the timer (`:59`), and is called only after `app.listen` resolves
(`startBackend.ts:206-213`) — the comment at `:210-212` explains why: *"Start recurring work only
after the transport has bound successfully. Otherwise a listen failure would leave interval timers
keeping the failed startup process alive."*

The retention sweep and its 11-port ordering are described in
[04-state-and-persistence.md](04-state-and-persistence.md).

Assembled by `parseRetentionConfig` (`loadBackendConfig.ts:629-645`).

### 4.13 `projectId` and `userId`

| Field | Type | Default | Shipped | Effect |
| --- | --- | --- | --- | --- |
| `projectId` | non-empty string | `"default"` (`:201`) | `default` | **The storage namespace.** All **12 live stores** derive their table prefix as `sha256(projectId).hex.slice(0,16)` (e.g. `document/persistence/sqliteSchema.ts:22`, `templates/persistence/sqliteSchema.ts:13`, `comments/persistence/sqliteSchema.ts:13`, `persona/persistence/sqliteSchema.ts:11`, `investigation/persistence/sqliteInvestigationStore.ts:35`, `context/sqlite-store.ts:23`, `0-platform/database/knowledge-store.ts:17-18`). A 13th copy of the same helper sits in `slides/persistence/sqliteSchema.ts`, which nothing constructs. Also passed directly to `createKnowledge` (`startBackend.ts:66`) and into the Formula resolver scope (`startBackend.ts:77`). |
| `userId` | non-empty string | `"default-user"` (`:202`) | `default-user` | **The trusted actor identity.** There is no authentication anywhere; this string is the attribution on every write: Document (`create/document.ts:73`), Comments (`create/comments.ts:50`, with `origin: "user"`), Templates (`create/templates.ts:76`), Investigation (`create/investigation.ts:20`), and the Formula name-resolver scope (`create/formula-name-resolver.ts:435`). |

Assembled at `loadBackendConfig.ts:510-511`. Structured Data hashes `ownerId`
(`structured-data/sqlite-store.ts:22-23`), which is `config.projectId` at its one construction
site (`create/structured-data.ts:15`).

**Changing `projectId` on an existing deployment is a silent data cut-over.** The old tables stay
in the same `.db` file under the old prefix; the process creates a fresh set and sees an empty
database. The original project id is never persisted, so nothing in a database file can say which
project a prefix belongs to. Nothing warns.

---

## 5 · The parsers

Six functions do all the validation. There is no schema library.

| Parser | Lines | `undefined` → | Accepts | Throws on |
| --- | --- | --- | --- | --- |
| `parseNumber` | `263-273` | fallback | `typeof v === "number" && Number.isFinite(v) && v >= 1` | anything else, including `0`, negatives, `.nan`, `.inf`, and numeric **strings** |
| `parseString` | `275-285` | fallback | non-empty string | non-strings and `""` |
| `parseBoolean` | `287-301` | fallback | real booleans | `"true"`, `1`, everything else |
| `parseTier` | `303-317` | fallback | exactly `"low" \| "medium" \| "high"` | anything else |
| `parseOptionalTier` | `319-333` | fallback (may itself be `undefined`) | as above | anything else |
| `parseCastRoutes` | `335-383` | copy of the fallback array | an array of plain objects | non-arrays; array elements that are `null`, arrays, or non-objects |

Every message is the same sentence with the field path substituted:

```ts
throw new Error(`Invalid '${fieldName}' value in backend configuration`);
```

Field paths are fully qualified (`"document.limits.maxTableRows"`,
`"intelligence.inference.routes[3].speed"`), which is the loader's best feature: the error names
exactly what to fix. What it does **not** carry is the offending value or the file path.

Section lookup is uniform and forgiving (`loadBackendConfig.ts:389-411`):

```ts
const server = (parsed.server as Record<string, unknown> | undefined) ?? {};
```

An absent section becomes `{}`, and every field in it then falls back individually. This is why a
missing section is harmless and a **missing file** is fatal — see **E3**.

---

## 6 · How a section reaches its consumer

The loader declares `FormulaConfig`, `StructuredDataConfig`, `RichTextLimitsConfig`,
`ContextManagerConfig`, `DerivedOutputConfig`, `DocumentConfig` and `RetentionConfig`
(`loadBackendConfig.ts:39-101`). With one exception, **the consumers do not import those types.**
They declare their own, structurally identical:

| Loader type | `0-utils` line | Consumer's own declaration | Linked by |
| --- | --- | --- | --- |
| `FormulaConfig` | `:39-53` | `FormulaLimits`, `0-platform/formula/limits.ts:3-17` | structural typing at `create/formula.ts:7` |
| `RichTextLimitsConfig` | `:63-67` | `RichTextLimits`, `0-platform/rich-text/types.ts:137-141` | `create/rich-text.ts:15-18` |
| `StructuredDataConfig` | `:55-61` | `StructuredDataConfig`, `structured-data/structured-data.ts:28-34` | `create/structured-data.ts:16` |
| `ContextManagerConfig` | `:69-72` | `ContextManagerConfig`, `context/context.ts:13-16` | `create/context.ts:11` |
| `DerivedOutputConfig` | `:74-77` | `DerivedOutputConfig`, `derived-outputs/derived-outputs.ts:41-44` | `create/derived-outputs.ts:28` |
| `DocumentConfig` | `:79-94` | `DocumentHistoryRetention` + `DocumentLimits`, `document/domain/model.ts:756-770` | `create/document.ts:74` |
| `RetentionConfig` | `:96-101` | — **imported directly** | `resourceRetentionScheduler.ts:2` |

`0-utils/persistence/resourceRetentionScheduler.ts` is the only file outside `1-init/create/` that
imports anything from `loadBackendConfig.ts`, and it imports only `RetentionConfig`. Every other
consumer is coupled by shape alone, which is what keeps `3-capabilities` and `0-platform` from
depending on `0-utils/config` — see [01-layers-and-boundaries.md](01-layers-and-boundaries.md).

The cost is that a rename in `DEFAULT_CONFIG` and a rename in a capability's local interface are
two edits `tsc` will connect only where the two meet, in `1-init/create/`.

---

## 7 · `logging.detail` — the content switch

**This is the single most consequential configuration value in the backend, it defaults to writing
authored user content to disk, and it does not appear in the shipped configuration file.**

### 7.1 What it does

`LogDetail` (`0-platform/observability/logger.ts:22`) labels what a record's `data` carries. The
declaration comment (`logger.ts:10-21`) is the design statement and is worth quoting whole:

```text
/**
 * What kind of thing a record's `data` carries.
 *
 * - `shape` — counts, enums, IDs, durations. Safe everywhere.
 * - `content` — names, titles, prompt text, field values, rows. The fastest way
 *   to see what actually happened, and not something a production build should
 *   be writing to disk by default.
 *
 * Labelling the record rather than loosening the rule is the point: the switch
 * from development to production becomes one configuration value instead of an
 * audit of every call site, and there is still something left to tighten.
 */
```

Every `Logger` method takes an optional third argument `options?: LogOptions`
(`logger.ts:44-55`). An unlabelled record is `shape`
(`logger.ts:122`: `const detail = options?.detail ?? "shape";`). The filter is two lines
(`logger.ts:123-125`):

```ts
if (detail === "content" && this.detail !== "content") {
  return;
}
```

`FileLogger`'s constructor comment (`logger.ts:80-86`) explains the drop-whole choice:

```text
/**
 * Which detail labels are written. `content` means everything; `shape`
 * drops content-labelled records entirely rather than redacting their
 * fields, because a half-redacted record is worse than an absent one — it
 * looks complete.
 */
```

The label is written into the record when present (`logger.ts:132-134`), *"so a reader can filter
after the fact — the label is part of the record, not only a decision made at write time."*

### 7.2 The default, and the gap

`DEFAULT_CONFIG.logging.detail` is `"content"` (`loadBackendConfig.ts:180`), directly under the
comment `// Developer-friendly by default. Production flips this one value.` The type's own
docstring (`loadBackendConfig.ts:119-124`) repeats it: *"`content` (the default) writes everything
and is what development wants; `shape` drops content-labelled records. One value, rather than an
audit of every call site."*

`grep -n detail apps/backend/etc/configuration.yaml` returns nothing. The consequence, stated
plainly:

> **The backend writes authored user content into `logs/backend-YYYY-MM-DD.log` by default, and
> the shipped configuration file gives no hint that the switch exists.** Turning it off requires
> adding a key that appears in no file and in no documentation shipped with the repository.

The startup manifest does not help either: `Backend starting` logs `loggingEnabled` and
`loggingLevel` (`startBackend.ts:153-154`) and **not** `detail`. Nothing at runtime announces which
posture the process is in.

### 7.3 The fail-open asymmetry

`loadBackendConfig.ts:458-465`, comment verbatim:

```ts
// Anything that is not exactly "shape" means write everything. An
// unrecognised value therefore fails open toward more logging, which is
// the safe direction while this is a development setting.
detail: parseString(
  logging.detail,
  DEFAULT_CONFIG.logging.detail,
  "logging.detail"
) === "shape" ? "shape" : "content"
```

`parseString` runs **first**. So the fail-open rule applies only to strings, and the split is:

| YAML | Result | Why |
| --- | --- | --- |
| absent | `content` | fallback is `DEFAULT_CONFIG.logging.detail` |
| `shape` | `shape` | exact match |
| `content` | `content` | not `"shape"` |
| `Shape`, `SHAPE`, `shpae`, `off`, `none` | **`content`** | not exactly `"shape"`; fail-open by design |
| `""` | **startup error** | `parseString` rejects the empty string (`:280`) |
| `3` | **startup error** | `parseString` rejects non-strings (`:280`) |
| `true` / `false` | **startup error** | YAML booleans are not strings |

Rows 1, 2, 4 (as `shpae`), 5, 6 and 7 were measured directly against the loader; the rest follow
from the literal `=== "shape"` comparison, which is case-sensitive. The trap is `Shape` with a
capital S: it silently produces maximum disclosure, and the process starts.

### 7.4 The nine call sites

`grep -rn 'detail: "content"' src` → 10 hits: **9 call sites**, all `logger.debug`, all in two
capabilities, plus the `DEFAULT_CONFIG` value at `loadBackendConfig.ts:180`.

| Site | Record | What it writes |
| --- | --- | --- |
| `document/application/documentService.ts:484-491` | `document.duplicate.output-declared` | the source **prompt text** and the resolved **context entries** |
| `documentService.ts:586-589` | `document.marked-as-template.detail` | the document **title** |
| `documentService.ts:682-690` | `document.prompt.rebound` | **variable name**, resolved **context entries**, **prompt text** |
| `documentService.ts:700-704` | `document.bindings-applied.detail` | the full **binding list** and every **context variable** |
| `documentService.ts:747-750` | `document.template-submit.operations` | the **whole operation array**, including Rich Content |
| `templates/application/templateService.ts:211-215` | `templates.list.filtered` | the **search term**, the kinds filter, and **every matched name** |
| `templateService.ts:349-354` | `templates.register.detail` | template **name**, **description**, **context bindings** |
| `templateService.ts:457-465` | `templates.update.detail` | **prior and new name**, **description**, **prior and new bindings**, and the **resource operations** |
| `templateService.ts:516-523` | `templates.instantiate.detail` | template **name**, instance **name**, **binding arguments** |

Three of these carry their own justification, and they are the best argument in the tree for the
feature existing at all:

- `templateService.ts:209-210` — *"The term and what it matched. A search returning nothing is the
  case worth seeing, and counts alone cannot tell you why."*
- `templateService.ts:520-521` — *"The arguments themselves. Which Context each parameter got is
  the question you actually have when an instance reads wrong."*
- `documentService.ts:680-681` — *"What this prompt is now grounded on, by name and target. The
  single most useful line when a template produces an answer nobody expected."*

### 7.5 What `shape` mode does **not** stop

Setting `logging.detail: shape` is not sufficient to keep user content out of the log file. Three
populations are unlabelled and therefore always written:

1. **Unlabelled `info` records that carry content anyway.** `general-files.upload` logs `fileName`
   (`general-files/application/generalFileService.ts:204-207`); `context.declare` and
   `context.composeNamed` log `displayName` (`context/context.ts:130`, `:274`);
   `connector.register.admitting`, `connector.sync.admitting-new` and `connector.sync.updating` log
   `itemKey` (`connector/application/connectorService.ts:154`, `:316`, `:351`), which for the
   filesystem provider **is an absolute path**.
2. **Slides' competing mechanism.** `slides/persistence/sqliteSlidesStore.ts:144` defines
   `CONTENT_KEY = "content"`, a reserved key *inside* `data`, with a doc comment
   (`:130-143`) saying that it *"belongs in `0-platform/observability` once that flag lands; it is
   here for now because Slides is the only capability observing the convention."* **The flag landed
   in this very commit (`ef6d462`) and Slides was not migrated.** `FileLogger` never inspects
   `data`, and Slides passes no `options`, so in `shape` mode a Slides record is written in full.
   Slides is unreachable over HTTP ([07-capabilities/slides.md](07-capabilities/slides.md)), so
   nothing leaks today — the convention is nonetheless broken in two directions at once.
3. **Test doubles cannot see the label.** `test/helpers/testDoubles.ts:11-29`'s `CapturingLogger`
   still implements the stale two-parameter `Logger` and silently discards `options`. Because
   `test/` is outside `tsconfig.json`'s `include` this does not fail to compile. It is why
   `logging-detail.test.ts` builds a raw `FileLogger` instead of using the standard double.

### 7.6 What is tested

`test/capabilities/logging-detail.test.ts` — 1 top-level test and 4 subtests (`:21`, `:22`, `:32`,
`:50`, `:59`) — covers the `FileLogger` behaviour directly: unlabelled is written, `content` is
written under `content` and dropped under `shape`, the level filter applies independently, and
`NoopLogger` accepts the argument. **No test covers the configuration path**: nothing asserts that
`logging.detail` in the YAML reaches `FileLogger`, and nothing asserts the fail-open
normalisation. The test builds a `FileLogger` by hand (`:11-17`) precisely because the shared
double cannot carry the label.

See [06-platform-services.md](06-platform-services.md) for the logger itself and
[11-known-issues.md](11-known-issues.md) for the content-logging posture as a defect.

---

## 8 · The one environment variable

`grep -rn "process\.env" apps/backend/src` returns **exactly one hit**:
`loadBackendConfig.ts:418`. There is no other environment-driven behaviour in the backend.

```ts
const configuredOpenRouterApiKey = parseString(
  openrouter.apiKey,
  DEFAULT_CONFIG.intelligence.providers.openrouter.apiKey,
  "intelligence.providers.openrouter.apiKey"
);

const openRouterApiKeyFromEnv = process.env.OPENROUTER_API_KEY;
const effectiveOpenRouterApiKey =
  configuredOpenRouterApiKey === OPENROUTER_API_KEY_PLACEHOLDER &&
  typeof openRouterApiKeyFromEnv === "string" &&
  openRouterApiKeyFromEnv.length > 0
    ? openRouterApiKeyFromEnv
    : configuredOpenRouterApiKey;
```

(`loadBackendConfig.ts:412-424`; the placeholder constant is at `:8`.)

| YAML `apiKey` | `OPENROUTER_API_KEY` set? | Result |
| --- | --- | --- |
| `replace-with-openrouter-api-key` (the placeholder) | yes, non-empty | **the environment value** |
| `replace-with-openrouter-api-key` | no, or empty | the placeholder, which is then sent as a bearer token |
| any real key | yes | **the YAML value** — the environment is ignored |
| any real key | no | the YAML value |
| absent | yes | the environment value (the fallback *is* the placeholder) |
| `""` | — | **startup error**, `parseString` rejects it before the override is considered |

**The override wins only over the literal placeholder.** This is the inverse of the usual
convention and it is stated nowhere outside the loader — not in the YAML's own comment
(`configuration.yaml:31`: *"Replace with a real key or override via OPENROUTER_API_KEY in runtime
env"*, which implies either works), not in `etc/README.md`, and not in the Intelligence module
docs.

`ICARUS_SMOKE_BASE_URL` and `ICARUS_SMOKE_CONNECTOR_LOCATOR` (`test/smoke/http-smoke.mjs:4-7`)
configure the smoke runner, not the backend.

---

## 9 · Sharp edges

Each of these was reproduced against the loader at HEAD. The "Measured" column reports what
actually happened, not what the types suggest.

### E1 — No tunable can be `0`

`parseNumber` requires `>= 1` (`loadBackendConfig.ts:268`). Therefore:

| YAML | Measured |
| --- | --- |
| `queue.serialMaxSize: 0` | `Error: Invalid 'queue.serialMaxSize' value in backend configuration` |
| `retention.revisionRetentionDays: 0` | `Error: Invalid 'retention.revisionRetentionDays' value in backend configuration` |

Both are startup **errors**, not configurations. "Retain nothing, purge immediately" and "reject
every queued job" are not expressible. `1` is the floor for all **42** numeric fields (2 in
`server`/`workerPool`, 2 in `queue`, 1 in `intelligence`, 13 in `formula`, 5 in `structuredData`,
3 in `richText`, 2 in `context`, 2 in `derivedOutputs`, 10 in `document`, 2 in `retention`).

### E2 — Non-integers pass silently

`parseNumber` checks `Number.isFinite`, not `Number.isInteger`.

| YAML | Measured |
| --- | --- |
| `queue.serialMaxSize: 1.5` | loads; `config.queue.serialMaxSize === 1.5` |
| `server.port: 65536.7` | **loads**; then `app.listen` throws `ERR_SOCKET_BAD_PORT: options.port should be >= 0 and < 65536` |
| `document.history.retainedBaseCount: 2.5` | loads; throws later, inside a compaction job, at `sqliteDocumentStore.ts:564-565` |

The `port` failure is at least loud: it happens inside `startBackend`'s `try`, so it produces a
`backend.start.failed` record before the process exits 1. The `retainedBaseCount` failure surfaces
only when a document first compacts.

`.inf` and `.nan` *are* rejected (`Number.isFinite`), and so are negatives — measured:
`formula.maxSteps: .inf` and `server.port: -1` both throw.

### E3 — Empty file, missing file, and scalar documents behave three different ways

| File content | Measured |
| --- | --- |
| *(file absent)* | `Error: ENOENT` from `readFile` (`loadBackendConfig.ts:386`). **Fatal.** |
| `""` (empty) | `TypeError: Cannot read properties of null (reading 'server')` |
| `# a comment only` | same `TypeError` |
| `hello` (a scalar) | **loads with every default** |
| a YAML sequence (`- a` / `- b`) | **loads with every default** |
| `true` | **loads with every default** |

`parse("")` returns `null`, and `loadBackendConfig.ts:389` does `parsed.server` unguarded. The
resulting `TypeError` is a raw runtime error with no field name and no file path. A scalar or
sequence document is silently accepted because property access on a string, number or boolean
yields `undefined`, which every parser treats as "use the fallback".

**`DEFAULT_CONFIG` is a per-field fallback, never a whole-file one.** There is no `catch` that
substitutes it when the file is missing or unreadable.

### E4 — A startup failure is completely silent

`createConfig()` and `createLogger()` are at `startBackend.ts:48-49`, **outside** the `try` that
begins at `:51`. Every failure in §E1, §E3 and §8 therefore escapes before a logger exists.
`src/index.ts:12-14` swallows it:

```ts
void startBackend().catch(() => {
  process.exitCode = 1;
});
```

`console.*` is forbidden in `src/index.ts` by a source-scanning test
(`runtime-wiring.test.ts:202-210`). Net effect: **a misconfigured backend exits 1 with no output on
stdout, no output on stderr, and no log-file entry.** Anything that fails *after* line 51 — a bad
port at `listen`, a duplicate Intelligence route — does get a `backend.start.failed` record.

### E5 — Unknown sections and unknown keys are ignored

There is no strict mode. A `templates:` section, a misspelled `retenion:`, or a stray key inside a
known section is dropped without a warning. This is pinned by a test
(`templates.test.ts:2164-2176`, *"Templates ignores a legacy catalog-limit configuration
section"*), which writes a `templates:` block carrying `maxTemplatesPerProject: 1` and asserts
`assert.equal("templates" in config, false)`.

The consequence is that a typo in a **key** is silent, while a typo in a **value** is usually
fatal. `retention.revisionRetentionDaze: 7` runs at the default 30 days forever.

### E6 — `logging.level` is never validated, and a typo maximises verbosity

`parseString` accepts any non-empty string (`loadBackendConfig.ts:452`); `create/logger.ts:66`
casts it: `config.logging.level as LogLevel`. `LOG_LEVEL_RANK[level]` is then `undefined`
(`logger.ts:88`), and `LOG_LEVEL_RANK[level] < this.minLevel` (`logger.ts:117`) is `false` for
every comparison against `undefined`. **Level filtering is disabled entirely and every record is
written.**

Measured: `logging.level: infoo` loads, and `config.logging.level === "infoo"`.

A typo fails toward maximum disclosure, and combined with the `detail` default (§7) that means the
most verbose possible posture. Contrast `logging.detail`, which is normalised with a documented
rule.

### E7 — The shipped file and the defaults disagree about verbosity

`configuration.yaml:24` sets `level: debug`; `loadBackendConfig.ts:177` defaults to `info`. A
reader who consults only the defaults predicts the wrong volume. `etc/README.md` does not mention
either.

### E8 — `derivedOutputs` is honoured but unwritten

See [§3](#3--shape-at-a-glance). `etc/README.md:16-19` lists `derivedOutputs` among "Sections not
yet documented **here**", which reads as though the section is in the file. It is not. It is,
however, fully loadable — measured.

### E9 — The config path is module-relative; the data and log paths are cwd-relative

| Path | Anchored to | Where |
| --- | --- | --- |
| `etc/configuration.yaml` | the module directory | `loadBackendConfig.ts:260-261` |
| `./data/*.db` (12 files) | the process cwd | the 12 `*_DB_PATH` constants in `1-init/create/` |
| `logs/` | the process cwd | `create/logger.ts:23,26,40` |

So `node dist/index.js` from the repo root reads `apps/backend/etc/configuration.yaml` (correct)
and then creates `<repo>/data/` and `<repo>/logs/` (probably not what was wanted). **There is no
guard, no warning, and no log line naming the resolved directory.**

It also escapes `.gitignore`: the ignore file lists `apps/backend/data/*.db` and
`apps/backend/logs/*.log` plus a root `logs/*.log`, but **not** a root `data/`. A stray
`<repo>/data/` shows up as untracked files.

Neither path is configurable. `logging.directory` is the only one that can move, and it moves
relative to cwd.

### E10 — The intelligence route table has four holes

`parseCastRoutes` (`loadBackendConfig.ts:335-383`) is the only parser with per-index fallback
semantics: `const fallbackRoute = fallback[index] ?? fallback[0];` (`:356`).

| Case | Measured |
| --- | --- |
| `routes: []` | accepted; the table is **empty**. Any `resolveRoute` for that kind throws `No configured <kind> cast route for '<key>'` **at call time**, not at startup. Embedding is unaffected — it bypasses the table (`intelligence.ts:255-269`). |
| a route with only `model:` | accepted; every other field is inherited from **the default route at the same index**. Measured: `{purpose:"general", strength:"low", speed:"low", provider:"openrouter", model:"my/model", effort:"low"}`. |
| 10 routes | accepted by the loader; route 9 borrows **route 0's** defaults, so it duplicates the key `general\|low\|low`. `Intelligence`'s constructor then throws `Duplicate reasoning cast route: 'general\|low\|low'`. |
| an incomplete 3×3 grid | **not checked anywhere.** A table of 3 routes loads and constructs; the missing six combinations fail only if something asks for one. |

**Correction to the ground-truth notes**: uniqueness *is* checked — `createRouteMap` throws
`Duplicate <kind> cast route: '<key>'` at `intelligence.ts:377-379` — just not by the config
loader. Because `createIntelligence` runs at `startBackend.ts:56`, inside the `try`, a duplicate
route *is* reported as `backend.start.failed`. **Completeness is not checked by anything.**

Because only two reasoning routes have a production caller (§4.5), a route table missing the other
16 entries would run indefinitely without complaint.

### E11 — Two configured fields have no reader

`formula.maxIntegerBits` (§4.6) and `richText.maxMarkRangeSpan` (§4.8) are parsed, validated,
copied into the engine's limits object, and never compared to anything. Both are in the shipped
YAML, so an operator can tune two values that do nothing. The Rich Text and Formula module docs
both admit this; nothing at the top level did until now.

### E12 — The loader has one test, and it is about something else

The `loadBackendConfig` **function** is imported by exactly one test file
(`test/capabilities/templates.test.ts:8`) for exactly one assertion (E5).
`observability.test.ts:8` imports the `BackendConfig` *type* from the same module and never calls
the loader. **653 lines, 42 numeric
fields, six parsers, one environment override and one normalisation rule are otherwise
uncovered.** Every measured result on this page came from probing the loader by hand, not from a
test that guards it.

`observability.test.ts:10-18` constructs a `BackendConfig` by casting past 13 missing required
fields — invisible, because `test/` is outside `tsconfig.json`'s `include`.

### E13 — Nothing reloads, and nothing reports the effective configuration

There is no `SIGHUP` handler, no file watcher, and no endpoint that returns the loaded
configuration. `GET /health/queues` reports live queue depths plus `concurrentWorkers` — the only
configured value visible on any endpoint. The `Backend starting` manifest
(`startBackend.ts:149-174`) prints `host`, `port`, `concurrentWorkers`, `loggingEnabled`,
`loggingLevel`, and the embedding provider and model — **7 of 53 scalar fields**, and not
`logging.detail`. To know what a running process is actually configured with, you read the YAML
and trust that nobody edited it after boot.

---

## 10 · What is not configurable

Stated plainly, because absence is the most common configuration question:

| Thing | Status |
| --- | --- |
| Config file path | Not overridable. No flag, no environment variable. |
| Database directory or per-capability database paths | Hard-coded `./data/<name>.db` in 12 files under `1-init/create/`. |
| Log file name and rotation | Hard-coded `backend-YYYY-MM-DD.log`, one per calendar day (`create/logger.ts:10-14`). |
| Log retention | **None.** Files accumulate forever. `ResourceRetentionScheduler` governs deleted *resources*, not logs. |
| CORS | No plugin is registered anywhere. The frontend fetches `:4000` from `:3000` with no proxy in `vite.config.ts`. |
| TLS, authentication, authorisation, rate limiting | None exist. `userId` is a configured string, not an identity. |
| Request body size, timeouts, keep-alive | Fastify defaults. `createApp()` (`1-init/create/app.ts:6`) is one line: `Fastify({ logger: false })`. |
| Retry, backoff, queue drain on shutdown | Document's dispatch backoff is hard-coded 25 ms doubling to 2 s, and its stage retries are `[10, 50]` ms (`documentService.ts:145-147`); `JobScheduler` has no `stop()`/`drain()`. |
| Connector sync intervals | Hard-coded `SYNC_INTERVALS` (`connector/domain/model.ts:21-26`): 5 min, 30 min, 2 hr, 12 hr. |
| Comments body limit | Hard-coded `16 * 1024` (`comments/domain/validation.ts:23`), not a config field. |
| Structured Data schema field-name length | Hard-coded `256` (`structured-data/validation.ts:118`), ignoring `maxDisplayNameBytes`. |
| `.env.example` | Reserved by `.gitignore:6`; **the file does not exist**. Nothing tells a new contributor that `OPENROUTER_API_KEY` is the one secret. |
| CI enforcement of any of this | There is no CI configuration in the repository. |

---

## 11 · Re-verifying this page

```bash
export PATH="/nix/store/l7b3cb5p19qnlykasxwqdggck3ijilqq-nodejs-22.23.1/bin:$PATH"
cd apps/backend

# Section and leaf counts
node -e 'const {parse}=require("yaml");const s=require("fs").readFileSync("etc/configuration.yaml","utf8");
         const p=parse(s);console.log(Object.keys(p).length, Object.keys(p).join(" "))'
#   → 13 server workerPool queue logging intelligence formula structuredData richText context
#        document retention projectId userId

# The two fields the file omits
grep -c derivedOutputs etc/configuration.yaml   # → 0
grep -c detail          etc/configuration.yaml   # → 0

# The single environment read
grep -rn 'process\.env' src                      # → loadBackendConfig.ts:418, and nothing else

# The content-labelled call sites
grep -rn 'detail: "content"' src | wc -l         # → 10 (9 call sites + the DEFAULT_CONFIG value)

# The loader's only caller in the test tree (the other hit is a type-only import)
grep -rn 'loadBackendConfig(' test               # → templates.test.ts:2173

# The 12 cwd-relative database paths (restrict to .ts — the module docs quote them too)
grep -rn '"\./data/' src --include=*.ts | wc -l  # → 12
```

Reproducing the sharp edges requires calling `loadBackendConfig(path)` directly with a temporary
file; every "Measured" row above was produced that way, against `ef6d462`, on 2026-08-09.

---

## Related pages

- [00-orientation.md](00-orientation.md) — repo layout, the toolchain, and the
  `--conditions=development` resolution mechanism.
- [02-request-and-job-runtime.md](02-request-and-job-runtime.md) — what `queue.*` and
  `workerPool.concurrentWorkers` govern, and the 429 path.
- [04-state-and-persistence.md](04-state-and-persistence.md) — what `retention.*` sweeps, and the
  `projectId`-hashed table prefixes.
- [06-platform-services.md](06-platform-services.md) — the logger, the Intelligence route table,
  and the Formula and Rich Text limit consumers.
- [07-capabilities/document.md](07-capabilities/document.md) — what `document.history.*` triggers.
- [11-known-issues.md](11-known-issues.md) — the content-logging posture, the silent-startup
  failure, and the unvalidated log level, as defects rather than as reference entries.
