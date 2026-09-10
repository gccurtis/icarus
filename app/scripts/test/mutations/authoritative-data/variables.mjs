export const VARIABLES_MUTATIONS = [
  {
    check: "legacy-schema-support-does-not-exist",
    says: "variable read admission cannot accept an open command",
    names: "capabilities/variables/api/read-variables/validate-read-variables.ts",
    changes: [{
      path: "src/lib/capabilities/variables/api/read-variables/validate-read-variables.ts",
      edit: (before) => before.replace(
        "!hasExactFields(fields, [])",
        "Object.keys(fields).length !== 0"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "variable save admission cannot accept a lossy nested value",
    names: "capabilities/variables/api/save-variable/validate-save-variable.ts",
    changes: [{
      path: "src/lib/capabilities/variables/api/save-variable/validate-save-variable.ts",
      edit: (before) => before.replace(
        "!isStoredJson(fields.value) || !currentFormulaValue(fields.value)",
        "!currentFormulaValue(fields.value)"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "variable remove admission cannot accept unknown own fields",
    names: "capabilities/variables/api/remove-variable/validate-remove-variable.ts",
    changes: [{
      path: "src/lib/capabilities/variables/api/remove-variable/validate-remove-variable.ts",
      edit: (before) => before.replace(
        'hasExactFields(fields, ["name"])',
        'Object.hasOwn(fields, "name")'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "variable command admission cannot lose its executable exactness contract",
    names: "capabilities/variables/test/unit/command-admission.test.ts",
    changes: [{
      path: "src/lib/capabilities/variables/test/unit/command-admission.test.ts",
      edit: (before) => before.replace(
        'it("rejects legacy, mixed, lossy, and wrongly namespaced nested values"',
        'it("checks nested values"'
      )
    }]
  }
];
