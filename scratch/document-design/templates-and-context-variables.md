# Document Addendum — Templates and Context Variables

> **Partly superseded (2026-08-02).** Five pieces of machinery below were cut as
> over-built: representation version 2 and its migration, the multi-entry
> `PromptContextSpec` and its resolution algorithm, `DerivedOutputs.clone`, the
> `DocumentCopyAttempt` table, and the `DocumentTemplateCopyRuntime` interface.
> See [`document-changes-design.md`](../document-changes-design.md) for what
> replaced each and why.
>
> This page remains the authority on binding semantics, the Persona comparison,
> the copy preserve/discard table, and the sealing rule.

## Intent

This addendum extends Document in two related ways:

1. A Document can be a backing resource for the project Templates catalog and
   can be copied into a new normal Document.
2. Every Document owns named Context Variables that Prompt Blocks can use
   instead of embedding use-case-specific resource references directly.

The combination makes one template reusable inside the same project. A
template may define a variable named `Main topic`; one instance can bind it to
`{ kind: "context", id: carsContextId }`, while another binds the same variable
to a Hospitals Context. Every Prompt Block that references that variable then
uses the instance's concrete binding.

Context Variables are Document authoring state. Context still owns Context
records, and Derived Outputs still owns Prompt definitions, concrete Context
scope, stabilization text, evidence, freshness, and generated revisions.

Context is project-scoped only: one table, no user scope, and no
project-then-user fallback. A `(kind, id)` binding therefore resolves to the
same entries for every instantiation in the project, and neither Templates nor
Document needs a scope-selection argument anywhere in this design. Document
never creates, mutates, or deletes a Context record; it only references one.

## Main decisions

- A backing Document uses the Template ID as its Document ID and carries an
  immutable template-mode flag.
- Templates and normal Documents use the same Document editor, reducer,
  operations, history, and load endpoint.
- Template-mode Documents are omitted from the normal Document list and are
  discovered through Templates.
- Copying starts a new Document at revision `0`; source history, receipts,
  attempts, outbox rows, and Activity transactions are not copied.
- Document-internal IDs may be preserved because their address is always
  scoped by Document ID. Dedicated Derived Output IDs are never preserved or
  shared.
- Context Variables have stable IDs and mutable, unique names. Prompt Blocks
  reference variable IDs, while template-instantiation input binds them by
  user-facing name.
- Derived Outputs receive only resolved concrete `ContextEntry[]`; they do not
  learn about Document variables.
- A variable binds exactly one `ContextEntry`. Grouping several resources is
  Context's job, not Document's, and is now a single call to
  `POST /contexts/union`.
- Registration and instantiation apply the **same** binding override rule:
  absent key inherits, present key with `target` sets, present key without
  `target` explicitly unbinds. Registration records defaults; instantiation
  overrides them. Nothing is cleared automatically.
- Bindings are optional at both steps. Unbound variables are legal state on any
  Document; only Prompt work that needs a concrete scope is refused.
- A resolved Prompt context is never allowed to be empty, because an empty
  entry array is whole-project retrieval in Knowledge rather than an empty
  scope.

## Representation version 2

Context Variables and Prompt context sources are canonical authored state, so
this is a real representation change rather than an operational side table.
New Documents use representation version 2.

```ts
interface DocumentSnapshotV2 {
  readonly representationVersion: 2;
  readonly revision: number;
  readonly title: string;
  readonly lifecycle: DocumentLifecycle;
  readonly pageLayout: DocumentPageLayout;
  readonly styles: DocumentStyleRegistry;
  readonly contextVariables: DocumentContextVariable[];
  readonly rows: DocumentRow[];
}

interface DocumentContextVariable {
  /** Stable within the Document and preserved across a template copy. */
  readonly id: string;

  /** Trimmed, case-insensitively unique user-facing name. */
  readonly name: string;

  /** Omitted when a template deliberately leaves the variable unbound. */
  readonly target?: ContextEntry;
}
```

The stable ID lets a variable be renamed without rewriting every Prompt Block.
The name supplies the authoring and template-instantiation interface the user
works with. `Main topic` and `main topic` cannot coexist in one Document.

**An unbound variable is valid canonical state in any Document, template-mode
or not.** It is not equivalent to an empty Context scope, and it never falls
back to whole-project retrieval.

This is a deliberate relaxation of an earlier draft, which allowed unbound
variables only in template mode and required a normal Document to have every
referenced variable bound. Two things forced the change:

- a registration may deliberately leave variables unbound, by naming them with
  no `target`, so that the template is a pure function of its arguments; and
- instantiation bindings are optional, so an instance may legitimately be
  created with variables its author intends to fill in afterwards.

Making unbound state illegal on a normal Document would have made both of those
impossible, in service of an error that is better caught elsewhere. So the
constraint moves off document validity and onto **Prompt work admission**: a
Prompt Block may sit with an unresolved variable indefinitely, but any operation
that must produce a concrete Context scope from it — prompt creation, refresh,
or definition synchronization — is refused with `unbound_context_variable`
while it stays that way. The Block keeps showing its last applied revision, and
its existing Derived Output definition is left untouched.

This puts unbound variables under exactly the same rule as the empty-scope case
below: both are structural states that are legal to hold and illegal to
*resolve*.

Context Variables are intentionally limited to one `ContextEntry` target:

```ts
interface ContextEntry {
  readonly id: string;
  readonly kind: string;
}
```

The target can be a Context (`kind: "context"`) or another directly usable
resource. A Context remains the normal way to group several resources, and
`POST /contexts/union` / `POST /contexts/difference` now persist a caller-named
Context and return its ID, so composing a grouping target is one call before
instantiation rather than a multi-step setup.

A binding is therefore always a reference. The rejected alternative was to let
a binding supply inline `entries` that Document would compose into a private
Context during instantiation. That would give Document a Context *write*
dependency, add `ContextConflictError` to the instantiation failure surface,
and leave private records behind that Context neither reference-counts nor
cleans up. Composition stays in Context, where it is already modelled.

`ContextRecord` also carries `private` and `description`. Neither belongs to
this design: `private` is a listing-visibility flag that `resolve` ignores, so
a variable may freely target a private Context, and `description` is mutable
Context-owned metadata that Document must read live rather than copy.

The Document validates the pair structurally but does not duplicate the target
or own its lifecycle. In particular it never checks target *liveness* — see
[Target liveness and the empty-scope rule](#target-liveness-and-the-empty-scope-rule).

### Why this differs from Persona

Persona reaches the opposite conclusion — it *does* create a Context record, a
private wrapper named deterministically from its own immutable persona ID. The
two designs are consistent because the deciding question is lifecycle
ownership, not whether writing Context is allowed:

- Persona needs one **stable, mutable handle** for a scope that lives as long
  as the persona does, and it owns that record symmetrically: persona create →
  `declare`, update → `update`, delete → `delete`. A deterministic name from a
  UUID makes it collision-proof, and nothing else is expected to reference it.
- A Document context variable binds a target the **user already chose and
  already owns**. Instantiation is a one-shot copy with no continuing
  relationship, so a per-variable wrapper would create records with no
  symmetric owner, no natural delete trigger, and a name Document would have to
  invent. Persona's accepted orphan gap — a successful Context write followed
  by a failed owner write — would also be multiplied by every variable in every
  instantiation rather than bounded to one record per persona.

So Persona writes Context because it owns a scope; Document does not, because
it only points at one.

The Document validates the pair structurally but does not duplicate the target
or own its lifecycle. In particular it never checks target *liveness* — see
below.

## Prompt context sources

A Prompt Block must remember the authored sources from which its concrete
Derived Output context is produced:

```ts
interface PromptContextSpec {
  /** Literal resource/context references authored directly on this Block. */
  readonly entries: ContextEntry[];

  /** Stable IDs from DocumentSnapshot.contextVariables. */
  readonly variableIds: string[];
}

interface PromptBlock extends BlockBase {
  readonly kind: "prompt";
  readonly output: DerivedOutputRef;
  readonly context: PromptContextSpec;
}
```

Resolution is deterministic:

1. Start with `context.entries` in authored order.
2. Resolve `context.variableIds` in authored order against the current
   Document snapshot.
3. Fail with `unbound_context_variable` if any referenced variable is missing
   or unbound when concrete resolution is required.
4. Append each variable target.
5. Deduplicate by `kind:id`, preserving first appearance.
6. Fail with `empty_context_scope` if the deduplicated result is empty.

The result is the exact `contextEntries` sent to Derived Outputs. Direct
entries preserve the current non-template use case. A template can use only
variables when every instance is expected to supply its own resources.

### Target liveness and the empty-scope rule

Step 6 exists because an empty array is not an empty scope. `Knowledge.resolveScope`
treats a zero-length entry array as *every indexed source in the project*:

```ts
const resolved = inputEntries.length === 0
  ? (await this.store.listSources()).map((source) => ({ id: source.sourceId, kind: "document" }))
  : /* resolve through Context */;
```

So a Prompt whose authored scope silently collapses to nothing would not fail —
it would quietly widen to whole-project retrieval. Document must never hand
Derived Outputs an empty `contextEntries`.

This matters more than it would have before, because Context resolution is
lossy by design. `ContextManager.resolve` silently omits nested contexts that
are missing or past `maxResolveDepth`, and `ContextStore.get(id)` does **not**
filter `deleted_at`, so an ID path can still observe a tombstoned record.
Context's own invariants state both. A variable target therefore has three
states, not two:

| State | Meaning | Document's position |
|---|---|---|
| Bound and live | Target resolves to at least one leaf | Normal operation |
| Unbound | No `target` recorded on the variable | `unbound_context_variable`; legal canonical state in template mode only |
| Bound but dangling | `target` recorded, but the referenced Context is deleted or resolves to nothing | Structurally valid; caught downstream by the empty-scope rule |

Document deliberately does **not** validate target liveness. Doing so would
require injecting a Context runtime into Document purely to ask whether an ID
is live, which contradicts this design's boundary and would still race — a
Context can be deleted one millisecond after the check. Instead:

- `context-variable.create` / `context-variable.update` / `prompt.set-context`
  validate the `(kind, id)` pair **structurally only**, exactly as today.
- Liveness is enforced where it is actually load-bearing: at the point a
  concrete scope is produced for Derived Outputs. A resolution that yields zero
  entries is rejected rather than forwarded.

The practical consequence is that a dangling binding is authored and stored
without complaint, and surfaces as a failed Prompt create/refresh/sync with
`empty_context_scope` rather than as a silently over-broad answer. That is the
intended trade: fail visibly and late rather than validate expensively,
incompletely, and early.

Because a deleted Context is still readable through Context's ID path, a
binding to a soft-deleted Context keeps resolving to its last entries. That is
Context's documented current behaviour, not something Document compensates for.
If Context later tightens `get(id)` to hide tombstones, such a binding will
begin resolving to nothing and will then be caught by the same empty-scope
rule — no change is needed here.

Prompt Blocks store variable IDs, not names. Renaming `Main topic` therefore
changes presentation only. Rebinding it changes the effective Context scope of
every Prompt Block that references that ID.

## Derived Outputs boundary

Derived Outputs remains authoritative for the Prompt definition:

```text
Prompt Block
  context.entries + context.variableIds
          |
          +-- Document resolves current variable targets
          v
  concrete ContextEntry[]
          |
          +-- DerivedOutput.definition.contextEntries
```

Document must keep the authored context sources and the Derived Output's
concrete context aligned. It does this through its injected Derived Outputs
runtime, never by writing the Derived Outputs database.

### Prompt creation

`prompt.create.request` changes from raw `contextEntries` to a context spec:

```ts
{
  type: "prompt.create.request";
  documentId: string;
  expectedRevision: number;
  blockId: string;
  styleId: string;
  placement: BlockPlacement;
  prompt: string;
  context: PromptContextSpec;
  stabilisationText: string;
}
```

The serial freeze stage validates the variable IDs and resolves them against
the frozen snapshot. The Prompt-create attempt stores both the authored
`PromptContextSpec` and the resolved `ContextEntry[]`. The concurrent stage
declares the dedicated Derived Output with the resolved entries. Settlement
inserts the Prompt Block with the authored context spec and the new exact
output reference.

Prompt creation requires concrete bindings in both modes and fails before a
Derived Output is declared if a variable is unbound. A template author who
wants a placeholder first creates the Prompt with a temporary/default binding
and may then unbind it in template mode.

### Updating a Prompt definition

`prompt.update-definition` continues to update Prompt text and stabilization
text through Derived Outputs, but no longer accepts caller-supplied concrete
context entries. Document loads the Prompt Block, resolves its current context
spec, and sends that concrete result alongside the new prompt and
stabilization text.

Changing which entries or variables a Prompt Block uses is a canonical
Document operation (`prompt.set-context`) so it participates in revision
history, semantic rebase, undo, redo, and template copying.

### Rebinding a variable

Rebinding is a Document mutation followed by durable synchronization:

```text
serial admission
  -> commit the new variable target in the Document ChangeSet
  -> write one prompt-context-sync attempt for each affected live Prompt Block
  -> commit
  -> dispatch sync Jobs

concurrent sync
  -> reload the intended Document revision and Prompt Block
  -> resolve its complete PromptContextSpec
  -> read the latest Derived Output definition
  -> update only contextEntries under an expected definition revision
  -> mark the attempt complete or stale
```

The synchronizer carries forward the latest Prompt text and stabilization text
when replacing context entries; it must not overwrite an unrelated definition
edit. A definition-revision conflict is retried by re-reading the current
definition. A newer Document context change makes the older attempt stale and
the newer mutation's attempt becomes authoritative.

Updating the Derived Output definition makes it stale under the existing
freshness contract. The Prompt Block continues to show its previously applied
immutable revision until its normal refresh flow produces and adopts a new
revision. Rebinding does not silently trigger model work.

## Document operations

Representation version 2 adds these reversible canonical operations:

```ts
type DocumentOperationV2 =
  | DocumentOperationV1
  | { type: "context-variable.create"; variable: DocumentContextVariable }
  | {
      type: "context-variable.update";
      variableId: string;
      variable: DocumentContextVariable;
    }
  | { type: "context-variable.delete"; variableId: string }
  | {
      type: "prompt.set-context";
      blockId: string;
      context: PromptContextSpec;
    };
```

`context-variable.update` replaces the complete variable and requires the same
ID. A name-only update does not schedule Derived Output work. A target change
schedules every dependent Prompt Block.

Deleting a variable that any live Prompt Block references is rejected. The
caller must first change those Prompt context specs. This avoids a cascading
operation with hidden cross-capability effects.

`prompt.set-context` always rejects **missing** variables — an ID with no
corresponding entry in the snapshot is a structural error in either mode. It
accepts **unbound** ones in either mode; the Block records a blocked
synchronization state and does not replace the Derived Output's previous
concrete scope. Once every referenced variable is bound, it schedules one
synchronization attempt for the affected Prompt Block after the Document
ChangeSet commits.

Unbinding a referenced variable is likewise allowed in either mode. An unbound
variable never blocks editing; only Prompt work that needs a concrete scope is
refused until the variable is rebound. (Template mode blocks editing through
Document's public surface for an unrelated reason — see
[Template-mode Documents](#template-mode-documents) — but the adapter's internal
path is unaffected by either rule.)

Compensating any target-changing operation runs the same dependency detection
and schedules synchronization for the restored context. Undo and redo never
write Derived Outputs directly inside the Document transaction.

Touched-ID calculation includes the variable ID and every Prompt Block whose
effective context changes. The semantic digest includes the complete variable
array and every Prompt context spec.

## Template-mode Documents

Template mode is immutable resource metadata, not editable Document content:

```ts
interface DocumentHead {
  // existing fields
  readonly isTemplate: boolean;
}
```

It does not live in `DocumentSnapshot` because a Document never transitions
between modes and mode does not vary by historical revision.

- Public `document.create` always creates `isTemplate: false`.
- Only the trusted Templates adapter can create `isTemplate: true`.
- `document.list` returns normal Documents only.
- **Registration seals the backing Document.** Once `isTemplate` is true,
  Document's entire public surface is refused for it — every `DocumentCommand`
  *and* every `DocumentQuery` naming it, so `document.load`, `document.history`,
  and `document.attempt` are closed alongside `document.submit`,
  `document.set-lifecycle`, `document.delete`, `document.compensate`, and every
  Prompt and Formula command. One typed error (`DocumentTemplateModeError` →
  409) names Templates as the way in.
- The check is on the Document, not enumerated per command, so a command or
  query added later is sealed by default rather than by someone remembering.
- **`document.listTemplates` is the one exception.** It lists heads for
  `isTemplate` rows. The line is listing versus reading: listing is a
  cross-Document question over Document's own storage that returns identifying
  metadata, while reading *a* template returns content and belongs to Templates.
- Reading a backing Document's content is `template.load`, which reaches it
  through the Templates adapter. Editing it is `template.update`, likewise. The
  adapter uses Document's **internal** command path, which is not the public
  surface and is therefore not refused.
- Nothing renames a backing Document, from either side. Document cannot — it is
  sealed. Templates does not offer it: `template.update` renames the
  `TemplateRecord`, and the Document's title stays as copied. That title is what
  an instance inherits when instantiation supplies none.

A backing Document is not a Document a user owns any more. It exists so
instantiation has something to copy.

For a backing Document, `DocumentHead.id === TemplateRecord.resourceId ===
TemplateRecord.id`.

## Document copy runtime and Templates adapter

Document exposes a narrow trusted copy runtime to startup wiring; neither its
domain nor its ordinary public commands import Templates:

The instantiation input is **not** a Document-private argument blob. It is the
shared, kind-agnostic `TemplateInstantiationInput` owned by Templates, because
the thing an instantiation varies — Context Variable bindings — is resource-level
structure rather than a Document peculiarity:

```ts
/** Owned by Templates; reproduced here for reference. */
interface TemplateContextBinding {
  /** Omitted means "explicitly unbound", not "leave alone". */
  readonly target?: ContextEntry;

  /** Declaration only; never copied into the instantiated Document. */
  readonly description?: string;
}

/** User-facing variable name -> binding. Normalised to {} when absent. */
type TemplateContextBindings = Readonly<Record<string, TemplateContextBinding>>;

interface TemplateInstantiationInput {
  /** Omitted means the instance keeps the backing template's title. */
  readonly title?: string;

  readonly contextBindings: TemplateContextBindings;
}

interface DocumentTemplateCopyRuntime {
  createTemplateCopy(input: {
    sourceDocumentId: string;
    templateId: string;
    contextBindings: TemplateContextBindings;
    idempotencyKey: string;
  }): Promise<DocumentHead>;

  instantiateTemplate(input: {
    templateId: string;
    destinationDocumentId: string;
    instantiation: TemplateInstantiationInput;
    idempotencyKey: string;
  }): Promise<DocumentHead>;

  /** Content edits for a sealed backing Document; the internal command path. */
  updateTemplateCopy(input: {
    templateId: string;
    operations: DocumentOperation[];
    contextBindings?: TemplateContextBindings;
    idempotencyKey: string;
  }): Promise<DocumentHead>;

  /** Reads a sealed backing Document. The one method that returns content. */
  readTemplateCopy(input: { templateId: string }): Promise<DocumentSnapshot>;

  logicalDeleteTemplateCopy(input: {
    templateId: string;
    idempotencyKey: string;
  }): Promise<void>;

  purgeTemplateCopy(input: {
    templateId: string;
    idempotencyKey: string;
  }): Promise<void>;
}
```

Six methods, matching `TemplateResourceAdapter` as it now ships. Four of them
did not exist when this section was first written: the delete split into logical
and purge with the revision/history model, and update/read arrived with the
sealing rule — once Document refuses its own public surface for a backing copy,
Templates needs a way through for both editing and reading.

The Templates port types `operations` and the read result as `unknown`, because
Templates has no per-kind types. Document's own runtime is concretely typed;
the integration adapter in `1-init` is where the two meet, and it is the only
place that imports both contracts.

Startup wraps this runtime in the structurally matching
`TemplateResourceAdapter` owned by Templates. That integration adapter is the
only place that imports both contracts.

Bindings are decoded strictly at the Templates wire boundary. The copy runtime
then matches binding names case-insensitively against the frozen source
snapshot. Unknown names, duplicate normalized names, and malformed targets
reject the copy.

Both copy directions apply one rule, so there is a single implementation used
twice:

| Binding for a variable | Effect on the destination |
|---|---|
| Not a key in the record | Keeps whatever the source held |
| Key present with `target` | that target becomes the destination's |
| Key present, `target` omitted | Destination variable is unbound |

At registration the source is the original Document and the destination is the
backing template, so the result is the template's defaults. At instantiation
the source is the template and the destination is the instance, so the result
overrides those defaults. Nothing is cleared implicitly in either direction.

`description` is template documentation. It is carried on the binding record
for whoever reads the template, and is **not** written into the destination
Document's variable state.

**A missing binding is not an error.** Bindings may be omitted, empty, or
partial; an unnamed variable stays as the source left it. The destination is
created either way, and any variable can be bound later through the ordinary
`context-variable.update` operation.

Instantiation therefore performs **no** whole-Document scope pre-check. An
earlier draft resolved every copied Prompt Block's context before committing
and rejected the instantiation if any resolved to zero entries. That is
incompatible with optional bindings: the common case — instantiate now, bind
afterwards — would fail at creation. Both the unbound-variable and empty-scope
rules are enforced where they belong, at Prompt work admission on the created
instance.

Each binding is exactly one `ContextEntry`; the runtime does not accept inline
entry arrays and does not compose Contexts. A caller who needs a grouped target
creates it first through `POST /contexts/union` and passes the returned ID.

Context records and other targets are referenced, not copied.

## Copy semantics

Both registration and instantiation copy one frozen source revision into a new
revision-zero Base. They do not replay source ChangeSets.

| State | Copy rule |
|---|---|
| Page layout, styles, Rows, Blocks, lists, tables, Rich Content | Copy the frozen snapshot. |
| Destination Document ID | Use the supplied Template ID or normal resource ID. |
| Title | Registration copies the source title; instantiation uses the supplied title, or the template's title when none is given. |
| Context Variables | Copy IDs and names always. Apply the supplied bindings by name under the override rule above — set, explicitly unbind, or inherit. Identical at registration and instantiation. |
| Row/Block/style/list/table/atom/mark IDs | Preserve; these identities are scoped by the new Document ID. |
| Formula atoms and last accepted results | Copy as authored snapshot state. |
| Media and ordinary resource references | Preserve as references; do not duplicate targets. |
| Prompt Derived Outputs | Deep-copy to new dedicated output IDs and rewrite every Prompt Block reference. |
| Source revision/history/receipts/attempts/stage receipts | Do not copy. Destination starts at revision 0. |
| Identity ledger | Rebuild from the copied snapshot as active revision-zero claims. |
| Prompt-output ownership | Create fresh attached rows for the copied output IDs. |
| Activity outbox | Write only the destination's new `document.created` fact. |
| Comments, Activity history, Presence | Do not copy. |

Preserving internal IDs is safe because every externally meaningful address is
`(documentId, internalId)`. It also makes a copy deterministic and exact.
Derived Output IDs are the exception because each live Prompt Block must own a
different output.

### Required Derived Outputs clone contract

The current Document design deliberately deferred Prompt-bearing duplication.
Templates requires one additive Derived Outputs operation:

```ts
interface CloneDerivedOutputRequest {
  readonly sourceOutputId: string;
  readonly sourceAppliedRevision: number;
}

interface DocumentDerivedOutputs {
  // existing methods
  clone(
    request: CloneDerivedOutputRequest,
    options: { idempotencyKey: string },
  ): Promise<DerivedOutput>;
}
```

Clone creates a new output identity with the frozen source definition. If the
source applied revision exists, the new output receives one independent
revision containing that exact content/evidence/status and uses revision `1`
as its applied copy. It does not copy the source output's entire revision
history. Exact retry returns the same cloned output.

When a copy produces a **resolvable** effective Context that differs from the
source's, Document immediately performs a keyed definition update on the clone.
Its copied revision remains available as stabilization/history, while freshness
becomes stale. A later normal refresh generates content grounded in the new
binding.

When the copy leaves a Prompt Block's context **unresolvable** — because a
binding explicitly unbound a variable, or because the source was already
unbound and nothing supplied one — Document performs no definition update. The
clone keeps the source's concrete definition untouched, and the Block is simply
blocked from refresh under the admission rule above until a target is supplied.
The previous definition is inert, not authoritative, and never becomes the
destination's effective scope without an explicit binding.

No two source or destination Prompt Blocks share an output ID.

## Durable copy flow

Document owns a durable copy attempt because copying Prompt Outputs crosses
the Document and Derived Outputs databases:

```ts
interface DocumentCopyAttempt {
  readonly id: string;                 // adapter idempotency key
  readonly mode: "template" | "instance";
  readonly sourceDocumentId: string;
  readonly sourceRevision: number;
  readonly destinationDocumentId: string;
  readonly requestDigest: string;
  readonly state: "requested" | "copying" | "ready" | "failed";
  readonly promptOutputMap: Readonly<Record<string, string>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

The adapter performs:

1. Freeze the source head revision and load that exact snapshot.
2. Validate source mode: registration requires a normal Document;
   instantiation requires a template-mode Document.
3. Freeze and validate all referenced Prompt definitions. Registration requires
   the *source* to have synchronized concrete Prompt contexts, so a template is
   never cut from an already-broken Document. Neither mode requires the
   *destination* to be fully resolvable — that is the whole point of a
   template.
4. Persist the copy attempt and destination inputs.
5. Clone each dedicated output with a key derived from the attempt and source
   Block ID, recording the returned mapping.
6. Rewrite Prompt references and apply the supplied bindings under the override
   rule — the same code path for both modes. Update only those cloned
   definitions whose effective Context both changed and remains resolvable.
7. Atomically create the destination head, revision-zero Base, identity
   ledger, Prompt ownership rows, command receipt, and creation Activity
   outbox fact.
8. Mark the attempt ready and return the destination head.

A crash resumes from the stored attempt and keyed Derived Output clone calls.
It cannot produce another destination or another output for the same Block.
Cloned outputs left by a permanently failed attempt are detached and become
eligible for the existing reachability-aware cleanup path.

The copy is taken from the frozen Document revision. Edits accepted on the
source after the freeze belong only to later copies.

## Persistence changes

The Document store adds:

```sql
ALTER TABLE documents
  ADD COLUMN is_template INTEGER NOT NULL DEFAULT 0
  CHECK (is_template IN (0, 1));

CREATE INDEX document_heads_mode_lifecycle_updated
  ON documents(is_template, lifecycle, updated_at DESC, id);
```

Context Variables and Prompt context specs live in canonical Base/ChangeSet
JSON. There is no separate mutable variables table that could drift from
historical snapshots.

The existing attempts/stage schema gains `prompt-context-sync` plus the copy
attempt storage described above. No foreign key crosses into Templates,
Context, or Derived Outputs.

### Version 1 migration

Version 1 Bases remain decodable for historical loads. Current version 1 heads
are upgraded by materializing a version 2 Base:

- `contextVariables` begins empty;
- every existing Prompt Block receives
  `{ entries: output.definition.contextEntries, variableIds: [] }`, read from
  its dedicated Derived Output; and
- non-Prompt content is unchanged.

If an existing Prompt output is missing, migration records a diagnostic and
does not invent an empty scope, because empty would mean unrestricted project
retrieval. The Block migrates with `{ entries: [], variableIds: [] }`.

A version 1 Prompt may also have been declared with a genuinely empty
`contextEntries`, which today means whole-project retrieval. The empty-scope
rule makes that unrepresentable going forward, so migration must not silently
re-admit it. Such a Prompt migrates the same way and carries the same
diagnostic. Migration never rewrites it into a whole-project entry set, because
that would bake an implicit behaviour into canonical state.

In neither case does migration restrict the Document itself — the Block is
simply in the ordinary unresolvable state, and is refused Prompt work under the
same admission rule as an unbound variable until a scope is authored. Migration
introduces no separate blocked-Document concept. (Whether the Document is
reachable at all is a separate question, answered by template mode.)

## Queries and projections

`document.load` returns the version 2 snapshot and a head that includes
`isTemplate` — for normal Documents. Against a template-mode Document it is
refused, like every other public command and query (see
[Template-mode Documents](#template-mode-documents)); Templates serves that read
through `template.load`.

`document.list` is unchanged at the wire level but filters `isTemplate = 0` in
the store. A new `document.listTemplates` query returns heads for the rows it
excludes, so a caller can still discover which Document templates exist without
being able to read one.

The dependency projection adds:

- each Context Variable target;
- each Prompt Block's direct entries; and
- each Prompt Block's variable IDs and resolved targets.

This keeps broken/missing bindings inspectable without asking Derived Outputs
to reverse-engineer the authored variable relationship.

## Activity

Creating a backing Document publishes an ordinary `document.created`
transaction with safe metadata indicating template mode. Editing it — which now
only happens through `template.update` and the adapter's internal path — still
publishes normal Document changes against the Template ID, because the change to
Document's canonical state is the same one either way. Templates separately
publishes its own `template.updated` transaction for the catalog change.
Creating an instance publishes one ordinary `document.created` transaction for
the new real resource.

Context-variable operations use their exact operation names in the Document
transaction's `operationTypes`. Derived Output definition synchronization is a
consequence of the accepted Document change and does not create a duplicate
Document Activity transaction.

## Invariants

1. `isTemplate` is immutable for the life of a Document.
2. A template-mode Document is absent from the ordinary Document list and is
   unreachable through Document's public surface by exact ID — commands and
   queries alike. It is reachable only through Templates, via the adapter's
   internal path. `document.listTemplates` is the sole exception, and it lists
   rather than reads.
3. A Prompt Block references only variable IDs present in the same snapshot.
4. Context Variable names are non-empty and unique under trim plus
   case-insensitive comparison.
5. No Prompt Block ever resolves to whole-project Context. An unbound variable
   fails as `unbound_context_variable`, and a resolution that deduplicates to
   zero entries fails as `empty_context_scope`. Document never sends an empty
   `contextEntries` array to Derived Outputs.
6. Both failures in invariant 5 are **admission checks on Prompt work**, not
   validity checks on a Document. An unresolvable Prompt Block is legal stored
   state in either mode; it is refused only prompt creation, refresh, and
   definition synchronization, and keeps showing its last applied revision
   meanwhile.
7. Registration and instantiation apply one binding override rule: an absent
   key inherits the source's target, a key with `target` sets it, and a key
   without `target` unbinds it. Nothing is cleared implicitly, and a binding's
   `description` is never written into destination Document state.
8. Concrete Derived Output context is the deduplicated resolution of the
   Prompt Block's current context spec.
9. Every copied Prompt Block owns a newly cloned Derived Output ID.
10. A destination begins at revision 0 with no copied history, receipts,
    attempts, comments, or Activity history.
11. Context and other resource targets are referenced, not copied. Document
    never creates, mutates, or deletes a Context record, and never copies a
    Context's `displayName`, `description`, or `private` flag into Document
    state.
12. Exact adapter retries return the same destination and output mapping.
13. A backing template cannot be read, edited, renamed, or deleted through
    Document's public surface at all — not only deletion. Every such path is
    Templates'.
14. Variable targets are validated structurally only. Target liveness is never
    checked at authoring time; it is enforced where a concrete scope is
    produced, by invariants 5 and 6.

## Deferred

- cross-project variable remapping and copying referenced Context records;
- inline `entries` bindings that Document would compose into a private Context
  during instantiation, and any other Context write from Document;
- authoring-time validation that a variable target is live, and any
  reference-counting or cleanup of Contexts reachable only from a template;
- typed variables for non-Context purposes or Formula interpolation;
- variables used by non-Prompt Blocks;
- automatic model refresh during template instantiation;
- propagating later template edits into existing Documents;
- copying full Derived Output revision history; and
- template-specific page layout, export, or pagination behavior.

## Implementation order

Expanded into a step-by-step plan with files, tests, and sequencing rationale in
[`document-implementation-plan.md`](../document-implementation-plan.md), which
also folds in the Document work tracked outside this addendum. The summary:

1. Add representation version 2, Context Variable and Prompt context models,
   validation, canonicalization, reducer operations, inverses, and migration.
2. Update Prompt creation/definition/refresh to resolve context specs and add
   durable Prompt-context synchronization.
3. Add immutable `isTemplate` head persistence, ordinary-list filtering, the
   public-surface refusal for template-mode Documents (`DocumentTemplateModeError`
   on every command and query naming one), and `document.listTemplates`.
4. Add keyed Derived Outputs clone support and Document copy attempts.
5. Implement the Document copy runtime and its startup-owned Templates adapter
   for registration, instantiation, deletion, content edits
   (`updateTemplateCopy`), and reads (`readTemplateCopy`) — the last two being
   how `template.update` and `template.load` reach a sealed Document.
6. Wire the adapter into Templates and add tests covering bound/unbound
   variables, duplicate names, multi-Prompt synchronization, deep output
   copies, exact retry, history isolation, and same-project instantiation.
