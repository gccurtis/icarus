import {
  startSlideComment,
  type SlideCommentInput
} from "$app-views/categories/slide-deck-editor/procedures/start-comment";

class StartCommentCommand {
  posting = $state(false);
  failed = $state<string | undefined>(undefined);

  start(input: SlideCommentInput, sent: () => void): void {
    if (this.posting) return;
    void this.#start(input, sent);
  }

  #start = async (input: SlideCommentInput, sent: () => void): Promise<void> => {
    this.posting = true;
    this.failed = undefined;
    try {
      await startSlideComment(input);
      sent();
    } catch (error) {
      this.failed = error instanceof Error ? error.message : "The comment was not saved.";
    } finally {
      this.posting = false;
    }
  };
}

export const startCommentCommand = (): StartCommentCommand => new StartCommentCommand();
