import type { Component } from 'svelte';
import {
  Code, FileText, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6,
  Image as ImageIcon, List, Minus, Sparkles, SquareStack
} from '@lucide/svelte';
import type { BlockKind, TextSubKind } from './types';

/** Which inspector menu a kind belongs to. */
export type BlockKindGroup = 'text' | 'element';

/** Everything the editor/UI needs to know about a block kind, in one place. */
export type BlockKindMeta = {
  kind: BlockKind;
  label: string;
  /** Offered in the Insert-element menu (image is round-trip-only until upload). */
  offered: boolean;
  group: BlockKindGroup;
  /** Holds atoms / inline content. */
  textBearing: boolean;
  /** A leaf node with no content (divider, image). */
  isLeaf: boolean;
  /** Carries typed Data in Omega (prompt, list, image). */
  dataKind: boolean;
  icon: Component;
};

const meta = (
  kind: BlockKind, label: string, group: BlockKindGroup, icon: Component,
  opts: Partial<Pick<BlockKindMeta, 'offered' | 'textBearing' | 'isLeaf' | 'dataKind'>> = {}
): BlockKindMeta => ({
  kind, label, group, icon,
  offered: opts.offered ?? true,
  textBearing: opts.textBearing ?? true,
  isLeaf: opts.isLeaf ?? false,
  dataKind: opts.dataKind ?? false
});

/** The single source of truth for block-kind metadata (Omega's 7 kinds). `text`
 *  is the base prose kind (its semantic role lives in the sub-kind); the rest are
 *  insertable elements. */
export const blockKinds: Record<BlockKind, BlockKindMeta> = {
  text: meta('text', 'Text', 'text', FileText),
  code: meta('code', 'Code', 'element', Code),
  callout: meta('callout', 'Callout', 'element', SquareStack),
  list: meta('list', 'List', 'element', List, { dataKind: true }),
  divider: meta('divider', 'Divider', 'element', Minus, { textBearing: false, isLeaf: true }),
  // Deferred to the Files/upload pass; round-trip only.
  image: meta('image', 'Image', 'element', ImageIcon, { offered: false, textBearing: false, isLeaf: true, dataKind: true }),
  prompt: meta('prompt', 'Prompt (AI)', 'element', Sparkles, { dataKind: true })
};

export const ALL_BLOCK_KINDS = Object.keys(blockKinds) as BlockKind[];

/** A built-in text sub-kind's metadata (label + heading level + icon). */
export type TextSubKindMeta = { subKind: TextSubKind; label: string; level: number; icon: Component };

/** The built-in text sub-kinds, in display order (Body + Heading 1–6). */
export const textSubKinds: TextSubKindMeta[] = [
  { subKind: 'body', label: 'Body', level: 0, icon: FileText },
  { subKind: 'heading_1', label: 'Heading 1', level: 1, icon: Heading1 },
  { subKind: 'heading_2', label: 'Heading 2', level: 2, icon: Heading2 },
  { subKind: 'heading_3', label: 'Heading 3', level: 3, icon: Heading3 },
  { subKind: 'heading_4', label: 'Heading 4', level: 4, icon: Heading4 },
  { subKind: 'heading_5', label: 'Heading 5', level: 5, icon: Heading5 },
  { subKind: 'heading_6', label: 'Heading 6', level: 6, icon: Heading6 }
];

/** Text-type dropdown options (Body + headings), in order. */
export const textTypeOptions = textSubKinds.map((s) => ({ value: s.subKind, label: s.label }));

/** Insert-element menu options (code, callout, list, divider, prompt). */
export const insertElementOptions = ALL_BLOCK_KINDS.filter(
  (k) => blockKinds[k].offered && blockKinds[k].group === 'element'
).map((k) => ({ value: k, label: blockKinds[k].label, icon: blockKinds[k].icon }));

const headingLevels: Record<string, number> = {
  heading_1: 1, heading_2: 2, heading_3: 3, heading_4: 4, heading_5: 5, heading_6: 6
};

export const isDataKind = (k: BlockKind) => blockKinds[k].dataKind;
export const isLeafKind = (k: BlockKind) => blockKinds[k].isLeaf;
export const isTextKind = (k: BlockKind) => k === 'text';
export const blockKindLabel = (k: BlockKind) => blockKinds[k]?.label ?? k;
/** A built-in sub-kind's heading level (1–6), or 0 for body / a custom sub-kind. */
export const headingLevel = (subKind: string | undefined) => (subKind && headingLevels[subKind]) || 0;
export const isHeadingSubKind = (subKind: string | undefined) => !!subKind && subKind in headingLevels;
/** The heading sub-kind for a level 1–6, else `body`. */
export const subKindForLevel = (level: number): TextSubKind =>
  (level >= 1 && level <= 6 ? `heading_${level}` : 'body') as TextSubKind;
export const textSubKindLabel = (subKind: string) =>
  textSubKinds.find((s) => s.subKind === subKind)?.label ?? subKind;
