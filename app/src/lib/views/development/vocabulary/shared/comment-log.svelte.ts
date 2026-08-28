import { getContext, setContext } from "svelte";

/** One note, exactly as the log stores it. */
export type VocabularyComment = {
  /** When the server wrote it. */
  at: string;
  /** `<scope>/<slug>` — which row the note is about. */
  id: string;
  /** That row's label, kept so the log reads without the page. */
  label: string;
  text: string;
};

export type CommentLog = ReturnType<typeof createCommentLog>;

/** Whether the log answered. A page that cannot save has to say so, not fail quietly. */
export type LogStatus = "loading" | "ready" | "unavailable";

const KEY = Symbol("vocabulary-comment-log");

/**
 * Every note on the page, and the one place that talks to the log.
 *
 * **Nothing is appended optimistically.** A note appears under its row only once
 * the server has written the line, because this page's whole claim is that it
 * does not show something working that is not. A note that rendered before it
 * was saved would be the same lie in miniature.
 *
 * One instance per mounted page, held in context rather than at module scope, so
 * two mounts cannot share a list.
 */
export const createCommentLog = (endpoint: string) => {
  let comments = $state<VocabularyComment[]>([]);
  let status = $state<LogStatus>("loading");
  let path = $state("");

  return {
    get status(): LogStatus {
      return status;
    },
    get total(): number {
      return comments.length;
    },
    /** Where the log lives on disk, as the server reported it. */
    get path(): string {
      return path;
    },

    /** The notes on one row, oldest first. */
    about(id: string): VocabularyComment[] {
      return comments.filter((comment) => comment.id === id);
    },

    async load(): Promise<void> {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) {
          status = "unavailable";
          return;
        }

        const body = (await response.json()) as { path: string; comments: VocabularyComment[] };
        path = body.path;
        comments = body.comments;
        status = "ready";
      } catch {
        status = "unavailable";
      }
    },

    /**
     * Append one note. Returns the reason it failed, or `undefined` on success —
     * the caller keeps the draft either way, so nothing typed is ever lost to a
     * dev server that stopped.
     */
    async add(draft: { id: string; label: string; text: string }): Promise<string | undefined> {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft)
        });

        if (!response.ok) {
          const said = (await response.text()).trim();
          return said || `the log refused it (${response.status})`;
        }

        comments = [...comments, (await response.json()) as VocabularyComment];
        status = "ready";
        return undefined;
      } catch {
        status = "unavailable";
        return "the log is unreachable — is the dev server still running?";
      }
    }
  };
};

export const provideCommentLog = (log: CommentLog): void => {
  setContext(KEY, log);
};

export const commentLog = (): CommentLog => getContext<CommentLog>(KEY);
