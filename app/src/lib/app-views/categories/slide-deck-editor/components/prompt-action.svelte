<script lang="ts">
  import Sparkles from "@lucide/svelte/icons/sparkles";

  import { PanelButton } from "$authored-components/panel";
  import { elementIn } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { withPromptElement } from "$app-views/categories/slide-deck-editor/procedures/prompt-blocks";
  import { workspaceState } from "$model/client/workspace-state";

  let { elementId }: { elementId: string } = $props();

  const view = workspaceState();
  const deckId = view.active.resourceId;
  const runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);

  const makePrompt = () => {
    const current = runtime;
    const body = current?.body;
    if (current === undefined || body === undefined) return;
    const before = elementIn(body, elementId);
    if (before?.content.type !== "text") return;
    const edit = withPromptElement(body, elementId);
    if (edit.ops.length === 0) return;
    current.apply(edit.ops);
    view.inspect("slide-deck-editor.prompt-block", {
      kind: "elements",
      id: elementId,
      ids: [elementId]
    });
    // The runtime owns coalescing and persistence; leaving the inspector does
    // not cancel conversion of the shared slide element.
    void current.flush().catch(() => {
      // The runtime exposes persistence failure through shared sync state. Keep
      // a rejected flush from becoming an unhandled browser error while the
      // newly selected Prompt inspector remains available for recovery.
    });
  };
</script>

<PanelButton
  label="Prompt"
  icon={Sparkles}
  title="Make this text box refresh from project sources"
  onclick={makePrompt}
/>
