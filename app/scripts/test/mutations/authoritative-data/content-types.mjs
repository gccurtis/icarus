export const CONTENT_TYPES_MUTATIONS = [
  {
    check: "legacy-schema-support-does-not-exist",
    says: "formula atoms cannot restore a stale lifecycle state",
    names: "representation/data/types/content/content-block.ts",
    changes: [{
      path: "src/lib/representation/data/types/content/content-block.ts",
      edit: (before) => before.replace(
        '  lastResolvedDisplay: string;\n  state: "fresh";',
        '  lastResolvedDisplay: string;\n  state: "fresh" | "stale";'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "formula atoms cannot restore a lifecycle error field",
    names: "representation/data/types/content/content-block.ts",
    changes: [{
      path: "src/lib/representation/data/types/content/content-block.ts",
      edit: (before) => before.replace(
        '  lastResolvedDisplay: string;\n  state: "fresh";',
        '  lastResolvedDisplay: string;\n  error?: string;\n  state: "fresh";'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "formula blocks cannot restore a resolvedAt field",
    names: "representation/data/types/content/content-block.ts",
    changes: [{
      path: "src/lib/representation/data/types/content/content-block.ts",
      edit: (before) => before.replace(
        '  state: "fresh";\n  format?: BlockFormat;',
        '  state: "fresh";\n  resolvedAt?: number;\n  format?: BlockFormat;'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "formula blocks cannot restore an in-progress lifecycle state",
    names: "representation/data/types/content/content-block.ts",
    changes: [{
      path: "src/lib/representation/data/types/content/content-block.ts",
      edit: (before) => before.replace(
        '  value: FormulaValue;\n  state: "fresh";',
        '  value: FormulaValue;\n  state: "fresh" | "computing";'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "formula blocks cannot restore a lifecycle error field",
    names: "representation/data/types/content/content-block.ts",
    changes: [{
      path: "src/lib/representation/data/types/content/content-block.ts",
      edit: (before) => before.replace(
        '  value: FormulaValue;\n  state: "fresh";',
        '  value: FormulaValue;\n  error?: string;\n  state: "fresh";'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "an unlinked prompt type cannot admit an explicit undefined link discriminator",
    names: "representation/data/types/content/content-block.ts",
    changes: [{
      path: "src/lib/representation/data/types/content/content-block.ts",
      edit: (before) => before.replace(
        "  derivedOutputId?: never;",
        "  derivedOutputId?: undefined;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "prompt state cannot restore an in-progress lifecycle arm",
    names: "representation/data/types/content/content-block.ts",
    changes: [{
      path: "src/lib/representation/data/types/content/content-block.ts",
      edit: (before) => before.replace(
        'export type PromptState = "idle" | "fresh" | "stale" | "error";',
        'export type PromptState = "idle" | "fresh" | "stale" | "error" | "generating";'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "an unlinked prompt cannot claim a linked stale lifecycle",
    names: "representation/data/types/content/content-block.ts",
    changes: [{
      path: "src/lib/representation/data/types/content/content-block.ts",
      edit: (before) => before.replace(
        'type UnlinkedPromptLifecycle = {\n  state: "idle";',
        'type UnlinkedPromptLifecycle = {\n  state: "idle" | "stale";'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a fresh linked prompt must retain its required refresh timestamp",
    names: "representation/data/types/content/content-block.ts",
    changes: [{
      path: "src/lib/representation/data/types/content/content-block.ts",
      edit: (before) => before.replace(
        '| { state: "fresh"; error?: never; refreshedAt: number }',
        '| { state: "fresh"; error?: never; refreshedAt?: number }'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "an errored linked prompt must retain its required error text",
    names: "representation/data/types/content/content-block.ts",
    changes: [{
      path: "src/lib/representation/data/types/content/content-block.ts",
      edit: (before) => before.replace(
        '| { state: "error"; error: string; refreshedAt?: number };',
        '| { state: "error"; error?: string; refreshedAt?: number };'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a linked prompt type cannot retain inline scope ownership",
    names: "representation/data/types/content/content-block.ts",
    changes: [{
      path: "src/lib/representation/data/types/content/content-block.ts",
      edit: (before) => before.replace(
        'export type LinkedPromptBlock = PromptBlockBase<LinkedPromptLifecycle> & {\n  derivedOutputId: Id<"derivedOutputs">;\n  scope?: never;',
        'export type LinkedPromptBlock = PromptBlockBase<LinkedPromptLifecycle> & {\n  derivedOutputId: Id<"derivedOutputs">;\n  scope?: ResourceSet;'
      )
    }]
  }
];
