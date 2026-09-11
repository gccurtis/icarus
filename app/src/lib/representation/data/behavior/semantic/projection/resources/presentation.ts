import type { ContentBlock, ImageBlock, TableBlock } from "$representation/data/types/content/content-block";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type {
  MaterialAuthoredContext,
  MaterialLocator,
  MaterialSeed,
  MaterialSource
} from "$representation/data/types/semantic/material";
import type { SemanticLocator } from "$representation/data/types/semantic/source";
import type { Slide, PresentationBody, SlideElement } from "$representation/data/types/presentations/body";
import { profileChart, profileImage, profileTable } from "$representation/data/behavior/semantic/materials/profile";
import type { ExternalFileLookup } from "$representation/data/behavior/semantic/projection/contract";
import {
  authoredImageText,
  exactAuthoredTexts,
  orderedByFrame
} from "$representation/data/behavior/semantic/projection/shared";
import type { ProjectionWriter } from "$representation/data/behavior/semantic/projection/writer";

type State = {
  ref: ResourceRef;
  revision: number;
  title: string;
  externalFile?: ExternalFileLookup;
  output: ProjectionWriter;
  materials: MaterialSeed[];
  materialNumber: number;
};

const elementNarrative = (element: SlideElement): string[] => {
  const content = element.content;
  if (content.type === "text" || content.type === "formula" || content.type === "image" || content.type === "table") {
    return exactAuthoredTexts(content.block);
  }
  if (content.type === "shape") return content.block === undefined ? [] : exactAuthoredTexts(content.block);
  if (content.type === "group") return orderedByFrame(content.children).flatMap(elementNarrative);
  return [];
};

const slideNarrative = (slide: Slide): string[] =>
  orderedByFrame(slide.elements).flatMap(elementNarrative).filter(Boolean).slice(0, 12);

const context = (
  state: State,
  slide: Slide,
  extra: Partial<MaterialAuthoredContext> = {}
): MaterialAuthoredContext => ({
  ...extra,
  title: state.title,
  nearbyText: slideNarrative(slide),
  notes: slide.notes.flatMap(exactAuthoredTexts).filter(Boolean).slice(0, 8)
});

const imageSource = (
  state: State,
  block: ImageBlock,
  locator: MaterialLocator
): { source: MaterialSource; identityKey: string; hash: string; mediaType?: string; name?: string } => {
  if (block.source?.kind === "file") {
    const file = state.externalFile?.(block.source.fileId);
    if (file !== undefined) return {
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
  const hash = JSON.stringify(block.source ?? [state.ref, locator]);
  return {
    source: { kind: "resourceContent", ref: state.ref, revision: state.revision, locator },
    identityKey: JSON.stringify(["image", state.ref, locator, hash]),
    hash
  };
};

const image = (state: State, slide: Slide, block: ImageBlock, locator: MaterialLocator): void => {
  if (block.source === undefined) return;
  state.materialNumber += 1;
  const found = imageSource(state, block, locator);
  const authored = authoredImageText(block);
  state.materials.push({
    identityKey: found.identityKey,
    kind: "image",
    name: (found.name ?? authored[1] ?? authored[0] ?? `Image ${state.materialNumber}`).slice(0, 240),
    source: found.source,
    placement: { ref: state.ref, revision: state.revision, locator },
    profile: profileImage(block, found.hash, 1, found.mediaType),
    context: context(state, slide, {
      ...(block.alt.trim() ? { alt: block.alt.trim() } : {}),
      ...(authored[1] ? { caption: authored[1] } : {})
    }),
    ...(block.source?.kind === "url" ? { nativeImage: { kind: "url" as const, url: block.source.url } } : {})
  });
};

const table = (
  state: State,
  slide: Slide,
  block: TableBlock,
  locator: Extract<MaterialLocator, { kind: "slideElement" }>
): void => {
  state.materialNumber += 1;
  const profile = profileTable(block);
  state.materials.push({
    identityKey: JSON.stringify(["table", state.ref, locator, block.id]),
    kind: "table",
    name: (profile.headers.filter(Boolean).slice(0, 2).join(" / ") || `Table ${state.materialNumber}`).slice(0, 240),
    source: { kind: "resourceContent", ref: state.ref, revision: state.revision, locator },
    placement: { ref: state.ref, revision: state.revision, locator },
    profile,
    context: context(state, slide)
  });
};

const appendExactBlock = (
  state: State,
  block: ContentBlock,
  locator: Extract<SemanticLocator, { kind: "slideElement" }>
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
  slide: Slide,
  block: ContentBlock,
  locator: Extract<MaterialLocator, { kind: "slideElement" }>
): void => {
  if (block.type === "image") {
    image(state, slide, block, locator);
    return;
  }
  if (block.type !== "table") return;
  table(state, slide, block, locator);
  for (const row of block.rows) {
    for (const cell of row.cells) {
      for (const child of cell.blocks) {
        addNestedMaterials(state, slide, child, {
          ...locator,
          blockPath: [...(locator.blockPath ?? []), row.id, cell.id, child.id]
        });
      }
    }
  }
};

const element = (state: State, slide: Slide, held: SlideElement, elementPath: string[]): void => {
  const content = held.content;
  const locator = { kind: "slideElement" as const, slideId: slide.id, elementPath };
  const append = (text: string, blockPath: string[]) =>
    state.output.append(text, { ...locator, blockPath });
  if (content.type === "text" || content.type === "formula") {
    append(content.block.display, [content.block.id]);
    return;
  }
  if (content.type === "shape") {
    if (content.block !== undefined) append(content.block.display, [content.block.id]);
    return;
  }
  if (content.type === "image") {
    for (const text of authoredImageText(content.block)) append(text, [content.block.id]);
    image(state, slide, content.block, { ...locator, blockPath: [content.block.id] });
    return;
  }
  if (content.type === "table") {
    const tableLocator = { ...locator, blockPath: [content.block.id] };
    table(state, slide, content.block, tableLocator);
    for (const row of content.block.rows.slice(0, content.block.headerRows)) {
      for (const cell of row.cells) {
        for (const child of cell.blocks) {
          appendExactBlock(state, child, {
            ...locator,
            blockPath: [content.block.id, row.id, cell.id, child.id]
          });
        }
      }
    }
    for (const row of content.block.rows) {
      for (const cell of row.cells) {
        for (const child of cell.blocks) {
          addNestedMaterials(state, slide, child, {
            ...locator,
            blockPath: [content.block.id, row.id, cell.id, child.id]
          });
        }
      }
    }
    return;
  }
  if (content.type === "chart") {
    state.materialNumber += 1;
    const profile = profileChart(content.spec);
    state.materials.push({
      identityKey: JSON.stringify(["chart", state.ref, locator]),
      kind: "chart",
      name: (profile.title ?? `Chart ${state.materialNumber}`).slice(0, 240),
      source: { kind: "resourceContent", ref: state.ref, revision: state.revision, locator },
      placement: { ref: state.ref, revision: state.revision, locator },
      profile,
      context: context(state, slide)
    });
    return;
  }
  if (content.type === "group") {
    for (const child of orderedByFrame(content.children)) element(state, slide, child, [...elementPath, child.id]);
  }
};

export const projectPresentation = (
  body: PresentationBody,
  state: Omit<State, "materials" | "materialNumber">
): MaterialSeed[] => {
  const active: State = { ...state, materials: [], materialNumber: 0 };
  for (const slide of body.slides) {
    if (slide.hidden === true) continue;
    active.output.hardBoundary();
    if (slide.background?.kind === "image") {
      image(active, slide, {
        id: `${slide.id}:background`,
        type: "image",
        source: { kind: "file", fileId: slide.background.fileId },
        alt: ""
      }, { kind: "slideBackground", slideId: slide.id });
    }
    for (const held of orderedByFrame(slide.elements)) element(active, slide, held, [held.id]);
    for (const block of slide.notes) {
      if (block.type === "prompt") continue;
      for (const text of exactAuthoredTexts(block)) {
        active.output.append(text, { kind: "slideNote", slideId: slide.id, blockPath: [block.id] });
      }
    }
  }
  return active.materials;
};
