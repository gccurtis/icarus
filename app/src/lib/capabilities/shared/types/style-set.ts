import { v, type Infer } from "convex/values";

/**
 * One named style. `name` is what a person picks from a menu; the key it sits
 * under is what blocks reference, so renaming a style is an edit to one field
 * rather than a rewrite of every block using it.
 *
 * Sizes and spacing are points; `lineHeight` is a multiplier.
 */
export const textStyleValidator = v.object({
  name: v.string(),
  fontFamily: v.optional(v.string()),
  fontSize: v.optional(v.number()),
  fontWeight: v.optional(v.number()),
  italic: v.optional(v.boolean()),
  underline: v.optional(v.boolean()),
  color: v.optional(v.string()),
  lineHeight: v.optional(v.number()),
  spaceBefore: v.optional(v.number()),
  spaceAfter: v.optional(v.number()),
  align: v.optional(
    v.union(v.literal("start"), v.literal("center"), v.literal("end"), v.literal("justify"))
  ),
  indent: v.optional(v.number())
});

export type TextStyle = Infer<typeof textStyleValidator>;

/**
 * A resource's named styles. A block carries a key into this rather than a copy
 * of the formatting, which is what makes editing "Heading 1" restyle every
 * heading at once.
 *
 * **It lives inside the resource's body**, so restyling is an ordinary change
 * set and an undo reaches it — and so a document cannot change appearance
 * because something outside it was edited.
 *
 * `defaultKey` is required: a resource with no default renders unstyled text
 * differently depending on which renderer is asked.
 */
export const styleSetValidator = v.object({
  styles: v.record(v.string(), textStyleValidator),
  defaultKey: v.string()
});

export type StyleSet = Infer<typeof styleSetValidator>;
