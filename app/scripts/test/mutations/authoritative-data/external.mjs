export const EXTERNAL_MUTATIONS = [
  {
    check: "legacy-schema-support-does-not-exist",
    says: "native External storage cannot ignore non-enumerable or symbolic stale fields",
    names: "model/server/external-file-storage/methods/shared/validation.ts",
    changes: [{
      path: "src/lib/model/server/external-file-storage/methods/shared/validation.ts",
      edit: (before) => before.replace(
        "const keys = Reflect.ownKeys(value);",
        "const keys = Object.keys(value);"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "native External storage cannot accept a custom-prototype record",
    names: "model/server/external-file-storage/methods/shared/validation.ts",
    changes: [{
      path: "src/lib/model/server/external-file-storage/methods/shared/validation.ts",
      edit: (before) => before.replace(
        "(prototype !== Object.prototype && prototype !== null) ||",
        "false ||"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "native External storage cannot invoke or accept an accessor field",
    names: "model/server/external-file-storage/methods/shared/validation.ts",
    changes: [{
      path: "src/lib/model/server/external-file-storage/methods/shared/validation.ts",
      edit: (before) => before.replace(
        'descriptor === undefined || !("value" in descriptor) ||',
        'descriptor === undefined ||'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "native External storage cannot accept a non-enumerable current field",
    names: "model/server/external-file-storage/methods/shared/validation.ts",
    changes: [{
      path: "src/lib/model/server/external-file-storage/methods/shared/validation.ts",
      edit: (before) => before.replace(
        "!descriptor.enumerable || ",
        ""
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "native External storage cannot accept explicit undefined",
    names: "model/server/external-file-storage/methods/shared/validation.ts",
    changes: [{
      path: "src/lib/model/server/external-file-storage/methods/shared/validation.ts",
      edit: (before) => before.replace(
        "descriptor.value === undefined;",
        "false;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "native External storage cannot accept a reference with stale extra fields",
    names: "model/server/external-file-storage/methods/shared/validation.ts",
    changes: [{
      path: "src/lib/model/server/external-file-storage/methods/shared/validation.ts",
      edit: (before) => before.replace(
        '  exactObject(ref, ["storageId", "hash", "size"], "external file storage reference");',
        "  descriptor(ref);"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "native External storage cannot accept a claim with stale extra fields",
    names: "model/server/external-file-storage/methods/shared/validation.ts",
    changes: [{
      path: "src/lib/model/server/external-file-storage/methods/shared/validation.ts",
      edit: (before) => before.replace(
        `  exactObject(
    claim,
    ["storageId", "hash", "size", "ownerId"],
    "external file storage claim"
  );`,
        "  descriptor(claim);"
      )
    }]
  }
];
