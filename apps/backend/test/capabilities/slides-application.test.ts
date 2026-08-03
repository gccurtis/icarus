import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRichText, DEFAULT_CONFIG } from "../../src/0-platform/rich-text/index.js";
import type { InternalJobsRuntime } from "../../src/0-utils/jobs/internalRuntime.js";
import {
  INITIAL_BODY_SLOT_ID,
  INITIAL_LAYOUT_ID,
  INITIAL_MASTER_ID,
  INITIAL_SLIDE_ID,
  INITIAL_TITLE_SLOT_ID,
  createSlidesCapability,
  type SlideCommandResult,
  type SlideElement,
  type SlideInternalJobIntent,
  type SlideOperation,
  type SlideOptions,
  type SlideQueryResult,
  type SlidesCapability
} from "../../src/3-capabilities/slides/index.js";
import {
  CompensationConflictError,
  DeckNotFoundError,
  RevisionConflictError,
  SlideOperationError
} from "../../src/3-capabilities/slides/domain/errors.js";
import { SQLiteSlidesStore } from "../../src/3-capabilities/slides/persistence/sqliteSlidesStore.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const OPTIONS: SlideOptions = {
  history: {
    retainedBaseCount: 5,
    retainedChangeSetCount: 1_000,
    retainedTerminalAttemptCount: 1_000
  },
  limits: {
    maxSlidesPerDeck: 1_000,
    maxElementsPerContainer: 500,
    maxMastersPerDeck: 32,
    maxLayoutsPerDeck: 64,
    maxSlotsPerLayout: 32,
    maxStylesPerDeck: 256,
    maxTokensPerTheme: 256,
    maxGroupDepth: 16,
    maxTableRows: 1_000,
    maxTableColumns: 256
  }
};

const SLIDE = { kind: "slide", slideId: INITIAL_SLIDE_ID } as const;
const MASTER = { kind: "master", masterId: INITIAL_MASTER_ID } as const;
const LAYOUT = { kind: "layout", layoutId: INITIAL_LAYOUT_ID } as const;

interface Harness {
  slides: SlidesCapability;
  logs: CapturingLogger;
  dispatched: SlideInternalJobIntent[];
}

const harness = (options: SlideOptions = OPTIONS): Harness => {
  const logs = new CapturingLogger();
  const path = join(mkdtempSync(join(tmpdir(), "icarus-slides-app-")), "slides.db");
  const store = new SQLiteSlidesStore("project-slides-app", path, logs);
  const dispatched: SlideInternalJobIntent[] = [];
  const jobs: InternalJobsRuntime<SlideInternalJobIntent> = {
    dispatch: async (intent) => {
      dispatched.push(intent);
    }
  } as InternalJobsRuntime<SlideInternalJobIntent>;
  const slides = createSlidesCapability(
    store,
    { richText: createRichText(DEFAULT_CONFIG, logs), jobs, logger: logs },
    options
  );
  return { slides, logs, dispatched };
};

const createDeck = async (slides: SlidesCapability, title = "Quarterly review") => {
  const result = await slides.command({
    origin: "interactive",
    command: { type: "deck.create", title }
  });
  assert.equal(result.type, "deck.created");
  return (result as Extract<SlideCommandResult, { type: "deck.created" }>).head;
};

const submit = async (
  slides: SlidesCapability,
  deckId: string,
  expectedRevision: number,
  operations: SlideOperation[]
) => {
  const result = await slides.command({
    origin: "interactive",
    command: { type: "deck.submit", deckId, expectedRevision, operations }
  });
  assert.equal(result.type, "deck.changed");
  return (result as Extract<SlideCommandResult, { type: "deck.changed" }>).changeSet;
};

const load = async (slides: SlidesCapability, deckId: string, revision?: number) => {
  const result = await slides.query({
    query: { type: "deck.load", deckId, ...(revision !== undefined ? { revision } : {}) }
  });
  assert.equal(result.type, "deck.loaded");
  return result as Extract<SlideQueryResult, { type: "deck.loaded" }>;
};

const frame = (xPt = 10, yPt = 10, widthPt = 100, heightPt = 50) => ({
  xPt,
  yPt,
  widthPt,
  heightPt
});

const content = (id: string, text: string) => ({
  atoms: [{ id, kind: "text" as const, text }],
  marks: []
});

const textElement = (id: string, zIndex: number, text = "Hello"): SlideElement => ({
  id,
  kind: "text",
  zIndex,
  placement: { kind: "free", frame: frame() },
  locked: false,
  hidden: false,
  body: { kind: "rich", content: content(`${id}-atom`, text) }
});

const groupElement = (id: string, zIndex: number): SlideElement => ({
  id,
  kind: "group",
  zIndex,
  placement: { kind: "free", frame: frame() },
  locked: false,
  hidden: false
});

// ── Creation ─────────────────────────────────────────────────────────────

test("deck.create allocates the Deck and a Deck that satisfies every invariant", async () => {
  const { slides } = harness();
  const head = await createDeck(slides);

  assert.match(head.id, /^[0-9a-f-]{36}$/);
  assert.equal(head.revision, 1);
  assert.equal(head.baseSeq, 1);
  assert.equal(head.lifecycle, "active");
  assert.equal(head.title, "Quarterly review");

  const loaded = await load(slides, head.id);
  assert.deepEqual(Object.keys(loaded.snapshot.masters), [INITIAL_MASTER_ID]);
  assert.deepEqual(Object.keys(loaded.snapshot.layouts), [INITIAL_LAYOUT_ID]);
  assert.deepEqual(loaded.snapshot.slideOrder, [INITIAL_SLIDE_ID]);
  assert.equal(loaded.snapshot.slides[INITIAL_SLIDE_ID].layoutId, INITIAL_LAYOUT_ID);
  assert.deepEqual(
    Object.keys(loaded.snapshot.layouts[INITIAL_LAYOUT_ID].slots).sort(),
    [INITIAL_BODY_SLOT_ID, INITIAL_TITLE_SLOT_ID].sort()
  );
  // Exactly one protected style, and a default for every element kind.
  assert.equal(
    loaded.snapshot.styles.styles.filter((style) => style.systemRole === "normal").length,
    1
  );
});

test("deck.create is not deduplicated, and the duplicate is visible rather than silent", async () => {
  const { slides } = harness();
  const first = await createDeck(slides, "Once");
  const second = await createDeck(slides, "Once");

  // Create is the one command with no revision to compare against, so a retry
  // makes a second Deck. That is the accepted cost of having no request ID:
  // the duplicate shows up in deck.list, where a caller can see and delete it.
  assert.notEqual(first.id, second.id);
  const listed = await slides.query({ query: { type: "deck.list" } });
  assert.deepEqual(
    (listed as Extract<SlideQueryResult, { type: "deck.listed" }>).items
      .map((item) => item.id)
      .sort(),
    [first.id, second.id].sort()
  );
});

// ── The end-to-end editing slice ─────────────────────────────────────────

test("a Deck is edited across all three planes and reads back", async () => {
  const { slides } = harness();
  const head = await createDeck(slides);

  // Master: a backdrop element behind every Slide.
  await submit(slides, head.id, 1, [
    { type: "master.rename", masterId: INITIAL_MASTER_ID, name: "Brand" },
    { type: "element.insert", container: MASTER, element: textElement("footer", 0, "Confidential") }
  ]);

  // Layout: a new slot, and an element on the Layout plane.
  await submit(slides, head.id, 2, [
    {
      type: "slot.insert",
      layoutId: INITIAL_LAYOUT_ID,
      slot: { id: "slot-caption", name: "Caption", frame: frame(40, 460, 600, 40), accepts: ["text"] }
    },
    { type: "element.insert", container: LAYOUT, element: textElement("rule", 0, "—") }
  ]);

  // Slide: a slot-bound title and a free element.
  await submit(slides, head.id, 3, [
    {
      type: "element.insert",
      container: SLIDE,
      element: {
        ...textElement("title", 0, "Q3"),
        placement: { kind: "slot", slotId: INITIAL_TITLE_SLOT_ID }
      }
    },
    { type: "element.insert", container: SLIDE, element: textElement("body", 1, "Revenue up") }
  ]);

  const loaded = await load(slides, head.id);
  assert.equal(loaded.head.revision, 4);
  assert.equal(loaded.snapshot.masters[INITIAL_MASTER_ID].name, "Brand");
  assert.ok(loaded.snapshot.masters[INITIAL_MASTER_ID].elements.footer);
  assert.ok(loaded.snapshot.layouts[INITIAL_LAYOUT_ID].slots["slot-caption"]);
  assert.ok(loaded.snapshot.layouts[INITIAL_LAYOUT_ID].elements.rule);
  assert.deepEqual(loaded.snapshot.slides[INITIAL_SLIDE_ID].elements.title.placement, {
    kind: "slot",
    slotId: INITIAL_TITLE_SLOT_ID
  });
  // A Slide element on one plane is invisible to the others.
  assert.equal(loaded.snapshot.slides[INITIAL_SLIDE_ID].elements.footer, undefined);
});

test("slides are added against a Layout, reordered, and deleted", async () => {
  const { slides } = harness();
  const head = await createDeck(slides);
  const newSlide = (id: string) => ({
    id,
    layoutId: INITIAL_LAYOUT_ID,
    notes: content(`${id}-notes`, ""),
    elements: {}
  });

  await submit(slides, head.id, 1, [
    { type: "slide.insert", slide: newSlide("slide-2"), afterSlideId: INITIAL_SLIDE_ID },
    { type: "slide.insert", slide: newSlide("slide-3"), afterSlideId: "slide-2" }
  ]);
  assert.deepEqual((await load(slides, head.id)).snapshot.slideOrder, [
    INITIAL_SLIDE_ID,
    "slide-2",
    "slide-3"
  ]);

  await submit(slides, head.id, 2, [{ type: "slide.move", slideId: "slide-3" }]);
  assert.deepEqual((await load(slides, head.id)).snapshot.slideOrder, [
    "slide-3",
    INITIAL_SLIDE_ID,
    "slide-2"
  ]);

  await submit(slides, head.id, 3, [{ type: "slide.delete", slideId: "slide-2" }]);
  assert.deepEqual((await load(slides, head.id)).snapshot.slideOrder, [
    "slide-3",
    INITIAL_SLIDE_ID
  ]);
});

test("elements group, reorder and ungroup, keeping z-order contiguous", async () => {
  const { slides } = harness();
  const head = await createDeck(slides);

  await submit(slides, head.id, 1, [
    { type: "element.insert", container: SLIDE, element: textElement("a", 0) },
    { type: "element.insert", container: SLIDE, element: textElement("b", 1) },
    { type: "element.insert", container: SLIDE, element: textElement("c", 2) }
  ]);
  await submit(slides, head.id, 2, [
    {
      type: "element.group",
      container: SLIDE,
      group: groupElement("g", 0),
      memberIds: ["a", "c"]
    }
  ]);

  const grouped = (await load(slides, head.id)).snapshot.slides[INITIAL_SLIDE_ID].elements;
  assert.equal(grouped.g.zIndex, 0);
  assert.equal(grouped.b.zIndex, 1);
  assert.equal(grouped.a.parentGroupId, "g");
  assert.equal(grouped.c.parentGroupId, "g");

  await submit(slides, head.id, 3, [
    { type: "element.ungroup", container: SLIDE, groupId: "g" }
  ]);
  const ungrouped = (await load(slides, head.id)).snapshot.slides[INITIAL_SLIDE_ID].elements;
  assert.deepEqual(
    Object.values(ungrouped)
      .sort((left, right) => left.zIndex - right.zIndex)
      .map((element) => `${element.id}@${element.zIndex}`),
    ["a@0", "c@1", "b@2"]
  );
});

test("a table is inserted and its structure edited", async () => {
  const { slides } = harness();
  const head = await createDeck(slides);
  const cell = (id: string, rowId: string, columnId: string, text: string) => ({
    id,
    rowId,
    columnId,
    body: { kind: "rich" as const, content: content(`${id}-atom`, text) },
    verticalAlign: "top" as const
  });

  await submit(slides, head.id, 1, [
    {
      type: "element.insert",
      container: SLIDE,
      element: {
        id: "grid",
        kind: "table",
        zIndex: 0,
        placement: { kind: "free", frame: frame() },
        locked: false,
        hidden: false,
        table: {
          id: "grid-table",
          columns: [{ id: "c1", width: { kind: "auto" } }],
          rows: [{ id: "r1", header: true }],
          cells: [cell("r1c1", "r1", "c1", "Region")],
          merges: []
        }
      }
    }
  ]);
  await submit(slides, head.id, 2, [
    {
      type: "table.insert-row",
      container: SLIDE,
      elementId: "grid",
      row: { id: "r2", header: false },
      cells: [cell("r2c1", "r2", "c1", "North")],
      afterRowId: "r1"
    }
  ]);

  const loaded = await load(slides, head.id);
  const table = (loaded.snapshot.slides[INITIAL_SLIDE_ID].elements.grid as { table: { rows: Array<{ id: string }> } }).table;
  assert.deepEqual(table.rows.map((row) => row.id), ["r1", "r2"]);
});

// ── Concurrency and history ──────────────────────────────────────────────

test("a submission from the future is refused, and a stale one rebases when it can", async () => {
  const { slides } = harness();
  const head = await createDeck(slides);

  await assert.rejects(
    () => submit(slides, head.id, 9, [{ type: "deck.rename", title: "Ahead" }]),
    RevisionConflictError
  );

  await submit(slides, head.id, 1, [
    { type: "element.insert", container: SLIDE, element: textElement("a", 0) }
  ]);

  // Authored against revision 1, landing on revision 2. It touches a Master and
  // the intervening ChangeSet touched a Slide element, so nothing collides.
  const rebased = await submit(slides, head.id, 1, [
    { type: "master.rename", masterId: INITIAL_MASTER_ID, name: "Rebased" }
  ]);
  assert.equal(rebased.authoredRevision, 1);
  assert.equal(rebased.priorRevision, 2);
  assert.equal(rebased.revision, 3);
  assert.equal(
    (await load(slides, head.id)).snapshot.masters[INITIAL_MASTER_ID].name,
    "Rebased"
  );
});

test("two concurrent renames conflict rather than one being silently lost", async () => {
  // Deck-level fields own no identity. Without a sentinel touched ID the rebase
  // check sees two renames as touching nothing in common and admits both, so
  // the first writer's title vanishes with a 200. Found by running the slice
  // over HTTP, where it looked like a passing write.
  const { slides } = harness();
  const head = await createDeck(slides);
  await submit(slides, head.id, 1, [{ type: "deck.rename", title: "First" }]);

  await assert.rejects(
    () => submit(slides, head.id, 1, [{ type: "deck.rename", title: "Second" }]),
    RevisionConflictError
  );
  assert.equal((await load(slides, head.id)).snapshot.title, "First");

  // A different deck-level field still rebases cleanly: the sentinels are per
  // field, not one for the whole Deck.
  await submit(slides, head.id, 1, [
    { type: "canvas.set", canvas: { widthPt: 720, heightPt: 405 } }
  ]);
  assert.equal((await load(slides, head.id)).snapshot.canvas.widthPt, 720);
});

test("a stale submission touching the same element is refused", async () => {
  const { slides } = harness();
  const head = await createDeck(slides);
  await submit(slides, head.id, 1, [
    { type: "element.insert", container: SLIDE, element: textElement("a", 0) }
  ]);
  await submit(slides, head.id, 2, [
    { type: "element.set-flags", container: SLIDE, elementId: "a", locked: true, hidden: false }
  ]);

  await assert.rejects(
    () =>
      submit(slides, head.id, 2, [
        { type: "element.set-flags", container: SLIDE, elementId: "a", locked: false, hidden: true }
      ]),
    RevisionConflictError
  );
});

test("a resent submission is refused by the revision check, not applied twice", async () => {
  const { slides } = harness();
  const head = await createDeck(slides);
  const operations: SlideOperation[] = [
    { type: "element.insert", container: SLIDE, element: textElement("a", 0) }
  ];

  await submit(slides, head.id, 1, operations);
  // The resend still carries revision 1, which the head has passed. Rebase
  // cannot save it either: the element it inserts is exactly the one the first
  // attempt already landed, so the touched IDs collide.
  await assert.rejects(
    () =>
      slides.command({
        origin: "interactive",
        command: { type: "deck.submit", deckId: head.id, expectedRevision: 1, operations }
      }),
    RevisionConflictError
  );
  const loaded = await load(slides, head.id);
  assert.equal(loaded.head.revision, 2);
  assert.deepEqual(Object.keys(loaded.snapshot.slides[INITIAL_SLIDE_ID].elements), ["a"]);
});

test("undo restores the previous state exactly, and redo puts it back", async () => {
  const { slides } = harness();
  const head = await createDeck(slides);
  const before = (await load(slides, head.id)).snapshot;

  const changeSet = await submit(slides, head.id, 1, [
    { type: "element.insert", container: SLIDE, element: textElement("a", 0, "Draft") },
    { type: "deck.rename", title: "Edited" }
  ]);

  const undone = await slides.command({
    origin: "interactive",
    command: {
      type: "deck.compensate",
      deckId: head.id,
      targetChangeSetId: changeSet.id,
      intent: "undo",
      expectedRevision: 2
    }
  });
  assert.equal(undone.type, "deck.changed");
  const afterUndo = await load(slides, head.id);
  assert.equal(afterUndo.head.revision, 3);
  // Everything but the revision counter is restored byte for byte. The
  // semantic digest cannot be compared directly: it is taken over the whole
  // snapshot including `revision`, so it necessarily differs even when the
  // content is identical — the same is true of Document's.
  assert.deepEqual({ ...afterUndo.snapshot, revision: 1 }, before);
  assert.equal(afterUndo.snapshot.slides[INITIAL_SLIDE_ID].elements.a, undefined);
  assert.equal(afterUndo.snapshot.title, "Quarterly review");

  // Redo compensates the compensation, and identity reactivation is what lets
  // element `a` come back under the ID it already burned.
  const undoChangeSet = (undone as Extract<SlideCommandResult, { type: "deck.changed" }>).changeSet;
  await slides.command({
    origin: "interactive",
    command: {
      type: "deck.compensate",
      deckId: head.id,
      targetChangeSetId: undoChangeSet.id,
      intent: "redo",
      expectedRevision: 3
    }
  });
  const afterRedo = await load(slides, head.id);
  assert.equal(afterRedo.snapshot.title, "Edited");
  assert.ok(afterRedo.snapshot.slides[INITIAL_SLIDE_ID].elements.a);
});

test("compensation is refused when an intervening ChangeSet touched the same thing", async () => {
  const { slides } = harness();
  const head = await createDeck(slides);
  const target = await submit(slides, head.id, 1, [
    { type: "element.insert", container: SLIDE, element: textElement("a", 0) }
  ]);
  await submit(slides, head.id, 2, [
    { type: "element.set-flags", container: SLIDE, elementId: "a", locked: true, hidden: false }
  ]);

  await assert.rejects(
    () =>
      slides.command({
        origin: "interactive",
        command: {
          type: "deck.compensate",
          deckId: head.id,
          targetChangeSetId: target.id,
          intent: "undo",
          expectedRevision: 3
        }
      }),
    CompensationConflictError
  );
});

test("an older revision loads as it was, not as it is now", async () => {
  const { slides } = harness();
  const head = await createDeck(slides);
  await submit(slides, head.id, 1, [{ type: "deck.rename", title: "Second" }]);
  await submit(slides, head.id, 2, [{ type: "deck.rename", title: "Third" }]);

  assert.equal((await load(slides, head.id, 1)).snapshot.title, "Quarterly review");
  assert.equal((await load(slides, head.id, 2)).snapshot.title, "Second");
  assert.equal((await load(slides, head.id)).snapshot.title, "Third");
});

test("compaction is dispatched once the retained window is exceeded", async () => {
  const { slides, dispatched } = harness({
    ...OPTIONS,
    history: { ...OPTIONS.history, retainedChangeSetCount: 2 }
  });
  const head = await createDeck(slides);
  for (let revision = 1; revision <= 3; revision += 1) {
    await submit(slides, head.id, revision, [
      { type: "deck.rename", title: `Title ${revision}` }
    ]);
  }
  assert.ok(dispatched.some((intent) => intent.type === "slides.compact"));

  // And it actually runs: a Base is appended and history prunes behind it.
  assert.equal(await slides.compact(head.id), true);
  assert.equal((await load(slides, head.id)).snapshot.title, "Title 3");
});

// ── Guards ───────────────────────────────────────────────────────────────

test("the public submit path cannot forge a prompt source", async () => {
  // A prompt source names a Derived Output whose ownership row is written by
  // the creation pipeline. Writing one directly would leave a reference nothing
  // owns, which the detach diff cannot see and `deck.load` cannot resolve.
  const { slides } = harness();
  const head = await createDeck(slides);
  const prompted: SlideElement = {
    ...textElement("forged", 0),
    body: { kind: "prompt", output: { outputId: "not-ours", appliedRevision: 1 } }
  };

  for (const operations of [
    [{ type: "element.insert", container: SLIDE, element: prompted }],
    [
      {
        type: "text-source.set",
        target: { kind: "element-body", container: SLIDE, elementId: "forged" },
        source: { kind: "prompt", output: { outputId: "not-ours", appliedRevision: 1 } }
      }
    ],
    [
      {
        type: "prompt.apply-derived-output",
        site: { kind: "element-body", container: SLIDE, elementId: "forged" },
        output: { outputId: "not-ours", appliedRevision: 1 }
      }
    ]
  ] satisfies SlideOperation[][]) {
    await assert.rejects(
      () => submit(slides, head.id, 1, operations),
      (error: unknown) =>
        error instanceof SlideOperationError &&
        /prompt source is created through prompt\.create\.request/.test(
          (error as Error).message
        )
    );
  }
});

test("commands not yet implemented are refused by name", async () => {
  const { slides } = harness();
  const head = await createDeck(slides);
  await assert.rejects(
    () =>
      slides.command({
        origin: "interactive",
        command: {
          type: "prompt.refresh.request",
          deckId: head.id,
          site: { kind: "element-body", container: SLIDE, elementId: "a" },
          expectedRevision: 1
        }
      }),
    (error: unknown) =>
      error instanceof SlideOperationError &&
      /not implemented yet: prompt\.refresh\.request/.test((error as Error).message)
  );
});

test("an invalid batch is refused whole, leaving the revision untouched", async () => {
  const { slides } = harness();
  const head = await createDeck(slides);
  await assert.rejects(() =>
    submit(slides, head.id, 1, [
      { type: "element.insert", container: SLIDE, element: textElement("a", 0) },
      { type: "element.insert", container: SLIDE, element: groupElement("empty", 1) }
    ])
  );
  const loaded = await load(slides, head.id);
  assert.equal(loaded.head.revision, 1);
  assert.equal(loaded.snapshot.slides[INITIAL_SLIDE_ID].elements.a, undefined);
});

// ── Lifecycle and queries ────────────────────────────────────────────────

test("deck.list pages, and deck.delete removes the Deck but keeps its history", async () => {
  const { slides } = harness();
  const first = await createDeck(slides, "Alpha");
  const second = await createDeck(slides, "Beta");

  const listed = await slides.query({ query: { type: "deck.list" } });
  assert.equal(listed.type, "deck.listed");
  assert.deepEqual(
    (listed as Extract<SlideQueryResult, { type: "deck.listed" }>).items
      .map((head) => head.title)
      .sort(),
    ["Alpha", "Beta"]
  );

  const deleted = await slides.command({
    origin: "interactive",
    command: { type: "deck.delete", deckId: second.id, expectedRevision: 1 }
  });
  assert.equal(deleted.type, "deck.deleted");
  await assert.rejects(() => load(slides, second.id), DeckNotFoundError);
  // The retained revision still reads back: deletion is logical.
  assert.equal((await load(slides, second.id, 1)).snapshot.title, "Beta");
  assert.equal((await load(slides, first.id)).head.id, first.id);
});

test("deck.history returns the ChangeSets and 404s an unknown Deck", async () => {
  const { slides } = harness();
  const head = await createDeck(slides);
  await submit(slides, head.id, 1, [{ type: "deck.rename", title: "Second" }]);

  const history = await slides.query({
    query: { type: "deck.history", deckId: head.id, limit: 10 }
  });
  assert.equal(history.type, "deck.history");
  assert.deepEqual(
    (history as Extract<SlideQueryResult, { type: "deck.history" }>).items.map((c) => c.revision),
    [2]
  );

  await assert.rejects(
    () =>
      slides.query({
        query: { type: "deck.history", deckId: "missing", limit: 10 }
      }),
    DeckNotFoundError
  );
});

// ── Observability ────────────────────────────────────────────────────────

test("the command path logs start, completion and the store's commits", async () => {
  const { slides, logs } = harness();
  const head = await createDeck(slides);
  await submit(slides, head.id, 1, [{ type: "deck.rename", title: "Logged" }]);

  const names = logs.entries.map((entry) => entry.message);
  for (const expected of [
    "slides.command.started",
    "slides.command.completed",
    "slides.store.deck.created",
    "slides.store.mutation.committed"
  ]) {
    assert.ok(names.includes(expected), expected);
  }

  const completed = logs.entries.find(
    (entry) => entry.message === "slides.command.completed"
  );
  assert.equal((completed?.data as { commandType: string }).commandType, "deck.create");
  assert.ok((completed?.data as { durationMs: number }).durationMs >= 0);
});

test("a rejected rebase is logged with what conflicted", async () => {
  const { slides, logs } = harness();
  const head = await createDeck(slides);
  await submit(slides, head.id, 1, [
    { type: "element.insert", container: SLIDE, element: textElement("a", 0) }
  ]);
  await submit(slides, head.id, 2, [
    { type: "element.set-flags", container: SLIDE, elementId: "a", locked: true, hidden: false }
  ]);
  await assert.rejects(() =>
    submit(slides, head.id, 2, [
      { type: "element.set-flags", container: SLIDE, elementId: "a", locked: false, hidden: true }
    ])
  );

  const refused = logs.entries.find(
    (entry) => entry.message === "slides.mutation.rebase-refused"
  );
  assert.ok(refused, "a refused rebase must say what conflicted");
  assert.deepEqual((refused?.data as { conflictingIds: string[] }).conflictingIds, ["a"]);
});
