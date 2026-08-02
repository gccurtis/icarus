import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { toTemplateActivityTransaction } from "../../src/1-init/create/templates.js";
import { loadBackendConfig } from "../../src/0-utils/config/loadBackendConfig.js";
import {
  SQLiteTemplateStore,
  StaleTemplateRevisionError,
  TemplateAlreadyExistsError,
  TemplateIdempotencyMismatchError,
  TemplateNameConflictError,
  TemplateNotFoundError,
  TemplateUnsupportedKindError,
  TemplateWireError,
  createTemplateCapability,
  decodeTemplateCommand,
  decodeTemplateQuery,
  type TemplateClock,
  type TemplateCommittedTransaction,
  type TemplateContextBindings,
  type TemplateInstantiationInput,
  type TemplateOrigin,
  type TemplateResourceAdapter,
  type TemplateStore
} from "../../src/3-capabilities/templates/index.js";
import { createTemplateTableNames } from "../../src/3-capabilities/templates/persistence/sqliteSchema.js";
import { CapturingLogger } from "../helpers/testDoubles.js";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError,
  getResourceHistory
} from "../../src/0-utils/persistence/resourceHistory.js";

// ─── Fake adapter ─────────────────────────────────────────────────────────────

interface CreateCall {
  method: "createTemplateCopy";
  sourceResourceId: string;
  templateId: string;
  contextBindings: TemplateContextBindings;
  idempotencyKey: string;
  /** Catalog state observed from inside the call, to assert ordering. */
  observedState: string | undefined;
}

interface InstantiateCall {
  method: "instantiateTemplate";
  templateId: string;
  destinationResourceId: string;
  instantiation: TemplateInstantiationInput;
  idempotencyKey: string;
}

interface UpdateCall {
  method: "updateTemplateCopy";
  templateId: string;
  operations: unknown;
  contextBindings?: TemplateContextBindings;
  idempotencyKey: string;
}

interface ReadCall {
  method: "readTemplateCopy";
  templateId: string;
}

interface DeleteCall {
  method: "logicalDeleteTemplateCopy" | "purgeTemplateCopy";
  templateId: string;
  idempotencyKey: string;
}

type AdapterCall = CreateCall | InstantiateCall | UpdateCall | ReadCall | DeleteCall;

class FakeResourceAdapter implements TemplateResourceAdapter {
  readonly calls: AdapterCall[] = [];
  failNext = false;
  /** Whatever readTemplateCopy hands back; opaque to Templates by design. */
  content: unknown = { representationVersion: 2, title: "backing copy" };

  constructor(
    readonly kind: string,
    /** Supplied so createTemplateCopy can observe catalog state mid-call. */
    private readonly store?: TemplateStore
  ) {}

  private guard(): void {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("adapter refused");
    }
  }

  async createTemplateCopy(input: {
    sourceResourceId: string;
    templateId: string;
    contextBindings: TemplateContextBindings;
    idempotencyKey: string;
  }): Promise<void> {
    this.calls.push({
      method: "createTemplateCopy",
      ...input,
      observedState: this.store?.get(input.templateId)?.state
    });
    this.guard();
  }

  async instantiateTemplate(input: {
    templateId: string;
    destinationResourceId: string;
    instantiation: TemplateInstantiationInput;
    idempotencyKey: string;
  }): Promise<void> {
    this.calls.push({ method: "instantiateTemplate", ...input });
    this.guard();
  }

  async updateTemplateCopy(input: {
    templateId: string;
    operations: unknown;
    contextBindings?: TemplateContextBindings;
    idempotencyKey: string;
  }): Promise<void> {
    this.calls.push({ method: "updateTemplateCopy", ...input });
    this.guard();
  }

  async readTemplateCopy(input: { templateId: string }): Promise<unknown> {
    this.calls.push({ method: "readTemplateCopy", ...input });
    this.guard();
    return this.content;
  }

  async logicalDeleteTemplateCopy(input: {
    templateId: string;
    idempotencyKey: string;
  }): Promise<void> {
    this.calls.push({ method: "logicalDeleteTemplateCopy", ...input });
    this.guard();
  }

  async purgeTemplateCopy(input: {
    templateId: string;
    idempotencyKey: string;
  }): Promise<void> {
    this.calls.push({ method: "purgeTemplateCopy", ...input });
    this.guard();
  }

  createCalls(): CreateCall[] {
    return this.calls.filter((call): call is CreateCall => call.method === "createTemplateCopy");
  }

  instantiateCalls(): InstantiateCall[] {
    return this.calls.filter(
      (call): call is InstantiateCall => call.method === "instantiateTemplate"
    );
  }

  updateCalls(): UpdateCall[] {
    return this.calls.filter((call): call is UpdateCall => call.method === "updateTemplateCopy");
  }

  readCalls(): ReadCall[] {
    return this.calls.filter((call): call is ReadCall => call.method === "readTemplateCopy");
  }
}

// ─── Fixture ──────────────────────────────────────────────────────────────────

let fixtureSequence = 0;

const createFixture = (
  options: {
    registerAdapter?: boolean;
    /** Lets a test interpose on the store, e.g. to simulate a mid-command crash. */
    wrapStore?: (store: TemplateStore) => TemplateStore;
  } = {}
) => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-templates-"));
  const projectId = `templates-test-${++fixtureSequence}`;
  const filePath = join(directory, "templates.db");
  const realStore = new SQLiteTemplateStore(projectId, filePath);
  const store = options.wrapStore ? options.wrapStore(realStore) : realStore;
  const adapter = new FakeResourceAdapter("document", store);
  const adapters = new Map<string, TemplateResourceAdapter>();
  if (options.registerAdapter !== false) adapters.set(adapter.kind, adapter);

  const published: TemplateCommittedTransaction[] = [];
  let publisherFails = false;
  let timestamp = "2026-08-02T00:00:00.000Z";
  const clock: TemplateClock = { now: () => timestamp };
  let idSequence = 0;
  const logger = new CapturingLogger();

  const templates = createTemplateCapability(
    store,
    {
      adapters: { get: (kind) => adapters.get(kind) },
      logger,
      activityPublisher: {
        publish: async (transaction) => {
          if (publisherFails) throw new Error("activity unavailable");
          published.push(transaction);
        }
      },
      attribution: { actorId: "user-1" }
    },
    clock,
    () => `generated-${++idSequence}`
  );

  return {
    templates,
    store,
    adapter,
    published,
    logger,
    /** Lets a test drop the adapter after registration succeeded. */
    unregisterAdapter: () => adapters.delete(adapter.kind),
    /** Lets a test read the shared history table directly. */
    history: (templateId: string) => {
      const db = new Database(filePath, { readonly: true });
      try {
        return getResourceHistory(db, createTemplateTableNames(projectId).history, "template", templateId);
      } finally {
        db.close();
      }
    },
    setPublisherFails: (value: boolean) => {
      publisherFails = value;
    },
    setTimestamp: (value: string) => {
      timestamp = value;
    }
  };
};

const registerCommand = (
  requestId: string,
  overrides: Record<string, unknown> = {},
  origin: TemplateOrigin = "user"
) => ({
  requestId,
  origin,
  command: {
    type: "template.register" as const,
    source: { kind: "document", resourceId: "doc-1" },
    // Derived from the requestId, not a counter: names are unique per kind, so
    // two registrations in one fixture need different names — but a replay of
    // the same requestId must reproduce the same command, or the digest differs
    // and an exact retry fails as an idempotency mismatch.
    name: `template-${requestId}`,
    contextBindings: {} as TemplateContextBindings,
    ...overrides
  }
});

// ─── Identity allocation ──────────────────────────────────────────────────────

test("Templates allocates the Template ID rather than accepting one", async (t) => {
  await t.test("register succeeds with no templateId and returns the allocated one", async () => {
    const { templates } = createFixture();
    const result = await templates.command(registerCommand("req-1"));
    assert.equal(result.type, "template.registered");
    assert.equal(result.type === "template.registered" && result.template.id, "generated-1");
    assert.equal(
      result.type === "template.registered" && result.template.resourceId,
      "generated-1"
    );
  });

  await t.test("two registrations receive different identities", async () => {
    const { templates } = createFixture();
    const first = await templates.command(registerCommand("req-1"));
    const second = await templates.command(registerCommand("req-2"));
    assert.notEqual(
      first.type === "template.registered" && first.template.id,
      second.type === "template.registered" && second.template.id
    );
  });

  await t.test("the catalog row is reserved before the adapter is called", async () => {
    const { templates, adapter } = createFixture();
    await templates.command(registerCommand("req-1"));
    // Observed from inside createTemplateCopy: the identity was already durable.
    assert.equal(adapter.createCalls()[0].observedState, "reserving");
  });

  await t.test("a caller-supplied templateId is rejected at the wire boundary", () => {
    assert.throws(
      () =>
        decodeTemplateCommand({
          requestId: "req-1",
          origin: "user",
          command: {
            type: "template.register",
            templateId: "chosen-by-client",
            source: { kind: "document", resourceId: "doc-1" }
          }
        }),
      TemplateWireError
    );
  });
});

// ─── Catalog and adapter dispatch ─────────────────────────────────────────────

test("Templates dispatches to the adapter registry and guards the catalog", async (t) => {
  await t.test("an unsupported kind fails before any row or adapter call", async () => {
    const { templates, store, adapter } = createFixture({ registerAdapter: false });
    await assert.rejects(
      () => templates.command(registerCommand("req-1")),
      TemplateUnsupportedKindError
    );
    assert.equal(adapter.calls.length, 0);
    assert.equal(store.list().length, 0);
  });

  await t.test("a successful registration produces one ready record", async () => {
    const { templates, store, adapter } = createFixture();
    const result = await templates.command(registerCommand("req-1"));
    const id = result.type === "template.registered" ? result.template.id : "";
    assert.equal(store.get(id)?.state, "ready");
    assert.equal(adapter.createCalls().length, 1);
    assert.equal(store.list().length, 1);
  });

  await t.test("an adapter throw leaves no catalog row", async () => {
    const { templates, store, adapter } = createFixture();
    adapter.failNext = true;
    await assert.rejects(() => templates.command(registerCommand("req-1")));
    assert.equal(store.list().length, 0);
  });

  await t.test("a reserving record is invisible and blocks its own identity", async () => {
    const { templates, store } = createFixture();
    const createdAt = "2026-08-02T00:00:00.000Z";
    const reservation = {
      id: "generated-1",
      kind: "document",
      resourceId: "generated-1",
      name: "reserved template",
      contextBindings: {},
      state: "reserving" as const,
      revision: 1,
      updatedAt: createdAt,
      createdAt
    };
    assert.equal(store.reserve(reservation), true);
    // Invisible to list, and a second reservation of the same identity fails.
    assert.equal(store.list().length, 0);
    assert.equal(store.reserve(reservation), false);
    // A reserving row also holds its name, so a colliding registration fails
    // before its adapter call rather than after a backing copy exists.
    assert.equal(store.nameTaken("document", "Reserved Template"), true);
    await assert.rejects(
      () =>
        templates.command({
          requestId: "req-x",
          origin: "user",
          command: { type: "template.instantiate", templateId: "generated-1", destinationResourceId: "doc-9", contextBindings: {} }
        }),
      TemplateNotFoundError
    );
  });
});

// ─── Idempotency ──────────────────────────────────────────────────────────────

test("Templates replays exact retries and refuses divergent reuse", async (t) => {
  await t.test("an exact register retry returns the same allocated ID once", async () => {
    const { templates, adapter } = createFixture();
    const first = await templates.command(registerCommand("req-1"));
    const second = await templates.command(registerCommand("req-1"));
    assert.deepEqual(first, second);
    assert.equal(adapter.createCalls().length, 1);
  });

  await t.test("origin does not affect replay and the committed transaction keeps its first origin", async () => {
    const { templates, store, adapter } = createFixture();
    const first = await templates.command(registerCommand("req-1", {}, "automation"));
    const replay = await templates.command(registerCommand("req-1", {}, "system"));

    assert.deepEqual(replay, first);
    assert.equal(adapter.createCalls().length, 1);
    assert.equal(store.listUnpublishedTransactions()[0].origin, "automation");
  });

  await t.test("key ordering in the command does not change the digest", async () => {
    const { templates, adapter } = createFixture();
    await templates.command({
      requestId: "req-1",
      origin: "user",
      command: {
        type: "template.register",
        source: { kind: "document", resourceId: "doc-1" },
        name: "ordering-probe",
        description: "a template",
        contextBindings: {}
      }
    });
    // Same content, different property order.
    await templates.command({
      requestId: "req-1",
      origin: "agent",
      command: {
        contextBindings: {},
        description: "a template",
        name: "ordering-probe",
        source: { resourceId: "doc-1", kind: "document" },
        type: "template.register"
      } as never
    });
    assert.equal(adapter.createCalls().length, 1);
  });

  await t.test("reusing a request ID with different content is a mismatch", async () => {
    const { templates } = createFixture();
    await templates.command(registerCommand("req-1"));
    await assert.rejects(
      () =>
        templates.command(
          registerCommand("req-1", { source: { kind: "document", resourceId: "doc-2" } })
        ),
      TemplateIdempotencyMismatchError
    );
  });

  await t.test("reusing a request ID for a different command type is a mismatch", async () => {
    const { templates } = createFixture();
    await templates.command(registerCommand("req-1"));
    await assert.rejects(
      () =>
        templates.command({
          requestId: "req-1",
          origin: "user",
          command: { type: "template.delete", templateId: "generated-1" }
        }),
      TemplateIdempotencyMismatchError
    );
  });

  await t.test("a pending claim resumes on the frozen ID without a second copy", async () => {
    const { templates, store, adapter } = createFixture();
    adapter.failNext = true;
    // First attempt reserves + freezes the identity, then the adapter fails.
    await assert.rejects(() => templates.command(registerCommand("req-1")));
    assert.equal(store.list().length, 0);

    // The claim is still pending with its frozen template_id, so the retry
    // reuses that identity and the same adapter key instead of minting a new one.
    const result = await templates.command(registerCommand("req-1"));
    assert.equal(result.type === "template.registered" && result.template.id, "generated-1");
    assert.equal(store.list().length, 1);
    const keys = adapter.createCalls().map((call) => call.idempotencyKey);
    assert.deepEqual(keys, ["templates:register:req-1", "templates:register:req-1"]);
  });
});

// ─── Instantiation and deletion ───────────────────────────────────────────────

test("Templates instantiates without a catalog row and deletes through the adapter", async (t) => {
  await t.test("instantiate returns the destination ref and writes no row", async () => {
    const { templates, store, adapter } = createFixture();
    const registered = await templates.command(registerCommand("req-1"));
    const templateId = registered.type === "template.registered" ? registered.template.id : "";

    const result = await templates.command({
      requestId: "req-2",
      origin: "user",
      command: {
        type: "template.instantiate",
        templateId,
        destinationResourceId: "doc-copy-1",
        contextBindings: {}
      }
    });

    assert.equal(result.type, "template.instantiated");
    assert.deepEqual(
      result.type === "template.instantiated" ? result.resource : undefined,
      { kind: "document", resourceId: "doc-copy-1" }
    );
    assert.equal(store.list().length, 1, "no catalog row is written for an instance");
    assert.equal(adapter.instantiateCalls().length, 1);
  });

  await t.test("instantiating a missing or deleted template is not found", async () => {
    const { templates } = createFixture();
    await assert.rejects(
      () =>
        templates.command({
          requestId: "req-2",
          origin: "user",
          command: {
            type: "template.instantiate",
            templateId: "nope",
            destinationResourceId: "doc-copy-1",
            contextBindings: {}
          }
        }),
      TemplateNotFoundError
    );
  });

  await t.test("delete archives current state and purge removes retained state through the adapter", async () => {
    const { templates, store, adapter } = createFixture();
    const registered = await templates.command(registerCommand("req-1"));
    const templateId = registered.type === "template.registered" ? registered.template.id : "";

    await assert.rejects(
      () => templates.command({
        requestId: "req-live-purge",
        origin: "user",
        command: { type: "template.purge", templateId }
      }),
      ResourceNotDeletedError
    );

    const deleted = await templates.command({
      requestId: "req-2",
      origin: "user",
      command: { type: "template.delete", templateId }
    });

    assert.deepEqual(deleted, { type: "template.deleted", templateId, revision: 2 });
    assert.equal(store.get(templateId), undefined);
    assert.equal(store.list().length, 0);
    assert.equal(store.latestSnapshot(templateId)?.revision, 1);
    assert.equal(adapter.calls.filter((c) => c.method === "logicalDeleteTemplateCopy").length, 1);
    await assert.rejects(
      () => templates.query({ query: { type: "template.get", templateId } }),
      TemplateNotFoundError
    );

    assert.deepEqual(await templates.command({
      requestId: "req-3",
      origin: "user",
      command: { type: "template.purge", templateId }
    }), { type: "template.purged", templateId });
    assert.equal(adapter.calls.filter((c) => c.method === "purgeTemplateCopy").length, 1);
    assert.equal(store.latestSnapshot(templateId), undefined);
    await assert.rejects(
      () => templates.command({
        requestId: "req-4",
        origin: "user",
        command: { type: "template.purge", templateId }
      }),
      ResourceHistoryNotFoundError
    );
  });
});

// ─── Bindings and descriptions ────────────────────────────────────────────────

// TO BE DELETED — this test's name and its "bindings are never persisted"
// subtest assert a decision that has been reversed. Templates persists the
// declared bindings: they are the template's parameter list and part of what
// identifies it, not a pass-through to the adapter. The subtest below inverts
// (assert the declaration round-trips through get/list) and this name becomes
// "Templates records the declared bindings and forwards the applied targets".
// Left green for now so nothing breaks before item 7 lands.
// See scratch/0-general-updates.md item 7.
test("Templates records the declared bindings and applies the targets", async (t) => {
  await t.test("omitted bindings reach the adapter as an empty record", async () => {
    const { templates, adapter } = createFixture();
    await templates.command({
      requestId: "req-1",
      origin: "user",
      command: {
        type: "template.register",
        source: { kind: "document", resourceId: "doc-1" },
        name: "template-req-1",
        contextBindings: decodeContextBindingsFromWire(undefined)
      }
    });
    assert.deepEqual(adapter.createCalls()[0].contextBindings, {});
  });

  await t.test("an absent key and an explicit-unbind key stay distinguishable", async () => {
    const { templates, adapter } = createFixture();
    await templates.command(
      registerCommand("req-1", {
        contextBindings: { "Main topic": {}, Region: { target: { id: "ctx-1", kind: "context" } } }
      })
    );
    const forwarded = adapter.createCalls()[0].contextBindings;
    // "Main topic" is present-but-empty: explicitly unbound, not absent.
    assert.ok(Object.prototype.hasOwnProperty.call(forwarded, "Main topic"));
    assert.equal(forwarded["Main topic"].target, undefined);
    assert.deepEqual(forwarded.Region.target, { id: "ctx-1", kind: "context" });
    assert.equal(Object.prototype.hasOwnProperty.call(forwarded, "Absent"), false);
  });

  await t.test("a binding description is declared, stored, and returned", async () => {
    const { templates } = createFixture();
    const registered = await templates.command(
      registerCommand("req-1", {
        contextBindings: { "Main topic": { description: "the subject area" } }
      })
    );
    assert.equal(
      registered.type === "template.registered"
        ? registered.template.contextBindings["Main topic"].description
        : undefined,
      "the subject area"
    );
  });

  await t.test("instantiation forwards binding arguments and an omitted title", async () => {
    const { templates, adapter } = createFixture();
    const registered = await templates.command(registerCommand("req-1"));
    const templateId = registered.type === "template.registered" ? registered.template.id : "";
    await templates.command({
      requestId: "req-2",
      origin: "user",
      command: {
        type: "template.instantiate",
        templateId,
        destinationResourceId: "doc-copy-1",
        contextBindings: { Region: { target: { id: "ctx-2", kind: "context" } } }
      }
    });
    const call = adapter.instantiateCalls()[0];
    assert.equal(call.instantiation.title, undefined);
    assert.deepEqual(call.instantiation.contextBindings.Region.target, {
      id: "ctx-2",
      kind: "context"
    });
  });

  // The case that would have caught the original defect: bindings were accepted
  // at the door and dropped on the floor.
  await t.test("declared bindings round-trip through get and list", async () => {
    const { templates } = createFixture();
    const bindings = {
      Region: { target: { id: "ctx-1", kind: "context" }, description: "which market" },
      // Declared with no default: a parameter the instantiator must supply.
      "Main topic": {}
    };
    const registered = await templates.command(
      registerCommand("req-1", { contextBindings: bindings })
    );
    const templateId = registered.type === "template.registered" ? registered.template.id : "";

    const found = await templates.query({ query: { type: "template.get", templateId } });
    assert.deepEqual(
      found.type === "template.record" ? found.template.contextBindings : undefined,
      bindings
    );
    const listed = await templates.query({ query: { type: "template.list" } });
    assert.deepEqual(
      listed.type === "template.records" ? listed.templates[0].contextBindings : undefined,
      bindings
    );
  });

  await t.test("registering with no bindings stores an empty record, never null", async () => {
    const { templates, store } = createFixture();
    const registered = await templates.command(registerCommand("req-1"));
    const templateId = registered.type === "template.registered" ? registered.template.id : "";
    assert.deepEqual(store.get(templateId)?.contextBindings, {});
  });

  await t.test("a binding description at instantiation is rejected, not ignored", () => {
    assert.throws(
      () =>
        decodeTemplateCommand({
          requestId: "req-1",
          origin: "user",
          command: {
            type: "template.instantiate",
            templateId: "t-1",
            destinationResourceId: "doc-9",
            contextBindings: { Region: { description: "not a declaration here" } }
          }
        }),
      TemplateWireError
    );
  });

  await t.test("an optional catalog description round-trips through get and list", async () => {
    const { templates } = createFixture();
    const registered = await templates.command(
      registerCommand("req-1", { description: "quarterly report starter" })
    );
    const templateId = registered.type === "template.registered" ? registered.template.id : "";
    const found = await templates.query({ query: { type: "template.get", templateId } });
    assert.equal(
      found.type === "template.record" ? found.template.description : undefined,
      "quarterly report starter"
    );
    const listed = await templates.query({ query: { type: "template.list" } });
    assert.equal(
      listed.type === "template.records" ? listed.templates[0].description : undefined,
      "quarterly report starter"
    );
  });
});

// ─── Name ─────────────────────────────────────────────────────────────────────

test("Templates gives every record its own catalog name", async (t) => {
  await t.test("the name round-trips through get and list", async () => {
    const { templates } = createFixture();
    const registered = await templates.command(
      registerCommand("req-1", { name: "Quarterly report" })
    );
    const templateId = registered.type === "template.registered" ? registered.template.id : "";
    const found = await templates.query({ query: { type: "template.get", templateId } });
    assert.equal(found.type === "template.record" ? found.template.name : "", "Quarterly report");
    const listed = await templates.query({ query: { type: "template.list" } });
    assert.equal(
      listed.type === "template.records" ? listed.templates[0].name : "",
      "Quarterly report"
    );
  });

  await t.test("registering without a name is rejected at the wire boundary", () => {
    // Required rather than defaulted: adapters return void for every mutating
    // call, so Templates has no way to read the source's title to fall back on.
    assert.throws(
      () =>
        decodeTemplateCommand({
          requestId: "req-1",
          origin: "user",
          command: {
            type: "template.register",
            source: { kind: "document", resourceId: "doc-1" },
            contextBindings: {}
          }
        }),
      TemplateWireError
    );
    for (const name of ["", "   "]) {
      assert.throws(
        () => decodeTemplateCommand(registerCommand("req-1", { name })),
        TemplateWireError
      );
    }
  });

  await t.test("a name is trimmed at ingress, so near-duplicates collide", async () => {
    const { templates } = createFixture();
    // Through the decoder, because trimming is a wire concern: every real
    // request arrives this way, and the digest is taken over the decoded value.
    await templates.command(
      decodeTemplateCommand(registerCommand("req-1", { name: "  Quarterly report  " }))
    );
    const found = await templates.query({ query: { type: "template.list" } });
    assert.equal(
      found.type === "template.records" ? found.templates[0].name : "",
      "Quarterly report"
    );

    await assert.rejects(
      () => templates.command(decodeTemplateCommand(registerCommand("req-2", { name: "Quarterly report" }))),
      TemplateNameConflictError
    );
  });

  await t.test("a duplicate name conflicts and creates no backing copy", async () => {
    const { templates, adapter } = createFixture();
    await templates.command(registerCommand("req-1", { name: "Quarterly report" }));
    await assert.rejects(
      // Case-insensitive: the index collates NOCASE.
      () => templates.command(registerCommand("req-2", { name: "quarterly REPORT" })),
      TemplateNameConflictError
    );
    // The ordering guarantee: the conflict is detected before any side effect.
    assert.equal(adapter.createCalls().length, 1);
  });

  await t.test("the same name under a different kind is accepted", async () => {
    const { store } = createFixture();
    const at = "2026-08-02T00:00:00.000Z";
    const reservation = (id: string, kind: string) => ({
      id,
      kind,
      resourceId: id,
      name: "Quarterly report",
      contextBindings: {},
      state: "reserving" as const,
      revision: 1,
      createdAt: at,
      updatedAt: at
    });
    assert.equal(store.reserve(reservation("t-doc", "document")), true);
    assert.equal(store.reserve(reservation("t-sheet", "spreadsheet")), true);
    assert.equal(store.nameTaken("spreadsheet", "Quarterly report"), true);
    assert.equal(store.nameTaken("slides", "Quarterly report"), false);
  });

  await t.test("deleting a template frees its name immediately", async () => {
    const { templates } = createFixture();
    const first = await templates.command(registerCommand("req-1", { name: "Quarterly report" }));
    const templateId = first.type === "template.registered" ? first.template.id : "";
    await templates.command({
      requestId: "req-2",
      origin: "user",
      command: { type: "template.delete", templateId }
    });
    // No partial index is needed for this: deletion removes the live row, so
    // the name is released by construction rather than by a predicate.
    const reused = await templates.command(registerCommand("req-3", { name: "Quarterly report" }));
    assert.equal(reused.type, "template.registered");
  });
});

// ─── Update ───────────────────────────────────────────────────────────────────

const registerFor = async (
  templates: ReturnType<typeof createFixture>["templates"],
  requestId: string,
  overrides: Record<string, unknown> = {}
): Promise<string> => {
  const result = await templates.command(registerCommand(requestId, overrides));
  return result.type === "template.registered" ? result.template.id : "";
};

test("Templates updates a template through one gated command", async (t) => {
  await t.test("name, description, and bindings replace wholesale and bump the revision", async () => {
    const { templates } = createFixture();
    const templateId = await registerFor(templates, "req-1", {
      name: "Draft",
      description: "first pass",
      contextBindings: { Region: { target: { id: "ctx-1", kind: "context" } } }
    });

    const updated = await templates.command({
      requestId: "req-2",
      origin: "user",
      command: {
        type: "template.update",
        templateId,
        expectedRevision: 1,
        name: "Quarterly report",
        description: "ready to use",
        contextBindings: { Topic: { description: "what to write about" } }
      }
    });

    assert.equal(updated.type, "template.updated");
    const template = updated.type === "template.updated" ? updated.template : undefined;
    assert.equal(template?.name, "Quarterly report");
    assert.equal(template?.description, "ready to use");
    assert.equal(template?.revision, 2);
    // Wholesale, not merged: Region is gone rather than retained alongside Topic.
    assert.deepEqual(template?.contextBindings, { Topic: { description: "what to write about" } });
  });

  await t.test("an omitted field leaves its current value alone", async () => {
    const { templates } = createFixture();
    const templateId = await registerFor(templates, "req-1", {
      name: "Draft",
      description: "first pass"
    });
    const updated = await templates.command({
      requestId: "req-2",
      origin: "user",
      command: { type: "template.update", templateId, expectedRevision: 1, description: "revised" }
    });
    const template = updated.type === "template.updated" ? updated.template : undefined;
    assert.equal(template?.name, "Draft");
    assert.equal(template?.description, "revised");
  });

  await t.test("an accepted update archives the record it replaced", async () => {
    const { templates, history } = createFixture();
    const templateId = await registerFor(templates, "req-1", { name: "Draft" });
    await templates.command({
      requestId: "req-2",
      origin: "user",
      command: { type: "template.update", templateId, expectedRevision: 1, name: "Final" }
    });

    // Every other revision transition leaves history behind; an update that
    // skipped it would make latestSnapshot report pre-update state as current.
    const records = history(templateId);
    assert.deepEqual(
      records.map((entry) => ({ revision: entry.revision, recordType: entry.recordType })),
      [{ revision: 1, recordType: "snapshot" }]
    );
    assert.equal(
      (records[0].snapshot as { name: string } | undefined)?.name,
      "Draft"
    );
  });

  await t.test("a stale expectedRevision conflicts and writes nothing", async () => {
    const { templates, adapter, store } = createFixture();
    const templateId = await registerFor(templates, "req-1", { name: "Draft" });
    await templates.command({
      requestId: "req-2",
      origin: "user",
      command: { type: "template.update", templateId, expectedRevision: 1, name: "Second" }
    });

    await assert.rejects(
      () =>
        templates.command({
          requestId: "req-3",
          origin: "user",
          command: { type: "template.update", templateId, expectedRevision: 1, name: "Third" }
        }),
      StaleTemplateRevisionError
    );
    assert.equal(store.get(templateId)?.name, "Second");
    assert.equal(store.get(templateId)?.revision, 2);
    // The conflict is raised before the adapter runs, so no content was edited.
    assert.equal(adapter.updateCalls().length, 0);
  });

  await t.test("resourceOperations reach the adapter with the template's own ID", async () => {
    const { templates, adapter } = createFixture();
    const templateId = await registerFor(templates, "req-1");
    await templates.command({
      requestId: "req-2",
      origin: "user",
      command: {
        type: "template.update",
        templateId,
        expectedRevision: 1,
        resourceOperations: [{ type: "block.insert", blockId: "b-1" }]
      }
    });
    const call = adapter.updateCalls()[0];
    assert.equal(call.templateId, templateId);
    assert.deepEqual(call.operations, [{ type: "block.insert", blockId: "b-1" }]);
    assert.equal(call.idempotencyKey, "templates:update:req-2");
  });

  await t.test("a purely-catalog update does not disturb the backing resource", async () => {
    const { templates, adapter } = createFixture();
    const templateId = await registerFor(templates, "req-1");
    await templates.command({
      requestId: "req-2",
      origin: "user",
      command: { type: "template.update", templateId, expectedRevision: 1, description: "blurb" }
    });
    assert.equal(adapter.updateCalls().length, 0);
  });

  await t.test("an adapter failure leaves the catalog untouched and retryable", async () => {
    const { templates, store, adapter } = createFixture();
    const templateId = await registerFor(templates, "req-1", { name: "Draft" });
    adapter.failNext = true;

    const update = {
      requestId: "req-2",
      origin: "user" as const,
      command: {
        type: "template.update" as const,
        templateId,
        expectedRevision: 1,
        name: "Final",
        resourceOperations: [{ type: "block.insert" }]
      }
    };
    await assert.rejects(() => templates.command(update));
    assert.equal(store.get(templateId)?.name, "Draft");
    assert.equal(store.get(templateId)?.revision, 1);

    // Same ordering as register: the external effect precedes the local commit,
    // so a failed attempt leaves a pending claim the retry resumes.
    const retried = await templates.command(update);
    assert.equal(retried.type === "template.updated" && retried.template.name, "Final");
  });

  await t.test("an exact replay returns the original result without re-calling the adapter", async () => {
    const { templates, adapter } = createFixture();
    const templateId = await registerFor(templates, "req-1");
    const update = {
      requestId: "req-2",
      origin: "user" as const,
      command: {
        type: "template.update" as const,
        templateId,
        expectedRevision: 1,
        name: "Final",
        resourceOperations: [{ type: "block.insert" }]
      }
    };
    const first = await templates.command(update);
    const replay = await templates.command(update);
    assert.deepEqual(replay, first);
    assert.equal(adapter.updateCalls().length, 1);
  });

  await t.test("renaming onto a taken name conflicts and writes nothing", async () => {
    const { templates, store } = createFixture();
    await registerFor(templates, "req-1", { name: "Taken" });
    const templateId = await registerFor(templates, "req-2", { name: "Draft" });

    await assert.rejects(
      () =>
        templates.command({
          requestId: "req-3",
          origin: "user",
          command: { type: "template.update", templateId, expectedRevision: 1, name: "taken" }
        }),
      TemplateNameConflictError
    );
    assert.equal(store.get(templateId)?.name, "Draft");
    assert.equal(store.get(templateId)?.revision, 1);
  });

  await t.test("keeping the same name is not a self-conflict", async () => {
    const { templates } = createFixture();
    const templateId = await registerFor(templates, "req-1", { name: "Draft" });
    const updated = await templates.command({
      requestId: "req-2",
      origin: "user",
      command: { type: "template.update", templateId, expectedRevision: 1, name: "Draft" }
    });
    assert.equal(updated.type, "template.updated");
  });

  await t.test("updating an unknown or deleted template is not found", async () => {
    const { templates } = createFixture();
    const templateId = await registerFor(templates, "req-1");
    await assert.rejects(
      () =>
        templates.command({
          requestId: "req-2",
          origin: "user",
          command: { type: "template.update", templateId: "nope", expectedRevision: 1 }
        }),
      TemplateNotFoundError
    );

    await templates.command({
      requestId: "req-3",
      origin: "user",
      command: { type: "template.delete", templateId }
    });
    await assert.rejects(
      () =>
        templates.command({
          requestId: "req-4",
          origin: "user",
          command: { type: "template.update", templateId, expectedRevision: 2 }
        }),
      TemplateNotFoundError
    );
  });

  await t.test("an accepted update writes exactly one source transaction", async () => {
    const { templates, store } = createFixture();
    const templateId = await registerFor(templates, "req-1");
    await templates.command({
      requestId: "req-2",
      origin: "automation",
      command: { type: "template.update", templateId, expectedRevision: 1, name: "Final" }
    });
    const kinds = store
      .listUnpublishedTransactions()
      .map((transaction) => ({ kind: transaction.kind, origin: transaction.origin }))
      .sort((left, right) => left.kind.localeCompare(right.kind));
    assert.deepEqual(kinds, [
      { kind: "template.registered", origin: "user" },
      { kind: "template.updated", origin: "automation" }
    ]);
  });

  await t.test("expectedRevision must be a non-negative integer", () => {
    for (const expectedRevision of [undefined, "1", -1, 1.5]) {
      assert.throws(
        () =>
          decodeTemplateCommand({
            requestId: "req-1",
            origin: "user",
            command: {
              type: "template.update",
              templateId: "t-1",
              ...(expectedRevision !== undefined ? { expectedRevision } : {})
            }
          }),
        TemplateWireError
      );
    }
  });
});

// ─── Reading a template ───────────────────────────────────────────────────────

test("Templates serves the backing content its owning capability seals away", async (t) => {
  await t.test("template.load returns the record and the adapter's content verbatim", async () => {
    const { templates, adapter } = createFixture();
    adapter.content = { representationVersion: 2, rows: ["opaque to Templates"] };
    const templateId = await registerFor(templates, "req-1", { name: "Draft" });

    const loaded = await templates.query({ query: { type: "template.load", templateId } });
    assert.equal(loaded.type, "template.content");
    assert.equal(loaded.type === "template.content" ? loaded.template.name : "", "Draft");
    assert.deepEqual(
      loaded.type === "template.content" ? loaded.content : undefined,
      { representationVersion: 2, rows: ["opaque to Templates"] }
    );
    assert.deepEqual(adapter.readCalls(), [{ method: "readTemplateCopy", templateId }]);
  });

  await t.test("template.get never calls the adapter, so listing stays cheap", async () => {
    const { templates, adapter } = createFixture();
    const templateId = await registerFor(templates, "req-1");
    await templates.query({ query: { type: "template.get", templateId } });
    await templates.query({ query: { type: "template.list" } });
    assert.equal(adapter.readCalls().length, 0);
  });

  await t.test("loading an unknown or deleted template is not found", async () => {
    const { templates } = createFixture();
    const templateId = await registerFor(templates, "req-1");
    await assert.rejects(
      () => templates.query({ query: { type: "template.load", templateId: "nope" } }),
      TemplateNotFoundError
    );
    await templates.command({
      requestId: "req-2",
      origin: "user",
      command: { type: "template.delete", templateId }
    });
    await assert.rejects(
      () => templates.query({ query: { type: "template.load", templateId } }),
      TemplateNotFoundError
    );
  });

  await t.test("loading a kind with no adapter is unsupported, not empty content", async () => {
    const { templates, unregisterAdapter } = createFixture();
    const templateId = await registerFor(templates, "req-1");
    // The catalog row stays; only the way to its content goes away.
    unregisterAdapter();
    await assert.rejects(
      () => templates.query({ query: { type: "template.load", templateId } }),
      TemplateUnsupportedKindError
    );
  });
});

// ─── History across a template's life ─────────────────────────────────────────

test("Templates leaves a contiguous revision chain behind", async (t) => {
  await t.test("register, update twice, delete produces one record per revision", async () => {
    const { templates, history } = createFixture();
    const templateId = await registerFor(templates, "req-1", { name: "One" });
    for (const [index, name] of [["req-2", "Two"], ["req-3", "Three"]] as const) {
      await templates.command({
        requestId: index,
        origin: "user",
        command: {
          type: "template.update",
          templateId,
          expectedRevision: name === "Two" ? 1 : 2,
          name
        }
      });
    }
    await templates.command({
      requestId: "req-4",
      origin: "user",
      command: { type: "template.delete", templateId }
    });

    assert.deepEqual(
      history(templateId).map((entry) => ({
        revision: entry.revision,
        recordType: entry.recordType,
        name: (entry.snapshot as { name?: string } | undefined)?.name
      })),
      [
        { revision: 1, recordType: "snapshot", name: "One" },
        { revision: 2, recordType: "snapshot", name: "Two" },
        { revision: 3, recordType: "snapshot", name: "Three" },
        { revision: 4, recordType: "deleted", name: undefined }
      ]
    );
  });

  await t.test("an archived snapshot carries the bindings, so it is a complete record", async () => {
    const { templates, store } = createFixture();
    const bindings = { Region: { target: { id: "ctx-1", kind: "context" } } };
    const templateId = await registerFor(templates, "req-1", { contextBindings: bindings });
    await templates.command({
      requestId: "req-2",
      origin: "user",
      command: { type: "template.delete", templateId }
    });
    assert.deepEqual(store.latestSnapshot(templateId)?.contextBindings, bindings);
  });

  await t.test("purge removes every history row, updates included", async () => {
    const { templates, history } = createFixture();
    const templateId = await registerFor(templates, "req-1");
    await templates.command({
      requestId: "req-2",
      origin: "user",
      command: { type: "template.update", templateId, expectedRevision: 1, name: "Final" }
    });
    await templates.command({
      requestId: "req-3",
      origin: "user",
      command: { type: "template.delete", templateId }
    });
    await templates.command({
      requestId: "req-4",
      origin: "user",
      command: { type: "template.purge", templateId }
    });
    assert.deepEqual(history(templateId), []);
  });
});

test("Templates logs every query and a failed command", async (t) => {
  await t.test("template.get and template.list each log a query.completed event", async () => {
    const { templates, logger } = createFixture();
    const registered = await templates.command(registerCommand("req-1"));
    const templateId = registered.type === "template.registered" ? registered.template.id : "";

    await templates.query({ query: { type: "template.get", templateId } });
    await templates.query({ query: { type: "template.list" } });

    const queryLogs = logger.entries.filter(
      (entry) => entry.message === "templates.query.completed"
    );
    assert.deepEqual(
      queryLogs.map((entry) => (entry.data as { type: string }).type),
      ["template.get", "template.list"]
    );
  });

  await t.test("a failing adapter call logs templates.command.failed and rethrows", async () => {
    const { templates, adapter, logger } = createFixture();
    adapter.failNext = true;

    await assert.rejects(() => templates.command(registerCommand("req-1")));

    const failureLogs = logger.entries.filter(
      (entry) => entry.message === "templates.command.failed"
    );
    assert.equal(failureLogs.length, 1);
    assert.equal((failureLogs[0].data as { type: string }).type, "template.register");
  });
});

// A tiny helper mirroring what the wire layer does, so the normalisation
// assertion above exercises the real decoder rather than a hand-built value.
function decodeContextBindingsFromWire(value: unknown): TemplateContextBindings {
  const decoded = decodeTemplateCommand({
    requestId: "probe",
    origin: "user",
    command: {
      type: "template.register",
      source: { kind: "document", resourceId: "doc-1" },
      name: "probe-template",
      ...(value !== undefined ? { contextBindings: value } : {})
    }
  });
  return decoded.command.type === "template.register" ? decoded.command.contextBindings : {};
}

// ─── Wire ─────────────────────────────────────────────────────────────────────

test("Templates decodes commands and queries strictly", async (t) => {
  await t.test("origin is required and limited to the Activity vocabulary", () => {
    for (const origin of ["user", "agent", "automation", "system"] as const) {
      const decoded = decodeTemplateCommand({
        requestId: `req-${origin}`,
        origin,
        command: { type: "template.delete", templateId: "t-1" }
      });
      assert.equal(decoded.origin, origin);
    }

    assert.throws(
      () =>
        decodeTemplateCommand({
          requestId: "missing-origin",
          command: { type: "template.delete", templateId: "t-1" }
        }),
      TemplateWireError
    );
    for (const origin of ["interactive", "service"]) {
      assert.throws(
        () =>
          decodeTemplateCommand({
            requestId: `invalid-${origin}`,
            origin,
            command: { type: "template.delete", templateId: "t-1" }
          }),
        TemplateWireError
      );
    }
  });

  await t.test("unknown keys are rejected on commands and queries", () => {
    assert.throws(
      () =>
        decodeTemplateCommand({
          requestId: "req-1",
          origin: "user",
          command: {
            type: "template.delete",
            templateId: "t-1",
            extra: true
          }
        }),
      TemplateWireError
    );
    assert.throws(
      () => decodeTemplateQuery({ query: { type: "template.list", extra: 1 } }),
      TemplateWireError
    );
  });

  await t.test("an omitted contextBindings normalises to an empty record", () => {
    const decoded = decodeTemplateCommand({
      requestId: "req-1",
      origin: "user",
      command: {
        type: "template.register",
        source: { kind: "document", resourceId: "doc-1" },
        name: "a template"
      }
    });
    assert.deepEqual(
      decoded.command.type === "template.register" ? decoded.command.contextBindings : undefined,
      {}
    );
  });

  await t.test("an empty binding object is valid and means explicit unbind", () => {
    const decoded = decodeTemplateCommand({
      requestId: "req-1",
      origin: "user",
      command: {
        type: "template.register",
        source: { kind: "document", resourceId: "doc-1" },
        name: "a template",
        contextBindings: { Topic: {} }
      }
    });
    const bindings =
      decoded.command.type === "template.register" ? decoded.command.contextBindings : {};
    assert.ok(Object.prototype.hasOwnProperty.call(bindings, "Topic"));
    assert.equal(bindings.Topic.target, undefined);
  });

  await t.test("malformed binding entries and names are rejected", () => {
    const register = (contextBindings: unknown) => () =>
      decodeTemplateCommand({
        requestId: "req-1",
        origin: "user",
        command: {
          type: "template.register",
          source: { kind: "document", resourceId: "doc-1" },
          name: "a template",
          contextBindings
        }
      });

    assert.throws(register({ Topic: { target: { id: "ctx-1" } } }), TemplateWireError);
    assert.throws(register({ Topic: { target: { id: "", kind: "context" } } }), TemplateWireError);
    assert.throws(register({ Topic: { unknown: 1 } }), TemplateWireError);
    assert.throws(register({ "   ": { target: { id: "c", kind: "context" } } }), TemplateWireError);
    assert.throws(register({ Topic: "not-an-object" }), TemplateWireError);
  });

  await t.test("an unrecognised command or query type is rejected", () => {
    assert.throws(
      () => decodeTemplateCommand({ requestId: "r", origin: "user", command: { type: "template.nope" } }),
      TemplateWireError
    );
    assert.throws(() => decodeTemplateQuery({ query: { type: "nope" } }), TemplateWireError);
  });
});

// ─── Activity ─────────────────────────────────────────────────────────────────

test("Templates records accepted registry changes in a local transaction outbox", async (t) => {
  await t.test("registration and deletion each write exactly one transaction", async () => {
    const { templates, store } = createFixture();
    const registered = await templates.command(registerCommand("req-1"));
    const templateId = registered.type === "template.registered" ? registered.template.id : "";
    assert.equal(store.listUnpublishedTransactions().length, 1);

    await templates.command({
      requestId: "req-2",
      origin: "system",
      command: { type: "template.delete", templateId }
    });
    const transactions = store.listUnpublishedTransactions();
    assert.deepEqual(
      transactions
        .map((transaction) => ({ kind: transaction.kind, origin: transaction.origin }))
        .sort((left, right) => left.kind.localeCompare(right.kind)),
      [
        { kind: "template.deleted", origin: "system" },
        { kind: "template.registered", origin: "user" }
      ]
    );
  });

  await t.test("a rejected command and an exact retry write no transaction", async () => {
    const { templates, store, adapter } = createFixture();
    adapter.failNext = true;
    await assert.rejects(() => templates.command(registerCommand("req-1")));
    assert.equal(store.listUnpublishedTransactions().length, 0);

    await templates.command(registerCommand("req-2"));
    await templates.command(registerCommand("req-2"));
    assert.equal(store.listUnpublishedTransactions().length, 1);
  });

  await t.test("a crash between the catalog commit and claim completion writes one transaction", async () => {
    // The dangerous window: markReady has committed the catalog row and its
    // transaction, but completeClaim has not run. The claim stays pending, so an
    // identical retry re-runs the whole command against an already-ready
    // record. Source transaction IDs derive from the request, so
    // the second pass must not append duplicate history for one registration.
    let failCompleteClaim = true;
    const { templates, store } = createFixture({
      wrapStore: (real) =>
        new Proxy(real, {
          get(target, property, receiver) {
            if (property === "completeClaim" && failCompleteClaim) {
              return () => {
                failCompleteClaim = false;
                throw new Error("crash after commit, before claim completion");
              };
            }
            return Reflect.get(target, property, receiver);
          }
        })
    });

    await assert.rejects(() => templates.command(registerCommand("req-1")));
    assert.equal(store.list().length, 1, "the catalog row committed before the crash");
    assert.equal(store.listUnpublishedTransactions().length, 1);

    // Same request, resumed.
    const resumed = await templates.command(registerCommand("req-1"));
    assert.equal(resumed.type, "template.registered");
    assert.equal(
      store.listUnpublishedTransactions().length,
      1,
      "one source transaction per request, not one per attempt"
    );
    assert.equal(store.list().length, 1, "no duplicate catalog row");
  });

  await t.test("a publisher failure leaves the transaction for the next drain", async () => {
    const fixture = createFixture();
    await fixture.templates.command(registerCommand("req-1"));

    fixture.setPublisherFails(true);
    assert.equal(await fixture.templates.publishPendingActivity(), 0);
    assert.equal(fixture.store.listUnpublishedTransactions().length, 1);
    assert.ok(
      fixture.logger.entries.some((entry) => entry.message === "templates.activity.publish-failed")
    );

    fixture.setPublisherFails(false);
    assert.equal(await fixture.templates.publishPendingActivity(), 1);
    assert.equal(fixture.store.listUnpublishedTransactions().length, 0);
    assert.equal(fixture.published.length, 1);
  });

  await t.test("source transactions preserve every supported origin when published to Activity", async () => {
    for (const origin of ["user", "agent", "automation", "system"] as const) {
      const fixture = createFixture();
      const registered = await fixture.templates.command(registerCommand("req-1", {}, origin));
      const templateId = registered.type === "template.registered" ? registered.template.id : "";
      assert.equal(fixture.store.listUnpublishedTransactions()[0].origin, origin);

      await fixture.templates.publishPendingActivity();
      const transaction = toTemplateActivityTransaction(fixture.published[0]);
      assert.equal(transaction.kind, "template");
      assert.equal(transaction.resourceId, templateId);
      assert.equal(transaction.operation, "registered");
      assert.equal(transaction.actorId, "user-1");
      assert.equal(transaction.origin, origin);
    }
  });
});

test("Templates initializes only the fresh current/history and transaction schemas", () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-templates-fresh-schema-"));
  const projectId = "templates-fresh-schema";
  const filePath = join(directory, "templates.db");
  const tables = createTemplateTableNames(projectId);
  new SQLiteTemplateStore(projectId, filePath);
  const db = new Database(filePath);
  const tableNames = (db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table'"
  ).all() as Array<{ name: string }>).map(({ name }) => name);
  assert.ok(tableNames.includes(tables.templates));
  assert.ok(tableNames.includes(tables.history));
  assert.ok(tableNames.includes(tables.transactionOutbox));
  assert.equal(tableNames.some((name) => name.endsWith("_activity_outbox")), false);

  const columns = (
    db.prepare(`PRAGMA table_info(${tables.transactionOutbox})`).all() as Array<{ name: string }>
  ).map(({ name }) => name);
  assert.ok(columns.includes("source_transaction_id"));
  assert.ok(columns.includes("transaction_kind"));
  assert.equal(columns.includes("fact_id"), false);
  db.close();
});

test("Templates ignores a legacy catalog-limit configuration section", async () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-templates-config-"));
  const filePath = join(directory, "configuration.yaml");
  writeFileSync(filePath, [
    "projectId: template-config-test",
    "templates:",
    "  maxTemplatesPerProject: 1"
  ].join("\n"));

  const config = await loadBackendConfig(filePath);
  assert.equal(config.projectId, "template-config-test");
  assert.equal("templates" in config, false);
});
