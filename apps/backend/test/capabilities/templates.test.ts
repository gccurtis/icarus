import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { toTemplateActivityTransaction } from "../../src/1-init/create/templates.js";
import {
  SQLiteTemplateStore,
  TemplateAlreadyExistsError,
  TemplateCatalogLimitError,
  TemplateIdempotencyMismatchError,
  TemplateNotFoundError,
  TemplateUnsupportedKindError,
  TemplateWireError,
  createTemplateCapability,
  decodeTemplateCommand,
  decodeTemplateQuery,
  type TemplateClock,
  type TemplateCommittedFact,
  type TemplateContextBindings,
  type TemplateInstantiationInput,
  type TemplateResourceAdapter,
  type TemplateStore
} from "../../src/3-capabilities/templates/index.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

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

interface DeleteCall {
  method: "deleteTemplateCopy";
  templateId: string;
  idempotencyKey: string;
}

type AdapterCall = CreateCall | InstantiateCall | DeleteCall;

class FakeResourceAdapter implements TemplateResourceAdapter {
  readonly calls: AdapterCall[] = [];
  failNext = false;

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

  async deleteTemplateCopy(input: {
    templateId: string;
    idempotencyKey: string;
  }): Promise<void> {
    this.calls.push({ method: "deleteTemplateCopy", ...input });
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
}

// ─── Fixture ──────────────────────────────────────────────────────────────────

let fixtureSequence = 0;

const createFixture = (
  options: {
    maxTemplatesPerProject?: number;
    registerAdapter?: boolean;
    /** Lets a test interpose on the store, e.g. to simulate a mid-command crash. */
    wrapStore?: (store: TemplateStore) => TemplateStore;
  } = {}
) => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-templates-"));
  const projectId = `templates-test-${++fixtureSequence}`;
  const realStore = new SQLiteTemplateStore(projectId, join(directory, "templates.db"));
  const store = options.wrapStore ? options.wrapStore(realStore) : realStore;
  const adapter = new FakeResourceAdapter("document", store);
  const adapters = new Map<string, TemplateResourceAdapter>();
  if (options.registerAdapter !== false) adapters.set(adapter.kind, adapter);

  const published: TemplateCommittedFact[] = [];
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
        publish: async (fact) => {
          if (publisherFails) throw new Error("activity unavailable");
          published.push(fact);
        }
      },
      attribution: { actorId: "user-1" }
    },
    { maxTemplatesPerProject: options.maxTemplatesPerProject ?? 500 },
    clock,
    () => `generated-${++idSequence}`
  );

  return {
    templates,
    store,
    adapter,
    published,
    logger,
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
  overrides: Record<string, unknown> = {}
) => ({
  requestId,
  command: {
    type: "template.register" as const,
    source: { kind: "document", resourceId: "doc-1" },
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
    assert.equal(store.countLive(), 0);
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
    assert.equal(store.countLive(), 0);
    assert.equal(store.list().length, 0);
  });

  await t.test("maxTemplatesPerProject is enforced", async () => {
    const { templates } = createFixture({ maxTemplatesPerProject: 1 });
    await templates.command(registerCommand("req-1"));
    await assert.rejects(
      () => templates.command(registerCommand("req-2")),
      TemplateCatalogLimitError
    );
  });

  await t.test("a reserving record is invisible and blocks its own identity", async () => {
    const { templates, store } = createFixture();
    const createdAt = "2026-08-02T00:00:00.000Z";
    assert.equal(
      store.reserve({
        id: "generated-1",
        kind: "document",
        resourceId: "generated-1",
        state: "reserving",
        createdAt
      }),
      true
    );
    // Invisible to list, and a second reservation of the same identity fails.
    assert.equal(store.list().length, 0);
    assert.equal(
      store.reserve({
        id: "generated-1",
        kind: "document",
        resourceId: "generated-1",
        state: "reserving",
        createdAt
      }),
      false
    );
    await assert.rejects(
      () =>
        templates.command({
          requestId: "req-x",
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

  await t.test("key ordering in the command does not change the digest", async () => {
    const { templates, adapter } = createFixture();
    await templates.command({
      requestId: "req-1",
      command: {
        type: "template.register",
        source: { kind: "document", resourceId: "doc-1" },
        description: "a template",
        contextBindings: {}
      }
    });
    // Same content, different property order.
    await templates.command({
      requestId: "req-1",
      command: {
        contextBindings: {},
        description: "a template",
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
    assert.equal(store.countLive(), 0);

    // The claim is still pending with its frozen template_id, so the retry
    // reuses that identity and the same adapter key instead of minting a new one.
    const result = await templates.command(registerCommand("req-1"));
    assert.equal(result.type === "template.registered" && result.template.id, "generated-1");
    assert.equal(store.countLive(), 1);
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

  await t.test("delete soft-deletes, calls the adapter once, and hides the record", async () => {
    const { templates, store, adapter } = createFixture();
    const registered = await templates.command(registerCommand("req-1"));
    const templateId = registered.type === "template.registered" ? registered.template.id : "";

    await templates.command({
      requestId: "req-2",
      command: { type: "template.delete", templateId }
    });

    assert.equal(store.get(templateId), undefined);
    assert.equal(store.list().length, 0);
    assert.equal(adapter.calls.filter((c) => c.method === "deleteTemplateCopy").length, 1);
    await assert.rejects(
      () => templates.query({ query: { type: "template.get", templateId } }),
      TemplateNotFoundError
    );
  });
});

// ─── Bindings and descriptions ────────────────────────────────────────────────

test("Templates forwards binding pairs verbatim and persists none of them", async (t) => {
  await t.test("omitted bindings reach the adapter as an empty record", async () => {
    const { templates, adapter } = createFixture();
    await templates.command({
      requestId: "req-1",
      command: {
        type: "template.register",
        source: { kind: "document", resourceId: "doc-1" },
        contextBindings: decodeContextBindingsFromWire(undefined)
      }
    });
    assert.deepEqual(adapter.createCalls()[0].contextBindings, {});
  });

  await t.test("an absent key and an explicit-unbind key stay distinguishable", async () => {
    const { templates, adapter } = createFixture();
    await templates.command(
      registerCommand("req-1", {
        contextBindings: { "Main topic": {}, Region: { entry: { id: "ctx-1", kind: "context" } } }
      })
    );
    const forwarded = adapter.createCalls()[0].contextBindings;
    // "Main topic" is present-but-empty: explicitly unbound, not absent.
    assert.ok(Object.prototype.hasOwnProperty.call(forwarded, "Main topic"));
    assert.equal(forwarded["Main topic"].entry, undefined);
    assert.deepEqual(forwarded.Region.entry, { id: "ctx-1", kind: "context" });
    assert.equal(Object.prototype.hasOwnProperty.call(forwarded, "Absent"), false);
  });

  await t.test("binding descriptions are forwarded but never inspected", async () => {
    const { templates, adapter } = createFixture();
    await templates.command(
      registerCommand("req-1", {
        contextBindings: { "Main topic": { description: "the subject area" } }
      })
    );
    assert.equal(
      adapter.createCalls()[0].contextBindings["Main topic"].description,
      "the subject area"
    );
  });

  await t.test("instantiation forwards bindings and an omitted title", async () => {
    const { templates, adapter } = createFixture();
    const registered = await templates.command(registerCommand("req-1"));
    const templateId = registered.type === "template.registered" ? registered.template.id : "";
    await templates.command({
      requestId: "req-2",
      command: {
        type: "template.instantiate",
        templateId,
        destinationResourceId: "doc-copy-1",
        contextBindings: { Region: { entry: { id: "ctx-2", kind: "context" } } }
      }
    });
    const call = adapter.instantiateCalls()[0];
    assert.equal(call.instantiation.title, undefined);
    assert.deepEqual(call.instantiation.contextBindings.Region.entry, {
      id: "ctx-2",
      kind: "context"
    });
  });

  await t.test("bindings are never persisted by Templates", async () => {
    const { templates, store } = createFixture();
    const registered = await templates.command(
      registerCommand("req-1", {
        contextBindings: { Region: { entry: { id: "ctx-1", kind: "context" } } }
      })
    );
    const templateId = registered.type === "template.registered" ? registered.template.id : "";
    const stored = store.get(templateId);
    assert.deepEqual(Object.keys(stored ?? {}).sort(), [
      "createdAt",
      "id",
      "kind",
      "resourceId",
      "state"
    ]);
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

// A tiny helper mirroring what the wire layer does, so the normalisation
// assertion above exercises the real decoder rather than a hand-built value.
function decodeContextBindingsFromWire(value: unknown): TemplateContextBindings {
  const decoded = decodeTemplateCommand({
    requestId: "probe",
    command: {
      type: "template.register",
      source: { kind: "document", resourceId: "doc-1" },
      ...(value !== undefined ? { contextBindings: value } : {})
    }
  });
  return decoded.command.type === "template.register" ? decoded.command.contextBindings : {};
}

// ─── Wire ─────────────────────────────────────────────────────────────────────

test("Templates decodes commands and queries strictly", async (t) => {
  await t.test("unknown keys are rejected on commands and queries", () => {
    assert.throws(
      () =>
        decodeTemplateCommand({
          requestId: "req-1",
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
      command: { type: "template.register", source: { kind: "document", resourceId: "doc-1" } }
    });
    assert.deepEqual(
      decoded.command.type === "template.register" ? decoded.command.contextBindings : undefined,
      {}
    );
  });

  await t.test("an empty binding object is valid and means explicit unbind", () => {
    const decoded = decodeTemplateCommand({
      requestId: "req-1",
      command: {
        type: "template.register",
        source: { kind: "document", resourceId: "doc-1" },
        contextBindings: { Topic: {} }
      }
    });
    const bindings =
      decoded.command.type === "template.register" ? decoded.command.contextBindings : {};
    assert.ok(Object.prototype.hasOwnProperty.call(bindings, "Topic"));
    assert.equal(bindings.Topic.entry, undefined);
  });

  await t.test("malformed binding entries and names are rejected", () => {
    const register = (contextBindings: unknown) => () =>
      decodeTemplateCommand({
        requestId: "req-1",
        command: {
          type: "template.register",
          source: { kind: "document", resourceId: "doc-1" },
          contextBindings
        }
      });

    assert.throws(register({ Topic: { entry: { id: "ctx-1" } } }), TemplateWireError);
    assert.throws(register({ Topic: { entry: { id: "", kind: "context" } } }), TemplateWireError);
    assert.throws(register({ Topic: { unknown: 1 } }), TemplateWireError);
    assert.throws(register({ "   ": { entry: { id: "c", kind: "context" } } }), TemplateWireError);
    assert.throws(register({ Topic: "not-an-object" }), TemplateWireError);
  });

  await t.test("an unrecognised command or query type is rejected", () => {
    assert.throws(
      () => decodeTemplateCommand({ requestId: "r", command: { type: "template.nope" } }),
      TemplateWireError
    );
    assert.throws(() => decodeTemplateQuery({ query: { type: "nope" } }), TemplateWireError);
  });
});

// ─── Activity ─────────────────────────────────────────────────────────────────

test("Templates records accepted registry changes in a local outbox", async (t) => {
  await t.test("registration and deletion each write exactly one fact", async () => {
    const { templates, store } = createFixture();
    const registered = await templates.command(registerCommand("req-1"));
    const templateId = registered.type === "template.registered" ? registered.template.id : "";
    assert.equal(store.listUnpublishedFacts().length, 1);

    await templates.command({
      requestId: "req-2",
      command: { type: "template.delete", templateId }
    });
    const facts = store.listUnpublishedFacts();
    assert.deepEqual(
      facts.map((fact) => fact.kind).sort(),
      ["template.deleted", "template.registered"]
    );
  });

  await t.test("a rejected command and an exact retry write no fact", async () => {
    const { templates, store, adapter } = createFixture();
    adapter.failNext = true;
    await assert.rejects(() => templates.command(registerCommand("req-1")));
    assert.equal(store.listUnpublishedFacts().length, 0);

    await templates.command(registerCommand("req-2"));
    await templates.command(registerCommand("req-2"));
    assert.equal(store.listUnpublishedFacts().length, 1);
  });

  await t.test("a crash between the catalog commit and claim completion writes one fact", async () => {
    // The dangerous window: markReady has committed the catalog row and its
    // fact, but completeClaim has not run. The claim stays pending, so an
    // identical retry re-runs the whole command against an already-ready
    // record. Fact IDs are derived from the request rather than generated, so
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
    assert.equal(store.listUnpublishedFacts().length, 1);

    // Same request, resumed.
    const resumed = await templates.command(registerCommand("req-1"));
    assert.equal(resumed.type, "template.registered");
    assert.equal(
      store.listUnpublishedFacts().length,
      1,
      "one fact per request, not one per attempt"
    );
    assert.equal(store.list().length, 1, "no duplicate catalog row");
  });

  await t.test("a publisher failure leaves the fact for the next drain", async () => {
    const fixture = createFixture();
    await fixture.templates.command(registerCommand("req-1"));

    fixture.setPublisherFails(true);
    assert.equal(await fixture.templates.publishPendingActivity(), 0);
    assert.equal(fixture.store.listUnpublishedFacts().length, 1);
    assert.ok(
      fixture.logger.entries.some((entry) => entry.message === "templates.activity.publish-failed")
    );

    fixture.setPublisherFails(false);
    assert.equal(await fixture.templates.publishPendingActivity(), 1);
    assert.equal(fixture.store.listUnpublishedFacts().length, 0);
    assert.equal(fixture.published.length, 1);
  });

  await t.test("facts map onto the Activity transaction vocabulary", async () => {
    const fixture = createFixture();
    const registered = await fixture.templates.command(registerCommand("req-1"));
    const templateId = registered.type === "template.registered" ? registered.template.id : "";
    await fixture.templates.publishPendingActivity();

    const transaction = toTemplateActivityTransaction(fixture.published[0]);
    assert.equal(transaction.kind, "template");
    assert.equal(transaction.resourceId, templateId);
    assert.equal(transaction.operation, "registered");
    assert.equal(transaction.actorId, "user-1");
  });
});
