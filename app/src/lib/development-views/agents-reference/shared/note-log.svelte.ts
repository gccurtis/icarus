import { getContext, hasContext, setContext } from "svelte";

import type { Note } from "$development-views/agents-reference/types";

export type LogStatus = "loading" | "ready" | "unavailable";

export type NoteLog = ReturnType<typeof createNoteLog>;

const KEY = Symbol("agents-reference-note-log");

export const createNoteLog = (endpoint: string, page: string) => {
  let notes = $state<Note[]>([]);
  let status = $state<LogStatus>("loading");
  let path = $state("");

  return {
    page,
    get status(): LogStatus {
      return status;
    },
    get total(): number {
      return notes.filter((note) => note.page === page).length;
    },
    get everywhere(): number {
      return notes.length;
    },
    get path(): string {
      return path;
    },

    about(id: string): Note[] {
      return notes.filter((note) => note.page === page && note.id === id);
    },

    async load(): Promise<void> {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) {
          status = "unavailable";
          return;
        }
        const body = (await response.json()) as { path: string; notes: Note[] };
        path = body.path;
        notes = body.notes;
        status = "ready";
      } catch {
        status = "unavailable";
      }
    },

    async add(draft: { id: string; label: string; text: string }): Promise<string | undefined> {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...draft, page })
        });
        if (!response.ok) {
          const said = (await response.text()).trim();
          return said || `the log refused it (${response.status})`;
        }
        notes = [...notes, (await response.json()) as Note];
        status = "ready";
        return undefined;
      } catch {
        status = "unavailable";
        return "the log is unreachable. Is the dev server still running?";
      }
    }
  };
};

export const provideNoteLog = (log: NoteLog): NoteLog => {
  setContext(KEY, log);
  return log;
};

export const noteLog = (): NoteLog | undefined =>
  hasContext(KEY) ? getContext<NoteLog>(KEY) : undefined;
