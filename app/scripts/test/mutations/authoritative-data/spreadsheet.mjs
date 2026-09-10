export const SPREADSHEET_MUTATIONS = [
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
  }
];
