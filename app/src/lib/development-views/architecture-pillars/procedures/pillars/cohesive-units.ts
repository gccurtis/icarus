import type { ArchitecturePillar } from "$development-views/architecture-pillars/types";

export const COHESIVE_UNITS: ArchitecturePillar = {
  code: "PIL-08",
  slug: "cohesive-units",
  name: "Units are cohesive and reviewable",
  short: "A directory and entry point should have one ownership sentence and a bounded procedure graph.",
  thesis:
    "Line count is not architecture, but files with dozens of exports and unrelated reasons to change erase the meaning of the tree. Cohesion means one state invariant for a model and one intent/call chain for a procedure entry.",
  supports:
    "Reviews stay local, changes conflict less often, tests attach to meaningful entry points, and documentation remains an accurate map instead of compensating for opaque source structure.",
  contract: [
    "Each model has one clear owner/lifetime/invariant sentence and a deliberately small public surface.",
    "Each procedure entry names one intent and has a bounded support call tree.",
    "shared/ contains only behavior used by multiple entries, never unsorted leftovers.",
    "Large generated/static registries are generated or domain-split rather than hand-maintained monoliths.",
    "Architecture documentation states durable invariants and derives volatile inventories from source."
  ],
  example: {
    title: "One agents procedure file is an entire product repository",
    source: "app-views/categories/agents/procedures/agents.ts",
    shape: `agents.ts · 1,535 lines · 59 exports
  → domain/view types
  → fixture repository
  → personas and automations
  → tasks and conversations
  → queries and projections`,
    observed:
      "Behavior was moved out of components, but the destination combines unrelated subjects and fixture state. New-tab library and analysis procedures show the same extraction-without-segmentation pattern.",
    antagonism:
      "The procedures directory exists but does not reveal the call graph. A reviewer must load the entire category to understand one gesture, and nearly every feature change touches the same file.",
    repair:
      "Delete production fixture responsibilities, create one directory per named entry procedure, keep only reused steps under shared/, and derive/export narrow public indexes. Use complexity checks as review triggers rather than arbitrary style punishment.",
    nuance:
      "A 600-line pure schema map can be more cohesive than a 200-line controller with five responsibilities. Checker output should combine size, exports, effects, and responsibility indicators, and permit generated/data-only classifications."
  },
  equivalence: {
    rule: "A file or model has multiple independent ownership sentences, entry intents, lifetimes, or reasons to change.",
    generalRepair:
      "Split on invariant and entry-call-chain boundaries, generate mechanical registries, narrow public indexes, and make any exception explicit and expiring.",
    members: [
      "Procedure file with dozens of unrelated exports",
      "Component script combining adapters, commands, effects, state, and markup",
      "Model with unrelated query, navigation, and persistence responsibilities",
      "Hand-maintained registry that could be generated from domain entries",
      "Documentation with volatile counts and obsolete implementation status"
    ]
  },
  desiredFlow: [
    "One public entry names one intent",
    "Its local support files implement only that call chain",
    "Truly reused steps move to a narrow shared module",
    "The subject index explicitly lists public entries",
    "Tests and durable documentation attach at the entry/invariant boundary"
  ],
  checkers: [
    {
      id: "COH-01",
      name: "source-complexity-is-reviewed",
      status: "Enforced",
      wave: 3,
      mechanism: "Source metrics + classification",
      guarantee: "A production component script or procedure/API source crosses a visible review gate above 300 lines or 20 exports and cannot waive the 800-line hand-authored ceiling.",
      detects: "Line/export thresholds, with imports, branches, lifecycle calls, and state bindings included in the diagnostic vector.",
      implementation:
        "Require @architecture-complexity reviewed above 300 lines or 20 exports, report the full metric vector, and require a split above 800 unless a TypeScript source is explicitly generated.",
      current: "Enforced with review and hard-ceiling classifications; 24 complex sources are baselined.",
      limit: "Metrics locate review risk; they cannot prove incohesion. Generated and declarative data files need an explicit non-behavior classification."
    },
    {
      id: "COH-02",
      name: "procedure-directory-has-one-entry-chain",
      status: "Enforced",
      wave: 3,
      mechanism: "Effect analysis + filesystem/export/import graph",
      guarantee: "A view procedure source exposes at most one effectful entry chain, a pure helper family exposes at most eight cohesive values, each procedure subdirectory has its matching entry file, and shared code has consumers in two procedure directories.",
      detects: "Multiple exported commands, over-wide pure helper families, procedure directories without matching entries, and shared/ modules used from fewer than two distinct directories.",
      implementation:
        "Classify exported functions through assignments, callbacks, lifecycle/browser operations, capability commands, and local call propagation; bound non-effectful public families separately; retain directory-entry and real shared-consumer checks.",
      current: "Enforced for effectful entries, bounded pure families, directory entries, and shared consumers; 23 existing violations remain ratcheted.",
      limit: "Static effect analysis is intentionally conservative. Source complexity and review still decide whether a nominally pure family has more than one reason to change."
    },
    {
      id: "COH-03",
      name: "public-surface-matches-the-tree",
      status: "Enforced",
      wave: 1,
      mechanism: "Filesystem + index export graph",
      guarantee: "Capability, model, component vocabulary, runtime aggregate, and view registrations agree with their source trees.",
      detects: "Hidden entries, omitted exports, wrong directory names, unresolved method paths, and graph/aggregate drift.",
      implementation: "Retain the existing capability/model/runtime/component/view inventory checks.",
      current: "Broadly enforced and clean; this is a strong foundation for generated inventories.",
      limit: "A complete index can still export too broad a surface; intent-level cohesion needs COH-02 and human review."
    },
    {
      id: "COH-04",
      name: "architecture-docs-match-the-graph",
      status: "Enforced",
      wave: 3,
      mechanism: "Graph inventory + targeted documentation assertions",
      guarantee: "Capability/server-model inventories, documented concern paths, and selected workspace/runtime implementation claims stay consistent with source.",
      detects: "Missing capability/model names, documented paths that no longer resolve, and known stale persistence/runtime status claims.",
      implementation:
        "Compare capability and server-model directories with their overview documents, retain documented-path resolution checks, and reject source-contradicted workspace/runtime status phrases.",
      current: "Enforced against capability, server-model, workspace, and runtime graphs; four stale claims are baselined.",
      limit: "A checker cannot assess every sentence. Documentation should avoid claims that source can generate or tests can prove."
    },
    {
      id: "COH-05",
      name: "model-admission-declares-an-invariant",
      status: "Enforced",
      wave: 4,
      mechanism: "Required model contract document",
      guarantee: "Every client/server model object has a colocated contract document with Ownership, Lifetime, and Invariant sections.",
      detects: "Missing model documents or missing required ownership/lifetime/invariant headings.",
      implementation:
        "Enumerate client/server model object directories and require <object>.md with the three structured contract headings; consumer and disposer checks remain separate executable contracts.",
      current: "Enforced and clean; every admitted model documents its ownership, lifetime, and invariants.",
      limit: "The initial invariant sentence is a reviewed design assertion; automation checks its consistency, not its wisdom."
    },
    {
      id: "COH-06",
      name: "architecture-exceptions-expire",
      status: "Enforced",
      wave: 1,
      mechanism: "Baseline/exemption manifest validation",
      guarantee: "Current debt can be ratcheted without turning temporary allowances or distant review dates into a parallel architecture.",
      detects: "New unbaselined failures, stale fingerprints, malformed or duplicate entries, missing owners/removal text, expired reviews, and reviews beyond 183 days.",
      implementation:
        "Record rule id, exact source fingerprint, rationale, owner, linked finding, and removal condition. New/regressed violations fail; disappeared violations automatically shrink the baseline.",
      current: "Enforced and clean; every baseline record is mapped, owned, justified, removable, and reviewed within 183 days.",
      limit: "An expiration date without active ownership becomes noise; removal condition and linked remediation are mandatory."
    }
  ],
  rollout: [
    "Use the active debt baseline as a ratchet while splitting the 24 complexity hotspots.",
    "Split multiple effectful chains and over-wide pure families on intent boundaries, then remove their baseline records.",
    "Replace the four stale architecture claims with generated inventories or durable invariant prose.",
    "Keep every model contract current and every remaining exception mapped, owned, and expiring."
  ],
  relatedFindings: ["ARCH-05", "ARCH-08", "ARCH-10", "ARCH-12", "ARCH-13", "ARCH-14"]
};
