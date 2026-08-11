import { describe, expect, it } from 'vitest';
import type { Resource } from '$data/resources';
import type { Tab } from '$data/workspace';
import { contextItemsFor, filterContextItems } from './context-items';

const docTab: Tab = {
  id: 't1',
  title: 'Field Report',
  closeable: true,
  kind: 'resource',
  resourceId: 'doc-1',
  resourceKind: 'document'
};

const resource = (id: string, name: string, kind: Resource['kind'] = 'document'): Resource =>
  ({ id, name, kind }) as Resource;

describe('contextItemsFor', () => {
  it('contributes the open document only when a resource tab is active', () => {
    const withTab = contextItemsFor({
      enabled: ['document'],
      excluded: [],
      activeTab: docTab,
      resources: []
    });
    expect(withTab).toEqual([
      {
        id: 'document:doc-1',
        name: 'Field Report',
        typeLabel: 'Taurus document',
        kind: 'resource',
        sourceId: 'document'
      }
    ]);

    const newTab: Tab = { id: 't2', title: 'New tab', closeable: true, kind: 'new' };
    expect(
      contextItemsFor({ enabled: ['document'], excluded: [], activeTab: newTab, resources: [] })
    ).toEqual([]);
  });

  it('knowledge lists project resources but never the open one twice', () => {
    const items = contextItemsFor({
      enabled: ['knowledge'],
      excluded: [],
      activeTab: docTab,
      resources: [resource('doc-1', 'Field Report'), resource('doc-2', 'Appendix', 'slides')]
    });
    expect(items.map((i) => i.id)).toEqual(['knowledge:doc-2']);
    expect(items[0].typeLabel).toBe('Taurus slides');
  });

  it('drops excluded items after building the list', () => {
    const items = contextItemsFor({
      enabled: ['selection', 'sources'],
      excluded: ['sources:field-notes'],
      activeTab: null,
      resources: []
    });
    expect(items.map((i) => i.id)).toEqual(['selection:current', 'sources:research-map']);
  });
});

describe('filterContextItems', () => {
  const items = contextItemsFor({
    enabled: ['selection', 'sources'],
    excluded: [],
    activeTab: null,
    resources: []
  });

  it('matches name and type label, case-insensitively', () => {
    expect(filterContextItems(items, 'FIELD-notes').map((i) => i.id)).toEqual([
      'sources:field-notes'
    ]);
    expect(filterContextItems(items, 'linked').map((i) => i.id)).toEqual([
      'sources:research-map'
    ]);
  });

  it('blank query returns everything', () => {
    expect(filterContextItems(items, '  ')).toEqual(items);
  });
});
