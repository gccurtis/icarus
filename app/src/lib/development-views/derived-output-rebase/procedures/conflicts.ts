import type { ConflictCluster } from "$development-views/derived-output-rebase/types";

export const CONFLICTS: readonly ConflictCluster[] = [
  {
    stop: 1,
    commit: "177ab49",
    subject: "Design derived output runtime",
    files: ["app/package.json"],
    collision:
      "Main adds lodash and marked while the branch adds Mermaid. This is an additive dependency collision, not a product decision.",
    resolution:
      "Keep all three dependencies, then run pnpm install from app so pnpm-lock.yaml is generated from the resolved manifest instead of hand-merged.",
    proof: "pnpm install --frozen-lockfile succeeds from a fresh checkout after the new lockfile is committed.",
    risk: "low"
  },
  {
    stop: 2,
    commit: "22db654",
    subject: "Connect resources to derived outputs",
    files: [
      "app/src/lib/capabilities/project-resources/api/create-project-resource/create-project-resource.ts"
    ],
    collision:
      "Main makes document, slide and spreadsheet creation atomic. The branch publishes document and slide text to the Semantic Overlay after creation.",
    resolution:
      "Stage the represented resource and its semantic outbox row in the same unit of work. Commit no provider work there; a durable worker claims the job later. Preserve document, slide and spreadsheet creation as one atomic boundary.",
    proof:
      "Fault injection proves no partial resource, leader, snapshot or outbox row; restart recovery proves every committed resource leaves exactly one claimable semantic job.",
    risk: "high"
  },
  {
    stop: 3,
    commit: "0d96cb6",
    subject: "Ground editable prompt blocks",
    files: ["app/src/lib/app-views/categories/new-tab/content/launcher.svelte"],
    collision:
      "The branch edits the old inline document/slide creation handler. Main extracted createsEditorResource and added spreadsheets.",
    resolution:
      "Keep main's extracted procedure and its three-kind creation path. Do not restore the inline async handler; the branch behavior is already downstream of project-resource creation.",
    proof:
      "New Tab creates and opens documents, slide decks and spreadsheets; architecture lint reports no inline async-command-state finding.",
    risk: "medium"
  },
  {
    stop: 4,
    commit: "0b3cb66",
    subject: "Build the template system end to end",
    files: [
      "app/seed/documents.json",
      "app/seed/slideDecks.json",
      "app/seed/spreadsheets.json",
      "app/src/lib/capabilities/templates/api/instantiate-template/instantiate-template.ts",
      "app/src/lib/capabilities/templates/api/shared/bodies.ts",
      "app/src/lib/capabilities/templates/api/shared/validation.ts",
      "app/src/lib/capabilities/templates/templates.md",
      "app/src/lib/representation/store/tables.ts"
    ],
    collision:
      "The template feature introduces stages, scopes, prompt holes and multi-kind bodies over older document/slide/spreadsheet representations. Main independently makes instantiation atomic, advances the spreadsheet contracts, and adds summary/template metadata to represented resource rows and seed fixtures.",
    resolution:
      "Preserve branch template semantics and main's single transaction, including a semantic outbox row in that same commit. Keep summary and templateId fields and matching seed metadata, then port materialization to current document, slide and spreadsheet types without reviving a deleted normalizer.",
    proof:
      "Template unit and atomicity suites pass for all three resource kinds, including formatted spreadsheet cells and rules; a failed instantiation leaves no durable rows or semantic job.",
    risk: "high"
  },
  {
    stop: 5,
    commit: "deab480",
    subject: "Reconcile templates with derived outputs",
    files: [
      "app/configuration/architecture-baseline.json",
      "app/src/lib/capabilities/capabilities.md",
      "app/src/routes/demo/[project]/reference/+layout.svelte",
      "app/src/routes/demo/[project]/reference/formulas/+page.svelte",
      "app/src/routes/demo/[project]/reference/formulas/built/+page.svelte",
      "app/src/routes/demo/[project]/reference/formulas/changes/+page.svelte",
      "app/src/routes/demo/[project]/reference/formulas/errors/+page.svelte",
      "app/src/routes/demo/[project]/reference/formulas/references/+page.svelte",
      "app/src/routes/demo/[project]/reference/formulas/slicing/+page.svelte",
      "app/src/routes/demo/[project]/reference/formulas/values/+page.svelte",
      "app/src/routes/demo/[project]/reference/variables/+page.svelte"
    ],
    collision:
      "Main adds formula and variable references under production /app routes. The branch has moved reference material under /demo, adds capabilities, and carries its own debt baseline.",
    resolution:
      "Accept Git's relocation of formula and variable pages into /demo; union the capability inventory; replay the baseline source, then remove only records the resulting tree proves stale. Do not choose either baseline wholesale.",
    proof:
      "All reference links resolve under /demo, production surfaces import no development view, capabilities.md matches the graph, and pnpm lint reports 90 clean checks with zero findings.",
    risk: "high"
  },
  {
    stop: 6,
    commit: "2aaad1e",
    subject: "Build Explore end to end",
    files: [
      "app/seed/researchThreads.json",
      "app/src/lib/app-views/categories/project-overview/content/overview.svelte",
      "app/src/lib/app-views/categories/project-overview/procedures/opening.ts"
    ],
    collision:
      "Main adds spreadsheet creation/opening, project-scoped context and inspector selection keys, and summarized research fixtures while the branch adds research chat creation and its richer seeded thread set to the same Project Overview flow.",
    resolution:
      "Model document, slides, spreadsheet and research as one creation union. Route spreadsheet to spreadsheet-editor and research to research.thread; preserve project-overview.comment/activity inspection keys; union the research seed rows while retaining main's summary fields and the branch's current structured ResearchMode values.",
    proof:
      "The overview can create and open all four kinds and disables every competing creation affordance while one async command is active.",
    risk: "medium"
  },
  {
    stop: 7,
    commit: "f85b245",
    subject: "Work every finding off the baseline",
    files: [
      "app/src/lib/app-views/categories/project-overview/content/overview.svelte",
      "app/src/lib/model/client/workspace-state/definition.svelte.ts"
    ],
    collision:
      "The agents refactor extracts OverviewState and makeResource while current main carries spreadsheet runtime ownership plus the newly delivered Project Overview context/inspector contracts. Its mechanical state rename also leaked into non-state literals (the kind sort key, feed CSS class and visible ‘Here now’ copy). Workspace state gains agent draft methods on one side and spreadsheetRuntime on the other.",
    resolution:
      "Keep the extracted overview state/procedure architecture, extend its creation type and dispatcher for spreadsheets, and preserve the project-overview.comment/activity inspection targets that feed main's new panels. Limit board.* changes to actual state reads: retain the literal sort value ‘kind’, CSS class ‘feed’, and visible ‘Here now’ text. In workspace state, retain spreadsheetRuntime together with draft and keepDraft.",
    proof:
      "Overview state tests cover four kinds; kind sorting resolves a DIRECTION entry; Review retains its bounded feed styling; panel selections open; workspace lifecycle tests balance document/slide/spreadsheet runtimes; architecture lint requires no new exception.",
    risk: "high"
  }
] as const;

export const ROUTE_RELOCATIONS = [
  "reference/+layout.svelte",
  "reference/formulas/+page.svelte",
  "reference/formulas/built/+page.svelte",
  "reference/formulas/changes/+page.svelte",
  "reference/formulas/errors/+page.svelte",
  "reference/formulas/references/+page.svelte",
  "reference/formulas/slicing/+page.svelte",
  "reference/formulas/values/+page.svelte",
  "reference/variables/+page.svelte"
] as const;
