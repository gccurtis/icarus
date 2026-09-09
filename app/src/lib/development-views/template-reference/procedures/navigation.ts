export type ReferencePage = {
  slug: "system" | "changes" | "scope" | "integration" | "rebase";
  index: string;
  label: string;
  sub: string;
};

export const PAGES: ReferencePage[] = [
  { slug: "system", index: "01", label: "How templates work", sub: "The model, the verbs, the panels" },
  { slug: "changes", index: "02", label: "What changed", sub: "Every file, decision and check" },
  { slug: "scope", index: "03", label: "What a hole selects", sub: "The scope builder, and what it cost" },
  { slug: "integration", index: "04", label: "End to end with prompts", sub: "The chain, and the one open link" },
  { slug: "rebase", index: "05", label: "Where it meets the base", sub: "Every conflict, every defect" }
];

const PATHS: Record<ReferencePage["slug"], string> = {
  system: "",
  changes: "/changes",
  scope: "/scope",
  integration: "/integration",
  rebase: "/rebase"
};

export const hrefOf = (project: string, slug: ReferencePage["slug"]): string =>
  `/app/${project}/reference/templates${PATHS[slug]}`;
