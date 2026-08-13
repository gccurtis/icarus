# Review 001 · Internal Consistency and Documentation Drift

**Date:** 2026-08-01
**Scope:** `apps/backend` (all 193 source files) and the repository's architecture docs.
**Method:** full read, plus measured typecheck / test / boot runs.

## Out of scope

**The missing `slide/application/slideService.ts` is excluded.** It is in-progress work, not a
defect, and it is already documented in
[`09-verified-status.md`](../09-verified-status.md) and in Slide's own
`docs/README.md`. Nothing in this review depends on it or recommends changing it.

One consequence of it is worth carrying into the fix plan though: while the tree does not
typecheck, **any recommendation here that would be enforced by `tsc` cannot be gated in CI
yet.** Sequencing accounts for that at the end.

## Summary

| # | Finding | Severity | Effort | Recommendation |
| --- | --- | --- | --- | --- |
| 1 | Derived Outputs exceeds the "small atomic capability" bar but uses the flat shape | Low | Medium | Restructure Derived Outputs only; leave Context and Structured Data alone |
| 2 | Wire validation is inconsistent across capabilities; two classes of real defect in the coercion style | Medium | Medium | Fix the coercion defects now; adopt `wire/` decoders incrementally |
| 3 | `docs/backend-architecture.md` describes a layout that no longer exists | Medium | Low | Rewrite as a pointer page, or delete |
| 4 | One broken link in `docs/architecture.md`; `etc/README.md` covers 3 of 13 config sections; one wrong interface sketch in `repository-boundaries.md` | Low | Low | Mechanical fixes |

Findings 3 and 4 are the ones I would do first: they are cheap, and stale architecture docs
actively mislead anyone (human or agent) onboarding onto a codebase whose central idea *is*
its structure.

---

## Finding 1 · Capability shape

### What I observed

Capabilities use two internal shapes:

- **Layered** (`domain/ application/ ports/ persistence/ projections/ wire/`) — Document,
  Slide, Activity, Connector, General Files.
- **Flat** (files at the capability root) — Context, Structured Data, Derived Outputs.

### Why this is mostly *not* a problem

`docs/runtime/repository-boundaries.md` explicitly sanctions both:

> Small atomic capabilities may keep these files at the capability root. Large editor
> capabilities separate `domain`, `application`, `ports`, `persistence`, and `indexes`. The
> ownership rule remains the same.

So the rule is not "always layered" — it is **layered above a size/complexity threshold**.
Measured against that rule:

| Capability | Total lines | Shape | Compliant? |
| --- | --- | --- | --- |
| `context` | 425 | Flat | Yes — genuinely small and atomic |
| `structured-data` | 985 | Flat | Yes — borderline but defensible |
| `derived-outputs` | 2,730 | Flat | **No** |

Only Derived Outputs is actually out of compliance. It is larger than Activity (1,043 lines)
and General Files (approx. 900), both of which are fully layered.

### The concrete symptom

`derived-outputs/derived-outputs.ts` is 1,325 lines holding eight distinct concerns, marked
by its own section dividers:

```text
line   39  ─── Config ───
line   46  ─── Resource Reader Port ───        ← a PORT, defined inside the service file
line   70  ─── Service Interface ───
line   95  ─── Prompts (inline, versioned in code) ───
line  171  ─── Schemas ───
line  277  ─── Helpers ───                      ← includes evidence/synthesis validation
line  573  ─── Implementation ───
line 1061  ── Tool Builders ──
line 1307  ─── Factory ───
```

The sharpest of these is line 46. `ResourceReader`, `ResourceDescriptor`, and
`ResourceContent` are **ports** — they are implemented by `1-init/create/resource-reader.ts`
and consumed across the composition root. Every other capability puts its ports in `ports/`.
Here they live inside the service implementation file, and are re-exported through the barrel
from `./derived-outputs.js`. That is the one part of this finding that has a practical cost:
a reader looking for the Derived Outputs port contract has no reason to expect it in the
service file.

### Recommended fix

**Restructure Derived Outputs to the layered shape. Do not touch Context or Structured
Data.** A mass migration would create churn across three capabilities to fix one, and would
contradict the rule the repo already wrote down.

Proposed target, mapping every existing line:

```text
derived-outputs/
  index.ts                              (update import paths only)
  domain/
    model.ts                            unchanged (259)
    prompts.ts                          from derived-outputs.ts  95–170
    schemas.ts                          from derived-outputs.ts 171–276
    validation.ts                       from derived-outputs.ts 333–559
                                        (spanKey, candidateKey, parseEvidenceSpan,
                                         validateQueries, validateEvidence, validateSynthesis)
  application/
    derivedOutputService.ts             from derived-outputs.ts 573–1060, 1307–1325
    tools.ts                            from derived-outputs.ts 1061–1306
  ports/
    derivedOutputStore.ts               from store.ts (154)
    resourceReader.ts                   from derived-outputs.ts 46–69   ← the real win
  persistence/
    sqliteDerivedOutputStore.ts         from sqlite-store.ts (949)
```

This is a pure file-move plus import rewrite — no behaviour change — so
`derived-outputs.test.ts` (1,142 lines) is the regression gate, and it should stay green with
zero edits beyond its own import paths.

**Priority: low.** Nothing is broken. Do it when Derived Outputs next needs substantive work,
not as a standalone task.

### On the file-naming split (`sqlite-store.ts` vs `sqliteDocumentStore.ts`)

Flat capabilities use `kebab-case` filenames; layered ones use `camelCase`. I recommend
**not** doing a bulk rename. Renames cost real git-blame continuity and buy nothing
functional. Instead:

- New files follow the surrounding directory's convention.
- Files that move during a restructure (i.e. the Derived Outputs table above) adopt
  `camelCase`, since they are landing in layered directories.
- Directory names stay `kebab-case` everywhere — that part is already consistent.

---

## Finding 2 · Wire validation

### What I observed

Ingress validation differs sharply by capability age.

**Document and Slide** decode strictly in `4-job-wiring` → `wire/`:

- `exactKeys(record, allowed, label)` rejects **unknown** keys, not just missing ones. Each of
  the 35 Document operations has an `OPERATION_KEYS` entry, so a client typo is a 400 rather
  than a silently dropped field.
- A vocabulary of `requireIdentifier` / `requireString` / `requireText` /
  `requireNonNegativeInteger` / `requireEnum` / `requireRecord` / `requireBoolean`.
- `DOCUMENT_WIRE_LIMITS` applied before structural decoding.
- One `DocumentWireError` → 400.

**Everything else** casts. Measured across `4-job-wiring`:

| Pattern | Sites | Files |
| --- | --- | --- |
| `request.body as any` into a service | 2 | connector, general-files |
| `(request.body ?? {}) as { id: string, … }` | 10 | connector (6), general-files (4) |
| `request.body as Record<string, unknown>` + `String()` / `Number()` | 30 | context (15), structured-data (10), derived-outputs (3), … |

### Correcting an overstatement

My first pass flagged the two `as any` sites as the sharpest risk. **That was wrong**, and I
verified it: both services runtime-validate at the top of the method.

```ts
// connectorService.register
if (!request || typeof request.providerKind !== "string" || request.providerKind.length === 0)
  throw new ConnectorValidationError("providerKind must be a non-empty string");
if (typeof request.locator !== "string" || request.locator.trim().length === 0)
  throw new ConnectorValidationError("locator must be a non-empty string");
if (request.syncInterval !== undefined &&
    !Object.prototype.hasOwnProperty.call(SYNC_INTERVALS, request.syncInterval))
  throw new ConnectorValidationError(`Unsupported sync interval: …`);
```

`generalFileService.upload` does the same for `fileName` and `content`, and additionally
validates UTF-8 for text-kind files. So the `as any` sites are a **type-safety** weakness —
the compiler cannot catch drift between wire shape and domain type, and validation sits in
`3-capabilities` rather than at the `4-job-wiring` boundary — not an unvalidated path.

### The two defects that *are* real

These are in the `String()` / `Number()` coercion style, not the `as any` style.

**2a · `Number(undefined)` produces a misleading 409 instead of a 400.**

```ts
// 4-job-wiring/context/registerContextEndpoints.ts — PATCH /user/contexts/entries
const record = await ctx.update(String(body.id ?? ""), parseEntries(body.entries),
                                Number(body.expectedRevision), "user");
```

Omit `expectedRevision` and it becomes `NaN`. In `ContextManagerImpl.update`:

```ts
if (existing.revision !== expectedRevision) throw new StaleContextError(id, existing.revision, expectedRevision);
```

`NaN !== 1` is true, so a **malformed request** is reported as
`409 stale_revision … expected NaN` rather than `400 bad_request`. A client implementing
retry-on-409 would retry forever. The same shape exists in Structured Data's `rename`,
`updateDescription`, `updateBody`, `replaceSchema`, `appendRows`, `deleteRows`, and `delete`,
and in Derived Outputs' `updateDefinition`.

**2b · `String(x ?? "")` accepts structurally invalid input as a plausible string.**

```ts
// POST /user/contexts
const record = await ctx.declare(String(body.displayName ?? ""), parseEntries(body.entries), "user");
```

`ContextManagerImpl.declare` performs no `displayName` validation, so:

- `{}` creates a context whose `displayName` is `""`.
- `{ "displayName": {} }` creates one named `"[object Object]"`.

Both persist. Neither is reachable by name afterwards in any useful way.

### Recommended fix

**Three tiers, in this order.**

**Tier 1 — fix the coercion defects (small, high value).** Add a shared decode helper module
for the non-`wire/` capabilities. This is roughly 40 lines and removes both defects above
without restructuring anything:

```ts
// 4-job-wiring/shared/decode.ts  (new)
export class WireError extends Error {
  constructor(message: string) { super(message); this.name = "WireError"; }
}
export const bodyRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new WireError(`${label} must be an object`);
  return value as Record<string, unknown>;
};
export const requiredString = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.length === 0)
    throw new WireError(`${label} must be a non-empty string`);
  return value;
};
export const requiredRevision = (value: unknown, label: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new WireError(`${label} must be a non-negative integer`);
  return value as number;
};
```

Then map `WireError → 400 bad_request` in each capability's existing `errorResponse` ladder
and replace `String(body.x ?? "")` / `Number(body.x)` at the 30 call sites. Mechanical, and
each capability's existing test suite is the gate.

I deliberately propose a *shared* helper here rather than per-capability `wire/` packages,
because these capabilities' payloads are flat `{ id, displayName, expectedRevision }` shapes.
The full `wire/` treatment earns its cost on Document's recursive block tree; it would be
overhead on `POST /connector/get`.

**Tier 2 — remove the two `as any` casts.** Give `connector.register` and
`generalFiles.upload` proper decoders using the Tier 1 helpers, and move the existing
service-side validation into them. Keep the service checks as well — defence in depth is
correct here, since the services are also reachable from `1-init` (the Connector sync
scheduler calls `connectorService.sync` directly).

**Tier 3 — adopt `wire/` packages for new capabilities only.** Every capability added from
here (Comments, Workspace, Spreadsheet, …) should follow Document's `wire/` pattern from the
start. Do not retrofit Context's 21 endpoints; Tier 1 closes the actual gap there.

**Priority: medium**, and Tier 1 specifically is the highest-value item in this review.

---

## Finding 3 · `docs/backend-architecture.md` is stale

This file is linked from `docs/architecture.md` as the canonical "Backend request and Job
architecture" reference, and roughly half of it is wrong.

| Claim in the doc | Actual |
| --- | --- |
| `src/init`, `src/transport`, `src/job-wiring`, `src/capabilities` | `src/1-init`, `src/2-transport`, `src/4-job-wiring`, `src/3-capabilities` |
| Four layers | Six — `0-platform` and `0-utils` are absent from the doc entirely |
| Aliases: `#init/* #transport/* #job-wiring/* #capabilities/* #config/*` | `#config/*` **does not exist**; `#platform/*` and `#utils/*` are missing, as are all 9 module aliases (`#document`, `#formula`, …) |
| Job factory builds "an `execute` work function" | `work()` / `deferredWork()` |
| Endpoint mappings: `src/job-wiring/internal/registerInternalEndpointMappings.ts` | `src/4-job-wiring/internal/registerEndpointMappings.ts` |
| "Current capability libraries: `internal/echoCapability.ts`, `internal/auditCapability.ts`" | Those are `3-capabilities/built-in/`; there are now 9 capabilities |
| Config: 5 fields | 13 sections |

What is still accurate: the request-to-job flow, the serial/concurrent queue semantics, and
the inline/deferred response-mode description. Those sections match the code exactly.

### Recommended fix

**Rewrite it as a short pointer page rather than repairing it in place.** The accurate content
it holds is already covered more thoroughly and more currently by three other documents:

- `docs/runtime/repository-boundaries.md` — layers, placement laws, aliases
- `docs/runtime/dual-queue.md` — queues, response modes, `JobDefinition` (this one is
  **accurate**, including `work` / `deferredWork`)
- `docs/claude-notes/02-request-and-job-runtime.md` — the measured runtime behaviour

Duplicating layer/alias lists in a fourth place is what let this drift in the first place.
Suggested replacement, in full:

```markdown
# Backend Architecture

The backend is organised into numbered runtime layers under `apps/backend/src`. Placement
laws, alias conventions, and dependency rules are defined in
[Repository boundaries](runtime/repository-boundaries.md).

The request → Job → queue model, response modes, and queue capacity behaviour are defined in
[Request, Job, and dual-queue runtime](runtime/dual-queue.md).

Per-module reference documentation lives beside the code, under
`apps/backend/src/**/docs/`. Those pages are authoritative for implemented behaviour.

Backend tuning values are in `apps/backend/etc/configuration.yaml`; see
[the configuration reference](../apps/backend/etc/README.md).
```

If you would rather keep it as a standalone explainer, the minimum repair is: renumber all
four paths, add `0-platform`/`0-utils`, drop `#config/*`, add `#platform/*`/`#utils/*` and
note the module aliases, correct `execute` → `work`/`deferredWork`, fix the
`registerEndpointMappings.ts` filename, and replace the two-capability list with a pointer to
`3-capabilities/`.

**Deleting it is also a defensible choice** — `architecture.md` could link straight to
`runtime/dual-queue.md`. I'd lean toward the pointer-page version, since the filename is
already linked from elsewhere and is a reasonable landing spot.

**Priority: medium. Effort: ~20 minutes.**

---

## Finding 4 · Smaller documentation fixes

**4a · Broken link in `docs/architecture.md`.**
It links to `capabilities/README.md`; the directory was renamed to `capabilities-old/`. Its
other seven links resolve. Either repoint to `capabilities-old/README.md`, or — better, since
"old" signals it is superseded — repoint to the per-module docs:

```markdown
- Capability reference: see `apps/backend/src/3-capabilities/<name>/docs/`
  (superseded drafts remain in [capabilities-old](capabilities-old/README.md))
```

**4b · `apps/backend/etc/README.md` is incomplete.**
It documents `server`, `workerPool`, and `queue`. The YAML has thirteen sections; the ten
undocumented ones are `logging`, `intelligence`, `formula`, `structuredData`, `richText`,
`context`, `derivedOutputs`, `document`, `projectId`, `userId`.

This one matters more than it looks. `configuration.yaml` is the stated home for "all backend
tuning values and other runtime magic numbers", and `formula/limits.ts` explicitly relies on
that contract ("all values come from config, none hardcoded in the engine"). Thirteen Formula
limits and seven Document limits are currently discoverable only by reading the loader.

Recommend a table per section with field, default, and effect — the defaults are all in
`DEFAULT_CONFIG` in `loadBackendConfig.ts`, so it is transcription, not research. Also worth
documenting the one environment override: `OPENROUTER_API_KEY` applies **only** when the YAML
still holds the literal `replace-with-openrouter-api-key` placeholder, which is
non-obvious and easy to trip over.

**4c · Wrong interface sketch in `docs/runtime/repository-boundaries.md`.**

```ts
interface JobDefinition<TResponse = unknown> {
  id: string;
  queueType: "serial" | "concurrent";
  responseMode: "inline" | "deferred";
  execute(signal?: AbortSignal): Promise<TResponse>;   // ← neither execute nor AbortSignal exists
}
```

The real type in `0-utils/jobs/types.ts` is a discriminated union on `responseMode` with
`work()` / `deferredWork()`, no `AbortSignal`, and `id` assigned by the registry rather than
declared by the factory. `docs/runtime/dual-queue.md` already shows this correctly — copy its
version.

Worth noting the absence of `AbortSignal` is a genuine current limitation, not just a doc
error: there is no request-level cancellation anywhere in the runtime, and
`knowledge/embedder.ts` carries a matching comment ("AbortSignal is undefined for now — wire
it through when request-level cancellation is added"). If cancellation is still intended, the
doc is describing a target and should say so explicitly rather than presenting it as current.

**4d · The rest of `repository-boundaries.md` and `backend-map.md` need no change.** Their
layer definitions, placement laws, and revision-model table match the code exactly. Their
repository-shape listings include many unbuilt capabilities, but both pages frame themselves
as build maps, so that is correct-by-intent rather than drift.

**Priority: low. Effort: ~30 minutes for 4a and 4c; ~1 hour for 4b.**

---

## Recommended sequencing

1. **Finding 3 + 4a + 4c** — doc repairs. Cheap, and they stop the structure docs from
   actively misleading. Do these first.
2. **Finding 2, Tier 1** — the shared decode helper. Fixes two demonstrable defects; each
   capability's existing suite is the gate.
3. **Finding 4b** — configuration reference. Do it alongside any config change.
4. **Finding 2, Tier 2** — remove the two `as any` casts.
5. **Finding 1** — Derived Outputs restructure. Bundle with the next substantive change
   there; do not schedule standalone.

Nothing here blocks Slide.

## A note on CI gating

Two invariants in this review would be better enforced than documented:

- No new `as any` in `4-job-wiring` — a lint rule or a source-scanning test in the style of
  the existing `runtime-wiring.test.ts` checks (which already grep for `console.*` and assert
  on `startBackend.ts` ordering).
- Doc links resolve — a link checker over `docs/`.

Both are cheap. Neither can be gated in CI until the tree typechecks again, so they belong in
the same change that lands `slideService.ts` rather than before it.
