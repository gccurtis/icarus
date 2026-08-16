# API: `create`

Starts a deck, and returns its id.

Registered as `api.capabilities.slideDecks.create`, built from `projectMutation`.

## Procedure Tree

```text
create(ctx, scope, title, aspectRatio, templateId?, body?)
├── slideDeckTitle(title)                   ../../types/slide-deck.ts
├── ctx.db.insert("slideDecks", …)          create.ts
├── emptySlideDeckBody()                    ../../types/body.ts
├── start(ctx, scope, resource, body)       ../../../revisions/api/shared/start.ts
└── record(ctx, scope, "created")           ../../../activity/api/shared/record.ts
```

`body` is the one a template supplies, and the empty one otherwise — see
[`templates.instantiate`](../../../templates/api/instantiate/instantiate.md). It
is stored as given and never read, which is what makes a deck from a template a
complete copy that owes it nothing.

## The row and the body are written together

A deck is spread across three tables, and the row alone is not a deck anyone can
open: a resource with no leader snapshot is not found. Committing one without the
other would produce a row in every gallery that opens to a refusal.

**What an empty deck looks like is decided here**, not in `revisions`, which has
never inspected a body.

## An empty deck has no slides

A theme, a style set, and nothing drawn. The alternative — minting a first slide
— would mean the server choosing an id in the deck's own id space, and every
change set addressing that slide would depend on a decision made by the one party
that is not editing. The client's first change set adds the first slide, exactly
as a document's first row arrives.

## `aspectRatio` is an argument and the theme is not

The shape is fixed at creation, read by a thumbnail, and changed by nothing. The
theme is in the body, where recolouring is an ordinary edit and an undo reaches
it. The split is the whole of why one is here and the other is not.
