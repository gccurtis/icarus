import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

import type { StoreUnitOfWork } from "$model/server/store/index.server";

type Row = Record<string, unknown> & { _id: string };

const model = vi.hoisted(() => ({
  variables: [] as Row[],
  minted: 0,
  store: {
    create: (table: string, fields: unknown) => {
      model.minted += 1;
      const id = `${table}:${model.minted}`;
      model.variables.push({ ...(fields as Row), _id: id, _creationTime: 1 });
      return id;
    },
    read: () => ({ table: "variables", kind: "table", rows: model.variables }),
    update: (path: string, value: unknown) => {
      const [, id] = path.split(".");
      const at = model.variables.findIndex((row) => row._id === id);
      if (at !== -1) {
        model.variables[at] = {
          ...(value as Row),
          _id: id,
          _creationTime: model.variables[at]._creationTime
        };
      }
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

const scope = vi.hoisted(() => ({ projectId: "projects:p1" }));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve({
    projectId: scope.projectId,
    userId: "users:u",
    username: "You"
  })
}));

const { readVariables } = await import("$capabilities/variables/api/read-variables/read-variables");
const { saveVariable } = await import("$capabilities/variables/api/save-variable/save-variable");
const { removeVariable } = await import(
  "$capabilities/variables/api/remove-variable/remove-variable"
);

beforeEach(() => {
  model.variables.length = 0;
  model.minted = 0;
  scope.projectId = "projects:p1";
});

const inProject = async <T>(project: string, run: () => Promise<T>): Promise<T> => {
  scope.projectId = `projects:${project}`;
  const answer = await run();
  scope.projectId = "projects:p1";
  return answer;
};

test("one name in two projects holds two values", async () => {
  await inProject("p1", () =>
    saveVariable({ name: "rate", value: { kind: "number", value: 3.1 }, type: "number" })
  );
  await inProject("p2", () =>
    saveVariable({ name: "rate", value: { kind: "number", value: 88 }, type: "number" })
  );

  const one = await inProject("p1", () => readVariables({}));
  const other = await inProject("p2", () => readVariables({}));

  assert.equal(one.variables.length, 1);
  assert.equal(other.variables.length, 1);
  assert.deepEqual(one.variables[0].value, { kind: "number", value: 3.1 });
  assert.deepEqual(other.variables[0].value, { kind: "number", value: 88 });
  assert.equal(model.variables.length, 2);
});

test("saving in one project leaves the other project's name alone", async () => {
  await inProject("p1", () =>
    saveVariable({ name: "rate", value: { kind: "number", value: 1 }, type: "number" })
  );
  await inProject("p2", () =>
    saveVariable({ name: "rate", value: { kind: "number", value: 2 }, type: "number" })
  );
  await inProject("p1", () =>
    saveVariable({ name: "RATE", value: { kind: "number", value: 9 }, type: "number" })
  );

  const one = await inProject("p1", () => readVariables({}));
  const other = await inProject("p2", () => readVariables({}));

  assert.equal(one.variables.length, 1);
  assert.deepEqual(one.variables[0].value, { kind: "number", value: 9 });
  assert.deepEqual(other.variables[0].value, { kind: "number", value: 2 });
});

test("removing a name in one project does not remove the other project's", async () => {
  await inProject("p1", () =>
    saveVariable({ name: "rate", value: { kind: "number", value: 1 }, type: "number" })
  );
  await inProject("p2", () =>
    saveVariable({ name: "rate", value: { kind: "number", value: 2 }, type: "number" })
  );

  const answer = await inProject("p1", () => removeVariable({ name: "rate" }));
  assert.equal(answer.removed, true);

  const one = await inProject("p1", () => readVariables({}));
  const other = await inProject("p2", () => readVariables({}));
  assert.equal(one.variables.length, 0);
  assert.equal(other.variables.length, 1);
});

test("a declared type is a promise the value has to keep", async () => {
  const answer = await saveVariable({
    name: "rate",
    value: { kind: "text", value: "soon" },
    type: "number"
  });
  assert.equal(answer.saved, false);
  assert.equal(model.variables.length, 0);
});
