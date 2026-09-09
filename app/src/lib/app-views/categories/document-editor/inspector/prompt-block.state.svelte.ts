export type PromptBlockPhase = "creating" | "saving" | "generating";

export class PromptBlockState {
  promptDraft = $state("");
  draftedFor = $state("");
  phase = $state<PromptBlockPhase>();
  actionError = $state<string>();

  select(blockId: string | undefined): void {
    if (blockId === undefined || blockId === this.draftedFor) return;
    this.draftedFor = blockId;
    this.promptDraft = "";
    this.actionError = undefined;
  }

  fail(error: unknown): void {
    this.actionError = error instanceof Error ? error.message : String(error);
  }
}
