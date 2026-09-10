export const AUDIT = {
  captured: "2026-09-09",
  sourceBranch: "work/derived-output-architecture",
  sourceHead: "7211f1c",
  rebasedHead: "f003ab5",
  implementationHead: "964b411",
  targetBranch: "main",
  targetHead: "06708d9",
  mergeBase: "8ba102e",
  sourceOnlyCommits: 41,
  mainOnlyCommits: 18,
  conflictStops: 7,
  conflictOccurrences: 27,
  uniqueConflictPaths: 26,
  architectureChecks: 90,
  initialArchitectureFindings: 28,
  staleBaselineRecords: 28,
  finalArchitectureFindings: 0,
  sourceBaseline: 285,
  mainBaseline: 295,
  rebasedBaseline: 257,
  preRepairTypeErrors: 18,
  typeErrors: 0,
  typeFiles: 0,
  rootRepairs: 4,
  repairCommits: 5,
  discoveredVitestFiles: 170,
  failedVitestFiles: 0,
  passedVitestFiles: 168,
  skippedVitestFiles: 2,
  passedVitestAssertions: 1474,
  skippedVitestAssertions: 2,
  scriptTests: 168,
  passedScriptTests: 168,
  scriptAssertionFailures: 0,
  whitespaceFindings: 0,
  chromiumScenarios: 91,
  passedChromiumScenarios: 87,
  skippedChromiumScenarios: 4,
  failedChromiumScenarios: 0,
  providerScenarios: 4
} as const;

export const REPAIR_COMMITS = [
  ["0fe6bc8", "Make semantic indexing atomic and recoverable"],
  ["d9ad0c4", "Move active agent operations into ServerModel"],
  ["e88867d", "Extract the Agents task question bands"],
  ["c525e28", "Detect ambient mutable registries and retire stale debt"],
  ["964b411", "Preserve tab-owned runtime identity and isolate Chromium"]
] as const;

export const MAIN_COMMITS = [
  ["a195306", "Spreadsheet editor with evaluated formulas"],
  ["fffe63b", "Project-wide formulas and named variables"],
  ["26956d9", "Server-canonical spreadsheet formatting history"],
  ["525c5c6", "Spreadsheet synchronization ownership"],
  ["6efedf5", "Production reference routes and sheet state owner"],
  ["debe8c4", "First architecture baseline retirement"],
  ["a5c5e9c", "Atomic spreadsheet revision boundary"],
  ["6e75d90", "Editor runtimes bound to tab lifetime"],
  ["75fe409", "Atomic spreadsheet resource creation"],
  ["ee87adb", "Atomic template instantiation"],
  ["1fb0ce0", "Shared formula ownership"],
  ["7c52ad1", "Split spreadsheet procedure responsibilities"],
  ["380aa23", "Resolved integration debt retired"],
  ["3e670c5", "Legacy schema readers removed"],
  ["a2017b3", "Project Overview context and inspector panels"],
  ["a8f5023", "Project Overview integration contracts"],
  ["930fb95", "Document editor Chromium gestures stabilized"],
  ["06708d9", "Project Overview delivery reference"]
] as const;

export const DECISION = {
  status: "REBASED · REPAIRED",
  short:
    "The protected branch was replayed onto the certified main head, all seven conflict stops were resolved, and the integrated tree passes its compile, architecture, unit, script, build and patch-hygiene gates.",
  boundary:
    "7211f1c remains protected by backup/derived-output-architecture-pre-rebase-7211f1c; f003ab5 is the exact post-replay head before the implementation repairs recorded here."
} as const;
