import { onMount } from "svelte";

const STORAGE_KEY = "icarus.backlog-investigations.review";
const MAX_RESPONSE_CHARACTERS = 20_000;

const admitted = (raw: string | null, ids: ReadonlySet<string>): Record<string, string> => {
  if (raw === null) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
    const entries = Object.entries(value).filter(
      (entry): entry is [string, string] =>
        ids.has(entry[0]) &&
        typeof entry[1] === "string" &&
        entry[1].length <= MAX_RESPONSE_CHARACTERS
    );
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
};

export const persistReviewResponses = (input: {
  readonly ids: () => readonly string[];
  readonly read: () => Record<string, string>;
  readonly write: (value: Record<string, string>) => void;
  readonly ready: () => boolean;
  readonly setReady: (value: boolean) => void;
}): void => {
  onMount(() => {
    try {
      input.write(admitted(localStorage.getItem(STORAGE_KEY), new Set(input.ids())));
    } finally {
      input.setReady(true);
    }
  });

  $effect(() => {
    const serialized = JSON.stringify(input.read());
    if (!input.ready()) return;
    try {
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      // The review fields still work in memory when storage is unavailable.
    }
  });
};
