import type { CheckerRecord } from "$development-views/pure-functions-reference/types";

export const CHECKERS: readonly CheckerRecord[] = [
  { id: "PF-01", checker: "pure-island-import-closure", area: "Boundary", guarantee: "Every governed direct and transitive dependency remains inside the exact owner island.", proof: "Resolves value, type, re-export, dynamic-import, require, asset, declaration, and symlink edges with the TypeScript resolver." },
  { id: "PF-02", checker: "pure-island-has-no-ambient-authority", area: "Boundary", guarantee: "Pure functions cannot discover time, randomness, globals, frameworks, state, or detached async work.", proof: "Walks lexical provenance, calls, mutation roots, type surfaces, module state, structured promises, and port introspection escapes." },
  { id: "PF-03", checker: "pure-island-exports-are-closed", area: "Boundary", guarantee: "Only intended entries and deeply immutable data leave an island.", proof: "Checks owner-local export provenance, executable extensions, mutable static values, and accidental helper exports." },
  { id: "PF-04", checker: "model-state-is-fields", area: "Model", guarantee: "A model state is an explicit ordinary stored-field object with no attached behavior.", proof: "Requires state.ts and one create*State literal constructor; rejects legacy definitions, callables, inheritance, getters, proxies, and hidden fields." },
  { id: "PF-05", checker: "model-operations-are-free", area: "Model", guarantee: "Model behavior is free and receives model state in the first value position.", proof: "Rejects classes/accessors and imports or calls that acquire, construct, or reach a model lifecycle surface from methods/." },
  { id: "PF-06", checker: "model-port-has-one-lifecycle", area: "Model", guarantee: "Each model has one exact runtime-only adapter and fresh acquired facades with commit.", proof: "Inspects adapter literals, metadata, own members, local provenance, frozen per-acquire allocation, lifecycle escape, reflection, and one-call delegation." },
  { id: "PF-07", checker: "runtime-alone-builds-models", area: "Runtime", guarantee: "Runtime is the only and exactly-once caller of every state constructor and model binding.", proof: "Uses TypeScript symbols to count production calls and fixes each environment to models/build.ts or models/build.server.ts." },
  { id: "PF-08", checker: "capability-contract-is-local", area: "Capability", guarantee: "A capability entry speaks only in its own exact context, ports, input, and result types.", proof: "Checks the three-parameter entry signature, local declarations, data-only surfaces, admission ownership, and broad service containers." },
  { id: "PF-09", checker: "capability-adapter-is-exact", area: "Runtime", guarantee: "A transformer selects a literal model subset and binds local ports member by member.", proof: "Checks frozen context/port literals, sorted model manifests, binding records, single named delegation, imports, spreads, casts, and reflection." },
  { id: "PF-10", checker: "capability-registry-is-bijective", area: "Runtime", guarantee: "Entries, admission, transformers, registry records, policies, and remote exports form one static bijection.", proof: "Compares filesystem-derived operations with a deeply frozen, sorted registry and the generated remote surface." },
  { id: "PF-11", checker: "remote-gateway-is-the-only-crossing", area: "Capability", guarantee: "Product clients cross through one generated remote facade and internal production callers use the registry.", proof: "Rejects capability-local remote files, direct entry imports, alternate framework crossings, client runtime imports, and unregistered internal calls." },
  { id: "PF-12", checker: "gateway-releases-every-acquisition", area: "Runtime", guarantee: "The shared runner releases every successful acquisition in reverse order from finally.", proof: "Inspects acquisition tracking, try/finally coverage, reverse release, partial-acquire cleanup, fault preservation, and single invocation." },
  { id: "PF-13", checker: "one-staged-commit-owner", area: "Runtime", guarantee: "Automatic commits have one owner and explicit durable checkpoints are named in policy.", proof: "Cross-checks commit mode, registry policy, runner calls, capability commit references, and duplicate staged-model acquisition." },
  { id: "PF-14", checker: "component-procedures-are-closed", area: "Component", guarantee: "Component procedures remain owner-local pure islands reached through exact adapters and a standard runner.", proof: "Checks filesystem ownership, adapter bijection, frozen inputs, explicit port binding, markup event grammar, and runner lifecycle delegation." },
  { id: "PF-15", checker: "effects-are-boundaries", area: "Component", guarantee: "Framework and lifecycle effects live outside procedures and invoke named pure work.", proof: "Finds runes, hooks, timers, listeners, observers, subscriptions, cleanup symmetry, and inline decision bodies across owner boundaries." },
  { id: "PF-16", checker: "pure-generators-produce-the-contract", area: "Tooling", guarantee: "Generators emit the target architecture rather than recreating legacy debt.", proof: "Checks templates and generator source for required files/signatures plus pristine-output mutation coverage." }
];

export const MODEL_FILES = [
  ["index.ts", "Public data and acquired-port types only"],
  ["types.ts", "Exact model-local data contracts"],
  ["state.ts", "Stored fields and the one state constructor"],
  ["port.ts", "Port types and bind<Model>() lifecycle"],
  ["methods/<operation>/", "Public and supporting authority-pure functions"],
  ["test/", "Behavior, lifecycle, regression, and adversarial evidence"]
] as const;

export const CAPABILITY_FILES = [
  ["index.ts", "Pure runtime/test entry; no remote framework code"],
  ["api/<operation>/", "Entry, admission, and local call tree"],
  ["types/", "Capability-owned context, ports, input, result, and domain data"],
  ["test/", "Unit, regression, and non-functional evidence"]
] as const;

export const COMPONENT_FILES = [
  ["procedures/", "Authority-pure owner-local decisions"],
  ["adapters/", "Remote, model, and browser transformations"],
  ["effects/", "Lifecycle registration and cleanup"],
  ["components/ + content/", "Composition, rendering, and one-call event wiring"]
] as const;
