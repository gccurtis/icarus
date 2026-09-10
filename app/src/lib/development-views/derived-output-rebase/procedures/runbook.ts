import type { RunbookPhase } from "$development-views/derived-output-rebase/types";

export const RUNBOOK: readonly RunbookPhase[] = [
  {
    id: "R0",
    title: "Recertify and protect",
    intent: "Make the live operation reproducible before history changes.",
    actions: [
      "Require a clean work/derived-output-architecture worktree.",
      "Fetch main and compare its head with this audit's 06708d9 snapshot.",
      "If main moved, rerun the disposable replay; do not assume this conflict map is still exhaustive.",
      "Create a named backup branch at the exact audited source head 7211f1c."
    ],
    files: ["No source files"],
    gates: ["git status is clean", "source and target SHAs are recorded", "backup ref resolves to source HEAD"],
    rollback: "Reset by switching back to the protected branch; no rewritten commit is the only copy."
  },
  {
    id: "R1",
    title: "Begin the replay",
    intent: "Replay the 41 audited source-only commits onto the certified main head.",
    actions: [
      "Run git rebase main from work/derived-output-architecture.",
      "Resolve only the seven expected stop commits in order.",
      "At every stop, inspect all unmerged paths before staging; an unexpected path invalidates the map and pauses the rebase."
    ],
    files: ["41 commits", "7 expected stops", "26 unique conflict paths"],
    gates: ["git diff --name-only --diff-filter=U matches the stop ledger", "no conflict marker remains"],
    rollback: "git rebase --abort returns to the protected source head."
  },
  {
    id: "R2",
    title: "Resolve creation and dependency seams",
    intent: "Keep main's atomic boundaries while making semantic intent part of the same commit.",
    actions: [
      "Union package dependencies and regenerate the lockfile.",
      "Stage created resources and their semantic outbox rows in one project-resource transaction.",
      "Keep embedding and descriptor provider work outside that transaction; a durable worker claims it later.",
      "Keep New Tab on createsEditorResource, including spreadsheet support."
    ],
    files: [
      "app/package.json",
      "project-resources/.../create-project-resource.ts",
      "new-tab/content/launcher.svelte"
    ],
    gates: ["dependency install is reproducible", "resource creation atomicity", "committed revisions always include their outbox intent"],
    rollback: "Abort the rebase; no compatibility shim should be committed outside these boundaries."
  },
  {
    id: "R3",
    title: "Resolve templates, references and baseline source",
    intent: "Join feature semantics with current durability and route ownership.",
    actions: [
      "Preserve template stages, scopes and holes while retaining atomic instantiation and semantic outbox writes.",
      "Union templateStages, project-scoped template metadata, named/bound resource sets, and main's resource summary/template fields in the table schema.",
      "Move formula and variable reference routes under /demo with the other development references.",
      "Union capabilities.md; never select one inventory side wholesale.",
      "Carry a syntactically valid baseline through the replay, but postpone stale-entry deletion until the resulting tree can be linted."
    ],
    files: ["templates capability", "resource/seed schema", "capabilities.md", "architecture-baseline.json", "9 reference route paths"],
    gates: ["template writes remain one unit of work", "production /app imports no development view", "baseline JSON parses"],
    rollback: "Abort and replay the stop; do not patch over a half-atomic template path."
  },
  {
    id: "R4",
    title: "Resolve the overview and workspace state",
    intent: "Compose research and agent work with main's spreadsheet runtime.",
    actions: [
      "Keep the extracted OverviewState and makeResource procedure.",
      "Extend creation to document, slides, spreadsheet and research.",
      "Map spreadsheet to spreadsheet-editor and research to research.thread.",
      "Keep project-overview.comment and project-overview.activity selections wired to main's delivered inspectors.",
      "Union research fixtures without discarding summary fields or structured ResearchMode values.",
      "Retain spreadsheetRuntime, draft and keepDraft on workspace state."
    ],
    files: ["project-overview/content/overview.svelte", "project-overview/procedures/opening.ts", "workspace-state/definition.svelte.ts"],
    gates: ["all four resource kinds create and open", "async creation is single-owner", "runtime lifecycle is balanced"],
    rollback: "Revisit the two stop commits together; they touch the same overview behavior at different architectural stages."
  },
  {
    id: "R5",
    title: "Adapt to the current representation",
    intent: "Finish the intentional one-schema cutover rather than restoring compatibility debt.",
    actions: [
      "Replace slide normalizer imports with ensureSlideDeckReady from slide-decks/readiness.",
      "Remove document typography normalization from template instantiation.",
      "Port TemplateCell and format rules to CellFormat, per-side borders and stable IDs.",
      "Type the project-resource transaction result so accepted remains the literal true."
    ],
    files: ["7 typecheck files", "4 root implementation seams"],
    gates: ["pnpm typecheck is clean", "no legacy reader is reintroduced", "targeted representation tests pass"],
    rollback: "Revert the individual adapter commit, not the rebase; each root repair should be its own reviewable commit."
  },
  {
    id: "R6",
    title: "Reconcile the ratchet and generated artifact",
    intent: "Let the resulting source graph dictate debt and generated text.",
    actions: [
      "Run architecture lint and remove the exact 28 stale records it reports.",
      "Update the baseline script's state-ownership expectation from 20 to the proven 18.",
      "Regenerate or mechanically clean the template-features artifact until git diff --check is empty.",
      "Do not add a baseline entry for any new integration finding."
    ],
    files: ["architecture-baseline.json", "scripts/test/baseline.test.mjs", "docs/artifacts/template-features-changes/index.md"],
    gates: ["90 checks · 90 clean · 0 findings", "pnpm test:scripts passes", "git diff --check is empty"],
    rollback: "Restore only the baseline/artifact commit and regenerate from the verified source tree."
  },
  {
    id: "R7",
    title: "Prove the integrated product",
    intent: "Turn a compile-clean replay into a release-quality branch.",
    actions: [
      "Run typecheck, architecture lint, script tests, Vitest and production build.",
      "Run targeted browser coverage for New Tab, Project Overview, prompt blocks and template instantiation.",
      "Manually verify all /demo reference routes in Helios and Selene.",
      "Review the final range diff against main, with special attention to transactions and server-side semantic jobs."
    ],
    files: ["Integrated tree"],
    gates: ["all automated commands pass", "targeted browser matrix passes", "human diff review signs off"],
    rollback: "Fix forward in bounded commits or return to the protected branch; do not force-push an unproved replay."
  }
] as const;

export const COMMANDS = [
  ["Snapshot", "git status --short --branch"],
  ["Fetch target", "git fetch origin main"],
  ["Recertify", "git rev-parse main origin/main"],
  ["Protect", "git branch backup/derived-output-architecture-pre-rebase-06708d9"],
  ["Replay", "git rebase main"],
  ["Dependencies", "pnpm --dir app install"],
  ["Representation", "pnpm --dir app typecheck"],
  ["Architecture", "pnpm --dir app lint"],
  ["Checker tests", "pnpm --dir app test:scripts"],
  ["Behavior", "pnpm --dir app test"],
  ["Production", "pnpm --dir app build"],
  ["Browser", "pnpm --dir app test:browser"],
  ["Patch hygiene", "git diff --check main..HEAD"]
] as const;

export const ACCEPTANCE = [
  "No unmerged paths, conflict markers, or unexpected empty commits.",
  "No deleted legacy schema reader is recreated or imported.",
  "Every committed document, slide, spreadsheet material, project creation and template instance carries its semantic outbox intent atomically.",
  "Provider work happens only after commit through bounded, leased queue workers.",
  "Document, slide, spreadsheet and research entry points all remain reachable.",
  "Derived-output and research readers see current slide bodies with typed locators.",
  "Architecture lint remains 90/90 with zero unbaselined or stale findings.",
  "Typecheck, script tests, Vitest, production build, browser tests and diff-check all pass."
] as const;
