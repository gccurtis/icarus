import type { ArchitecturePillar } from "$development-views/architecture-pillars/types";

export const OWNED_LIFECYCLE: ArchitecturePillar = {
  code: "PIL-04",
  slug: "owned-lifecycle",
  name: "Lifetime follows the state owner",
  short: "Construction, acquisition, subscription, flush, and release belong to one explicit coordinator.",
  thesis:
    "State ownership is incomplete without lifecycle ownership. A getter that attaches, a view that subscribes, or a close operation that does not release turns rendering order into hidden process behavior.",
  supports:
    "This guarantees one buffer per resource, balanced subscriptions, deterministic cleanup, and resource state that remains alive exactly as long as its workspace references require.",
  contract: [
    "The composition root constructs each client/server model exactly once in dependency order.",
    "Workspace tab open/restore acquires a resource runtime; closing the last referencing tab releases it.",
    "Accessors observe or retrieve existing state and never create, attach, subscribe, synchronize, or schedule.",
    "The lifecycle owner balances every timer, observer, subscription, and pending flush.",
    "Rendering a context rail, inspector, or content view cannot change resource lifetime."
  ],
  example: {
    title: "A runtime accessor is secretly an acquire operation",
    source: "model/client/workspace-state/methods/document-runtime.ts",
    shape: `documentRuntime(resourceId)
  → state.documents.attach(resourceId)
  → sync now + interval subscription

close(tabId)
  → records the close operation
  → never releases the document runtime`,
    observed:
      "Forty-four document/deck view files call workspace runtime accessors, commonly from effects. Mounting another view can resynchronize the same runtime, while closing the last resource tab leaves it retained until the entire client model closes.",
    antagonism:
      "The public name reads as observation, but its behavior changes process lifetime. Views decide when synchronization starts, and the workspace—the actual owner of open tabs—cannot state which runtimes should exist.",
    repair:
      "Acquire once during workspace open/restore, reference-count by resource across tabs if duplicate tabs are legal, release after the last close, and expose runtimeFor(resourceId) as a non-mutating lookup to views.",
    nuance:
      "Idempotent attach prevents duplicate runtime objects, but it does not make render-driven lifecycle correct: the existing attach implementation calls sync again when the runtime is already open."
  },
  equivalence: {
    rule: "A caller whose lifetime is shorter or less authoritative than the state owner can construct, acquire, subscribe, or release that state.",
    generalRepair:
      "Move the entire lifecycle transition to the owner, make reads observational, and prove acquire/release balance with stateful contract tests.",
    members: [
      "Getter/accessor methods with attach or sync side effects",
      "View effects that acquire resource runtimes",
      "Tab close without last-reference release",
      "Constructed client objects with no cleanup responsibility",
      "Timers or observers whose disposer is not held by the lifecycle owner"
    ]
  },
  desiredFlow: [
    "Client composition root constructs runtime registers once",
    "Workspace opens/restores a tab and acquires its subject runtime",
    "Views retrieve the existing runtime without mutation",
    "Workspace closes the last referencing tab and asks the register to release",
    "Runtime flushes, unsubscribes, clears timers, and leaves the register"
  ],
  checkers: [
    {
      id: "LIFE-01",
      name: "one-explicit-composition-root",
      status: "Enforced",
      wave: 1,
      mechanism: "Runtime graph + module-load AST",
      guarantee: "Model objects are built once, in declared order, by the environment-owned initializer.",
      detects: "Exported builders, extra initializer callers, module-load construction, graph mismatches, and repeated access.",
      implementation: "Retain the eight runtime checks and model/nothing-builds-at-module-load.",
      current: "This is one of the strongest existing portions of the architecture suite.",
      limit: "Construction checks do not prove that downstream resource acquisition and release are balanced."
    },
    {
      id: "LIFE-02",
      name: "runtime-lifecycle-follows-tabs",
      status: "Enforced",
      wave: 1,
      mechanism: "TypeScript call-site AST + resource-receiver vocabulary",
      guarantee: "Resource-runtime attach/acquire/release call sites appear only in canonical workspace operation/adoption procedures or client shutdown.",
      detects: "Known lifecycle method calls and canonical lifecycle-helper calls outside the approved lifecycle source set.",
      implementation:
        "Parse production TypeScript calls, identify resource receivers from the registered runtime subject vocabulary, and reject both direct lifecycle calls and canonical helper calls outside operation application, state adoption, and client shutdown.",
      current: "Enforced at every resource-runtime and lifecycle-helper call site; the current tree is clean.",
      limit: "Allowed caller placement does not prove last-reference semantics; LIFE-04 executes the lifecycle."
    },
    {
      id: "LIFE-03",
      name: "accessors-are-observational",
      status: "Enforced",
      wave: 1,
      mechanism: "TypeScript accessor-body effect scan",
      guarantee: "Accessor-shaped client-model functions do not call the registered lifecycle-effect vocabulary.",
      detects: "get/read/find/lookup/of/for/runtime bodies calling attach, acquire, createRuntime, release, releaseAll, schedule, subscribe, sync, or their direct nested equivalents.",
      implementation:
        "Inspect accessor-shaped function and method bodies for a deliberately small, named lifecycle mutator set; prefer explicit acquire names wherever mutation is intended.",
      current: "Enforced; document, slide-deck, and spreadsheet runtime accessors are observational and the current tree is clean.",
      limit: "Naming is a design convention. Explicit annotations can replace heuristics if the type system gains effect metadata later."
    },
    {
      id: "LIFE-04",
      name: "runtime-open-close-is-balanced",
      status: "Enforced",
      wave: 2,
      mechanism: "Workspace source graph + executable lifecycle-contract registration",
      guarantee: "Every subject runtime is represented in workspace acquire/release source paths and in an executable lifecycle contract.",
      detects: "Missing workspace reachability, open/restore acquisition, close release, or subject coverage in the lifecycle test.",
      implementation:
        "Check the workspace graph and open/restore/close procedure sources, then require an executable runtime-lifecycle test naming each subject. The test suite owns the behavioral assertions.",
      current: "Enforced through workspace wiring and an executable document, slide-deck, and spreadsheet lifecycle contract; the current tree is clean.",
      limit: "Use fake clocks and adapters so the contract is deterministic rather than browser-timing dependent."
    },
    {
      id: "LIFE-05",
      name: "stateful-client-object-has-release",
      status: "Enforced",
      wave: 2,
      mechanism: "Composition-root construction and cleanup AST",
      guarantee: "Every composition-root variable built by a stateful factory name is explicitly released, closed, or disposed by ClientModel.close().",
      detects: "Runtimes, Storage, WorkspaceState, Queries, or Preferences factory results absent from the shutdown body.",
      implementation:
        "Inspect direct factory-call initializers in runtime/client/start.ts and require a matching release/releaseAll/close/dispose call after the ClientModel close entry.",
      current: "Enforced from construction to ClientModel.close and clean in the current tree.",
      limit: "Objects with no external resources may need no disposer; their stateful classification must be explicit."
    },
    {
      id: "LIFE-06",
      name: "one-resource-one-edit-buffer",
      status: "Enforced",
      wave: 2,
      mechanism: "Runtime-register attach source contract",
      guarantee: "Every subject register looks up its open map by resource id before exactly one createRuntime(id) site.",
      detects: "Missing id lookup, creation before lookup, multiple runtime construction sites, and missing conventional attach entry.",
      implementation:
        "Inspect each *-runtimes/methods/attach.ts for lookup-before-single-create; combine it with the separately mapped view/runtime boundary and lifecycle contracts.",
      current: "Enforced and currently clean for every resource runtime register.",
      limit: "One runtime object is necessary but not sufficient; tab-specific selection still belongs outside the shared resource runtime."
    }
  ],
  rollout: [
    "Move runtime acquisition and release into workspace open/restore/close, then make accessors observational.",
    "Add the executable lifecycle matrix for each subject and remove the ten corresponding baseline gaps.",
    "Keep lookup-before-create and resource identity tests together when extending runtime registers.",
    "Give browser Storage explicit close semantics and release it from ClientModel.close."
  ],
  relatedFindings: ["ARCH-03", "ARCH-04", "ARCH-11"]
};
