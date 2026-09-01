# Vocabulary

Lives at `src/lib/development-views/vocabulary/vocabulary.md`. Trees live in the concern
document linked below.

## Purpose

The composition reference, rendered at `/demo/vocabulary`. It documents the two
primitive families every screen is assembled from — the panel vocabulary and the
workspace vocabulary — and, for each word, when to reach for it and when to reach
for its neighbour instead.

A companion to [`demo`](../demo/demo.md) and a deliberately different kind of
page. The design system reference answers *what colour, what size, what radius*.
This answers the question above that: given something to put on a screen, which
shape holds it.

## Why it is a reference and not a mock

Nothing here pretends to work. Sample content is illustrative and obvious, and
the final section says form by form what a real one would ask the backend for and
whether that question can be answered yet.

That distinction is the reason this page exists. A page showing convincing fake
data makes exactly one claim — *this works* — which is the claim we cannot
support and do not want to imply. A catalogue entry showing sample content makes
a different and true claim: *this is the shape, and here is what would fill it*.

## The review gutter

Every row carries a note box in a column down the right, and a note is appended
to a file on disk the moment it is entered. The page is read in one sitting and
argued with a row at a time, so a thought that needs a second gesture to keep is
one that does not get written down.

Nothing is shown optimistically. A note appears under its row only once the
server has written the line, for the same reason the rest of the page shows no
fake data: a note that rendered before it was saved would be that lie in
miniature. The gutter is development-only — the endpoint writes into the
checkout, which a running deployment must never do.

## Boundary

This view owns:

- which words the vocabulary has, and the order they are introduced in;
- the choosing table, which is the part that is actually a language;
- the illustrative content in every example;
- the claim in the last section about what each form implies about a query;
- which rows can be commented on, and the scope each one's notes are filed under.

It does not own:

- the primitives themselves, which live in `unique-components/panel/` and
  `unique-components/screen/` and are consumed unmodified;
- the tokens they resolve through, which belong to the styles directory;
- the per-panel `Needs` lines the last section gathers, which belong to
  [`docs/screen-panel-views`](../../../../docs/screen-panel-views/README.md).

## Public Contract

- **Entry:** [`vocabulary.svelte`](vocabulary.svelte)
- **Types:** `None`

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| — | `None` | — | — | The view takes no props; the route renders it directly |

## Dependencies

- `$components/authored/panel` — the family being documented
- `$components/authored/screen` — the other family being documented
- `$lib/components/vendor/separator` — between sections

It reads no client model and calls no capability. That is deliberate: a reference
that needed a project to render would be a reference nobody could open. The one
thing it does reach is its own route, `/demo/vocabulary/comments`, over `fetch`
rather than an import — a view never imports a route.

## Concerns

- [`components/`](components/components.md)
- [`shared/`](shared/shared.md)

No `interactions/`, `effects/` or `procedures/`. The examples still pass no-op
handlers rather than doing anything; the one thing on the page that genuinely
works is the review gutter, and its state is the page's rather than any
component's.
