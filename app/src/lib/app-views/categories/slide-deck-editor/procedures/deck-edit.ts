import { applyOps } from "$representation/data/behavior/slide-decks/apply-ops";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";

export type Edit = {
  readonly body: SlideDeckBody;
  readonly ops: readonly SlideDeckOp[];
};

export const noDeckEdit = (body: SlideDeckBody): Edit => ({ body, ops: [] });

export const deckEdit = (body: SlideDeckBody, ops: readonly SlideDeckOp[]): Edit =>
  ops.length === 0 ? noDeckEdit(body) : { body: applyOps(body, ops), ops };

export const idBefore = <T extends { id: string }>(items: readonly T[], id: string): string | null => {
  const at = items.findIndex((item) => item.id === id);
  return at <= 0 ? null : items[at - 1].id;
};
