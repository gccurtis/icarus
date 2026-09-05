import {
  readTemplateLibrary,
  type ReadTemplateLibraryResult,
  type TemplateLibraryItem
} from "$capabilities/templates/index.remote";

export type NewTabTemplate = {
  readonly id: string;
  readonly name: string;
  readonly makes: "Document" | "Slide deck" | "Spreadsheet";
  readonly scope: "Project" | "Shared" | "Personal";
  readonly variableCount: number;
  readonly updated: string;
  readonly createdBy: string;
};

const TARGET = {
  document: "Document",
  slides: "Slide deck",
  spreadsheet: "Spreadsheet"
} as const satisfies Record<TemplateLibraryItem["target"], NewTabTemplate["makes"]>;

const SCOPE = {
  project: "Project",
  shared: "Shared",
  personal: "Personal"
} as const satisfies Record<TemplateLibraryItem["availability"], NewTabTemplate["scope"]>;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const relativeTime = (at: number, now: number): string => {
  const gap = Math.max(0, now - at);
  if (gap < MINUTE) return "just now";
  if (gap < HOUR) {
    const minutes = Math.max(1, Math.round(gap / MINUTE));
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (gap < DAY) {
    const hours = Math.max(1, Math.round(gap / HOUR));
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (gap < 2 * DAY) return "yesterday";
  if (gap < 30 * DAY) return `${Math.round(gap / DAY)} days ago`;
  return new Date(at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

/** The same scoped Template query used by the library, projected for New Tab cards. */
export const templateLibrary = () => readTemplateLibrary();

export const templatesIn = (
  answer: ReadTemplateLibraryResult | undefined,
  now: number
): readonly NewTabTemplate[] =>
  answer?.templates.map((row) => ({
    id: row.id,
    name: row.name,
    makes: TARGET[row.target],
    scope: SCOPE[row.availability],
    variableCount: row.variableCount,
    updated: relativeTime(row.updatedAt, now),
    createdBy: row.createdByName
  })) ?? [];
