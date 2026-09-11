import type {
  LibraryTemplate,
  TemplateLibrarySummary,
  TemplateTarget
} from "$app-views/categories/templates/procedures/library-types";

export const templateLibrarySummaryIn = (
  rows: readonly LibraryTemplate[]
): TemplateLibrarySummary => {
  const count = (predicate: (row: LibraryTemplate) => boolean): number =>
    rows.filter(predicate).length;
  return {
    total: rows.length,
    project: count((row) => row.scope === "Project"),
    personal: count((row) => row.scope === "Personal"),
    documents: count((row) => row.makes === "Document"),
    presentations: count((row) => row.makes === "Presentation"),
    spreadsheets: count((row) => row.makes === "Spreadsheet")
  };
};

const defaultName = (target: TemplateTarget): string =>
  ({
    Document: "Untitled document template",
    "Presentation": "Untitled presentation template",
    Spreadsheet: "Untitled spreadsheet template"
  })[target];

export const nextTemplateName = (
  target: TemplateTarget,
  rows: readonly LibraryTemplate[]
): string => {
  const base = defaultName(target);
  const taken = new Set(rows.map((row) => row.name.toLocaleLowerCase()));
  let suffix = 1;
  while (taken.has(`${base} ${suffix}`.toLocaleLowerCase())) suffix += 1;
  return `${base} ${suffix}`;
};
