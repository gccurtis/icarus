export const PROJECT_MUTATIONS = [
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
  }
];
