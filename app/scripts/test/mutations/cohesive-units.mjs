const manyExports = Array.from(
  { length: 21 },
  (_, index) => `export const operation${index} = (): number => ${index};`
).join("\n");

export const MUTATIONS = [
  {
    check: "source-complexity-is-reviewed",
    says: "a procedure crosses the export complexity gate without review",
    names: "procedures/too-many-entries.ts",
    changes: [{
      path: "src/lib/app-views/categories/project-overview/procedures/too-many-entries.ts",
      write: `${manyExports}\n`
    }]
  },
  {
    check: "source-complexity-is-reviewed",
    says: "a review marker cannot waive the hand-authored hard ceiling",
    names: "procedures/over-hard-ceiling.ts",
    changes: [{
      path: "src/lib/app-views/categories/project-overview/procedures/over-hard-ceiling.ts",
      write:
        `/* @architecture-complexity reviewed */\nexport const value = 1;\n` +
        Array.from({ length: 800 }, (_, index) => `// authored line ${index}`).join("\n") +
        `\n`
    }]
  },
  {
    check: "procedure-directory-has-one-entry-chain",
    subject: "one-entry",
    says: "one procedure source exposes two public intents",
    names: "procedures/two-entries.ts",
    changes: [{
      path: "src/lib/app-views/categories/project-overview/procedures/two-entries.ts",
      write: `export const one = (): number => 1;\nexport const two = (): number => 2;\n`
    }]
  },
  {
    check: "architecture-docs-match-the-graph",
    subject: "capability-inventory",
    says: "a capability is added without updating the architecture inventory",
    names: "capabilities/capabilities.md",
    changes: [{
      path: "src/lib/capabilities/catalog-probe/index.ts",
      write: `export {};\n`
    }]
  },
  {
    check: "model-admission-declares-an-invariant",
    says: "a model object is admitted without an ownership contract",
    names: "model/client/admission-probe",
    changes: [{
      path: "src/lib/model/client/admission-probe/index.ts",
      write: `export const createAdmissionProbe = (): object => ({});\n`
    }]
  },
  {
    check: "architecture-exceptions-expire",
    subject: "entry-is-live",
    says: "an architecture exception has no owner and an expired review",
    names: "configuration/architecture-baseline.json",
    changes: [{
      path: "configuration/architecture-baseline.json",
      write: `${JSON.stringify({
        version: 1,
        findings: [{
          checker: "source-complexity-is-reviewed",
          pillar: "cohesive-units",
          path: "src/lib/runtime/client/start.ts",
          fingerprint: "probe",
          finding: "ARCH-05",
          owner: "",
          removal: "remove after repair",
          review: "2000-01-01"
        }]
      }, null, 2)}\n`
    }]
  },
  {
    check: "architecture-exceptions-expire",
    subject: "entry-is-live",
    says: "an architecture exception cannot postpone review indefinitely",
    names: "configuration/architecture-baseline.json",
    changes: [{
      path: "configuration/architecture-baseline.json",
      write: `${JSON.stringify({
        version: 1,
        findings: [{
          checker: "source-complexity-is-reviewed",
          contract: "COH-01",
          pillar: "cohesive-units",
          path: "src/lib/runtime/client/start.ts",
          fingerprint: "probe",
          finding: "ARCH-05",
          owner: "architecture-remediation",
          rationale: "Exercises the maximum review horizon",
          removal: "Remove when the structure is clean",
          review: "2099-01-01"
        }]
      }, null, 2)}\n`
    }]
  }
];
