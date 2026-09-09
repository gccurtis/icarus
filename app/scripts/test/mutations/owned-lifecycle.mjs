export const MUTATIONS = [
  {
    check: "runtime-lifecycle-follows-tabs",
    says: "a workspace helper acquires a runtime outside tab lifecycle",
    names: "methods/acquire-probe.ts",
    changes: [{
      path: "src/lib/model/client/workspace-state/methods/acquire-probe.ts",
      write: `export const acquireProbe = (runtimes: { attach(id: string): unknown }): unknown => runtimes.attach("probe");\n`
    }]
  },
  {
    check: "accessors-are-observational",
    says: "an accessor-shaped function secretly acquires state",
    names: "methods/probe-runtime.ts",
    changes: [{
      path: "src/lib/model/client/workspace-state/methods/probe-runtime.ts",
      write: `export const probeRuntime = (runtimes: { attach(id: string): unknown }): unknown => runtimes.attach("probe");\n`
    }]
  },
  {
    check: "runtime-open-close-is-balanced",
    subject: "workspace-reaches-runtime",
    says: "a runtime register is absent from workspace lifecycle",
    names: "model/client/probe-runtimes",
    changes: [{
      path: "src/lib/model/client/probe-runtimes/index.ts",
      write: `export const createProbeRuntimes = (): object => ({});\n`
    }]
  },
  {
    check: "stateful-client-object-has-release",
    says: "the composition root constructs state omitted from shutdown",
    names: "runtime/client/start.ts",
    changes: [{
      path: "src/lib/runtime/client/start.ts",
      edit: (before) => `${before}\nconst unreleasedProbe = createProbeRuntimes();\n`
    }]
  },
  {
    check: "one-resource-one-edit-buffer",
    says: "a runtime register stops checking its open map by resource id",
    names: "methods/attach.ts",
    changes: [{
      path: "src/lib/model/client/document-runtimes/methods/attach.ts",
      edit: (before) => before.replace("state.open.get(id)", `state.open.get("another-resource")`)
    }]
  }
];
