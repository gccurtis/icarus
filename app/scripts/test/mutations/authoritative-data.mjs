export const MUTATIONS = [
  {
    check: "production-views-have-no-fixture-repositories",
    says: "a production view invents persistent-looking records",
    names: "procedures/fake-repository.ts",
    changes: [{
      path: "src/lib/app-views/categories/project-overview/procedures/fake-repository.ts",
      write: `export const rows = [{ id: "mock-one" }, { id: "mock-two" }, { id: "mock-three" }];\n`
    }]
  },
  {
    check: "development-fixtures-stay-in-development",
    says: "a fixture module is placed under a production view",
    names: "fixtures/probe.ts",
    changes: [{
      path: "src/lib/app-views/categories/project-overview/fixtures/probe.ts",
      write: `export const fixture = { id: "probe" };\n`
    }]
  },
  {
    check: "constructed-subject-runtime-is-reachable",
    says: "a subject runtime register has no workspace or editor consumer",
    names: "model/client/data-probe-runtimes",
    changes: [{
      path: "src/lib/model/client/data-probe-runtimes/index.ts",
      write: `export const createDataProbeRuntimes = (): object => ({});\n`
    }]
  },
  {
    check: "resource-id-selects-the-rendered-body",
    subject: "source-flow",
    says: "a resource runtime has no identity-to-render flow",
    names: "model/client/identity-probe-runtimes",
    changes: [{
      path: "src/lib/model/client/identity-probe-runtimes/index.ts",
      write: `export const createIdentityProbeRuntimes = (): object => ({});\n`
    }]
  },
  {
    check: "unsupported-subject-is-explicit",
    subject: "readiness-is-declared",
    says: "a category is added without a readiness declaration",
    names: "configuration/category-readiness.yaml",
    changes: [{
      path: "src/lib/app-views/categories/readiness-probe/content/probe.svelte",
      write: `<div>Probe</div>\n`
    }]
  },
  {
    check: "unsupported-subject-is-explicit",
    subject: "readiness-is-declared",
    says: "the readiness inventory cannot retain a removed category",
    names: "configuration/category-readiness.yaml",
    changes: [{
      path: "configuration/category-readiness.yaml",
      edit: (before) => `${before}  removed-probe: unavailable\n`
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a new compatibility reader cannot preserve an old schema",
    names: "procedures/legacy-row.ts",
    changes: [{
      path: "src/lib/app-views/categories/project-overview/procedures/legacy-row.ts",
      write: `export type LegacyRow = { readonly id: string };\nexport const readLegacy = (row: LegacyRow): string => row.id;\n`
    }]
  }
];
