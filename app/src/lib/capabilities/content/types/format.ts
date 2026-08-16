import { v, type Infer } from "convex/values";

/**
 * A block's own box: how it sits, what it sits on, and how a typed value inside
 * it renders.
 *
 * It is on the block rather than on whatever holds it because it describes
 * *that* block — a container would otherwise have to know how many blocks it
 * holds and which one is being styled.
 *
 * Both axes are here. Horizontal alignment is what prose needs; vertical means
 * something only when a block sits in a box taller than itself, which is the
 * spreadsheet cell and the slide element — the cases that made blocks worth
 * sharing in the first place.
 *
 * `valueFormat` is on the format so the same date renders two ways in two places
 * without being stored twice.
 */
export const blockFormatValidator = v.object({
  align: v.optional(
    v.union(v.literal("start"), v.literal("center"), v.literal("end"), v.literal("justify"))
  ),
  verticalAlign: v.optional(v.union(v.literal("top"), v.literal("middle"), v.literal("bottom"))),
  background: v.optional(v.string()),
  border: v.optional(
    v.object({
      color: v.string(),
      width: v.number(),
      style: v.union(v.literal("solid"), v.literal("dashed"), v.literal("dotted"))
    })
  ),
  padding: v.optional(v.object({ x: v.optional(v.number()), y: v.optional(v.number()) })),
  valueFormat: v.optional(v.string())
});

export type BlockFormat = Infer<typeof blockFormatValidator>;
