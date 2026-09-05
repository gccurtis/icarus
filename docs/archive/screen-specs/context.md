# Context

## Purpose and naming

The user-facing Context screen creates and manages saved scopes. The persisted model is `ResourceSet`, and its definition is a lazy `SetExpression`, not a stored list of members. The screen must keep the saved rule visually distinct from the resources it happens to resolve to today.

Context is a project-level library screen. It can deep-link to a selected Resource Set without opening one tab per set.

## Center surface

### Header

- Context name and optional description.
- Saved/saving/revision-conflict state.
- Duplicate and delete actions.
- Human-readable expression summary.
- Current resolved count and resolution time.

Delete remains gated until a complete reverse-dependency query/index can find dependent Resource Sets, Personas, Derived Outputs, and Prompt Blocks embedded in current document/deck/workbook bodies and template bodies. Once that exists, deletion blocks while dependents remain and lists/opens every one; it never silently creates broken scopes.

### Expression builder

The left portion of the center plane renders a nested expression tree. Expression nodes have no persisted IDs, so selection uses an ephemeral structural path valid only for the current local tree. Reorder/replace remaps or clears that selection; the UI must not present the path as durable identity.

Supported nodes are:

| Operator | Meaning | Center representation |
| --- | --- | --- |
| Project | Every eligible project resource, including future ones | Single project card |
| Kind | Every resource of one kind | Kind picker and current count |
| Resources | Exact `(kind, id)` references | Searchable explicit-resource list |
| Set | Another saved Resource Set | Referenced-set card and dependency link |
| Union | Everything admitted by any child | Ordered child stack inside an “Any of” group |
| Difference | `from` minus `remove` | Two labeled branches: Include and Exclude |

Users can add, replace, remove, and reorder children where order aids readability. The builder prevents impossible empty structures and blocks save on cycles. Missing-reference behavior requires a resolver contract—fail the expression, omit the member, or return an unresolved descriptor—so the first UI shows the authored ID as unresolved but does not claim resolution semantics until that choice is made.

### Resolved preview

The right portion of the center plane shows the current point-in-time resolution:

- Resource title/name and kind.
- Current revision/version where meaningful.
- Inclusion reason and expression branch when an enhanced resolver returns an expression proof.
- Connector expansion source when a connector produced the file.
- Retrieval evidence limited to indexed windows found, stale windows found, or no indexed material found where derivable.
- Open resource action.

Search, kind filter, and problem-only filter sit above the list. Included-by filtering appears only after the resolver supplies per-result expression proofs. A pending edit shows Added/Removed/Unchanged comparison before save. The preview is recomputed; it is never written back as membership.

### Knowledge and retrieval test

A collapsible lower drawer lets a user test a query against the current expression:

- Query field.
- Retrieved verbatim regions.
- Source, offsets/location, relevance, density.
- Scope manifest explaining requested expression, resolved entries, admissible sources, and resolution time.
- Explicit empty state when no sufficiently relevant region exists.

This is a grounding diagnostic, not a lattice editor. Derived lattice nodes remain system-managed.

## Context panel

| Key | Label | Contents and organization |
| --- | --- | --- |
| `sets` | Saved Contexts | Default. Searchable Resource Sets, create action, dependency/cycle warnings, selected set pinned. |
| `resources` | Resources | Project resources grouped by kind for explicit selection. Connector rows expand to produced files. Findings are included; questions/hypotheses are not. |
| `operators` | Operators | Project, Kind, Resources, Saved Context, Union, and Difference cards with short semantics and add action. |
| `resolved` | Resolved | Dense current-member list and Added/Removed comparison for pending edits. Problems first. |
| `knowledge` | Knowledge | Derived Outputs grouped by idle/generating/fresh/stale/error, retrieval tests for this tab, and diagnostic source regions. Per-source status is limited to observed indexed/stale/no-material evidence until an operational source-health projection exists. No editable lattice nodes. |

## Inspector targets

| Selection | Expanded sections | Collapsed sections |
| --- | --- | --- |
| Resource Set or nothing | Name/description; expression summary; revision state | Creator/timestamps; usages where queryable |
| Project node | Inclusion semantics; current count | Observed retrieval-evidence breakdown |
| Kind node | Resource kind; current count | Current matching resources |
| Resources node | Exact references | Unresolved-reference IDs and provenance where available |
| Set-reference node | Referenced Context; resolution/cycle status | Dependency path |
| Union node | Child expressions; add/remove | Result breakdown when resolver proofs exist |
| Difference node | Include and Exclude branches | Result breakdown when resolver proofs exist |
| Resolved resource | Identity; open; why included when resolver proof exists | Revision/retrieval evidence/provenance details |
| Connector | Produced-file expansion | Connector status and last sync |
| Retrieved region | Verbatim excerpt; source/location | Relevance/density; scope manifest |
| Scope manifest | Requested/resolved/admissible summary | Digests and timing |
| Derived Output | Prompt; state; current block; refresh | Scope; declared inputs; `inputsAt`; lattice version; model/error/timing |
| Lattice node, debug only | Tier/level/count/staleness | Windows and their densities; explicitly computed density aggregate; cohesion; members |

## Resolution semantics the UI must teach

- Contexts are live. “All documents” includes documents created after the Context was saved.
- Referencing another Context includes its current resolution.
- A connector selection expands to its synchronized files; it does not make the connector record retrievable content.
- Findings are resources and can be retrieved. Questions and hypotheses are organizational research objects and cannot be selected by `ResourceKind`.
- Templates and connectors can be named by the expression but are not themselves lattice sources.
- Messages, tasks, personas, automations, comments, and activity are not resources.
- Consumers that need historical provenance capture their own resolved input/scope manifest.
- Retrieval treats an absent **or empty** scope as whole-project. A Context resolving to zero resources therefore cannot safely mean “search nothing” under the current process; consumers must warn/block it or add an explicit-empty sentinel rather than silently broadening the search.

## Save, cycle, and stale states

- The form uses revision-based stale-write rejection.
- A conflict preserves the edited expression and offers Refresh and reapply.
- Cycle detection identifies the full Context dependency path and blocks save/resolution.
- A deleted explicit resource remains in the authored expression by ID, but whether resolution fails, omits it, or returns an unresolved descriptor is a blocking resolver decision. Project membership is the access boundary; there is no per-resource ACL state to label “inaccessible.”
- A zero-member result is valid as a saved expression but carries a prominent retrieval warning because current empty-scope semantics broaden to the whole lattice.
- Indexing or stale knowledge does not make a resource disappear from Context resolution. The initial UI reports only retrieval evidence the lattice can actually support; a richer health badge needs a dedicated source-registry projection.

## Model limitation

The current model does not provide a universal reverse index of every prompt, persona, task request, or thread using a Resource Set. Show “Used by” only for consumers the backend can query truthfully. Copilot/request-level scope also needs a first-class persistence decision; see [Copilot context](copilot-bar.md#context-instrumentation).

The knowledge model describes singular `parentId` tree structure while the clustering process describes overlapping cliques/multiple memberships. The debug inspector must not promise one definitive parent hierarchy until that repository contradiction is resolved.

Derived Outputs have no standalone tab in the first screen set. They are reached from their Prompt Block, the Knowledge view here, Project Health, and an Automation action picker. Finding the owning Prompt Block is a reverse-query requirement because `DerivedOutput` itself stores no owner pointer.

Delete remains gated until one reverse dependency query covers Resource Sets, Personas, Derived Outputs, and Prompt Blocks embedded in current document/deck/workbook and template bodies. Without that complete query, the UI cannot keep its promise that deletion will not create silent broken scopes.

## Retained tab view state

The `context` state retains selected Resource Set, active context view, resource query/kind filters, expression focus path, resolved-list scroll, and panel geometry. The saved `SetExpression` and resource metadata remain persisted objects. Resolver proofs, cycle diagnostics, and provisional drag/drop expressions live in the screen runtime and are recomputed or discarded safely on reload.

## Model coverage

- [Resource Sets and expressions](../data-models/special-resources/resource-set.md)
- [Knowledge lattice](../data-models/knowledge/knowledge-lattice.md)
- [Derived outputs](../data-models/knowledge/derived-output.md)
- [Lattice retrieval](../processes/lattice-retrieval.md)
