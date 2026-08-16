# Slide Deck Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`slide-deck.ts`](slide-deck.ts) | `SlideDeck`, `AspectRatio`, and `slideDeckTitle` |
| [`body.ts`](body.ts) | `slideDeckBodyValidator`, `slideValidator`, `slideElementValidator`, `emptySlideDeckBody` |

## The body type is the deck's, not the revision machinery's

`revisions` stores a deck body and has never looked inside one, so what a deck
body *is* belongs here. It imports this to build the union its snapshot column is
declared with, which is the only place the three resources are named together —
and the direction of that import is the whole property: the deck knows about
storage, storage knows nothing about slides.

## Three levels, each owning what belongs to it

The deck sets what is true everywhere (`theme`, `styles`), a layout sets what is
true for the slides using it, a slide places elements, and an element holds
[content blocks](../../content/overview.md). A text block does not know it is on
a slide, which is what lets one editor and one renderer serve decks and
documents both.

## What the validators cannot state

Two of the model's rules are contracts rather than checks, and both are the kind
that would be expensive to get wrong:

**Frames are fractions, 0–1.** A validator sees four numbers. What makes 1920
wrong is that a deck rendered on a phone and in a PDF must place elements
identically, and only relative coordinates do that.

**A section names its first slide and runs until the next one begins.** Nothing
here checks that `firstSlideId` names a slide that exists. What the shape does
prevent is the failure that matters: there is no end anchor to invalidate, so an
inserted slide cannot break a section.

## Layouts are keyed, so they are addressed by key

A layout carries `key` rather than `id`, like a style. An `#id` path segment
resolves by searching for a node whose `id` matches, so a layout is reached
through `layouts` and its position or a key path instead — which is the same
trade a style set makes and for the same reason: both are referenced by name from
elsewhere in the body.
