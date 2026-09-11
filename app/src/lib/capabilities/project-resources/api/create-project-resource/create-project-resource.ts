import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import {
  readCurrentRows,
  type StoreUnitOfWork
} from "$model/server/store/index.server";
import { asId } from "$representation/data/behavior/core/id";
import { emptyBody as emptySpreadsheet } from "$representation/data/behavior/spreadsheets/empty-sheet";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { PresentationBody } from "$representation/data/types/presentations/body";

import { validateCreateProjectResource } from "$capabilities/project-resources/api/create-project-resource/validate-create-project-resource";
import type { CreateProjectResourceResult } from "$capabilities/project-resources/types/project-resources";
import { enqueueSemanticOutboxFor } from "$capabilities/semantic-overlay/index";

/** A represented blank presentation still needs somewhere to edit. */
const emptyPresentation = (): PresentationBody => ({
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
  store: Pick<StoreUnitOfWork, "read">,
  table: "documents" | "presentations" | "spreadsheets"
): readonly unknown[] => {
  return readCurrentRows(store, table);
};

const recordOf = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

/** Choose the first free positive suffix from represented titles in this project. */
const defaultTitle = (
  store: Pick<StoreUnitOfWork, "read">,
  projectId: string,
  target: "document" | "presentation" | "spreadsheet"
): string => {
  const table =
    target === "document" ? "documents" : target === "presentation" ? "presentations" : "spreadsheets";
  const noun = target === "document" ? "document" : target === "presentation" ? "presentation" : "spreadsheet";
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
  const model = serverModel();
  const store = model.store;
  const projectId = asId<"projects">(scope.projectId);
  const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
  const at = Date.now();

  const created = await store.transaction((unit) => {
    const title = asked.title ?? defaultTitle(unit, projectId, asked.target);
    const fields = {
      projectId,
      title,
      createdBy: actor,
      updatedBy: { ...actor },
      updatedAt: at
    };

    if (asked.target === "document") {
      const resourceId = unit.create("documents", fields);
      unit.create("documentSnapshots", {
        projectId,
        resourceId,
        revision: 0,
        role: "leader",
        part: 0,
        body: emptyDocument(),
        at
      });
      enqueueSemanticOutboxFor(
        model,
        unit,
        projectId,
        { kind: "document", id: resourceId },
        0
      );
      return { accepted: true as const, target: asked.target, resourceId, title, revision: 0 as const };
    }

    if (asked.target === "presentation") {
      const resourceId = unit.create("presentations", fields);
      unit.create("presentationSnapshots", {
        projectId,
        resourceId,
        revision: 0,
        role: "leader",
        part: 0,
        body: emptyPresentation(),
        at
      });
      enqueueSemanticOutboxFor(
        model,
        unit,
        projectId,
        { kind: "presentation", id: resourceId },
        0
      );
      return { accepted: true as const, target: asked.target, resourceId, title, revision: 0 as const };
    }

    const resourceId = unit.create("spreadsheets", fields);
    unit.create("spreadsheetSnapshots", {
      projectId,
      resourceId,
      revision: 0,
      role: "leader",
      part: 0,
      body: emptySpreadsheet(),
      at
    });
    enqueueSemanticOutboxFor(
      model,
      unit,
      projectId,
      { kind: "spreadsheet", id: resourceId },
      0
    );
    return { accepted: true as const, target: asked.target, resourceId, title, revision: 0 as const };
  });
  return created;
};
