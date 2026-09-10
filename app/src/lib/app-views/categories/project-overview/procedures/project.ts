import type { ReadProjectOverviewResult } from "$capabilities/project/index.remote";

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
export const project = (
  id: string,
  row: ReadProjectOverviewResult | undefined
): ProjectHeader => {
  return {
    name: row?.projectId === id ? row.name : "…",
    description: row?.projectId === id ? row.description : ""
  };
};
