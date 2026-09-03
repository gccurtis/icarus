import type { Inspected, Selection } from "$model/client/workspace-state";
import type { Resource, ResourceKind } from "$app-views/categories/project-overview/procedures/resources";

/**
 * Which lens answers for a row, and what it is about.
 *
 * A key and a selection, never a call. Deciding what to read and opening it are
 * separate acts, so this hands back both halves and the caller performs them —
 * which is what lets a row be selected without being opened.
 *
 * Three of the ten kinds have a lens of their own; the rest share the resource
 * lens, because what a person asks of a row they have merely clicked is the same
 * question whatever it holds.
 */
const LENS: Partial<Record<ResourceKind, Inspected>> = {
  file: "project-overview.file",
  connector: "project-overview.connector"
};

export const inspectionFor = ({
  kind,
  id
}: Resource): { readonly key: Inspected; readonly selection: Selection } => ({
  key: LENS[kind] ?? "project-overview.resource",
  selection: { kind, id }
});
