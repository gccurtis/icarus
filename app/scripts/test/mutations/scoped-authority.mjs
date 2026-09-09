const remote = `import { command } from "$app/server";\nexport const mutate = command(async () => undefined);\n`;

export const MUTATIONS = [
  {
    check: "capability-scope-is-consumed",
    says: "a capability establishes scope and throws the result away",
    names: "act/act.ts",
    changes: [
      { path: "src/lib/capabilities/scope-probe/index.ts", write: `export {};\n` },
      {
        path: "src/lib/capabilities/scope-probe/api/act/act.ts",
        write: `import { requireScope } from "$runtime/server/scope.server";\nexport const act = async (): Promise<void> => {\n  await requireScope();\n};\n`
      }
    ]
  },
  {
    check: "capability-scope-is-consumed",
    says: "explicitly voiding scope is still discarding authority",
    names: "act/act.ts",
    changes: [
      { path: "src/lib/capabilities/void-scope-probe/index.ts", write: `export {};\n` },
      {
        path: "src/lib/capabilities/void-scope-probe/api/act/act.ts",
        write:
          `import { requireScope } from "$runtime/server/scope.server";\n` +
          `export const act = async (): Promise<void> => {\n` +
          `  const scope = await requireScope();\n` +
          `  void scope;\n` +
          `};\n`
      }
    ]
  },
  {
    check: "browser-capabilities-hide-persistence-coordinates",
    says: "a browser capability accepts a raw table coordinate",
    names: "types/input.ts",
    changes: [
      { path: "src/lib/capabilities/coordinate-probe/index.remote.ts", write: remote },
      {
        path: "src/lib/capabilities/coordinate-probe/types/input.ts",
        write: `import type { TableName } from "$representation/store/tables";\nexport type Input = { readonly table: TableName };\n`
      }
    ]
  },
  {
    check: "subject-write-proves-ownership",
    says: "a remote subject command has no cross-project ownership contract",
    names: "capabilities/ownership-probe",
    changes: [{ path: "src/lib/capabilities/ownership-probe/index.remote.ts", write: remote }]
  },
  {
    check: "generic-browser-mutations-do-not-exist",
    says: "a remote browser command is generic over persistence coordinates",
    names: "index.remote.ts",
    changes: [
      { path: "src/lib/capabilities/generic-probe/index.remote.ts", write: remote },
      {
        path: "src/lib/capabilities/generic-probe/types/input.ts",
        write: `export type Input = { readonly path: string };\n`
      }
    ]
  }
];
