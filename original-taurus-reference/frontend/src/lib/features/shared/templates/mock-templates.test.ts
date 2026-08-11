import { describe, expect, it } from 'vitest';
import { MOCK_TEMPLATES, searchTemplates } from './mock-templates';

describe('searchTemplates', () => {
  it('blank or whitespace query returns the whole catalog', () => {
    expect(searchTemplates('')).toEqual(MOCK_TEMPLATES);
    expect(searchTemplates('   ')).toEqual(MOCK_TEMPLATES);
  });

  it('matches name and description, case-insensitively', () => {
    expect(searchTemplates('PITCH').map((t) => t.id)).toEqual(['tpl-pitch-deck']);
    expect(searchTemplates('action items').map((t) => t.id)).toEqual(['tpl-meeting-notes']);
  });

  it('no match returns an empty list, not the catalog', () => {
    expect(searchTemplates('zzz-nothing')).toEqual([]);
  });
});
