import type { AreaSlug } from "$development-views/document-editor-reference/types";

export const REFERENCE_ROOT = "/demo/document-editor-reference";

export const REFERENCE_NAV: { slug: "overview" | AreaSlug | "ledger"; label: string; index: string; href: string }[] = [
  { slug: "overview", label: "Overview", index: "00", href: REFERENCE_ROOT },
  { slug: "context", label: "Context", index: "01", href: `${REFERENCE_ROOT}/context` },
  { slug: "inspector", label: "Inspector", index: "02", href: `${REFERENCE_ROOT}/inspector` },
  { slug: "content", label: "Content", index: "03", href: `${REFERENCE_ROOT}/content` },
  { slug: "runtime", label: "Runtime", index: "04", href: `${REFERENCE_ROOT}/runtime` },
  { slug: "backend", label: "Backend", index: "05", href: `${REFERENCE_ROOT}/backend` },
  { slug: "ledger", label: "File ledger", index: "06", href: `${REFERENCE_ROOT}/ledger` }
];

export const AREA_LABELS: Record<AreaSlug | "cross-cutting" | "evidence", string> = {
  context: "Context panel",
  inspector: "Inspector panel",
  content: "Content surface",
  runtime: "Runtime",
  backend: "Backend",
  "cross-cutting": "Cross-cutting",
  evidence: "Evidence & reference"
};
