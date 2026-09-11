export const CORE_MUTATIONS = [
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
    says: "the current external-file subtype vocabulary cannot silently accept an unregistered shape",
    names: "representation/data/types/core/resource.ts",
    changes: [{
      path: "src/lib/representation/data/types/core/resource.ts",
      edit: (before) => before.replace(
        '  | "unknown";',
        '  | "unknown"\n  | "archive";'
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
    says: "a private Resource Set owner cannot restore its retired bare resource id",
    names: "representation/data/types/core/resource-set.ts",
    changes: [{
      path: "src/lib/representation/data/types/core/resource-set.ts",
      edit: (before) => before.replace(
        '| { kind: "resource"; ref: ResourceRef; slot: string };',
        '| { kind: "resource"; resourceId: string; slot: string };'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "private Resource Set admission cannot trust an unproved structural reference",
    names: "representation/data/behavior/core/resource-set-rows.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/core/resource-set-rows.ts",
      edit: (before) => before.replace(
        'ref: admitResourceRef(owner.ref, `${subject}.boundTo.ref`),',
        "ref: owner.ref,"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "stored change-set admission cannot restore an optional set-target mode",
    names: "representation/data/behavior/core/stored-change-set.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/core/stored-change-set.ts",
      edit: (before) => before.replace(
        "  readonly setTargets: readonly string[];",
        "  readonly setTargets: readonly string[];\n  readonly setTargetOptional?: boolean;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "stored set admission cannot move target from required to optional fields",
    names: "representation/data/behavior/core/stored-change-set.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/core/stored-change-set.ts",
      edit: (before) => before.replace(
        'hasExactFields(op, ["op", "target", "path", "value", "was"])',
        'hasExactFields(op, ["op", "path", "value", "was"], ["target"])'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "shared stored-value admission cannot ignore hidden or symbolic own fields",
    names: "representation/data/behavior/core/stored.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/core/stored.ts",
      edit: (before) => before.replace(
        "const fields = Reflect.ownKeys(value);",
        "const fields = Object.keys(value);"
      )
    }]
  }
];
