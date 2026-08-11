<script lang="ts">
  import { Sparkles } from '@lucide/svelte';
  import { Modal, Field, Textarea, Select, Button, Badge } from '$lib/components';
  import { type ResourceKind } from '$data/resources';

  let {
    open = $bindable(false),
    oncreate
  }: { open?: boolean; oncreate: (kind: ResourceKind, prompt: string) => void } = $props();

  let prompt = $state('');
  let kind = $state<ResourceKind>('document');

  const kindOptions = [
    { value: 'document', label: 'Document' },
    { value: 'spreadsheet', label: 'Sheet' },
    { value: 'slides', label: 'Slides' },
    { value: 'chat', label: 'Chat' }
  ];

  // Reset the form each time the dialog opens.
  $effect(() => {
    if (open) {
      prompt = '';
      kind = 'document';
    }
  });

  function generate() {
    if (!prompt.trim()) return;
    oncreate(kind, prompt.trim());
    open = false;
  }
</script>

<Modal bind:open title="Create with AI" size="md">
  <div class="space-y-4">
    <p class="text-caption text-muted">
      Documents are generated from your prompt in the background. Other types create a blank resource
      to start from.
    </p>

    <Field label="What do you want to make?">
      {#snippet children({ id })}
        <Textarea {id} bind:value={prompt} rows={4} placeholder="e.g. A slide deck pitching our Q3 launch to execs…" />
      {/snippet}
    </Field>

    <div class="flex items-end gap-3">
      <Field label="Type" class="w-44">
        {#snippet children({ id })}
          <Select {id} bind:value={kind} options={kindOptions} />
        {/snippet}
      </Field>
      <Button variant="primary" onclick={generate} disabled={!prompt.trim()} class="ml-auto">
        <Sparkles class="size-4" /> Generate
      </Button>
    </div>
  </div>
</Modal>
