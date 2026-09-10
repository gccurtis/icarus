export const SEMANTIC_MUTATIONS = [
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a Derived Output variable cannot restore its retired per-variable origin",
    names: "representation/data/types/semantic/derived-output.ts",
    changes: [{
      path: "src/lib/representation/data/types/semantic/derived-output.ts",
      edit: (before) => before.replace(
        "export type DerivedVariableDefinition = {\n  name: string;",
        'export type DerivedVariableDefinition = {\n  origin?: ResourceRef;\n  name: string;'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a reader cannot default an absent current discriminator",
    names: "semantic-overlay/api/shared/query-text-for-model.ts",
    changes: [{
      path: "src/lib/capabilities/semantic-overlay/api/shared/query-text-for-model.ts",
      edit: (before) => before.replace(
        'row.projectId === projectId && row.lane === "text"',
        'row.projectId === projectId && (row.lane ?? "text") === "text"'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a durable refresh cannot nullish-default its required request version",
    names: "derived-output/api/shared/refresh-queue.ts",
    changes: [{
      path: "src/lib/capabilities/derived-output/api/shared/refresh-queue.ts",
      edit: (before) => before.replace(
        "const currentVersion = requestedVersionOf(existing);",
        "const currentVersion = existing.requestedVersion ?? 1;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "semantic material state cannot restore in-row work states",
    names: "representation/data/types/semantic/material.ts",
    changes: [{
      path: "src/lib/representation/data/types/semantic/material.ts",
      edit: (before) => before.replace(
        'export type MaterialState = "ready";',
        'export type MaterialState = "ready" | "profiled";'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "semantic material fields cannot restore an in-row work marker",
    names: "representation/data/types/semantic/material.ts",
    changes: [{
      path: "src/lib/representation/data/types/semantic/material.ts",
      edit: (before) => before.replace(
        "  state: MaterialState;\n  error?: string;",
        "  state: MaterialState;\n  workStartedAt?: number;\n  error?: string;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "semantic material degradation error must remain optional",
    names: "representation/data/types/semantic/material.ts",
    changes: [{
      path: "src/lib/representation/data/types/semantic/material.ts",
      edit: (before) => before.replace(
        "  error?: string;",
        "  error: string;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "semantic material admission cannot accept an in-row work state",
    names: "representation/data/behavior/semantic/stored-materials.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/semantic/stored-materials.ts",
      edit: (before) => before.replace(
        'material.state !== "ready" ||',
        '!["ready", "profiled"].includes(String(material.state)) ||'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "semantic material admission cannot lose its executable ready-only contract",
    names: "representation/data/behavior/semantic/test/unit/stored-materials.test.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/semantic/test/unit/stored-materials.test.ts",
      edit: (before) => before.replace(
        'it("rejects retired in-row work states and decorated fields"',
        'it("checks material states"'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a semantic text citation cannot widen its current discriminator",
    names: "representation/data/types/semantic/derived-output.ts",
    changes: [{
      path: "src/lib/representation/data/types/semantic/derived-output.ts",
      edit: (before) => before.replace(
        '  evidenceKind: "text";',
        "  evidenceKind: string;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "semantic citation admission cannot infer text from a missing discriminator",
    names: "representation/data/behavior/semantic/stored-citations.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/semantic/stored-citations.ts",
      edit: (before) => before.replace(
        '  if (held.evidenceKind === "text") {',
        "  if (held.evidenceKind === undefined) {"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "semantic citation behavior cannot infer text from field absence",
    names: "representation/data/behavior/semantic/citation.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/semantic/citation.ts",
      edit: (before) => before.replace(
        '  citation.evidenceKind === "text";',
        '  !("evidenceKind" in citation);'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "generated material citations cannot make model provenance optional",
    names: "representation/data/types/semantic/derived-output.ts",
    changes: [{
      path: "src/lib/representation/data/types/semantic/derived-output.ts",
      edit: (before) => before.replace("      model: string;", "      model?: string;")
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "material citation admission cannot infer the generated provenance arm",
    names: "representation/data/behavior/semantic/stored-citations.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/semantic/stored-citations.ts",
      edit: (before) => before.replace(
        'if (held.facet === "generated") {',
        'if (held.model !== undefined) {'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "material citation admission cannot lose its executable facet contract",
    names: "representation/data/behavior/semantic/test/unit/stored-citations.test.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/semantic/test/unit/stored-citations.test.ts",
      edit: (before) => before.replace(
        'it("requires provenance exactly on the generated descriptor facet"',
        'it("checks descriptor provenance"'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Derived Output value types cannot widen the explicit empty discriminator",
    names: "representation/data/types/semantic/derived-output.ts",
    changes: [{
      path: "src/lib/representation/data/types/semantic/derived-output.ts",
      edit: (before) => before.replace(
        '  valueSource: "none";',
        '  valueSource: "none" | "authored";'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Derived Output authored values cannot carry generated provenance",
    names: "representation/data/types/semantic/derived-output.ts",
    changes: [{
      path: "src/lib/representation/data/types/semantic/derived-output.ts",
      edit: (before) => before.replace(
        "type DerivedOutputWithAuthoredValue = {\n  valueSource: \"authored\";",
        "type DerivedOutputWithAuthoredValue = {\n  valueSource: \"authored\" | \"generated\";"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Derived Output admission cannot allow an empty value to claim freshness",
    names: "representation/data/behavior/semantic/stored-derived-output.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/semantic/stored-derived-output.ts",
      edit: (before) => before.replace(
        'if (row.state === "fresh" && !generatedValue) return false;',
        'if (row.state === "fresh" && !noValue && !generatedValue) return false;'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Derived Output admission cannot lose its executable value-source contract",
    names: "representation/data/behavior/semantic/test/unit/stored-derived-output.test.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/semantic/test/unit/stored-derived-output.test.ts",
      edit: (before) => before.replace(
        'it("rejects implicit, partial, and mixed value shapes"',
        'it("checks value shapes"'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Derived Output refresh-job types cannot omit their request version",
    names: "representation/data/types/semantic/derived-output.ts",
    changes: [{
      path: "src/lib/representation/data/types/semantic/derived-output.ts",
      edit: (before) => before.replace("  requestedVersion: number;", "  requestedVersion?: number;")
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Derived Output refresh-job admission cannot mix a running field into queued",
    names: "representation/data/behavior/semantic/stored-derived-output.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/semantic/stored-derived-output.ts",
      edit: (before) => before.replace(
        'if (row.state === "queued") return hasExactFields(row, base, ["selection"]);',
        'if (row.state === "queued") return hasExactFields(row, base, ["selection", "startedAt"]);'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "semantic job types cannot make a running claim optional",
    names: "representation/data/types/semantic/sync.ts",
    changes: [{
      path: "src/lib/representation/data/types/semantic/sync.ts",
      edit: (before) => before.replace("      claimId: string;", "      claimId?: string;")
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "semantic job admission cannot omit the running lease proof",
    names: "representation/data/behavior/semantic/stored-state.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/semantic/stored-state.ts",
      edit: (before) => before.replace(
        '[...base, "startedAt", "claimId", "leaseExpiresAt"]',
        '[...base, "startedAt", "claimId"]'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "semantic job admission cannot lose its executable lifecycle proof",
    names: "representation/data/behavior/semantic/test/unit/stored-state.test.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/semantic/test/unit/stored-state.test.ts",
      edit: (before) => before.replace(
        'it("rejects partial and mixed lifecycle arms"',
        'it("checks lifecycle arms"'
      )
    }]
  }
];
