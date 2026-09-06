import type { DocumentBody } from "$representation/data/types/documents/body";
import { isBlocks, linesOfRow, paginate } from "$app-views/categories/document-editor/procedures/paginate";
import type { Metrics } from "$app-views/categories/document-editor/procedures/projection";
import { styleSetOf } from "$app-views/categories/document-editor/procedures/styles";

export type Section = {
  readonly blockId: string;
  readonly atomId: string;
  readonly title: string;
  readonly level: number;
  readonly line: number;
  readonly page: number;
  readonly children: Section[];
};

export type Placed = {
  readonly rowId: string;
  readonly line: number;
  readonly page: number;
};

export const placedRows = (body: DocumentBody, metrics: Metrics): Placed[] => {
  const styles = styleSetOf(body);
  const pages = paginate(body.rows, metrics.charactersPerLine, metrics.linesPerPage, styles);
  const held: Placed[] = [];
  let line = 1;

  pages.forEach((page, index) => {
    for (const row of page) {
      held.push({ rowId: row.id, line: Math.max(1, Math.round(line)), page: index + 1 });
      line += Math.ceil(linesOfRow(row, metrics.charactersPerLine, styles));
    }
  });

  return held;
};

export const outlineOf = (body: DocumentBody, metrics: Metrics): Section[] => {
  const placed = new Map(placedRows(body, metrics).map((held) => [held.rowId, held]));
  const roots: Section[] = [];
  const stack: Section[] = [];

  for (const row of body.rows) {
    if (!isBlocks(row)) continue;
    const at = placed.get(row.id);

    for (const block of row.blocks) {
      if (block.type !== "text" || block.variant !== "heading") continue;

      const level = Math.max(1, Math.min(block.level ?? 1, 3));
      const section: Section = {
        blockId: block.id,
        atomId: block.atoms[0]?.id ?? "",
        title: block.display.trim().length === 0 ? "Untitled heading" : block.display.trim(),
        level,
        line: at?.line ?? 0,
        page: at?.page ?? 0,
        children: []
      };

      while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
      if (stack.length === 0) roots.push(section);
      else stack[stack.length - 1].children.push(section);
      stack.push(section);
    }
  }

  return roots;
};

export const flatten = (sections: readonly Section[]): Section[] =>
  sections.flatMap((section) => [section, ...flatten(section.children)]);

export const whereabouts = (section: Section): string => `l.${section.line} · p.${section.page}`;
