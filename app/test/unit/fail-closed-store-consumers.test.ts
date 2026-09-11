import assert from "node:assert/strict";
import { describe, test } from "vitest";

import { rowsIn as agentRows } from "$capabilities/agents/api/shared/store";
import { rowsIn as commentRows } from "$capabilities/comments/api/read-comments/store";
import { currentThreadIn } from "$capabilities/comments/api/shared/current-rows";
import { rowsOf as derivedRows } from "$capabilities/derived-output/api/shared/rows";
import { leaderOf as documentLeader } from "$capabilities/document/api/shared/leader";
import {
  externalFilesIn,
  rowsOf as externalRows
} from "$capabilities/external-files/api/shared/rows";
import { rowsIn as researchRows } from "$capabilities/research-chat/api/shared/store";
import { recordsIn as resourceSetRows } from "$capabilities/resource-sets/api/shared/projection";
import { rowsOf as semanticRows } from "$capabilities/semantic-overlay/api/shared/rows";
import { leaderOf as slideLeader } from "$capabilities/presentation/api/shared/leader";
import { surroundingsOf } from "$capabilities/spreadsheet/api/shared/answering";
import { cellRowsOf } from "$capabilities/spreadsheet/api/shared/cells";
import { leaderOf as spreadsheetLeader } from "$capabilities/spreadsheet/api/shared/leader";
import { rowsIn as templateRows } from "$capabilities/templates/api/shared/store";
import { rowsIn as projectRows } from "$capabilities/project/api/shared/store";
import { variableRowsOf } from "$capabilities/variables/api/shared/rows";
import {
  historyOf as workspaceHistory,
  leaderOf as workspaceLeader
} from "$capabilities/workspace/api/shared/leader";
import type { TableName } from "$model/server/store/index.server";

type Reader = (store: never) => readonly unknown[];

const readers: readonly [string, Reader][] = [
  ["Agents", (store) => agentRows(store, "users")],
  ["Comments", (store) => commentRows(store, "users")],
  ["Derived Output", (store) => derivedRows(store, "users")],
  ["External Files", (store) => externalRows(store, "users")],
  ["Research", (store) => researchRows(store, "users")],
  ["Resource Sets", (store) => resourceSetRows(store, "users")],
  ["Semantic Overlay", (store) => semanticRows(store, "users")],
  ["Templates", (store) => templateRows(store, "users")]
];

const storeReturning = (value: unknown): never => ({
  read: () => value
}) as never;

const boundaryReaders: readonly [string, TableName, Reader][] = [
  ["Comment thread lookup", "commentThreads", (store) => [
    currentThreadIn(store, "projects:p", "commentThreads:t")
  ]],
  ["Document leader", "documentSnapshots", (store) => [
    documentLeader(store, "projects:p" as never, "documents:d" as never)
  ]],
  ["Slide leader", "presentationSnapshots", (store) => [
    slideLeader(store, "projects:p" as never, "presentations:d" as never)
  ]],
  ["Spreadsheet leader", "spreadsheetSnapshots", (store) => [
    spreadsheetLeader(store, "projects:p" as never, "spreadsheets:s" as never)
  ]],
  ["Spreadsheet cells", "sheetCells", (store) =>
    cellRowsOf(store, "projects:p" as never, "spreadsheets:s" as never)],
  ["Spreadsheet surroundings", "variables", (store) => [
    surroundingsOf(store, "projects:p" as never, "spreadsheets:s" as never)
  ]],
  ["Variables", "variables", (store) =>
    variableRowsOf(store, "projects:p" as never)],
  ["Project rows", "projects", (store) => projectRows(store, "projects")],
  ["Workspace leader", "workspaceSnapshots", (store) => [
    workspaceLeader(store, "projects:p" as never, "users:u" as never)
  ]],
  ["Workspace history", "workspaceRevisions", (store) =>
    workspaceHistory(store, "projects:p" as never, "users:u" as never)]
];

const externalFile = (createdBy: unknown = { kind: "system" }) => ({
  _id: "externalFiles:file",
  _creationTime: 1,
  projectId: "projects:p",
  name: "notes.md",
  originalName: "notes.md",
  relativePath: "notes.md",
  mediaType: "text/markdown",
  subkind: "text",
  storageId: `_storage:${"a".repeat(64)}`,
  hash: "a".repeat(64),
  size: 1,
  origin: { kind: "upload" },
  createdBy,
  updatedBy: createdBy,
  revision: 1,
  updatedAt: 1
});

const externalModel = (
  file: Record<string, unknown>,
  users: readonly unknown[] = []
): never => ({
  configuration: { get: () => 512 },
  store: {
    read: (path: string) => {
      const [table] = path.split(".");
      return {
        kind: "table",
        table,
        rows: table === "externalFiles" ? [file] : table === "users" ? users : []
      };
    }
  }
}) as never;

describe("capability Store consumers", () => {
  for (const [name, read] of readers) {
    test(`${name} refuses a missing or wrong-table Store result`, () => {
      assert.throws(() => read(storeReturning(undefined)), /did not return the 'users' table/);
      assert.throws(
        () => read(storeReturning({ kind: "table", table: "documents", rows: [] })),
        /did not return the 'users' table/
      );
    });

    test(`${name} refuses a structurally non-current row`, () => {
      assert.throws(
        () => read(storeReturning({
          kind: "table",
          table: "users",
          rows: [{ _id: "users:u", _creationTime: 1, displayName: "Partial" }]
        })),
        /missing required fields/
      );
    });
  }

  for (const [name, table, read] of boundaryReaders) {
    test(`${name} distinguishes an absent row from an invalid table boundary`, () => {
      assert.throws(
        () => read(storeReturning(undefined)),
        new RegExp(`did not return the '${table}' table`)
      );
      assert.throws(
        () => read(storeReturning({ kind: "table", table: "users", rows: [] })),
        new RegExp(`did not return the '${table}' table`)
      );
      assert.throws(
        () => read(storeReturning({
          kind: "table",
          table,
          rows: [{ _id: `${table}:partial`, _creationTime: 1 }]
        })),
        /missing required fields/
      );

      assert.doesNotThrow(() => read({
        read: (path: string) => ({ kind: "table", table: path, rows: [] })
      } as never));
    });
  }

  test("External Files does not relabel structural relation corruption as unavailable", () => {
    assert.throws(
      () => externalFilesIn(
        externalModel(externalFile(), [{
          _id: "users:u",
          _creationTime: 1,
          displayName: "Partial"
        }]),
        { projectId: "projects:p", userId: "users:u", username: "Uma" }
      ),
      /missing required fields/
    );
  });

  test("External Files reserves unavailable for a valid row with a missing reference", () => {
    const projected = externalFilesIn(
      externalModel(externalFile({ kind: "connector", connectorId: "connectors:gone" })),
      { projectId: "projects:p", userId: "users:u", username: "Uma" }
    );
    assert.deepEqual(projected.files, []);
    assert.equal(projected.unavailable.length, 1);
    assert.match(projected.unavailable[0].detail, /project connector/);
  });
});
