import { describe, expect, it } from "vitest";

import { asId } from "$representation/data/behavior/core/id";
import type { PresentationBody } from "$representation/data/types/presentations/body";
import type { TemplateDetail } from "$capabilities/templates/index.remote";
import type { ProjectResourceIndex } from "$capabilities/project-resources/index.remote";
import {
  presentationTemplatesIn,
  insertionOf,
  resourcesIn
} from "$app-views/categories/presentation-editor/procedures/templating";

const externalIndex: ProjectResourceIndex = {
  resources: [{
    id: "externalFiles:source",
    ref: { kind: "externalFile::code", id: asId<"externalFiles">("externalFiles:source") },
    kind: "file",
    name: "source.ts",
    relativePath: "sources/source.ts",
    updatedAt: 1,
    updatedByName: "Icarus"
  }],
  unavailable: []
};

const text = (id: string, display: string) => ({
  id,
  type: "text" as const,
  variant: "paragraph" as const,
  atoms: [{ id: `${id}-a`, kind: "literal" as const, text: display }],
  display,
  marks: []
});

const presentation: PresentationBody = {
  aspectRatio: "16:9",
  theme: { colors: { text: "ink", accent: "blue" } },
  styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
  layouts: [{ id: "l-title", key: "title", name: "Title", locked: [], placeholders: [] }],
  slides: [
    { id: "s1", layoutKey: "title", elements: [], notes: [] },
    { id: "s2", elements: [], notes: [] }
  ],
  sections: []
};

const template = (slides: 1 | 2): TemplateDetail => ({
  id: "templates:5",
  name: "Board review",
  target: "presentation",
  availability: "personal",
  tags: [],
  createdByName: "Uma",
  revision: 1,
  updatedAt: 1,
  lastUsedAt: null,
  canEdit: true,
  canDelete: true,
  body: {
    resource: "presentation",
    aspectRatio: "16:9",
    theme: { colors: { text: "ink", accent: "red" } },
    styles: { defaultKey: "body", styles: { body: { name: "Body", fontSize: 20 }, caption: { name: "Caption" } } },
    layouts: [
      { id: "tl-title", key: "title", name: "Title (template)", locked: [], placeholders: [] },
      { id: "tl-brief", key: "brief", name: "Brief", locked: [], placeholders: [] }
    ],
    slides: [
      {
        id: "ts1",
        layoutKey: "brief",
        elements: [
          {
            id: "te1",
            frame: { x: 0.1, y: 0.1, width: 0.5, height: 0.2 },
            content: {
              type: "prompt",
              block: {
                id: "tp1",
                type: "prompt",
                atoms: [{ id: "tp1-a", kind: "literal", text: "Sum up" }],
                display: "Sum up",
                marks: [],
                scope: { include: [{ select: "hole", name: "evidence" }], exclude: [] },
                state: "idle"
              }
            }
          }
        ],
        notes: [text("tn1", "Say this")]
      },
      ...(slides === 2 ? [{ id: "ts2", layoutKey: "title", elements: [], notes: [] }] : [])
    ],
    sections: []
  },
  holes: [{ name: "evidence", label: "Evidence", kind: "scope", default: { include: [{ select: "project" }], exclude: [] } }]
});

describe("inserting a template into a presentation", () => {
  it("appends the slides after the current one with fresh ids, and brings what the presentation lacks", () => {
    const insertion = insertionOf(presentation, template(2), "s1", "resolve");
    const after = insertion.body;
    expect(after.slides.map((slide) => slide.id).slice(0, 1)).toEqual(["s1"]);
    expect(after.slides.length).toBe(4);
    expect(after.slides[1].id).toBe(insertion.firstSlideId);
    expect(after.slides[1].id.startsWith("slide-")).toBe(true);
    expect(after.slides[3].id).toBe("s2");
    expect(after.layouts.map((layout) => layout.key)).toEqual(["title", "brief"]);
    expect(after.layouts[0].name).toBe("Title");
    expect(after.slides[2].layoutKey).toBe("title");
    expect(Object.keys(after.styles.styles)).toEqual(["body", "caption"]);
    expect(after.styles.styles.body).toEqual({ name: "Body" });
    const element = after.slides[1].elements[0];
    expect(element.id.startsWith("el-")).toBe(true);
    if (element.content.type !== "prompt") throw new Error("prompt expected");
    expect(element.content.block.scope).toEqual({ include: [{ select: "project" }], exclude: [] });
    expect(after.slides[1].notes[0].id.startsWith("blk-")).toBe(true);
  });

  it("puts a one-slide template in, keeping hole terms for a stage", () => {
    const insertion = insertionOf(presentation, template(1), "s2", "keep");
    expect(insertion.body.slides.length).toBe(3);
    expect(insertion.body.slides[2].id).toBe(insertion.firstSlideId);
    const element = insertion.body.slides[2].elements[0];
    if (element.content.type !== "prompt") throw new Error("prompt expected");
    expect(element.content.block.scope).toEqual({ include: [{ select: "hole", name: "evidence" }], exclude: [] });
  });

  it("falls back to the end when the anchor is not in the presentation, and does nothing for a document", () => {
    const insertion = insertionOf(presentation, template(1), "gone", "resolve");
    expect(insertion.body.slides[2].id).toBe(insertion.firstSlideId);
    const nothing = insertionOf(presentation, { ...template(1), body: { resource: "document", rows: [] } }, null, "resolve");
    expect(nothing.ops).toEqual([]);
  });

  it("lists only presentation templates", () => {
    const library = {
      templates: [
        { ...template(2), id: "a", holeCount: 1 },
        { ...template(1), id: "b", target: "document" as const, holeCount: 1 }
      ],
      unavailable: []
    };
    expect(presentationTemplatesIn(library).map((item) => item.id)).toEqual(["a"]);
  });

  it("preserves the exact External subkind identity in slide template scope", () => {
    expect(resourcesIn(externalIndex)).toEqual([{
      kind: "externalFile::code",
      id: "externalFiles:source",
      name: "source.ts",
      relativePath: "sources/source.ts"
    }]);
  });
});
