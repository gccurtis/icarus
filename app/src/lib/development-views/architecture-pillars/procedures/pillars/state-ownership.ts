import type { ArchitecturePillar } from "$development-views/architecture-pillars/types";

export const STATE_OWNERSHIP: ArchitecturePillar = {
  code: "PIL-01",
  slug: "state-ownership",
  name: "State has one explicit owner",
  short: "Place mutable state according to the lifetime and invariant it participates in.",
  thesis:
    "State is understandable when its owner, identity key, lifetime, persistence, and release point can be named without reading every caller. Global is not inherently better than local: the correct owner is the smallest durable lifetime shared by every consumer that must agree.",
  supports:
    "This keeps two views from disagreeing about the same resource, prevents ordinary remounts from erasing user state, and lets a reviewer find the complete state ledger before following behavior.",
  contract: [
    "DOM references, hover, pointer gestures, open menus, and unsubmitted field drafts belong to one component instance.",
    "Selection, zoom, rail state, and navigation that must survive a keyed remount belong to the tab view held by WorkspaceState.",
    "Body, revision, edit buffer, history, and synchronization belong to one runtime keyed by resource identity.",
    "Durable project data belongs to a server model and is changed only through a subject capability.",
    "A new model is admitted for an independent lifetime plus a real invariant—not merely to relocate a helper or one field."
  ],
  example: {
    title: "Spreadsheet interaction state dies with its rendered component",
    source: "app-views/categories/spreadsheet-editor/content/sheet.svelte",
    shape: `content.svelte keys the center by active tab
  → sheet.svelte declares selected cell and zoom with $state
  → switching tabs destroys that component instance
  → returning constructs defaults again`,
    observed:
      "Spreadsheet selection and zoom are locally reactive even though they describe what a workspace tab is looking at. Analysis working definitions, research decisions, and agent task output follow the same pattern.",
    antagonism:
      "The component lifetime is shorter than the conceptual state lifetime. Rendering becomes an accidental state owner, and two tabs cannot reliably preserve independent views of the same subject.",
    repair:
      "Classify each value before moving code: keep gesture drafts in a colocated component controller, move tab display state into TabView/WorkspaceState, move unsaved resource edits into the resource runtime, and put durable records behind a capability.",
    nuance:
      "This does not justify a model per field. A component controller remains local, and related tab fields should extend the existing per-tab view rather than create tiny global models."
  },
  equivalence: {
    rule: "The state owner has a shorter, broader, or unrelated lifetime than the thing the state describes.",
    generalRepair:
      "Name the state lifetime and correlation key, move it to the existing owner for that lifetime, and leave only interaction-temporary values in the component.",
    members: [
      "Tab-correlated values in a keyed/remounted component",
      "Resource edits duplicated in a view instead of its runtime",
      "Browser-lifetime preferences in mutable module globals",
      "All project-table queries accumulated in the navigation coordinator",
      "A constructed model with no state or production consumer"
    ]
  },
  desiredFlow: [
    "Gesture draft → component/state.svelte.ts → discarded when that component unmounts",
    "Tab display choice → WorkspaceState TabView keyed by tab id → restored when the tab returns",
    "Resource edit → subject runtime keyed by resource id → buffered, synchronized, and released",
    "Durable record → subject capability → server model transaction"
  ],
  checkers: [
    {
      id: "OWN-01",
      name: "mutable-state-has-an-instance",
      status: "Enforced",
      wave: 1,
      mechanism: "TypeScript AST + repository-home classification",
      guarantee: "Mutable module bindings cannot silently become shared state outside approved composition roots.",
      detects: "Top-level let/var, const $state runes, module caches, counters, constructed instances, and lazy globalThis-backed maps, objects, or controllers in production modules.",
      implementation:
        "Generalize model/nothing-builds-at-module-load's mutableBindings scan to production views and surfaces. Permit only documented runtime holders, server process infrastructure, constants, and factory-local closures.",
      current: "Enforced across production homes, including ambient-backed lazy state; only explicit composition roots may hold process instances.",
      limit: "An AST can locate shared state but cannot choose its correct owner; the failure should require an ownership sentence in the repair."
    },
    {
      id: "OWN-02",
      name: "component-state-declares-a-lifetime",
      status: "Enforced",
      wave: 2,
      mechanism: "Filesystem convention + AST",
      guarantee: "Nontrivial local state is collected in a component-instance state module whose lifetime is explicit.",
      detects: "Large collections of $state mixed into .svelte controllers and state objects exported as accidental singletons.",
      implementation:
        "Require complex components to construct state from state.svelte.ts; forbid module-created instances; let small components retain a documented low field threshold inline.",
      current: "Enforced at the complexity threshold; ten components without constructed state owners are baselined.",
      limit: "The threshold is a review trigger, not proof that a value belongs locally."
    },
    {
      id: "OWN-03",
      name: "remounted-views-hold-no-declared-tab-state",
      status: "Enforced",
      wave: 2,
      mechanism: "Checked @state-lifetime declarations + AST",
      guarantee: "Values declared as tab- or resource-correlated cannot be owned by a remounted view.",
      detects: "Selection, zoom, working definitions, and persistent toggles declared in keyed content components.",
      implementation:
        "Require every local $state binding in a remounted category content view to appear in an adjacent @state-lifetime declaration. Only component-classified bindings may remain local; tab, resource, and durable classifications fail at the component boundary.",
      current: "Enforced through checked @state-lifetime declarations; eleven content views remain baselined.",
      limit: "Some classification remains a design decision. The checked declaration makes that decision reviewable and mechanically enforceable afterward."
    },
    {
      id: "OWN-04",
      name: "workspace-exposes-no-store-schema",
      status: "Enforced",
      wave: 1,
      mechanism: "TypeScript import/API scan",
      guarantee: "The navigation coordinator does not become a generic cache for every persistent table.",
      detects: "TableName, StoreQuery, readStore, raw paths, or TABLE_NAMES in WorkspaceState's public surface.",
      implementation:
        "Reject representation/store types from the workspace public API. Permit typed project projections or subject runtimes with a named lifetime owner.",
      current: "Enforced; WorkspaceState exposes navigation and resource runtimes without generic store vocabulary.",
      limit: "This checker enforces vocabulary and ownership boundaries; it does not prescribe one model per query."
    },
    {
      id: "OWN-05",
      name: "constructed-client-object-has-a-consumer",
      status: "Enforced",
      wave: 2,
      mechanism: "Runtime graph + production import graph",
      guarantee: "Every client model in the aggregate owns behavior used by production code.",
      detects: "Models constructed and returned only to satisfy a planned architecture, such as currently unused Client Storage.",
      implementation:
        "Trace aggregate properties from the client builder to non-test/non-development consumers and require an explicit release path for stateful objects.",
      current: "Enforced through the production import and client-aggregate graph; two unconsumed client objects are baselined.",
      limit: "A deliberately exposed public API may have no in-repo consumer; such cases need a narrow documented exception."
    }
  ],
  rollout: [
    "Remove the three module holders and replace raw WorkspaceState store vocabulary with typed subject projections.",
    "Classify baselined content state while moving tab-correlated fields to per-tab WorkspaceState records.",
    "Introduce component-constructed state owners for the ten complex controllers, then ratchet the size threshold down.",
    "Integrate or delete the two unconsumed client objects and remove their baseline records in the same changes."
  ],
  relatedFindings: ["ARCH-04", "ARCH-06", "ARCH-08", "ARCH-11"]
};
