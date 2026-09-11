import { describe, expect, it } from "vitest";
import {
  isStoredTemplate,
  isStoredTemplateVersion
} from "$representation/data/behavior/templates/stored-rows";
import { isStoredTemplateStage } from "$representation/data/behavior/templates/stored-stage";

const body = () => ({ resource: "document", rows: [] });
const holes = () => [{
  name: "scope",
  label: "Scope",
  kind: "scope",
  default: { include: [{ select: "project" }], exclude: [] }
}];

const template = () => ({
  _id: "templates:1",
  _creationTime: 1,
  projectId: "default",
  userId: "default-user",
  name: "Memo",
  tags: ["Operations"],
  body: body(),
  holes: holes(),
  createdBy: { kind: "user", userId: "users:1" },
  revision: 1,
  updatedAt: 2
});

const version = () => ({
  _id: "templateVersions:1",
  _creationTime: 1,
  templateId: "templates:1",
  revision: 1,
  name: "Memo",
  tags: ["Operations"],
  body: body(),
  holes: holes(),
  at: 2
});

const stage = () => ({
  _id: "templateStages:1",
  _creationTime: 1,
  projectId: "default",
  templateId: "templates:1",
  templateRevision: 1,
  target: "document",
  resourceId: "documents:1",
  createdBy: { kind: "user", userId: "users:1" },
  updatedAt: 2
});

describe("current template storage", () => {
  it("admits exact live, historical, and staged rows", () => {
    expect(isStoredTemplate(template())).toBe(true);
    expect(isStoredTemplateVersion(version())).toBe(true);
    expect(isStoredTemplateStage(stage())).toBe(true);
  });

  it("rejects retired row fields and malformed nested holes whole", () => {
    expect(isStoredTemplateVersion({ ...version(), createdBy: template().createdBy })).toBe(false);
    expect(isStoredTemplate({
      ...template(),
      holes: [{ ...holes()[0], placement: "old" }]
    })).toBe(false);
    expect(isStoredTemplate({ ...template(), body: { ...body(), oldRows: [] } })).toBe(false);
    expect(isStoredTemplateStage({ ...stage(), templateRevision: 0 })).toBe(false);
  });

  it("admits only canonical metadata emitted by the current writers", () => {
    expect(isStoredTemplate({ ...template(), name: " Memo" })).toBe(false);
    expect(isStoredTemplate({ ...template(), name: "M".repeat(161) })).toBe(false);
    expect(isStoredTemplate({ ...template(), description: " summary " })).toBe(false);
    expect(isStoredTemplate({ ...template(), tags: ["Operations", "operations"] })).toBe(false);
    expect(isStoredTemplate({ ...template(), tags: [" operations"] })).toBe(false);
    expect(isStoredTemplate({ ...template(), tags: ["x".repeat(81)] })).toBe(false);
    expect(isStoredTemplate({
      ...template(),
      tags: Array.from({ length: 51 }, (_, index) => `tag-${index}`)
    })).toBe(false);
  });

  it("rejects bound bodies, incoherent stages, and coerced discriminators", () => {
    expect(isStoredTemplate({
      ...template(),
      body: {
        resource: "document",
        rows: [{
          id: "row-1",
          kind: "blocks",
          blocks: [{
            id: "block-1",
            type: "formula",
            expression: "=1",
            formulaId: "formulas:1",
            display: "1",
            value: { kind: "number", value: 1 },
            state: "fresh"
          }]
        }]
      }
    })).toBe(false);
    expect(isStoredTemplateStage({ ...stage(), resourceId: "presentations:1" })).toBe(false);
    expect(isStoredTemplate({ ...template(), body: { ...body(), resource: { toString: () => "document" } } })).toBe(false);
  });

  it("admits the current spreadsheet template body and rejects partial cells", () => {
    const sheet = {
      resource: "spreadsheet",
      cells: { A1: { value: { kind: "number", value: 1 } } },
      formatRules: [],
      print: {
        page: {
          paper: "letter",
          orientation: "portrait",
          margins: { top: 1, right: 1, bottom: 1, left: 1 }
        }
      },
      styles: { defaultKey: "body", styles: { body: { name: "Body" } } }
    };
    expect(isStoredTemplate({ ...template(), body: sheet })).toBe(true);
    expect(isStoredTemplate({
      ...template(),
      body: { ...sheet, cells: { A1: { value: { kind: "number" } } } }
    })).toBe(false);
  });
});
