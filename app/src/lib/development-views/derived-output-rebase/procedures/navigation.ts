import type {
  RebasePage,
  RebasePageSlug
} from "$development-views/derived-output-rebase/types";

export const PAGES: readonly RebasePage[] = [
  {
    slug: "overview",
    index: "00",
    label: "Readiness",
    eyebrow: "Decision surface",
    title: "A rebase with eight deliberate stops",
    lede:
      "A disposable replay of all 40 audited branch commits onto main proves the path. The branch is not ready for an automatic rebase, but every conflict and every post-replay failure now has a bounded resolution."
  },
  {
    slug: "replay",
    index: "01",
    label: "Replay map",
    eyebrow: "Conflict procedure",
    title: "Replay the history; preserve both architectures",
    lede:
      "Eight commits stop. Twenty-eight conflict occurrences touch twenty-six unique paths. Each stop below records what collided, which behavior wins, and what must be proved before continuing."
  },
  {
    slug: "checkers",
    index: "02",
    label: "Checker map",
    eyebrow: "Evidence ledger",
    title: "Eighteen diagnostics collapse into four repairs",
    lede:
      "The architecture suite is already current. Its apparent failures are stale baseline records. Typecheck and Vitest are blocked by a small set of representation cutovers, not twenty-seven independent broken systems."
  },
  {
    slug: "runbook",
    index: "03",
    label: "Runbook",
    eyebrow: "Execution contract",
    title: "Rebase in gates, not in one leap",
    lede:
      "The runbook turns the audit into an ordered operation: protect the source, replay, resolve semantic decisions, adapt the current schema, reconcile the ratchet, and prove the integrated product."
  }
] as const;

export const pageOf = (slug: RebasePageSlug): RebasePage => {
  const page = PAGES.find((candidate) => candidate.slug === slug);
  if (page === undefined) throw new Error(`Unknown rebase reference page: ${slug}`);
  return page;
};

export const referenceRoot = (project: string): string =>
  `/demo/${project}/reference/derived-output-rebase`;

export const hrefOf = (root: string, page: RebasePage): string =>
  page.slug === "overview" ? root : `${root}/${page.slug}`;
