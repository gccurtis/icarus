export const STORE_MUTATIONS = [
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
      edit: (before) => before.replace("  activity: isStoredActivity,\n", "")
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
