<script lang="ts">
  import * as Dialog from "$vendored-components/dialog";
  import DefinitionPanel from "$app-views/categories/agents/components/definition-panel.svelte";

  let {
    personaId,
    name,
    section,
    open,
    onclose
  }: {
    personaId: string;
    name: string;
    section: string;
    open: boolean;
    onclose: () => void;
  } = $props();
</script>

<Dialog.Root
  {open}
  onOpenChange={(next: boolean) => {
    if (!next) onclose();
  }}
>
  <Dialog.Content class="flex h-[36rem] max-h-[85vh] w-[52rem] flex-col sm:max-w-[52rem]">
    <Dialog.Header>
      <Dialog.Title>{name}</Dialog.Title>
      <Dialog.Description>
        What this persona is told about itself, before anything is asked of it.
      </Dialog.Description>
    </Dialog.Header>

    {#key section}
      <DefinitionPanel {personaId} {section} withSave />
    {/key}
  </Dialog.Content>
</Dialog.Root>
