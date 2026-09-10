import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
import { ensureSlideDeckReady } from "$representation/data/behavior/slide-decks/readiness";
import type { TemplateBody } from "$representation/data/types/templates/template";
import type { Id } from "$representation/data/types/core/id";

import { enqueueSemanticOutboxFor } from "$capabilities/semantic-overlay/index";
import { materializeSpreadsheet } from "$capabilities/templates/api/shared/bodies";
import type { InstantiateTemplateResult } from "$capabilities/templates/types/templates";

type AcceptedPlacement = Extract<InstantiateTemplateResult, { accepted: true }>;

type WriteTemplateResourceInput = {
  readonly model: ServerModel;
  readonly unit: StoreUnitOfWork;
  readonly projectId: Id<"projects">;
  readonly resourceId: string;
  readonly templateId: Id<"templates">;
  readonly templateRevision: number;
  readonly body: TemplateBody;
  readonly at: number;
};

/** Writes the one resource-specific initial revision inside the placement transaction. */
export const writeTemplateResource = ({
  model,
  unit,
  projectId,
  resourceId,
  templateId,
  templateRevision,
  body,
  at
}: WriteTemplateResourceInput): AcceptedPlacement => {
  if (body.resource === "document") {
    const { resource: _resource, ...documentBody } = body;
    unit.create("documentSnapshots", {
      projectId,
      resourceId,
      revision: 0,
      role: "leader",
      part: 0,
      body: documentBody,
      at
    });
    enqueueSemanticOutboxFor(
      model,
      unit,
      projectId,
      { kind: "document", id: asId<"documents">(resourceId) },
      0
    );
    return {
      accepted: true,
      templateId,
      templateRevision,
      target: body.resource,
      resourceId,
      revision: 0
    };
  }

  if (body.resource === "slides") {
    const { resource: _resource, ...slideDeckBody } = body;
    unit.create("slideDeckSnapshots", {
      projectId,
      resourceId,
      revision: 0,
      role: "leader",
      part: 0,
      body: ensureSlideDeckReady(slideDeckBody),
      at
    });
    enqueueSemanticOutboxFor(
      model,
      unit,
      projectId,
      { kind: "slides", id: asId<"slideDecks">(resourceId) },
      0
    );
    return {
      accepted: true,
      templateId,
      templateRevision,
      target: body.resource,
      resourceId,
      revision: 0
    };
  }

  const materialized = materializeSpreadsheet(body);
  unit.create("spreadsheetSnapshots", {
    projectId,
    resourceId,
    revision: 0,
    role: "leader",
    part: 0,
    body: materialized.body,
    at
  });
  unit.createMany(
    "sheetCells",
    materialized.cells.map((cell) => ({ projectId, resourceId, ...cell }))
  );
  enqueueSemanticOutboxFor(
    model,
    unit,
    projectId,
    { kind: "spreadsheet", id: asId<"spreadsheets">(resourceId) },
    0
  );
  return {
    accepted: true,
    templateId,
    templateRevision,
    target: body.resource,
    resourceId,
    revision: 0
  };
};
