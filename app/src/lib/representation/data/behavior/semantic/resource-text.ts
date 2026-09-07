import type {
  ContentBlock,
  ImageBlock,
  TableBlock
} from "$representation/data/types/content/content-block";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type {
  DocumentBody,
  DocumentRow
} from "$representation/data/types/documents/body";
import type {
  SlideDeckBody,
  SlideElement
} from "$representation/data/types/slide-decks/body";
import type {
  SemanticLocator,
  SemanticLocatorSpan,
  SemanticResourceProjection
} from "$representation/data/types/semantic/source";

type ProjectionWriter = {
  append(text: string, locator: SemanticLocator): void;
  finish(): Pick<SemanticResourceProjection, "text" | "locators">;
};

type ProjectResourceInput = {
  ref: ResourceRef;
  revision: number;
  title: string;
} & (
  | { kind: "document"; body: DocumentBody }
  | { kind: "slides"; body: SlideDeckBody }
);

const writer = (): ProjectionWriter => {
  let text = "";
  const locators: SemanticLocatorSpan[] = [];

  return {
    append(value, locator) {
      const projected = value.trim();
      if (!projected) return;
      if (text.length > 0) text += "\n\n";
      const from = text.length;
      text += projected;
      locators.push({ from, to: text.length, locator });
    },
    finish: () => ({ text, locators })
  };
};

const projectImage = (
  block: ImageBlock,
  append: (text: string, blockPath: string[]) => void,
  blockPath: string[]
): void => {
  append(block.alt, blockPath);
  if (block.caption !== undefined) {
    projectBlock(block.caption, append, [...blockPath, block.caption.id]);
  }
};

const projectTable = (
  block: TableBlock,
  append: (text: string, blockPath: string[]) => void,
  blockPath: string[]
): void => {
  for (const row of block.rows) {
    for (const cell of row.cells) {
      for (const child of cell.blocks) {
        projectBlock(child, append, [...blockPath, row.id, cell.id, child.id]);
      }
    }
  }
};

const projectBlock = (
  block: ContentBlock,
  append: (text: string, blockPath: string[]) => void,
  blockPath: string[]
): void => {
  switch (block.type) {
    case "text":
    case "formula":
      append(block.display, blockPath);
      return;
    case "image":
      projectImage(block, append, blockPath);
      return;
    case "table":
      projectTable(block, append, blockPath);
      return;
    case "prompt":
      // Derived text is presentation, not authoritative evidence. Indexing it
      // would create an answer -> evidence -> answer feedback loop.
      return;
  }
};

const projectDocumentRows = (
  rows: readonly DocumentRow[],
  area: Extract<SemanticLocator, { kind: "documentBlock" }>['area'],
  output: ProjectionWriter
): void => {
  for (const row of rows) {
    if (row.kind !== "blocks") continue;
    for (const block of row.blocks) {
      projectBlock(
        block,
        (text, blockPath) =>
          output.append(text, { kind: "documentBlock", area, rowId: row.id, blockPath }),
        [block.id]
      );
    }
  }
};

const documentText = (body: DocumentBody, output: ProjectionWriter): void => {
  if (body.header !== undefined) {
    projectDocumentRows(body.header.rows, "header", output);
    projectDocumentRows(body.header.firstPageRows ?? [], "firstPageHeader", output);
  }
  projectDocumentRows(body.rows, "body", output);
  if (body.footer !== undefined) {
    projectDocumentRows(body.footer.rows, "footer", output);
    projectDocumentRows(body.footer.firstPageRows ?? [], "firstPageFooter", output);
  }
};

const orderedElements = (elements: readonly SlideElement[]): readonly SlideElement[] =>
  elements
    .map((element, order) => ({ element, order }))
    .sort(
      (left, right) =>
        left.element.frame.y - right.element.frame.y ||
        left.element.frame.x - right.element.frame.x ||
        left.order - right.order
    )
    .map(({ element }) => element);

const projectSlideElement = (
  slideId: string,
  element: SlideElement,
  elementPath: string[],
  output: ProjectionWriter
): void => {
  const append = (text: string, blockPath: string[]) =>
    output.append(text, { kind: "slideElement", slideId, elementPath, blockPath });
  const content = element.content;
  switch (content.type) {
    case "text":
    case "formula":
    case "image":
    case "table":
      projectBlock(content.block, append, [content.block.id]);
      return;
    case "shape":
      if (content.block !== undefined) projectBlock(content.block, append, [content.block.id]);
      return;
    case "group":
      for (const child of orderedElements(content.children)) {
        projectSlideElement(slideId, child, [...elementPath, child.id], output);
      }
      return;
    case "prompt":
    case "line":
    case "chart":
      return;
  }
};

const slideDeckText = (body: SlideDeckBody, output: ProjectionWriter): void => {
  for (const slide of body.slides) {
    if (slide.hidden === true) continue;
    for (const element of orderedElements(slide.elements)) {
      projectSlideElement(slide.id, element, [element.id], output);
    }
    for (const block of slide.notes) {
      projectBlock(
        block,
        (text, blockPath) =>
          output.append(text, { kind: "slideNote", slideId: slide.id, blockPath }),
        [block.id]
      );
    }
  }
};

/** Projects editable resources into one deterministic UTF-16 text coordinate space. */
export const projectResourceText = (input: ProjectResourceInput): SemanticResourceProjection => {
  if (!Number.isInteger(input.revision) || input.revision < 0) {
    throw new Error("A projected resource revision must be a non-negative integer");
  }
  if (input.ref.kind !== input.kind) {
    throw new Error("The resource reference kind must match the projected body kind");
  }

  const output = writer();
  output.append(input.title, { kind: "resourceTitle" });
  if (input.kind === "document") documentText(input.body, output);
  else slideDeckText(input.body, output);
  return {
    ref: { ...input.ref },
    revision: input.revision,
    encoding: "utf-16",
    ...output.finish()
  };
};
