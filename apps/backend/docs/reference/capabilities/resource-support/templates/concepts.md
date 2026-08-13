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
| Template record | `{ id, kind, resourceId, name, description?, contextBindings, state, revision, createdAt, updatedAt }` |
| Backing resource | The template-mode copy the catalog points at. In v1 its ID equals the Template ID |
| Reserving | A record whose identity is durable but whose copy has not finished. Invisible to `get`/`list` |
| Ready | A completed record, visible and usable |
| Adapter | The per-kind copy contract supplied by composition |
| Binding | `{ target?, description? }` keyed by user-facing variable name |
| Name | Catalog label, unique per kind. What `template.update` renames — never the sealed backing resource |
| Claim | A per-`requestId` row that replays a completed command and resumes an interrupted one |

## Identity

Templates **allocates** the Template ID and returns it. A caller registering a
template points at a resource it already owns and asks for a catalog entry it
has never seen, so it has no basis on which to name that entry.

This differs from the identifiers the caller genuinely authors — the
registration `source` and an instance's `destinationResourceId` — which stay
caller-supplied.

Allocation does not weaken replay. The identifier is minted once and frozen on
the command claim *and* in a `reserving` catalog row before the adapter runs, so
an exact retry and a resumed pending claim both reuse it. Derived Outputs is the
precedent: it allocates its own output ID and relies on a caller-supplied
idempotency key.

See `scratch/resource-id-allocation.md`
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

**Mutating** adapter methods return `void`. Templates supplies both the `kind`
and the destination identifier, so a successful call can only have produced what
it was told to produce — there is nothing to validate on the way back, which is
why there is no resource-mismatch error.

The port has five mutating methods: create and instantiate copies, update a
backing copy's content, then logically delete and purge it. All five return
`void`.

`readTemplateCopy` is the sixth and the exception, and it **narrows** that rule
rather than keeping it: a read has to return something. It hands back the
backing content as `unknown`, because a template's content is whatever the
owning kind says it is and Templates grows no per-kind types. The caller knows
the `kind` from the record. This is symmetric with the content edits going the
other way, which are `unknown` for the same reason.

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

### The bindings are the template

A template is a resource *as a function of its Context Variables*. The declared
bindings are that function's parameter list, so they are not incidental to the
Template record — they are most of what distinguishes one template from
another. Two templates over the same Document with different declared parameters
are different templates. Anything undeclared is not a parameter; it is baked-in
content.

Templates therefore **persists them**, and returns them from `template.get` and
`template.list`. That is not caching a value that lives elsewhere: the
declaration exists only here. A binding's `description` documents a parameter
of the template and has no home on the resource at all, and the resource's
variable state cannot say which of its variables a template means to expose.

What the resource holds is the *applied* target for each variable, written by
the adapter during the copy — because only the owning kind knows how its
variables are stored. The record says what the parameters are; the resource
holds what they currently point at.

The two cannot drift, because `template.update` is the only path that changes
either. It rewrites the declaration and applies the content edits as one
command.

Registration **seals** the backing resource to make that true: the owning
capability refuses its whole public surface for a template-mode resource —
reads included, and renaming with them. The backing copy exists for one reason,
so instantiation has something to copy, and Templates reaches it through the
adapter rather than the public path. Reading a template is therefore
`template.load`, not the owning capability's own load; that capability still
answers a *listing* of its templates, which hands back identifying metadata
rather than content.

> **Half implemented, and the half that is missing is the enforcement.**
> Templates now persists the declaration, returns it, and routes every change
> through `template.update`. **No resource capability refuses anything yet** —
> there is no `isTemplate` flag in Document, so nothing stops an ordinary
> `document.submit` against a backing copy. Until that lands, "cannot drift" is
> a property of the Templates side alone.

`ContextEntry` is a type-only import of the `{ id, kind }` atom. Templates has
no Context runtime, port, read, or write.

## Ownership boundaries

Templates owns the catalog and command replay. The resource capability owns
content, revisions, the template-mode flag, and copy rules. Context owns Context
records. Derived Outputs owns generated content.

Instantiation writes no catalog row: the instance belongs entirely to its owning
capability, and Templates keeps no instance list.
