import assert from "node:assert/strict";
import { test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Kysely } from "kysely";
import type { Logger } from "$model/server/observability/index.server";
import type { Database } from "$model/server/persistence/index.server";
import { closeProject } from "$model/server/persistence/methods/for-project/open-project/close-project";

const silent: Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

/** A Kysely stand-in that records whether the dialect connection was ended. */
const fakeDatabase = (order: string[]): Kysely<Database> =>
  ({
    destroy: async () => {
      order.push("destroy");
    }
  }) as unknown as Kysely<Database>;

const fakeInstance = (closed: boolean, order: string[]): PGlite =>
  ({
    closed,
    close: async () => {
      order.push("close");
    }
  }) as unknown as PGlite;

test("ends the connection, then releases the instance", async () => {
  // Without the release the directory stays locked against the next open.
  const order: string[] = [];
  await closeProject(silent, "alpha", fakeDatabase(order), fakeInstance(false, order));

  assert.deepEqual(order, ["destroy", "close"]);
});

test("does not close an instance the driver already closed", async () => {
  // Kysely's PGlite driver closes the instance inside destroy() once a query has
  // initialized it. Closing it a second time throws, which would turn every
  // clean shutdown into a non-zero exit.
  const order: string[] = [];
  await closeProject(silent, "alpha", fakeDatabase(order), fakeInstance(true, order));

  assert.deepEqual(order, ["destroy"]);
});
