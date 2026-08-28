/**
 * What the thing behind an id is called.
 *
 * A door rather than display copy, because it is a question about data: two
 * surfaces ask it — the tab strip naming a tab, the status bar naming what is on
 * the plane — and a view reaching into another view's procedures to get the
 * answer would make one of them the owner of a fact that belongs to neither.
 *
 * **Every table is consulted in turn.** An id is unique across the project and a
 * caller holding one does not know which table its subject came from; a tab
 * carrying a thread id and a tab carrying a document id are the same shape.
 *
 * ── FORWARD DECLARATION ────────────────────────────────────────────────────
 * The real form is one query against the metadata row every resource carries:
 *
 * ```ts
 * const { name, kind } = await resources.get(id);
 * ```
 *
 * A title lives beside the body rather than inside it, so this becomes an
 * ordinary read the day the table answers, and the fan-out below collapses.
 */
import { RESOURCES, type ResourceKind } from "$capabilities/cast";
import { analyses, templates, threads } from "$capabilities/library";
import { read, type Read } from "$capabilities/read.svelte";

/** A thing named, and what kind of thing it is where that is known. */
export type Subject = {
  readonly name: string;
  readonly kind?: ResourceKind;
};

const lookup = (id: string): Subject => {
  const resource = RESOURCES.find((row) => row.id === id);
  if (resource) return { name: resource.name, kind: resource.kind };

  const thread = threads().current.find((row) => row.id === id);
  if (thread) return { name: thread.title, kind: "research" };

  const analysis = analyses().current.find((row) => row.id === id);
  if (analysis) return { name: analysis.name, kind: "analysis" };

  const template = templates().current.find((row) => row.id === id);
  if (template) return { name: template.name, kind: "template" };

  // The id itself, never a blank. A strip entry or a status line with no words
  // is unreadable, and an id at least tells two similar tabs apart.
  return { name: id };
};

export const subject = (id: string): Read<Subject> => read(lookup(id), "naming.subject");

/**
 * The name alone, without a handle.
 *
 * The tab strip needs it inside a label function that is called for every tab on
 * every frame, which is not a place to open a read handle.
 */
export const nameOf = (id: string): string => lookup(id).name;
