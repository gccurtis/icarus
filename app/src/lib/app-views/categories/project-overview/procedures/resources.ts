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
  "finding",
  "connector",
  "context",
  "template"
] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];

/** A row of the project table: what it is, what it is called, and who touched it. */
export type Resource = {
  readonly id: string;
  readonly kind: ResourceKind;
  readonly name: string;
  readonly updated: string;
  readonly updatedBy: string;
};
