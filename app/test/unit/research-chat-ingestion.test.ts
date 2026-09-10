import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

import { asId } from "$representation/data/behavior/core/id";
import { projectResource } from "$representation/data/behavior/semantic/projection/project-resource";
import type { SlideDeckBody, SlideElement } from "$representation/data/types/slide-decks/body";
import { validSlideTemplateBody } from "$capabilities/templates/api/shared/body-validation/slides";

type SeedDeck = { readonly _id: string; readonly projectId: string; readonly title: string };
type SeedSnapshot = {
  readonly projectId: string;
  readonly resourceId: string;
  readonly revision: number;
  readonly role: string;
  readonly body: SlideDeckBody;
};

const fixture = <Value>(name: string): Value =>
  JSON.parse(readFileSync(resolve(process.cwd(), "seed", name), "utf8")) as Value;

const authoredTextIn = (element: SlideElement): readonly string[] => {
  const content = element.content;
  if (content.type === "group") return content.children.flatMap(authoredTextIn);
  if (content.type === "text" || content.type === "formula" || content.type === "prompt") {
    return content.block.display.trim() === "" ? [] : [content.block.display];
  }
  if (content.type === "shape" && content.block !== undefined) {
    return content.block.display.trim() === "" ? [] : [content.block.display];
  }
  if (content.type === "table") {
    return content.block.rows.flatMap((row) =>
      row.cells.flatMap((cell) =>
        cell.blocks.flatMap((block) =>
          "display" in block && typeof block.display === "string" && block.display.trim() !== ""
            ? [block.display]
            : []
        )
      )
    );
  }
  return [];
};

describe("research-chat ingestion of the committed project", () => {
  test("every seeded deck uses the current schema and can enter both semantic lanes", () => {
    const decks = fixture<SeedDeck[]>("slideDecks.json");
    const titles = new Map(decks.map((deck) => [deck._id, deck.title]));
    const allSnapshots = fixture<SeedSnapshot[]>("slideDeckSnapshots.json");
    const snapshots = allSnapshots.filter(
      (snapshot) => snapshot.role === "leader"
    );

    expect(snapshots).toHaveLength(decks.length);
    for (const deck of decks) {
      expect(
        snapshots.filter(
          (snapshot) =>
            snapshot.resourceId === deck._id && snapshot.projectId === deck.projectId
        ),
        `${deck._id} must have exactly one same-project leader`
      ).toHaveLength(1);
    }
    let materialCount = 0;
    for (const snapshot of snapshots) {
      expect(titles.has(snapshot.resourceId), `${snapshot.resourceId} has no resource row`).toBe(true);
      expect(
        validSlideTemplateBody({ resource: "slides", ...snapshot.body }),
        `${snapshot.resourceId} fails exhaustive current slide-body admission`
      ).toBe(true);

      const projection = projectResource({
        kind: "slides",
        ref: {
          kind: "slides",
          id: asId<"slideDecks">(snapshot.resourceId)
        },
        revision: snapshot.revision,
        title: titles.get(snapshot.resourceId)!,
        body: snapshot.body
      });
      expect(projection.exact.ref).toEqual({ kind: "slides", id: snapshot.resourceId });
      const authored = [
        ...snapshot.body.layouts.flatMap((layout) => layout.locked),
        ...snapshot.body.slides.flatMap((slide) => slide.elements)
      ].flatMap(authoredTextIn);
      expect(authored.length, `${snapshot.resourceId} has no authored text`).toBeGreaterThan(0);
      expect(
        authored.some((text) => projection.exact.text.includes(text)),
        `${snapshot.resourceId} lost all authored text during projection`
      ).toBe(true);
      for (const material of projection.materials) {
        expect(material.identityKey).not.toBe("");
        expect(material.name).not.toBe("");
      }
      materialCount += projection.materials.length;
    }
    expect(materialCount).toBeGreaterThan(0);
  });

  test("the production slide-body predicate rejects an unknown element content type", () => {
    const snapshot = fixture<SeedSnapshot[]>("slideDeckSnapshots.json").find(
      (candidate) => candidate.role === "leader" && candidate.body.slides[0]?.elements[0] !== undefined
    );
    expect(snapshot).toBeDefined();
    const corrupted = structuredClone(snapshot!.body) as SlideDeckBody;
    corrupted.slides[0].elements[0].content = { type: "retired-blocks" } as never;

    expect(validSlideTemplateBody({ resource: "slides", ...corrupted })).toBe(false);
  });
});
