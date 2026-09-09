export type ReferencePage = {
  slug: "system" | "changes" | "scope" | "integration" | "rebase" | "walkthrough";
  index: string;
  label: string;
  sub: string;
};

export const PAGES: ReferencePage[] = [
  { slug: "system", index: "01", label: "How templates work", sub: "The model, the verbs, the panels" },
  { slug: "changes", index: "02", label: "What changed", sub: "Every file, decision and check" },
  { slug: "scope", index: "03", label: "What a hole selects", sub: "The scope builder, and what it cost" },
  { slug: "integration", index: "04", label: "End to end with prompts", sub: "Every link, and the rule behind it" },
  { slug: "rebase", index: "05", label: "Where it meets the base", sub: "Every conflict, every defect" },
  { slug: "walkthrough", index: "06", label: "Walk it yourself", sub: "The whole design, driven" }
];

const PATHS: Record<ReferencePage["slug"], string> = {
  system: "",
  changes: "/changes",
  scope: "/scope",
  integration: "/integration",
  rebase: "/rebase",
  walkthrough: "/walkthrough"
};

export const hrefOf = (project: string, slug: ReferencePage["slug"]): string =>
  `/app/${project}/reference/templates${PATHS[slug]}`;
