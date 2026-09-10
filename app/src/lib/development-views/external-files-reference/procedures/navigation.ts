import type { ReferenceSlug } from "$development-views/external-files-reference/types";

export const EXTERNAL_FILE_REFERENCE_NAV: readonly {
  slug: ReferenceSlug;
  index: string;
  label: string;
  href: string;
}[] = [
  { slug: "overview", index: "00", label: "System", href: "/demo/external-files" },
  { slug: "ingestion", index: "01", label: "Ingestion", href: "/demo/external-files/ingestion" },
  { slug: "stable-tab", index: "02", label: "External library", href: "/demo/external-files/stable-tab" },
  { slug: "file-plan", index: "03", label: "File map", href: "/demo/external-files/file-plan" },
  { slug: "implementation", index: "04", label: "Implementation", href: "/demo/external-files/implementation" },
  { slug: "integration", index: "05", label: "Integration audit", href: "/demo/external-files/integration" }
] as const;
