import { rowsIn } from "$app-views/categories/project-overview/procedures/rows";

export type ProjectHeader = {
  readonly name: string;
  readonly description: string;
};

/**
 * What the header says the project is.
 *
 * A name and a sentence, and both have a value before the read answers, because
 * the header is the first thing painted and a blank title reads as a broken page
 * rather than a loading one.
 */
export const project = (id: string): ProjectHeader => {
  const row = rowsIn("projects").find((candidate) => candidate._id === id);
  return {
    name: row?.name ?? "…",
    description: row?.description ?? ""
  };
};
