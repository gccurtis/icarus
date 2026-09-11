const component = (name, script) => ({
  path: `src/lib/app-views/categories/project-overview/content/${name}.svelte`,
  write: `<script lang="ts">\n${script}</script>\n\n<div></div>\n`
});

export const MUTATIONS = [
  {
    check: "mutable-state-has-an-instance",
    says: "a production procedure holds mutable module state",
    names: "procedures/held-state.ts",
    changes: [{
      path: "src/lib/app-views/categories/project-overview/procedures/held-state.ts",
      write: `let held = 0;\nexport const next = (): number => (held += 1);\n`
    }]
  },
  {
    check: "mutable-state-has-an-instance",
    says: "a lazy globalThis map is still process state",
    names: "procedures/ambient-map.ts",
    changes: [{
      path: "src/lib/app-views/categories/project-overview/procedures/ambient-map.ts",
      write: `const root = globalThis as typeof globalThis & { __flights?: Map<string, Promise<void>> };\nexport const flights = (): Map<string, Promise<void>> => {\n  root.__flights ??= new Map();\n  return root.__flights;\n};\n`
    }]
  },
  {
    check: "mutable-state-has-an-instance",
    says: "a lazy ambient controller needs a model owner",
    names: "procedures/ambient-controller.ts",
    changes: [{
      path: "src/lib/app-views/categories/project-overview/procedures/ambient-controller.ts",
      write: `export const controller = (): AbortController => ((globalThis as any).__controller ??= new AbortController());\n`
    }]
  },
  {
    check: "mutable-state-has-an-instance",
    says: "a production module constructs one shared mutable instance",
    names: "procedures/shared-map.ts",
    changes: [{
      path: "src/lib/app-views/categories/project-overview/procedures/shared-map.ts",
      write: `const shared = new Map<string, string>();\nexport const map = (): Map<string, string> => shared;\n`
    }]
  },
  {
    check: "mutable-state-has-an-instance",
    says: "a module lookup set becomes shared state when it is mutated",
    names: "procedures/mutable-set.ts",
    changes: [{
      path: "src/lib/app-views/categories/project-overview/procedures/mutable-set.ts",
      write: `const visited = new Set<string>();\nexport const remember = (id: string): void => { visited.add(id); };\n`
    }]
  },
  {
    check: "mutable-state-has-an-instance",
    says: "a const rune cannot hide shared reactive state",
    names: "procedures/shared-rune.svelte.ts",
    changes: [{
      path: "src/lib/app-views/categories/project-overview/procedures/shared-rune.svelte.ts",
      write: `export const shared = $state({ count: 0 });\n`
    }]
  },
  {
    check: "component-state-declares-a-lifetime",
    says: "a complex component keeps its state ledger beside markup",
    names: "content/state-heavy.svelte",
    changes: [component(
      "state-heavy",
      Array.from({ length: 8 }, (_, index) => `  let value${index} = $state(${index});`).join("\n") + "\n"
    )]
  },
  {
    check: "component-state-declares-a-lifetime",
    says: "$state.raw bindings belong to the same component state ledger",
    names: "content/raw-state-heavy.svelte",
    changes: [component(
      "raw-state-heavy",
      Array.from({ length: 8 }, (_, index) => `  let value${index} = $state.raw(${index});`).join("\n") + "\n"
    )]
  },
  {
    check: "component-state-declares-a-lifetime",
    says: "an existing state module must be constructed per component, not at module load",
    names: "content/state-singleton.svelte",
    changes: [
      {
        path: "src/lib/app-views/categories/project-overview/content/state.svelte.ts",
        write:
          `export const createState = (): object => ({});\n` +
          `export const sharedState = createState();\n`
      },
      component(
        "state-singleton",
        `  import { createState } from "./state.svelte";\n` +
          `  const owner = createState();\n` +
          Array.from({ length: 8 }, (_, index) => `  let value${index} = $state(${index});`).join("\n") +
          `\n  void owner;\n`
      )
    ]
  },
  {
    check: "remounted-views-hold-no-declared-tab-state",
    subject: "state-is-classified",
    says: "a remounted category view leaves state lifetime implicit",
    names: "content/unclassified-state.svelte",
    changes: [component("unclassified-state", "  let selected = $state(false);\n")]
  },
  {
    check: "workspace-exposes-no-store-schema",
    says: "workspace state speaks in persistence table names",
    names: "methods/raw-table.ts",
    changes: [{
      path: "src/lib/model/client/workspace-state/methods/raw-table.ts",
      write: `import type { TableName } from "$representation/store/tables";\nexport const rawTable = (table: TableName): TableName => table;\n`
    }]
  },
  {
    check: "constructed-client-object-has-a-consumer",
    says: "a client object exists without a production consumer",
    names: "model/client/probe",
    changes: [
      {
        path: "src/lib/model/client/probe/index.ts",
        write: `export const createProbe = (): object => ({});\n`
      },
      {
        path: "src/lib/runtime/client/models/build.ts",
        edit: (before) =>
          before
            .replace(
              `import { createCommands } from "$model/client/commands";`,
              `import { createCommands } from "$model/client/commands";\nimport { createProbe } from "$model/client/probe";`
            )
            .replace(
              "  const configurationState = createConfigurationState(configuration);",
              "  const configurationState = createConfigurationState(configuration);\n  const probe = createProbe();\n  void probe;"
            )
      }
    ]
  }
];
