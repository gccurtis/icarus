# src/lib/features/stages/new-tab/AiCreateDialog.svelte — breakdown

Companion to [AiCreateDialog.svelte](AiCreateDialog.svelte). The "Create with AI"
modal opened from the New-tab launcher: describe what you want, pick a resource type,
and Generate. **Mock** — no model is wired yet, so it drafts a titled placeholder;
generation is filed as [backend-requests/ai-generation.md](../../../../../docs/backend-requests/ai-generation.md).

## Script

### Props, form state, and generate

```svelte
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
```

`open` is the bindable modal flag; `oncreate(kind, prompt)` hands the request back to
the launcher (which seeds a resource and resolves its tab). `prompt`/`kind` are the
form state, reset whenever the dialog opens. `generate` validates a non-empty prompt,
fires `oncreate`, and closes.

## Markup

### Prompt, type picker, and Generate

```svelte

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
```

Inside a `Modal`: a **Mock** disclaimer, a `Textarea` for the description, a `Select`
for the resource type, and a primary **Generate** button (disabled until the prompt has
text). Generate is the only exit that creates — closing the modal otherwise does
nothing.
