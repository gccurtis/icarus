import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";

type Row = Record<string, unknown> & { _id: string };

const model = vi.hoisted(() => ({
  rows: [] as Row[],
  store: {
    create: () => "unused",
    read: (path: string) =>
      path === "presentationSnapshots"
        ? { table: "presentationSnapshots", kind: "table", rows: model.rows }
        : undefined,
    update: () => undefined,
    remove: () => undefined
  }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve({
    projectId: "projects:p",
    userId: "users:u",
    username: "You"
  })
}));

const { readPresentationBody } = await import(
  "$capabilities/presentation/api/read-presentation-body/read-presentation-body"
);
const { validateReadPresentationBody } = await import(
  "$capabilities/presentation/api/read-presentation-body/validate-read-presentation-body"
);
const { validateSubmitPresentationChanges } = await import(
  "$capabilities/presentation/api/submit-presentation-changes/validate-submit-presentation-changes"
);

const body = (aspectRatio: string) => ({
  aspectRatio,
  theme: { colors: { text: "--token-ink-primary", accent: "--token-color-accent-1-fill" } },
  styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
  layouts: [],
  sections: [],
  slides: []
});

const snapshot = (id: string, resourceId: string, projectId: string, role: string): Row => ({
  _id: `presentationSnapshots:${id}`,
  _creationTime: 1,
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

describe("readPresentationBody", () => {
  it("hands back the leader for the presentation asked for", async () => {
    model.rows = [
      snapshot("s1", "presentations:1", "projects:p", "leader"),
      snapshot("s2", "presentations:2", "projects:p", "leader")
    ];

    const found = await readPresentationBody({ resourceId: "presentations:2" });

    assert.equal(found?.revision, 4);
    assert.equal(found?.body.aspectRatio, "16:9");
  });

  it("answers null for a presentation with no snapshot", async () => {
    model.rows = [snapshot("s1", "presentations:1", "projects:p", "leader")];

    assert.equal(await readPresentationBody({ resourceId: "presentations:9" }), null);
  });

  it("does not reach a presentation in another project", async () => {
    model.rows = [snapshot("s1", "presentations:1", "projects:other", "leader")];

    assert.equal(await readPresentationBody({ resourceId: "presentations:1" }), null);
  });

  it("ignores a snapshot that is not the leader", async () => {
    model.rows = [snapshot("s1", "presentations:1", "projects:p", "checkpoint")];

    assert.equal(await readPresentationBody({ resourceId: "presentations:1" }), null);
  });

  it("makes a current shape editable at the read boundary", async () => {
    const row = snapshot("s1", "presentations:1", "projects:p", "leader");
    row.body = {
      ...body("16:9"),
      layouts: [{ id: "layout-blank", key: "blank", name: "Blank", locked: [], placeholders: [] }],
      slides: [
        {
          id: "slide-1",
          elements: [
            {
              id: "element-1",
              frame: { x: 0, y: 0, width: 1, height: 1 },
              content: { type: "shape", shape: "rectangle" }
            }
          ],
          notes: []
        }
      ]
    };
    model.rows = [row];

    const found = await readPresentationBody({ resourceId: "presentations:1" });

    const content = found?.body.slides[0].elements[0].content;
    assert.equal(content?.type, "shape");
    if (content?.type !== "shape") throw new Error("expected a shape");
    assert.equal(content.block?.id, "element-1-text");
  });
});

describe("validateReadPresentationBody", () => {
  it("takes a resourceId", () => {
    assert.deepEqual(validateReadPresentationBody({ resourceId: "presentations:1" }), {
      resourceId: "presentations:1"
    });
  });

  it("refuses what it cannot act on", () => {
    assert.throws(() => validateReadPresentationBody(null));
    assert.throws(() => validateReadPresentationBody({}));
    assert.throws(() => validateReadPresentationBody({ resourceId: "" }));
    assert.throws(() => validateReadPresentationBody({ resourceId: 7 }));
  });
});

describe("validateSubmitPresentationChanges", () => {
  const input = (op: Record<string, unknown>) => ({
    changeSet: {
      resourceId: "presentations:1",
      baseRevision: 0,
      ops: [op],
      touched: ["theme/colors/accent"]
    }
  });

  it("admits an exact set with its required target", () => {
    const command = input({
      op: "set",
      target: "presentation",
      path: "theme/colors/accent",
      value: "violet",
      was: "blue"
    });

    assert.deepEqual(validateSubmitPresentationChanges(command), command);
  });

  it("rejects missing, undefined, unknown, and extra set-target forms", () => {
    assert.throws(() => validateSubmitPresentationChanges(input({
      op: "set",
      path: "theme/colors/accent",
      value: "violet",
      was: "blue"
    })));
    assert.throws(() => validateSubmitPresentationChanges(input({
      op: "set",
      target: undefined,
      path: "theme/colors/accent",
      value: "violet",
      was: "blue"
    })));
    assert.throws(() => validateSubmitPresentationChanges(input({
      op: "set",
      target: "legacy-presentation",
      path: "theme/colors/accent",
      value: "violet",
      was: "blue"
    })));
    assert.throws(() => validateSubmitPresentationChanges(input({
      op: "set",
      target: "presentation",
      path: "theme/colors/accent",
      value: "violet",
      was: "blue",
      setTargetOptional: true
    })));
  });
});
