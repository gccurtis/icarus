import { applyOps } from "$representation/data/behavior/presentations/apply-ops";
import type { PresentationBody } from "$representation/data/types/presentations/body";
import type { PresentationOp } from "$representation/data/types/presentations/op";

export type Edit = {
  readonly body: PresentationBody;
  readonly ops: readonly PresentationOp[];
};

export const noPresentationEdit = (body: PresentationBody): Edit => ({ body, ops: [] });

export const presentationEdit = (body: PresentationBody, ops: readonly PresentationOp[]): Edit =>
  ops.length === 0 ? noPresentationEdit(body) : { body: applyOps(body, ops), ops };

export const idBefore = <T extends { id: string }>(items: readonly T[], id: string): string | null => {
  const at = items.findIndex((item) => item.id === id);
  return at <= 0 ? null : items[at - 1].id;
};
