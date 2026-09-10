export type PromptBlockPhase = "creating" | "saving" | "generating";

export class PromptBlockState {
  promptDraft = $state("");
  draftedFor = $state("");
  representedPrompt = $state<string>();
  phase = $state<PromptBlockPhase>();
  actionError = $state<string>();

  select(blockId: string | undefined, prompt: string | undefined): void {
    if (blockId === undefined) return;

    const next = prompt ?? "";
    if (blockId !== this.draftedFor) {
      this.draftedFor = blockId;
      this.promptDraft = next;
      this.representedPrompt = prompt;
      this.actionError = undefined;
      return;
    }

    if (prompt === this.representedPrompt) return;
    if (this.promptDraft === (this.representedPrompt ?? "")) this.promptDraft = next;
    this.representedPrompt = prompt;
  }

  fail(error: unknown): void {
    this.actionError = error instanceof Error ? error.message : String(error);
  }
}
