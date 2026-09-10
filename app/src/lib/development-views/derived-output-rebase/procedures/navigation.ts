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
    title: "The rebase landed; the contracts got stronger",
    lede:
      "All 41 source commits now sit on the certified main head. Seven conflict stops preserved both feature histories, then the repair pass made writes atomic, semantic work durable and process state server-owned."
  },
  {
    slug: "replay",
    index: "01",
    label: "Replay map",
    eyebrow: "Conflict procedure",
    title: "Seven stops preserved both architectures",
    lede:
      "Twenty-seven conflict occurrences touched twenty-six unique paths. This is the exact completed replay: what collided, which behavior survived, and the proof attached to each resolution."
  },
  {
    slug: "architecture",
    index: "02",
    label: "Runtime",
    eyebrow: "As-built architecture",
    title: "Commit facts first; derive them later",
    lede:
      "Every authored revision and its semantic intent now cross one transaction boundary. Durable jobs carry work across failure; server-owned flights only coordinate the work happening in this process."
  },
  {
    slug: "checkers",
    index: "03",
    label: "Proof",
    eyebrow: "Verification ledger",
    title: "Every non-browser gate is green",
    lede:
      "The resulting tree has no type diagnostics, no architecture findings, no failing unit or script tests, and no patch-hygiene defects. The ledger keeps both the initial diagnosis and its executed outcome."
  },
  {
    slug: "runbook",
    index: "04",
    label: "Runbook",
    eyebrow: "Recovery contract",
    title: "Repeat the proof without guessing",
    lede:
      "The completed operation remains reproducible: protect, replay, preserve current schema, stage semantic intent atomically, recover leases, verify server ownership, then run the gates."
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
