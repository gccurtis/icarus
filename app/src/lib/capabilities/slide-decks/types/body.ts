import { v, type Infer } from "convex/values";
import { blockValidator } from "$content/types/block";
import { blockFormatValidator } from "$content/types/format";
import { pageSetupValidator } from "$shared/types/page-setup";
import { styleSetValidator } from "$shared/types/style-set";

/**
 * Where an element sits, as fractions of the slide, 0–1.
 *
 * Not pixels: a deck rendered at 1920 × 1080, on a phone, and in a PDF must
 * place elements identically, and only relative coordinates do that without a
 * canonical size everything else divides by.
 */
export const frameValidator = v.object({
  x: v.number(),
  y: v.number(),
  width: v.number(),
  height: v.number()
});

/** `fileId` is `v.string()` until `externalFiles` exists in pass 3. */
const slideBackgroundValidator = v.union(
  v.object({ kind: v.literal("color"), color: v.string() }),
  v.object({
    kind: v.literal("image"),
    fileId: v.string(),
    fit: v.union(v.literal("cover"), v.literal("contain"))
  })
);

/**
 * A box on a slide, holding content blocks.
 *
 * **Position belongs to the element, content to the block** — which is the split
 * that lets the same content primitive work here and in a document. A text block
 * does not know it is on a slide, so one editor and one renderer serve both.
 *
 * `overflow` is on the element because it is a property of the box: when content
 * exceeds the frame the deck must do something, and the three answers are
 * different intentions.
 *
 * `fromPlaceholder` records what the element was created for without constraining
 * it — the element is independent from the moment the layout is applied, which is
 * what lets it be moved without changing every slide sharing that layout.
 */
export const slideElementValidator = v.object({
  id: v.string(),
  frame: frameValidator,
  rotation: v.optional(v.number()),
  blocks: v.array(blockValidator),
  overflow: v.union(v.literal("clip"), v.literal("shrink"), v.literal("grow")),
  fromPlaceholder: v.optional(v.string()),
  format: v.optional(blockFormatValidator)
});

export type SlideElement = Infer<typeof slideElementValidator>;

/** An editable position a layout offers. Applying the layout turns it into a real element. */
const slidePlaceholderValidator = v.object({
  role: v.string(),
  frame: frameValidator,
  styleKey: v.optional(v.string()),
  prompt: v.optional(v.string())
});

/**
 * The master concept, in two fields: `locked` elements are drawn on every slide
 * using the layout and cannot be edited there, so fixing one fixes every slide at
 * once; `placeholders` are the positions applying the layout fills.
 *
 * A layout is named by `key` rather than an id, like a style — so it is addressed
 * by that key rather than by an `#id` path segment.
 */
const slideLayoutValidator = v.object({
  key: v.string(),
  name: v.string(),
  locked: v.array(slideElementValidator),
  placeholders: v.array(slidePlaceholderValidator),
  background: v.optional(slideBackgroundValidator)
});

/**
 * One slide. It carries an id and no name: a slide is identified by what is on
 * it, and forty slides each needing a title nobody reads is a naming burden with
 * no payoff — the thumbnail is the label.
 *
 * `notes` sit on the slide rather than being an element because they have no
 * position on it.
 */
export const slideValidator = v.object({
  id: v.string(),
  layoutKey: v.optional(v.string()),
  elements: v.array(slideElementValidator),
  notes: v.array(blockValidator),
  /** Overrides the layout and the theme. */
  background: v.optional(slideBackgroundValidator),
  hidden: v.optional(v.boolean())
});

/**
 * A named run of slides, anchored by its **first slide only**: each section runs
 * until the next begins.
 *
 * A section defined by a start and an end breaks the moment a slide is inserted
 * or moved. One defined by a single anchor absorbs inserts, and reordering slides
 * reorders sections with them. Slides before the first section belong to none,
 * which is the ordinary state of a deck nobody has organized.
 */
const deckSectionValidator = v.object({
  id: v.string(),
  name: v.string(),
  firstSlideId: v.string()
});

/** What is true for the whole deck: background, palette, typeface. */
const deckThemeValidator = v.object({
  background: v.optional(slideBackgroundValidator),
  colors: v.object({ text: v.string(), accent: v.string(), muted: v.optional(v.string()) }),
  fontFamily: v.optional(v.string())
});

/**
 * What a deck says, as one value.
 *
 * **The theme and the style set are in here rather than on the row**, which is
 * what makes recolouring a deck and restyling its text ordinary change sets —
 * and therefore undoable. `aspectRatio` is the one thing that is not, because a
 * thumbnail needs it without opening the body and no edit changes it.
 *
 * `handout` is optional page setup for printing, separate from `aspectRatio`
 * because the shape of a slide and the shape of the paper it prints on are
 * unrelated.
 */
export const slideDeckBodyValidator = v.object({
  theme: deckThemeValidator,
  styles: styleSetValidator,
  layouts: v.array(slideLayoutValidator),
  slides: v.array(slideValidator),
  sections: v.array(deckSectionValidator),
  handout: v.optional(pageSetupValidator)
});

export type SlideDeckBody = Infer<typeof slideDeckBodyValidator>;

/**
 * The emptiest deck: a theme, a style set, and nothing drawn.
 *
 * **No slide is minted.** The first slide is the client's to author, for the
 * reason a document's first row is: an id invented here is an identity the
 * resource's id space would then have to honour, decided by the one party that
 * is not editing.
 *
 * The palette is named colours rather than chosen ones: what a new deck should
 * look like is a design decision, and it is not this capability's to make.
 */
export const emptySlideDeckBody = (): SlideDeckBody => ({
  theme: { colors: { text: "black", accent: "blue" } },
  styles: { styles: { body: { name: "Body" } }, defaultKey: "body" },
  layouts: [],
  slides: [],
  sections: []
});
