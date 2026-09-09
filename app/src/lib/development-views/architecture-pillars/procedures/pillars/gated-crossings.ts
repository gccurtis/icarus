import type { ArchitecturePillar } from "$development-views/architecture-pillars/types";

export const GATED_CROSSINGS: ArchitecturePillar = {
  code: "PIL-06",
  slug: "gated-crossings",
  name: "Crossings are singular and gated",
  short: "Framework, server, persistence, and external I/O enter the architecture at named boundaries.",
  thesis:
    "A system remains auditable when every environment transition has one recognizable gate. Components should not know transport or storage; representation should remain pure; external adapters should be owned by models with explicit lifetimes.",
  supports:
    "This makes dependencies substitutable, keeps domain behavior testable without infrastructure, and reduces security and failure analysis to a small set of edges.",
  contract: [
    "The only client-to-server import edge is a capability index.",
    "Representation imports no client, server, framework, model, or I/O concern.",
    "Production filesystem, database, network, browser storage, and global DOM effects are gated by an explicit model/adapter owner.",
    "Authored components render from props and callbacks only.",
    "Framework initialization occurs at the environment root and does not leak into domain/model definitions."
  ],
  example: {
    title: "Appearance persistence bypasses the client storage owner",
    source: "surfaces/top-bar/effects/apply-appearance.svelte.ts",
    shape: `let held = $state(stored())
stored() → localStorage.getItem(...)
$effect → document.dataset + localStorage.setItem(...)`,
    observed:
      "A surface effect owns browser-lifetime appearance state and talks directly to localStorage, while Client Storage is constructed in the client graph but has no production consumers.",
    antagonism:
      "The client composition graph is no longer the complete inventory of stateful external resources. Storage policy, failure handling, serialization, and lifetime live at a visual surface edge.",
    repair:
      "Give a client preferences/configuration model ownership of appearance and use the client storage adapter there. The top bar invokes a method; one named effect applies the already-owned preference to the document root.",
    nuance:
      "Direct DOM access can be valid inside a surface effect because the DOM is that effect's environment. The persistence crossing is the misplaced part; separate applying appearance from storing preference."
  },
  equivalence: {
    rule: "Code crosses an environment or infrastructure boundary somewhere other than the one explicit owner/gate for that boundary.",
    generalRepair:
      "Move the crossing to its model/adapter or capability index, inject a narrow interface inward, and leave callers unaware of transport and storage mechanics.",
    members: [
      "Client importing server code below a capability index",
      "Capability opening persistence directly instead of using ServerModel",
      "View reading/writing localStorage or issuing fetch",
      "Representation importing framework or process concerns",
      "Authored reusable component importing runtime/model state"
    ]
  },
  desiredFlow: [
    "Authored component ← props/callbacks ← app view",
    "App procedure → capability index ⇢ server capability procedure",
    "Server capability → ServerModel → persistence/external adapter",
    "Pure representation types/behavior are shared without crossing an environment"
  ],
  checkers: [
    {
      id: "EDGE-01",
      name: "client-server-has-one-crossing",
      status: "Enforced",
      wave: 1,
      mechanism: "Whole-repository import graph",
      guarantee: "The only executable client-to-server edge terminates at a capability index.",
      detects: "Client modules importing server procedures, runtime server internals, adapters, or capability implementation files.",
      implementation: "Retain across/one-crossing and across/client-server-separation.",
      current: "Enforced and clean.",
      limit: "A legal capability index can still expose an unsafe or overly generic operation; PIL-03 handles authority."
    },
    {
      id: "EDGE-02",
      name: "representation-remains-pure",
      status: "Enforced",
      wave: 1,
      mechanism: "Import graph + AST",
      guarantee: "Representation defines data and deterministic behavior without infrastructure or stateful construction.",
      detects: "Foreign-tree imports, I/O, impure behavior dependencies, emitted type modules, and store openings.",
      implementation: "Retain the six representation checks and domain graph declaration.",
      current: "Enforced and clean; this is a strong existing boundary.",
      limit: "Purity does not prove that the representation schema expresses every required domain invariant."
    },
    {
      id: "EDGE-03",
      name: "production-io-has-a-model-owner",
      status: "Enforced",
      wave: 2,
      mechanism: "Import/API graph by environment",
      guarantee: "External I/O is reachable only inside the model or adapter that owns its lifetime and policy.",
      detects: "node:fs, database clients, fetch/WebSocket, localStorage/indexedDB, and persistence APIs in views, surfaces, representation, or capabilities.",
      implementation:
        "Generalize capabilities/storage-through-a-model to all production homes and maintain an explicit environment API registry. Permit DOM APIs only in named effects, not persistence/network there.",
      current: "Enforced across production browser, network, process, filesystem, and known database I/O; one localStorage bypass is baselined.",
      limit: "External navigation and user-initiated downloads are UI effects, not model I/O; the registry needs semantic exceptions."
    },
    {
      id: "EDGE-04",
      name: "authored-components-take-only-props",
      status: "Enforced",
      wave: 1,
      mechanism: "Import graph",
      guarantee: "Reusable authored components are context-free and mount identically from explicit inputs.",
      detects: "Imports from capabilities, model, runtime, or representation beneath components/.",
      implementation: "Retain components/component-takes-only-props and component vocabulary entry checks.",
      current: "Enforced and clean.",
      limit: "App-view components are intentionally connected; BEH-01 governs their remote behavior placement."
    },
    {
      id: "EDGE-05",
      name: "framework-code-stays-at-environment-edges",
      status: "Enforced",
      wave: 1,
      mechanism: "Runtime import graph",
      guarantee: "Framework initialization and environment ownership remain at runtime roots.",
      detects: "Framework imports in builders/model objects and initializers called from multiple sites.",
      implementation: "Retain runtime/framework-only-at-the-root and one-caller-of-the-initializer.",
      current: "Enforced and clean for the client/server composition graphs.",
      limit: "Svelte runes are intentionally used in client state definitions; this rule concerns environment initialization, not reactivity syntax."
    },
    {
      id: "EDGE-06",
      name: "capability-internals-have-one-public-door",
      status: "Enforced",
      wave: 1,
      mechanism: "Import graph + index inventory",
      guarantee: "Callers cannot reach around a capability's public index into validators or procedure internals.",
      detects: "Imports beneath a capability root and public indexes that omit or silently add procedures.",
      implementation: "Retain nothing-reaches-inside-a-capability and capability-lists-its-procedures.",
      current: "Enforced and clean.",
      limit: "A well-encapsulated public door can still have the wrong authority semantics."
    }
  ],
  rollout: [
    "Preserve the existing graph rules unchanged; they are already effective architecture assets.",
    "Move appearance persistence behind a client model owner and remove its baseline record.",
    "Keep authored components free of network access as future connector UI is introduced.",
    "Add new connector adapters to the registry as they arrive rather than allowing ad hoc fetch sites."
  ],
  relatedFindings: ["ARCH-09", "ARCH-11"]
};
