import { reply, resolveThread } from "$capabilities/comments/index.remote";

class CommentThreadCommand {
  busy = $state(false);
  failed = $state<string | undefined>(undefined);

  #attempt = async (action: () => Promise<void>): Promise<void> => {
    this.busy = true;
    this.failed = undefined;
    try {
      await action();
    } catch (error) {
      this.failed = error instanceof Error ? error.message : "That did not save.";
    } finally {
      this.busy = false;
    }
  };

  reply(threadId: string, text: string, sent: () => void): void {
    void this.#attempt(async () => {
      await reply({ threadId, text });
      sent();
    });
  }

  setResolved(threadId: string, resolved: boolean): void {
    void this.#attempt(async () => {
      await resolveThread({ threadId, resolved });
    });
  }
}

export const commentThreadCommand = (): CommentThreadCommand => new CommentThreadCommand();
