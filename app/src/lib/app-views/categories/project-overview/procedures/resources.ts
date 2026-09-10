import {
  createProjectResource as createProjectResourceRemote,
  readProjectResourceIndex,
  type CreateProjectResourceInput,
  type ProjectResourceIndex
} from "$capabilities/project-resources/index.remote";
import { since } from "$app-views/categories/project-overview/procedures/rows";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

/**
 * What a project holds, as the board draws it.
 *
 * This projection-specific closed union names every kind the board can draw —
 * a label, a plural, an icon, and a hue. Representation's separate persisted
 * resource identity vocabulary is also closed, and does not flow through this
 * view-only taxonomy.
 */
export const RESOURCE_KINDS = [
  "document",
  "slides",
  "spreadsheet",
  "research",
  "analysis",
  "file",
  "finding"
] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];

/**
 * A row of the project table.
 *
 * `updated` and `updatedAt` are the same fact twice, on purpose: the cell reads
 * the prose and the sort reads the number. Deriving one from the other at the
 * point of use would mean parsing "4 minutes ago" back into a duration, which is
 * what this board did before it had a store to ask.
 */
export type Resource = {
  readonly id: string;
  readonly kind: ResourceKind;
  readonly name: string;
  readonly updated: string;
  readonly updatedAt: number;
  readonly updatedBy: string;
};

/** Create once even when another project surface makes the same pending request. */
export const createProjectResource = (
  view: WorkspaceStateModel,
  input: CreateProjectResourceInput
) => {
  return view.singleFlight(
    [
      "project-resource",
      view.project,
      "create",
      input.target,
      input.title?.trim() ?? null
    ],
    async () => {
      return createProjectResourceRemote(input).updates(readProjectResourceIndex);
    }
  );
};

export const resourcesIn = (
  indexed: ProjectResourceIndex | undefined,
  now: number
): readonly Resource[] =>
  (indexed?.resources ?? []).map((row) => ({
    ...row,
    updated: since(row.updatedAt, now),
    updatedBy: row.updatedByName ?? "—"
  }));
