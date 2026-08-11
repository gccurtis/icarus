<script lang="ts">
  import { Sparkles } from '@lucide/svelte';
  import { Badge, Button, Textarea, type Tone } from '$lib/components';
  import type { PromptData } from '$data/documents';
  import { editorSession } from '../../../editor/session';

  // AI prompt block: instruction, resolve, status, evidence, and last output.
  let { blockId }: { blockId: string } = $props();

  const promptStatusTone: Record<NonNullable<PromptData['status']>, Tone> = {
    ok: 'success',
    insufficient: 'attention',
    contradiction: 'danger'
  };
  const promptStatusLabel: Record<NonNullable<PromptData['status']>, string> = {
    ok: 'Grounded',
    insufficient: 'Insufficient evidence',
    contradiction: 'Contradiction'
  };

  const prompt = $derived($editorSession?.blockPrompts[blockId] ?? {});

  // The instruction is a local draft, re-seeded when the block or its server
  // instruction changes (e.g. after a resolve or a reload).
  let promptDraft = $state('');
  let promptFor = $state('');
  $effect(() => {
    const instruction = $editorSession?.blockPrompts[blockId]?.instruction ?? '';
    const key = `${blockId}:${instruction}`;
    if (key !== promptFor) {
      promptFor = key;
      promptDraft = instruction;
    }
  });
</script>

<div class="space-y-2.5 border-t border-border pt-3">
  <div class="flex items-center justify-between gap-2">
    <p class="text-caption text-secondary">AI prompt</p>
    {#if prompt.status}
      <Badge tone={promptStatusTone[prompt.status]}>{promptStatusLabel[prompt.status]}</Badge>
    {/if}
  </div>
  <Textarea
    bind:value={promptDraft}
    rows={3}
    aria-label="Prompt instruction"
    placeholder="Describe what this block should generate from the project's sources…"
    onchange={() => $editorSession?.actions.setPrompt(promptDraft)}
  />
  <Button
    size="sm"
    variant="secondary"
    class="w-full"
    disabled={$editorSession?.resolving || !promptDraft.trim()}
    onclick={() => $editorSession?.actions.resolvePrompt()}
  >
    <Sparkles class="size-4" />
    {$editorSession?.resolving ? 'Resolving…' : 'Resolve'}
  </Button>
  {#if prompt.lastOutput}
    <div class="rounded-control border border-border bg-work p-2">
      <p class="mb-1 text-caption text-muted">Last output</p>
      <p class="whitespace-pre-wrap text-body-sm leading-relaxed text-secondary">
        {prompt.lastOutput}
      </p>
    </div>
  {/if}
  {#if prompt.evidence?.length}
    <div class="space-y-1">
      <p class="text-caption text-muted">Evidence · {prompt.evidence.length}</p>
      {#each prompt.evidence as ev, index (index)}
        <p class="truncate text-caption text-secondary" title={ev.text}>{ev.text}</p>
      {/each}
    </div>
  {/if}
</div>
