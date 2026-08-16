import { v, type Infer } from "convex/values";
import { documentBodyValidator, type DocumentBody } from "$documents/types/body";
import type { ResourceBody } from "$revisions/types/body";
import { slideDeckBodyValidator, type SlideDeckBody } from "$slide-decks/types/body";
import { spreadsheetBodyValidator, type SpreadsheetBody } from "$spreadsheets/types/body";

/**
 * A template's body is a real resource body with a label on it — the three
 * general resources' own validators, spread beside a `target` literal.
 *
 * **Spread rather than nested**, because the body *is* the thing it makes: a
 * template is authored in the ordinary editor, and a generic representation every
 * resource had to be projected into would need a converter per type and would
 * drift from what the resources actually store.
 *
 * `target` is here as well as on the row so the two cannot disagree — the row's
 * is written from this one, never accepted — and so a picker can list the
 * document templates without reading a body.
 *
 * `aspectRatio` rides on the slides member because a deck's shape is on its row
 * rather than in its body, so a slides template that did not carry one could not
 * say what shape of deck it makes.
 */
export const templateBodyValidator = v.union(
  v.object({ target: v.literal("document"), ...documentBodyValidator.fields }),
  v.object({
    target: v.literal("slides"),
    aspectRatio: v.union(v.literal("16:9"), v.literal("4:3")),
    ...slideDeckBodyValidator.fields
  }),
  v.object({ target: v.literal("spreadsheet"), ...spreadsheetBodyValidator.fields })
);

export type TemplateBody = Infer<typeof templateBodyValidator>;

/**
 * The resource body inside a template body: everything the label is not.
 *
 * The stripped fields are exactly the ones that live on the resource *row*
 * rather than in its body, so what is left is what a snapshot stores — which is
 * what makes instantiation a copy rather than a conversion.
 *
 * **Overloaded rather than generic**, so a caller that has narrowed the body gets
 * back the one resource body it can hand to that resource's `create`. A single
 * signature over the union would give every caller all three and put a cast at
 * each of them.
 */
export function resourceBodyOf(template: Extract<TemplateBody, { target: "document" }>): DocumentBody;
export function resourceBodyOf(template: Extract<TemplateBody, { target: "slides" }>): SlideDeckBody;
export function resourceBodyOf(
  template: Extract<TemplateBody, { target: "spreadsheet" }>
): SpreadsheetBody;
export function resourceBodyOf(template: TemplateBody): ResourceBody;
export function resourceBodyOf(template: TemplateBody): ResourceBody {
  if (template.target === "document") {
    const { target: _target, ...body } = template;
    return body;
  }
  if (template.target === "slides") {
    const { target: _target, aspectRatio: _aspectRatio, ...body } = template;
    return body;
  }
  const { target: _target, ...body } = template;
  return body;
}
