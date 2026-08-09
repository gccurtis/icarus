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
  InvalidTemplateCursorError,
  StaleTemplateRevisionError,
  TemplateIdempotencyMismatchError,
  TemplateBindingMismatchError,
  TemplateNameConflictError,
  TemplateNotFoundError,
  TemplateUnsupportedKindError,
  TemplateWireError,
  createTemplateCapability,
  decodeTemplateCommand,
  decodeTemplateQuery,
  type TemplatableResource,
  type TemplateClock,
  type TemplateCommittedTransaction,
  type TemplateContextBindings,
  type TemplateOrigin,
  type TemplateStore
} from "../../src/3-capabilities/templates/index.js";
import { createTemplateTableNames } from "../../src/3-capabilities/templates/persistence/sqliteSchema.js";
import { CapturingLogger } from "../helpers/testDoubles.js";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError,
  getResourceHistory
} from "../../src/0-utils/persistence/resourceHistory.js";

// ─── Fake resource runtime ────────────────────────────────────────────────────

interface DuplicateCall {
  method: "duplicate";
  sourceResourceId: string;
  name?: string;
  idempotencyKey: string;
  /** What it allocated, so a test can follow the ID Templates was handed. */
  allocated: string;
  /** Rows visible from inside the call, to assert the catalog is written after. */
  observedRows: number;
}

interface MarkCall {
  method: "markAsTemplate";
  resourceId: string;
}

interface BindingsCall {
  method: "applyBindings";
  resourceId: string;
  contextBindings: TemplateContextBindings;
  idempotencyKey: string;
}

interface SubmitCall {
  method: "submit";
  resourceId: string;
  operations: unknown;
  idempotencyKey: string;
}

interface LoadCall {
  method: "load";
  resourceId: string;
}

interface RemovalCall {
  method: "logicalDelete" | "purge";
  resourceId: string;
  idempotencyKey: string;
}

type ResourceCall =
  | DuplicateCall
  | MarkCall
  | BindingsCall
  | SubmitCall
  | LoadCall
  | RemovalCall;

/**
 * Stands in for a capability's own runtime object. It allocates its own IDs,
 * which is the whole point of the seam: Templates never learns a resource ID it
 * did not receive from here.
 */
class FakeResource implements TemplatableResource {
  readonly calls: ResourceCall[] = [];
  failNext = false;
  /** Whatever load() hands back; opaque to Templates by design. */
  content: unknown = { title: "backing copy" };
  private allocations = 0;

  constructor(
    readonly kind: string,
    /** Supplied so duplicate() can observe the catalog mid-call. */
    private readonly store?: TemplateStore
  ) {}

  private guard(): void {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("resource refused");
    }
  }

  async duplicate(input: {
    sourceResourceId: string;
    name?: string;
    idempotencyKey: string;
  }): Promise<{ resourceId: string }> {
    // Keyed replay, like a real capability's create receipt: the same request
    // twice yields one copy, so a retry does not multiply resources.
    const prior = this.duplicateCalls().find(
      (call) => call.idempotencyKey === input.idempotencyKey
    );
    const allocated = prior?.allocated ?? `${this.kind}-copy-${++this.allocations}`;
    this.calls.push({
      method: "duplicate",
      ...input,
      allocated,
      observedRows: this.store?.list().items.length ?? 0
    });
    this.guard();
    return { resourceId: allocated };
  }

  async markAsTemplate(input: { resourceId: string }): Promise<void> {
    this.calls.push({ method: "markAsTemplate", ...input });
    this.guard();
  }

  async applyBindings(input: {
    resourceId: string;
    contextBindings: TemplateContextBindings;
    idempotencyKey: string;
  }): Promise<void> {
    this.calls.push({ method: "applyBindings", ...input });
    this.guard();
  }

  async submit(input: {
    resourceId: string;
    operations: unknown;
    idempotencyKey: string;
  }): Promise<void> {
    this.calls.push({ method: "submit", ...input });
    this.guard();
  }

  async load(input: { resourceId: string }): Promise<unknown> {
    this.calls.push({ method: "load", ...input });
    this.guard();
    return this.content;
  }

  async logicalDelete(input: { resourceId: string; idempotencyKey: string }): Promise<void> {
    this.calls.push({ method: "logicalDelete", ...input });
    this.guard();
  }

  async purge(input: { resourceId: string; idempotencyKey: string }): Promise<void> {
    this.calls.push({ method: "purge", ...input });
    if (this.failPurgeFor.has(input.resourceId)) {
      throw new Error(`resource refused to purge ${input.resourceId}`);
    }
    this.guard();
  }

  /** Sealed rows this fake knows about, keyed by ID. */
  private readonly sealed = new Map<string, string>();
  /** Resource IDs whose purge throws, to prove one failure does not stop a sweep. */
  readonly failPurgeFor = new Set<string>();

  /** Seals a resource without a catalog row — the orphan this sweep exists for. */
  seal(resourceId: string, sealedAt: string): void {
    this.sealed.set(resourceId, sealedAt);
  }

  async listSealedResources(): Promise<Array<{ resourceId: string; sealedAt: string }>> {
    // Registration's own copies count too: `markAsTemplate` seals them, so a
    // real runtime would list them and the sweep must not reap the claimed ones.
    for (const call of this.markCalls()) {
      if (!this.sealed.has(call.resourceId)) {
        this.sealed.set(call.resourceId, "2026-08-01T00:00:00.000Z");
      }
    }
    return [...this.sealed].map(([resourceId, sealedAt]) => ({ resourceId, sealedAt }));
  }

  private of<T extends ResourceCall>(method: ResourceCall["method"]): T[] {
    return this.calls.filter((call): call is T => call.method === method);
  }

  duplicateCalls(): DuplicateCall[] {
    return this.of<DuplicateCall>("duplicate");
  }

  /**
   * Copies made from one source. Registration copies the caller's resource;
   * instantiation copies the backing template, so the source tells the two
   * apart without counting calls.
   */
  duplicatesOf(sourceResourceId: string): DuplicateCall[] {
    return this.duplicateCalls().filter(
      (call) => call.sourceResourceId === sourceResourceId
    );
  }

  markCalls(): MarkCall[] {
    return this.of<MarkCall>("markAsTemplate");
  }

  bindingsCalls(): BindingsCall[] {
    return this.of<BindingsCall>("applyBindings");
  }

  submitCalls(): SubmitCall[] {
    return this.of<SubmitCall>("submit");
  }

  loadCalls(): LoadCall[] {
    return this.of<LoadCall>("load");
  }
}

// ─── Fixture ──────────────────────────────────────────────────────────────────

let fixtureSequence = 0;

const createFixture = (
  options: {
    registerResource?: boolean;
    /** Lets a test interpose on the store, e.g. to simulate a mid-command crash. */
    wrapStore?: (store: TemplateStore) => TemplateStore;
  } = {}
) => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-templates-"));
  const projectId = `templates-test-${++fixtureSequence}`;
  const filePath = join(directory, "templates.db");
  const realStore = new SQLiteTemplateStore(projectId, filePath);
  const store = options.wrapStore ? options.wrapStore(realStore) : realStore;
  const resource = new FakeResource("document", store);
  const resources = new Map<string, TemplatableResource>();
  if (options.registerResource !== false) resources.set(resource.kind, resource);

  const published: TemplateCommittedTransaction[] = [];
  let publisherFails = false;
  let timestamp = "2026-08-02T00:00:00.000Z";
  const clock: TemplateClock = { now: () => timestamp };
  let idSequence = 0;
  const logger = new CapturingLogger();

  const templates = createTemplateCapability(
    store,
    {
      resources: {
        get: (kind) => resources.get(kind),
        kinds: () => [...resources.keys()]
      },
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
    resource,
    published,
    logger,
    /** Lets a test drop the runtime after registration succeeded. */
    unregisterResource: () => resources.delete(resource.kind),
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
    kind: "document",
    resourceId: "doc-1",
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
    const template = result.type === "template.registered" ? result.template : undefined;
    assert.equal(template?.id, "generated-1");
  });

  await t.test("the catalog ID and the backing resource ID are different things", async () => {
    const { templates, resource } = createFixture();
    const result = await templates.command(registerCommand("req-1"));
    const template = result.type === "template.registered" ? result.template : undefined;

    // Templates names the catalog row because it stores it; the resource names
    // the copy because it stores that. They were never required to match — the
    // old CHECK made a coincidence look like a rule.
    assert.equal(template?.id, "generated-1");
    assert.equal(template?.resourceId, "document-copy-1");
    assert.equal(resource.duplicateCalls()[0].allocated, "document-copy-1");
    // And Templates never told the resource which ID to use.
    assert.equal(
      Object.prototype.hasOwnProperty.call(resource.duplicateCalls()[0], "templateId"),
      false
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

  await t.test("no catalog row exists while the resource runs", async () => {
    const { templates, store, resource } = createFixture();
    await templates.command(registerCommand("req-1"));
    // Observed from inside duplicate(). Nothing durable is written until the
    // resource returns, which is why there is no identity to freeze and nothing
    // to release when it fails.
    assert.equal(resource.duplicateCalls()[0].observedRows, 0);
    assert.equal(store.list().items.length, 1);
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
            kind: "document",
            resourceId: "doc-1"
          }
        }),
      TemplateWireError
    );
  });
});

// ─── Catalog and resource dispatch ─────────────────────────────────────────────

test("Templates dispatches to the resource registry and guards the catalog", async (t) => {
  await t.test("an unsupported kind fails before any row or resource call", async () => {
    const { templates, store, resource } = createFixture({ registerResource: false });
    await assert.rejects(
      () => templates.command(registerCommand("req-1")),
      TemplateUnsupportedKindError
    );
    assert.equal(resource.calls.length, 0);
    assert.equal(store.list().items.length, 0);
  });

  await t.test("a successful registration produces one usable record", async () => {
    const { templates, store, resource } = createFixture();
    const result = await templates.command(registerCommand("req-1"));
    const id = result.type === "template.registered" ? result.template.id : "";
    assert.equal(store.get(id)?.revision, 1);
    assert.equal(resource.duplicateCalls().length, 1);
    assert.equal(store.list().items.length, 1);
  });

  await t.test("an resource throw leaves no catalog row and no receipt", async () => {
    const { templates, store, resource } = createFixture();
    resource.failNext = true;
    await assert.rejects(() => templates.command(registerCommand("req-1")));
    assert.equal(store.list().items.length, 0);
    // No receipt either, so the retry is the same command against the same
    // state rather than a resumption of a half-finished one.
    assert.equal(store.getReceipt("req-1"), undefined);

    const retried = await templates.command(registerCommand("req-1"));
    assert.equal(retried.type, "template.registered");
    assert.equal(store.list().items.length, 1);
  });

  await t.test("an unknown template is not found", async () => {
    const { templates } = createFixture();
    await assert.rejects(
      () =>
        templates.command({
          requestId: "req-x",
          origin: "user",
          command: {
            type: "template.instantiate",
            templateId: "generated-1",
            contextBindings: {}
          }
        }),
      TemplateNotFoundError
    );
  });

  await t.test("one template per backing resource, and a losing create writes nothing", async () => {
    const { templates, store } = createFixture();
    const registered = await templates.command(registerCommand("req-1", { name: "First" }));
    const existing = registered.type === "template.registered" ? registered.template : undefined;
    assert.ok(existing);

    // A second catalog row over the same (kind, resourceId). Unreachable through
    // the service while Templates still supplies the backing ID, and reachable
    // the moment the resource allocates it — which is why the store enforces it
    // rather than the caller.
    const at = "2026-08-02T00:00:00.000Z";
    const receipt = {
      requestId: "req-collide",
      requestDigest: "digest",
      commandType: "template.register" as const,
      result: { type: "template.registered" },
      createdAt: at
    };
    assert.equal(
      store.create({
        record: { ...existing, id: "other-id", name: "Second" },
        receipt,
        transaction: {
          sourceTransactionId: "req-collide:registered",
          kind: "template.registered",
          templateId: "other-id",
          resourceKind: existing.kind,
          resourceId: existing.resourceId,
          origin: "user",
          occurredAt: at
        }
      }),
      false
    );
    assert.equal(store.list().items.length, 1);
    assert.equal(store.getReceipt("req-collide"), undefined, "the receipt rolled back too");
    assert.equal(store.listUnpublishedTransactions().length, 1);
  });
});

// ─── Idempotency ──────────────────────────────────────────────────────────────

test("Templates replays exact retries and refuses divergent reuse", async (t) => {
  await t.test("an exact register retry returns the same allocated ID once", async () => {
    const { templates, resource } = createFixture();
    const first = await templates.command(registerCommand("req-1"));
    const second = await templates.command(registerCommand("req-1"));
    assert.deepEqual(first, second);
    assert.equal(resource.duplicateCalls().length, 1);
  });

  await t.test("origin does not affect replay and the committed transaction keeps its first origin", async () => {
    const { templates, store, resource } = createFixture();
    const first = await templates.command(registerCommand("req-1", {}, "automation"));
    const replay = await templates.command(registerCommand("req-1", {}, "system"));

    assert.deepEqual(replay, first);
    assert.equal(resource.duplicateCalls().length, 1);
    assert.equal(store.listUnpublishedTransactions()[0].origin, "automation");
  });

  await t.test("key ordering in the command does not change the digest", async () => {
    const { templates, resource } = createFixture();
    await templates.command({
      requestId: "req-1",
      origin: "user",
      command: {
        type: "template.register",
        kind: "document",
        resourceId: "doc-1",
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
        resourceId: "doc-1",
        description: "a template",
        name: "ordering-probe",
        kind: "document",
        type: "template.register"
      } as never
    });
    assert.equal(resource.duplicateCalls().length, 1);
  });

  await t.test("reusing a request ID with different content is a mismatch", async () => {
    const { templates } = createFixture();
    await templates.command(registerCommand("req-1"));
    await assert.rejects(
      () =>
        templates.command(
          registerCommand("req-1", { resourceId: "doc-2" })
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

  await t.test("a retried attempt presents the resource the same idempotency key", async () => {
    const { templates, store, resource } = createFixture();
    resource.failNext = true;
    await assert.rejects(() => templates.command(registerCommand("req-1")));
    assert.equal(store.list().items.length, 0);

    // The retry re-runs the command from the start — there is nothing to resume
    // from — but the key is derived from the request, so the resource replays its
    // own attempt rather than making a second backing copy.
    const result = await templates.command(registerCommand("req-1"));
    assert.equal(result.type, "template.registered");
    assert.equal(store.list().items.length, 1);
    const keys = resource.duplicateCalls().map((call) => call.idempotencyKey);
    assert.deepEqual(keys, ["templates:register:req-1", "templates:register:req-1"]);
  });

  await t.test("the receipt records the command type, so a replay can check it", async () => {
    const { templates, store } = createFixture();
    await templates.command(registerCommand("req-1"));
    const receipt = store.getReceipt("req-1");
    assert.equal(receipt?.commandType, "template.register");
    assert.equal(
      (receipt?.result as { type: string } | undefined)?.type,
      "template.registered"
    );
  });

  // register, update, and delete each commit their receipt inside their own
  // store transaction. instantiate and purge change no local state, so their
  // receipts come only from the generic write after execute — which is the one
  // path nothing else in this suite exercises.
  await t.test("an exact instantiate retry replays without a second copy", async () => {
    const { templates, resource } = createFixture();
    const registered = await templates.command(registerCommand("req-1"));
    const template = registered.type === "template.registered" ? registered.template : undefined;
    assert.ok(template);
    const instantiate = {
      requestId: "req-2",
      origin: "user" as const,
      command: {
        type: "template.instantiate" as const,
        templateId: template.id,
        contextBindings: {}
      }
    };

    const first = await templates.command(instantiate);
    const replay = await templates.command(instantiate);
    assert.deepEqual(replay, first);
    assert.equal(resource.duplicatesOf(template.resourceId).length, 1);
  });

  await t.test("an exact purge retry replays instead of failing as already purged", async () => {
    const { templates, resource } = createFixture();
    const registered = await templates.command(registerCommand("req-1"));
    const templateId = registered.type === "template.registered" ? registered.template.id : "";
    await templates.command({
      requestId: "req-2",
      origin: "user",
      command: { type: "template.delete", templateId }
    });
    const purge = {
      requestId: "req-3",
      origin: "user" as const,
      command: { type: "template.purge" as const, templateId }
    };

    const first = await templates.command(purge);
    // Without a receipt this would raise ResourceHistoryNotFoundError: the
    // history it purges is already gone by the time the retry arrives.
    const replay = await templates.command(purge);
    assert.deepEqual(replay, first);
    assert.equal(resource.calls.filter((c) => c.method === "purge").length, 1);
  });
});

// ─── Instantiation and deletion ───────────────────────────────────────────────

test("Templates instantiates without a catalog row and deletes through the resource", async (t) => {
  await t.test("instantiate returns the ref the resource allocated and writes no row", async () => {
    const { templates, store, resource } = createFixture();
    const registered = await templates.command(registerCommand("req-1"));
    const template = registered.type === "template.registered" ? registered.template : undefined;
    assert.ok(template);

    const result = await templates.command({
      requestId: "req-2",
      origin: "user",
      command: {
        type: "template.instantiate",
        templateId: template.id,
        contextBindings: {}
      }
    });

    assert.equal(result.type, "template.instantiated");
    // The caller named no destination; this ID came back from the resource.
    const copies = resource.duplicatesOf(template.resourceId);
    assert.equal(copies.length, 1);
    assert.deepEqual(
      result.type === "template.instantiated" ? result.resource : undefined,
      { kind: "document", resourceId: copies[0].allocated }
    );
    assert.equal(store.list().items.length, 1, "no catalog row is written for an instance");
    // The instance is an ordinary resource: it is copied from the template but
    // never sealed as one.
    assert.deepEqual(resource.markCalls().map((call) => call.resourceId), [template.resourceId]);
  });

  await t.test("a destinationResourceId is rejected at the wire boundary", () => {
    // Removed rather than ignored: the resource allocates the ID, so a caller
    // supplying one is stating something that cannot be honoured.
    assert.throws(
      () =>
        decodeTemplateCommand({
          requestId: "req-1",
          origin: "user",
          command: {
            type: "template.instantiate",
            templateId: "t-1",
            destinationResourceId: "doc-9",
            contextBindings: {}
          }
        }),
      TemplateWireError
    );
  });

  await t.test("instantiation must supply every declared parameter", async () => {
    const { templates, resource } = createFixture();
    const registered = await templates.command(
      registerCommand("req-1", {
        contextBindings: {
          "Main topic": {},
          // A declared default. It configured the backing copy; it is not a
          // fallback for an omitted argument.
          Region: { target: { id: "ctx-1", kind: "context" } }
        }
      })
    );
    const templateId = registered.type === "template.registered" ? registered.template.id : "";
    resource.calls.length = 0;

    await assert.rejects(
      () =>
        templates.command({
          requestId: "req-2",
          origin: "user",
          command: {
            type: "template.instantiate",
            templateId,
            contextBindings: { "Main topic": { target: { id: "ctx-9", kind: "context" } } }
          }
        }),
      (error: unknown) => {
        assert.ok(error instanceof TemplateBindingMismatchError);
        assert.deepEqual(error.missing, ["Region"]);
        assert.deepEqual(error.unexpected, []);
        return true;
      }
    );
    // Refused before anything was copied, so a rejected instantiation leaves
    // no resource behind.
    assert.deepEqual(resource.calls, []);
  });

  await t.test("instantiation may not bind a variable the template never declared", async () => {
    const { templates } = createFixture();
    const registered = await templates.command(
      registerCommand("req-1", { contextBindings: { Region: {} } })
    );
    const templateId = registered.type === "template.registered" ? registered.template.id : "";

    await assert.rejects(
      () =>
        templates.command({
          requestId: "req-2",
          origin: "user",
          command: {
            type: "template.instantiate",
            templateId,
            contextBindings: {
              Region: { target: { id: "ctx-1", kind: "context" } },
              // Not a parameter. It is baked-in content, and binding it would
              // edit the instance rather than configure it.
              Tone: { target: { id: "ctx-2", kind: "context" } }
            }
          }
        }),
      (error: unknown) => {
        assert.ok(error instanceof TemplateBindingMismatchError);
        assert.deepEqual(error.missing, []);
        assert.deepEqual(error.unexpected, ["Tone"]);
        return true;
      }
    );
  });

  await t.test("an instantiation argument must say what it points at", () => {
    // At registration an omitted target declares a parameter with no default.
    // Here it would leave the instance holding an unbound variable, which is
    // the state the binding rule exists to prevent.
    assert.throws(
      () =>
        decodeTemplateCommand({
          requestId: "req-1",
          origin: "user",
          command: {
            type: "template.instantiate",
            templateId: "t-1",
            contextBindings: { Region: {} }
          }
        }),
      TemplateWireError
    );

    // The same shape is valid at registration, and means something different.
    const declared = decodeTemplateCommand(
      registerCommand("req-1", { contextBindings: { Region: {} } })
    );
    assert.equal(
      declared.command.type === "template.register"
        ? declared.command.contextBindings.Region.target
        : "unset",
      undefined
    );
  });

  await t.test("a template with no parameters instantiates with no bindings", async () => {
    const { templates, resource } = createFixture();
    const registered = await templates.command(registerCommand("req-1"));
    const templateId = registered.type === "template.registered" ? registered.template.id : "";
    const result = await templates.command({
      requestId: "req-2",
      origin: "user",
      command: { type: "template.instantiate", templateId, contextBindings: {} }
    });
    assert.equal(result.type, "template.instantiated");
    // Nothing declared, nothing supplied, nothing to apply.
    assert.deepEqual(resource.bindingsCalls(), []);
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
            contextBindings: {}
          }
        }),
      TemplateNotFoundError
    );
  });

  await t.test("delete archives current state and purge removes retained state through the resource", async () => {
    const { templates, store, resource } = createFixture();
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
    assert.equal(store.list().items.length, 0);
    assert.equal(store.latestSnapshot(templateId)?.revision, 1);
    assert.equal(resource.calls.filter((c) => c.method === "logicalDelete").length, 1);
    await assert.rejects(
      () => templates.query({ query: { type: "template.get", templateId } }),
      TemplateNotFoundError
    );

    assert.deepEqual(await templates.command({
      requestId: "req-3",
      origin: "user",
      command: { type: "template.purge", templateId }
    }), { type: "template.purged", templateId });
    assert.equal(resource.calls.filter((c) => c.method === "purge").length, 1);
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

  await t.test("removal addresses the resource by its own ID, not the template's", async () => {
    const { templates, store, resource } = createFixture();
    const registered = await templates.command(registerCommand("req-1"));
    const template = registered.type === "template.registered" ? registered.template : undefined;
    assert.ok(template);
    assert.notEqual(template.resourceId, template.id);

    await templates.command({
      requestId: "req-2",
      origin: "user",
      command: { type: "template.delete", templateId: template.id }
    });
    await templates.command({
      requestId: "req-3",
      origin: "user",
      command: { type: "template.purge", templateId: template.id }
    });

    // Purge runs off the archived snapshot, so this also proves history keeps
    // the backing ID — without it there would be nothing left to purge.
    assert.deepEqual(
      resource.calls
        .filter((call) => call.method === "logicalDelete" || call.method === "purge")
        .map((call) => [call.method, (call as { resourceId: string }).resourceId]),
      [
        ["logicalDelete", template.resourceId],
        ["purge", template.resourceId]
      ]
    );
    assert.equal(store.latestSnapshot(template.id), undefined);
  });
});

// ─── Bindings and descriptions ────────────────────────────────────────────────

test("Templates records the declared bindings and applies the targets", async (t) => {
  await t.test("no declared bindings means no applyBindings call at all", async () => {
    const { templates, resource } = createFixture();
    await templates.command({
      requestId: "req-1",
      origin: "user",
      command: {
        type: "template.register",
        kind: "document",
        resourceId: "doc-1",
        name: "template-req-1",
        contextBindings: decodeContextBindingsFromWire(undefined)
      }
    });
    // duplicate() is a pure copy, so there is nothing to say to the resource
    // when a template declares no parameters.
    assert.deepEqual(resource.bindingsCalls(), []);
    assert.equal(resource.duplicateCalls().length, 1);
  });

  await t.test("registration copies, seals, then binds — in that order", async () => {
    const { templates, resource } = createFixture();
    const registered = await templates.command(
      registerCommand("req-1", {
        contextBindings: { Region: { target: { id: "ctx-1", kind: "context" } } }
      })
    );
    const template = registered.type === "template.registered" ? registered.template : undefined;

    assert.deepEqual(
      resource.calls.map((call) => call.method),
      ["duplicate", "markAsTemplate", "applyBindings"]
    );
    // Every call after the copy addresses the ID the copy allocated.
    assert.equal(resource.markCalls()[0].resourceId, template?.resourceId);
    assert.equal(resource.bindingsCalls()[0].resourceId, template?.resourceId);
  });

  await t.test("an absent key and an explicit-unbind key stay distinguishable", async () => {
    const { templates, resource } = createFixture();
    await templates.command(
      registerCommand("req-1", {
        contextBindings: { "Main topic": {}, Region: { target: { id: "ctx-1", kind: "context" } } }
      })
    );
    const applied = resource.bindingsCalls()[0].contextBindings;
    // "Main topic" is present-but-empty: explicitly unbound, not absent.
    assert.ok(Object.prototype.hasOwnProperty.call(applied, "Main topic"));
    assert.equal(applied["Main topic"].target, undefined);
    assert.deepEqual(applied.Region.target, { id: "ctx-1", kind: "context" });
    assert.equal(Object.prototype.hasOwnProperty.call(applied, "Absent"), false);
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

  await t.test("instantiation copies then binds, with no seal and no name", async () => {
    const { templates, resource } = createFixture();
    const registered = await templates.command(
      registerCommand("req-1", { contextBindings: { Region: {} } })
    );
    const template = registered.type === "template.registered" ? registered.template : undefined;
    assert.ok(template);
    resource.calls.length = 0;

    await templates.command({
      requestId: "req-2",
      origin: "user",
      command: {
        type: "template.instantiate",
        templateId: template.id,
        contextBindings: { Region: { target: { id: "ctx-2", kind: "context" } } }
      }
    });

    // The mirror of registration, one call shorter.
    assert.deepEqual(resource.calls.map((call) => call.method), ["duplicate", "applyBindings"]);
    const copy = resource.duplicateCalls()[0];
    assert.equal(copy.sourceResourceId, template.resourceId);
    assert.equal(copy.name, undefined, "an omitted name inherits the copy's own");
    assert.deepEqual(resource.bindingsCalls()[0].contextBindings.Region.target, {
      id: "ctx-2",
      kind: "context"
    });
    assert.equal(resource.bindingsCalls()[0].resourceId, copy.allocated);
  });

  await t.test("three names meet at instantiation and none is the other", async () => {
    const { templates, resource, store } = createFixture();
    const registered = await templates.command(
      registerCommand("req-1", { name: "Quarterly report template" })
    );
    const template = registered.type === "template.registered" ? registered.template : undefined;
    assert.ok(template);

    await templates.command({
      requestId: "req-2",
      origin: "user",
      command: {
        type: "template.instantiate",
        templateId: template.id,
        name: "Q3 report",
        contextBindings: {}
      }
    });

    // The instance's name goes to the resource, which is the only thing that
    // can act on it.
    assert.equal(resource.duplicatesOf(template.resourceId)[0].name, "Q3 report");
    // The catalog label is untouched by instantiating from it.
    assert.equal(store.get(template.id)?.name, "Quarterly report template");
    // And registration supplies no name at all: a backing copy is not something
    // a user names, and the title it inherits is sealed with it.
    assert.equal(resource.duplicatesOf("doc-1")[0].name, undefined);
  });

  await t.test("an instance name is trimmed at ingress like every other name", () => {
    const decoded = decodeTemplateCommand({
      requestId: "req-1",
      origin: "user",
      command: {
        type: "template.instantiate",
        templateId: "t-1",
        name: "  Q3 report  ",
        contextBindings: {}
      }
    });
    assert.equal(
      decoded.command.type === "template.instantiate" ? decoded.command.name : "",
      "Q3 report"
    );
    for (const name of ["", "   "]) {
      assert.throws(
        () =>
          decodeTemplateCommand({
            requestId: "req-1",
            origin: "user",
            command: {
              type: "template.instantiate",
              templateId: "t-1",
              name,
              contextBindings: {}
            }
          }),
        TemplateWireError
      );
    }
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
            kind: "document",
        resourceId: "doc-1",
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
    const { templates, resource } = createFixture();
    await templates.command(registerCommand("req-1", { name: "Quarterly report" }));
    await assert.rejects(
      // Case-insensitive: the index collates NOCASE.
      () => templates.command(registerCommand("req-2", { name: "quarterly REPORT" })),
      TemplateNameConflictError
    );
    // The ordering guarantee: the conflict is detected before any side effect.
    assert.equal(resource.duplicateCalls().length, 1);
  });

  await t.test("a name is taken per kind, not globally", async () => {
    const { templates, store } = createFixture();
    await templates.command(registerCommand("req-1", { name: "Quarterly report" }));
    assert.equal(store.nameTaken("document", "Quarterly report"), true);
    // The same name under another kind is free, so a Document template and a
    // Spreadsheet template may both be called "Quarterly report".
    assert.equal(store.nameTaken("spreadsheet", "Quarterly report"), false);
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

// ─── Search ───────────────────────────────────────────────────────────────────

test("Templates lists templates as a picker rather than a dump", async (t) => {
  const namesFrom = (result: { type: string }): string[] =>
    result.type === "template.records"
      ? (result as { templates: Array<{ name: string }> }).templates.map((t) => t.name)
      : [];

  const seed = async (
    templates: ReturnType<typeof createFixture>["templates"],
    entries: Array<{ name: string; description?: string }>
  ): Promise<void> => {
    for (const [index, entry] of entries.entries()) {
      await templates.command(
        registerCommand(`seed-${index}`, {
          resourceId: `doc-${index}`,
          name: entry.name,
          ...(entry.description !== undefined ? { description: entry.description } : {})
        })
      );
    }
  };

  await t.test("search matches name and description, case-insensitively", async () => {
    const { templates } = createFixture();
    await seed(templates, [
      { name: "Quarterly report", description: "finance" },
      { name: "Weekly digest", description: "a quarterly rollup lives here" },
      { name: "Onboarding", description: "people" }
    ]);

    const byName = await templates.query({
      query: { type: "template.list", search: "QUARTERLY" }
    });
    assert.deepEqual(namesFrom(byName).sort(), ["Quarterly report", "Weekly digest"]);

    const noMatch = await templates.query({ query: { type: "template.list", search: "zzz" } });
    assert.deepEqual(namesFrom(noMatch), []);
  });

  await t.test("a search term's LIKE wildcards are literal, not patterns", async () => {
    const { templates } = createFixture();
    await seed(templates, [
      { name: "Discount 50% off" },
      { name: "Plain report" },
      { name: "snake_case guide" },
      { name: "snakeXcase decoy" }
    ]);

    // Unescaped, "%" would match every row and "_" would match any character.
    assert.deepEqual(
      namesFrom(await templates.query({ query: { type: "template.list", search: "50%" } })),
      ["Discount 50% off"]
    );
    assert.deepEqual(
      namesFrom(await templates.query({ query: { type: "template.list", search: "snake_" } })),
      ["snake_case guide"]
    );
  });

  await t.test("kinds is any-of, and an empty list matches nothing", async () => {
    const { templates } = createFixture();
    await seed(templates, [{ name: "One" }, { name: "Two" }]);

    assert.equal(
      namesFrom(await templates.query({ query: { type: "template.list", kinds: ["document"] } }))
        .length,
      2
    );
    assert.deepEqual(
      namesFrom(await templates.query({ query: { type: "template.list", kinds: ["slides"] } })),
      []
    );
    // Not normalised to "every kind": a caller that filtered everything out
    // should see nothing rather than the whole catalog.
    assert.deepEqual(
      namesFrom(await templates.query({ query: { type: "template.list", kinds: [] } })),
      []
    );
  });

  await t.test("pagination walks the whole catalog exactly once", async () => {
    const { templates } = createFixture();
    await seed(templates, [
      { name: "A" },
      { name: "B" },
      { name: "C" },
      { name: "D" },
      { name: "E" }
    ]);

    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await templates.query({
        query: { type: "template.list", limit: 2, ...(cursor !== undefined ? { cursor } : {}) }
      });
      assert.equal(page.type, "template.records");
      seen.push(...namesFrom(page));
      cursor = page.type === "template.records" ? page.nextCursor : undefined;
      pages += 1;
    } while (cursor !== undefined && pages < 10);

    assert.deepEqual(seen, ["A", "B", "C", "D", "E"]);
    assert.equal(pages, 3, "two full pages and a short final one");
  });

  await t.test("the last page carries no cursor", async () => {
    const { templates } = createFixture();
    await seed(templates, [{ name: "Only" }]);
    const page = await templates.query({ query: { type: "template.list", limit: 10 } });
    assert.equal(page.type === "template.records" ? page.nextCursor : "unset", undefined);
  });

  await t.test("a cursor from elsewhere is refused rather than misread", async () => {
    const { templates } = createFixture();
    await seed(templates, [{ name: "Only" }]);
    const foreign = Buffer.from(
      JSON.stringify({ kind: "activity-transactions", sequence: 1 }),
      "utf8"
    ).toString("base64url");

    for (const cursor of [foreign, "not-base64-json"]) {
      await assert.rejects(
        () => templates.query({ query: { type: "template.list", cursor } }),
        InvalidTemplateCursorError
      );
    }
  });

  await t.test("list filters are decoded strictly", () => {
    const list = (extra: Record<string, unknown>) => () =>
      decodeTemplateQuery({ query: { type: "template.list", ...extra } });

    assert.throws(list({ kinds: "document" }), TemplateWireError);
    assert.throws(list({ kinds: ["document", "document"] }), TemplateWireError);
    assert.throws(list({ kinds: [""] }), TemplateWireError);
    assert.throws(list({ limit: 0 }), TemplateWireError);
    assert.throws(list({ limit: 1.5 }), TemplateWireError);
    assert.throws(list({ limit: 5_000 }), TemplateWireError);
    assert.throws(list({ cursor: "" }), TemplateWireError);
    assert.throws(list({ search: 42 }), TemplateWireError);

    // A whitespace-only search is a search for nothing, so it is dropped rather
    // than passed down to match nothing.
    const blank = decodeTemplateQuery({ query: { type: "template.list", search: "   " } });
    assert.equal(
      blank.query.type === "template.list" ? blank.query.search : "unset",
      undefined
    );
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
    const { templates, resource, store } = createFixture();
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
    // The conflict is raised before the resource runs, so no content was edited.
    assert.equal(resource.submitCalls().length, 0);
  });

  await t.test("resourceOperations reach submit, addressed by the backing resource's ID", async () => {
    const { templates, resource, store } = createFixture();
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
    const call = resource.submitCalls()[0];
    // Not the template ID: the resource knows its own row and nothing else.
    assert.equal(call.resourceId, store.get(templateId)?.resourceId);
    assert.notEqual(call.resourceId, templateId);
    assert.deepEqual(call.operations, [{ type: "block.insert", blockId: "b-1" }]);
    assert.equal(call.idempotencyKey, "templates:update:req-2");
  });

  await t.test("changed bindings go to applyBindings, before any content edit", async () => {
    const { templates, resource, store } = createFixture();
    const templateId = await registerFor(templates, "req-1");
    resource.calls.length = 0;

    await templates.command({
      requestId: "req-2",
      origin: "user",
      command: {
        type: "template.update",
        templateId,
        expectedRevision: 1,
        contextBindings: { Region: { description: "which market" } },
        resourceOperations: [{ type: "block.insert" }]
      }
    });

    // Bindings first, so a content edit referencing a freshly bound variable
    // sees it. Two calls, because they are two different statements about the
    // template — one about its parameters, one about its content.
    assert.deepEqual(resource.calls.map((call) => call.method), ["applyBindings", "submit"]);
    assert.deepEqual(resource.bindingsCalls()[0].contextBindings, {
      Region: { description: "which market" }
    });
    assert.equal(resource.bindingsCalls()[0].resourceId, store.get(templateId)?.resourceId);
  });

  await t.test("a purely-catalog update does not disturb the backing resource", async () => {
    const { templates, resource } = createFixture();
    const templateId = await registerFor(templates, "req-1");
    resource.calls.length = 0;
    await templates.command({
      requestId: "req-2",
      origin: "user",
      command: { type: "template.update", templateId, expectedRevision: 1, description: "blurb" }
    });
    assert.deepEqual(resource.calls, []);
  });

  await t.test("a resource failure leaves the catalog untouched and retryable", async () => {
    const { templates, store, resource } = createFixture();
    const templateId = await registerFor(templates, "req-1", { name: "Draft" });
    resource.failNext = true;

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

  await t.test("an exact replay returns the original result without re-calling the resource", async () => {
    const { templates, resource } = createFixture();
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
    assert.equal(resource.submitCalls().length, 1);
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
  await t.test("template.load returns the record and the resource's content verbatim", async () => {
    const { templates, resource, store } = createFixture();
    resource.content = { rows: ["opaque to Templates"] };
    const templateId = await registerFor(templates, "req-1", { name: "Draft" });

    const loaded = await templates.query({ query: { type: "template.load", templateId } });
    assert.equal(loaded.type, "template.content");
    assert.equal(loaded.type === "template.content" ? loaded.template.name : "", "Draft");
    assert.deepEqual(
      loaded.type === "template.content" ? loaded.content : undefined,
      { rows: ["opaque to Templates"] }
    );
    // Addressed by the resource's own ID, and handed back unread.
    assert.deepEqual(resource.loadCalls(), [
      { method: "load", resourceId: store.get(templateId)?.resourceId }
    ]);
  });

  await t.test("template.get never calls the resource, so listing stays cheap", async () => {
    const { templates, resource } = createFixture();
    const templateId = await registerFor(templates, "req-1");
    await templates.query({ query: { type: "template.get", templateId } });
    await templates.query({ query: { type: "template.list" } });
    assert.equal(resource.loadCalls().length, 0);
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

  await t.test("loading a kind with no resource is unsupported, not empty content", async () => {
    const { templates, unregisterResource } = createFixture();
    const templateId = await registerFor(templates, "req-1");
    // The catalog row stays; only the way to its content goes away.
    unregisterResource();
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

  await t.test("a failing resource call logs templates.command.failed and rethrows", async () => {
    const { templates, resource, logger } = createFixture();
    resource.failNext = true;

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
      kind: "document",
        resourceId: "doc-1",
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
        kind: "document",
        resourceId: "doc-1",
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
        kind: "document",
        resourceId: "doc-1",
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
          kind: "document",
        resourceId: "doc-1",
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
    const { templates, store, resource } = createFixture();
    resource.failNext = true;
    await assert.rejects(() => templates.command(registerCommand("req-1")));
    assert.equal(store.listUnpublishedTransactions().length, 0);

    await templates.command(registerCommand("req-2"));
    await templates.command(registerCommand("req-2"));
    assert.equal(store.listUnpublishedTransactions().length, 1);
  });

  await t.test("the catalog row, its receipt, and its transaction commit together", async () => {
    // The window that used to exist: the catalog row committed while the record
    // of having done so did not, so a retry re-ran the whole command and then
    // collided with the name it had written itself. create() takes all three
    // writes in one SQLite transaction, so a crash after it is fully replayable
    // and a crash during it leaves nothing.
    let crashAfterCreate = true;
    const { templates, store, resource } = createFixture({
      wrapStore: (real) =>
        new Proxy(real, {
          get(target, property, receiver) {
            if (property === "create" && crashAfterCreate) {
              return (commit: Parameters<TemplateStore["create"]>[0]) => {
                crashAfterCreate = false;
                target.create(commit);
                throw new Error("crash after commit, before the caller is answered");
              };
            }
            return Reflect.get(target, property, receiver);
          }
        })
    });

    await assert.rejects(() => templates.command(registerCommand("req-1")));
    assert.equal(store.list().items.length, 1, "the catalog row committed");
    assert.equal(store.getReceipt("req-1")?.commandType, "template.register",
      "and so did its receipt, in the same transaction");
    assert.equal(store.listUnpublishedTransactions().length, 1);

    // Same request. The receipt is what makes this a replay rather than a re-run.
    const resumed = await templates.command(registerCommand("req-1"));
    assert.equal(resumed.type, "template.registered");
    assert.equal(resource.duplicateCalls().length, 1, "no second backing copy");
    assert.equal(store.list().items.length, 1, "no duplicate catalog row");
    assert.equal(
      store.listUnpublishedTransactions().length,
      1,
      "one source transaction per request, not one per attempt"
    );
  });

  await t.test("a failed local commit leaves neither row nor receipt", async () => {
    const { templates, store } = createFixture({
      wrapStore: (real) =>
        new Proxy(real, {
          get(target, property, receiver) {
            if (property === "create") {
              return () => {
                throw new Error("disk full");
              };
            }
            return Reflect.get(target, property, receiver);
          }
        })
    });

    await assert.rejects(() => templates.command(registerCommand("req-1")));
    assert.equal(store.list().items.length, 0);
    assert.equal(store.getReceipt("req-1"), undefined);
    assert.equal(store.listUnpublishedTransactions().length, 0);
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
  assert.ok(tableNames.includes(tables.commandReceipts));
  assert.equal(tableNames.some((name) => name.endsWith("_activity_outbox")), false);
  assert.equal(tableNames.some((name) => name.endsWith("_command_claims")), false);

  const columns = (
    db.prepare(`PRAGMA table_info(${tables.transactionOutbox})`).all() as Array<{ name: string }>
  ).map(({ name }) => name);
  assert.ok(columns.includes("source_transaction_id"));
  assert.ok(columns.includes("transaction_kind"));
  assert.equal(columns.includes("fact_id"), false);

  // No reservation state on the record, and no CHECK tying the backing
  // resource's ID to the catalog ID — the owning capability names its own row.
  const templateColumns = (
    db.prepare(`PRAGMA table_info(${tables.templates})`).all() as Array<{ name: string }>
  ).map(({ name }) => name);
  assert.equal(templateColumns.includes("state"), false);
  const templateDdl = (db.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?"
  ).get(tables.templates) as { sql: string }).sql;
  assert.equal(templateDdl.includes("resource_id = id"), false);
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

// ─── Orphan collection ────────────────────────────────────────────────────────

test("Templates reaps sealed resources no catalog row claims", async (t) => {
  await t.test("an orphan past the grace period is purged", async () => {
    const { templates, resource, store } = createFixture();
    const registered = await templates.command(registerCommand("req-1"));
    const template = registered.type === "template.registered" ? registered.template : undefined;
    assert.ok(template);

    // The leak: a copy that got sealed and whose catalog row never landed.
    // Unreachable by any query, which is why a diff is the only way to see it.
    resource.seal("document-orphan-1", "2026-08-01T00:00:00.000Z");

    const reaped = await templates.collectOrphanedResources("2026-08-02T00:00:00.000Z");
    assert.equal(reaped, 1);
    assert.deepEqual(
      resource.calls.filter((call) => call.method === "purge")
        .map((call) => (call as { resourceId: string }).resourceId),
      ["document-orphan-1"]
    );
    // The claimed copy is untouched.
    assert.equal(store.get(template.id)?.resourceId, template.resourceId);
  });

  await t.test("a registration in flight is not an orphan", async () => {
    const { templates, resource } = createFixture();
    // Sealed just now, no catalog row yet — which is exactly what a healthy
    // registration looks like between markAsTemplate and the catalog write.
    resource.seal("document-inflight", "2026-08-02T00:00:30.000Z");

    const reaped = await templates.collectOrphanedResources("2026-08-02T00:00:00.000Z");
    assert.equal(reaped, 0, "the grace period is what tells them apart");
    assert.equal(resource.calls.filter((call) => call.method === "purge").length, 0);
  });

  await t.test("a deleted-but-unpurged template still owns its copy", async () => {
    const { templates, resource } = createFixture();
    const registered = await templates.command(registerCommand("req-1"));
    const template = registered.type === "template.registered" ? registered.template : undefined;
    assert.ok(template);
    await templates.command({
      requestId: "req-2",
      origin: "user",
      command: { type: "template.delete", templateId: template.id }
    });
    resource.calls.length = 0;

    // The live row is gone but history retains it, so the backing copy is still
    // claimed. Reaping it would destroy what the retention window promised.
    const reaped = await templates.collectOrphanedResources("2099-01-01T00:00:00.000Z");
    assert.equal(reaped, 0);
    assert.equal(resource.calls.filter((call) => call.method === "purge").length, 0);
  });

  await t.test("one failing purge does not stop the sweep", async () => {
    const { templates, resource } = createFixture();
    resource.seal("document-orphan-1", "2026-08-01T00:00:00.000Z");
    resource.seal("document-orphan-2", "2026-08-01T00:00:00.000Z");
    resource.failPurgeFor.add("document-orphan-1");

    const reaped = await templates.collectOrphanedResources("2026-08-02T00:00:00.000Z");
    // The orphans are independent, and a permanent failure on one would
    // otherwise wedge collection forever.
    assert.equal(reaped, 1);
    assert.deepEqual(
      resource.calls.filter((call) => call.method === "purge")
        .map((call) => (call as { resourceId: string }).resourceId).sort(),
      ["document-orphan-1", "document-orphan-2"]
    );
  });
});
