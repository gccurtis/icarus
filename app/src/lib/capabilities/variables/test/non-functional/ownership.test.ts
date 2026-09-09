import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

import type { StoreUnitOfWork } from "$model/server/store/index.server";

type Row = Record<string, unknown> & { _id: string };

const scope = vi.hoisted(() => ({ projectId: "mine" }));

const model = vi.hoisted(() => ({
  variables: [] as Row[],
  minted: 0,
  store: {
    create: (table: string, fields: unknown) => {
      model.minted += 1;
      const id = `${table}:${model.minted}`;
      model.variables.push({ ...(fields as Row), _id: id });
      return id;
    },
    read: () => ({ table: "variables", kind: "table", rows: model.variables }),
    update: (path: string, value: unknown) => {
      const [, id] = path.split(".");
      const at = model.variables.findIndex((row) => row._id === id);
      if (at !== -1) model.variables[at] = { ...(value as Row), _id: id };
    },
    remove: (path: string) => {
      const [, id] = path.split(".");
      const at = model.variables.findIndex((row) => row._id === id);
      if (at !== -1) model.variables.splice(at, 1);
    },
    transaction: <T>(work: (unit: StoreUnitOfWork) => T): T =>
      work(model.store as unknown as StoreUnitOfWork)
  }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve({ projectId: scope.projectId, userId: "u", username: "You" })
}));

const { saveVariable } = await import("$capabilities/variables/api/save-variable/save-variable");
const { removeVariable } = await import("$capabilities/variables/api/remove-variable/remove-variable");
const { readVariables } = await import("$capabilities/variables/api/read-variables/read-variables");

const theirs = () =>
  model.variables.push({
    _id: "variables:theirs",
    projectId: "theirs",
    name: "rate",
    value: { kind: "number", value: 9 },
    type: "number",
    createdBy: { kind: "user", userId: "them" },
    updatedAt: 1
  });

beforeEach(() => {
  scope.projectId = "mine";
  model.variables.length = 0;
  model.minted = 0;
});

/**
 * The contract: a variable is named inside one project, and saveVariable and
 * removeVariable act only inside the asking scope's. The name is the whole
 * address a caller sends, so two projects holding the same name must not be
 * able to reach each other's row.
 */
test("saveVariable writes a cross-project name as a new row rather than over theirs", async () => {
  theirs();

  const answer = await saveVariable({ name: "rate", value: { kind: "number", value: 4 }, type: "number" });

  assert.equal(answer.saved, true);
  assert.equal(model.variables.length, 2);

  const held = model.variables.find((row) => row.projectId === "theirs");
  assert.deepEqual(held?.value, { kind: "number", value: 9 });
});

test("removeVariable refuses a name held only by another project", async () => {
  theirs();

  const answer = await removeVariable({ name: "rate" });

  assert.equal(answer.removed, false);
  assert.equal(model.variables.length, 1);
});

test("readVariables answers with the asking project's rows and no others", async () => {
  theirs();
  await saveVariable({ name: "rate", value: { kind: "number", value: 4 }, type: "number" });

  const mine = await readVariables({});
  assert.equal(mine.variables.length, 1);
  assert.deepEqual(mine.variables[0]?.value, { kind: "number", value: 4 });

  scope.projectId = "theirs";
  const other = await readVariables({});
  assert.equal(other.variables.length, 1);
  assert.deepEqual(other.variables[0]?.value, { kind: "number", value: 9 });
});
