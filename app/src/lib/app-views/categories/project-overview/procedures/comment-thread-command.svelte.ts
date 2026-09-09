import { reply, resolveThread } from "$capabilities/comments/index.remote";

type Refreshable = { readonly refresh: () => Promise<unknown> };

/** Own the draft, busy state, failure state, and remote sequence for one discussion lens. */
export const commentThreadCommand = () => {
  let draft = $state("");
  let busy = $state(false);
  let error = $state<string | undefined>(undefined);

  const attempt = async (action: () => Promise<void>): Promise<void> => {
    busy = true;
    error = undefined;
    try {
      await action();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "That did not save.";
    } finally {
      busy = false;
    }
  };

  const send = async (
    threadId: string | undefined,
    answer: Refreshable | undefined
  ): Promise<void> => {
    const text = draft.trim();
    if (threadId === undefined || answer === undefined || text.length === 0) return;
    await attempt(async () => {
      await reply({ threadId, text });
      draft = "";
      await answer.refresh();
    });
  };

  const setResolved = async (
    threadId: string | undefined,
    resolved: boolean,
    answer: Refreshable | undefined
  ): Promise<void> => {
    if (threadId === undefined || answer === undefined) return;
    await attempt(async () => {
      await resolveThread({ threadId, resolved });
      await answer.refresh();
    });
  };

  return {
    get draft(): string {
      return draft;
    },
    set draft(value: string) {
      draft = value;
    },
    get busy(): boolean {
      return busy;
    },
    get error(): string | undefined {
      return error;
    },
    send,
    setResolved
  };
};
