/**
 * One broken tree per check.
 *
 * `names` is the path the check has to report: asserting that a check found
 * *something* proves only that it is unhappy, and most of them already are. The
 * mutation, the check, and the path it must name are the whole test.
 */

const view = (name, body) => ({ path: `src/lib/surfaces/top-bar/procedures/${name}.ts`, write: body });
const appended = (text) => ({ edit: (before) => `${before}\n${text}\n` });

export const MUTATIONS = [
  // ------------------------------------------------------------ capabilities ----
  {
    check: "nothing-reaches-inside-a-capability",
    says: "a view reaches past a capability's index",
    names: "reaches-inside.ts",
    changes: [view("reaches-inside", `import type { EditorKind } from "$capabilities/resource/types/resource";\nexport type X = EditorKind;\n`)]
  },
  {
    check: "capability-lists-its-procedures",
    says: "an index defines a value of its own",
    names: "probe/index.ts",
    changes: [
      { path: "src/lib/capabilities/probe/index.ts", write: `export const total = [1, 2].length;\n` }
    ]
  },
  {
    check: "procedure-validates-first",
    says: "a procedure acts on its input before checking it",
    names: "act/act.ts",
    changes: [
      { path: "src/lib/capabilities/probe/index.ts", write: `export {};\n` },
      {
        path: "src/lib/capabilities/probe/api/act/act.ts",
        write: `import { requireScope } from "$runtime/server/scope.server";\n\nexport const act = async (input: { project: string }): Promise<string> => {\n  await requireScope();\n  const name = input.project.trim();\n  return name;\n};\n`
      }
    ]
  },
  {
    check: "no-procedure-acts-outside-a-scope",
    says: "a procedure runs without establishing who is asking",
    names: "act/act.ts",
    changes: [
      { path: "src/lib/capabilities/probe/index.ts", write: `export {};\n` },
      {
        path: "src/lib/capabilities/probe/api/act/act.ts",
        write: `export const act = (input: { project: string }): string => {\n  const project = validateAct(input);\n  return project;\n};\n\nconst validateAct = (input: { project: string }): string => input.project;\n`
      }
    ]
  },
  {
    check: "storage-through-a-model",
    says: "a capability opens storage itself",
    names: "opens-storage.ts",
    changes: [
      {
        path: "src/lib/capabilities/probe/api/opens-storage.ts",
        write: `import type { TableName } from "$representation/store/tables";\nexport type X = TableName;\n`
      }
    ]
  },
  {
    check: "capability-imports",
    subject: "no-client",
    says: "a capability reaches a client model object",
    names: "reaches-client.ts",
    changes: [
      {
        path: "src/lib/capabilities/probe/api/reaches-client.ts",
        write: `import type { WorkspaceStateModel } from "$model/client/workspace-state";\nexport type X = WorkspaceStateModel;\n`
      }
    ]
  },
  {
    check: "capability-holds-nothing",
    subject: "no-module-state",
    says: "a capability keeps something between calls",
    names: "remembers.ts",
    changes: [
      { path: "src/lib/capabilities/probe/api/remembers.ts", write: `let seen = 0;\nexport const count = (): number => (seen += 1);\n` }
    ]
  },
  {
    check: "entry-matches-directory",
    says: "a procedure directory holds no entry named for it",
    names: "probe/api/thing",
    changes: [
      { path: "src/lib/capabilities/probe/index.ts", write: `export {};\n` },
      { path: "src/lib/capabilities/probe/api/thing/step.ts", write: `export const step = (): void => {};\n` }
    ]
  },
  {
    check: "capability-layout",
    subject: "permitted-entries",
    says: "a capability root grows a directory that is not one of the four",
    names: "probe/helpers",
    changes: [
      { path: "src/lib/capabilities/probe/index.remote.ts", write: `export {};\n` },
      { path: "src/lib/capabilities/probe/helpers/thing.ts", write: `export const thing = 1;\n` }
    ]
  },
  {
    check: "capability-layout",
    subject: "has-an-index",
    says: "a capability has no index",
    names: "capabilities/probe",
    changes: [{ path: "src/lib/capabilities/probe/types/probe.ts", write: `export type Probe = string;\n` }]
  },
  {
    check: "tests-are-one-of-three-kinds",
    tree: "capabilities",
    says: "a test sits directly under test/",
    names: "test/smoke.test.ts",
    changes: [{ path: "src/lib/capabilities/resource/test/smoke.test.ts", write: `export {};\n` }]
  },

  // -------------------------------------------------------------- components ----
  {
    check: "component-takes-only-props",
    says: "a component reaches a model",
    names: "panel-reaches.svelte",
    changes: [
      {
        path: "src/lib/components/authored/panel/panel-reaches.svelte",
        write: `<script lang="ts">\n  import { workbench } from "$model/client/workbench";\n  void workbench;\n</script>\n\n<div></div>\n`
      }
    ]
  },
  {
    check: "vocabulary-is-entered-at-index",
    subject: "index-exists",
    says: "a vocabulary has no index",
    names: "authored/probe",
    changes: [{ path: "src/lib/components/authored/probe/probe-thing.svelte", write: `<div></div>\n` }]
  },
  {
    check: "file-is-named-for-its-directory",
    says: "a file is not prefixed by its vocabulary",
    names: "wrong-name.svelte",
    changes: [{ path: "src/lib/components/authored/panel/wrong-name.svelte", write: `<div></div>\n` }]
  },
  {
    check: "vendor-is-unedited",
    says: "a vendored file takes an authored component",
    names: "vendored/button/edited.ts",
    changes: [
      { path: "src/lib/components/vendored/button/edited.ts", write: `export { Panel } from "$authored-components/panel";\n` }
    ]
  },
  {
    check: "vendor-keeps-its-own-spelling",
    subject: "import-spelling",
    says: "a vendored import is spelled with a first-party alias",
    names: "vendored/button/respelled.ts",
    changes: [
      { path: "src/lib/components/vendored/button/respelled.ts", write: `export * from "$lib/components/vendored/button/index";\n` }
    ]
  },

  // ------------------------------------------------------------------- model ----
  {
    check: "nothing-builds-at-module-load",
    subject: "no-construction",
    says: "a model module builds something when it is imported",
    names: "methods/builds.ts",
    changes: [
      { path: "src/lib/model/client/workbench/methods/builds.ts", write: `const held = createThing();\nexport const get = () => held;\nfunction createThing() {\n  return {};\n}\n` }
    ]
  },
  {
    check: "object-is-entered-at-its-index",
    says: "an import reaches past an object's index",
    names: "past-the-index.ts",
    changes: [view("past-the-index", `import type { WorkbenchModel } from "$model/client/workbench/types";\nexport type X = WorkbenchModel;\n`)]
  },
  {
    check: "constructor-is-called-by-the-runtime",
    says: "something outside the runtime builds an object",
    names: "builds-an-object.ts",
    changes: [view("builds-an-object", `import { createWorkbench } from "$model/client/workbench/constructor";\nexport const make = createWorkbench;\n`)]
  },
  {
    check: "method-entry-matches-directory",
    says: "a method directory holds no entry named for it",
    names: "methods/promoted",
    changes: [{ path: "src/lib/model/client/workbench/methods/promoted/step.ts", write: `export const step = (): void => {};\n` }]
  },
  {
    check: "runes-match-the-extension",
    subject: "runes-need-svelte-ts",
    says: "a rune is declared in a file that is not compiled",
    names: "methods/uncompiled.ts",
    changes: [
      { path: "src/lib/model/client/workbench/methods/uncompiled.ts", write: `export const hold = () => {\n  const open = $state(false);\n  return open;\n};\n` }
    ]
  },
  {
    check: "object-exposes-no-component",
    subject: "no-svelte-file",
    says: "a model object holds markup",
    names: "workbench/probe.svelte",
    changes: [{ path: "src/lib/model/client/workbench/probe.svelte", write: `<div></div>\n` }]
  },
  {
    check: "object-layout",
    subject: "permitted-root-entries",
    says: "an object root holds something that is not what it is",
    names: "workbench/extra.ts",
    changes: [{ path: "src/lib/model/client/workbench/extra.ts", write: `export const extra = 1;\n` }]
  },
  {
    check: "method-tree-paths-resolve",
    says: "a document draws a call tree naming a file that is gone",
    names: "workbench/probe.md",
    changes: [{ path: "src/lib/model/client/workbench/probe.md", write: `# probe\n\nThe entry is \`methods/nowhere/nowhere.ts\`.\n` }]
  },
  {
    check: "tests-are-one-of-three-kinds",
    tree: "model",
    says: "a model test sits in a fourth kind",
    names: "test/smoke",
    changes: [{ path: "src/lib/model/client/workbench/test/smoke/a.test.ts", write: `export {};\n` }]
  },

  // ---------------------------------------------------------- representation ----
  {
    check: "types-emit-nothing",
    says: "a declaration file compiles to something",
    names: "types/core/emits.ts",
    changes: [{ path: "src/lib/representation/data/types/core/emits.ts", write: `export const EMPTY = Object.freeze({});\n` }]
  },
  {
    check: "behavior-is-pure",
    subject: "no-node",
    says: "a behaviour file reaches the filesystem",
    names: "behavior/core/impure.ts",
    changes: [
      { path: "src/lib/representation/data/behavior/core/impure.ts", write: `import { existsSync } from "node:fs";\nexport const there = (path: string): boolean => existsSync(path);\n` }
    ]
  },
  {
    check: "representation-imports-nothing-else",
    says: "the vocabulary depends on a consumer",
    names: "types/core/depends.ts",
    changes: [
      { path: "src/lib/representation/data/types/core/depends.ts", write: `import type { WorkbenchModel } from "$model/client/workbench";\nexport type X = WorkbenchModel;\n` }
    ]
  },
  {
    check: "domain-graph-is-declared",
    subject: "declaration-matches-imports",
    says: "the declaration names a domain that is not on disk",
    names: "configuration/representation.yaml",
    changes: [
      {
        path: "configuration/representation.yaml",
        write: `representation:\n  store:\n    directory: data\n  domains:\n    nowhere: []\n`
      }
    ]
  },
  {
    check: "store-opens-nothing",
    says: "the store holds a handle",
    names: "store/opens.ts",
    changes: [
      { path: "src/lib/representation/store/opens.ts", write: `import { readFileSync } from "node:fs";\nexport const read = (path: string): string => readFileSync(path, "utf8");\n` }
    ]
  },
  {
    check: "representation-layout",
    says: "a file sits outside the three places",
    names: "representation/loose.ts",
    changes: [{ path: "src/lib/representation/loose.ts", write: `export const loose = 1;\n` }]
  },

  // ----------------------------------------------------------------- runtime ----
  {
    check: "builder-is-not-exported",
    says: "the builder leaves its module",
    names: "client/start.ts",
    changes: [
      { path: "src/lib/runtime/client/start.ts", edit: (text) => text.replace("const buildClientModel", "export const buildClientModel") }
    ]
  },
  {
    check: "one-holder-of-the-instance",
    subject: "no-state-elsewhere",
    says: "a second module holds an instance",
    names: "runtime/client/cache.ts",
    changes: [{ path: "src/lib/runtime/client/cache.ts", write: `let held: unknown;\nexport const get = () => held;\n` }]
  },
  {
    check: "one-caller-of-the-initializer",
    says: "a second module builds the graph",
    names: "builds-the-graph.ts",
    changes: [
      view("builds-the-graph", `import { initClientModel } from "$runtime/client/start";\nexport const go = () => initClientModel({ project: "p", configuration: {} as never });\n`)
    ]
  },
  {
    check: "graph-matches-its-aggregate",
    subject: "declared-is-built",
    says: "the aggregate names a field the builder never assigns",
    names: "client/start.ts",
    changes: [
      {
        path: "src/lib/runtime/client/types.ts",
        // Anchored on a field only the aggregate has: `project` appears in the
        // input type first, and a replace would land there instead.
        edit: (text) =>
          text.replace(
            "  readonly configuration: ConfigurationModel;",
            "  readonly configuration: ConfigurationModel;\n  readonly probe: string;"
          )
      }
    ]
  },
  {
    check: "objects-are-built-in-order",
    subject: "constructed-once",
    says: "one object constructor is called twice",
    names: "client/start.ts",
    changes: [
      {
        path: "src/lib/runtime/client/start.ts",
        edit: (text) =>
          text.replace(
            "  const workspaceState = createWorkspaceState(project, tabList, tabViews, settings);",
            "  const workspaceState = createWorkspaceState(project, tabList, tabViews, settings);\n" +
              "  const probe = createWorkspaceState(project, tabList, tabViews, settings);\n  void probe;"
          )
      }
    ]
  },
  {
    check: "accessor-refuses-twice",
    subject: "client-guards-browser",
    says: "the accessor stops saying which mistake it is",
    names: "client/start.ts",
    changes: [
      { path: "src/lib/runtime/client/start.ts", edit: (text) => text.replace("if (!browser) {", "if (instance === null) {") }
    ]
  },
  {
    check: "framework-only-at-the-root",
    says: "something below the root takes its identity from routing",
    names: "runtime/client/ambient.ts",
    changes: [
      { path: "src/lib/runtime/client/ambient.ts", write: `import { browser } from "$app/environment";\nexport const where = browser;\n` }
    ]
  },
  {
    check: "runtime-layout",
    says: "a file appears in the runtime that the layout does not name",
    names: "runtime/client/extra.ts",
    changes: [{ path: "src/lib/runtime/client/extra.ts", write: `export const extra = 1;\n` }]
  },

  // ------------------------------------------------------------------ styles ----
  {
    check: "literal-colours-in-themes-only",
    says: "a colour is written outside a theme",
    names: "semantic-tokens/color.css",
    changes: [{ path: "src/lib/styles/semantic-tokens/color.css", ...appended(`:root {\n  --token-probe: #ff0000;\n}`) }]
  },
  {
    check: "stage-owns-its-namespace",
    says: "a stage declares another stage's prefix",
    names: "semantic-tokens/color.css",
    changes: [{ path: "src/lib/styles/semantic-tokens/color.css", ...appended(`:root {\n  --palette-probe: 1;\n}`) }]
  },
  {
    check: "references-point-backward",
    subject: "stage-reads-behind-it",
    says: "a stage reads forward",
    names: "chromatic-themes/slots.css",
    changes: [
      { path: "src/lib/styles/chromatic-themes/slots.css", ...appended(`:root {\n  --chromatic-probe: var(--token-ink-primary);\n}`) }
    ]
  },
  {
    check: "one-stylesheet-entry",
    subject: "single-entry",
    says: "something other than the layout imports a stylesheet",
    names: "imports-a-stylesheet.ts",
    changes: [view("imports-a-stylesheet", `import "$lib/styles/semantic-tokens/color.css";\n`)]
  },
  {
    check: "consumers-see-public-tokens-only",
    subject: "authored-consumer",
    says: "a consumer names a private stage variable",
    names: "reads-a-palette.ts",
    changes: [view("reads-a-palette", `export const swatch = "var(--palette-blue-500)";\n`)]
  },
  {
    check: "themes-agree-with-each-other",
    subject: "same-token-set",
    says: "one theme declares a token another does not",
    names: "cyberpunk/cyberpunk.css",
    changes: [
      {
        path: "src/lib/styles/chromatic-themes/celestial/celestial.css",
        ...appended(`[data-theme="celestial"] {\n  --theme-probe: #123456;\n}`)
      }
    ]
  },
  {
    check: "generated-css-is-inert",
    says: "the quarantine header is gone",
    names: "shadcn/generated.css",
    changes: [
      {
        path: "src/lib/styles/x-integrations/shadcn/generated.css",
        edit: (text) => text.replace("Quarantine file", "Generated file")
      }
    ]
  },
  {
    check: "styles-layout",
    says: "the styles root holds something other than app.css",
    names: "styles/loose.css",
    changes: [{ path: "src/lib/styles/loose.css", write: `:root {\n  --token-loose: 1px;\n}\n` }]
  },

  // ------------------------------------------------------------------- views ----
  {
    check: "surface-is-a-named-grid",
    says: "a surface does not name its regions",
    names: "probe-bar/probe-bar.svelte",
    changes: [
      { path: "src/lib/surfaces/probe-bar/probe-bar.md", write: `# probe-bar\n` },
      { path: "src/lib/surfaces/probe-bar/probe-bar.svelte", write: `<div class="probe"></div>\n\n<style>\n  .probe {\n    display: flex;\n  }\n</style>\n` }
    ]
  },
  {
    check: "view-takes-ids-and-callbacks",
    says: "a surface takes its content as a prop",
    names: "project-overview/context/takes-content.svelte",
    changes: [
      {
        path: "src/lib/app-views/categories/project-overview/context/takes-content.svelte",
        write: `<script lang="ts">\n  let { rows }: { rows: { id: string }[] } = $props();\n</script>\n\n<div>{rows.length}</div>\n`
      }
    ]
  },
  {
    check: "concern-is-one-of-five",
    subject: "banned-names",
    says: "a surface grows a drawer",
    names: "top-bar/utils",
    changes: [{ path: "src/lib/surfaces/top-bar/utils/thing.ts", write: `export const thing = 1;\n` }]
  },
  {
    check: "effects-declare-runes",
    subject: "effects-are-svelte-ts",
    says: "an effect is written in a file that is never compiled",
    names: "effects/uncompiled.ts",
    changes: [{ path: "src/lib/surfaces/top-bar/effects/uncompiled.ts", write: `export const run = (): void => {};\n` }]
  },
  {
    check: "shared-hands-out-no-instance",
    says: "shared/ hands out something already made",
    names: "shared/already-made.ts",
    changes: [{ path: "src/lib/surfaces/top-bar/shared/already-made.ts", write: `export const registry = { open: false };\n` }]
  },
  {
    check: "surface-imports",
    subject: "no-reaching-inside",
    says: "one surface reaches inside another",
    names: "tab-bar/reaches-inside.ts",
    changes: [
      {
        path: "src/lib/surfaces/tab-bar/reaches-inside.ts",
        write: `import { applyTheme } from "$surfaces/top-bar/effects/apply-theme.svelte";\nexport const run = applyTheme;\n`
      }
    ]
  },
  {
    check: "surface-shape",
    says: "a surface has no entry named for it",
    names: "probe-bar/probe-bar.svelte",
    changes: [{ path: "src/lib/surfaces/probe-bar/probe-bar.md", write: `# probe-bar\n` }]
  },
  {
    check: "nothing-imports-development",
    says: "something shipped imports a development surface",
    names: "imports-development.ts",
    changes: [
      view("imports-development", `import Demo from "$development-views/demo/demo.svelte";\nexport const surface = Demo;\n`)
    ]
  },
  {
    check: "documented-paths-resolve",
    says: "a concern document names a file that is gone",
    names: "top-bar/probe.md",
    changes: [{ path: "src/lib/surfaces/top-bar/probe.md", write: `# probe\n\nSee \`effects/nowhere.svelte.ts\`.\n` }]
  },

  // ------------------------------------------------------------- app views ----
  {
    check: "view-imports-no-surface",
    subject: "no-surface",
    says: "a view reaches back out to the surface it is rendered in",
    names: "project-overview/context/reaches-out.svelte",
    changes: [
      {
        path: "src/lib/app-views/categories/project-overview/context/reaches-out.svelte",
        write: `<script lang="ts">\n  import { RAIL_ENTRIES } from "$surfaces/context/procedures/rail-entries";\n</script>\n\n<div>{Object.keys(RAIL_ENTRIES).length}</div>\n`
      }
    ]
  },
  {
    check: "view-imports-no-other-category",
    says: "a view reaches into another category instead of holding a copy",
    names: "project-overview/context/reaches-far.svelte",
    changes: [
      {
        path: "src/lib/app-views/categories/project-overview/context/reaches-far.svelte",
        write: `<script lang="ts">\n  import Persona from "$app-views/categories/agents/content/persona.svelte";\n</script>\n\n<Persona />\n`
      }
    ]
  },
  {
    check: "key-vocabulary-matches-the-tree",
    says: "a view the vocabulary does not name",
    names: "project-overview/context/unnamed.svelte",
    changes: [
      {
        path: "src/lib/app-views/categories/project-overview/context/unnamed.svelte",
        write: `<div></div>\n`
      }
    ]
  },
  {
    check: "runtime-through-workspace-state",
    says: "a view attaches a resource runtime itself",
    names: "project-overview/context/attaches.svelte",
    changes: [
      {
        path: "src/lib/app-views/categories/project-overview/context/attaches.svelte",
        write: `<script lang="ts">\n  import type { ResourceRuntimesModel } from "$model/client/resource-runtimes";\n  let runtimes: ResourceRuntimesModel | undefined = undefined;\n</script>\n\n<div>{runtimes}</div>\n`
      }
    ]
  },

  // ------------------------------------------------------------------ across ----
  {
    check: "module-has-one-home",
    subject: "unresolved-is-a-failure",
    says: "a module sits where no rule reaches it",
    names: "lib/homeless.ts",
    changes: [{ path: "src/lib/homeless.ts", write: `export const homeless = 1;\n` }]
  },
  {
    check: "client-server-separation",
    subject: "client-takes-no-server-code",
    says: "a client module reaches server code",
    names: "reaches-the-server.ts",
    changes: [
      view("reaches-the-server", `import { resolveScope } from "$runtime/server/scope.server";\nexport const scope = resolveScope;\n`)
    ]
  },
  {
    check: "node-is-server-only",
    says: "a client module imports node:",
    names: "imports-node.ts",
    changes: [view("imports-node", `import { join } from "node:path";\nexport const at = join;\n`)]
  },
  {
    check: "one-crossing",
    says: "a client module crosses somewhere that is not a capability index",
    names: "second-crossing.ts",
    changes: [
      view("second-crossing", `import { createConfiguration } from "$model/server/configuration/index.server";\nexport const make = createConfiguration;\n`)
    ]
  },
  {
    check: "no-relative-imports",
    says: "an import is spelled by path rather than by alias",
    names: "relative.ts",
    changes: [view("relative", `import { apply } from "./sibling";\nexport const run = apply;\n`)]
  },
  {
    check: "names-are-kebab-case",
    says: "a name is not kebab-case",
    names: "procedures/notKebab.ts",
    changes: [{ path: "src/lib/surfaces/top-bar/procedures/notKebab.ts", write: `export const value = 1;\n` }]
  }
];
