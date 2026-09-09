export const MUTATIONS = [
  {
    check: "production-io-has-a-model-owner",
    says: "a view procedure reaches browser persistence directly",
    names: "procedures/browser-storage.ts",
    changes: [{
      path: "src/lib/app-views/categories/project-overview/procedures/browser-storage.ts",
      write: `export const load = (): string | null => localStorage.getItem("probe");\n`
    }]
  }
];
