import type {
  AuditGrade,
  Guardrail,
  Hotspot,
  RemediationPhase
} from "$development-views/state-behavior-audit/types";

export const HOTSPOTS: readonly Hotspot[] = [
  {
    path: "capabilities/templates/api/shared/validation.ts",
    lines: "1,687",
    concern: "Three editor schemas, primitive validation, bounds, and template variables in one validator.",
    split: "document, presentation, spreadsheet, variables, shared primitives"
  },
  {
    path: "app-views/categories/agents/procedures/agents.ts",
    lines: "1,535",
    concern: "Types, mock repository, personas, automations, tasks, conversations, and projections.",
    split: "delete mocks; one subject procedure tree per capability"
  },
  {
    path: "app-views/categories/research/content/thread.svelte",
    lines: "1,182 / 865 script",
    concern: "Domain types, fixtures, query facade, decisions, composer behavior, and complete presentation.",
    split: "capability projection, resource runtime, controller, presentation components"
  },
  {
    path: "app-views/categories/templates/inspector/template.svelte",
    lines: "1,185 / 493 script",
    concern: "Twenty local state fields and every edit/async/focus command beside the inspector markup.",
    split: "inspector state, edit procedures, focus effects, sections"
  },
  {
    path: "app-views/categories/analysis/content/chart.svelte",
    lines: "1,066 / 510 script",
    concern: "Working analysis definition, filtering engine, selection, drag intake, and rendering.",
    split: "analysis runtime/controller, result transforms, chart controls, stage"
  },
  {
    path: "app-views/categories/new-tab/procedures/library.ts",
    lines: "1,017",
    concern: "Sixty-five exports spanning resources, templates, connectors, drafts, and recents.",
    split: "delete unused mock subjects; typed launcher procedures only"
  },
  {
    path: "app-views/categories/document-editor/content/document.svelte",
    lines: "892 / 472 script",
    concern: "ProseMirror lifecycle, projection, comments, selection bridge, sizing, zoom, and eleven effects.",
    split: "editor adapter state, dispatch, paint, selection effects, pin layout, viewport effects"
  },
  {
    path: "app-views/categories/spreadsheet-editor/content/sheet.svelte",
    lines: "766 / 515 script",
    concern: "The component is simultaneously fixture store, read API, state owner, editor logic, and view.",
    split: "remove fixture repository; runtime adapter plus grid presentation"
  },
  {
    path: "components/authored/slide-surface/slide-surface.svelte",
    lines: "745 / 470 script",
    concern: "Pointer state machine, hit testing, geometry, cell selection, rendering, and overlay behavior.",
    split: "gesture state factory, pointer procedures, geometry, hit testing, surface markup"
  },
  {
    path: "app-views/categories/presentation-editor/content/presentation.svelte",
    lines: "719 / 519 script",
    concern: "Runtime binding, selection, edit commands, insertion, menus, sizing, and surface adaptation.",
    split: "presentation controller state, selection bridge, edit commands, viewport effects, stage"
  },
  {
    path: "representation/store/tables.ts",
    lines: "631",
    concern: "Forty-two table schemas and the central map live in one manually maintained registry.",
    split: "domain-owned table field files with a generated canonical map"
  }
];

export const MODEL_GRANULARITY = [
  {
    subject: "WorkspaceState",
    decision: "Keep, narrow",
    reason: "It has a clear client lifetime and owns correlated tab state, but generic queries should leave."
  },
  {
    subject: "Document / presentation / spreadsheet runtimes",
    decision: "Keep separate",
    reason: "Each owns independent resource identity, buffering, history, and subject semantics. Structural parity is better than a forced shared superclass."
  },
  {
    subject: "TabList + TabViews",
    decision: "Keep private for now",
    reason: "They are small, but hidden behind one coordinator and each maintains a coherent invariant. Do not expose them or copy this split casually."
  },
  {
    subject: "Storage",
    decision: "Integrate or remove",
    reason: "It is constructed but has no production consumer. A state owner without owned behavior is a placeholder."
  },
  {
    subject: "Component-local controller",
    decision: "Not a global model",
    reason: "It is the correct owner for DOM refs, pointer gestures, hover, and unsaved drafts, but its state and procedures should still be colocated outside markup."
  },
  {
    subject: "Project data queries",
    decision: "One coherent owner",
    reason: "Use typed subject queries behind a project-lifetime registry or runtimes; avoid both one model per query and a raw 42-table workspace cache."
  }
] as const;

export const TARGET_SHAPE = [
  "component.svelte — props, controller construction, derived presentation, markup bindings",
  "component/state.svelte.ts — only component-instance state and derived accessors",
  "component/procedures/<command>.ts — one named interaction or procedure chain",
  "component/procedures/effects/<effect>.svelte.ts — one named lifecycle synchronization",
  "model/<object>/definition.svelte.ts — owned state, derived accessors, thin public delegation",
  "model/<object>/methods/<method>.ts — state transition or coordination chain",
  "capabilities/<subject>/api/<procedure>/<procedure>.ts — scoped, validated server action",
  "model/server/<resource> — process resource, persistence adapter, and transaction boundary"
] as const;

export const GUARDRAILS: readonly Guardrail[] = [
  {
    name: "production-svelte-imports-no-capability",
    catches: "Remote commands, error handling, and refresh sequences embedded in markup components.",
    rule: "No production .svelte file imports an executable capability; named component procedures own the crossing."
  },
  {
    name: "component-effects-have-a-home",
    catches: "Anonymous lifecycle synchronization and effect-heavy component scripts.",
    rule: "$effect, $effect.pre, onMount, and onDestroy are not declared anonymously beside markup."
  },
  {
    name: "mutable-state-has-an-instance",
    catches: "Module globals that escape client, workspace, resource, or component lifetime.",
    rule: "Mutable module bindings are limited to explicit runtime holders and factory-local closures."
  },
  {
    name: "model-definitions-delegate",
    catches: "Procedure chains hidden in files that claim to define state and surface only.",
    rule: "Every public definition method delegates to a same-named entry imported from its methods/ tree."
  },
  {
    name: "runtime-lifecycle-follows-tabs",
    catches: "Render-time attach calls, retained closed resources, and duplicate synchronization.",
    rule: "Only canonical workspace operation/adoption procedures and client shutdown may acquire or release a resource runtime."
  },
  {
    name: "generic-browser-mutations-do-not-exist",
    catches: "Subject, authorization, and validation bypass through arbitrary store paths.",
    rule: "Capability exports contain no generic create/update/remove operation."
  },
  {
    name: "capability-scope-is-consumed",
    catches: "A procedure calling requireScope only to satisfy ordering while discarding authority.",
    rule: "Every scoped data action binds and subsequently consumes the identity/project values returned by requireScope."
  },
  {
    name: "production-views-have-no-fixture-repositories",
    catches: "Canned IDs and fake Read<T> facades masquerading as application state.",
    rule: "Fixture repositories are legal only under development-views and test."
  },
  {
    name: "source-complexity-is-reviewed",
    catches: "Extracted monoliths and controller scripts before they become category-scale files.",
    rule: "Require review above 300 script/procedure lines or 20 exports, and forbid ungenerated hand-authored sources over 800 lines."
  },
  {
    name: "multi-table-intent-is-atomic",
    catches: "Partially persisted creation, comments, and revision history.",
    rule: "Fault-injection tests prove every multi-table capability commits all or none."
  }
];

export const REMEDIATION: readonly RemediationPhase[] = [
  {
    phase: "01 — Close the unsafe write door",
    objective: "Restore subject authority before reorganizing code.",
    changes: [
      "Move document, presentation, and general comment writes to Comments capability.",
      "Add any missing typed comment reads and refresh behavior.",
      "Delete generic create/update/remove and their legacy types/tests.",
      "Add cross-project refusal tests and the generic-mutation guardrail."
    ]
  },
  {
    phase: "02 — Make persistence atomic",
    objective: "Let the model that owns persistence uphold capability intent.",
    changes: [
      "Move each multi-write capability onto StoreModel's transaction/unit-of-work API.",
      "Move create resource, comment, and revision commits onto it.",
      "Add a capability-specific failure-injection contract for every migrated intent."
    ]
  },
  {
    phase: "03 — Repair client ownership",
    objective: "Make workspace and resource lifetimes true rather than documented aspirations.",
    changes: [
      "Acquire/release runtimes from workspace tab operations.",
      "Expose non-mutating runtime lookup to views.",
      "Wire SpreadsheetRuntime through the same complete path.",
      "Move correlated tab/resource state out of remounted components."
    ]
  },
  {
    phase: "04 — Narrow the workspace and remove false state",
    objective: "Give every durable read and client preference one explicit owner.",
    changes: [
      "Keep browser reads on typed subject projections and their explicit lifetime owners.",
      "Move query lifetime to one coherent project-data owner or resource runtime.",
      "Integrate or delete Storage and move Appearance into the client graph.",
      "Delete production mock repositories as real subjects arrive."
    ]
  },
  {
    phase: "05 — Extract component controllers",
    objective: "Make a component readable as presentation and its behavior readable as named chains.",
    changes: [
      "Start with document, presentation, slide-surface, template inspector, and spreadsheet.",
      "Create component-instance state modules and named effects.",
      "Move direct capability calls and async command state behind procedures.",
      "Split category-scale procedure repositories by entry and responsibility."
    ]
  },
  {
    phase: "06 — Ratchet and reconcile",
    objective: "Turn the desired shape into a repository property.",
    changes: [
      "Land the new lint rules with mutation tests.",
      "Reconcile architecture documents with the current graph.",
      "Generate volatile inventories instead of maintaining counts in prose.",
      "Use the scorecard on every new editor or capability review."
    ]
  }
];

export const gradeClass = (grade: AuditGrade): string => grade.toLowerCase();
