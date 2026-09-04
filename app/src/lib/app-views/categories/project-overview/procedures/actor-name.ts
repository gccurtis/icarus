import type { Actor } from "$representation/data/types/core/actor";
import { rowsIn } from "$app-views/categories/project-overview/procedures/rows";

/**
 * What to call whoever did something.
 *
 * One `Actor`, four arms, three tables — and the fourth arm is the reason this
 * returns a string rather than a row: `system` has no id and no record anywhere,
 * so a caller that wanted the row could not be given one.
 */
export const actorName = (actor: Actor): string => {
  if (actor.kind === "system") return "Icarus";

  if (actor.kind === "user") {
    const row = rowsIn("users").find((candidate) => candidate._id === actor.userId);
    return row?.displayName ?? "Someone";
  }

  if (actor.kind === "connector") {
    const row = rowsIn("connectors").find((candidate) => candidate._id === actor.connectorId);
    return row?.name ?? "A connector";
  }

  const task = rowsIn("agentTasks").find((candidate) => candidate._id === actor.taskId);
  const persona = rowsIn("personas").find((candidate) => candidate._id === task?.personaId);
  const reference = actor.taskId.slice(actor.taskId.indexOf(":") + 1);
  return `${persona?.name ?? "Generalist"} (${reference})`;
};
