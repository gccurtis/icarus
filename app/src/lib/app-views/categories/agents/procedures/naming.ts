import type { AutomationItem, ReadAgentsLibraryResult } from "$capabilities/agents/index.remote";
import type { ToolId } from "$representation/data/types/agents/tool";

/** The focus a surface carries when it is showing a thing that does not exist yet. */
export const NEW = "new";

export const isNew = (focus: string | undefined): boolean =>
  focus === undefined || focus === NEW || focus.startsWith(`${NEW}:`);

export const presetPersonaOf = (focus: string | undefined): string | undefined =>
  focus !== undefined && focus.startsWith(`${NEW}:`) ? focus.slice(NEW.length + 1) : undefined;

export const nextName = (base: string, taken: readonly string[]): string => {
  const lower = new Set(taken.map((name) => name.toLocaleLowerCase()));
  if (!lower.has(base.toLocaleLowerCase())) return base;
  let suffix = 2;
  while (lower.has(`${base} ${suffix}`.toLocaleLowerCase())) suffix += 1;
  return `${base} ${suffix}`;
};

export const manualAutomationsIn = (
  answer: ReadAgentsLibraryResult | undefined
): readonly AutomationItem[] =>
  answer?.automations.filter((row) => row.trigger.kind === "manual") ?? [];

export const toolChange = (
  chosen: readonly ToolId[],
  defaults: readonly ToolId[],
  tool: ToolId
): "default" | "added" | "removed" | "off" => {
  const on = chosen.includes(tool);
  const wanted = defaults.includes(tool);
  if (on && wanted) return "default";
  if (on) return "added";
  if (wanted) return "removed";
  return "off";
};
