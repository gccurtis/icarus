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
    check: "component-procedures-are-explicit",
    subject: "implicit-dependency",
    says: "a component procedure reads the ambient clock",
    names: "procedures/ambient-clock.ts",
    changes: [{
      path: "src/lib/app-views/categories/project-overview/procedures/ambient-clock.ts",
      write: `export const ambientClock = (): number => Date.now();\n`
    }]
  },
  {
    check: "component-procedures-are-explicit",
    subject: "attached-behavior",
    says: "a component procedure hides state behind this",
    names: "procedures/attached.ts",
    changes: [{
      path: "src/lib/app-views/categories/project-overview/procedures/attached.ts",
      write: `export class Attached {\n  value = 0;\n  read(): number { return this.value; }\n}\n`
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
