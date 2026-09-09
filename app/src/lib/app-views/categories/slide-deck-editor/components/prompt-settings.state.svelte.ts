export class PromptSettingsState {
  running = $state(false);
  actionError = $state<string>();
  promptDraft = $state("");
  hydratedPrompt = $state<string>();

  begin(): void {
    this.running = true;
    this.actionError = undefined;
  }

  fail(error: unknown): void {
    this.actionError = error instanceof Error ? error.message : String(error);
  }

  finish(): void {
    this.running = false;
  }

  hydrate(next: string | undefined): void {
    if (next === undefined || next === this.hydratedPrompt) return;
    if (this.hydratedPrompt === undefined || this.promptDraft === this.hydratedPrompt) {
      this.promptDraft = next;
    }
    this.hydratedPrompt = next;
  }
}
