# Document changes — design

What we are changing in Document (and, as a consequence, in Templates and
Context), why, and in what order. This replaces the old
`document-design/templates-and-context-variables.md`, which has been deleted.

## Goal

Two things, the second being the reason for the first:

1. **A Prompt Block's grounding can be swapped per instance.** Today it is baked
   into the Derived Output definition. To reuse a Document as a template, that
   grounding has to become a parameter.
2. **A Document can back a Templates catalog entry.** Templates ships green but
   has no adapter, so nothing can be registered as a template today.

---

## The two rules that drive everything below

Both came out of review, and between them they delete more machinery than they
add.

### Rule 1 — no command claims, no freezing

Idempotency is: **check a receipt, do the work with a deterministic key, record
the receipt.** Nothing is reserved or frozen ahead of an external call.

Document already works this way. `prompt.update-definition` is the worked
example, and its comment states the whole contract:

```ts
// Derived Outputs is idempotent on this key alone, so a retry after a
// crash between this call and recordSubmission below simply replays the
// already-completed result rather than reapplying the definition twice.
const output = await this.deps.derivedOutputs.updateDefinition(block.output.outputId, {…}, {
  idempotencyKey: `document:prompt-definition:${canonicalDigest({ documentId, requestId })}`
});
await this.store.recordSubmission({ documentId, requestId, requestDigest, result, createdAt });
```

The `delegated_command_claims` table that used to pre-freeze the target output is
gone from the schema. What it bought was: a retry could never re-target after
the Prompt Block was re-pointed. What it cost was a table, a state machine, and a
`assertDelegatedRequestReuse` check on every command. The receipt-plus-key
approach gives up the re-target guarantee and gets everything else back.

### Rule 2 — the capability that stores a thing allocates its ID

Document allocates Document IDs. Templates allocates Template IDs. Always, and
including when one asks the other to create something.

`document.create` already works this way. Templates does not: it allocates a
`templateId` and uses it as the backing resource's ID too, enforced by
`CHECK (resource_id = id)`.

---

## What I got wrong, and what it changes

I proposed building the copy path on Templates' command claim, describing it as
an existing mechanism to reuse. It **is** in the current code — `command_claims`,
`claimCommand`, `bindClaimTemplateId` — so the description was accurate, but
leaning on it was the wrong call: it is the same mechanism deliberately removed
from Document, and it is slated for removal here too.

Removing it is not a small edit. It cascades, and every piece of the cascade is a
deletion:

| Templates has today | After | Why it can go |
|---|---|---|
| `command_claims` table, `claimCommand`, `completeClaim` | A `command_receipts` table keyed by `requestId`, holding the result | Same shape as Document's receipts. Replay on retry; no pre-claim |
| `bindClaimTemplateId` — freezing the allocated ID before the adapter call | **Nothing** | The ID only needs freezing because the catalog row is written *before* the external call. Write it after and there is nothing to freeze |
| `TemplateRecordState = "reserving" \| "ready"` | **Nothing** | The two-phase state exists only to hold a durable reservation across the adapter call |
| `deleteReservation`, `markReady` | A single insert after the adapter returns | No reservation to release or promote |
| `CHECK (resource_id = id)` | `resourceId` is whatever Document allocated | Rule 2 |

`template.register` becomes:

```text
1. receipt lookup on requestId          -> replay if present
2. resolve the adapter for source.kind  -> unsupported_kind
3. name conflict check                  -> name_conflict
4. adapter.createTemplateCopy({ sourceResourceId, contextBindings, idempotencyKey })
                                        -> returns the Document ID it allocated
5. insert the catalog row (one write, already ready)
6. record the receipt
```

**The honest cost.** A crash between 4 and 5 leaves a backing Document that no
catalog row references. A retry re-calls step 4, Document replays the same
document from its create receipt, and step 5 completes. If the caller never
retries, the orphan stays.

That is a leak — but the old design leaked too, just on the other side: a
`reserving` catalog row pointing at a backing copy that may or may not exist.
The new leak lives in Document, is the same class as a detached Derived Output,
and is reachable by the same kind of cleanup sweep. I would rather have one leak
with no state machine than one leak with one.

---

## Change 0 · Allow `appliedRevision: 0`

Small, independent, and a prerequisite for `duplicate`. Can land first.

`domain/validation.ts:196` currently reads:

```ts
if (!block.output.outputId || !isPositiveInteger(block.output.appliedRevision)) {
```

`isPositiveInteger` becomes a non-negative check. `0` means **declared, never
answered** — the output exists with a prompt and a context, and nothing has run
the model against it yet.

Without this, a duplicated Prompt Block is unrepresentable: its new output comes
from `declare`, which returns `headRevision: 0`, so the block would have to
reference revision 0 and the whole snapshot would fail validation.

**Touches:** `domain/validation.ts`, and the `appliedRevision` consumers in
`application/documentService.ts` (settle comparisons, `frozenAppliedRevision`
checks) plus any projection that renders an applied revision. Each needs to
treat `0` as *pending* rather than as a revision to look up.

## Change 1 · Remove `representationVersion`

Delete the field. Not bump it — remove it.

It exists so code can decode rows written under an older shape. We delete the
database when the shape changes, so it is a versioning scheme for versions that
never coexist. Every branch on it is dead weight.

**Touches:** `domain/model.ts` (`DocumentSnapshot`, `DocumentBase`),
`domain/validation.ts`, `application/createService.ts`,
`persistence/sqliteMappers.ts`, and the tests asserting it. Delete
`data/documents.db`.

---

## Change 2 · Context Variables

A named, stable handle a Prompt Block points at instead of a literal context.
This is what makes a template parameterisable.

```ts
interface DocumentContextVariable {
  id: string;              // stable; survives renames and copies
  name: string;            // trimmed, case-insensitively unique in the Document
  target?: ContextEntry;   // omitted = unbound
}

interface DocumentSnapshot {
  // …existing fields…
  contextVariables: DocumentContextVariable[];
}
```

The ID/name split makes a rename cosmetic: Prompt Blocks reference IDs, while
users and template bindings work in names.

Operations: `context-variable.create`, `.update` (whole variable, same ID),
`.delete` (rejected while a live Prompt Block references it — the caller
re-points those Blocks first, rather than this cascading across capabilities).

---

## Change 3 · A Prompt Block takes exactly one context

```ts
type PromptContext =
  | { kind: "direct";   target: ContextEntry }
  | { kind: "variable"; variableId: string };

interface PromptBlock extends BlockBase {
  kind: "prompt";
  output: DerivedOutputRef;
  context: PromptContext;      // replaces contextEntries[]; required
}
```

**One target, not a list, because a list can only union.** There is no way to
say "these sources except those" in an array of entries. A Context can say it,
so a Prompt Block that points at one Context inherits every composition Context
can express — now and as Context grows. The caller composes first and points
second.

**A Prompt Block always has a context.** This preserves the current rule rather
than relaxing it, and it means the old `empty_context_scope` guard is unnecessary
rather than merely removed: with exactly one required target, a scope can never
collapse to the zero-length array that `Knowledge.resolveScope` reads as
whole-project retrieval.

Resolution is now trivial — there is no algorithm:

- `direct` → that entry;
- `variable` → the variable's target.

### Unbound variables exist only in template mode

An unbound variable is legal on a **template-mode** Document — that is what
declaring a parameter with no default means. It is not legal on a normal one,
and the rule that keeps it that way is:

> **Instantiation must supply a binding for every variable the template
> declares.** A missing binding is a rejected instantiation, not a document with
> a hole in it.

That is stricter than the earlier draft, which allowed partial bindings and then
needed a fallback for what an unbound variable resolves to. Requiring complete
bindings removes the question entirely: no instance ever holds an unbound
variable, so no Prompt Block on a normal Document is ever unresolvable, and
`unbound_context_variable` is not an error class that can occur outside template
mode.

Defaulting an unbound variable to the whole project was the alternative, and it
was worse in the direction that matters: it grounds a prompt on everything
*silently*, which is a wrong answer rather than a refused one.

The genuinely project-wide scope is still wanted, but as a thing a caller
*chooses* — a `{ kind: "project" }` Context target — not as what you get by
forgetting to bind something. That is
[general-updates item 15](0-general-updates.md#15--live-project-scoped-context).

`prompt.set-context` is the operation that changes it, so the change
participates in history, rebase, undo, and copying. `prompt.update-definition`
stops accepting caller-supplied entries and resolves the Block's own context.

**Rebinding a variable** commits the new target, then writes one durable sync
attempt per affected live Prompt Block, which updates only `contextEntries` on
the Derived Output definition under an expected definition revision. Rebinding
makes the output stale; it never silently triggers model work.

> **Consequence worth confirming.** An unbound variable now grounds a Prompt on
> the whole project rather than refusing to run. That is consistent — "no
> context" means the same thing everywhere — but it is silent where the previous
> design was loud. The alternative is to keep an explicit unbound variable
> distinct from an omitted context and refuse it. I have written it the silent
> way per your call; say if you want the distinction back.

---

## Change 4 · `isTemplate` and sealing

```ts
interface DocumentHead {
  // …existing fields…
  readonly isTemplate: boolean;   // immutable for the life of the Document
}
```

On the head, not the snapshot: mode never changes and does not vary by revision.

**Registration seals the backing Document.** Every `DocumentCommand` *and* every
`DocumentQuery` naming an `isTemplate` document is refused with one typed error
(`DocumentTemplateModeError` → 409). `document.list` excludes them.
`document.listTemplates` is the single exception — it lists, it does not read.

Implement the check **once, on the document, not per command**, so a command
added later is sealed by default. That is the entire value of the rule.

Reading a backing copy is `template.load`; editing it is `template.update`.
Both go through the adapter, which uses Document's internal path.

---

## Change 5 · Copy

Both directions do the same thing: take one frozen source revision, produce a
new Document at revision 0. **Document allocates the new ID and returns it.**

```text
1. load the source snapshot at its current head revision
2. check source mode (register: normal; instantiate: template)
3. apply bindings to the copied contextVariables, by name:
     absent key          -> keep the source's target
     key with target     -> that target
     key without target  -> unbound
4. per Prompt Block: declare a new Derived Output and rewrite the Block's ref
5. one atomic commit: head, revision-0 Base, identity ledger, ownership rows,
   create receipt, and the document.created transaction
```

### Why a copy needs new Derived Outputs at all

Because of an existing Document invariant:

> One live Prompt Block owns one dedicated output; a Derived Output cannot be
> shared by multiple live Prompt Blocks in one snapshot.

So the copy's Prompt Block cannot point at the source's output. Something must
produce a second one. That part is not optional.

### `declare`, plus one validation change

`declare` already exists and already takes an idempotency key. It is exactly
what `computePromptCreation` uses today:

```ts
const output = await derivedOutputs.declare({
  prompt, contextEntries, stabilisationText
}, { idempotencyKey: `document:prompt-create:${attempt.id}` });
```

Step 4 is the same call, once per Prompt Block, keyed
`${idempotencyKey}:${blockId}`, with the destination's resolved context.

**But a fresh `declare` alone is not sufficient, and this is the thing the
walkthrough turned up.** `domain/validation.ts:196` requires:

```ts
if (!block.output.outputId || !isPositiveInteger(block.output.appliedRevision)) {
  diagnostics.push(`Prompt Block ${block.id} has an invalid Derived Output reference`);
}
```

`declare` returns an output with `headRevision: 0` — nothing has been generated
yet — so `appliedRevision` would have to be `0`, and a snapshot containing that
Block **fails validation**. Today the only way to get a valid Prompt Block is
the create flow's `declare` → `refresh` → settle, and it deliberately *fails* the
attempt if the first refresh publishes nothing.

So **this, not answer-preservation, is why the earlier design reached for
`clone`**: cloning produced an output already carrying one revision, which
satisfied the constraint. My earlier justification for dropping it — "a
template's answer is regenerated anyway" — was right about the value and wrong
about the reason it existed.

Three ways out:

| Option | Cost |
|---|---|
| **(a) Allow `appliedRevision: 0`** meaning *declared, never answered* | One validation change plus every consumer of `appliedRevision` (6 sites in `documentService`, projections). Makes "a template whose prompts have never run" representable — which is what a template *is* |
| **(b) Refresh every copied output during the copy** | A model call per Prompt Block per copy. Slow, expensive, and wasted: the instance rebinds and re-refreshes anyway |
| **(c) Add `clone`** | A new Derived Outputs method, and every template ships a stale answer grounded in the source's context |

**Recommend (a).** It is the only one that treats "not yet answered" as a
legitimate state rather than working around the fact that it currently isn't.
It also makes the copy a pure snapshot-plus-declare with no model calls and no
new capability surface.

Under (a) the new output starts with no revisions and the copied Block reads as
pending until something refreshes it.

### Why there is no copy attempt table

The retry story is entirely covered by two mechanisms that already exist:

- `declare` is idempotent under its key, so re-running step 4 returns the same
  outputs rather than minting more;
- Document's **create receipt** is keyed by request ID, so re-running step 5
  replays the same document.

A `DocumentCopyAttempt` table with `requested | copying | ready | failed` would
restate both. Skipped.

### Preserved and discarded

| State | Rule |
|---|---|
| Page layout, styles, Rows, Blocks, lists, tables, Rich Content | Copy the frozen snapshot |
| Row/Block/style/list/table/atom/mark IDs | Preserve — every meaningful address is `(documentId, internalId)`, so preserving makes a copy exact |
| Context Variable IDs and names | Preserve; apply bindings to targets |
| Formula atoms and last accepted results | Copy as authored snapshot state |
| Media and resource references | Preserve as references; never duplicate targets |
| Prompt Derived Outputs | **New** output per Block; rewrite every reference |
| Title | Registration copies it; instantiation uses the supplied title, else the template's |
| History, receipts, attempts, stage receipts, outbox rows | Not copied. Destination starts at revision 0 |
| Identity ledger | Rebuilt from the copied snapshot as revision-0 claims |
| Comments, Activity history, Presence | Not copied |

---

## Change 6 · Satisfying the Templates resource port

> **Reworked 2026-08-02.** Templates now receives Document's **runtime object**
> and drives it, rather than receiving a hand-written adapter. Document exposes
> a small set of methods; `DocumentCapability` satisfies
> `TemplatableResource` **structurally**, with no wrapper object in `1-init`.
> Migration: [`templates-rework-plan.md`](templates-rework-plan.md).
>
> What Document must expose:
>
> | Method | Does |
> |---|---|
> | `duplicate` | **Pure copy.** New ID, same content, new Derived Outputs with the same prompts, Context Variables copied exactly. No template awareness, no bindings |
> | `markAsTemplate` | Sets `isTemplate`; the Document goes private |
> | `submit` | Pass-through edits, including applying bindings |
> | `load` | Pass-through read |
> | `logicalDelete` / `purge` | Removal |
>
> Three consequences for the rest of this document:
>
> - **`document.listTemplates` is removed.** `template.list` is the only
>   template listing in the system, and it grows kind and search filters.
> - **Bindings are not applied during duplication.** `duplicate` is pure; the
>   binding application in change 5's step 3 becomes a `submit` after the copy.
> - **`isTemplate` is set by a separate `markAsTemplate` call**, not at creation.
>   It remains one-way: nothing un-marks a Document.

### The superseded adapter form

Six methods on `DocumentCapability`; one object literal in `1-init`; one
`register` call in `startBackend.ts`. **Neither capability imports the other** —
Templates declares the port, Document has the methods, `1-init` is the only
place that sees both. Exactly what `createDocumentActivityPublisher` already
does for Activity.

```ts
const documentTemplateAdapter: TemplateResourceAdapter = {
  kind: "document",
  createTemplateCopy: (input) => document.createTemplateCopy(input),   // returns the new ID
  instantiateTemplate: (input) => document.instantiateTemplate(input), // returns the new ID
  updateTemplateCopy: (input) => document.updateTemplateCopy(input),
  readTemplateCopy: (input) => document.readTemplateCopy(input),
  logicalDeleteTemplateCopy: (input) => document.logicalDeleteTemplateCopy(input),
  purgeTemplateCopy: (input) => document.purgeTemplateCopy(input)
};
templateAdapters.register(documentTemplateAdapter);
```

`updateTemplateCopy` accepts a **full `DocumentOperation[]`** — text, blocks,
headings, layout, styles, everything content-related. A template is fully
editable through it. The one thing it does not carry is a rename: the Document's
title is not addressable, and `template.update` renames the catalog record
instead.

---

## Walkthrough — turning a Document into a template

One HTTP call, traced end to end. Assume `doc-abc` exists with two Context
Variables (`Main topic`, `Region`) and one Prompt Block.

### The request

```http
POST /templates/command          # serial queue
{
  "requestId": "req-1",
  "origin": "user",
  "command": {
    "type": "template.register",
    "source": { "kind": "document", "resourceId": "doc-abc" },
    "name": "Quarterly report",
    "contextBindings": {
      "Main topic": {},                                          // declared, no default
      "Region": { "target": { "id": "ctx-1", "kind": "context" } } // default supplied
    }
  }
}
```

### In Templates

```text
1. decode strictly at the wire boundary
2. receipt lookup on "req-1"                    -> none, continue
                                                   (a replay returns here)
3. adapters.get("document")                     -> the Document adapter
                                                   else unsupported_kind, no writes
4. nameTaken("document", "Quarterly report")    -> false
                                                   else name_conflict, no writes
5. templateId = randomUUID()                    -> "tpl-xyz"
                                                   Templates' OWN catalog identity
6. adapter.createTemplateCopy({
     sourceResourceId: "doc-abc",
     contextBindings,
     idempotencyKey: "templates:register:req-1"
   })                                           -> returns "doc-def"
```

Note what is *not* here: no claim, no reservation, no `reserving` row, and
`templateId` is not passed to Document. Templates names its catalog entry;
Document names the document.

### In Document — `createTemplateCopy`

```text
a. getCreateSubmission("templates:register:req-1")
     present -> return the head recorded last time. This is the whole retry
                story; the adapter key IS the create-receipt key
b. load head + snapshot for "doc-abc" at its current revision
c. reject if source.isTemplate                  -> cannot template a template
d. newDocumentId = randomUUID()                 -> "doc-def"
                                                   Document names its own row
e. copy the snapshot; apply bindings to contextVariables BY NAME:
     "Main topic" present, no target  -> unbound   (a declared parameter)
     "Region"     present, has target -> ctx-1     (a default)
     any variable not named           -> keep the source's target
     any binding name not in the doc  -> reject the whole copy
f. per Prompt Block:
     resolve its context against the copied variables
     declare({ prompt, contextEntries: [resolved], stabilisationText },
             { idempotencyKey: "templates:register:req-1:<blockId>" })
     rewrite block.output = { outputId: <new>, appliedRevision: 0 }
     ^ this is the appliedRevision decision — see change 5
g. one atomic commit:
     head { id: "doc-def", isTemplate: true, revision: 0 }
     revision-0 Base holding the copied snapshot
     identity ledger rebuilt from that snapshot
     prompt_outputs ownership rows for the new outputs
     create receipt keyed "templates:register:req-1"
     document.created transaction in the outbox
h. return the head
```

Step (f) is where a Prompt Block whose variable is unbound lands. On a
**template** that is expected — `Main topic` has no target, so its Block cannot
resolve, and under the current constraint it also cannot be declared with a
concrete context. This is the same knot as `appliedRevision`, and (a) unties
both: declare with whatever the source resolved to, leave `appliedRevision: 0`,
and let the instance's binding drive the first real refresh.

### Back in Templates

```text
7. insert the catalog row — one write, already usable:
     { id: "tpl-xyz", kind: "document", resourceId: "doc-def",
       name: "Quarterly report", contextBindings, revision: 1 }
8. record the receipt for "req-1" holding this result
9. append the template.registered transaction to the outbox
```

`id` and `resourceId` differ, deliberately. The catalog row is Templates'; the
document is Document's; each named its own.

### What a crash costs, at each point

| Crash after | Effect of a retry |
|---|---|
| step 5 | Nothing was written. Retry allocates a new `templateId` and proceeds |
| step 6, before Document commits | Document's create receipt is absent; the copy runs again cleanly. Any `declare` calls already made return the same outputs on their keys |
| step 6, after Document commits | Document replays the same head from its create receipt. No second document, no second output |
| step 7 | The catalog row exists; the receipt does not. Retry re-calls the adapter, gets the same document back, and hits a name conflict — see below |

That last row is the one sharp edge. The fix is to make step 7 and step 8 a
single SQLite transaction, which they can be — both are Templates-local writes.
Then either both happened (replay returns the result) or neither did (the retry
re-runs 6–8 cleanly, with 6 replaying).

### Instantiating it later

Same shape, mirrored:

```text
POST /templates/command  { type: "template.instantiate", templateId: "tpl-xyz",
                           title?, contextBindings: { "Main topic": {...}, "Region": {...} } }

Templates: receipt -> adapter -> record receipt
Document:  load "doc-def" (template mode), copy, apply bindings, allocate
           "doc-ghi", declare outputs, commit at revision 0, isTemplate: false
           -> returns "doc-ghi"
Templates: returns { template, resource: { kind: "document", resourceId: "doc-ghi" } }
```

No `destinationResourceId` on the wire — Document allocates it. And every
declared variable must be bound here, or the instantiation is rejected.

## Consequent changes outside Document

### Templates

Driven by rules 1 and 2, all deletions except the last two:

- claims → receipts (see the table above);
- `reserving` state, `markReady`, `deleteReservation` removed;
- `CHECK (resource_id = id)` removed; `resourceId` is Document's allocated ID;
- `template.instantiate` **drops `destinationResourceId`** — Document allocates
  it — and `template.instantiated` returns the created resource ref;
- `TemplateResourceAdapter.createTemplateCopy` / `instantiateTemplate` **return
  the allocated ID** instead of `void`. This is why the return type mattered:
  free now, breaking the moment a second adapter exists.

### Context — live project scope

Needed for "the whole project, less these five resources", staying correct as
the project changes. Today `composeNamed(difference)` materialises a static set
at compose time, so it goes stale immediately.

A context record has to be able to hold a **rule**, not just a set:

```ts
interface ContextRecord {
  // …existing fields…
  entries: ContextEntry[];      // may include { kind: "project" }
  excludes?: ContextEntry[];    // new
}
```

- whole project → `entries: [{ kind: "project", id: "*" }]`
- whole project less five → the same, plus `excludes: [ …five… ]`
- three sources less one → `entries: [ …three… ], excludes: [ …one… ]`

`resolve()` expands `entries` (recursing into contexts, expanding `project` to
every current source), then subtracts the expanded `excludes`. Live by
construction, because both sides are evaluated at read time.

This also gives Knowledge's implicit "empty array means whole project" rule an
explicit spelling, and that rule could eventually be retired in favour of the
sentinel.

> This is a Context capability change with its own blast radius — store, wire,
> `resolve`, and every consumer of `entries`. It needs its own sign-off before I
> touch it, and it is a prerequisite for exclusions being expressible at all.

---

## Order

```text
1 remove representationVersion   ← independent, trivial
2 Context Variables ────┬──> 3 Prompt context ──┬──> 5 Copy ──> 6 Adapter
                        │                       │
4 isTemplate + sealing ─┴───────────────────────┘

Templates claim removal ────────────────────────────> 5
Context live project scope ─────────────────────────> 3 (for exclusions)
```

- **2 before 3** — a `variable` context references a variable.
- **2, 3, 4 before 5** — copying applies bindings and re-declares outputs, and
  the copy is what sets `isTemplate`.
- **5 before 6** — the adapter is a call-through with nothing to call otherwise.
- **Templates claim removal before 5** — otherwise the copy path is built
  against a mechanism being deleted. This is the sequencing mistake I nearly
  made.
- **Context live scope is only needed for exclusions.** Changes 2–6 work without
  it; a template just cannot express "everything except" until it lands.

1, 2, 3, 4, and the Templates claim removal each leave the tree green alone.
**5 and 6 do not** — a copy path with no adapter is untested surface, so they
land together.

## What none of this changes

- No new SQLite table anywhere. `isTemplate` is one column; variables and Prompt
  contexts live in Base/ChangeSet JSON, so no side table can drift from history.
- No new Derived Outputs method.
- No new exported interface in Document.
- Derived Outputs still receives only concrete `ContextEntry[]` and never learns
  what a Document variable is.
- Document still never writes Context, and never checks whether a target is
  live. A dangling binding is stored without complaint and surfaces when it
  resolves to nothing.

## Settled

**`template.update` carries a full `DocumentOperation[]`.** A template is fully
editable — text, blocks, headings, layout, styles. `prompt.create.request` and
`formula.evaluate.request` are in that union and start async attempts, so a
template edit can kick off model work. Accepted rather than restricted.

**`appliedRevision: 0` is allowed.** Decided 2026-08-02. `domain/validation.ts:196`
relaxes from `isPositiveInteger` to a non-negative check, and `0` means
*declared, never answered*. A template whose prompts have never run is a normal
state and the model can now say so. This is change 0 below, and it is a
prerequisite for `duplicate`.

## Nothing open

Every question is settled. Ordering and progress live in
[`templates-rework-plan.md`](templates-rework-plan.md) → Checklist, Phase B.
Two items remain deferred and tracked in
[`0-general-updates.md`](0-general-updates.md): live project-scoped Context
(item 15) and orphan garbage collection (item 16).

Tracked separately in [`0-general-updates.md`](0-general-updates.md):
**item 15** (live project-scoped Context, needed for exclusions), **item 16**
(garbage collection for orphaned backing Documents and Derived Outputs), and
**item 17** (removing command claims from Templates).
