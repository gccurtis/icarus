import type { StoreModel } from "$model/server/store/index.server";
import type { Scope } from "$runtime/server/scope.server";
import type { Actor } from "$representation/data/types/core/actor";
import { asId } from "$representation/data/behavior/core/id";

import { visibleIn, type Visible } from "$capabilities/agents/api/shared/projection";
import type { Refused } from "$capabilities/agents/types/agents";

export const viewer = (scope: Scope): Actor => ({
  kind: "user",
  userId: asId<"users">(scope.userId)
});

export const refused = (
  id: string,
  reason: Refused["reason"],
  detail: string,
  revision: number | null = null
): Refused => ({ accepted: false, id, reason, revision, detail });

export const notFound = (id: string, what: string): Refused =>
  refused(id, "not-found", `no visible ${what} has that id`);

export const stale = (id: string, asked: number, at: number): Refused =>
  refused(id, "stale", `authored against revision ${asked}, the row is at ${at}`, at);

export type Found<Row> =
  | { readonly kind: "found"; readonly row: Row; readonly visible: Visible }
  | { readonly kind: "missing"; readonly visible: Visible };

type Table = "personas" | "agentTasks" | "automations";

type RowOf<T extends Table> = T extends "personas"
  ? Visible["personas"][number]
  : T extends "agentTasks"
    ? Visible["tasks"][number]
    : Visible["automations"][number];

const listOf = <T extends Table>(visible: Visible, table: T): readonly RowOf<T>[] =>
  (table === "personas"
    ? visible.personas
    : table === "agentTasks"
      ? visible.tasks
      : visible.automations) as readonly RowOf<T>[];

export const findVisible = <T extends Table>(
  store: StoreModel,
  scope: Scope,
  table: T,
  id: string
): Found<RowOf<T>> => {
  const visible = visibleIn(store, scope);
  const row = listOf(visible, table).find((candidate) => candidate._id === id);
  return row === undefined ? { kind: "missing", visible } : { kind: "found", row, visible };
};
