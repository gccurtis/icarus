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
    check: "journal-recovers-before-readiness",
    subject: "recovery-entry",
    says: "a journal-shaped store method supplies no recovery entry",
    names: "methods/journal.server.ts",
    changes: [{
      path: "src/lib/model/server/store/methods/journal.server.ts",
      write: `export const journalStatus = (): string => "pending";\n`
    }]
  },
  {
    check: "revision-state-advances-together",
    says: "a revision-bearing subject has no failpoint atomicity contract",
    names: "capabilities/revision-probe",
    changes: [
      { path: "src/lib/capabilities/revision-probe/index.ts", write: `export {};\n` },
      {
        path: "src/lib/capabilities/revision-probe/api/commit/commit.ts",
        write: `export const commit = (Snapshots: unknown, ChangeSets: unknown, revision: number): unknown[] => [Snapshots, ChangeSets, revision];\n`
      }
    ]
  }
];
