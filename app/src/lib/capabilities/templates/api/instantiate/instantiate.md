# API: `instantiate`

Starts a resource from a template, and returns its `(resourceType, resourceId)`
key.

Registered as `api.capabilities.templates.instantiate`, built from
`projectMutation`.

## Procedure Tree

```text
instantiate(ctx, scope, id, title)
├── requireTemplate(ctx, scope, id)          ../shared/require-template.ts
├── resourceFrom(ctx, scope, title, id, body) resource-from.ts
│   ├── resourceBodyOf(body)                 ../../types/body.ts
│   ├── documents.create(…)                  ../../../documents/api/create/create.ts
│   ├── slideDecks.create(…)                 ../../../slide-decks/api/create/create.ts
│   └── spreadsheets.create(…)               ../../../spreadsheets/api/create/create.ts
└── record(ctx, scope, "instantiated")       ../../../activity/api/shared/record.ts
```

## The copy is full, and the resource owes the template nothing

It records `templateId` as provenance and holds every byte of its content itself.
Editing the template later leaves it untouched; deleting the template costs it
nothing but the answer to "what was this made from".

The alternative — a resource holding a diff against a live template — means an
edit to a template someone has never seen silently rewrites their document, and
means no resource can be read without also reading its template.

## It writes no resource row itself

`resourceFrom` dispatches on the body's target and calls the capability that owns
the row. What a document row looks like is `documents`' business, and going around
it would duplicate the title rule, the attribution, the activity entry, and the
snapshot anchor — four things that would then be free to drift from the ones an
ordinary `create` writes.

**The first snapshot is `revisions.start`'s**, reached through that same `create`.
A resource whose row committed without an anchor is a resource nothing can open.

## A global template instantiates into the caller's project

That is what "available to every project" means. Only editing a global is
refused, and [`requireTemplate`](../shared/shared.md) is the procedure that admits
one where [`requireOwnTemplate`](../shared/shared.md) does not.

## Slot values are not substituted

The body already reads as a usable starting point — a slot appears in it as
ordinary content carrying the slot's key, so placeholder text reads as
placeholder text. Filling one is an ordinary edit through `revisions` until pass
7, when a `derived` slot becomes a prompt block generated on first open.

## Two activity entries, not one

The resource's `create` writes `created`; this writes `instantiated` with the
template as its target and the resource as its context. They are different facts,
and the second is the only record of which template was used once the template is
deleted.
