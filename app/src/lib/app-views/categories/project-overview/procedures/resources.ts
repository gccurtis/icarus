import type { Actor } from "$representation/data/types/core/actor";
import { actorName } from "$app-views/categories/project-overview/procedures/actor-name";
import { rowsIn, since } from "$app-views/categories/project-overview/procedures/rows";

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

const by = (actor: Actor | undefined): string =>
  actor === undefined ? "—" : actorName(actor);

export const resources = (projectId: string, now: number): readonly Resource[] => {
  const mine = <T extends { projectId: string }>(rows: readonly T[]): readonly T[] =>
    rows.filter((row) => row.projectId === projectId);

  const made = (
    id: string,
    kind: ResourceKind,
    name: string,
    updatedAt: number,
    actor: Actor | undefined
  ): Resource => ({ id, kind, name, updated: since(updatedAt, now), updatedAt, updatedBy: by(actor) });

  return [
    ...mine(rowsIn("documents")).map((row) =>
      made(row._id, "document", row.title, row.updatedAt, row.updatedBy)
    ),
    ...mine(rowsIn("slideDecks")).map((row) =>
      made(row._id, "slides", row.title, row.updatedAt, row.updatedBy)
    ),
    ...mine(rowsIn("spreadsheets")).map((row) =>
      made(row._id, "spreadsheet", row.title, row.updatedAt, row.updatedBy)
    ),
    ...mine(rowsIn("researchThreads")).map((row) =>
      made(row._id, "research", row.title, row.updatedAt, row.createdBy)
    ),
    ...mine(rowsIn("externalFiles")).map((row) =>
      made(row._id, "file", row.name, row.updatedAt, row.createdBy)
    ),
    ...mine(rowsIn("findings")).map((row) =>
      made(row._id, "finding", row.title, row.updatedAt, row.updatedBy)
    )
  ];
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
