import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { StoreModel } from "$model/server/store/index.server";
import { asId } from "$representation/data/behavior/core/id";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";

import { validateCreateProjectResource } from "$capabilities/project-resources/api/create-project-resource/validate-create-project-resource";
import type { CreateProjectResourceResult } from "$capabilities/project-resources/types/project-resources";

/** A represented blank deck still needs somewhere to edit. */
const emptyDeck = (): SlideDeckBody => ({
  aspectRatio: "16:9",
  theme: {
    colors: {
      text: "--token-ink-primary",
      accent: "--token-color-accent-1-fill",
      muted: "--token-ink-muted"
    },
    fontFamily: "IBM Plex Sans"
  },
  styles: {
    defaultKey: "body",
    styles: { body: { name: "Body", fontFamily: "IBM Plex Sans" } }
  },
  layouts: [],
  slides: [{ id: `slide-${crypto.randomUUID()}`, elements: [], notes: [] }],
  sections: []
});

/** A document's first editable paragraph is represented, not a client-only projection. */
const emptyDocument = (): DocumentBody => ({
  rows: [
    {
      id: `row-${crypto.randomUUID()}`,
      kind: "blocks",
      blocks: [
        {
          id: `block-${crypto.randomUUID()}`,
          type: "text",
          variant: "paragraph",
          atoms: [{ id: `atom-${crypto.randomUUID()}`, kind: "literal", text: "" }],
          display: "",
          marks: []
        }
      ]
    }
  ]
});

const representedRows = (
  store: StoreModel,
  table: "documents" | "slideDecks"
): readonly unknown[] => {
  const found = store.read(table);
  return found?.kind === "table" && found.table === table && Array.isArray(found.rows)
    ? found.rows
    : [];
};

const recordOf = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

/** Choose the first free positive suffix from represented titles in this project. */
const defaultTitle = (
  store: StoreModel,
  projectId: string,
  target: "document" | "slides"
): string => {
  const table = target === "document" ? "documents" : "slideDecks";
  const noun = target === "document" ? "document" : "deck";
  const prefix = `Untitled ${noun} `;
  const taken = new Set(
    representedRows(store, table)
      .map(recordOf)
      .filter((row) => row?.projectId === projectId && typeof row.title === "string")
      .map((row) => row?.title as string)
  );

  // At most `taken.size` positive suffixes can be occupied, so one of these
  // `taken.size + 1` candidates must be free without an attacker-sized loop.
  for (let suffix = 1; suffix <= taken.size + 1; suffix += 1) {
    const title = `${prefix}${suffix}`;
    if (!taken.has(title)) return title;
  }
  throw new Error("project-resources/create: could not allocate an Untitled title");
};

/** Create an editor-ready blank resource without trusting identity fields from the browser. */
export const createProjectResource = async (input: unknown): Promise<CreateProjectResourceResult> => {
  const scope = await requireScope();
  const asked = validateCreateProjectResource(input);
  const store = serverModel().store;
  const projectId = asId<"projects">(scope.projectId);
  const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
  const at = Date.now();
  const title = asked.title ?? defaultTitle(store, projectId, asked.target);

  if (asked.target === "document") {
    const resourceId = store.create("documents", {
      projectId,
      title,
      createdBy: actor,
      updatedBy: { ...actor },
      updatedAt: at
    });
    store.create("documentSnapshots", {
      projectId,
      resourceId,
      revision: 0,
      role: "leader",
      part: 0,
      body: emptyDocument(),
      at
    });
    return { accepted: true, target: asked.target, resourceId, title, revision: 0 };
  }

  const resourceId = store.create("slideDecks", {
    projectId,
    title,
    createdBy: actor,
    updatedBy: { ...actor },
    updatedAt: at
  });
  store.create("slideDeckSnapshots", {
    projectId,
    resourceId,
    revision: 0,
    role: "leader",
    part: 0,
    body: emptyDeck(),
    at
  });
  return { accepted: true, target: asked.target, resourceId, title, revision: 0 };
};
