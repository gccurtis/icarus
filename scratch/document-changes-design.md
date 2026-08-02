# Document changes — design

What we are changing in the Document capability, why, and in what order.

## Goal

Two things, and the second is the reason for the first:

1. **A Prompt Block's context can be swapped per instance.** Today a Prompt
   Block's grounding is baked into its Derived Output definition. To reuse one
   Document as a template, that grounding has to become a *parameter*.
2. **A Document can back a Templates catalog entry.** Templates is built and
   green but has no adapter, so nothing can actually be registered as a
   template.

Everything below serves those two. Anything that does not is out of scope.

## What changed from the previous design

The earlier addendum
([`document-design/templates-and-context-variables.md`](document-design/templates-and-context-variables.md))
accreted five pieces of machinery that are not needed. Each is removed here,
with the reason:

| Previous design | Now | Why |
|---|---|---|
| `representationVersion: 2` + a v1→v2 migration + decodable v1 history | **Dropped.** Change the shape in place; delete `data/documents.db` | Backend data is disposable and the schema is in flux — that is *why* there is no shared database or migration runner. A version number buys compatibility nobody needs |
| `PromptContextSpec { entries[], variableIds[] }` with a 6-step resolution algorithm | **One context target per Prompt Block** | A list can only ever union. A single already-composed Context can express exclusions too, because Context has `union` *and* `difference` |
| `DerivedOutputs.clone(...)` — a new capability method | **`declare(...)` with an idempotency key** — already exists | Clone existed to carry the source's generated answer into the copy. A template's answer is regenerated per instance anyway, so there is nothing worth carrying |
| `DocumentCopyAttempt` — a new table, states, and a resume path | **Dropped.** Reuse the Templates command claim + `declare`'s idempotency key | Both mechanisms already exist and already make a retry safe. A third one would restate them |
| `DocumentTemplateCopyRuntime` — a new exported interface | **Methods on `DocumentCapability`, adapter written in `1-init`** | This is exactly what `createDocumentActivityPublisher` already does. A named interface adds a type, not a boundary |

Net effect: no representation versioning, no migration, no new Derived Outputs
method, no new table, no new interface. The remaining work is five ordinary
changes.

---

## The four questions, answered

### What is a representation version?

`DocumentSnapshot.representationVersion: 1` is a literal stamped on every
snapshot and Base. Its only purpose is to let code read *old* rows written under
an older shape — you branch on it and decode accordingly.

It is machinery for a system that must not lose data. This one deletes its
database when a schema changes. **So the field is currently paying for nothing**,
and bumping it to 2 would have bought a migration path for rows we are happy to
throw away.

Removed from the plan. The snapshot shape changes in place and existing local
data is deleted.

> **Open question 1.** Should `representationVersion` be *removed from the
> model* as well, or left at `1` as a placeholder? Leaving it costs one field
> and keeps the hook if versioning is ever wanted; removing it deletes ~10
> validation and mapper references. My recommendation: **leave it at `1`** and
> stop treating it as a versioning scheme. It is cheap, and it is one of the few
> honest markers of "this shape is not forever".

### Why did Derived Outputs need `clone`, and what were the attempts?

The real constraint is a Document invariant:

> One live Prompt Block owns one dedicated output; a Derived Output cannot be
> shared by multiple live Prompt Blocks in one snapshot.

So when you copy a Document containing a Prompt Block, the copy's Block **cannot
point at the same output**. Something has to produce a second one. That is the
entire requirement.

`clone` was a way to produce that second output *carrying the source's generated
answer* — one revision with the same content, evidence, and status. That is the
part that was over-built. A template's answer will be regenerated against each
instance's own context; preserving the source's answer means shipping every
instance a stale answer grounded in the wrong sources.

**`declare` already does what is actually needed**, and already takes an
idempotency key:

```ts
declare(
  { prompt, contextEntries?, stabilisationText? },
  { idempotencyKey }
): Promise<DerivedOutput>
```

Copy calls `declare` once per Prompt Block with the copied prompt text and the
*destination's* context. The new output starts with no revisions — correct, and
visibly unrefreshed rather than misleadingly populated.

**The copy attempts** were a durability record: a copy writes to two databases
(`documents.db` and `derived-outputs.db`) with no shared transaction, so a crash
between them could leave orphaned outputs or a half-built Document. The attempt
row let a retry resume.

That problem is real. The proposed solution restated two mechanisms we already
have:

- Templates already holds a **command claim** per `requestId` that freezes the
  destination ID before any adapter call, and passes a deterministic
  `idempotencyKey` into the adapter.
- `declare` is already **idempotent under a key** — the same key returns the
  same output.

So a retry re-declares (getting the same outputs back) and re-attempts one
atomic `commitCreation`. If the Document already exists, return its head. No new
table, no new states. A permanently failed copy leaks declared outputs, which
the existing detached-output cleanup path already handles.

### Why a "copy runtime", and do we need it?

We do not. You were right that it is the wrong shape, though the direction is
worth stating precisely, because "the template is passed to the document"
and "the document is passed to the template" are both slightly off.

**Neither capability imports the other.** Templates declares an inbound port —
`TemplateResourceAdapter`, in `templates/ports/` — describing what it needs from
*any* resource kind. Document knows nothing about it. `1-init` writes a small
object that satisfies the port by calling Document, and registers it with
Templates.

`DocumentTemplateCopyRuntime` was a second interface describing the same methods
from Document's side. It adds a name, not a boundary. Document just gets the
methods on `DocumentCapability`, and `1-init` adapts.

This is not a new pattern — it is what already happens for Activity:

```ts
// 1-init/create/document.ts, today
export const createDocumentActivityPublisher = (activity) => ({
  publish: async (transaction) => { await activity.publish(toActivityTransaction(transaction)); }
});
```

Same shape, opposite direction.

### What does "wiring in the adapter" actually mean?

Three concrete things, all in `1-init`:

```ts
// 1. an object satisfying a port Templates owns, built from Document's methods
const documentTemplateAdapter: TemplateResourceAdapter = {
  kind: "document",
  createTemplateCopy: (input) => document.createTemplateCopy(input),
  instantiateTemplate: (input) => document.instantiateTemplate(input),
  updateTemplateCopy:  (input) => document.updateTemplateCopy(input),
  readTemplateCopy:    (input) => document.readTemplateCopy(input),
  logicalDeleteTemplateCopy: (input) => document.logicalDeleteTemplateCopy(input),
  purgeTemplateCopy:   (input) => document.purgeTemplateCopy(input)
};

// 2. register it — the registry is built empty today and never populated
templateAdapters.register(documentTemplateAdapter);

// 3. ordering: Document must be constructed before this line
```

That is the whole of "wiring". The registry already exists
(`createTemplateAdapterRegistry`), Templates already resolves through it, and
`startBackend.ts` already constructs it empty with a comment saying so.

---

## The five changes

### 1 · Context Variables on the snapshot

A named, stable handle a Prompt Block can point at instead of a literal context.
This is what makes a template parameterisable.

```ts
interface DocumentContextVariable {
  id: string;              // stable; survives renames and copies
  name: string;            // trimmed, case-insensitively unique in the Document
  target?: ContextEntry;   // omitted = deliberately unbound
}

interface DocumentSnapshot {
  // …existing fields…
  contextVariables: DocumentContextVariable[];
}
```

The ID/name split is what lets a rename be cosmetic: Prompt Blocks reference
IDs, users and template bindings work in names.

**Unbound is legal canonical state.** A template deliberately declares variables
with no target, and an instance may be created before its author binds anything.
The refusal lives at Prompt work admission, not on document validity.

Three operations: `context-variable.create`, `.update` (whole variable, same
ID), `.delete` (rejected while any live Prompt Block references it — the caller
re-points those Blocks first, rather than this cascading across capabilities).

### 2 · A Prompt Block takes exactly one context

```ts
type PromptContext =
  | { kind: "direct";   target: ContextEntry }
  | { kind: "variable"; variableId: string };

interface PromptBlock extends BlockBase {
  kind: "prompt";
  output: DerivedOutputRef;
  context: PromptContext;      // replaces the old contextEntries[]
}
```

One target, not a list, and the reasoning is worth keeping: **a list can only
union.** There is no way to say "these sources except those" in an array of
entries. A Context can say it — `POST /contexts/difference` persists a named
Context and returns its ID — so a Prompt Block that points at *one* Context
inherits every composition Context can express, now and later.

The caller composes first and points second. `POST /contexts/union` and
`/contexts/difference` already exist and already return a context ID.

This deletes more than it looks like:

- the 6-step resolution algorithm (ordering, appending, dedup by `kind:id`);
- the **empty-scope rule** entirely. `Knowledge.resolveScope` treats a
  zero-length *input* array as whole-project retrieval, which is why the old
  design needed a rule forbidding a scope that collapsed to nothing. With
  exactly one entry the input is never empty, so the hazard is gone
  structurally rather than by a guard;
- `prompt.update-definition`'s caller-supplied entries — it resolves the Block's
  own context instead.

One rule survives: resolving a `variable` context whose variable is unbound is
refused (`unbound_context_variable`) at prompt create, refresh, and sync. The
Block keeps showing its last applied revision.

A fourth operation, `prompt.set-context`, changes which context a Block uses, so
it participates in history, rebase, undo, and copying.

**Rebinding a variable** commits the new target, then writes one durable sync
attempt per affected live Prompt Block, which updates only `contextEntries` on
the Derived Output definition under an expected definition revision. Rebinding
makes the output stale; it never silently triggers model work.

### 3 · `isTemplate` and sealing

```ts
interface DocumentHead {
  // …existing fields…
  readonly isTemplate: boolean;   // immutable for the life of the Document
}
```

On the head, not the snapshot: a Document never changes mode, and mode does not
vary by revision.

**Registration seals the backing Document.** Every `DocumentCommand` *and* every
`DocumentQuery` naming an `isTemplate` document is refused with one typed error
(`DocumentTemplateModeError` → 409). `document.list` excludes them.
`document.listTemplates` is the single exception — it lists, it does not read.

Implement the check **once, on the document, not per command**, so a command
added later is sealed by default. That is the whole value of the rule.

Reading a backing copy is `template.load`; editing it is `template.update`. Both
reach it through the adapter, which uses Document's internal path.

### 4 · Copy

Both directions do the same thing: take one frozen source revision, produce a
new Document at revision 0.

```text
1. load the source snapshot at its current head revision
2. check source mode (register: normal; instantiate: template)
3. apply the bindings to the copied contextVariables, by name:
     absent key          -> keep the source's target
     key with target     -> that target
     key without target  -> unbound
4. for each Prompt Block: declare a new Derived Output with the copied prompt
   text and the destination's resolved context, keyed
   `${idempotencyKey}:${blockId}`; rewrite the Block's output reference
5. one atomic commit: head, revision-0 Base, identity ledger, ownership rows,
   receipt, and the document.created transaction
```

Preserved: row/block/style/list/table/atom/mark IDs, variable IDs and names,
formula atoms, media and resource references. Internal IDs are safe because
every meaningful address is `(documentId, internalId)`, and preserving them
makes a copy exact.

Not copied: source history, receipts, attempts, stage receipts, outbox rows.
The destination starts at revision 0.

Retry safety comes from step 4's key and step 5's atomicity — nothing else.

> **Open question 2.** What context does a copied Prompt Block's output get when
> the destination's variable is *unbound*? `declare` needs concrete entries, and
> omitting them means whole-project retrieval. Three options:
>
> - **(a)** declare with the *source's* entries. The definition is inert —
>   refresh is refused while unbound — but it records a context the destination
>   never authorised.
> - **(b)** make `PromptBlock.output` optional and declare lazily at first
>   refresh. Cleanest semantically, but `output` being required is load-bearing
>   in the reducer, ownership rows, and projections.
> - **(c)** refuse to copy a Document whose Prompt Blocks would land unbound.
>   Simplest, but it defeats "declare a variable with no default", which is the
>   main way to write a template.
>
> I lean **(a)** for now and **(b)** if it turns out to be cheap. This needs
> your call before step 4 is built.

### 5 · The adapter

Six methods on `DocumentCapability`, one object literal in `1-init`, one
`register` call in `startBackend.ts`. Described in full under *What does
"wiring in the adapter" actually mean?* above.

---

## Dependency chain

```text
1 Context Variables ─┬─> 2 Prompt context ─┬─> 4 Copy ──> 5 Adapter
                     │                     │
                     └─────────────────────┘
3 isTemplate + sealing ──────────────────> 4
```

- **1 before 2**, because a `variable` context references a variable.
- **1 and 2 before 4**, because copying applies bindings to variables and
  re-declares outputs from resolved contexts.
- **3 before 4**, because the copy is what sets `isTemplate: true`, and the seal
  must exist before anything can be sealed.
- **4 before 5**, because the adapter is a thin call-through with nothing to
  call otherwise.

**3 is independent of 1 and 2** and can land first. It is small, and it is the
half Templates is currently missing — until it exists, `template.update` is the
only *intended* path to a backing copy rather than the only possible one.

Each of 1, 2, and 3 leaves the tree green on its own. **4 and 5 do not** — a
copy path with no adapter is untested surface, so they land together.

## What this does not change

Stated so the scope is legible:

- No new SQLite table. `isTemplate` is one column; variables and Prompt contexts
  live in canonical Base/ChangeSet JSON, so no side table can drift from
  history.
- No new Derived Outputs capability method.
- No new exported interface in Document.
- No changes to Rich Text, Formula, Knowledge, or Context.
- Derived Outputs still receives only concrete `ContextEntry[]` and never learns
  what a Document variable is.
- Document still never writes Context, and never checks whether a target is
  live. A dangling binding is stored without complaint.

## Open questions

1. **Keep `representationVersion: 1` or remove the field?** Recommend keeping.
2. **What context does a copied Prompt Block get when its variable is unbound?**
   Recommend (a), carry the source's entries as an inert definition. Needs a
   decision before change 4.
3. **What may `template.update`'s `resourceOperations` contain?** Typed
   `unknown` at the Templates boundary. Full `DocumentOperation[]`, or a
   restricted set? Prompt and Formula operations through a template edit are the
   questionable ones. Needed before change 5.
4. **Should `template.instantiate` allocate `destinationResourceId` rather than
   accept it?** The house rule says creation allocates. Free to change while
   `TemplateResourceAdapter` has zero implementations; breaking immediately
   after. Needed before change 5.

## Status of related documents

- [`document-design/templates-and-context-variables.md`](document-design/templates-and-context-variables.md)
  — **superseded on the five points in the differentials table.** Still the
  authority on binding semantics, the Persona comparison, and the copy
  preserve/discard table.
- `document-implementation-plan.md` — **deleted.** It was written against the
  pre-simplification design; its useful content is here.
