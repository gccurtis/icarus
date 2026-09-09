const component = (name, script) => ({
  path: `src/lib/app-views/categories/project-overview/content/${name}.svelte`,
  write: `<script lang="ts">\n${script}</script>\n\n<div></div>\n`
});

export const MUTATIONS = [
  {
    check: "production-svelte-imports-no-capability",
    says: "a component imports an executable capability",
    names: "content/calls-capability.svelte",
    changes: [component(
      "calls-capability",
      `  import { read } from "$capabilities/store/index.remote";\n  void read;\n`
    )]
  },
  {
    check: "component-effects-have-a-home",
    says: "a component defines synchronization anonymously",
    names: "content/inline-effect.svelte",
    changes: [component("inline-effect", "  $effect(() => {});\n")]
  },
  {
    check: "component-effects-have-a-home",
    says: "a pre-render effect is still lifecycle synchronization",
    names: "content/inline-pre-effect.svelte",
    changes: [component("inline-pre-effect", "  $effect.pre(() => {});\n")]
  },
  {
    check: "model-definitions-delegate",
    says: "a model definition implements an action instead of delegating",
    names: "probe/definition.ts",
    changes: [{
      path: "src/lib/model/client/probe/definition.ts",
      write: `export class Probe {\n  run(): number {\n    const value = 1;\n    return value + 1;\n  }\n}\n`
    }]
  },
  {
    check: "model-definitions-delegate",
    says: "a one-line direct state action is not mistaken for delegation",
    names: "direct-definition/definition.ts",
    changes: [{
      path: "src/lib/model/client/direct-definition/definition.ts",
      write: `export class DirectDefinition {\n  values: number[] = [];\n  find(value: number): number | undefined {\n    return this.values.find((candidate) => candidate === value);\n  }\n}\n`
    }]
  },
  {
    check: "async-command-state-lives-with-command",
    says: "a component implements a multi-step async workflow",
    names: "content/inline-command.svelte",
    changes: [component(
      "inline-command",
      `  const run = async (): Promise<void> => {\n    await Promise.resolve();\n    await Promise.resolve();\n  };\n  void run;\n`
    )]
  }
];
