export const SYSTEM_VERDICT = {
  headline: "The monitor is now the merge boundary.",
  summary:
    "The ratcheting checker system is active across all eight pillars and all forty-five contracts. Static checks guard repository shape, while required executable and Chromium contract registrations make missing semantic and visible-behavior coverage explicit debt instead of a silent gap.",
  caution:
    "Current violations remain explicit, mapped debt—not permanent exclusions. Every new or changed violation fails, every resolved record becomes a stale-baseline failure, and each remaining record has a contract, owner, rationale, removal condition, and review date."
} as const;

export const TARGET_LAYERS = [
  {
    layer: "Presentation",
    owner: "Component instance",
    state: "DOM refs, hover, gesture drafts, unsubmitted fields",
    behavior: "Named component procedures and effects",
    crossing: "Calls client owner or capability; never persistence"
  },
  {
    layer: "Workspace",
    owner: "WorkspaceState + per-tab view",
    state: "Tabs, focus, selection, zoom, panel geometry",
    behavior: "Workspace model methods",
    crossing: "Acquires/releases subject runtimes"
  },
  {
    layer: "Resource",
    owner: "One subject runtime per resource id",
    state: "Body, revision, buffer, history, synchronization",
    behavior: "Runtime model methods",
    crossing: "Calls typed subject capabilities"
  },
  {
    layer: "Server intent",
    owner: "Request scope + stateless capability",
    state: "No cross-request state",
    behavior: "Scope, validation, ownership, domain command",
    crossing: "Calls ServerModel once per intent"
  },
  {
    layer: "Durable process",
    owner: "Server model + adapter",
    state: "Tables, configuration, observability, connections",
    behavior: "Transactions, persistence, external protocols",
    crossing: "Only named infrastructure adapters perform I/O"
  }
] as const;

export const CHECKER_LAYERS = [
  {
    order: "01",
    name: "Filesystem and import graph",
    cost: "Fast · deterministic · every change",
    proves: "Where code lives, what it imports, what is exported, and which environment boundaries it crosses.",
    cannot: "State lifetime, runtime outcomes, transaction atomicity, or authorization semantics."
  },
  {
    order: "02",
    name: "TypeScript and Svelte structure",
    cost: "Fast · mostly deterministic · every change",
    proves: "Call ordering, direct effects, module state, input type reachability, delegation, and known mutator placement.",
    cannot: "Whether a custom ownership predicate is correct or whether cleanup actually balances."
  },
  {
    order: "03",
    name: "Model and capability contracts",
    cost: "Focused · deterministic · affected subject",
    proves: "Cross-project refusal, acquire/release balance, all-or-none transactions, restart recovery, and revision invariants.",
    cannot: "Whether the visible route uses the tested path or presents the right resource."
  },
  {
    order: "04",
    name: "Chromium interaction contracts",
    cost: "Slower · seeded · merge gate for editor paths",
    proves: "Resource identity reaches the view, tab state survives remounts, no dead loading state occurs, and user-visible behavior is intact.",
    cannot: "Exhaustive infrastructure failure states or architectural intent not exposed through behavior."
  },
  {
    order: "05",
    name: "Reviewed declarations",
    cost: "Human decision once · mechanically checked afterward",
    proves: "The intended lifetime, model invariant, category readiness, and rare exception are explicit and consistent with source.",
    cannot: "Whether the original human design choice was wise; architecture review remains necessary."
  }
] as const;

export const CHECKER_ANATOMY = [
  ["Stable id", "A pillar-prefixed identifier that survives file renames and appears in baselines and reports."],
  ["One guarantee", "A precise statement of what a green result proves—and nothing stronger."],
  ["Mechanism", "Import graph, AST, contract test, Chromium test, or reviewed declaration."],
  ["Scope", "Exact source homes, subjects, and file kinds examined."],
  ["Failure", "Path, line/call chain, violated rule, and the nearest general repair."],
  ["Reference observation", "The pristine repository result recorded before each deliberate mutation."],
  ["Mutation fixture", "A deliberately broken variant proving the checker detects its intended infraction."],
  ["Known limit", "The semantic fact the checker cannot prove, linked to the next enforcement layer."],
  ["Rollout", "Blocking, warning, or baselined debt, with an explicit condition for promotion."]
] as const;

export const BASELINE_FIELDS = [
  ["contract", "Stable pillar contract id, such as AUTH-02"],
  ["checker", "Concrete independently discovered checker file"],
  ["path + fingerprint", "Normalized source identity—not a fragile line number"],
  ["finding + rationale", "Linked audit finding and why this exact debt record exists"],
  ["owner", "The remediation owner, never an anonymous team exception"],
  ["removal + review", "Observable removal condition and review date no more than 183 days away"]
] as const;

export const EXECUTION_FLOW = [
  "Load and parse the repository tree once, preserving the existing auto-discovery model.",
  "Run each checker and emit normalized findings: checker, pillar, path, line, subject, message, fingerprint.",
  "Match findings against the checked-in debt baseline; classify each as existing, new, changed, resolved, or stale exemption.",
  "Fail new/changed blocking findings and broken/stale exemptions; report existing baseline debt without hiding it.",
  "Require executable subject/Chromium contract registrations for semantic guarantees; run those suites through their dedicated test commands.",
  "Keep the machine-readable checker catalog and reference-page status in one tested correspondence."
] as const;

export const WAVES = [
  {
    wave: 1,
    title: "Boundary sentries",
    objective: "Catch new high-confidence violations immediately and create the debt ratchet.",
    includes:
      "Baseline/exemption engine; direct capability calls; scope consumption; raw persistence coordinates; generic mutations; runtime lifecycle callers; accessor effects; multi-write intents; fixtures in production."
  },
  {
    wave: 2,
    title: "Ownership contracts",
    objective: "Make lifetime, cleanup, authority, and persistence outcomes executable.",
    includes:
      "State contracts; model delegation; async command placement; cross-project matrix; runtime balance; shutdown coverage; transaction fault injection; revision invariants; resource identity."
  },
  {
    wave: 3,
    title: "Reviewability ratchet",
    objective: "Prevent extracted behavior and live routes from drifting into opaque or false shapes.",
    includes:
      "Complexity vectors; procedure entry graphs; architecture documentation inventory; readiness manifests; unsupported subject behavior."
  },
  {
    wave: 4,
    title: "Governance closure",
    objective: "Check that each global model and long-lived exception remains justified.",
    includes: "Model admission contracts, generated architecture inventory, and removal of the temporary debt baseline once empty."
  }
] as const;

export const CI_POLICY = [
  {
    state: "New violation",
    outcome: "Fail",
    reason: "The boundary is now monitored; future complexity cannot enter silently."
  },
  {
    state: "Existing exact baseline violation",
    outcome: "Report",
    reason: "Current behavior remains mergeable while the linked remediation is underway."
  },
  {
    state: "Existing violation changed or expanded",
    outcome: "Fail",
    reason: "A baseline is not permission to grow the infraction."
  },
  {
    state: "Baseline entry no longer observed",
    outcome: "Fail stale baseline",
    reason: "The same change removes the obsolete allowance; debt only moves downward."
  },
  {
    state: "Checker crashes or cannot parse",
    outcome: "Fail closed",
    reason: "A monitor that silently skipped the boundary cannot report green."
  },
  {
    state: "Heuristic review signal",
    outcome: "Fail if new; report if baselined",
    reason: "The calibrated structural fingerprint makes judgment-like checks strict without hiding existing hotspots."
  }
] as const;

export const REPORT_SCHEMA = `type ArchitectureDebt = {
  contract: string;      // AUTH-02
  checker: string;       // capability-scope-is-consumed
  pillar: string;        // scoped-authority
  path: string;
  subject?: string;
  fingerprint: string;   // stable AST/import identity
  finding: string;       // ARCH-01
  owner: string;
  rationale: string;
  removal: string;
  review: string;        // future YYYY-MM-DD
}`;
