import { v, type Infer } from "convex/values";
import { blockFormatValidator } from "$content/types/format";
import { formulaValueValidator, type FormulaValue } from "$content/types/value";

/** Where a computation stands. A block still reads while one is stale, which is why `resolved` is stored beside it. */
const resolutionStateValidator = v.union(
  v.literal("fresh"),
  v.literal("stale"),
  v.literal("computing"),
  v.literal("error")
);

/**
 * The smallest authored unit. Literals are typed characters; formula atoms are
 * the `{{ }}` spans inside prose.
 *
 * A formula atom carries its own `resolved` and `state` so `display` can be
 * rebuilt without re-evaluating anything.
 */
export const textAtomValidator = v.union(
  v.object({ id: v.string(), kind: v.literal("literal"), text: v.string() }),
  v.object({
    id: v.string(),
    kind: v.literal("formula"),
    expression: v.string(),
    resolved: v.string(),
    state: resolutionStateValidator,
    error: v.optional(v.string())
  })
);

export type TextAtom = Infer<typeof textAtomValidator>;

/**
 * A styled range. `from`/`to` are UTF-16 offsets into `display`, never into
 * `atoms`: someone bolding `$4.2M` bolded five characters of what they saw, not
 * the nineteen characters of the expression behind them.
 *
 * The id is what makes two people bolding different words in one paragraph
 * merge — a change addresses one mark rather than replacing the array.
 */
export const markValidator = v.object({
  id: v.string(),
  from: v.number(),
  to: v.number(),
  style: v.optional(
    v.array(
      v.union(
        v.literal("bold"),
        v.literal("italic"),
        v.literal("underline"),
        v.literal("strikethrough"),
        v.literal("code")
      )
    )
  ),
  link: v.optional(v.string()),
  color: v.optional(v.string())
});

export type Mark = Infer<typeof markValidator>;

/**
 * Prose, and the five presentations of it. One type rather than five because
 * they share the whole atoms/display/marks machine — a paragraph becoming a
 * heading is a `variant` change, not a rewrite.
 *
 * `style` names an entry in the containing resource's style set rather than
 * copying its formatting, so restyling "Heading 1" restyles every heading.
 * `format` overrides it locally.
 *
 * `display` is the atoms' text in order — each literal's `text`, each formula's
 * `resolved`, concatenated — and the marks index it. Nothing here enforces that;
 * applying ops does.
 */
const textBlockValidator = v.object({
  id: v.string(),
  type: v.literal("text"),
  variant: v.union(
    v.literal("paragraph"),
    v.literal("heading"),
    v.literal("list"),
    v.literal("quote"),
    v.literal("code")
  ),
  level: v.optional(v.number()),
  listStyle: v.optional(v.union(v.literal("bullet"), v.literal("ordered"), v.literal("todo"))),
  checked: v.optional(v.boolean()),
  language: v.optional(v.string()),
  style: v.optional(v.string()),
  atoms: v.array(textAtomValidator),
  display: v.string(),
  marks: v.array(markValidator),
  resolvedAt: v.optional(v.number()),
  format: v.optional(blockFormatValidator)
});

/**
 * A block whose entire content is a computation.
 *
 * Kept apart from a formula atom on purpose: this has a typed `value` other
 * formulas depend on and it either computes or errors, where an atom produces a
 * string span and the sentence around it still renders when it fails.
 */
const formulaBlockValidator = v.object({
  id: v.string(),
  type: v.literal("formula"),
  expression: v.string(),
  display: v.string(),
  value: formulaValueValidator,
  state: resolutionStateValidator,
  error: v.optional(v.string()),
  resolvedAt: v.optional(v.number()),
  format: v.optional(blockFormatValidator)
});

/**
 * The one content primitive: anything a person authors or an agent produces is a
 * list of these, embedded in whatever owns them.
 *
 * Discriminated on `type` and looked up by that literal, so `image`, `table`,
 * `embed`, and `prompt` join the union without touching a variant already here.
 * No owner accepts every variant — a spreadsheet cell takes text and formula, a
 * comment takes text and image — and the owner enforces its own set, which is
 * what keeps this union single rather than one per surface.
 */
export const blockValidator = v.union(textBlockValidator, formulaBlockValidator);

export type TextBlock = Infer<typeof textBlockValidator>;
/** `value` is stated here rather than inferred, because the validator's cells are `v.any()`. */
export type FormulaBlock = Omit<Infer<typeof formulaBlockValidator>, "value"> & {
  value: FormulaValue;
};
export type ContentBlock = TextBlock | FormulaBlock;
