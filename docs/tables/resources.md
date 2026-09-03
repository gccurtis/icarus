# General resources

Two tables, almost the same row twice. Everything that differs between them is in
the body, which lives in [`resourceSnapshots`](revisions.md) rather than here.

`documents` · `slideDecks`

**The third general resource is [spreadsheets](spreadsheets.md)**, and it has its
own document because its content is not in its body — a grid is rows in a table,
so it carries a second table and a different revision model.

---

## The rows

`app/src/lib/capabilities/documents/schema.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { actorValidator } from "$shared/types/actor";

/**
 * A document's metadata, and deliberately nothing else.
 *
 * What is here is what a list, a tab, a breadcrumb, and a search result render
 * from — readable without loading a word of content.
 *
 * `templateId` is provenance only: a resource is a full copy at creation, so
 * changing the template later changes nothing here, and deleting it leaves an id
 * that resolves to nothing and costs nothing.
 */
export const documentsTables = {
  documents: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    templateId: v.optional(v.id("templates")),
    createdBy: actorValidator,
    updatedBy: actorValidator,
    updatedAt: v.number()
  }).index("by_project", ["projectId"])
};
```

`app/src/lib/capabilities/slide-decks/schema.ts`

```ts
/**
 * The same row, plus the one field a deck needs before its body is opened.
 *
 * **`aspectRatio` is the only difference between the two rows.** A thumbnail
 * needs it before anything opens the body, and no operation changes it — frames
 * are fractions of the slide, so they only mean the same thing across slides if
 * the slides are the same shape.
 */
export const slideDecksTables = {
  slideDecks: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    aspectRatio: v.union(v.literal("16:9"), v.literal("4:3")),
    templateId: v.optional(v.id("templates")),
    createdBy: actorValidator,
    updatedBy: actorValidator,
    updatedAt: v.number()
  }).index("by_project", ["projectId"])
};
```

They stay separate tables rather than one with a kind field because their bodies
are completely different and `generalResourceType` already discriminates. Merging
the rows would make one table whose meaning depends on a column.

---

## The bodies

Not tables. `resourceSnapshots.body` is a three-way union, which is why each body
lives with its own resource — a deck body belongs to `slide-decks`, and declaring
it inside `revisions` would be that capability knowing what a slide is. The third
member is defined in [spreadsheets](spreadsheets.md).

### `DocumentBody`

`app/src/lib/capabilities/documents/types/body.ts`

```ts
/**
 * A document is rows, and a row is one of three things.
 *
 * **A divider and a page break are not blocks.** They hold no content, take no
 * marks, and cannot be searched. Content and structure split there.
 */
export const documentRowValidator = v.union(
  v.object({
    id: v.string(),
    kind: v.literal("blocks"),
    blocks: v.array(blockValidator),
    proportions: v.optional(v.array(v.number()))
  }),
  v.object({
    id: v.string(),
    kind: v.literal("divider"),
    color: v.optional(v.string()),
    width: v.optional(v.number()),
    style: v.optional(
      v.union(v.literal("solid"), v.literal("dashed"), v.literal("dotted"))
    )
  }),
  v.object({ id: v.string(), kind: v.literal("pageBreak") })
);

/**
 * What is printed around the content rather than in it.
 *
 * **Rows rather than blocks**, so a header can hold a divider. **A
 * `distanceFromEdge`** because margins are the content boundary and furniture
 * sits outside them.
 */
export const pageFurnitureValidator = v.object({
  rows: v.array(documentRowValidator),
  /** Absent means every page gets the same. */
  firstPageRows: v.optional(v.array(documentRowValidator)),
  distanceFromEdge: v.number(),
  pageNumber: v.optional(
    v.object({
      position: v.union(v.literal("start"), v.literal("center"), v.literal("end")),
      format: v.optional(v.string()),
      startAt: v.optional(v.number()),
      hideOnFirstPage: v.optional(v.boolean())
    })
  )
});

/**
 * **The style set is in the body rather than on the row**, so restyling headings
 * is an ordinary change set and an undo reaches it. Same for page setup.
 */
export const documentBodyValidator = v.object({
  pageSetup: v.optional(pageSetupValidator),
  styles: v.optional(styleSetValidator),
  rows: v.array(documentRowValidator),
  header: v.optional(pageFurnitureValidator),
  footer: v.optional(pageFurnitureValidator)
});
```

### `SlideDeckBody`

`app/src/lib/capabilities/slide-decks/types/body.ts`

```ts
/** A rectangle as fractions of the slide, which is why aspect ratio is fixed. */
export const frameValidator = v.object({
  x: v.number(), y: v.number(), width: v.number(), height: v.number()
});

/** A flat colour or an uploaded file — never inline bytes, so a deck body stays small. */
const slideBackgroundValidator = v.union(
  v.object({ kind: v.literal("color"), color: v.string() }),
  v.object({
    kind: v.literal("image"),
    fileId: v.id("externalFiles"),
    fit: v.union(v.literal("cover"), v.literal("contain"))
  })
);

export const slideElementValidator = v.object({
  id: v.string(),
  frame: frameValidator,
  rotation: v.optional(v.number()),
  blocks: v.array(blockValidator),
  overflow: v.union(v.literal("clip"), v.literal("shrink"), v.literal("grow")),
  fromPlaceholder: v.optional(v.string()),
  format: v.optional(blockFormatValidator)
});

export const slideValidator = v.object({
  id: v.string(),
  layoutKey: v.optional(v.string()),
  elements: v.array(slideElementValidator),
  notes: v.array(blockValidator),
  background: v.optional(slideBackgroundValidator),
  hidden: v.optional(v.boolean())
});

/** An editable position a layout offers. Applying the layout turns it into a real element. */
const slidePlaceholderValidator = v.object({
  role: v.string(),
  frame: frameValidator,
  styleKey: v.optional(v.string()),
  prompt: v.optional(v.string())
});

/**
 * The master concept, in two fields: `locked` elements are drawn on every slide
 * using the layout and cannot be edited there, so fixing one fixes every slide
 * at once; `placeholders` are the positions applying the layout fills.
 *
 * A layout is named by `key` rather than an id, like a style — so it is
 * addressed by that key rather than by an `#id` path segment.
 */
const slideLayoutValidator = v.object({
  key: v.string(),
  name: v.string(),
  locked: v.array(slideElementValidator),
  placeholders: v.array(slidePlaceholderValidator),
  background: v.optional(slideBackgroundValidator)
});

/**
 * A named run of slides, anchored by its **first slide only**: each section runs
 * until the next begins.
 *
 * A section defined by a start and an end breaks the moment a slide is inserted
 * or moved. One defined by a single anchor absorbs inserts, and reordering
 * slides reorders sections with them. Slides before the first section belong to
 * none, which is the ordinary state of a deck nobody has organized.
 */
const deckSectionValidator = v.object({
  id: v.string(),
  name: v.string(),
  firstSlideId: v.string()
});

/** What is true for the whole deck: background, palette, typeface. */
const deckThemeValidator = v.object({
  background: v.optional(slideBackgroundValidator),
  colors: v.object({
    text: v.string(),
    accent: v.string(),
    muted: v.optional(v.string())
  }),
  fontFamily: v.optional(v.string())
});

/**
 * **Nothing here describes print.** A slide is a ratio and the body holds no
 * paper, no margins and no page setup: printing a deck is placing some number of
 * slides on a sheet and scaling them to it, which is a shape a page setup cannot
 * hold — it has nowhere to put the count or the arrangement. Until that is
 * modelled, a deck carries no print geometry at all.
 */
export const slideDeckBodyValidator = v.object({
  theme: deckThemeValidator,
  styles: styleSetValidator,
  layouts: v.array(slideLayoutValidator),
  slides: v.array(slideValidator),
  sections: v.array(deckSectionValidator)
});
```

---

## Layout, across the three

| | Screen geometry | Print geometry | Furniture |
| --- | --- | --- | --- |
| document | it *is* pages | `pageSetup` | `header` + `footer` |
| slides | `aspectRatio` | not modelled | — |
| [spreadsheet](spreadsheets.md) | the body's row and column arrays | `print.page` | — |

Three homes for page geometry because they are three different things: a slide is
not a page, and a grid is not paginated until it is printed. A deck has no print
geometry yet — it is the one of the three whose printed form is an arrangement of
its screen form rather than a shape of its own.

---

## Files

```text
app/src/lib/capabilities/documents/
├── schema.ts
└── types/body.ts                  DocumentRow, PageFurniture, DocumentBody

app/src/lib/capabilities/slide-decks/
├── schema.ts
└── types/body.ts                  Frame, SlideElement, Slide, SlideDeckBody
```

One table each, so `schema.ts` is a file rather than a directory.

**Imports they do not define:** [`$content/types/block`](content.md),
[`$content/types/format`](content.md#blockformat),
[`$shared/types/page-setup`](shared.md#pagesetup),
[`$shared/types/style-set`](shared.md#styleset),
[`$shared/types/actor`](shared.md#actor).

## Related

[all tables](README.md) · [spreadsheets](spreadsheets.md) ·
[revisions](revisions.md)
