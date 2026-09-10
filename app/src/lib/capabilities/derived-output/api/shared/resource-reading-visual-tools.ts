import { Buffer } from "node:buffer";
import { admitResourceRef } from "$representation/data/behavior/core/resource";

import {
  intelligenceToolOutput,
  type IntelligenceTool
} from "$model/server/intelligence/index.server";
import type { ResourceReadingContext } from "$capabilities/derived-output/api/shared/resource-reading-context";
import { describedAgentTool } from "$capabilities/derived-output/api/shared/tool-catalog";
import {
  canvasSize,
  escaped,
  placedElements,
  record,
  schematicCoordinate,
  text
} from "$capabilities/derived-output/api/shared/resource-reading-values";

export const visualReadingTools = (
  context: ResourceReadingContext
): IntelligenceTool[] => [
  {
    ...describedAgentTool("view_slide"),
    inputSchema: {
      type: "object",
      properties: { resourceId: { type: "string" }, slideId: { type: "string" } },
      required: ["resourceId", "slideId"],
      additionalProperties: false
    },
    execute: async (value) => {
      const held = record(value, "view_slide input must be an object");
      const ref = admitResourceRef(
        { kind: "slides", id: text(held.resourceId, "resourceId") },
        "slide-deck resource"
      );
      if (!context.allowed(ref)) {
        throw new Error("slide is outside the Derived Output Resource Set");
      }
      const slideId = text(held.slideId, "slideId");
      const { body } = context.slideDeck(ref);
      const slide = body.slides.find((candidate) => candidate.id === slideId);
      if (slide === undefined) throw new Error("slide does not exist");
      const { width, height } = canvasSize(body.aspectRatio);
      const render = (placed: ReturnType<typeof placedElements>): string =>
        placed
          .map(({ element, frame }) => {
            const label =
              element.content.type === "text" || element.content.type === "formula"
                ? element.content.block.display
                : element.content.type === "prompt"
                  ? "[Generated Prompt Block omitted]"
                  : element.content.type === "shape"
                    ? element.content.block?.display ?? element.content.shape
                    : element.content.type;
            const pixels = {
              x: schematicCoordinate(frame.x * width),
              y: schematicCoordinate(frame.y * height),
              width: schematicCoordinate(frame.width * width),
              height: schematicCoordinate(frame.height * height)
            };
            const transform =
              element.rotation === undefined
                ? ""
                : ` transform="rotate(${element.rotation} ${pixels.x + pixels.width / 2} ${pixels.y + pixels.height / 2})"`;
            return `<g${transform}><rect x="${pixels.x}" y="${pixels.y}" width="${pixels.width}" height="${pixels.height}" fill="white" fill-opacity="0.04" stroke="white" stroke-opacity="0.35"/><text x="${pixels.x + 8}" y="${pixels.y + 24}" fill="white" font-size="18">${escaped(label.slice(0, 180))}</text></g>`;
          })
          .join("");
      const elements = render(placedElements(slide.elements));
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#172036"/>${elements}</svg>`;
      return intelligenceToolOutput(
        { slideId, viewKind: "schematic", supportingContext: true },
        [
          {
            kind: "bytes",
            base64: Buffer.from(svg).toString("base64"),
            mediaType: "image/svg+xml"
          }
        ]
      );
    }
  }
];
