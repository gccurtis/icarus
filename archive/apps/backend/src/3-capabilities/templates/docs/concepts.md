# Templates concepts

## Purpose

Templates keeps one project-scoped catalog of reusable resource templates. A
template is not a second content format. It is a catalog entry pointing at a
sealed copy of a resource owned by another kind, such as Document.

The organising idea is that **a template turns a resource into a function of its
Context Variables**. Registration copies the resource, seals the copy, and
records which of its variables are parameters; instantiation copies the template
and supplies arguments for those parameters.

## Vocabulary

| Term | Meaning in the implementation |
|---|---|
| Template record | `{ id, kind, resourceId, name, description?, contextBindings, revision, createdAt, updatedAt }` |
| Backing copy | The sealed resource the catalog points at. Its ID is allocated by the owning capability and is **not** the Template ID |
| Resource runtime | The owning capability's own object, satisfying `TemplatableResource` structurally |
| Binding | `{ target?, description? }` keyed by user-facing variable name |
| Name | Catalog label, unique per kind. What `template.update` renames — never the sealed backing copy |
| Receipt | A per-`requestId` row holding what a completed command returned, so an exact retry replays it |

## Identity

**The capability that stores a thing allocates its ID.** Templates allocates the
Template ID because it stores the catalog row. The owning capability allocates
the backing copy's ID because it stores the copy, and hands it back from
`duplicate`.

So `resourceId !== id`, always. An earlier design enforced `resource_id = id`
with a CHECK constraint; that only held because Templates was passing its own ID
down as the destination, which made a coincidence look like a rule.

Nothing is caller-supplied except the source: registration names `{ kind,
resourceId }` for a resource the caller already owns. Instantiation names no
destination at all.

## The resource seam

Templates is generic because startup registers one runtime per supported kind.

```text
Templates catalog
  Template { id, kind, resourceId }
                       |
                       +-- kind's runtime --> the sealed backing copy
```

**There is no adapter object.** The capability's own runtime satisfies
`TemplatableResource` structurally, and composition is one line in `1-init`:

```ts
templateResources.register(document);
```

The interface exists so that line typechecks — see
[`ports/templatableResource.ts`](../ports/templatableResource.ts) for why a
`Record<string, any>` registry and a `DocumentCapability`-typed one both fail.

Adding a kind adds no union member, table, or import to the Templates domain.

### What crosses the seam, and in which direction

| Method | Templates supplies | Gets back |
|---|---|---|
| `duplicate` | a source ID, an optional name for the copy, a key | **the ID it allocated** |
| `markAsTemplate` | the copy's ID | nothing |
| `applyBindings` | bindings, in Templates' own vocabulary | nothing |
| `submit` | caller-authored operations, `unknown` | nothing |
| `load` | the copy's ID | the content, `unknown` |
| `logicalDelete` / `purge` | the copy's ID, a key | nothing |

Two things are `unknown` here, for the same reason and not by accident:
`submit`'s operations were authored by the *caller* and `load`'s content is
whatever the kind says it is. Templates interprets neither and grows no per-kind
types. The caller knows the kind from the record.

Bindings are the deliberate exception. They arrive in Templates' own vocabulary,
decoded strictly at its wire boundary and stored on its record, so they cross as
themselves. Folding them into `submit` would mean constructing a resource
operation, which is exactly the per-kind knowledge this seam keeps out.

## Bindings

One override rule governs how a binding record reaches a resource, and only the
owning kind can carry it out, because only it knows how its variables are stored:

| Binding for a variable | Effect on the resource |
|---|---|
| Not a key in the record | Keeps whatever it currently holds |
| Key present with `target` | That target becomes its target |
| Key present, `target` omitted | Explicitly unbound |

Nothing is cleared implicitly. A registrar wanting a blank template names the
variables and omits their targets; one wanting defaults sets them; one supplying
nothing gets a faithful copy.

The third row is reachable **only at registration**. Instantiation requires a
target on every argument — see below.

### The bindings are the template

A template is a resource *as a function of its Context Variables*. The declared
bindings are that function's parameter list, so they are not incidental to the
Template record — they are most of what distinguishes one template from another.
Two templates over the same Document with different declared parameters are
different templates. Anything undeclared is not a parameter; it is baked-in
content.

Templates therefore **persists them**, and returns them from `template.get` and
`template.list`. That is not caching a value that lives elsewhere: the
declaration exists only here. A binding's `description` documents a parameter of
the template and has no home on the resource at all, and the resource's variable
state cannot say which of its variables a template means to expose.

What the resource holds is the *applied* target for each variable. The record
says what the parameters are; the resource holds what they currently point at.

### Registration declares; instantiation supplies

The two halves of the rule are not symmetric, and the asymmetry is the design.

| | Registration | Instantiation |
|---|---|---|
| Which variables are named | The ones being made parameters | **Exactly** the declared set |
| A `target` on each | Optional | **Required** |
| What an omitted `target` means | A parameter with no default | Rejected at the wire |

**Registration** says *which variables are parameters*, and may give each one a
target. Those targets are what the backing copy holds, which is what makes the
template itself a working resource — openable, previewable, and a sensible
default to show whoever instantiates it.

**Instantiation** names every declared parameter and says what each one points
at. Mechanically the copy starts from the declared targets, because `duplicate`
is verbatim, and `applyBindings` then replaces them with the supplied ones.

The result is that no instance holds an unbound variable — not because the
declaration happened to have defaults, but because an instantiation that left one
open was refused.

An argument for an undeclared variable is refused for the converse reason: that
variable is baked-in content, and binding it would edit the instance rather than
configure it.

### Three names meet at instantiation

None of them is the other, and conflating any two is a bug:

| Name | Owned by | Changed by |
|---|---|---|
| The Template record's `name` | Templates | `template.update` |
| The sealed backing copy's own title | The resource | **Nothing** — inherited from the source and unreachable |
| The instance's name | The resource | Its own capability, after instantiation |

`template.instantiate` takes the third. Omitting it inherits the backing copy's
title, which is the only default available.

### Why the two statements cannot drift

`template.update` is the only path that changes either. It rewrites the
declaration and applies the resource changes as one command.

Registration **seals** the backing copy to make that true: the owning capability
refuses its whole public surface for a resource in template mode — reads
included, and renaming with them. The copy exists for one reason, so
instantiation has something to copy, and Templates reaches it by holding the
runtime object rather than going through the public path.

Reading a template is therefore `template.load`. And `template.list` is the only
template listing in the system: no resource capability exposes one, because a
sealed resource is not something its own capability answers questions about.

> **Half implemented, and the missing half is the enforcement.** Templates
> persists the declaration, returns it, and routes every change through
> `template.update`. **No resource capability refuses anything yet** — there is
> no `isTemplate` flag in Document, so nothing stops an ordinary
> `document.submit` against a backing copy. Until that lands, "cannot drift" is
> a property of the Templates side alone.

`ContextEntry` is a type-only import of the `{ id, kind }` atom. Templates has no
Context runtime, port, read, or write.

## Ownership boundaries

Templates owns the catalog, command replay, and the whole registration and
instantiation *procedure*. The resource capability owns content, revisions, IDs,
the template-mode flag, and how a copy is made. Context owns Context records.
Derived Outputs owns generated content.

The resource is driven, not consulted: it neither knows nor decides that it is
becoming a template. `duplicate` is a pure copy that a capability could offer for
its own reasons, and `markAsTemplate` is a separate instruction.

Instantiation writes no catalog row: the instance belongs entirely to its owning
capability, and Templates keeps no instance list.
