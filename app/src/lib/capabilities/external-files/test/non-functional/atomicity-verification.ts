import { expect } from "vitest";

import type { StoreFailpoint } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import {
  interruptAt,
  recoverAtomicFixture,
  restartAtomicFixture,
  rowsIn,
  type AtomicFixture
} from "$capabilities/external-files/test/non-functional/atomicity-fixture";

const expectSemanticArtifacts = (
  model: ServerModel,
  fixture: AtomicFixture,
  present: boolean
): void => {
  const targetIds = new Set(fixture.ids);
  const materials = rowsIn(model.store, "semanticMaterials").filter((row) =>
    targetIds.has(((row.source as { ref?: { id?: string } })?.ref?.id) ?? "")
  );
  const materialIds = new Set(fixture.materialIds);
  const history = rowsIn(model.store, "semanticMaterialHistory").filter((row) =>
    targetIds.has((
      (row.material as { source?: { ref?: { id?: string } } })?.source?.ref?.id
    ) ?? "")
  );
  const objects = rowsIn(model.store, "semanticObjects").filter((row) =>
    materialIds.has(row.semanticMaterialId as string)
  );
  expect(materials).toHaveLength(present ? fixture.ids.length : 0);
  expect(history).toHaveLength(present ? fixture.ids.length : 0);
  expect(objects).toHaveLength(present ? fixture.ids.length : 0);
};

type Run = (fixture: AtomicFixture) => Promise<unknown>;
type Verify = (model: ServerModel, fixture: AtomicFixture) => void | Promise<void>;

/** Runs one intent before the journal decision and after every committed boundary. */
export const verifyMutationAtomicity = async (input: {
  readonly create: () => Promise<AtomicFixture>;
  readonly run: Run;
  readonly setModel: (model: ServerModel) => void;
  readonly changedTables: readonly string[];
  readonly verifyBefore: Verify;
  readonly verifyAfter: Verify;
}): Promise<void> => {
  const rollback = await input.create();
  input.setModel(restartAtomicFixture(rollback, interruptAt("transaction:before-journal")));
  await input.run(rollback);
  const rolledBack = await recoverAtomicFixture(rollback);
  expectSemanticArtifacts(rolledBack, rollback, true);
  await input.verifyBefore(rolledBack, rollback);

  const postCommit: StoreFailpoint[] = [
    "transaction:after-journal",
    ...input.changedTables.map((table) => `transaction:after-table:${table}` as StoreFailpoint),
    "transaction:before-journal-remove"
  ];
  for (const failpoint of postCommit) {
    const fixture = await input.create();
    input.setModel(restartAtomicFixture(fixture, interruptAt(failpoint)));
    await input.run(fixture);
    const restarted = await recoverAtomicFixture(fixture);
    expectSemanticArtifacts(restarted, fixture, false);
    await input.verifyAfter(restarted, fixture);
  }
};

export const expectRevisionBundle = (
  model: ServerModel,
  externalFileId: string,
  revision: number,
  event: string
): void => {
  const row = rowsIn(model.store, "externalFiles").find((candidate) =>
    candidate._id === externalFileId
  );
  expect(row).toMatchObject({ revision });
  expect(rowsIn(model.store, "activity").filter((entry) =>
    entry.verb === event && (entry.target as { id?: string } | undefined)?.id === externalFileId
  )).toHaveLength(1);
  expect(rowsIn(model.store, "semanticMaterialJobs")).toContainEqual(expect.objectContaining({
    ref: expect.objectContaining({ id: externalFileId }),
    requestedRevision: revision,
    state: "queued"
  }));
};
