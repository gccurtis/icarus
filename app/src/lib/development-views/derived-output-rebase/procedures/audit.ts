export const AUDIT = {
  captured: "2026-09-09",
  sourceBranch: "work/derived-output-architecture",
  sourceHead: "bef7239",
  targetBranch: "main",
  targetHead: "06708d9",
  mergeBase: "8ba102e",
  sourceOnlyCommits: 40,
  mainOnlyCommits: 18,
  conflictStops: 8,
  conflictOccurrences: 28,
  uniqueConflictPaths: 26,
  architectureChecks: 90,
  initialArchitectureFindings: 28,
  staleBaselineRecords: 26,
  finalArchitectureFindings: 0,
  sourceBaseline: 285,
  mainBaseline: 295,
  rebasedBaseline: 259,
  typeErrors: 18,
  typeFiles: 7,
  rootRepairs: 4,
  discoveredVitestFiles: 166,
  failedVitestFiles: 27,
  passedVitestFiles: 138,
  passedVitestAssertions: 1148,
  scriptTests: 165,
  passedScriptTests: 163,
  scriptAssertionFailures: 2,
  whitespaceFindings: 315
} as const;

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
  status: "GO WITH REPAIRS",
  short:
    "Do not run a blind rebase. The disposable replay proves that the branch can land after the eight recorded resolutions and four post-replay compatibility repairs.",
  boundary:
    "This reference is an audit snapshot. It does not rebase or mutate work/derived-output-architecture."
} as const;
