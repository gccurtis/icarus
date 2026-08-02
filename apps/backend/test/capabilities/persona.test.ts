import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  BUILTIN_PERSONA_ID,
  BuiltInPersonaImmutableError,
  PersonaConflictError,
  PersonaNotFoundError,
  PersonaValidationError,
  SQLitePersonaStore,
  StalePersonaRevisionError,
  createPersonaCapability,
  digestPersonaDefinition,
  renderPersona,
  type ContextEntry,
  type PersonaCapability,
  type PersonaContextPort,
  type PersonaContextRecordRef,
  type PersonaDefinition
} from "../../src/3-capabilities/persona/index.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EMPTY_DEFINITION: PersonaDefinition = {
  focus: "",
  background: "",
  approach: "",
  outputPreferences: "",
  verification: ""
};

const fullDefinition = (overrides: Partial<PersonaDefinition> = {}): PersonaDefinition => ({
  focus: "Contract terms.",
  background: "We are a mid-market insurer.",
  approach: "Cite the clause before drawing a conclusion.",
  outputPreferences: "Short paragraphs, no bullet lists.",
  verification: "Re-read each quoted clause against the source.",
  ...overrides
});

interface ContextCall {
  readonly op: "declare" | "update" | "delete";
  readonly displayName?: string;
  readonly id?: string;
  readonly entries?: ContextEntry[];
  readonly isPrivate?: boolean;
  readonly expectedRevision?: number;
}

const createFakeContext = (): PersonaContextPort & { readonly calls: ContextCall[] } => {
  const calls: ContextCall[] = [];
  let sequence = 0;
  const revisions = new Map<string, number>();
  return {
    calls,
    declare: async (displayName, entries, options): Promise<PersonaContextRecordRef> => {
      calls.push({
        op: "declare",
        displayName,
        entries: [...entries],
        isPrivate: options?.private ?? false
      });
      const id = `wrapper-${(sequence += 1)}`;
      revisions.set(id, 1);
      return { id, revision: 1 };
    },
    update: async (id, entries, expectedRevision): Promise<PersonaContextRecordRef> => {
      calls.push({ op: "update", id, entries: [...entries], expectedRevision });
      const revision = (revisions.get(id) ?? 1) + 1;
      revisions.set(id, revision);
      return { id, revision };
    },
    delete: async (id): Promise<void> => {
      calls.push({ op: "delete", id });
    }
  };
};

let fixtureSequence = 0;

const createFixture = (): {
  personas: PersonaCapability;
  context: ReturnType<typeof createFakeContext>;
} => {
  const projectId = `persona-test-project-${(fixtureSequence += 1)}`;
  const directory = mkdtempSync(join(tmpdir(), "icarus-persona-"));
  const store = new SQLitePersonaStore(projectId, join(directory, "personas.db"));
  const context = createFakeContext();
  const personas = createPersonaCapability(store, {
    context,
    logger: new CapturingLogger(),
    clock: { now: () => "2026-08-02T00:00:00.000Z" }
  });
  return { personas, context };
};

// ─── Rendering ────────────────────────────────────────────────────────────────

test("render emits sections in fixed order regardless of selection order", () => {
  const definition = fullDefinition();
  const forward = renderPersona(definition, ["focus", "verification"]);
  const reversed = renderPersona(definition, ["verification", "focus"]);

  assert.equal(forward, reversed);
  assert.equal(
    forward,
    "## Focus\nContract terms.\n\n## Verification\nRe-read each quoted clause against the source."
  );
});

test("render omits empty and unselected sections along with their headings", () => {
  const definition = fullDefinition({ background: "   ", verification: "" });
  const rendered = renderPersona(definition, [
    "focus",
    "background",
    "verification",
    "approach"
  ]);

  assert.doesNotMatch(rendered, /## Background/);
  assert.doesNotMatch(rendered, /## Verification/);
  assert.doesNotMatch(rendered, /## Output/); // present but not selected
  assert.match(rendered, /## Focus/);
  assert.match(rendered, /## Approach/);
});

test("render trims bodies, preserves internal blank lines, and adds no trailing newline", () => {
  const rendered = renderPersona({
    ...EMPTY_DEFINITION,
    focus: "  first\n\nsecond  ",
    approach: "  only  "
  });

  assert.equal(rendered, "## Focus\nfirst\n\nsecond\n\n## Approach\nonly");
  assert.doesNotMatch(rendered, /\n$/);
  // Exactly one blank line joins two sections.
  assert.equal(rendered.split("\n\n## ").length, 2);
});

test("a definition carrying only a context reference renders to an empty string", () => {
  const rendered = renderPersona({
    ...EMPTY_DEFINITION,
    context: { id: "ctx-1", kind: "context" }
  });
  assert.equal(rendered, "");
});

// ─── Digests ──────────────────────────────────────────────────────────────────

test("definitionDigest is stable across key reordering", () => {
  const a: PersonaDefinition = {
    focus: "f",
    background: "b",
    approach: "a",
    outputPreferences: "o",
    verification: "v"
  };
  const b: PersonaDefinition = {
    verification: "v",
    outputPreferences: "o",
    approach: "a",
    background: "b",
    focus: "f"
  };
  assert.equal(digestPersonaDefinition(a), digestPersonaDefinition(b));
});

test("definitionDigest changes on a section edit and on a context-reference change", () => {
  const base = fullDefinition();
  assert.notEqual(
    digestPersonaDefinition(base),
    digestPersonaDefinition(fullDefinition({ focus: "Something else." }))
  );
  assert.notEqual(
    digestPersonaDefinition(base),
    digestPersonaDefinition({ ...base, context: { id: "ctx-1", kind: "context" } })
  );
});

test("editing a description bumps the revision but leaves definitionDigest unchanged", async () => {
  const { personas } = createFixture();
  const created = await personas.create({
    displayName: "Analyst",
    description: "first blurb",
    definition: fullDefinition()
  });

  const updated = await personas.update({
    id: created.id,
    expectedRevision: created.revision,
    description: "second blurb"
  });

  assert.equal(updated.revision, created.revision + 1);
  assert.equal(updated.definitionDigest, created.definitionDigest);
});

test("promptDigest varies with section selection while definitionDigest does not", async () => {
  const { personas } = createFixture();
  const created = await personas.create({
    displayName: "Analyst",
    definition: fullDefinition()
  });

  const all = await personas.resolve(created.id);
  const partial = await personas.resolve(created.id, { sections: ["focus"] });

  assert.equal(all.definitionDigest, partial.definitionDigest);
  assert.notEqual(all.promptDigest, partial.promptDigest);
  assert.deepEqual(partial.sections, ["focus"]);
});

// ─── Validation ───────────────────────────────────────────────────────────────

test("an all-empty definition with no context is rejected", async () => {
  const { personas } = createFixture();
  await assert.rejects(
    () => personas.create({ displayName: "Empty", definition: EMPTY_DEFINITION }),
    PersonaValidationError
  );
});

test("an all-empty definition with a context reference is accepted", async () => {
  const { personas } = createFixture();
  const created = await personas.create({
    displayName: "Pure scope",
    definition: { ...EMPTY_DEFINITION, context: { id: "ctx-1", kind: "context" } }
  });

  assert.equal(created.revision, 1);
  const snapshot = await personas.resolve(created.id);
  assert.equal(snapshot.prompt, "");
  assert.deepEqual(snapshot.sections, []);
});

test("over-limit sections and over-limit totals are rejected", async () => {
  const { personas } = createFixture();
  await assert.rejects(
    () =>
      personas.create({
        displayName: "Too long section",
        definition: { ...EMPTY_DEFINITION, focus: "x".repeat(4_001) }
      }),
    PersonaValidationError
  );
  await assert.rejects(
    () =>
      personas.create({
        displayName: "Too long total",
        definition: {
          focus: "x".repeat(3_000),
          background: "x".repeat(3_000),
          approach: "x".repeat(3_000),
          outputPreferences: "x".repeat(3_000),
          verification: "x".repeat(1_000)
        }
      }),
    PersonaValidationError
  );
});

test("a malformed context entry and a blank display name are rejected", async () => {
  const { personas } = createFixture();
  await assert.rejects(
    () =>
      personas.create({
        displayName: "Bad context",
        definition: { ...EMPTY_DEFINITION, context: { id: "ctx-1" } as ContextEntry }
      }),
    PersonaValidationError
  );
  await assert.rejects(
    () => personas.create({ displayName: "   ", definition: fullDefinition() }),
    PersonaValidationError
  );
});

// ─── Persistence ──────────────────────────────────────────────────────────────

test("display-name uniqueness is case-insensitive", async () => {
  const { personas } = createFixture();
  await personas.create({ displayName: "Analyst", definition: fullDefinition() });
  await assert.rejects(
    () => personas.create({ displayName: "analyst", definition: fullDefinition() }),
    PersonaConflictError
  );
});

test("soft delete frees the display name for immediate reuse", async () => {
  const { personas } = createFixture();
  const created = await personas.create({ displayName: "Analyst", definition: fullDefinition() });
  await personas.delete({ id: created.id, expectedRevision: created.revision });

  const recreated = await personas.create({
    displayName: "Analyst",
    definition: fullDefinition()
  });
  assert.notEqual(recreated.id, created.id);
  assert.equal(await personas.get(created.id), undefined);
});

test("revision compare-and-swap rejects a stale update and a stale delete", async () => {
  const { personas } = createFixture();
  const created = await personas.create({ displayName: "Analyst", definition: fullDefinition() });
  await personas.update({
    id: created.id,
    expectedRevision: created.revision,
    description: "moved on"
  });

  await assert.rejects(
    () =>
      personas.update({
        id: created.id,
        expectedRevision: created.revision,
        description: "too late"
      }),
    StalePersonaRevisionError
  );
  await assert.rejects(
    () => personas.delete({ id: created.id, expectedRevision: created.revision }),
    StalePersonaRevisionError
  );
});

test("list returns live records name-sorted and excludes deleted ones", async () => {
  const { personas } = createFixture();
  await personas.create({ displayName: "Zeta", definition: fullDefinition() });
  await personas.create({ displayName: "alpha", definition: fullDefinition() });
  const doomed = await personas.create({ displayName: "Middle", definition: fullDefinition() });
  await personas.delete({ id: doomed.id, expectedRevision: doomed.revision });

  const listed = await personas.list();
  assert.deepEqual(listed.map((record) => record.displayName), ["alpha", "Zeta"]);
});

// ─── Built-in ─────────────────────────────────────────────────────────────────

test("resolve returns the built-in against an empty database", async () => {
  const { personas } = createFixture();
  const snapshot = await personas.resolve();

  assert.equal(snapshot.personaId, BUILTIN_PERSONA_ID);
  assert.equal(snapshot.revision, 0);
  assert.ok(snapshot.prompt.length > 0);
  assert.equal(snapshot.context, undefined);
});

test("resolve on a deleted id throws rather than falling back to the built-in", async () => {
  const { personas } = createFixture();
  const created = await personas.create({ displayName: "Analyst", definition: fullDefinition() });
  await personas.delete({ id: created.id, expectedRevision: created.revision });

  await assert.rejects(() => personas.resolve(created.id), PersonaNotFoundError);
});

test("the built-in cannot be updated or deleted", async () => {
  const { personas } = createFixture();
  await assert.rejects(
    () =>
      personas.update({
        id: BUILTIN_PERSONA_ID,
        expectedRevision: 0,
        description: "hijacked"
      }),
    BuiltInPersonaImmutableError
  );
  await assert.rejects(
    () => personas.delete({ id: BUILTIN_PERSONA_ID, expectedRevision: 0 }),
    BuiltInPersonaImmutableError
  );
});

// ─── Private wrapper lifecycle ────────────────────────────────────────────────

test("creating a persona with a context declares exactly one private wrapper", async () => {
  const { personas, context } = createFixture();
  const entry: ContextEntry = { id: "ctx-source", kind: "context" };
  const created = await personas.create({
    displayName: "Scoped",
    definition: { ...fullDefinition(), context: entry }
  });

  assert.equal(context.calls.length, 1);
  assert.deepEqual(context.calls[0], {
    op: "declare",
    displayName: `persona:${created.id}`,
    entries: [entry],
    isPrivate: true
  });
  assert.equal(created.contextWrapperId, "wrapper-1");
});

test("creating a persona with no context declares nothing", async () => {
  const { personas, context } = createFixture();
  const created = await personas.create({
    displayName: "Unscoped",
    definition: fullDefinition()
  });

  assert.deepEqual(context.calls, []);
  assert.equal(created.contextWrapperId, undefined);
});

test("changing a persona's context updates the same wrapper rather than declaring a new one", async () => {
  const { personas, context } = createFixture();
  const created = await personas.create({
    displayName: "Scoped",
    definition: { ...fullDefinition(), context: { id: "ctx-a", kind: "context" } }
  });

  const updated = await personas.update({
    id: created.id,
    expectedRevision: created.revision,
    definition: { ...fullDefinition(), context: { id: "ctx-b", kind: "context" } }
  });

  assert.deepEqual(context.calls.map((call) => call.op), ["declare", "update"]);
  assert.equal(context.calls[1]?.id, created.contextWrapperId);
  assert.deepEqual(context.calls[1]?.entries, [{ id: "ctx-b", kind: "context" }]);
  assert.equal(updated.contextWrapperId, created.contextWrapperId);
  assert.equal(updated.contextWrapperRevision, 2);
});

test("adding a context to a persona that had none declares rather than updates", async () => {
  const { personas, context } = createFixture();
  const created = await personas.create({
    displayName: "Unscoped",
    definition: fullDefinition()
  });

  const updated = await personas.update({
    id: created.id,
    expectedRevision: created.revision,
    definition: { ...fullDefinition(), context: { id: "ctx-new", kind: "context" } }
  });

  assert.deepEqual(context.calls.map((call) => call.op), ["declare"]);
  assert.equal(context.calls[0]?.displayName, `persona:${created.id}`);
  assert.equal(updated.contextWrapperId, "wrapper-1");
});

test("removing a persona's context deletes the wrapper and clears both fields", async () => {
  const { personas, context } = createFixture();
  const created = await personas.create({
    displayName: "Scoped",
    definition: { ...fullDefinition(), context: { id: "ctx-a", kind: "context" } }
  });

  const updated = await personas.update({
    id: created.id,
    expectedRevision: created.revision,
    definition: fullDefinition()
  });

  assert.deepEqual(context.calls.map((call) => call.op), ["declare", "delete"]);
  assert.equal(context.calls[1]?.id, created.contextWrapperId);
  assert.equal(updated.contextWrapperId, undefined);
  assert.equal(updated.contextWrapperRevision, undefined);

  // And it survives the round trip through SQLite.
  const reloaded = await personas.get(created.id);
  assert.equal(reloaded?.contextWrapperId, undefined);
  assert.equal(reloaded?.definition.context, undefined);
});

test("deleting a persona deletes its wrapper", async () => {
  const { personas, context } = createFixture();
  const created = await personas.create({
    displayName: "Scoped",
    definition: { ...fullDefinition(), context: { id: "ctx-a", kind: "context" } }
  });

  await personas.delete({ id: created.id, expectedRevision: created.revision });

  assert.deepEqual(context.calls.map((call) => call.op), ["declare", "delete"]);
  assert.equal(context.calls[1]?.id, created.contextWrapperId);
});

test("reads and resolve never touch the context port", async () => {
  const { personas, context } = createFixture();
  const created = await personas.create({
    displayName: "Scoped",
    definition: { ...fullDefinition(), context: { id: "ctx-a", kind: "context" } }
  });
  const callsAfterCreate = context.calls.length;

  await personas.get(created.id);
  await personas.getByName("Scoped");
  await personas.list();
  await personas.resolve(created.id);
  personas.render(fullDefinition());

  assert.equal(context.calls.length, callsAfterCreate);
});

test("a record exposes the authored context while its snapshot exposes the wrapper", async () => {
  const { personas } = createFixture();
  const authored: ContextEntry = { id: "ctx-authored", kind: "context" };
  const created = await personas.create({
    displayName: "Scoped",
    definition: { ...fullDefinition(), context: authored }
  });

  const reloaded = await personas.get(created.id);
  assert.deepEqual(reloaded?.definition.context, authored);

  const snapshot = await personas.resolve(created.id);
  assert.equal(snapshot.context?.id, created.contextWrapperId);
  assert.equal(snapshot.context?.kind, "context");
  assert.notEqual(snapshot.context?.id, authored.id);
  // The authored entry is still reachable through the snapshot's definition.
  assert.deepEqual(snapshot.definition.context, authored);
});

test("a persona edited after a snapshot is taken does not change that snapshot", async () => {
  const { personas } = createFixture();
  const created = await personas.create({
    displayName: "Analyst",
    definition: fullDefinition()
  });
  const pinned = await personas.resolve(created.id);

  await personas.update({
    id: created.id,
    expectedRevision: created.revision,
    definition: fullDefinition({ focus: "Completely different focus." })
  });

  const refreshed = await personas.resolve(created.id);
  assert.notEqual(refreshed.promptDigest, pinned.promptDigest);
  assert.match(pinned.prompt, /Contract terms\./);
  assert.doesNotMatch(pinned.prompt, /Completely different focus\./);
});
