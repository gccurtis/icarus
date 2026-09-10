const multiWrite = `export const save = async (store: { create(value: unknown): Promise<void> }): Promise<void> => {\n  transaction(() => undefined);\n  await store.create({ id: "one" });\n  await store.create({ id: "two" });\n};\n`;

export const MUTATIONS = [
  {
    check: "multi-write-capability-uses-a-unit-of-work",
    says: "one capability intent performs two independent durable writes",
    names: "save/save.ts",
    changes: [
      { path: "src/lib/capabilities/write-probe/index.ts", write: `export {};\n` },
      { path: "src/lib/capabilities/write-probe/api/save/save.ts", write: multiWrite }
    ]
  },
  {
    check: "multi-write-capability-uses-a-unit-of-work",
    says: "extracting one write into a helper does not hide a multi-write intent",
    names: "save/save.ts",
    changes: [
      { path: "src/lib/capabilities/split-write-probe/index.ts", write: `export {};\n` },
      {
        path: "src/lib/capabilities/split-write-probe/api/shared/write-second.ts",
        write:
          `export const writeSecond = async (store: { create(value: unknown): Promise<void> }): Promise<void> => {\n` +
          `  await store.create({ id: "two" });\n` +
          `};\n`
      },
      {
        path: "src/lib/capabilities/split-write-probe/api/save/save.ts",
        write:
          `import { writeSecond } from "$capabilities/split-write-probe/api/shared/write-second";\n` +
          `export const save = async (store: { create(value: unknown): Promise<void> }): Promise<void> => {\n` +
          `  await store.create({ id: "one" });\n` +
          `  await writeSecond(store);\n` +
          `};\n`
      }
    ]
  },
  {
    check: "multi-table-intent-is-atomic",
    says: "a new multi-write intent is absent from the atomicity contract",
    names: "save/save.ts",
    changes: [
      { path: "src/lib/capabilities/atomicity-probe/index.ts", write: `export {};\n` },
      { path: "src/lib/capabilities/atomicity-probe/api/save/save.ts", write: multiWrite }
    ]
  },
  {
    check: "multi-table-intent-is-atomic",
    says: "a generic failpoint test cannot claim an intent it does not import",
    names: "save-atomicity.test.ts",
    changes: [
      { path: "src/lib/capabilities/atomicity-probe/index.ts", write: `export {};\n` },
      { path: "src/lib/capabilities/atomicity-probe/api/save/save.ts", write: multiWrite },
      {
        path: "src/lib/capabilities/atomicity-probe/test/non-functional/save-atomicity.test.ts",
        write:
          `import { expect, it } from "vitest";\n` +
          `it("mentions a failpoint without exercising save", () => expect("failpoint").toBeTruthy());\n`
      }
    ]
  },
  {
    check: "journal-recovers-before-readiness",
    subject: "recovery-entry",
    says: "the Store loses its constructor-time journal recovery entry",
    names: "methods/transaction/journal.server.ts",
    changes: [{
      path: "src/lib/model/server/store/methods/transaction/recover.server.ts",
      remove: true
    }]
  },
  {
    check: "revision-state-advances-together",
    says: "a resource-revision submission has no failpoint atomicity contract",
    names: "capabilities/revision-probe",
    changes: [
      { path: "src/lib/capabilities/revision-probe/index.ts", write: `export {};\n` },
      {
        path: "src/lib/capabilities/revision-probe/api/submit-revision-changes/submit-revision-changes.ts",
        write: `export const submitRevisionChanges = (Snapshots: unknown, ChangeSets: unknown, revision: number): unknown[] => [Snapshots, ChangeSets, revision];\n`
      }
    ]
  }
];
