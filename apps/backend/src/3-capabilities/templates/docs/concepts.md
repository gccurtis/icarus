# Templates concepts

## Purpose

Templates keeps one project-scoped catalog of reusable resource templates. A
template is not a second content format. It is a reference to a template-mode
resource owned by another kind, such as Document.

The organising idea is that **a template turns a resource into a function of its
Context Variables**. Registration keeps the resource's structure and records
default bindings for its variables; instantiation overrides those defaults, or
leaves them to be filled in later.

## Vocabulary

| Term | Meaning in the implementation |
|---|---|
| Template record | `{ id, kind, resourceId, description?, state, createdAt, deletedAt? }` |
| Backing resource | The template-mode copy the catalog points at. In v1 its ID equals the Template ID |
| Reserving | A record whose identity is durable but whose copy has not finished. Invisible to `get`/`list` |
| Ready | A completed record, visible and usable |
| Adapter | The per-kind copy contract supplied by composition |
| Binding | `{ entry?, description? }` keyed by user-facing variable name |
| Claim | A per-`requestId` row that replays a completed command and resumes an interrupted one |

## Identity

Templates **allocates** the Template ID and returns it. A caller registering a
template points at a resource it already owns and asks for a catalog entry it
has never seen, so it has no basis on which to name that entry.

This differs from the identifiers the caller genuinely authors — the
registration `source` and an instance's `destinationResourceId` — which stay
caller-supplied, as `document.create` takes a `documentId`.

Allocation does not weaken replay. The identifier is minted once and frozen on
the command claim *and* in a `reserving` catalog row before the adapter runs, so
an exact retry and a resumed pending claim both reuse it. Derived Outputs is the
precedent: it allocates its own output ID and relies on a caller-supplied
idempotency key.

See [`scratch/resource-id-allocation.md`](../../../../../../scratch/resource-id-allocation.md)
for the open question of whether Document and Slide should move the same way.

## The adapter seam

Templates is generic because startup injects one adapter per supported kind.

```text
Templates catalog
  Template { id, kind, resourceId }
                       |
                       +-- kind adapter --> backing resource in template mode
```

Adding a kind means implementing and registering another adapter. It adds no
union member, table, or import to the Templates domain.

Adapter methods return `void`. Templates supplies both the `kind` and the
destination identifier, so a successful call can only have produced what it was
told to produce — there is nothing to validate on the way back.

## Bindings

Instantiation input is typed rather than an opaque blob, because the thing an
instantiation varies is Context Variables, and those are resource-level
structure rather than a Document peculiarity.

One override rule applies at both registration and instantiation:

| Binding for a variable | Effect on the destination |
|---|---|
| Not a key in the record | Keeps whatever the source held |
| Key present with `entry` | That target becomes the destination's |
| Key present, `entry` omitted | Explicitly unbound |

Nothing is cleared implicitly. A registrar wanting a blank template names the
variables and omits their entries; one wanting defaults sets them; one
supplying nothing gets a faithful copy.

Applying the rule is the **adapter's** job, because only the owning kind knows
how its variables are stored. Templates forwards bindings and persists none of
them, so the catalog can never disagree with the resource about what a variable
points at.

`ContextEntry` is a type-only import of the `{ id, kind }` atom. Templates has
no Context runtime, port, read, or write.

## Ownership boundaries

Templates owns the catalog and command replay. The resource capability owns
content, revisions, the template-mode flag, and copy rules. Context owns Context
records. Derived Outputs owns generated content.

Instantiation writes no catalog row: the instance belongs entirely to its owning
capability, and Templates keeps no instance list.
