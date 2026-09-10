export const WORKSPACE_MUTATIONS = [
  {
    check: "legacy-schema-support-does-not-exist",
    says: "workspace restore cannot synthesize a missing current revision",
    names: "workspace-state/methods/shared/adopt.ts",
    changes: [{
      path: "src/lib/model/client/workspace-state/methods/shared/adopt.ts",
      edit: (before) => before.replace(
        "isStoredNatural(row.revision) &&",
        "isStoredNatural(row.revision ?? 0) &&"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "workspace admission cannot synthesize a missing current tab list",
    names: "representation/data/behavior/workspace/stored-rows.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/workspace/stored-rows.ts",
      edit: (before) => before.replace(
        "const tabs = row.tabs as Array<{ id: string; category: Category }>;",
        "const tabs = (row.tabs ?? []) as Array<{ id: string; category: Category }>;"
      )
    }]
  }
];
