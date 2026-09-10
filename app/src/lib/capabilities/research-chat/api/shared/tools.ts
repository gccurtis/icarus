import type { IntelligenceTool } from "$model/server/intelligence/index.server";
import { resourceInScope } from "$representation/data/behavior/semantic/scope";
import { admittedReusableResourceSets } from "$representation/data/behavior/core/resource-set-rows";
import type {
  MaterialKind,
  MaterialSourceSnapshot
} from "$representation/data/types/semantic/material";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { ResearchSource } from "$representation/data/types/investigation/research-turn";
import type { MaterialHit } from "$representation/data/types/semantic/material";
import type { SemanticHit } from "$representation/data/types/semantic/index";
import {
  querySemanticMaterialsForModel,
  querySemanticOverlayForModel
} from "$capabilities/semantic-overlay";

import { readingTools } from "$capabilities/research-chat/api/shared/reading-tools";
import { researchResources } from "$capabilities/research-chat/api/shared/resource-catalogue";
import { rowsIn } from "$capabilities/research-chat/api/shared/store";
import {
  STOPPED,
  asRecord,
  askedQuery,
  chosen,
  type SessionInput,
  type ToolContext,
  type ToolSession
} from "$capabilities/research-chat/api/shared/tool-kit";

export type { ToolSession } from "$capabilities/research-chat/api/shared/tool-kit";

const MATERIAL_KINDS = ["table", "csv", "chart", "image", "code"] as const satisfies readonly MaterialKind[];

const isMaterialKind = (value: unknown): value is MaterialKind =>
  typeof value === "string" && MATERIAL_KINDS.some((kind) => kind === value);

const materialKindsOf = (value: unknown): MaterialKind[] | undefined => {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length > MATERIAL_KINDS.length ||
    value.some((kind) => !isMaterialKind(kind))
  ) {
    throw new Error("kinds must contain only current material kinds");
  }
  return [...value];
};

/**
 * What the chat can do, built for one turn.
 *
 * Retrieval and reading are not toggles: a chat that cannot read the project is
 * not a chat about the project. Only reach beyond it is a person's choice, and
 * that lives on the composer.
 */
export const createToolSession = (input: SessionInput): ToolSession => {
  const sources = new Map<string, ResearchSource>();
  const materials = new Map<string, MaterialSourceSnapshot>();
  const byKey = new Map<string, string>();
  const queries: string[] = [];
  const returned: number[] = [];
  let next = 1;

  const resources = researchResources(input.model, input.projectId);
  const names = new Map(
    resources.map((resource) => [
      `${resource.ref.kind}\u0000${resource.ref.id}`,
      resource.name
    ])
  );
  const nameOf = (ref: ResourceRef): string =>
    names.get(`${ref.kind}\u0000${ref.id}`) ?? `${ref.kind} ${ref.id}`;

  const issue = (
    key: string,
    draft: Omit<ResearchSource, "id" | "uses">
  ): string => {
    const held = byKey.get(key);
    if (held !== undefined) return held;
    const id = `s${next++}`;
    byKey.set(key, id);
    sources.set(id, { ...draft, id, uses: [] });
    return id;
  };

  const namedSets = admittedReusableResourceSets(
    rowsIn(input.model.store, "resourceSets"),
    input.projectId
  );

  /** Both gates, on every ref a tool touches: the turn's choice and the persona's. */
  const inScope = (ref: ResourceRef): boolean =>
    chosen(input.scope, ref) &&
    (input.bound === undefined ||
      resourceInScope(ref, input.bound, (id) => namedSets.get(id)?.set));

  /**
   * What retrieval is asked to search.
   *
   * The persona's set when it has one, narrowed to the chosen resource when one
   * was chosen. Every result is gated again on the way out, so a narrowing this
   * cannot express exactly is still enforced exactly.
   */
  const scoped: ResourceSet | undefined =
    input.scope.kind === "resource"
      ? {
          include: [{ select: "resources", refs: [input.scope.ref] }],
          exclude: input.bound?.exclude ?? []
        }
      : input.bound;

  const retrieve: IntelligenceTool = {
    name: "retrieve",
    description:
      "Search the project's written material and get back the passages that match, each with a source id you must cite. Call it more than once with different wording when the first answer is thin.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, maxLength: 2000 },
        topK: { type: "integer", minimum: 1, maximum: 20 }
      },
      required: ["query"],
      additionalProperties: false
    },
    execute: async (value) => {
      const asked = askedQuery(value, input.topK);
      if (!queries.includes(asked.query)) queries.push(asked.query);
      const result = await querySemanticOverlayForModel(
        input.model,
        input.projectId,
        {
          text: asked.query,
          topK: asked.topK,
          ...(scoped === undefined ? {} : { scope: scoped })
        },
        input.signal
      );
      const kept = result.hits.filter((hit: SemanticHit) => inScope(hit.source.ref));
      returned.push(kept.length);
      return {
        passages: kept
          .map((hit: SemanticHit) => {
            const sourceId = issue(
              JSON.stringify(["text", hit.source.ref, hit.span.from, hit.span.to]),
              {
                ref: hit.source.ref,
                title: nameOf(hit.source.ref),
                locator: `characters ${hit.span.from} to ${hit.span.to}`,
                excerpt: hit.span.text
              }
            );
            return {
              sourceId,
              resource: nameOf(hit.source.ref),
              kind: hit.source.ref.kind,
              from: hit.span.from,
              to: hit.span.to,
              text: hit.span.text,
              score: hit.score
            };
          })
      };
    }
  };

  const retrieveMaterials: IntelligenceTool = {
    name: "retrieve_materials",
    description:
      "Search the project's tables, charts, images, code and spreadsheets. What comes back describes them; it is not their exact contents.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, maxLength: 2000 },
        kinds: {
          type: "array",
          items: { type: "string", enum: ["table", "csv", "chart", "image", "code"] },
          maxItems: 5
        },
        topK: { type: "integer", minimum: 1, maximum: 20 }
      },
      required: ["query"],
      additionalProperties: false
    },
    execute: async (value) => {
      const asked = askedQuery(value, input.topK);
      const raw = asRecord(value, "the input must be an object");
      const kinds = materialKindsOf(raw.kinds);
      if (!queries.includes(asked.query)) queries.push(asked.query);
      const result = await querySemanticMaterialsForModel(
        input.model,
        input.projectId,
        {
          text: asked.query,
          topK: asked.topK,
          ...(kinds === undefined ? {} : { kinds }),
          ...(scoped === undefined ? {} : { scope: scoped })
        },
        input.signal
      );
      return {
        materials: result.hits
          .filter((hit: MaterialHit) => inScope(hit.material.source.ref))
          .map((hit: MaterialHit) => {
            const description = hit.description?.text ?? hit.profileFacet.text;
            const sourceId = issue(
              JSON.stringify(["material", hit.material.materialId, hit.material.revisionKey]),
              {
                ref: hit.material.source.ref,
                title: hit.material.name,
                locator: hit.material.kind,
                excerpt: description
              }
            );
            materials.set(hit.material.materialId, hit.material);
            return {
              sourceId,
              materialHandle: hit.material.materialId,
              name: hit.material.name,
              kind: hit.material.kind,
              resource: nameOf(hit.material.source.ref),
              describes: description,
              score: hit.score
            };
          })
      };
    }
  };

  const halted = (tool: IntelligenceTool): IntelligenceTool => ({
    ...tool,
    execute: async (value) => {
      input.signal?.throwIfAborted();
      if (input.stopping()) return STOPPED;
      const result = await tool.execute(value);
      input.signal?.throwIfAborted();
      return result;
    }
  });

  const context: ToolContext = { input, resources, materials, inScope, issue, nameOf, returned };

  const discovery = input.grants.includes("retrieve") ? [retrieve, retrieveMaterials] : [];
  const reading = input.grants.includes("resource.read") ? readingTools(context) : [];

  return {
    tools: [...discovery, ...reading].map(halted),
    queries,
    returned,
    sourceOf: (id) => sources.get(id),
    issued: () => [...sources.values()]
  };
};
