export const CONTENT_ADMISSION_MUTATIONS = [
  {
    check: "legacy-schema-support-does-not-exist",
    says: "formula-atom admission cannot accept stale state",
    names: "representation/data/behavior/content/admission-inline.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/content/admission-inline.ts",
      edit: (before) => before.replace(
        'atom.state === "fresh";',
        '["fresh", "stale"].includes(String(atom.state));'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "formula-atom admission cannot accept a retired error field",
    names: "representation/data/behavior/content/admission-inline.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/content/admission-inline.ts",
      edit: (before) => before.replace(
        '["formulaId"]\n    )',
        '["formulaId", "error"]\n    )'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "formula-block admission cannot restore resolvedAt",
    names: "representation/data/behavior/content/admission.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/content/admission.ts",
      edit: (before) => before.replace(
        '["formulaId", "format"]',
        '["formulaId", "resolvedAt", "format"]'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "formula-block admission cannot accept a retired error field",
    names: "representation/data/behavior/content/admission.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/content/admission.ts",
      edit: (before) => before.replace(
        '["formulaId", "format"]',
        '["formulaId", "error", "format"]'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "formula-block admission cannot accept an in-progress state",
    names: "representation/data/behavior/content/admission.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/content/admission.ts",
      edit: (before) => before.replace(
        'block.state === "fresh" &&',
        '["fresh", "computing"].includes(String(block.state)) &&'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "formula admission cannot lose its executable fresh-only contract",
    names: "representation/data/behavior/content/test/unit/admission.test.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/content/test/unit/admission.test.ts",
      edit: (before) => before.replace(
        'it("admits only the current resolved formula snapshot"',
        'it("checks formulas"'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "prompt admission cannot infer link ownership from a defined value",
    names: "representation/data/behavior/content/admission.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/content/admission.ts",
      edit: (before) => before.replace(
        'const linked = Object.hasOwn(block, "derivedOutputId");',
        "const linked = block.derivedOutputId !== undefined;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "unlinked prompt admission cannot accept a stale lifecycle",
    names: "representation/data/behavior/content/admission.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/content/admission.ts",
      edit: (before) => before.replace(
        'block.state !== "idle" ||',
        '!["idle", "stale"].includes(String(block.state)) ||'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "fresh linked prompt admission cannot make refreshedAt optional",
    names: "representation/data/behavior/content/admission.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/content/admission.ts",
      edit: (before) => before.replace(
        'exact(block, [...linkedBase, "refreshedAt"], presentation)',
        'exact(block, linkedBase, [...presentation, "refreshedAt"])'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "idle linked prompt admission cannot accept a refresh timestamp",
    names: "representation/data/behavior/content/admission.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/content/admission.ts",
      edit: (before) => before.replace(
        'exact(block, linkedBase, presentation)',
        'exact(block, linkedBase, [...presentation, "refreshedAt"])'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "errored linked prompt admission cannot make error text optional",
    names: "representation/data/behavior/content/admission.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/content/admission.ts",
      edit: (before) => before.replace(
        'exact(block, [...linkedBase, "error"], [...presentation, "refreshedAt"])',
        'exact(block, linkedBase, [...presentation, "error", "refreshedAt"])'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "linked prompt admission cannot retain an inline prompt definition",
    names: "representation/data/behavior/content/admission.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/content/admission.ts",
      edit: (before) => before.replace(
        'const presentation = ["style", "hole", "format"];',
        'const presentation = ["style", "prompt", "hole", "format"];'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "prompt admission cannot lose its executable exact lifecycle contract",
    names: "representation/data/behavior/content/test/unit/admission.test.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/content/test/unit/admission.test.ts",
      edit: (before) => before.replace(
        'it("admits each complete prompt lifecycle arm and rejects partial or mixed arms"',
        'it("checks prompt blocks"'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "shared content admission cannot ignore hidden or symbolic own fields",
    names: "representation/data/behavior/content/admission-values.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/content/admission-values.ts",
      edit: (before) => before.replace(
        "): boolean => hasExactFields(value, required, optional);",
        "): boolean => true;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "content record admission cannot bypass the shared strict plain-record gate",
    names: "representation/data/behavior/content/admission-values.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/content/admission-values.ts",
      edit: (before) => before.replace(
        "export const recordOf = (value: unknown): Fields | undefined => storedFields(value);",
        "export const recordOf = (value: unknown): Fields | undefined => value as Fields;"
      )
    }]
  }
];
