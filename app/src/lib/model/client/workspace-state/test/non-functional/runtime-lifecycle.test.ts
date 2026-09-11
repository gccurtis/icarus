import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";
import type { DocumentRuntimesModel } from "$model/client/document-runtimes";
import type { PresentationRuntimesModel } from "$model/client/presentation-runtimes";
import type { SpreadsheetRuntimesModel } from "$model/client/spreadsheet-runtimes";
import { openingView } from "$representation/data/behavior/workspace/opening";
import type { Category } from "$representation/data/types/workspace/categories";

const wire = vi.hoisted(() => ({ row: null as unknown }));

vi.mock("$capabilities/workspace/index.remote", () => ({
  readWorkspaceState: () => Promise.resolve(wire.row),
  submitWorkspaceChanges: () => Promise.resolve({ accepted: true, revision: 1, merged: false })
}));

const { createConfiguration } = await import("$model/client/configuration");
const { createTabList } = await import("$model/client/tab-list");
const { createTabViews } = await import("$model/client/tab-views");
const { createWorkspaceState } = await import("$model/client/workspace-state");
const { startingWorkspace } = await import(
  "$model/client/workspace-state/methods/shared/defaults"
);

class Register<Runtime extends object> {
  readonly held = new Map<string, Runtime>();
  readonly acquired: string[] = [];
  readonly released: string[] = [];

  get open(): readonly string[] {
    return [...this.held.keys()];
  }

  get flushing(): readonly string[] {
    return [];
  }

  of(id: string): Runtime | undefined {
    return this.held.get(id);
  }

  attach(id: string): Runtime {
    const existing = this.held.get(id);
    if (existing !== undefined) return existing;
    const runtime = { id } as Runtime;
    this.held.set(id, runtime);
    this.acquired.push(id);
    return runtime;
  }

  release(id: string): void {
    if (!this.held.delete(id)) return;
    this.released.push(id);
  }

  releaseAll(): void {
    for (const id of this.open) this.release(id);
  }
}

const setup = (persists = false) => {
  const configuration = createConfiguration({
    workspace: {
      changeSets: { flushAfterOps: persists ? 1_000 : 0, flushAfterMs: 60_000 }
    }
  });
  const documents = new Register<object>();
  const presentations = new Register<object>();
  const spreadsheets = new Register<object>();
  const workspace = createWorkspaceState(
    "p1",
    createTabList(),
    createTabViews(),
    configuration,
    documents as unknown as DocumentRuntimesModel,
    presentations as unknown as PresentationRuntimesModel,
    spreadsheets as unknown as SpreadsheetRuntimesModel
  );
  return { workspace, documents, presentations, spreadsheets };
};

const subjects = [
  {
    name: "document",
    category: "document-editor" as const,
    register: (held: ReturnType<typeof setup>) => held.documents,
    runtime: (held: ReturnType<typeof setup>, id: string) => held.workspace.documentRuntime(id)
  },
  {
    name: "presentation",
    category: "presentation-editor" as const,
    register: (held: ReturnType<typeof setup>) => held.presentations,
    runtime: (held: ReturnType<typeof setup>, id: string) => held.workspace.presentationRuntime(id)
  },
  {
    name: "spreadsheet",
    category: "spreadsheet-editor" as const,
    register: (held: ReturnType<typeof setup>) => held.spreadsheets,
    runtime: (held: ReturnType<typeof setup>, id: string) => held.workspace.spreadsheetRuntime(id)
  }
] satisfies readonly {
  name: string;
  category: Category;
  register(held: ReturnType<typeof setup>): Register<object>;
  runtime(held: ReturnType<typeof setup>, id: string): object;
}[];

beforeEach(() => {
  wire.row = null;
});

for (const subject of subjects) {
  test(`${subject.name} runtime follows open, close, undo, redo and read-only lookup`, () => {
    const held = setup();
    const register = subject.register(held);

    const tab = held.workspace.open({ category: subject.category, resourceId: "resource-1" });
    assert.deepEqual(register.acquired, ["resource-1"]);
    assert.equal(subject.runtime(held, "resource-1"), subject.runtime(held, "resource-1"));
    assert.deepEqual(register.acquired, ["resource-1"], "lookup never reacquires");

    held.workspace.open({ category: subject.category, resourceId: "resource-1" });
    assert.deepEqual(register.acquired, ["resource-1"], "deduplicated open never reacquires");

    held.workspace.close(tab.id);
    assert.deepEqual(register.released, ["resource-1"]);
    assert.throws(() => subject.runtime(held, "resource-1"), /not owned by an open workspace tab/);

    held.workspace.undo();
    assert.deepEqual(register.acquired, ["resource-1", "resource-1"]);

    held.workspace.redo();
    assert.deepEqual(register.released, ["resource-1", "resource-1"]);
  });
}

test("restore reconciles document, presentation and spreadsheet runtimes to the adopted tabs", async () => {
  const held = setup(true);
  held.documents.attach("orphan-document");
  held.presentations.attach("orphan-presentation");
  held.spreadsheets.attach("orphan-spreadsheet");

  const starting = startingWorkspace();
  wire.row = {
    revision: 7,
    tabs: [
      ...starting.tabs,
      { id: "document-tab", category: "document-editor", resourceId: "documents:1" },
      { id: "presentation-tab", category: "presentation-editor", resourceId: "presentations:1" },
      { id: "sheet-tab", category: "spreadsheet-editor", resourceId: "spreadsheets:1" }
    ],
    activeId: "sheet-tab",
    views: {
      ...starting.views,
      "document-tab": openingView("document-editor"),
      "presentation-tab": openingView("presentation-editor"),
      "sheet-tab": openingView("spreadsheet-editor")
    }
  };

  await held.workspace.restore();

  assert.deepEqual(held.documents.open, ["documents:1"]);
  assert.deepEqual(held.presentations.open, ["presentations:1"]);
  assert.deepEqual(held.spreadsheets.open, ["spreadsheets:1"]);
  assert.deepEqual(held.documents.released, ["orphan-document"]);
  assert.deepEqual(held.presentations.released, ["orphan-presentation"]);
  assert.deepEqual(held.spreadsheets.released, ["orphan-spreadsheet"]);
});
