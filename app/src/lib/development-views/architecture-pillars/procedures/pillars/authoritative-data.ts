import type { ArchitecturePillar } from "$development-views/architecture-pillars/types";

export const AUTHORITATIVE_DATA: ArchitecturePillar = {
  code: "PIL-07",
  slug: "authoritative-data",
  name: "Production data has an authoritative source",
  short: "A convincing fixture is not application state; every live resource must resolve to represented state.",
  thesis:
    "Production views must not simulate repositories. A resource identifier, runtime body, capability projection, and durable row must form one traceable vertical slice—or the product should explicitly say the subject is not implemented.",
  supports:
    "This prevents dead links, false confidence in unimplemented editors, conflicting sources of truth, and UI behavior that cannot survive navigation or reload.",
  contract: [
    "Every resource rendered in a production view originates from a typed capability projection or subject runtime.",
    "The resource id supplied by the workspace materially selects the loaded body.",
    "Fixture repositories and fake Read<T> facades live only under development-views or tests.",
    "A runtime constructed in the client graph is wired through workspace lifecycle to its production surface.",
    "Unimplemented subjects render an explicit unavailable state; they do not impersonate a persistent editor.",
    "Only the current represented schema is accepted; old forms are removed rather than decoded, migrated, or normalized."
  ],
  example: {
    title: "The spreadsheet editor is its own canned repository",
    source: "app-views/categories/spreadsheet-editor/content/sheet.svelte",
    shape: `type Read<T> = { current: T; loading: false; ... }
read(current) → fake query facade
CELLS / records / styles → module constants
sheet view → renders constants, not SpreadsheetRuntime.body`,
    observed:
      "SpreadsheetRuntimes is constructed and returned by ClientModel, but WorkspaceState cannot hand it to the editor and no production consumer uses it. The live sheet component defines cell records, errors, objects, named styles, and a no-op refresh locally.",
    antagonism:
      "The visible editor appears data-backed while the resource id and server state have no authority over it. Tests can pass against a UI that has no real load, edit, revision, or persistence path.",
    repair:
      "Complete one vertical slice: typed spreadsheet read/write capability, runtime synchronization, workspace acquire/lookup/release, and a surface adapter that renders runtime.body. Move fixtures to the demo tree and show unavailable until that path exists.",
    nuance:
      "Development reference pages should keep rich fixtures—they are explicitly outside production. The boundary is whether a normal app route can mistake a fixture for represented user data."
  },
  equivalence: {
    rule: "A production surface presents records or resource identity that no authoritative runtime/capability/server state owns.",
    generalRepair:
      "Move fixtures out of production, wire the subject from representation to capability to runtime to view, and make unsupported states explicit until the vertical path is complete.",
    members: [
      "Fake Read<T> wrappers around constants",
      "Invented persistent ids in production navigation",
      "A resource editor that ignores its resource id",
      "A constructed runtime with no production surface consumer",
      "No-op refresh or save controls that imply durability"
    ]
  },
  desiredFlow: [
    "Workspace tab carries a real resource id",
    "Workspace acquires the subject runtime for that id",
    "Runtime loads a typed projection/snapshot through the subject capability",
    "Surface renders runtime body and submits edits back through the same subject",
    "Demo/test fixtures exercise the surface through props without entering production routes"
  ],
  checkers: [
    {
      id: "DATA-01",
      name: "production-views-have-no-fixture-repositories",
      status: "Enforced",
      wave: 1,
      mechanism: "AST + naming/type heuristics",
      guarantee: "Production view modules do not define durable-looking repositories or query facades from constants.",
      detects: "Fake Read<T>, no-op refresh, named arrays of id-bearing resource records, and repeated invented persistent-looking ids in production view trees.",
      implementation:
        "Start with high-confidence patterns and an explicit development/test home rule. Report module constants that satisfy represented record shapes or expose query-like interfaces.",
      current: "Enforced through repository-shape and record-array scans; seven production fixture repositories are baselined.",
      limit: "Static option lists and UI examples are legitimate constants. Findings should explain why a value resembles persistent subject data."
    },
    {
      id: "DATA-02",
      name: "development-fixtures-stay-in-development",
      status: "Enforced",
      wave: 1,
      mechanism: "Import graph + source-home scan",
      guarantee: "Fixtures can be rich but cannot flow into an app route or production view.",
      detects: "Production imports from development-views/test and fixture directories outside those homes.",
      implementation:
        "Retain surfaces/nothing-imports-development and extend module-home rules so files explicitly classified as fixtures are legal only in development/test trees.",
      current: "Enforced for fixture homes and imports; one production route importing a development fixture is baselined.",
      limit: "Moving constants without changing the production import would still fail; the desired result is a real data source or explicit unavailable state."
    },
    {
      id: "DATA-03",
      name: "constructed-subject-runtime-is-reachable",
      status: "Enforced",
      wave: 1,
      mechanism: "Client model-object + production import graph",
      guarantee: "Every client *-runtimes model directory has a production consumer outside runtime and its own object tree.",
      detects: "Disconnected subject runtimes such as SpreadsheetRuntimes and partially wired future editors.",
      implementation:
        "Enumerate client model directories ending in -runtimes and require at least one direct production import from workspace or an editor-facing source outside runtime and the register itself.",
      current: "Enforced through runtime-to-production reachability; SpreadsheetRuntimes remains baselined.",
      limit: "Reachability does not prove the resource id controls the data; DATA-04 supplies the behavioral assertion."
    },
    {
      id: "DATA-04",
      name: "resource-id-selects-the-rendered-body",
      status: "Enforced",
      wave: 2,
      mechanism: "Chromium contract test",
      guarantee: "Opening two known resource ids produces their two distinct represented bodies and no disconnected/loading-forever state.",
      detects: "Ignored ids, invented navigation ids, global singleton bodies, dead recent links, and runtime lookup failures.",
      implementation:
        "Seed two resources per editor, open each from every navigation entry, assert distinguishing content, switch tabs, and reload. Treat console errors and indefinite loading as failures.",
      current: "Enforced through source-flow and executable Chromium-contract registration; four gaps are baselined.",
      limit: "Use stable seeded markers rather than visual pixel comparisons so the test diagnoses identity, not layout."
    },
    {
      id: "DATA-05",
      name: "unsupported-subject-is-explicit",
      status: "Enforced",
      wave: 3,
      mechanism: "Readiness manifest + production source marker",
      guarantee: "Every current category has one readiness state, removed categories leave the inventory, and incomplete subjects visibly disclose their status.",
      detects: "Missing or stale readiness entries, non-live views without a status marker, and category/view status drift.",
      implementation:
        "Require an exact live/prototype/unavailable manifest entry for every category and a matching data-category-readiness marker in every non-live production content view.",
      current: "Enforced from the readiness manifest to rendered status markers; five prototype/unavailable views are baselined.",
      limit: "Readiness is a deliberate product declaration; the checker ensures the view matches it, not when a subject should ship."
    },
    {
      id: "DATA-06",
      name: "legacy-schema-support-does-not-exist",
      status: "Enforced",
      wave: 1,
      mechanism: "Production AST + source-path vocabulary",
      guarantee: "Production executable and type syntax contains no explicit legacy, compatibility, deprecated, or migration path, registered retired fields cannot return under neutral names, registered required current fields cannot become optional or be repaired when absent, and represented resource kinds and references stay closed and nominal.",
      detects: "Legacy-prefixed types and constants, compatibility or migration source paths, executable fallback discriminator strings, retired members on current schema types, optional or missing registered required fields, defaults applied to path-scoped current reads, an open ResourceKind, a bare external-file reference alias, and ResourceRef kind/id namespace drift.",
      implementation:
        "Parse identifiers, string literals, and registered current reads from production TypeScript, Svelte scripts, and top-level operational scripts; inspect source-path components; and compare current schema types with explicit retired-member, required-member, and path-plus-read registries. Comments and documentation do not count.",
      current: "Enforced; document leaders, template scopes and prompts, durable refresh jobs, Agents rows, spreadsheet snapshots and formulas, client storage, and the closed ResourceKind/ResourceRef contract now reject incomplete or mismatched current shapes instead of repairing them.",
      limit: "A retired neutral field must be added to the explicit registry when its schema is removed; review still rejects behavioral fallbacks that disguise compatibility without a known member."
    }
  ],
  rollout: [
    "Keep current-schema validation explicit whenever a representation changes; reject old shapes instead of adding readers.",
    "Move the seven production fixture repositories into development snapshots or replace them with represented reads.",
    "Complete the SpreadsheetRuntime workspace/view vertical slice and remove its reachability finding.",
    "Generate resource identity cases from seeded resources and category registrations for all three runtime families.",
    "Render the declared readiness state in each of the five prototype/unavailable category centers."
  ],
  relatedFindings: ["ARCH-04", "ARCH-07"]
};
