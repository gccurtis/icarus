import { v, type Infer } from "convex/values";
import { TemplatesError } from "$templates/errors";

/**
 * A named hole in a template's body.
 *
 * `key` is what the body's content carries, so a slot is matched to the place it
 * fills without the body pointing back at this list. `label` is what a person is
 * asked for.
 *
 * A `derived` slot is filled by generation rather than by anyone: its `prompt`
 * becomes a prompt block in the created resource, which is how a template says
 * "summarize the project's findings here" without knowing what they are.
 */
export const templateSlotValidator = v.object({
  key: v.string(),
  label: v.string(),
  kind: v.union(
    v.literal("text"),
    v.literal("image"),
    v.literal("data"),
    v.literal("derived")
  ),
  required: v.optional(v.boolean()),
  default: v.optional(v.string()),
  prompt: v.optional(v.string())
});

export type TemplateSlot = Infer<typeof templateSlotValidator>;

/**
 * The stored form of a slot list: keys distinct, and a prompt exactly where one
 * means something.
 *
 * **A key names one hole.** Two slots sharing one would make filling it ambiguous
 * in both directions — which value lands, and which slot a body's key refers to.
 *
 * **A prompt belongs to a `derived` slot and to no other kind.** Without one a
 * derived slot has nothing to generate from; with one a text slot carries an
 * instruction nothing will ever read, which is worse than absent because it looks
 * honoured.
 */
export const templateSlots = (slots: TemplateSlot[]): TemplateSlot[] => {
  const seen = new Set<string>();
  for (const slot of slots) {
    if (seen.has(slot.key)) {
      throw new TemplatesError("duplicate-slot-key", `Two slots claim the key '${slot.key}'`);
    }
    seen.add(slot.key);

    if (slot.kind === "derived" && slot.prompt === undefined) {
      throw new TemplatesError("slot-prompt", `The derived slot '${slot.key}' needs a prompt`);
    }
    if (slot.kind !== "derived" && slot.prompt !== undefined) {
      throw new TemplatesError("slot-prompt", `The ${slot.kind} slot '${slot.key}' is filled in, not generated`);
    }
  }
  return slots;
};
