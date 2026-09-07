import type { NavItem, PageSlug } from "$development-views/formula-language-reference/types";

export const NAV: readonly NavItem[] = [
  { slug: "overview", index: "00", label: "Overview", href: "/app/dev-project/reference/formulas" },
  { slug: "values", index: "01", label: "Values", href: "/app/dev-project/reference/formulas/values" },
  { slug: "slicing", index: "02", label: "Slicing", href: "/app/dev-project/reference/formulas/slicing" },
  { slug: "references", index: "03", label: "References", href: "/app/dev-project/reference/formulas/references" },
  { slug: "errors", index: "04", label: "Errors", href: "/app/dev-project/reference/formulas/errors" },
  { slug: "built", index: "05", label: "As built", href: "/app/dev-project/reference/formulas/built" },
  { slug: "variables", index: "06", label: "Variables", href: "/app/dev-project/reference/variables" },
  { slug: "changes", index: "07", label: "The build", href: "/app/dev-project/reference/formulas/changes" }
];

const tailOf = (path: string): string | null => {
  const at = path.indexOf("/reference/");
  return at === -1 ? null : path.slice(at).replace(/\/+$/, "");
};

export const slugOf = (pathname: string): PageSlug | null => {
  const tail = tailOf(pathname);
  if (!tail) return null;
  return NAV.find((item) => tailOf(item.href) === tail)?.slug ?? null;
};
