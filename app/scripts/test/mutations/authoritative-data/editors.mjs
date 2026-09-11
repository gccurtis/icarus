export const EDITORS_MUTATIONS = [
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a retired neutral field cannot return under a current-looking name",
    names: "representation/store/tables/editors.ts",
    changes: [{
      path: "src/lib/representation/store/tables/editors.ts",
      edit: (before) => before.replace(
        "export type DocumentFields = {",
        'export type DocumentFields = {\n  templateId?: Id<"templates">;'
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
    says: "a slide set operation cannot make its target discriminator optional",
    names: "representation/data/types/presentations/op.ts",
    changes: [{
      path: "src/lib/representation/data/types/presentations/op.ts",
      edit: (before) => before.replace(
        '{ op: "set"; target: PresentationSetTarget;',
        '{ op: "set"; target?: PresentationSetTarget;'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "document read admission cannot accept another resource namespace",
    names: "capabilities/document/api/read-document-body/validate-read-document-body.ts",
    changes: [{
      path: "src/lib/capabilities/document/api/read-document-body/validate-read-document-body.ts",
      edit: (before) => before.replace(
        'if (!isStoredRowId(fields.resourceId, "documents")) {',
        'if (typeof fields.resourceId !== "string") {'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "document submit admission cannot project an open envelope",
    names: "capabilities/document/api/submit-document-changes/validate-submit-document-changes.ts",
    changes: [{
      path: "src/lib/capabilities/document/api/submit-document-changes/validate-submit-document-changes.ts",
      edit: (before) => before.replace(
        'hasExactFields(envelope, ["changeSet"])',
        'Object.hasOwn(envelope, "changeSet")'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "document submit admission cannot trust an incoherent touched projection",
    names: "capabilities/document/api/submit-document-changes/validate-submit-document-changes.ts",
    changes: [{
      path: "src/lib/capabilities/document/api/submit-document-changes/validate-submit-document-changes.ts",
      edit: (before) => before.replace(
        "!matchingTouched(changeSet.ops, changeSet.touched)",
        "!changeSet.touched.every((path) => typeof path === \"string\")"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "document operation admission cannot project away non-durable own fields",
    names: "representation/data/behavior/documents/stored-rows.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/documents/stored-rows.ts",
      edit: (before) => before.replace("  isStoredJson(value) &&\n", "")
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "document operation admission cannot accept mismatched list payload cardinality",
    names: "representation/data/behavior/documents/stored-rows.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/documents/stored-rows.ts",
      edit: (before) => before.replace(
        "value.values.length === value.ids.length",
        "value.values.length >= 0"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "document command admission cannot lose its executable exactness contract",
    names: "capabilities/document/test/unit/command-admission.test.ts",
    changes: [{
      path: "src/lib/capabilities/document/test/unit/command-admission.test.ts",
      edit: (before) => before.replace(
        'it("admits one exact envelope, change set, and operation union arm"',
        'it("checks a command"'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "slide read admission cannot accept another resource namespace",
    names: "capabilities/presentation/api/read-presentation-body/validate-read-presentation-body.ts",
    changes: [{
      path: "src/lib/capabilities/presentation/api/read-presentation-body/validate-read-presentation-body.ts",
      edit: (before) => before.replace(
        'if (!isStoredRowId(fields.resourceId, "presentations")) {',
        'if (typeof fields.resourceId !== "string") {'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "slide submit admission cannot project an open envelope",
    names: "capabilities/presentation/api/submit-presentation-changes/validate-submit-presentation-changes.ts",
    changes: [{
      path: "src/lib/capabilities/presentation/api/submit-presentation-changes/validate-submit-presentation-changes.ts",
      edit: (before) => before.replace(
        'hasExactFields(envelope, ["changeSet"])',
        'Object.hasOwn(envelope, "changeSet")'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "slide submit admission cannot trust an incoherent touched projection",
    names: "capabilities/presentation/api/submit-presentation-changes/validate-submit-presentation-changes.ts",
    changes: [{
      path: "src/lib/capabilities/presentation/api/submit-presentation-changes/validate-submit-presentation-changes.ts",
      edit: (before) => before.replace(
        "!matchingTouched(changeSet.ops, changeSet.touched)",
        "!changeSet.touched.every((path) => typeof path === \"string\")"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "slide operation admission cannot project away non-durable own fields",
    names: "representation/data/behavior/presentations/stored-rows.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/presentations/stored-rows.ts",
      edit: (before) => before.replace("  isStoredJson(value) &&\n", "")
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "slide operation admission cannot accept mismatched list payload cardinality",
    names: "representation/data/behavior/presentations/stored-rows.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/presentations/stored-rows.ts",
      edit: (before) => before.replace(
        "value.values.length === value.ids.length",
        "value.values.length >= 0"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "slide command admission cannot lose its executable exactness contract",
    names: "capabilities/presentation/test/unit/command-admission.test.ts",
    changes: [{
      path: "src/lib/capabilities/presentation/test/unit/command-admission.test.ts",
      edit: (before) => before.replace(
        'it("admits one exact envelope, change set, and operation union arm"',
        'it("checks a command"'
      )
    }]
  }
];
