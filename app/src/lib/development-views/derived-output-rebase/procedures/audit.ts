export const AUDIT = {
  captured: "2026-09-09",
  sourceBranch: "work/derived-output-architecture",
  sourceHead: "2c0bcad",
  targetBranch: "main",
  targetHead: "3e670c5",
  mergeBase: "8ba102e",
  sourceOnlyCommits: 39,
  mainOnlyCommits: 14,
  conflictStops: 7,
  conflictOccurrences: 22,
  uniqueConflictPaths: 21,
  architectureChecks: 90,
  initialArchitectureFindings: 26,
  staleBaselineRecords: 24,
  finalArchitectureFindings: 0,
  sourceBaseline: 285,
  mainBaseline: 296,
  rebasedBaseline: 261,
  typeErrors: 18,
  typeFiles: 7,
  rootRepairs: 4,
  failedVitestFiles: 27,
  passedVitestFiles: 134,
  passedVitestAssertions: 1133,
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
  ["3e670c5", "Legacy schema readers removed"]
] as const;

export const DECISION = {
  status: "GO WITH REPAIRS",
  short:
    "Do not run a blind rebase. The disposable replay proves that the branch can land after the seven recorded resolutions and four post-replay compatibility repairs.",
  boundary:
    "This reference is an audit snapshot. It does not rebase or mutate work/derived-output-architecture."
} as const;
