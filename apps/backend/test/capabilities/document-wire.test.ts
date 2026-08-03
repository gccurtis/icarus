import assert from "node:assert/strict";
import test from "node:test";
import { JobRegistry } from "../../src/0-utils/jobs/registry.js";
import {
  createDefaultDocumentStyles,
  DEFAULT_DOCUMENT_PAGE_LAYOUT,
} from "../../src/3-capabilities/document/application/createService.js";
import type { DocumentCapability } from "../../src/3-capabilities/document/application/documentService.js";
import { DocumentIdentityReuseError } from "../../src/3-capabilities/document/domain/errors.js";
import { decodeDocumentCommand } from "../../src/3-capabilities/document/wire/commandSchemas.js";
import {
  decodeDocumentOperation,
  decodeDocumentOperations,
  DOCUMENT_WIRE_LIMITS,
  DocumentWireError,
} from "../../src/3-capabilities/document/wire/operationSchemas.js";
import { decodeDocumentQuery } from "../../src/3-capabilities/document/wire/querySchemas.js";
import { registerDocumentEndpoints } from "../../src/4-job-wiring/document/registerDocumentEndpoints.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const validTextBlock = () => ({
  id: "block-1",
  kind: "text",
  styleId: "document-style-normal",
  content: {
    atoms: [{ id: "atom-1", kind: "text", text: "Hello" }],
    marks: [],
  },
});

const validRow = () => ({
  id: "row-1",
  blocks: [validTextBlock()],
  layout: {
    blockGapTwips: 0,
    marginBeforeTwips: 0,
    marginAfterTwips: 0,
    tracks: [{ blockId: "block-1", widthUnits: 1 }],
  },
});

const commandEnvelope = (command: unknown) => ({
  requestId: "request-1",
  origin: "interactive",
  command,
});

const submitEnvelope = (operations: unknown[]) => commandEnvelope({
  type: "document.submit",
  documentId: "document-1",
  expectedRevision: 0,
  operations,
});

const rejectsWire = (work: () => unknown, pattern?: RegExp): void => {
  assert.throws(work, (error) => {
    assert.ok(error instanceof DocumentWireError);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
};

test("strict command decoding accepts complete Page, Style, Row, Block, and Rich Text DTOs", () => {
  const createInput = commandEnvelope({
    type: "document.create",
    title: "Design",
    pageLayout: structuredClone(DEFAULT_DOCUMENT_PAGE_LAYOUT),
    styles: createDefaultDocumentStyles(),
  });
  const created = decodeDocumentCommand(createInput);
  assert.equal(created.command.type, "document.create");

  const rowOperation = { type: "row.insert", row: validRow() };
  const richTextOperation = {
    type: "rich-text.apply",
    blockId: "block-1",
    operations: [{
      type: "replace-range-with-atom",
      range: {
        start: { atomId: "atom-1", offset: 0 },
        end: { atomId: "atom-1", offset: 5 },
      },
      expectedText: "Hello",
      atom: {
        id: "formula-1",
        kind: "formula",
        expression: "1 + 1",
        acceptedValue: { kind: "number", numerator: "2", denominator: "1" },
        displayText: "2",
      },
    }],
  };
  const submitted = decodeDocumentCommand(submitEnvelope([rowOperation, richTextOperation]));
  assert.equal(submitted.command.type, "document.submit");
  if (submitted.command.type === "document.submit") {
    assert.equal(submitted.command.operations.length, 2);
  }

  (createInput.command as { pageLayout: { page: { widthTwips: number } } }).pageLayout.page.widthTwips = 1;
  if (created.command.type === "document.create") {
    assert.equal(created.command.pageLayout?.page.widthTwips, DEFAULT_DOCUMENT_PAGE_LAYOUT.page.widthTwips);
  }
});

test("document.create refuses a caller-supplied documentId", () => {
  // The service allocates the id. Accepting one here would let a caller name a
  // resource that does not exist yet, and silently ignoring it would be worse —
  // the caller would believe it chose the id.
  rejectsWire(
    () => decodeDocumentCommand(commandEnvelope({
      type: "document.create",
      documentId: "caller-chosen",
      title: "Design",
    })),
    /unknown fields: documentId/,
  );
});

test("unknown fields are rejected at every nested Document boundary", () => {
  const cases: Array<[unknown, RegExp]> = [
    [{
      type: "block.insert",
      block: validTextBlock(),
      placement: { kind: "new-row", rowId: "row-1", surprise: true },
    }, /placement contains unknown fields: surprise/],
    [{
      type: "style.create",
      style: {
        id: "style-1",
        name: "Style",
        text: { fontWeight: 600, surprise: true },
        block: {},
      },
    }, /text contains unknown fields: surprise/],
    [{
      type: "row.insert",
      row: {
        ...validRow(),
        layout: {
          ...validRow().layout,
          tracks: [{ blockId: "block-1", widthUnits: 1, surprise: true }],
        },
      },
    }, /tracks\[0\] contains unknown fields: surprise/],
    [{
      type: "block.insert",
      block: {
        ...validTextBlock(),
        content: {
          atoms: [{ id: "atom-1", kind: "text", text: "Hello", surprise: true }],
          marks: [],
        },
      },
      placement: { kind: "new-row", rowId: "row-1" },
    }, /atoms\[0\] contains unknown fields: surprise/],
    [{
      type: "rich-text.apply",
      blockId: "block-1",
      operations: [{
        type: "insert-text",
        at: { atomId: "atom-1", offset: 0, surprise: true },
        text: "x",
      }],
    }, /at contains unknown fields: surprise/],
    [{
      type: "visual.set-dimensions",
      blockId: "image-1",
      dimensions: {
        heightTwips: 100,
        lockAspectRatio: true,
        horizontalAlign: "center",
        surprise: true,
      },
    }, /dimensions contains unknown fields: surprise/],
  ];

  for (const [value, pattern] of cases) rejectsWire(() => decodeDocumentOperation(value), pattern);

  rejectsWire(() => decodeDocumentCommand(commandEnvelope({
    type: "prompt.create.request",
    documentId: "document-1",
    expectedRevision: 0,
    blockId: "prompt-1",
    styleId: "document-style-normal",
    placement: { kind: "new-row", rowId: "prompt-row" },
    prompt: "Question?",
    context: { kind: "direct", target: { id: "resource-1", kind: "document", surprise: true } },
    stabilisationText: "",
  })), /context.target contains unknown fields: surprise/);
});

test("missing fields, invalid discriminants, wrong primitive types, and non-finite numbers are rejected", () => {
  const cases: Array<[unknown, RegExp]> = [
    [{ type: "document.rename" }, /title must be/],
    [{ type: "document.set-lifecycle", lifecycle: "deleted" }, /lifecycle must be one of/],
    [{ type: "not-an-operation" }, /Unknown Document operation/],
    [{
      type: "block.move",
      blockId: "block-1",
      placement: { kind: "in-row" },
    }, /rowId must be/],
    [{
      type: "block.insert",
      block: { ...validTextBlock(), kind: "video" },
      placement: { kind: "new-row", rowId: "row-1" },
    }, /block.kind must be one of/],
    [{
      type: "list.set-checked",
      listId: "list-1",
      itemId: "item-1",
      checked: "yes",
    }, /checked must be a boolean/],
    [{
      type: "table.insert-column",
      tableId: "table-1",
      column: { id: "column-1", width: { kind: "percentage", twips: 100 } },
      cells: [],
    }, /width.kind must be one of/],
    [{
      type: "visual.set-dimensions",
      blockId: "image-1",
      dimensions: { heightTwips: 0, lockAspectRatio: true, horizontalAlign: "center" },
    }, /heightTwips must be a positive integer/],
    [{
      type: "style.create",
      style: { id: "style-1", name: "Style", text: { fontSize: Number.NaN }, block: {} },
    }, /fontSize must be finite/],
  ];
  for (const [value, pattern] of cases) rejectsWire(() => decodeDocumentOperation(value), pattern);

  rejectsWire(() => decodeDocumentCommand(commandEnvelope({
    type: "document.submit",
    documentId: "document-1",
    expectedRevision: 1.5,
    operations: [{ type: "document.rename", title: "Next" }],
  })), /expectedRevision must be an integer/);
  rejectsWire(() => decodeDocumentCommand(commandEnvelope({
    type: "prompt.update-definition",
    documentId: "document-1",
    promptBlockId: "prompt-1",
    expectedDefinitionRevision: 1,
    prompt: "Question?",
  })), /stabilisationText must be a string/);
  rejectsWire(() => decodeDocumentQuery({
    requestId: "request-1",
    query: { type: "document.list", lifecycle: 42 },
  }), /lifecycle must be one of/);
});

test("malformed Page, Style, Row, List, Table, Image, and Chart values are rejected", () => {
  const malformedCreate = (
    field: "pageLayout" | "styles",
    value: unknown,
  ) => decodeDocumentCommand(commandEnvelope({
    type: "document.create",
    title: "Design",
    [field]: value,
  }));

  rejectsWire(() => malformedCreate("pageLayout", {
    page: { widthTwips: 100, heightTwips: 200, orientation: "square" },
    margins: { topTwips: 0, rightTwips: 0, bottomTwips: 0, leftTwips: 0 },
    pageNumber: { start: 1, format: "decimal" },
  }), /orientation must be one of/);
  const styles = createDefaultDocumentStyles() as unknown as {
    defaultStyleIdByBlockKind: Record<string, string>;
    styles: Array<Record<string, unknown>>;
  };
  delete styles.defaultStyleIdByBlockKind.chart;
  rejectsWire(() => malformedCreate("styles", styles), /defaultStyleIdByBlockKind.chart must be/);

  rejectsWire(() => decodeDocumentOperation({
    type: "row.insert",
    row: { ...validRow(), blocks: [] },
  }), /blocks must not be empty/);
  rejectsWire(() => decodeDocumentOperation({
    type: "list.insert-item",
    listId: "list-1",
    item: { id: "item-1", rows: [], children: [] },
  }), /item.rows must not be empty/);
  rejectsWire(() => decodeDocumentOperation({
    type: "table.insert-row",
    tableId: "table-1",
    row: { id: "row-1", header: "no" },
    cells: [],
  }), /header must be a boolean/);
  rejectsWire(() => decodeDocumentOperation({
    type: "block.insert",
    block: {
      id: "image-1",
      kind: "image",
      styleId: "document-style-visual",
      image: {
        source: { fileId: "file-1", version: "v1", digest: "digest", mimeType: "image/png" },
        dimensions: { heightTwips: 100, lockAspectRatio: true, horizontalAlign: "center" },
        alt: "Image",
        decorative: false,
        crop: { left: 0, top: 0, right: 1.5, bottom: 1 },
        fit: "contain",
      },
    },
    placement: { kind: "new-row", rowId: "row-1" },
  }), /crop.right must be between 0 and 1/);
  rejectsWire(() => decodeDocumentOperation({
    type: "block.insert",
    block: {
      id: "chart-1",
      kind: "chart",
      styleId: "document-style-visual",
      chart: {
        source: "remote",
        specification: {},
        dimensions: { heightTwips: 100, lockAspectRatio: false, horizontalAlign: "stretch" },
        alt: "Chart",
      },
    },
    placement: { kind: "new-row", rowId: "row-1" },
  }), /chart.source must be one of/);
});

test("malformed Rich Text content, operations, marks, Formula values, and diagnostics are rejected", () => {
  const richOperation = (operation: unknown) => decodeDocumentOperation({
    type: "rich-text.apply",
    blockId: "block-1",
    operations: [operation],
  });

  rejectsWire(() => richOperation({ type: "unknown-rich-operation" }), /Unknown Rich Text operation/);
  rejectsWire(() => richOperation({
    type: "insert-text",
    at: { atomId: "atom-1" },
    text: "x",
  }), /offset must be an integer/);
  rejectsWire(() => richOperation({
    type: "add-mark",
    mark: {
      id: "mark-1",
      kind: "rainbow",
      range: {
        start: { atomId: "atom-1", offset: 0 },
        end: { atomId: "atom-1", offset: 1 },
      },
    },
  }), /mark.kind must be one of/);
  rejectsWire(() => richOperation({
    type: "replace-content",
    content: { atoms: [], marks: [] },
  }), /atoms must not be empty/);
  rejectsWire(() => richOperation({
    type: "apply-formula-result",
    atomId: "formula-1",
    value: { kind: "number", numerator: "1", denominator: "0" },
    displayText: "invalid",
  }), /denominator must be a positive integer string/);
  rejectsWire(() => richOperation({
    type: "apply-formula-settlement",
    atomId: "formula-1",
    settlement: {
      displayText: "invalid",
      diagnostic: {
        code: "parse_error",
        message: "Invalid",
        sourceRange: { start: 5, end: 2 },
      },
    },
  }), /sourceRange.end must not precede start/);
});

test("wire budgets reject excessive operation counts, nesting, strings, and total payload bytes", () => {
  const rename = { type: "document.rename", title: "x" };
  rejectsWire(
    () => decodeDocumentOperations(Array.from({ length: DOCUMENT_WIRE_LIMITS.maxOperations + 1 }, () => rename)),
    /operation limit/,
  );
  rejectsWire(() => decodeDocumentCommand(commandEnvelope({
    type: "document.create",
    title: "x".repeat(DOCUMENT_WIRE_LIMITS.maxStringBytes + 1),
  })), /string size limit/);

  let nested: Record<string, unknown> = {};
  for (let depth = 0; depth < DOCUMENT_WIRE_LIMITS.maxDepth + 2; depth += 1) nested = { child: nested };
  rejectsWire(() => decodeDocumentOperation({
    type: "block.insert",
    block: {
      id: "chart-1",
      kind: "chart",
      styleId: "document-style-visual",
      chart: {
        source: "literal",
        specification: nested,
        dimensions: { heightTwips: 100, lockAspectRatio: false, horizontalAlign: "stretch" },
        alt: "Chart",
      },
    },
    placement: { kind: "new-row", rowId: "row-1" },
  }), /nesting limit/);

  const chunk = "x".repeat(220_000);
  rejectsWire(() => decodeDocumentOperation({
    type: "block.insert",
    block: {
      id: "chart-1",
      kind: "chart",
      styleId: "document-style-visual",
      chart: {
        source: "literal",
        specification: { chunks: [chunk, chunk, chunk, chunk, chunk] },
        dimensions: { heightTwips: 100, lockAspectRatio: false, horizontalAlign: "stretch" },
        alt: "Chart",
      },
    },
    placement: { kind: "new-row", rowId: "row-1" },
  }), /payload size limit/);
});

test("Document endpoints return 400 and never dispatch malformed DTOs to the capability", async () => {
  const registry = new JobRegistry();
  const logger = new CapturingLogger();
  let commandCalls = 0;
  let queryCalls = 0;
  const document = {
    command: async () => {
      commandCalls += 1;
      throw new Error("malformed command reached capability");
    },
    query: async () => {
      queryCalls += 1;
      throw new Error("malformed query reached capability");
    },
  } as unknown as DocumentCapability;
  registerDocumentEndpoints(registry, document, logger);

  const request = (path: string, body: unknown) => ({
    method: "POST",
    path,
    requestId: "transport-request",
    params: {},
    query: {},
    headers: {},
    body,
  });
  const commandJob = registry.createJob(request("/documents/command", submitEnvelope([{
    type: "block.move",
    blockId: "block-1",
    placement: { kind: "in-row", rowId: "row-1", unknown: true },
  }])));
  const commandResponse = await commandJob.work();
  assert.equal(commandResponse.statusCode, 400);
  assert.deepEqual(commandResponse.body, {
    error: "validation_error",
    message: "block.move.placement contains unknown fields: unknown",
  });

  const queryJob = registry.createJob(request("/documents/query", {
    requestId: "request-1",
    query: { type: "document.load", documentId: "document-1", unknown: true },
  }));
  const queryResponse = await queryJob.work();
  assert.equal(queryResponse.statusCode, 400);
  assert.equal(commandCalls, 0);
  assert.equal(queryCalls, 0);
});

test("Document endpoints expose identity reuse as a typed 400 domain response", async () => {
  const registry = new JobRegistry();
  const logger = new CapturingLogger();
  const document = {
    command: async () => {
      throw new DocumentIdentityReuseError(
        "document-1",
        "retired-block",
        "block",
        "block"
      );
    },
    query: async () => {
      throw new Error("query is not used");
    },
  } as unknown as DocumentCapability;
  registerDocumentEndpoints(registry, document, logger);

  const job = registry.createJob({
    method: "POST",
    path: "/documents/command",
    requestId: "transport-request",
    params: {},
    query: {},
    headers: {},
    body: commandEnvelope({
      type: "document.create",
      title: "Document",
    }),
  });
  const response = await job.work();
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    error: "identity_reuse",
    message: "Document identity cannot be reused: retired-block",
  });
});
