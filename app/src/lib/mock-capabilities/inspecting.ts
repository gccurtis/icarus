/**
 * Which lens answers for a thing, and what that lens is about.
 *
 * The third of the id doors, beside [`naming`](naming.ts) — what an id is
 * called — and [`opening`](opening.ts) — where it opens. This one answers the
 * question a selection asks: something has been picked out of a list, so which
 * panel knows how to read it, and under which id.
 *
 * **A key and a selection, never a call.** The inspector is driven by a key
 * naming a file and a selection saying what that file is about, and the two are
 * set together or not at all. Handing back both lets a caller ask what would be
 * inspected without inspecting it — which is what the work table does to decide
 * whether a row is the selected one.
 *
 * **The kind decides the lens, and the lens decides the id space.** A finding is
 * `f-saidi` to the research tables and `r-saidi` to the project's; a thread is
 * `th-feeder` and `r-feeder`. The row a person clicked carries the project's id,
 * so the join is made here rather than inside two lenses that would each then
 * have to accept either space and neither would be the owner of the rule.
 *
 * **Everything else is the general lens.** A document, a deck, a spreadsheet, an
 * analysis and a template are all identity-and-relationships questions, and one
 * panel answers them; the five below get their own because what there is to say
 * about a file, a finding, a thread, a connector or a Context is not that shape.
 */
import type { ResourceKind } from "$mock-capabilities/cast";
import { findingFor, threadFor } from "$mock-capabilities/joins";
import type { InspectionKey, Selection } from "$model/client/view-state";

/** A lens, and what it is about. Exactly the pair `inspect` takes. */
export type Inspection = {
  readonly key: InspectionKey;
  readonly selection: Selection;
};

/**
 * The kinds whose id is already the lens's own, so no join is needed. A file is
 * a resource row and the file lens reads resource rows; a connector and a
 * Context are keyed by the id they were given everywhere they appear.
 */
const OWN_ID: Partial<Record<ResourceKind, InspectionKey>> = {
  file: "project.file",
  connector: "project.connector",
  context: "scope.context"
};

export const inspectionFor = (
  kind: ResourceKind,
  id: string,
  name: string = id
): Inspection => {
  // The two that live in the research tables under an id of their own.
  if (kind === "research") {
    return {
      key: "research.research-thread",
      selection: { kind: "thread", id: threadFor(name) ?? id }
    };
  }
  if (kind === "finding") {
    return {
      key: "research.accepted-finding",
      selection: { kind: "finding", id: findingFor(name) ?? id }
    };
  }

  const own = OWN_ID[kind];
  if (own) return { key: own, selection: { kind, id } };

  return { key: "project.resource", selection: { kind: "resource", id } };
};
