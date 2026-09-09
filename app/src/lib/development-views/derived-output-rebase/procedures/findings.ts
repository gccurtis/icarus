import type { FindingGroup } from "$development-views/derived-output-rebase/types";

export const TYPE_FINDINGS: readonly FindingGroup[] = [
  {
    title: "Slide schema cutover",
    count: 14,
    files: [
      "semantic-overlay/api/shared/resource.ts",
      "templates/api/shared/validation.ts",
      "templates/api/instantiate-template/instantiate-template.ts",
      "derived-output/api/shared/resource-reading.ts",
      "research-chat/api/shared/reading-tools.ts"
    ],
    cause:
      "Five imports still target the deleted slide-decks/normalize module. Losing its return type then produces nine implicit-any diagnostics in readers.",
    repair:
      "Import ensureSlideDeckReady from slide-decks/readiness. Let its SlideDeckBody return type repair the nine cascades; do not annotate callbacks with any.",
    verification:
      "Slide readiness tests plus semantic, template, derived-output and research reader suites all load and pass."
  },
  {
    title: "Document schema cutover",
    count: 1,
    files: ["templates/api/instantiate-template/instantiate-template.ts"],
    cause:
      "Template instantiation imports normalizeDocumentStyleSet from the deliberately removed documents/typography compatibility reader.",
    repair:
      "Treat the current document body as authoritative. Remove legacy ratio/style normalization instead of recreating the adapter.",
    verification: "Document template materialization passes with current styles and no legacy-schema lint finding."
  },
  {
    title: "Spreadsheet template drift",
    count: 2,
    files: ["templates/api/shared/bodies.ts"],
    cause:
      "TemplateCell still carries BlockFormat, while SheetCell expects CellFormat; materialized format rules also lack the now-required id.",
    repair:
      "Admit or migrate CellFormat at the template boundary, map borders per side, and mint stable rule IDs. Never cast BlockFormat into CellFormat.",
    verification:
      "Add round-trip tests for formatted cells, per-side borders and deterministic rule IDs, then run spreadsheet and template suites."
  },
  {
    title: "Transaction result widening",
    count: 1,
    files: ["project-resources/api/create-project-resource/create-project-resource.ts"],
    cause:
      "Storing the transaction result in an untyped variable widens accepted: true to boolean before the function returns it.",
    repair:
      "Give the unit-of-work result an explicit CreateProjectResourceResult generic/type so its discriminants remain literal.",
    verification: "Typecheck passes and atomic creation tests cover document, slides and spreadsheet return values."
  }
] as const;

export const BASELINE_RETIREMENTS = [
  ["accessors-are-observational", 2, "documentRuntime and slideDeckRuntime attach accessors"],
  ["async-command-state-lives-with-command", 1, "New Tab inline async creation handler"],
  ["constructed-client-object-has-a-consumer", 1, "spreadsheet runtimes"],
  ["constructed-subject-runtime-is-reachable", 1, "spreadsheet runtimes"],
  ["legacy-schema-support-does-not-exist", 3, "document, slide and collaboration legacy readers"],
  ["multi-write-capability-uses-a-unit-of-work", 1, "project resource creation"],
  ["production-views-have-no-fixture-repositories", 1, "spreadsheet sheet"],
  ["remounted-views-hold-no-declared-tab-state", 1, "spreadsheet selected/zoom state"],
  ["resource-id-selects-the-rendered-body", 1, "spreadsheet content flow"],
  ["runtime-lifecycle-follows-tabs", 2, "document and slide runtime attachment"],
  ["runtime-open-close-is-balanced", 10, "document, slide and spreadsheet runtime reachability"]
] as const;

export const CHECK_RESULTS = [
  {
    gate: "Architecture before cleanup",
    result: "89 / 90 clean",
    detail: "26 findings: 24 stale baseline records plus 2 validity echoes for records whose source files were deleted.",
    kind: "attention"
  },
  {
    gate: "Architecture after cleanup",
    result: "90 / 90 clean",
    detail: "261 baselined, zero findings. No new structural exception is required by the replayed product tree.",
    kind: "pass"
  },
  {
    gate: "Typecheck",
    result: "18 errors · 7 files",
    detail: "Four root repairs: slide cutover, document cutover, spreadsheet template shape, transaction literal typing.",
    kind: "fail"
  },
  {
    gate: "Vitest",
    result: "27 failed files",
    detail: "All failed during module import. 134 files and 1,133 assertions passed; deleted normalizer imports block the 27 files before their tests run.",
    kind: "fail"
  },
  {
    gate: "Script tests",
    result: "2 failed assertions",
    detail: "Only baseline.test.mjs is stale: it expects 20 state-ownership entries after the rebased tree correctly proposes 18. Category and generator suites pass.",
    kind: "attention"
  },
  {
    gate: "Whitespace",
    result: "315 findings · 1 file",
    detail: "314 whitespace-only lines plus one extra EOF line in docs/artifacts/template-features-changes/index.md.",
    kind: "attention"
  }
] as const;

export const DELETED_SCHEMA_READERS = [
  "src/lib/representation/data/behavior/documents/typography.ts",
  "src/lib/representation/data/behavior/slide-decks/normalize.ts",
  "src/lib/representation/data/types/collaboration/anchor.ts"
] as const;
