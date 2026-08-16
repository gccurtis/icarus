# Slides

A deck. Three levels, each owning what belongs to it: the deck sets what is true
everywhere, a layout sets what is true for slides using it, a slide places
elements, and an element holds content blocks.

```ts
interface SlideDeck {
  projectId: Id<"projects">;
  title: string;
  aspectRatio: "16:9" | "4:3";
  templateId?: Id<"templates">;
  createdBy: Actor;
  updatedBy: Actor;
  updatedAt: number;
}

// the body, stored as a leader snapshot plus change sets
interface SlideDeckBody {
  theme: DeckTheme;
  styles: StyleSet;
  layouts: SlideLayout[];
  slides: Slide[];
  sections: DeckSection[];
  handout?: PageSetup;
}

interface DeckSection {
  id: string;
  name: string;
  firstSlideId: string;
}

interface DeckTheme {
  background?: SlideBackground;
  colors: { text: string; accent: string; muted?: string };
  fontFamily?: string;
}

interface SlideLayout {
  key: string;
  name: string;                        // "Title and content"
  locked: SlideElement[];              // drawn on every slide, not editable there
  placeholders: SlidePlaceholder[];
  background?: SlideBackground;
}

interface SlidePlaceholder {
  role: string;                        // "title", "body", "footer"
  frame: Frame;
  styleKey?: string;
  prompt?: string;                     // "Click to add a title"
}

interface Slide {
  id: string;
  layoutKey?: string;
  elements: SlideElement[];
  notes: ContentBlock[];
  background?: SlideBackground;        // overrides the layout and theme
  hidden?: boolean;
}

interface SlideElement {
  id: string;
  frame: Frame;                        // fractions of the slide, 0–1
  rotation?: number;
  blocks: ContentBlock[];
  overflow: "clip" | "shrink" | "grow";
  fromPlaceholder?: string;            // the role it was created for
  format?: BlockFormat;
}

interface Frame { x: number; y: number; width: number; height: number }

type SlideBackground =
  | { kind: "color"; color: string }
  | { kind: "image"; fileId: Id<"externalFiles">; fit: "cover" | "contain" };
```

## Sections, and why slides have no names

Slides carry an `id` and no name. A slide is identified by what is on it, and a
deck of forty slides each needing a title nobody reads is a naming burden with no
payoff — the thumbnail is the label.

Structure comes from `sections` instead. A section names a **contiguous run** of
slides, and it does so by naming only its first slide: each section runs until the
next one begins.

That is what keeps sections stable under editing. A section defined by a start
and end index breaks the moment a slide is inserted or moved; one defined by a
single anchor absorbs inserts automatically, and reordering slides reorders
sections with them.

Sections partition the deck. Slides before the first section belong to none,
which is the ordinary state of a deck nobody has organized.

## Ids

Slides, elements, and the blocks inside them draw from [one id space per
deck](../content/content-block.md#one-id-space-per-resource) — flat, so an
element moved between slides keeps its identity, and reordering slides never
touches the path to anything on them.

## Position belongs to the element, content to the block

The split that lets the same content primitive work here and in a
[document](document.md). The element owns where it sits and how big it is; the
blocks inside own what it says. A text block does not know it is on a slide, so
the same editor and renderer work in both places.

The element also does not care what a block renders as. A block's display may be
text, an image, or a table — the renderer resolves that, the same way it does
inside a document row. So a table on a slide is an ordinary element holding a
table block, and no slide-specific table concept is needed.

## Frames are fractions

`Frame` coordinates run 0–1, relative to the slide. A deck rendered at
1920 × 1080, on a phone, and in a PDF export must place elements identically, and
only relative coordinates do that without a canonical pixel size everything else
divides by.

This is also why `aspectRatio` is on the deck rather than per slide. Fractions
only mean the same thing across slides if the slides are the same shape.

## Themes and layouts

`theme` is what is true for the whole deck — background, palette, typeface.

A `SlideLayout` is the master concept, and it does the job in two fields:

**`locked`** elements are drawn on every slide using the layout and cannot be
edited from the slide. This is the "here is what the slide looks like, and you
cannot move it" case — a logo, a rule under the title, a footer bar. They live on
the layout, so fixing one fixes every slide at once, which is the entire point of
having a master.

**`placeholders`** are the editable positions. Applying a layout creates real
`SlideElement`s at those frames, tagged with `fromPlaceholder`, after which the
element is independent — moveable, resizable, deletable. A slide whose elements
were driven live by the layout could not be adjusted without changing every slide
sharing it.

That tag is what lets a "reset to layout" action exist, and what lets a layout
change reflow the slides that never diverged. It records intent without
constraining the element.

## Overflow

`overflow` is on the element because it is a property of the box, not the text.
When content exceeds its frame the deck must do something, and the three options
are different intentions: `clip` for a fixed design, `shrink` for a title that
must fit, `grow` for notes-style content where the frame was a starting point.

## Notes and handouts

`notes` are content blocks, so a speaker note can hold a list, a link, or an
image. They sit on the slide rather than being an element because they have no
position on it.

`handout` is optional [page setup](page-setup.md) for printing — paper,
orientation, margins. Absent means the deck has not been set up for print, not
that it cannot be printed; a sensible default applies. It is separate from
`aspectRatio` because the shape of a slide and the shape of the paper it prints
on are unrelated, and forcing one to imply the other is how decks end up with
margins on three sides.

## Styles

`styles` is the deck's [style set](style-set.md), shared with documents. Slide
text uses named styles for the same reason document text does: restyling a deck
should be one edit, not a pass over every element.

## The body is not on this row

`theme`, `layouts`, and `slides` live in the [leader
snapshot](../revisions/resource-snapshot.md), with the current body being that
snapshot plus the [change sets](../revisions/change-set.md) after it — the same
arrangement as a [document](document.md#the-body-is-not-on-this-row), for the
same write-amplification reason. Decks are where it matters most: embedded images
and per-element layout make a deck body far larger than a document's.

`aspectRatio` stays on the row because a thumbnail needs it and no edit operation
changes it.

## Related

[content block](../content/content-block.md) · [page setup](page-setup.md) ·
[style set](style-set.md) ·
[resource snapshot](../revisions/resource-snapshot.md) ·
[change set](../revisions/change-set.md) ·
[template](../special-resources/template.md)
