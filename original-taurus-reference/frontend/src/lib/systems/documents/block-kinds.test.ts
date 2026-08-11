import { describe, it, expect } from 'vitest';
import {
  blockKinds,
  textTypeOptions,
  insertElementOptions,
  textSubKinds,
  isDataKind,
  isLeafKind,
  isTextKind,
  headingLevel,
  subKindForLevel,
  isHeadingSubKind
} from './block-kinds';
import type { BlockKind } from './types';

const ALL: BlockKind[] = ['text', 'code', 'callout', 'list', 'divider', 'image', 'prompt'];

describe('block-kinds registry', () => {
  it('has an entry for every BlockKind', () => {
    for (const k of ALL) expect(blockKinds[k]?.kind).toBe(k);
    expect(Object.keys(blockKinds).sort()).toEqual([...ALL].sort());
  });

  it('offers Body + Heading 1-6 as text types, in order', () => {
    expect(textTypeOptions.map((o) => o.value)).toEqual([
      'body',
      'heading_1',
      'heading_2',
      'heading_3',
      'heading_4',
      'heading_5',
      'heading_6'
    ]);
    expect(textTypeOptions[0].label).toBe('Body');
    expect(textSubKinds).toHaveLength(7);
  });

  it('offers code/callout/list/divider/prompt as elements; not text/image', () => {
    const els = insertElementOptions.map((o) => o.value);
    expect(els).toEqual(expect.arrayContaining(['code', 'callout', 'list', 'divider', 'prompt']));
    expect(els).not.toContain('text');
    expect(els).not.toContain('image');
  });

  it('marks data kinds and leaf kinds', () => {
    expect(isDataKind('prompt')).toBe(true);
    expect(isDataKind('list')).toBe(true);
    expect(isDataKind('image')).toBe(true);
    expect(isDataKind('text')).toBe(false);
    expect(isDataKind('code')).toBe(false);
    expect(isDataKind('callout')).toBe(false);
    expect(isLeafKind('divider')).toBe(true);
    expect(isLeafKind('image')).toBe(true);
    expect(isLeafKind('text')).toBe(false);
    expect(isLeafKind('list')).toBe(false);
    expect(isTextKind('text')).toBe(true);
    expect(isTextKind('callout')).toBe(false);
  });

  it('maps heading sub-kinds to levels and back', () => {
    expect(headingLevel('heading_3')).toBe(3);
    expect(headingLevel('body')).toBe(0);
    expect(headingLevel(undefined)).toBe(0);
    expect(subKindForLevel(2)).toBe('heading_2');
    expect(subKindForLevel(0)).toBe('body');
    expect(subKindForLevel(9)).toBe('body');
    expect(isHeadingSubKind('heading_1')).toBe(true);
    expect(isHeadingSubKind('body')).toBe(false);
  });
});
