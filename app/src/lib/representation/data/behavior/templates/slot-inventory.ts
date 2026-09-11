import { segmentsOf } from "$representation/data/behavior/content/positions";
import {
  markedSlotRunsIn,
  promptSlotNamesIn,
  promptSlotsOf,
  slotNamesIn,
  textSlotsOf
} from "$representation/data/behavior/templates/prompt-slots";
import type { Atom, Mark } from "$representation/data/types/content/content-block";
import type { TemplateSlot } from "$representation/data/types/templates/template";

type Fields = Record<string, unknown>;

const isRecord = (value: unknown): value is Fields =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isPrompt = (value: unknown): value is Fields =>
  isRecord(value) && value.type === "prompt" && typeof value.id === "string";

const walkFor = (body: unknown, take: (value: Fields) => boolean): readonly Fields[] => {
  const found: Fields[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    if (!isRecord(value)) return;
    if (take(value)) found.push(value);
    for (const nested of Object.values(value)) walk(nested);
  };
  walk(body);
  return found;
};

const promptsIn = (body: unknown): readonly Fields[] => walkFor(body, isPrompt);

/** Newly marked text slots, before a template-stage save turns them into atoms. */
export const markedTextSlotsOf = (body: unknown): readonly TemplateSlot[] =>
  walkFor(
    body,
    (value) => Array.isArray(value.atoms) && Array.isArray(value.marks) && typeof value.display === "string"
  ).flatMap((block) =>
    markedSlotRunsIn(block.atoms as Atom[], block.marks as Mark[]).map((run) => {
      const description = typeof run.slot.description === "string" ? run.slot.description.trim() : "";
      const text = (block.display as string).slice(run.start, run.end);
      return {
        name: run.slot.name as string,
        label: run.slot.name as string,
        kind: "text" as const,
        ...(description === "" ? {} : { description }),
        ...(text === "" ? {} : { text })
      };
    })
  );

/** Saved metadata combined with the slots present in a live template stage. */
export const liveSlotsOf = (
  body: unknown,
  known: readonly TemplateSlot[]
): readonly TemplateSlot[] => {
  const names = slotNamesIn(body);
  const active = new Set(names);
  const knownByName = new Map(known.map((slot) => [slot.name, slot]));
  const fresh = [
    ...promptSlotsOf(body).map((draft) => draft.slot),
    ...textSlotsOf(body),
    ...markedTextSlotsOf(body)
  ];
  const freshByName = new Map(fresh.map((slot) => [slot.name, slot]));
  const ordered = [
    ...known.map((slot) => slot.name).filter((name) => active.has(name)),
    ...names.filter((name) => !knownByName.has(name))
  ];

  return ordered.map((name) => {
    const held = knownByName.get(name);
    const current = freshByName.get(name);
    if (held === undefined && current !== undefined) return current;
    if (held !== undefined && current === undefined) return held;
    if (held !== undefined && current !== undefined) {
      return {
        ...current,
        ...held,
        kind: current.kind,
        ...(current.text === undefined ? {} : { text: current.text })
      };
    }
    const scope = promptsIn(body).some((prompt) => promptSlotNamesIn(prompt).includes(name));
    return { name, label: name, kind: scope ? "scope" : "text" };
  });
};

export type SlotOccurrence =
  | { readonly kind: "prompt"; readonly name: string; readonly blockId: string }
  | {
      readonly kind: "text";
      readonly name: string;
      readonly blockId: string;
      readonly from: number;
      readonly to: number;
    };

/** The first authored place a slot occupies, for navigation from a slot list. */
export const slotOccurrenceIn = (body: unknown, name: string): SlotOccurrence | undefined => {
  let found: SlotOccurrence | undefined;
  const walk = (value: unknown): void => {
    if (found !== undefined) return;
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    if (!isRecord(value)) return;
    if (isPrompt(value) && promptSlotNamesIn(value).includes(name)) {
      found = { kind: "prompt", name, blockId: value.id as string };
      return;
    }
    if (typeof value.id === "string" && Array.isArray(value.atoms) && Array.isArray(value.marks)) {
      const atoms = value.atoms as Atom[];
      for (const segment of segmentsOf(atoms)) {
        if (segment.atom.kind === "template" && segment.atom.name === name) {
          found = {
            kind: "text",
            name,
            blockId: value.id,
            from: segment.start,
            to: segment.end
          };
          return;
        }
      }
      const marked = markedSlotRunsIn(atoms, value.marks as Mark[]).find(
        (run) => run.slot.name === name
      );
      if (marked !== undefined) {
        found = {
          kind: "text",
          name,
          blockId: value.id,
          from: marked.start,
          to: marked.end
        };
        return;
      }
    }
    for (const nested of Object.values(value)) walk(nested);
  };
  walk(body);
  return found;
};
