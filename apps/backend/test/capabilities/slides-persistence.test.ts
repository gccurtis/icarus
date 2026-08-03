import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import {
  InvalidDeckCursorError,
  SlideIdentityReuseError
} from "../../src/3-capabilities/slides/domain/errors.js";
import {
  collectSlideIdentities,
  computeSlideIdentityTransitions,
  type SlideIdentityKind
} from "../../src/3-capabilities/slides/domain/identities.js";
import type {
  DeckBase,
  DeckChangeSet,
  DeckCommittedTransaction,
  DeckHead,
  DeckSnapshot,
  PromptCreationAttempt,
  PromptSite,
  SlideStageReceipt
} from "../../src/3-capabilities/slides/domain/model.js";
import type {
  DeckCreationCommit,
  DeckMutationCommit
} from "../../src/3-capabilities/slides/ports/slidesStore.js";
import { SQLiteSlidesStore } from "../../src/3-capabilities/slides/persistence/sqliteSlidesStore.js";
import { createSlideTableNames } from "../../src/3-capabilities/slides/persistence/sqliteSchema.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const PROJECT = "project-slides-persistence";

const timestamp = (offset: number): string =>
  new Date(Date.UTC(2026, 0, 1, 0, 0, offset)).toISOString();

const storePath = (): string =>
  join(mkdtempSync(join(tmpdir(), "icarus-slides-store-")), "slides.db");

const newStore = (): { store: SQLiteSlidesStore; logs: CapturingLogger; path: string } => {
  const logs = new CapturingLogger();
  const path = storePath();
  return { store: new SQLiteSlidesStore(PROJECT, path, logs), logs, path };
};

const snapshot = (title: string): DeckSnapshot => ({
  representationVersion: 1,
  revision: 1,
  title,
  lifecycle: "active",
  canvas: { widthPt: 720, heightPt: 405 },
  theme: {
    name: "Default",
    tokens: {
      "token-ink": { id: "token-ink", kind: "color", name: "Ink", value: "#111111" }
    },
    palette: {
      background: { kind: "literal", value: "#ffffff" },
      surface: { kind: "literal", value: "#f5f5f5" },
      text: { kind: "token", tokenId: "token-ink" },
      accent: { kind: "literal", value: "#0055ff" }
    },
    typography: {
      headingFontFamily: { kind: "literal", value: "Inter" },
      bodyFontFamily: { kind: "literal", value: "Inter" },
      baseFontSizePt: { kind: "literal", value: 18 }
    }
  },
  styles: {
    defaultStyleIdByElementKind: {
      group: "style-normal",
      text: "style-normal",
      table: "style-normal",
      chart: "style-normal",
      image: "style-normal",
      geometry: "style-normal",
      line: "style-normal"
    },
    styles: [{ id: "style-normal", name: "Normal", systemRole: "normal" }]
  },
  masters: {
    "master-1": { id: "master-1", name: "Master", background: { kind: "inherit" }, elements: {} }
  },
  layouts: {
    "layout-1": {
      id: "layout-1",
      name: "Layout",
      masterId: "master-1",
      elements: {},
      slots: {}
    }
  },
  slideOrder: ["slide-1"],
  slides: {
    "slide-1": {
      id: "slide-1",
      layoutId: "layout-1",
      notes: { atoms: [{ id: "notes-atom", kind: "text", text: "Notes" }], marks: [] },
      elements: {}
    }
  }
});

const creationCommit = (
  deckId: string,
  requestId = `create-${deckId}`
): DeckCreationCommit => {
  const deckSnapshot = snapshot(`Deck ${deckId}`);
  const head: DeckHead = {
    id: deckId,
    title: deckSnapshot.title,
    lifecycle: "active",
    revision: 1,
    baseSeq: 1,
    semanticDigest: `digest-${deckId}-0`,
    createdAt: timestamp(0),
    updatedAt: timestamp(0)
  };
  const base: DeckBase = {
    representationVersion: 1,
    deckId,
    baseSeq: 1,
    snapshot: deckSnapshot,
    semanticDigest: head.semanticDigest,
    createdAt: timestamp(0)
  };
  const result = { type: "deck.created", head } as const;
  return {
    head,
    base,
    identities: collectSlideIdentities(deckSnapshot),
    receipt: {
      deckId,
      requestId,
      requestDigest: `digest-${requestId}`,
      result,
      createdAt: timestamp(0)
    },
    createReceipt: {
      requestId,
      deckId,
      requestDigest: `digest-${requestId}`,
      result,
      createdAt: timestamp(0)
    },
    transaction: {
      sourceTransactionId: `txn-${deckId}-1`,
      sourceRequestId: requestId,
      kind: "deck.created",
      deckId,
      revision: 1,
      origin: "interactive",
      operationTypes: ["deck.create"],
      sourceSemanticDigest: head.semanticDigest,
      occurredAt: timestamp(0)
    }
  };
};

const mutationCommit = (
  deckId: string,
  expectedRevision: number,
  before: DeckSnapshot,
  after: DeckSnapshot,
  requestId = `submit-${deckId}-${expectedRevision}`
): DeckMutationCommit => {
  const revision = expectedRevision + 1;
  const head: DeckHead = {
    id: deckId,
    title: after.title,
    lifecycle: after.lifecycle,
    revision,
    baseSeq: 1,
    semanticDigest: `digest-${deckId}-${revision}`,
    createdAt: timestamp(0),
    updatedAt: timestamp(revision)
  };
  const changeSet: DeckChangeSet = {
    id: `cs-${deckId}-${revision}`,
    deckId,
    clientRequestId: requestId,
    requestDigest: `digest-${requestId}`,
    authoredRevision: expectedRevision,
    priorRevision: expectedRevision,
    revision,
    seq: revision,
    origin: "interactive",
    operations: [{ type: "deck.rename", title: after.title }],
    inverseOperations: [{ type: "deck.rename", title: before.title }],
    touchedIds: [],
    semanticDigest: head.semanticDigest,
    createdAt: timestamp(revision)
  };
  return {
    expectedRevision,
    head,
    changeSet,
    receipt: {
      deckId,
      requestId,
      requestDigest: `digest-${requestId}`,
      result: { type: "deck.changed", changeSet },
      createdAt: timestamp(revision)
    },
    transaction: {
      sourceTransactionId: `txn-${deckId}-${revision}`,
      sourceRequestId: requestId,
      kind: "deck.changed",
      deckId,
      revision,
      sourceChangeSetId: changeSet.id,
      origin: "interactive",
      operationTypes: ["deck.rename"],
      sourceSemanticDigest: head.semanticDigest,
      occurredAt: timestamp(revision)
    },
    identityTransitions: computeSlideIdentityTransitions(before, after),
    identityReactivation: "forbid"
  };
};

const renamed = (source: DeckSnapshot, title: string): DeckSnapshot => ({
  ...source,
  title
});

// ── Schema ───────────────────────────────────────────────────────────────

test("the schema is created with the four standard pragmas and a hashed prefix", async () => {
  const { path } = newStore();
  const db = new Database(path);
  assert.equal(String(db.pragma("journal_mode", { simple: true })).toLowerCase(), "wal");
  assert.equal(Number(db.pragma("foreign_keys", { simple: true })), 1);
  assert.equal(Number(db.pragma("busy_timeout", { simple: true })), 5000);

  const tables = createSlideTableNames(PROJECT);
  // The prefix is a hash of the project ID, never the project ID itself.
  assert.match(tables.decks, /^slides_[0-9a-f]{16}_decks$/);
  assert.ok(!tables.decks.includes(PROJECT));

  const present = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{
      name: string;
    }>).map((row) => row.name)
  );
  for (const table of Object.values(tables)) assert.ok(present.has(table), table);
  db.close();
});

test("the identity-kind CHECK constraint matches the SlideIdentityKind union", async () => {
  // If a kind is added to the union and not to the DDL, every write of that kind
  // fails at runtime. This keeps the two from drifting.
  const { store, path } = newStore();
  await store.commitCreation(creationCommit("deck-kinds"));
  const db = new Database(path);
  const tables = createSlideTableNames(PROJECT);
  const ddl = (
    db.prepare("SELECT sql FROM sqlite_master WHERE name = ?").get(tables.identityLedger) as {
      sql: string;
    }
  ).sql;
  db.close();

  const kinds: SlideIdentityKind[] = [
    "style", "token", "master", "layout", "slot", "slide", "element",
    "table", "table-row", "table-column", "table-cell", "table-merge",
    "chart-label", "rich-text-atom", "rich-text-mark"
  ];
  // Compare the CHECK list itself, not a count over the whole DDL — the table
  // has other CHECK clauses, and a count would pass for the wrong reason.
  const clause = /identity_kind\s+TEXT NOT NULL\s*CHECK \(identity_kind IN \(([^)]*)\)\)/.exec(ddl);
  assert.ok(clause, "identity_kind CHECK clause not found");
  const declared = [...clause[1].matchAll(/'([a-z-]+)'/g)].map((match) => match[1]);
  assert.deepEqual([...declared].sort(), [...kinds].sort());
});

// ── Creation and replay ──────────────────────────────────────────────────

test("creation commits head, base, receipts, identities and outbox atomically", async () => {
  const { store } = newStore();
  const commit = creationCommit("deck-1");
  await store.commitCreation(commit);

  const head = await store.getHead("deck-1");
  assert.equal(head?.revision, 1);
  assert.equal(await store.hasResource("deck-1"), true);
  assert.deepEqual((await store.getBaseAtOrBefore("deck-1", 1))?.baseSeq, 1);
  assert.equal((await store.getSubmission("deck-1", "create-deck-1"))?.requestId, "create-deck-1");
  assert.equal((await store.getCreateSubmission("create-deck-1"))?.deckId, "deck-1");
  assert.equal((await store.getIdentity("deck-1", "slide-1"))?.kind, "slide");
  assert.equal(
    (await store.getCommittedTransaction("txn-deck-1-1"))?.kind,
    "deck.created"
  );
});

test("creation refuses to claim one identity twice", async () => {
  const { store } = newStore();
  const commit = creationCommit("deck-dup");
  await assert.rejects(
    () =>
      store.commitCreation({
        ...commit,
        identities: [...commit.identities, { kind: "element", id: "slide-1" }]
      }),
    SlideIdentityReuseError
  );
  // The whole transaction rolled back, so nothing landed.
  assert.equal(await store.getHead("deck-dup"), undefined);
  assert.equal(await store.hasResource("deck-dup"), false);
});

test("a create receipt survives for replay and cascades on purge", async () => {
  const { store } = newStore();
  await store.commitCreation(creationCommit("deck-replay"));
  assert.equal((await store.getCreateSubmission("create-deck-replay"))?.deckId, "deck-replay");

  await store.deleteDeck("deck-replay", timestamp(10), {
    sourceTransactionId: "txn-deck-replay-del",
    sourceRequestId: "delete-1",
    kind: "deck.deleted",
    deckId: "deck-replay",
    revision: 2,
    origin: "interactive",
    operationTypes: ["deck.delete"],
    sourceSemanticDigest: "digest-deck-replay-0",
    occurredAt: timestamp(10)
  });
  // The Deck row is gone, so the receipt cascaded; the resource root remains.
  assert.equal(await store.getCreateSubmission("create-deck-replay"), undefined);
  assert.equal(await store.hasResource("deck-replay"), true);
  assert.equal((await store.getHistoricalHead("deck-replay", 1))?.revision, 1);
});

// ── Mutation and compare-and-set ─────────────────────────────────────────

test("a mutation commits on the expected revision and is refused off it", async () => {
  const { store, logs } = newStore();
  await store.commitCreation(creationCommit("deck-cas"));
  const first = snapshot("Deck deck-cas");

  assert.equal(
    await store.commitMutation(
      mutationCommit("deck-cas", 1, first, renamed(first, "Renamed once"))
    ),
    true
  );
  assert.equal((await store.getHead("deck-cas"))?.revision, 2);

  // A second writer still holding revision 1 loses the compare-and-set. This is
  // an ordinary outcome, not an error: false, with nothing written.
  assert.equal(
    await store.commitMutation(
      mutationCommit("deck-cas", 1, first, renamed(first, "Renamed twice"), "submit-late")
    ),
    false
  );
  assert.equal((await store.getHead("deck-cas"))?.revision, 2);
  assert.equal(await store.getSubmission("deck-cas", "submit-late"), undefined);

  const rejected = logs.entries.find((e) => e.message === "slides.store.mutation.rejected");
  assert.equal(rejected?.level, "warn");
  assert.equal((rejected?.data as { reason: string }).reason, "revision-conflict");
});

test("a mutation records history, the ChangeSet, the receipt and the outbox together", async () => {
  const { store } = newStore();
  await store.commitCreation(creationCommit("deck-hist"));
  const first = snapshot("Deck deck-hist");
  await store.commitMutation(mutationCommit("deck-hist", 1, first, renamed(first, "Second")));

  assert.equal((await store.getHistoricalHead("deck-hist", 1))?.revision, 1);
  const changeSets = await store.getChangeSets("deck-hist", 0, 2);
  assert.deepEqual(changeSets.map((c) => c.revision), [2]);
  assert.deepEqual(changeSets[0].inverseOperations, [
    { type: "deck.rename", title: "Deck deck-hist" }
  ]);
  assert.equal((await store.getSubmission("deck-hist", "submit-deck-hist-1"))?.requestId, "submit-deck-hist-1");
  assert.equal((await store.getCommittedTransaction("txn-deck-hist-2"))?.revision, 2);
});

test("inconsistent mutation revisions are refused before any write", async () => {
  const { store } = newStore();
  await store.commitCreation(creationCommit("deck-bad"));
  const first = snapshot("Deck deck-bad");
  const commit = mutationCommit("deck-bad", 1, first, renamed(first, "X"));

  await assert.rejects(
    () => store.commitMutation({ ...commit, expectedRevision: 5 }),
    /revisions are inconsistent/
  );
  await assert.rejects(
    () =>
      store.commitMutation({
        ...commit,
        identityReactivation: "same-kind-compensation"
      }),
    /requires a compensation ChangeSet/
  );
  assert.equal((await store.getHead("deck-bad"))?.revision, 1);
});

test("a commit whose parts belong to different Decks is refused", async () => {
  const { store } = newStore();
  await store.commitCreation(creationCommit("deck-mixed"));
  const first = snapshot("Deck deck-mixed");
  const commit = mutationCommit("deck-mixed", 1, first, renamed(first, "X"));
  await assert.rejects(
    () =>
      store.commitMutation({
        ...commit,
        changeSet: { ...commit.changeSet, deckId: "other-deck" }
      }),
    /belongs to 'other-deck'/
  );
});

// ── Identity ledger ──────────────────────────────────────────────────────

test("an identity is tombstoned on removal and may not be reused", async () => {
  const { store } = newStore();
  await store.commitCreation(creationCommit("deck-ledger"));
  const first = snapshot("Deck deck-ledger");

  const withoutSlide: DeckSnapshot = { ...first, slideOrder: [], slides: {} };
  await store.commitMutation(mutationCommit("deck-ledger", 1, first, withoutSlide));
  const tombstoned = await store.getIdentity("deck-ledger", "slide-1");
  assert.equal(tombstoned?.state, "tombstoned");
  assert.equal(tombstoned?.tombstonedRevision, 2);

  // Re-adding the same ID outside a compensation is permanent reuse.
  await assert.rejects(
    () => store.commitMutation(mutationCommit("deck-ledger", 2, withoutSlide, first)),
    SlideIdentityReuseError
  );
  assert.equal((await store.getHead("deck-ledger"))?.revision, 2);
});

test("compensation reactivates a tombstoned identity of the same kind", async () => {
  const { store, logs } = newStore();
  await store.commitCreation(creationCommit("deck-undo"));
  const first = snapshot("Deck deck-undo");
  const withoutSlide: DeckSnapshot = { ...first, slideOrder: [], slides: {} };
  await store.commitMutation(mutationCommit("deck-undo", 1, first, withoutSlide));

  const undo = mutationCommit("deck-undo", 2, withoutSlide, first, "undo-1");
  assert.equal(
    await store.commitMutation({
      ...undo,
      identityReactivation: "same-kind-compensation",
      changeSet: {
        ...undo.changeSet,
        compensation: { intent: "undo", targetChangeSetId: "cs-deck-undo-2" }
      }
    }),
    true
  );
  assert.equal((await store.getIdentity("deck-undo", "slide-1"))?.state, "active");
  assert.ok(logs.entries.some((e) => e.message === "slides.store.identity.reactivated"));
});

// ── History, bases and pagination ────────────────────────────────────────

test("a Base is appended only while the head has not moved", async () => {
  const { store } = newStore();
  await store.commitCreation(creationCommit("deck-base"));
  const first = snapshot("Deck deck-base");
  await store.commitMutation(mutationCommit("deck-base", 1, first, renamed(first, "Second")));

  const base: DeckBase = {
    representationVersion: 1,
    deckId: "deck-base",
    baseSeq: 2,
    snapshot: renamed(first, "Second"),
    semanticDigest: "digest-deck-base-2",
    createdAt: timestamp(5)
  };
  assert.equal(await store.appendBaseIfHead("deck-base", 1, base), false);
  assert.equal(await store.appendBaseIfHead("deck-base", 2, base), true);
  assert.equal((await store.getBaseAtOrBefore("deck-base", 2))?.baseSeq, 2);
  assert.equal((await store.getHead("deck-base"))?.baseSeq, 2);
});

test("pruning keeps the retained window and drops the rest", async () => {
  const { store } = newStore();
  await store.commitCreation(creationCommit("deck-prune"));
  let current = snapshot("Deck deck-prune");
  for (let revision = 1; revision <= 5; revision += 1) {
    const next = renamed(current, `Title ${revision}`);
    await store.commitMutation(mutationCommit("deck-prune", revision, current, next));
    current = next;
  }
  assert.equal((await store.getChangeSets("deck-prune", 0, 99)).length, 5);

  await store.pruneHistory("deck-prune", 1, 2, 0);
  const kept = await store.getChangeSets("deck-prune", 0, 99);
  assert.deepEqual(kept.map((c) => c.revision), [5, 6]);
});

test("head and ChangeSet pagination round-trip their cursors and reject junk", async () => {
  const { store } = newStore();
  for (const id of ["deck-a", "deck-b", "deck-c"]) {
    await store.commitCreation(creationCommit(id));
  }
  const firstPage = await store.listHeads(undefined, undefined, 2);
  assert.equal(firstPage.items.length, 2);
  assert.ok(firstPage.nextCursor);
  const secondPage = await store.listHeads(firstPage.nextCursor, undefined, 2);
  assert.equal(secondPage.items.length, 1);
  assert.equal(secondPage.nextCursor, undefined);

  const all = [...firstPage.items, ...secondPage.items].map((h) => h.id).sort();
  assert.deepEqual(all, ["deck-a", "deck-b", "deck-c"]);

  await assert.rejects(() => store.listHeads("not-a-cursor"), InvalidDeckCursorError);
  await assert.rejects(
    () => store.listChangeSets("deck-a", firstPage.nextCursor),
    InvalidDeckCursorError
  );
});

// ── Attempts, stages and prompt ownership ────────────────────────────────

const site: PromptSite = {
  kind: "element-body",
  container: { kind: "slide", slideId: "slide-1" },
  elementId: "element-1"
};

const promptAttempt = (deckId: string, id: string): PromptCreationAttempt => ({
  id,
  deckId,
  kind: "prompt-create",
  clientRequestId: `req-${id}`,
  requestDigest: `digest-${id}`,
  frozenDeckRevision: 1,
  state: "requested",
  target: { kind: "existing", site },
  site,
  definition: { prompt: "Summarise", contextEntries: [], stabilisationText: "" },
  createdAt: timestamp(1),
  updatedAt: timestamp(1)
});

test("an attempt round-trips its frozen site and definition", async () => {
  const { store } = newStore();
  await store.commitCreation(creationCommit("deck-attempt"));
  await store.createAttempt(promptAttempt("deck-attempt", "attempt-1"));

  const loaded = (await store.getAttempt("deck-attempt", "attempt-1")) as PromptCreationAttempt;
  assert.equal(loaded.kind, "prompt-create");
  assert.deepEqual(loaded.site, site);
  assert.equal(loaded.definition.prompt, "Summarise");
  assert.equal(
    (await store.getPromptCreationAttemptBySite("deck-attempt", site))?.id,
    "attempt-1"
  );
  assert.deepEqual((await store.listRecoverableAttempts()).map((a) => a.id), ["attempt-1"]);
});

test("one prompt-create attempt per site is enforced by the database", async () => {
  const { store } = newStore();
  await store.commitCreation(creationCommit("deck-one"));
  await store.createAttempt(promptAttempt("deck-one", "attempt-1"));
  await assert.rejects(
    () => store.createAttempt(promptAttempt("deck-one", "attempt-2")),
    /UNIQUE constraint failed/
  );
});

test("the same element ID in two planes is two distinct sites", async () => {
  const { store } = newStore();
  await store.commitCreation(creationCommit("deck-planes"));
  const onMaster: PromptSite = {
    kind: "element-body",
    container: { kind: "master", masterId: "master-1" },
    elementId: "element-1"
  };
  await store.createAttempt(promptAttempt("deck-planes", "attempt-slide"));
  await store.createAttempt({
    ...promptAttempt("deck-planes", "attempt-master"),
    site: onMaster,
    target: { kind: "existing", site: onMaster }
  });
  assert.equal(
    (await store.getPromptCreationAttemptBySite("deck-planes", site))?.id,
    "attempt-slide"
  );
  assert.equal(
    (await store.getPromptCreationAttemptBySite("deck-planes", onMaster))?.id,
    "attempt-master"
  );
});

test("a stage is claimed once, and a second claim sees it running", async () => {
  const { store } = newStore();
  await store.commitCreation(creationCommit("deck-stage"));
  await store.createAttempt(promptAttempt("deck-stage", "attempt-1"));

  const receipt: SlideStageReceipt = {
    attemptId: "attempt-1",
    stage: "compute",
    idempotencyKey: "slides:prompt-create:attempt-1",
    requestDigest: "digest",
    state: "running",
    createdAt: timestamp(1),
    updatedAt: timestamp(1)
  };
  assert.equal(await store.claimStage(receipt), "claimed");
  assert.equal(await store.claimStage(receipt), "running");
  await store.completeStage({ ...receipt, state: "completed", result: { ok: true } });
  assert.equal(await store.claimStage(receipt), "completed");
});

test("an interrupted stage is recovered as failed on restart", async () => {
  const { store, logs } = newStore();
  await store.commitCreation(creationCommit("deck-recover"));
  await store.createAttempt(promptAttempt("deck-recover", "attempt-1"));
  await store.claimStage({
    attemptId: "attempt-1",
    stage: "compute",
    idempotencyKey: "key",
    requestDigest: "digest",
    state: "running",
    createdAt: timestamp(1),
    updatedAt: timestamp(1)
  });

  assert.equal(await store.recoverInterruptedStages(timestamp(9)), 1);
  assert.equal(await store.recoverInterruptedStages(timestamp(9)), 0);
  assert.ok(logs.entries.some((e) => e.message === "slides.store.stages.recovered"));
});

test("prompt-output ownership registers, transitions and lists detached", async () => {
  const { store } = newStore();
  await store.commitCreation(creationCommit("deck-own"));
  await store.registerPendingPromptOutput({
    outputId: "output-1",
    deckId: "deck-own",
    site,
    state: "pending",
    createdAt: timestamp(1),
    updatedAt: timestamp(1)
  });
  assert.equal((await store.getPromptOutputOwnership("output-1"))?.state, "pending");
  assert.deepEqual((await store.getPromptOutputOwnershipBySite("deck-own", site))?.site, site);

  await store.updatePromptOutputOwnership({
    outputId: "output-1",
    deckId: "deck-own",
    site,
    state: "attached",
    attachedRevision: 2,
    at: timestamp(2)
  });
  assert.equal((await store.getPromptOutputOwnership("output-1"))?.attachedRevision, 2);

  await store.updatePromptOutputOwnership({
    outputId: "output-1",
    deckId: "deck-own",
    site,
    state: "detached",
    detachedRevision: 3,
    at: timestamp(3)
  });
  const detached = await store.listDetachedPromptOutputs();
  assert.deepEqual(detached.map((o) => o.outputId), ["output-1"]);
  // Detaching preserves the attached revision: the output was really attached
  // once, and compensation can restore the source that pointed at it.
  assert.equal(detached[0].attachedRevision, 2);
});

test("two outputs may not bind one site", async () => {
  const { store } = newStore();
  await store.commitCreation(creationCommit("deck-bind"));
  const register = (outputId: string) =>
    store.registerPendingPromptOutput({
      outputId,
      deckId: "deck-bind",
      site,
      state: "pending",
      createdAt: timestamp(1),
      updatedAt: timestamp(1)
    });
  await register("output-1");
  await assert.rejects(() => register("output-2"), /UNIQUE constraint failed/);
});

// ── Outbox ───────────────────────────────────────────────────────────────

test("the outbox lists unpublished transactions once and marks them published", async () => {
  const { store } = newStore();
  await store.commitCreation(creationCommit("deck-outbox"));
  const pending = await store.listUnpublishedTransactions();
  assert.deepEqual(pending.map((t) => t.sourceTransactionId), ["txn-deck-outbox-1"]);

  await store.markTransactionPublished("txn-deck-outbox-1", timestamp(4));
  assert.deepEqual(await store.listUnpublishedTransactions(), []);
  assert.equal(
    (await store.getCommittedTransactionByRequest("deck-outbox", "create-deck-outbox"))?.revision,
    1
  );
});

// ── Observability ────────────────────────────────────────────────────────

test("commits are logged with identifiers and counts, never authored content", async () => {
  const { store, logs } = newStore();
  await store.commitCreation(creationCommit("deck-log"));
  const first = snapshot("Secret deck title");
  await store.commitMutation(
    mutationCommit("deck-log", 1, first, renamed(first, "Secret deck title"))
  );

  const committed = logs.entries.find((e) => e.message === "slides.store.mutation.committed");
  assert.equal(committed?.level, "info");
  const data = committed?.data as Record<string, unknown>;
  assert.equal(data.deckId, "deck-log");
  assert.equal(data.revision, 2);
  assert.deepEqual(data.operationTypes, ["deck.rename"]);
  assert.equal(data.operationCount, 1);
  assert.equal(data.touchedIdCount, 0);

  // The rule that matters: a Deck is mostly authored prose, and none of it may
  // reach a log line. Titles, Rich Content and prompt text are user content.
  const serialised = JSON.stringify(logs.entries);
  assert.ok(!serialised.includes("Secret deck title"));
  assert.ok(!serialised.includes("Notes"));
  assert.ok(!serialised.includes(PROJECT));
});

test("every mutating store method emits an event", async () => {
  const { store, logs } = newStore();
  await store.commitCreation(creationCommit("deck-events"));
  const first = snapshot("Deck deck-events");
  await store.commitMutation(mutationCommit("deck-events", 1, first, renamed(first, "Next")));
  await store.createAttempt(promptAttempt("deck-events", "attempt-1"));
  await store.updateAttempt({
    ...promptAttempt("deck-events", "attempt-1"),
    state: "proposed"
  });
  await store.pruneHistory("deck-events", 1, 1, 0);

  const names = new Set(logs.entries.map((e) => e.message));
  for (const expected of [
    "slides.store.runtime.created",
    "slides.store.deck.created",
    "slides.store.mutation.committed",
    "slides.store.attempt.created",
    "slides.store.attempt.updated",
    "slides.store.history.pruned"
  ]) {
    assert.ok(names.has(expected), expected);
  }
  // Event names follow the house grammar: <capability>.<noun-path>.<verb>.
  for (const name of names) assert.match(name, /^slides\.store\.[a-z-]+(\.[a-z-]+)+$/);
});
