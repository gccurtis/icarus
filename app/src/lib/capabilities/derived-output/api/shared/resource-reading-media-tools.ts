import { Buffer } from "node:buffer";

import {
  intelligenceToolOutput,
  type IntelligenceTool
} from "$model/server/intelligence/index.server";
import type { ResourceReadingContext } from "$capabilities/derived-output/api/shared/resource-reading-context";
import { describedAgentTool } from "$capabilities/derived-output/api/shared/tool-catalog";
import { integer, record } from "$capabilities/derived-output/api/shared/resource-reading-values";

export const mediaReadingTools = (
  context: ResourceReadingContext
): IntelligenceTool[] => {
  const { input, materialFor, externalFile, nativeCitation, currentGeneration } = context;
  return [
    {
      ...describedAgentTool("read_code"),
      inputSchema: {
        type: "object",
        properties: {
          materialHandle: { type: "string" },
          fromLine: { type: "integer", minimum: 1 },
          toLine: { type: "integer", minimum: 1 }
        },
        required: ["materialHandle", "fromLine", "toLine"],
        additionalProperties: false
      },
      execute: async (value) => {
        const { held, material, snapshot } = materialFor(value);
        if (
          material.kind !== "code" ||
          material.profile.kind !== "code" ||
          material.source.kind !== "externalFile"
        ) {
          throw new Error("material is not code");
        }
        if (material.profile.lines === 0) throw new Error("code file contains no lines");
        const fromLine = integer(held.fromLine, "fromLine", 1, material.profile.lines);
        const toLine = integer(
          held.toLine,
          "toLine",
          fromLine,
          Math.min(material.profile.lines, fromLine + 499)
        );
        const file = externalFile(material.source.fileId);
        const bytes = await input.model.materialContent.read({
          storageId: file.storageId,
          hash: file.hash
        }, input.signal);
        input.signal?.throwIfAborted();
        if (bytes === undefined) throw new Error("code native content is unavailable");
        const text = new TextDecoder("utf-8", { fatal: true })
          .decode(bytes)
          .split(/\r?\n/)
          .slice(fromLine - 1, toLine)
          .join("\n");
        const selection = { kind: "code" as const, fromLine, toLine };
        const evidenceId = nativeCitation(["code", material._id, selection], {
          evidenceKind: "code",
          distance: 0,
          material: snapshot,
          selection,
          value: text,
          overlayGeneration: currentGeneration()
        });
        return { evidenceId, language: material.profile.language, fromLine, toLine, text };
      }
    },
    {
      ...describedAgentTool("read_image"),
      inputSchema: {
        type: "object",
        properties: {
          materialHandle: { type: "string" },
          crop: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" }
            },
            required: ["x", "y", "width", "height"],
            additionalProperties: false
          }
        },
        required: ["materialHandle"],
        additionalProperties: false
      },
      execute: async (value) => {
        const { held, material, snapshot } = materialFor(value);
        if (material.kind !== "image" || material.profile.kind !== "image") {
          throw new Error("material is not an image");
        }
        const crop =
          held.crop === undefined
            ? undefined
            : (() => {
                const candidate = record(held.crop, "crop must be an object");
                const numbers = [candidate.x, candidate.y, candidate.width, candidate.height];
                if (
                  numbers.some(
                    (entry) => typeof entry !== "number" || !Number.isFinite(entry as number)
                  )
                ) {
                  throw new Error("crop values must be finite numbers");
                }
                const bounds = {
                  x: candidate.x as number,
                  y: candidate.y as number,
                  width: candidate.width as number,
                  height: candidate.height as number
                };
                if (
                  bounds.x < 0 ||
                  bounds.y < 0 ||
                  bounds.width <= 0 ||
                  bounds.height <= 0
                ) {
                  throw new Error("crop must have a non-negative origin and positive dimensions");
                }
                if (
                  (material.profile.width !== undefined &&
                    bounds.x + bounds.width > material.profile.width) ||
                  (material.profile.height !== undefined &&
                    bounds.y + bounds.height > material.profile.height)
                ) {
                  throw new Error("crop exceeds the original image bounds");
                }
                return bounds;
              })();
        const source = material.profile.source;
        if (source.kind === "url") {
          throw new Error(
            "URL-backed images must be imported into content-addressed storage before they can be cited"
          );
        }
        if (source.kind === "storage") {
          throw new Error("storage image content requires the upload object-store adapter");
        }
        const file = externalFile(source.fileId);
        const bytes = await input.model.materialContent.read({
          storageId: file.storageId,
          hash: file.hash
        }, input.signal);
        input.signal?.throwIfAborted();
        if (bytes === undefined) throw new Error("image native content is unavailable");
        const image = {
          kind: "bytes" as const,
          base64: Buffer.from(bytes).toString("base64"),
          mediaType: file.mediaType
        };
        const selection = { kind: "image" as const, ...(crop === undefined ? {} : { crop }) };
        const visualValue = {
          assetHash: material.profile.assetHash,
          mediaType: material.profile.mediaType,
          crop: crop ?? null
        };
        const evidenceId = nativeCitation(["image", material._id, selection], {
          evidenceKind: "visual",
          distance: 1,
          material: snapshot,
          selection,
          value: visualValue,
          overlayGeneration: currentGeneration()
        });
        return intelligenceToolOutput({ evidenceId, ...visualValue }, [image]);
      }
    }
  ];
};
