import type { InspectionKey } from "$model/client";

/**
 * The inspection vocabulary, and how a key is routed.
 *
 * **The keys live here rather than in the model**, exactly as the context rail's
 * do. The workbench remembers one label per tab and never interprets it; what
 * the labels are, and what each renders as, belong to the panel that renders
 * them. That is what stops a model type growing a member every time a surface
 * gains something worth inspecting.
 *
 * A key is namespaced — `family.member` — and the family is what decides which
 * component renders it. The member narrows within that.
 *
 * | Family | Detail comes from |
 * | --- | --- |
 * | `block` | the active tab's view state — a selection, an anchor |
 * | `document` | the active tab's view state |
 * | `copilot` | the copilot object, since a conversation belongs to no tab |
 *
 * **The key carries no payload**, which is the design the model states: a
 * payload would be a second record of what the user has selected, beside the one
 * already in view state. So the panel reads the label, then reads the detail
 * from wherever that family's detail lives.
 */
export const INSPECTION_KEYS = [
  "block.next-text",
  "block.text-selection",
  "block.image",
  "block.table",
  "document.settings",
  "document.page",
  "copilot.home",
  "copilot.persona-thread",
  "copilot.tool-call"
] as const;

/** The part before the dot: which surface's detail the key points into. */
export type InspectionFamily = "block" | "document" | "copilot";

/**
 * The family a key belongs to, or `undefined` for one this panel cannot route.
 *
 * Undefined rather than a throw. A key is a string the model never validated —
 * that is the trade for the model not owning this vocabulary — so an unknown one
 * is a case this panel handles rather than a defect it reports. It renders as
 * "no view for this yet", which is the honest thing to say about a label some
 * surface produced and nothing here understands.
 */
export const familyOf = (key: InspectionKey): InspectionFamily | undefined => {
  const family = key.split(".")[0];

  return family === "block" || family === "document" || family === "copilot" ? family : undefined;
};
