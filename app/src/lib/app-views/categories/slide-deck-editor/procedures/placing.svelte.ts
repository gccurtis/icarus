import type { PlacedKind } from "$app-views/categories/slide-deck-editor/procedures/inserting";

export const placing = $state<{ kind: PlacedKind | undefined }>({ kind: undefined });

export const arm = (kind: PlacedKind | undefined): void => {
  placing.kind = kind;
};
