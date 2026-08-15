# Slides

A deck. Ordered slides, each holding positioned elements, each element holding
content blocks.

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
  slides: Slide[];
  theme?: SlideTheme;
}

interface Slide {
  layout?: string;             // named layout from the theme
  elements: SlideElement[];
  notes: ContentBlock[];
  background?: { color?: string; imageFileId?: Id<"externalFiles"> };
  hidden?: boolean;
}

interface SlideElement {
  frame: { x: number; y: number; width: number; height: number };
  rotation?: number;
  blocks: ContentBlock[];
  overflow: "clip" | "shrink" | "grow";
}

interface SlideTheme {
  fontFamily?: string;
  colors?: { background: string; text: string; accent: string };
  layouts?: Record<string, { name: string; elements: { frame: SlideElement["frame"] }[] }>;
}
```

## Position belongs to the element, content to the block

This is the split that makes the same content primitive work on a slide and in a
[document](document.md). The element owns where it sits and how big it is; the
blocks inside it own what it says. A text block does not know it is on a slide,
so the same editor and the same renderer work in both places.

`frame` coordinates are fractions of the slide, `0` to `1`, not pixels. A deck
rendered at 1920×1080, on a phone, and in a PDF export must place elements
identically, and only relative coordinates do that without a canonical pixel
size that everything else has to divide by.

## Overflow

`overflow` is on the element because it is a property of the box, not of the
text. When content is larger than its frame the deck has to do something, and
the three options are genuinely different intentions: `clip` for a fixed design,
`shrink` for a title that must fit, `grow` for notes-style content where the
frame was only a starting point.

## Notes

Slide notes are content blocks, so a speaker note can hold a list, a link, or an
image — not a plain string. They are on the slide rather than being an element
because they have no position.

## Layouts and themes

A `layout` is a name pointing into the theme's layout set, and it is a starting
point, not a constraint: applying a layout creates elements at those frames,
after which the element is independent. A slide whose elements were driven live
by the theme could not be adjusted without changing every slide sharing the
layout.

`theme` is embedded rather than a shared object for the same reason
[documents](document.md#template-origin) copy from templates — a deck should not
change appearance because something outside it was edited.

## The body is not on this row

`slides` and `theme` live in the [leader
snapshot](../revisions/resource-snapshot.md), with the current body being that
snapshot plus the [change sets](../revisions/change-set.md) after it — the same
arrangement as a [document](document.md#the-body-is-not-on-this-row), for the
same write-amplification reason. Decks are the case where it matters most:
embedded images and per-element layout make a deck body far larger than a
document's.

`aspectRatio` stays on the row because it is metadata a thumbnail needs, and it
is not something an edit operation changes.

## Related

[content block](../content/content-block.md) ·
[resource snapshot](../revisions/resource-snapshot.md) ·
[change set](../revisions/change-set.md) ·
[template](../special-resources/template.md)
