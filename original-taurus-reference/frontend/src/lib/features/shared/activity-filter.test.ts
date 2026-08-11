import { describe, it, expect } from 'vitest';
import {
  EMPTY_FILTER,
  filterChips,
  filterEvents,
  isFilterActive,
  matchesFilter,
  serverTargetId,
  type ActivityFilter
} from './activity-filter';
import type { ActivityEvent } from '$data/projects';
import type { ResourceKind } from '$data/resources';

const event = (
  id: string,
  actorId: string,
  targetId: string,
  kind: ResourceKind = 'document'
): ActivityEvent => ({
  id,
  actor: { id: actorId, name: actorId },
  action: 'edited',
  target: { id: targetId, name: targetId, kind },
  occurredAt: 0
});

const filter = (over: Partial<ActivityFilter> = {}): ActivityFilter => ({ ...EMPTY_FILTER, ...over });

const events = [
  event('1', 'ada', 'doc1'),
  event('2', 'bo', 'doc2'),
  event('3', 'ada', 'deck1', 'slides'),
  event('4', 'cy', 'sheet1', 'spreadsheet')
];

describe('isFilterActive', () => {
  it('is false for the empty filter', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
  });

  it('is true when any dimension is set', () => {
    expect(isFilterActive(filter({ actorIds: ['ada'] }))).toBe(true);
    expect(isFilterActive(filter({ resourceIds: ['doc1'] }))).toBe(true);
    expect(isFilterActive(filter({ kinds: ['slides'] }))).toBe(true);
  });
});

describe('matchesFilter', () => {
  it('passes everything when nothing is set', () => {
    expect(events.every((e) => matchesFilter(e, EMPTY_FILTER))).toBe(true);
  });

  it('matches any of several actors', () => {
    const f = filter({ actorIds: ['ada', 'cy'] });
    expect(filterEvents(events, f).map((e) => e.id)).toEqual(['1', '3', '4']);
  });

  it('matches a named resource', () => {
    expect(filterEvents(events, filter({ resourceIds: ['doc2'] })).map((e) => e.id)).toEqual(['2']);
  });

  it('matches every resource of a kind', () => {
    expect(filterEvents(events, filter({ kinds: ['slides'] })).map((e) => e.id)).toEqual(['3']);
  });

  it('ORs a named resource with a whole kind — "this doc OR any deck"', () => {
    // The case that decides the semantics: ANDing these would match nothing, since
    // no resource is both one named document and a deck.
    const f = filter({ resourceIds: ['doc1'], kinds: ['slides'] });
    expect(filterEvents(events, f).map((e) => e.id)).toEqual(['1', '3']);
  });

  it('ANDs the actor against the target set', () => {
    const f = filter({ actorIds: ['ada'], kinds: ['slides'] });
    expect(filterEvents(events, f).map((e) => e.id)).toEqual(['3']);
  });

  it('preserves order', () => {
    const f = filter({ actorIds: ['ada', 'bo', 'cy'] });
    expect(filterEvents(events, f).map((e) => e.id)).toEqual(['1', '2', '3', '4']);
  });
});

describe('serverTargetId', () => {
  it('is the resource id for exactly one resource and no kinds', () => {
    expect(serverTargetId(filter({ resourceIds: ['doc1'] }))).toBe('doc1');
  });

  it('rides along with an actor filter, which is applied client-side', () => {
    expect(serverTargetId(filter({ resourceIds: ['doc1'], actorIds: ['ada'] }))).toBe('doc1');
  });

  it('is undefined for several resources — targetID takes one id', () => {
    expect(serverTargetId(filter({ resourceIds: ['doc1', 'doc2'] }))).toBeUndefined();
  });

  it('is undefined when a kind is involved', () => {
    expect(serverTargetId(filter({ resourceIds: ['doc1'], kinds: ['slides'] }))).toBeUndefined();
    expect(serverTargetId(filter({ kinds: ['document'] }))).toBeUndefined();
  });

  it('is undefined for the empty filter', () => {
    expect(serverTargetId(EMPTY_FILTER)).toBeUndefined();
  });
});

describe('filterChips', () => {
  const names = {
    actor: (id: string) => (id === 'ada' ? 'Ada Lovelace' : undefined),
    resource: (id: string) => (id === 'doc1' ? 'Launch plan' : undefined),
    kind: (kind: ResourceKind) => (kind === 'slides' ? 'Slides' : 'Documents')
  };

  it('names each dimension, kinds as "All …"', () => {
    const chips = filterChips(
      filter({ actorIds: ['ada'], kinds: ['slides'], resourceIds: ['doc1'] }),
      names
    );
    expect(chips.map((c) => c.label)).toEqual(['Ada Lovelace', 'All slides', 'Launch plan']);
  });

  it('falls back to a word rather than showing an id', () => {
    const chips = filterChips(filter({ actorIds: ['ghost'], resourceIds: ['gone'] }), names);
    expect(chips.map((c) => c.label)).toEqual(['Someone', 'A resource']);
  });

  it('each chip clears only itself', () => {
    const f = filter({ actorIds: ['ada', 'bo'], resourceIds: ['doc1'] });
    const chips = filterChips(f, names);
    const cleared = chips[0].clear(f);
    expect(cleared.actorIds).toEqual(['bo']);
    expect(cleared.resourceIds).toEqual(['doc1']);
  });

  it('has no chips for the empty filter', () => {
    expect(filterChips(EMPTY_FILTER, names)).toEqual([]);
  });
});
