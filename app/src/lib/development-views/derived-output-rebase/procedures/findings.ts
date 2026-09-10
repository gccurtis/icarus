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
  ["multi-write-capability-uses-a-unit-of-work", 3, "document, slide and project-resource transactions"],
  ["production-views-have-no-fixture-repositories", 1, "spreadsheet sheet"],
  ["remounted-views-hold-no-declared-tab-state", 1, "spreadsheet selected/zoom state"],
  ["resource-id-selects-the-rendered-body", 1, "spreadsheet content flow"],
  ["runtime-lifecycle-follows-tabs", 2, "document and slide runtime attachment"],
  ["runtime-open-close-is-balanced", 10, "document, slide and spreadsheet runtime reachability"],
  ["source-complexity-is-reviewed", 1, "Project Overview script split by extracted state and procedures"],
  ["unsupported-subject-is-explicit", 1, "Context editor now has an explicit unavailable surface"]
] as const;

export const CHECK_RESULTS = [
  {
    gate: "Architecture",
    result: "90 / 90 clean",
    detail: "Zero findings and 257 live baseline records. Twenty-eight records proven stale by the resulting source graph were removed; no new exception was added.",
    kind: "pass"
  },
  {
    gate: "Current schema",
    result: "0 legacy readers",
    detail: "Deleted document typography and slide normalization readers remain deleted, and the current collaboration anchor type no longer carries its legacy union branch.",
    kind: "pass"
  },
  {
    gate: "Typecheck",
    result: "0 errors · 0 warnings",
    detail: "The original eighteen diagnostics collapsed into four root repairs, then the decomposed implementation was checked again.",
    kind: "pass"
  },
  {
    gate: "Vitest",
    result: "1,474 passed · 2 skipped",
    detail: "All 168 executable files pass; two files and two assertions are intentionally gated. No suite fails or remains import-blocked.",
    kind: "pass"
  },
  {
    gate: "Script tests",
    result: "168 / 168 passed",
    detail: "Checker contracts, mutation fixtures and baseline-ratchet assertions all pass after strengthening process-state detection.",
    kind: "pass"
  },
  {
    gate: "Production + patch",
    result: "build clean · diff clean",
    detail: "The Node-adapter production build completes and git diff --check reports no whitespace errors.",
    kind: "pass"
  },
  {
    gate: "Chromium",
    result: "87 passed · 4 skipped",
    detail: "All 91 scenarios were collected in Chromium. Every local scenario passed; the four real-provider scenarios remain explicitly opt-in because they spend external calls.",
    kind: "pass"
  }
] as const;

export const DELETED_SCHEMA_READERS = [
  "src/lib/representation/data/behavior/documents/typography.ts",
  "src/lib/representation/data/behavior/slide-decks/normalize.ts"
] as const;
