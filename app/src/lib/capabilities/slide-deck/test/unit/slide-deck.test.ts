import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";

type Row = Record<string, unknown> & { _id: string };

const model = vi.hoisted(() => ({
  rows: [] as Row[],
  store: {
    create: () => "unused",
    read: (path: string) =>
      path === "slideDeckSnapshots"
        ? { table: "slideDeckSnapshots", kind: "table", rows: model.rows }
        : undefined,
    update: () => undefined,
    remove: () => undefined
  }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve({ projectId: "p", userId: "u", username: "You" })
}));

const { readSlideDeckBody } = await import(
  "$capabilities/slide-deck/api/read-slide-deck-body/read-slide-deck-body"
);
const { validateReadSlideDeckBody } = await import(
  "$capabilities/slide-deck/api/read-slide-deck-body/validate-read-slide-deck-body"
);

const body = (aspectRatio: string) => ({
  aspectRatio,
  theme: { colors: { text: "--token-ink-primary", accent: "--token-color-accent-1-fill" } },
  styles: { defaultKey: "body", styles: {} },
  layouts: [],
  sections: [],
  slides: []
});

const snapshot = (id: string, resourceId: string, projectId: string, role: string): Row => ({
  _id: id,
  projectId,
  resourceId,
  revision: 4,
  role,
  part: 0,
  body: body("16:9"),
  at: 1
});

beforeEach(() => {
  model.rows = [];
});

describe("readSlideDeckBody", () => {
  it("hands back the leader for the deck asked for", async () => {
    model.rows = [
      snapshot("s1", "slideDecks:1", "p", "leader"),
      snapshot("s2", "slideDecks:2", "p", "leader")
    ];

    const found = await readSlideDeckBody({ resourceId: "slideDecks:2" });

    assert.equal(found?.revision, 4);
    assert.equal(found?.body.aspectRatio, "16:9");
  });

  it("answers null for a deck with no snapshot", async () => {
    model.rows = [snapshot("s1", "slideDecks:1", "p", "leader")];

    assert.equal(await readSlideDeckBody({ resourceId: "slideDecks:9" }), null);
  });

  it("does not reach a deck in another project", async () => {
    model.rows = [snapshot("s1", "slideDecks:1", "other", "leader")];

    assert.equal(await readSlideDeckBody({ resourceId: "slideDecks:1" }), null);
  });

  it("ignores a snapshot that is not the leader", async () => {
    model.rows = [snapshot("s1", "slideDecks:1", "p", "checkpoint")];

    assert.equal(await readSlideDeckBody({ resourceId: "slideDecks:1" }), null);
  });
});

describe("validateReadSlideDeckBody", () => {
  it("takes a resourceId", () => {
    assert.deepEqual(validateReadSlideDeckBody({ resourceId: "slideDecks:1" }), {
      resourceId: "slideDecks:1"
    });
  });

  it("refuses what it cannot act on", () => {
    assert.throws(() => validateReadSlideDeckBody(null));
    assert.throws(() => validateReadSlideDeckBody({}));
    assert.throws(() => validateReadSlideDeckBody({ resourceId: "" }));
    assert.throws(() => validateReadSlideDeckBody({ resourceId: 7 }));
  });
});
