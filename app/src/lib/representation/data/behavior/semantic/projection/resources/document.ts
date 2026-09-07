import type {
  ContentBlock,
  ImageBlock,
  TableBlock
} from "$representation/data/types/content/content-block";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import type {
  MaterialAuthoredContext,
  MaterialLocator,
  MaterialSeed,
  MaterialSource
} from "$representation/data/types/semantic/material";
import type { SemanticLocator } from "$representation/data/types/semantic/source";
import { profileImage, profileTable } from "$representation/data/behavior/semantic/materials/profile";
import {
  authoredImageText,
  exactAuthoredTexts
} from "$representation/data/behavior/semantic/projection/shared";
import type { ExternalFileLookup } from "$representation/data/behavior/semantic/projection/contract";
import type { ProjectionWriter } from "$representation/data/behavior/semantic/projection/writer";
import type { ResourceRef } from "$representation/data/types/core/resource";

type DocumentArea = Extract<SemanticLocator, { kind: "documentBlock" }>["area"];

type State = {
  ref: ResourceRef;
  revision: number;
  title: string;
  externalFile?: ExternalFileLookup;
  output: ProjectionWriter;
  materials: MaterialSeed[];
  materialNumber: number;
  nearby: string[];
};

const boundedContext = (state: State, extra: Partial<MaterialAuthoredContext> = {}): MaterialAuthoredContext => ({
  ...extra,
  nearbyText: state.nearby.slice(0, 8),
  notes: []
});

const imageSource = (
  state: State,
  block: ImageBlock,
  locator: MaterialLocator
): { source: MaterialSource; identityKey: string; hash: string; mediaType?: string; name?: string } => {
  if (block.source?.kind === "file") {
    const file = state.externalFile?.(block.source.fileId);
    if (file !== undefined) {
      return {
        source: {
          kind: "externalFile",
          ref: { kind: "externalFile::image", id: file.fileId },
          fileId: file.fileId,
          hash: file.hash,
          mediaType: file.mediaType,
          subkind: file.subkind
        },
        identityKey: JSON.stringify(["image", file.fileId, file.hash]),
        hash: file.hash,
        mediaType: file.mediaType,
        name: file.name
      };
    }
  }
  const source: MaterialSource = {
    kind: "resourceContent",
    ref: state.ref,
    revision: state.revision,
    locator
  };
  const hash = JSON.stringify(block.source ?? [state.ref, locator]);
  return {
    source,
    identityKey: JSON.stringify(["image", state.ref, locator, hash]),
    hash
  };
};

const addImage = (state: State, block: ImageBlock, locator: MaterialLocator): void => {
  if (block.source === undefined) return;
  state.materialNumber += 1;
  const found = imageSource(state, block, locator);
  const authored = authoredImageText(block);
  const name = found.name ?? authored[1] ?? authored[0] ?? `Image ${state.materialNumber}`;
  state.materials.push({
    identityKey: found.identityKey,
    kind: "image",
    name: name.slice(0, 240),
    source: found.source,
    placement: { ref: state.ref, revision: state.revision, locator },
    profile: profileImage(block, found.hash, 1, found.mediaType),
    context: boundedContext(state, {
      ...(block.alt.trim() ? { alt: block.alt.trim() } : {}),
      ...(authored[1] ? { caption: authored[1] } : {}),
      title: state.title
    }),
    ...(block.source?.kind === "url" ? { nativeImage: { kind: "url" as const, url: block.source.url } } : {})
  });
};

const addTable = (state: State, block: TableBlock, locator: MaterialLocator): void => {
  state.materialNumber += 1;
  const profile = profileTable(block);
  const headerName = profile.headers.filter(Boolean).slice(0, 2).join(" / ");
  state.materials.push({
    identityKey: JSON.stringify(["table", state.ref, locator]),
    kind: "table",
    name: (headerName || `Table ${state.materialNumber}`).slice(0, 240),
    source: { kind: "resourceContent", ref: state.ref, revision: state.revision, locator },
    placement: { ref: state.ref, revision: state.revision, locator },
    profile,
    context: boundedContext(state, { title: state.title })
  });
};

const appendExactBlock = (
  state: State,
  block: ContentBlock,
  locator: Extract<SemanticLocator, { kind: "documentBlock" }>
): void => {
  if (block.type === "prompt") return;
  if (block.type === "text" || block.type === "formula") {
    state.output.append(block.display, locator);
    return;
  }
  if (block.type === "image") {
    for (const text of authoredImageText(block)) state.output.append(text, locator);
    return;
  }
  for (const row of block.rows.slice(0, block.headerRows)) {
    for (const cell of row.cells) {
      for (const child of cell.blocks) {
        appendExactBlock(state, child, {
          ...locator,
          blockPath: [...locator.blockPath, row.id, cell.id, child.id]
        });
      }
    }
  }
};

const addNestedMaterials = (
  state: State,
  block: ContentBlock,
  locator: Extract<MaterialLocator, { kind: "documentBlock" }>
): void => {
  if (block.type === "image") {
    addImage(state, block, locator);
    return;
  }
  if (block.type !== "table") return;
  addTable(state, block, locator);
  for (const row of block.rows) {
    for (const cell of row.cells) {
      for (const child of cell.blocks) {
        addNestedMaterials(state, child, {
          ...locator,
          blockPath: [...locator.blockPath, row.id, cell.id, child.id]
        });
      }
    }
  }
};

const projectBlock = (
  state: State,
  block: ContentBlock,
  locator: Extract<SemanticLocator, { kind: "documentBlock" }>,
  materialLocator: Extract<MaterialLocator, { kind: "documentBlock" }>
): void => {
  if (block.type === "prompt") return;
  if (block.type === "text" || block.type === "formula") {
    state.output.append(block.display, locator);
    return;
  }
  if (block.type === "image") {
    for (const text of authoredImageText(block)) {
      state.output.append(text, locator);
    }
    addImage(state, block, materialLocator);
    return;
  }

  addTable(state, block, materialLocator);
  for (const row of block.rows.slice(0, block.headerRows)) {
    for (const cell of row.cells) {
      for (const child of cell.blocks) {
        appendExactBlock(state, child, {
          ...locator,
          blockPath: [...locator.blockPath, row.id, cell.id, child.id]
        });
      }
    }
  }
  for (const row of block.rows) {
    for (const cell of row.cells) {
      for (const child of cell.blocks) {
        addNestedMaterials(state, child, {
          ...materialLocator,
          blockPath: [...materialLocator.blockPath, row.id, cell.id, child.id]
        });
      }
    }
  }
};

const rows = (state: State, values: readonly DocumentRow[], area: DocumentArea): void => {
  const entries = values.flatMap((row) => row.kind === "blocks"
    ? row.blocks.map((block) => ({ row, block }))
    : []);
  for (const [index, { row, block }] of entries.entries()) {
    const before = entries.slice(0, index).flatMap((entry) => exactAuthoredTexts(entry.block)).slice(-4);
    const after = entries.slice(index + 1).flatMap((entry) => exactAuthoredTexts(entry.block)).slice(0, 4);
    state.nearby = [...before, ...after];
    const locator = { kind: "documentBlock" as const, area, rowId: row.id, blockPath: [block.id] };
    projectBlock(state, block, locator, locator);
  }
};

export const projectDocument = (
  body: DocumentBody,
  state: Omit<State, "materials" | "materialNumber" | "nearby">
): MaterialSeed[] => {
  const active: State = { ...state, materials: [], materialNumber: 0, nearby: [] };
  if (body.header !== undefined) {
    rows(active, body.header.rows, "header");
    rows(active, body.header.firstPageRows ?? [], "firstPageHeader");
  }
  rows(active, body.rows, "body");
  if (body.footer !== undefined) {
    rows(active, body.footer.rows, "footer");
    rows(active, body.footer.firstPageRows ?? [], "firstPageFooter");
  }
  return active.materials;
};
