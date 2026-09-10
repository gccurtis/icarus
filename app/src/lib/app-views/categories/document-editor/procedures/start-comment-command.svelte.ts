import {
  startDocumentComment,
  type DocumentCommentInput
} from "$app-views/categories/document-editor/procedures/start-comment";

class StartCommentCommand {
  sending = $state(false);
  failed = $state<string | undefined>(undefined);

  start(input: DocumentCommentInput, sent: () => void): void {
    if (this.sending) return;
    void this.#start(input, sent);
  }

  #start = async (input: DocumentCommentInput, sent: () => void): Promise<void> => {
    this.sending = true;
    this.failed = undefined;
    try {
      await startDocumentComment(input);
      sent();
    } catch (error) {
      this.failed = error instanceof Error ? error.message : "The comment was not saved.";
    } finally {
      this.sending = false;
    }
  };
}

export const startCommentCommand = (): StartCommentCommand => new StartCommentCommand();
