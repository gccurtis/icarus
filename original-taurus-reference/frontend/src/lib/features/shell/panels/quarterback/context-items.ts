import type { AiContextSourceId } from '$data/ai-agent';
import type { Resource } from '$data/resources';
import type { Tab } from '$data/workspace';

/**
 * The CONTEXT-ITEM projection for the Current-context manager: which concrete
 * items the enabled context sources currently contribute. Pure — a function of
 * the store values the manager passes in — so `context-items.test.ts` covers
 * the projection without mounting a component.
 */

export type ContextItem = {
  id: string;
  name: string;
  typeLabel: string;
  kind: 'resource' | 'selection' | 'file';
  sourceId: AiContextSourceId;
};

export function contextItemsFor(args: {
  enabled: AiContextSourceId[];
  excluded: string[];
  activeTab: Tab | null;
  resources: Resource[];
}): ContextItem[] {
  const { enabled, excluded, activeTab, resources } = args;
  const currentResourceId =
    activeTab?.kind === 'resource' ? (activeTab.resourceId ?? null) : null;
  const items: ContextItem[] = [];

  if (enabled.includes('document') && currentResourceId && activeTab) {
    items.push({
      id: `document:${currentResourceId}`,
      name: activeTab.title,
      typeLabel: 'Taurus document',
      kind: 'resource',
      sourceId: 'document'
    });
  }

  if (enabled.includes('selection')) {
    items.push({
      id: 'selection:current',
      name: 'Current editor selection',
      typeLabel: 'Selection',
      kind: 'selection',
      sourceId: 'selection'
    });
  }

  if (enabled.includes('knowledge')) {
    for (const resource of resources) {
      if (resource.id === currentResourceId) continue;
      items.push({
        id: `knowledge:${resource.id}`,
        name: resource.name,
        typeLabel: `Taurus ${resource.kind}`,
        kind: 'resource',
        sourceId: 'knowledge'
      });
    }
  }

  if (enabled.includes('sources')) {
    items.push(
      {
        id: 'sources:research-map',
        name: 'Research source map',
        typeLabel: 'Linked resource',
        kind: 'resource',
        sourceId: 'sources'
      },
      {
        id: 'sources:field-notes',
        name: 'field-notes.pdf',
        typeLabel: 'External file',
        kind: 'file',
        sourceId: 'sources'
      }
    );
  }

  return items.filter((item) => !excluded.includes(item.id));
}

/** Case-insensitive filter over an item's name + type label. */
export function filterContextItems(items: ContextItem[], query: string): ContextItem[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return items;
  return items.filter((item) =>
    `${item.name} ${item.typeLabel}`.toLocaleLowerCase().includes(needle)
  );
}
