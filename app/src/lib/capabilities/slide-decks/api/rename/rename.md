# API: `rename`

Gives a deck a different name.

Registered as `api.capabilities.slideDecks.rename`, built from `projectMutation`.

## Procedure Tree

```text
rename(ctx, scope, id, title)
├── requireDeck(ctx, scope, id)             ../shared/require-deck.ts
├── slideDeckTitle(title)                   ../../types/slide-deck.ts
├── ctx.db.patch(id, title, updatedBy, …)   rename.ts
└── record(ctx, scope, "renamed")           ../../../activity/api/shared/record.ts
```

## The one edit that patches this row

Every other edit to a deck appends a change set and leaves the row alone. The
title is the exception because it is the only thing stored here that anyone
edits — a slide's title, if a deck had them, would not be.

## The entry carries the new name

The log reads as what happened. Entries written before this one keep the old
name, which is right: they describe the deck as it was when they were written.
