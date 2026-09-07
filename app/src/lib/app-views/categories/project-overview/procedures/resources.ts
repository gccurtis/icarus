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
 * A closed union rather than `representation`'s open `ResourceKind`, which is a
 * string so that a subkind can be minted without a migration. The board has to
 * name every kind it draws — a label, a plural, an icon, a hue — so a kind added
 * to this list without a name beside it is a build error rather than a blank
 * cell and an option nobody can read.
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
  const table = view.readStore(input.target === "document" ? "documents" : "slideDecks");
  return view.singleFlight(
    [
      "project-resource",
      view.project,
      "create",
      input.target,
      input.title?.trim() ?? null
    ],
    async () => {
      const result = await createProjectResourceRemote(input).updates(readProjectResourceIndex);
      // This table query may be warm but unmounted while Overview is active.
      // Refresh it explicitly before the editor and tab bar consume its title.
      await table.refresh();
      return result;
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
    updatedBy: row.updatedByName
  }));

export const resources = (projectId: string, now: number): readonly Resource[] => {
  const indexed = readProjectResourceIndex();
  // Other board projections still take the represented project id. This
  // resource query has already enforced it at the server boundary.
  void projectId;
  return resourcesIn(indexed.ready ? indexed.current : undefined, now);
};

/** What a row is called, for the places that hold an id and want a name. */
export const nameOf = (projectId: string, id: string, now: number): string =>
  resources(projectId, now).find((row) => row.id === id)?.name ?? id;

/** The threads Create lands on when it cannot mint one. */
export const threads = (projectId: string, now: number): readonly Resource[] =>
  resources(projectId, now).filter((row) => row.kind === "research");

/** Empty, and honestly so — see `resources` above. */
export const analyses = (projectId: string, now: number): readonly Resource[] =>
  resources(projectId, now).filter((row) => row.kind === "analysis");
