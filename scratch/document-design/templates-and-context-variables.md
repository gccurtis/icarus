# Document Addendum — Templates and Context Variables

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

An unbound variable is valid canonical state in a template. It is not
equivalent to an empty Context scope. A template-mode Prompt Block may retain
an unresolved variable while it is being authored, but its existing Derived
Output definition is left untouched and refresh is blocked until the variable
is bound. A normal Document may not retain a referenced unbound variable. In
neither mode may an unbound variable fall back to whole-project retrieval.

Context Variables are intentionally limited to one `ContextEntry` target:

```ts
interface ContextEntry {
  readonly id: string;
  readonly kind: string;
}
```

The target can be a Context (`kind: "context"`) or another directly usable
resource. A Context remains the normal way to group several resources. The
Document validates the pair structurally but does not duplicate the target or
own its lifecycle.

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

The result is the exact `contextEntries` sent to Derived Outputs. Direct
entries preserve the current non-template use case. A template can use only
variables when every instance is expected to supply its own resources.

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

`prompt.set-context` always rejects missing variables. A normal Document also
rejects unbound variables. A template-mode Document may retain them; in that
case it records a blocked synchronization state and does not replace the
Derived Output's previous concrete scope. Once every referenced variable is
bound, it schedules one synchronization attempt for the affected Prompt Block
after the Document ChangeSet commits.

Likewise, unbinding a referenced variable is allowed only in template mode.
The template remains editable, but Prompt refresh is rejected until the
placeholder is rebound or an instantiation supplies an override.

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
- `document.load`, history, editing, Prompt operations, and projections work
  for either mode when addressed by ID.
- An ordinary Document lifecycle/delete operation cannot remove a
  template-mode Document. Deletion is routed through Templates so the catalog
  and backing resource cannot diverge.

For a backing Document, `DocumentHead.id === TemplateRecord.resourceId ===
TemplateRecord.id`.

## Document copy runtime and Templates adapter

Document exposes a narrow trusted copy runtime to startup wiring; neither its
domain nor its ordinary public commands import Templates:

```ts
interface DocumentTemplateArguments {
  /** Required title for the new normal Document. */
  readonly title: string;

  /** User-facing variable name -> project resource/context reference. */
  readonly contextBindings?: Readonly<Record<string, ContextEntry>>;
}

interface DocumentTemplateCopyRuntime {
  createTemplateCopy(input: {
    sourceDocumentId: string;
    templateId: string;
    idempotencyKey: string;
  }): Promise<DocumentHead>;

  instantiateTemplate(input: {
    templateId: string;
    destinationDocumentId: string;
    arguments: DocumentTemplateArguments;
    idempotencyKey: string;
  }): Promise<DocumentHead>;

  deleteTemplateCopy(input: {
    templateId: string;
    idempotencyKey: string;
  }): Promise<void>;
}
```

Startup wraps this runtime in the structurally matching
`TemplateResourceAdapter` owned by Templates. That integration adapter is the
only place that imports both contracts.

The Document copy runtime strictly decodes `DocumentTemplateArguments`.
Binding names are matched case-insensitively against the frozen template
snapshot. Unknown names, duplicate normalized names, malformed targets, or a
missing binding for any referenced unbound variable reject instantiation.

Bindings override template defaults. Variables not named in
`contextBindings` retain the backing template's current target. Context
records and other targets are referenced, not copied.

## Copy semantics

Both registration and instantiation copy one frozen source revision into a new
revision-zero Base. They do not replay source ChangeSets.

| State | Copy rule |
|---|---|
| Page layout, styles, Rows, Blocks, lists, tables, Rich Content | Copy the frozen snapshot. |
| Destination Document ID | Use the supplied Template ID or normal resource ID. |
| Title | Registration copies the source title; instantiation uses the required destination title. |
| Context Variables | Copy IDs/names/default targets; apply instance binding overrides before commit. |
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

When instance bindings change the effective Context, Document immediately
performs a keyed definition update on the clone. Its copied revision remains
available as stabilization/history, while freshness becomes stale. A later
normal refresh generates content grounded in the instance binding.

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
3. Freeze and validate all referenced Prompt definitions. Registration
   requires synchronized concrete Prompt contexts. Instantiation may accept an
   intentionally unresolved template context only when the supplied bindings
   resolve every variable used by that Prompt.
4. Persist the copy attempt and destination inputs.
5. Clone each dedicated output with a key derived from the attempt and source
   Block ID, recording the returned mapping.
6. Rewrite Prompt references, apply instance bindings, and update cloned
   definitions whose effective Context changed.
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
retrieval. New changes are blocked for that broken Prompt until it is repaired
or removed.

## Queries and projections

`document.load` returns the version 2 snapshot and a head that includes
`isTemplate`. `document.list` is unchanged at the wire level but filters
`isTemplate = 0` in the store.

The dependency projection adds:

- each Context Variable target;
- each Prompt Block's direct entries; and
- each Prompt Block's variable IDs and resolved targets.

This keeps broken/missing bindings inspectable without asking Derived Outputs
to reverse-engineer the authored variable relationship.

## Activity

Creating a backing Document publishes an ordinary `document.created`
transaction with safe metadata indicating template mode. Editing it publishes
normal Document changes against the Template ID. Creating an instance publishes
one ordinary `document.created` transaction for the new real resource.

Context-variable operations use their exact operation names in the Document
transaction's `operationTypes`. Derived Output definition synchronization is a
consequence of the accepted Document change and does not create a duplicate
Document Activity transaction.

## Invariants

1. `isTemplate` is immutable for the life of a Document.
2. A template-mode Document is absent from the ordinary Document list but is
   loadable and editable by exact ID.
3. A Prompt Block references only variable IDs present in the same snapshot.
4. Context Variable names are non-empty and unique under trim plus
   case-insensitive comparison.
5. An unbound variable never resolves as whole-project Context.
6. Concrete Derived Output context is the deduplicated resolution of the
   Prompt Block's current context spec.
7. Every copied Prompt Block owns a newly cloned Derived Output ID.
8. A destination begins at revision 0 with no copied history, receipts,
   attempts, comments, or Activity history.
9. Context and other resource targets are referenced, not copied.
10. Exact adapter retries return the same destination and output mapping.
11. Templates cannot be deleted through an ordinary Document mutation.

## Deferred

- cross-project variable remapping and copying referenced Context records;
- typed variables for non-Context purposes or Formula interpolation;
- variables used by non-Prompt Blocks;
- automatic model refresh during template instantiation;
- propagating later template edits into existing Documents;
- copying full Derived Output revision history; and
- template-specific page layout, export, or pagination behavior.

## Implementation order

1. Add representation version 2, Context Variable and Prompt context models,
   validation, canonicalization, reducer operations, inverses, and migration.
2. Update Prompt creation/definition/refresh to resolve context specs and add
   durable Prompt-context synchronization.
3. Add immutable `isTemplate` head persistence and ordinary-list filtering.
4. Add keyed Derived Outputs clone support and Document copy attempts.
5. Implement the Document copy runtime and its startup-owned Templates adapter
   for registration, instantiation, and deletion.
6. Wire the adapter into Templates and add tests covering bound/unbound
   variables, duplicate names, multi-Prompt synchronization, deep output
   copies, exact retry, history isolation, and same-project instantiation.
