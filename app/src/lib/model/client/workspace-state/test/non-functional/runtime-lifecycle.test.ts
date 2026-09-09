import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";
import type { DocumentRuntimesModel } from "$model/client/document-runtimes";
import type { SlideDeckRuntimesModel } from "$model/client/slide-deck-runtimes";
import type { SpreadsheetRuntimesModel } from "$model/client/spreadsheet-runtimes";
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
  const decks = new Register<object>();
  const spreadsheets = new Register<object>();
  const workspace = createWorkspaceState(
    "p1",
    createTabList(),
    createTabViews(),
    configuration,
    documents as unknown as DocumentRuntimesModel,
    decks as unknown as SlideDeckRuntimesModel,
    spreadsheets as unknown as SpreadsheetRuntimesModel
  );
  return { workspace, documents, decks, spreadsheets };
};

const subjects = [
  {
    name: "document",
    category: "document-editor" as const,
    register: (held: ReturnType<typeof setup>) => held.documents,
    runtime: (held: ReturnType<typeof setup>, id: string) => held.workspace.documentRuntime(id)
  },
  {
    name: "slide-deck",
    category: "slide-deck-editor" as const,
    register: (held: ReturnType<typeof setup>) => held.decks,
    runtime: (held: ReturnType<typeof setup>, id: string) => held.workspace.slideDeckRuntime(id)
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

test("restore reconciles document, slide-deck and spreadsheet runtimes to the adopted tabs", async () => {
  const held = setup(true);
  held.documents.attach("orphan-document");
  held.decks.attach("orphan-deck");
  held.spreadsheets.attach("orphan-spreadsheet");

  const view = (content: string) => ({
    content,
    focus: null,
    contextId: null,
    inspected: "empty",
    selection: null,
    frame: {
      contextWidth: 320,
      contextCollapsed: false,
      inspectorWidth: 320,
      inspectorCollapsed: false
    },
    zoom: null
  });
  wire.row = {
    revision: 7,
    tabs: [
      { id: "document-tab", category: "document-editor", resourceId: "document-1" },
      { id: "deck-tab", category: "slide-deck-editor", resourceId: "deck-1" },
      { id: "sheet-tab", category: "spreadsheet-editor", resourceId: "sheet-1" }
    ],
    activeId: "sheet-tab",
    views: {
      "document-tab": view("document-editor.document"),
      "deck-tab": view("slide-deck-editor.deck"),
      "sheet-tab": view("spreadsheet-editor.sheet")
    }
  };

  await held.workspace.restore();

  assert.deepEqual(held.documents.open, ["document-1"]);
  assert.deepEqual(held.decks.open, ["deck-1"]);
  assert.deepEqual(held.spreadsheets.open, ["sheet-1"]);
  assert.deepEqual(held.documents.released, ["orphan-document"]);
  assert.deepEqual(held.decks.released, ["orphan-deck"]);
  assert.deepEqual(held.spreadsheets.released, ["orphan-spreadsheet"]);
});
