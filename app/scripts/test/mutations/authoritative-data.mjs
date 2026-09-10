export const MUTATIONS = [
  {
    check: "production-views-have-no-fixture-repositories",
    says: "a production view invents persistent-looking records",
    names: "procedures/fake-repository.ts",
    changes: [{
      path: "src/lib/app-views/categories/project-overview/procedures/fake-repository.ts",
      write: `export const rows = [{ id: "mock-one" }, { id: "mock-two" }, { id: "mock-three" }];\n`
    }]
  },
  {
    check: "development-fixtures-stay-in-development",
    says: "a fixture module is placed under a production view",
    names: "fixtures/probe.ts",
    changes: [{
      path: "src/lib/app-views/categories/project-overview/fixtures/probe.ts",
      write: `export const fixture = { id: "probe" };\n`
    }]
  },
  {
    check: "constructed-subject-runtime-is-reachable",
    says: "a subject runtime register has no workspace or editor consumer",
    names: "model/client/data-probe-runtimes",
    changes: [{
      path: "src/lib/model/client/data-probe-runtimes/index.ts",
      write: `export const createDataProbeRuntimes = (): object => ({});\n`
    }]
  },
  {
    check: "resource-id-selects-the-rendered-body",
    subject: "source-flow",
    says: "a resource runtime has no identity-to-render flow",
    names: "model/client/identity-probe-runtimes",
    changes: [{
      path: "src/lib/model/client/identity-probe-runtimes/index.ts",
      write: `export const createIdentityProbeRuntimes = (): object => ({});\n`
    }]
  },
  {
    check: "unsupported-subject-is-explicit",
    subject: "readiness-is-declared",
    says: "a category is added without a readiness declaration",
    names: "configuration/category-readiness.yaml",
    changes: [{
      path: "src/lib/app-views/categories/readiness-probe/content/probe.svelte",
      write: `<div>Probe</div>\n`
    }]
  },
  {
    check: "unsupported-subject-is-explicit",
    subject: "readiness-is-declared",
    says: "the readiness inventory cannot retain a removed category",
    names: "configuration/category-readiness.yaml",
    changes: [{
      path: "configuration/category-readiness.yaml",
      edit: (before) => `${before}  removed-probe: unavailable\n`
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a new compatibility reader cannot preserve an old schema",
    names: "procedures/legacy-row.ts",
    changes: [{
      path: "src/lib/app-views/categories/project-overview/procedures/legacy-row.ts",
      write: `export type LegacyRow = { readonly id: string };\nexport const readLegacy = (row: LegacyRow): string => row.id;\n`
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "an operational migration shim cannot preserve a retired data shape",
    names: "scripts/generation/across/migrate-probe.mjs",
    changes: [{
      path: "scripts/generation/across/migrate-probe.mjs",
      write: `export const migrateLegacyRows = (rows) => rows.map((row) => ({ ...row, revision: row.revision ?? 1 }));\n`
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a retired neutral field cannot return under a current-looking name",
    names: "representation/store/tables.ts",
    changes: [{
      path: "src/lib/representation/store/tables.ts",
      edit: (before) => before.replace(
        "export type DocumentFields = {",
        'export type DocumentFields = {\n  templateId?: Id<"templates">;'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a current discriminator cannot become an absence-based compatibility branch",
    names: "representation/data/types/templates/template.ts",
    changes: [{
      path: "src/lib/representation/data/types/templates/template.ts",
      edit: (before) => before.replace(
        "kind: TemplateHoleKind;",
        "kind?: TemplateHoleKind;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "the current resource-kind vocabulary cannot be reopened to arbitrary strings",
    names: "representation/data/types/core/resource.ts",
    changes: [{
      path: "src/lib/representation/data/types/core/resource.ts",
      edit: (before) => before.replace(
        /export type ResourceKind =[\s\S]*?\n  \| ExternalFileResourceKind;/,
        "export type ResourceKind = string;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a specific resource reference cannot regain the bare external-file family alias",
    names: "representation/data/types/core/resource.ts",
    changes: [{
      path: "src/lib/representation/data/types/core/resource.ts",
      edit: (before) => before.replace(
        "export type ResourceRef =\n",
        'export type ResourceRef =\n  | { kind: "externalFile"; id: Id<"externalFiles"> }\n'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a reader cannot default an absent current discriminator",
    names: "query-semantic-overlay.ts",
    changes: [{
      path: "src/lib/capabilities/semantic-overlay/api/query-semantic-overlay/query-semantic-overlay.ts",
      edit: (before) => before.replace(
        'row.projectId === projectId && row.lane === "text"',
        'row.projectId === projectId && (row.lane ?? "text") === "text"'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a durable refresh cannot nullish-default its required request version",
    names: "derived-output/api/shared/refresh-queue.ts",
    changes: [{
      path: "src/lib/capabilities/derived-output/api/shared/refresh-queue.ts",
      edit: (before) => before.replace(
        "const currentVersion = requestedVersionOf(existing);",
        "const currentVersion = existing.requestedVersion ?? 1;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a private template scope cannot conditionally invent a revision",
    names: "templates/api/shared/scopes.ts",
    changes: [{
      path: "src/lib/capabilities/templates/api/shared/scopes.ts",
      edit: (before) => before.replace(
        "const revision = Number(row.revision);",
        'const revision = typeof row.revision === "number" ? row.revision : 1;'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a document leader cannot pass through a named default helper",
    names: "document/api/submit-document-changes/submit-document-changes.ts",
    changes: [{
      path: "src/lib/capabilities/document/api/submit-document-changes/submit-document-changes.ts",
      edit: (before) => before.replace(
        "const revision = leader.revision;",
        "const revision = defaultTo(leader.revision, 0);"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a detached template prompt cannot fall back to display text",
    names: "templates/api/shared/prompts.ts",
    changes: [{
      path: "src/lib/capabilities/templates/api/shared/prompts.ts",
      edit: (before) => before.replace(
        "const asked = value.prompt.trim();",
        "const asked = (value.prompt ?? value.display).trim();"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a stored persona cannot regain an empty-tools absence repair",
    names: "agents/api/shared/projection.ts",
    changes: [{
      path: "src/lib/capabilities/agents/api/shared/projection.ts",
      edit: (before) => before.replace(
        "tools: orderedTools(persona.tools),",
        "tools: orderedTools(persona.tools ?? []),"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a stored task cannot regain an empty-tools absence repair",
    names: "agents/api/shared/task-projection.ts",
    changes: [{
      path: "src/lib/capabilities/agents/api/shared/task-projection.ts",
      edit: (before) => before.replace(
        "tools: orderedTools(task.tools),",
        "tools: orderedTools(task.tools ?? []),"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a research persona cannot regain an empty-tools absence repair",
    names: "research-chat/api/ask/ask.ts",
    changes: [{
      path: "src/lib/capabilities/research-chat/api/ask/ask.ts",
      edit: (before) => before.replace(
        "orderedTools(persona.tools);",
        "orderedTools(persona.tools ?? []);"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "project activity cannot synthesize a missing stored actor label",
    names: "project/api/shared/projection.ts",
    changes: [{
      path: "src/lib/capabilities/project/api/shared/projection.ts",
      edit: (before) => `${before}\nconst repairedActorLabel = (row) => row.actorLabel ?? "Someone";\n`
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "project comments cannot repair missing required remark fields",
    names: "project/api/read-project-comment/read-project-comment.ts",
    changes: [{
      path: "src/lib/capabilities/project/api/read-project-comment/read-project-comment.ts",
      edit: (before) => `${before}\nconst repairedComment = (row) => ({ blocks: row.blocks ?? [], author: row.author ?? { kind: "system" } });\n`
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "project resources cannot repair an incomplete leader snapshot or body",
    names: "project/api/read-project-resource/read-project-resource.ts",
    changes: [{
      path: "src/lib/capabilities/project/api/read-project-resource/read-project-resource.ts",
      edit: (before) => `${before}\nconst repairedSnapshot = (row, body) => ({ role: row.role ?? "leader", revision: row.revision ?? 0, body: row.body ?? {}, rows: body.rows ?? [], slides: body.slides ?? [], columns: body.columns ?? [] });\n`
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a formula row cannot nullish-default its required use list",
    names: "spreadsheet/api/shared/answering.ts",
    changes: [{
      path: "src/lib/capabilities/spreadsheet/api/shared/answering.ts",
      edit: (before) => before.replace(
        "const usesById = new Map(held.map((row) => [row._id, row.usedBy]));",
        "const usesById = new Map(held.map((row) => [row._id, row.usedBy ?? []]));"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "client storage cannot partially repair required panel geometry",
    names: "model/client/storage/methods/serialize.ts",
    changes: [{
      path: "src/lib/model/client/storage/methods/serialize.ts",
      edit: (before) => before.replace(
        "const contextWidth = width(value.contextWidth);",
        "const contextWidth = width(value.contextWidth) ?? 320;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "client storage cannot make required current panel geometry optional",
    names: "model/client/storage/types.ts",
    changes: [{
      path: "src/lib/model/client/storage/types.ts",
      edit: (before) => before.replace(
        "readonly contextWidth: number;",
        "readonly contextWidth?: number;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Store load cannot bypass recursive current-row admission",
    names: "model/server/store/methods/shared/load.server.ts",
    changes: [{
      path: "src/lib/model/server/store/methods/shared/load.server.ts",
      edit: (before) => before.replace(
        "tables.set(table, admitAnyRows(table, stored));",
        "tables.set(table, stored);"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Store row replacement cannot bypass recursive current-row admission",
    names: "model/server/store/methods/shared/state.ts",
    changes: [{
      path: "src/lib/model/server/store/methods/shared/state.ts",
      edit: (before) => before.replace(
        "const current = admitAnyRows(table, rows);",
        "const current = rows;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Store commit cannot publish a staged table without re-admission",
    names: "model/server/store/methods/transaction/commit.server.ts",
    changes: [{
      path: "src/lib/model/server/store/methods/transaction/commit.server.ts",
      edit: (before) => before.replace(
        "rows: admitAnyRows(table, unit.tables.get(table) ?? [])",
        "rows: unit.tables.get(table) ?? []"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Store recovery cannot apply journal rows without re-admission",
    names: "model/server/store/methods/transaction/journal.server.ts",
    changes: [{
      path: "src/lib/model/server/store/methods/transaction/journal.server.ts",
      edit: (before) => before.replace(
        "return admitAnyRows(table, value);",
        "return value;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "the recursive Store validator registry cannot omit a represented table",
    names: "representation/store/current-values.ts",
    changes: [{
      path: "src/lib/representation/store/current-values.ts",
      edit: (before) => before.replace("  activity: isStoredAgentActivity,\n", "")
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "the recursive Store validator registry cannot default an unregistered table to valid",
    names: "representation/store/current-values.ts",
    changes: [{
      path: "src/lib/representation/store/current-values.ts",
      edit: (before) => before.replace(
        "CURRENT_ROW_VALUE_VALIDATORS[table](value);",
        "CURRENT_ROW_VALUE_VALIDATORS[table]?.(value) ?? true;"
      )
    }]
  }
];
