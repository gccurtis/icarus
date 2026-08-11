import { describe, it, expect } from 'vitest';
import { groupResources, matchSummary, PINNED_GROUP } from './resource-groups';
import { projectWideAccess, type Resource, type ResourceKind } from '$data/resources';

const resource = (
  name: string,
  kind: ResourceKind,
  updatedAt: number,
  pinned = false
): Resource => ({
  id: `${kind}-${name}`,
  name,
  kind,
  updatedAt,
  createdAt: 0,
  pinned,
  access: projectWideAccess()
});

const catalog = [
  resource('Launch plan', 'document', 500, true),
  resource('Q3 brief', 'document', 900),
  resource('Notes', 'document', 100),
  resource('Deck', 'slides', 700),
  resource('Budget', 'spreadsheet', 300)
];

describe('groupResources', () => {
  it('leads with Pinned, then kinds in RESOURCE_KINDS order', () => {
    expect(groupResources(catalog).map((g) => g.id)).toEqual([
      PINNED_GROUP,
      'document',
      'spreadsheet',
      'slides'
    ]);
  });

  it('keeps a pinned resource in its kind group too — Pinned is a shortcut', () => {
    const groups = groupResources(catalog);
    expect(groups[0].items.map((r) => r.name)).toEqual(['Launch plan']);
    expect(groups.find((g) => g.id === 'document')?.items.map((r) => r.name)).toContain('Launch plan');
    expect(groups.find((g) => g.id === 'document')?.total).toBe(3);
  });

  it('omits Pinned entirely when nothing is pinned', () => {
    expect(groupResources([resource('Solo', 'document', 1)]).map((g) => g.id)).toEqual(['document']);
  });

  it('omits kinds the project has none of', () => {
    expect(groupResources(catalog).map((g) => g.id)).not.toContain('chat');
  });

  it('orders items most recently touched first', () => {
    const docs = groupResources(catalog).find((g) => g.id === 'document');
    expect(docs?.items.map((r) => r.name)).toEqual(['Q3 brief', 'Launch plan', 'Notes']);
  });

  it('filters items by name, case-insensitively, and keeps the unfiltered total', () => {
    const docs = groupResources(catalog, 'q3').find((g) => g.id === 'document');
    expect(docs?.items.map((r) => r.name)).toEqual(['Q3 brief']);
    expect(docs?.total).toBe(3);
  });

  it('drops groups with no matches while a query is active', () => {
    expect(groupResources(catalog, 'deck').map((g) => g.id)).toEqual(['slides']);
  });

  it('searches the Pinned group too', () => {
    expect(groupResources(catalog, 'launch').map((g) => g.id)).toEqual([PINNED_GROUP, 'document']);
  });

  it('ignores surrounding whitespace in the query', () => {
    expect(groupResources(catalog, '  deck  ').map((g) => g.id)).toEqual(['slides']);
  });

  it('returns nothing when a query matches nothing', () => {
    expect(groupResources(catalog, 'zzz')).toEqual([]);
  });
});

describe('matchSummary', () => {
  it('is null when nothing is being searched', () => {
    expect(matchSummary(catalog, '')).toBeNull();
    expect(matchSummary(catalog, '   ')).toBeNull();
  });

  it('counts each resource once, even when pinned puts it in two groups', () => {
    expect(matchSummary(catalog, 'launch')).toEqual({ matched: 1, total: 5 });
  });

  it('reports the catalog total alongside the matches', () => {
    expect(matchSummary(catalog, 'e')).toEqual({
      matched: catalog.filter((r) => r.name.toLowerCase().includes('e')).length,
      total: 5
    });
  });
});
