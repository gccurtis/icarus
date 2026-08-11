import { describe, it, expect } from 'vitest';
import { toKind } from '$data/resources';

describe('toKind', () => {
  it('passes through known kind strings', () => {
    expect(toKind('document')).toBe('document');
    expect(toKind('spreadsheet')).toBe('spreadsheet');
    expect(toKind('slides')).toBe('slides');
    expect(toKind('chat')).toBe('chat');
    expect(toKind('general')).toBe('general');
  });

  it('maps unknown kinds to general', () => {
    expect(toKind('board')).toBe('general');
    expect(toKind('wiki')).toBe('general');
    expect(toKind('')).toBe('general');
    expect(toKind('unknown')).toBe('general');
  });

  it('maps retired/removed kinds to general', () => {
    expect(toKind('board')).toBe('general');
    expect(toKind('form')).toBe('general');
  });

  it('is case-sensitive (backend sends lowercase)', () => {
    expect(toKind('Document')).toBe('general');
    expect(toKind('DOCUMENT')).toBe('general');
  });
});
