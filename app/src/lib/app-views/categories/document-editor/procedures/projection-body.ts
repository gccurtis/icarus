import type { Node as ProseMirrorNode } from "prosemirror-model";

import type { Atom, ContentBlock, PromptBlock } from "$representation/data/types/content/content-block";
import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import { isBlocks } from "$app-views/categories/document-editor/procedures/paginate";
import { displayOfAtom } from "$app-views/categories/document-editor/procedures/projection-atoms";
import { isStyled } from "$app-views/categories/document-editor/procedures/projection-blocks";
import { displayOfChild, marksOf } from "$app-views/categories/document-editor/procedures/projection-inline";
import { rowNodesOf } from "$app-views/categories/document-editor/procedures/projection-pagination";
import type { Styled } from "$app-views/categories/document-editor/procedures/styles";

const strip = <T extends object>(held: T): T =>
  Object.fromEntries(Object.entries(held).filter(([, value]) => value !== undefined)) as T;

export type Walked = {
  readonly atoms: Atom[];
  readonly display: string;
};

const projectedAtomId = (node: ProseMirrorNode, index: number): string =>
  `#a-${encodeURIComponent(String(node.attrs.blockId ?? "block"))}-${index}`;

export const atomsOf = (node: ProseMirrorNode): Walked => {
  const ids = node.attrs.atomIds as string[];
  const atoms: Atom[] = [];
  let run = "";
  let index = 0;

  const flush = () => {
    // A newly typed run can outnumber the saved IDs. Its provisional identity
    // must remain deterministic across repeated projections.
    atoms.push({ id: ids[index] ?? projectedAtomId(node, index), kind: "literal", text: run });
    index += 1;
    run = "";
  };

  node.forEach((child) => {
    if (child.type.name === "template_atom") {
      if (run.length > 0) flush();
      atoms.push({
        id: child.attrs.atomId as string,
        kind: "template",
        name: child.attrs.name as string
      });
      return;
    }
    if (child.type.name !== "formula_atom") {
      run += child.text ?? "";
      return;
    }

    if (run.length > 0) flush();
    const value = child.attrs.value as FormulaValue | null;
    if (value === null || child.attrs.state !== "fresh") {
      throw new Error("The editor contains an incomplete formula atom");
    }
    atoms.push({
      id: child.attrs.atomId as string,
      kind: "formula",
      expression: child.attrs.expression as string,
      ...(child.attrs.formulaId === null ? {} : { formulaId: child.attrs.formulaId }),
      lastResolvedValue: value,
      lastResolvedDisplay: child.attrs.resolved as string,
      state: "fresh"
    });
  });

  if (run.length > 0 || atoms.length === 0) flush();
  return { atoms, display: atoms.map(displayOfAtom).join("") };
};

const projectedPrompt = (
  node: ProseMirrorNode,
  base: Styled | undefined,
  atoms: readonly Atom[],
  display: string,
  marks: ReturnType<typeof marksOf>,
  style: string | undefined,
  format: Styled["format"] | undefined
): PromptBlock => {
  const id = node.attrs.blockId as string;
  const prompt: PromptBlock =
    base?.type === "prompt"
      ? base
      : { id, type: "prompt", atoms: [], display: "", marks: [], state: "idle" };
  const { style: _previousStyle, format: _previousFormat, ...withoutPresentation } = prompt;
  const presented = {
    ...withoutPresentation,
    id,
    atoms: [...atoms],
    display,
    marks,
    ...(style === undefined ? {} : { style }),
    ...(format === undefined ? {} : { format })
  };
  if (prompt.derivedOutputId === undefined || prompt.display === display) return presented;
  return {
    id,
    type: "prompt",
    derivedOutputId: prompt.derivedOutputId,
    atoms: [...atoms],
    display,
    marks,
    state: "stale",
    ...(prompt.refreshedAt === undefined ? {} : { refreshedAt: prompt.refreshedAt }),
    ...(style === undefined ? {} : { style }),
    ...(prompt.slot === undefined ? {} : { slot: prompt.slot }),
    ...(format === undefined ? {} : { format })
  };
};

const blockOf = (node: ProseMirrorNode, before: ReadonlyMap<string, ContentBlock>): ContentBlock => {
  const id = node.attrs.blockId as string;
  if (node.type.name !== "text_block") {
    const held = (node.attrs.block ?? before.get(id)) as ContentBlock;
    return { ...held, id };
  }

  const { atoms, display } = atomsOf(node);
  const marks = marksOf(node, atoms);
  const earlier = before.get(id);
  const base = earlier !== undefined && isStyled(earlier) ? earlier : undefined;
  const format = (node.attrs.format as Styled["format"] | null) ?? undefined;
  const style = (node.attrs.styleKey as string | null) ?? undefined;

  if (node.attrs.kind === "prompt") {
    return projectedPrompt(node, base, atoms, display, marks, style, format);
  }

  const text = base?.type === "text" ? base : undefined;
  return strip({
    ...text,
    id,
    type: "text" as const,
    variant: node.attrs.variant as Styled extends { variant: infer V } ? V : never,
    level: (node.attrs.level as number | null) ?? undefined,
    listStyle: (node.attrs.listStyle as "bullet" | "ordered" | "todo" | null) ?? undefined,
    checked: (node.attrs.checked as boolean | null) ?? undefined,
    language: (node.attrs.language as string | null) ?? undefined,
    style,
    atoms,
    display,
    marks,
    format
  });
};

const rowOf = (node: ProseMirrorNode, blocksBefore: ReadonlyMap<string, ContentBlock>): DocumentRow => {
  const id = node.attrs.rowId as string;
  if (node.type.name === "divider") {
    return strip({
      id,
      kind: "divider" as const,
      color: (node.attrs.color as string | null) ?? undefined,
      width: (node.attrs.width as number | null) ?? undefined,
      style: (node.attrs.style as "solid" | "dashed" | "dotted" | null) ?? undefined
    });
  }
  if (node.type.name === "page_break") return { id, kind: "pageBreak" };

  const blocks: ContentBlock[] = [];
  node.forEach((child) => blocks.push(blockOf(child, blocksBefore)));
  const proportions = node.attrs.proportions as number[] | null;
  return { id, kind: "blocks", blocks, ...(proportions === null ? {} : { proportions }) };
};

export const bodyOf = (doc: ProseMirrorNode, previous: DocumentBody): DocumentBody => {
  const blocksBefore = new Map<string, ContentBlock>();
  for (const row of previous.rows) {
    if (!isBlocks(row)) continue;
    for (const block of row.blocks) blocksBefore.set(block.id, block);
  }
  return {
    ...previous,
    rows: rowNodesOf(doc).map((row) => rowOf(row, blocksBefore))
  };
};
