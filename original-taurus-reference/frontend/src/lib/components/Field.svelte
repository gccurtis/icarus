<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn, useId } from '$lib/utils';
  import Label from './Label.svelte';

  let {
    label = undefined,
    hint = undefined,
    error = undefined,
    required = false,
    for: forId = undefined,
    class: className = '',
    children
  }: {
    label?: string;
    hint?: string;
    error?: string;
    required?: boolean;
    for?: string;
    class?: string;
    /** Receives wiring ids: `{ id, describedby }` to bind onto the control. */
    children?: Snippet<[{ id: string; describedby: string | undefined }]>;
  } = $props();

  const fallbackId = useId('field');
  const id = $derived(forId ?? fallbackId);
  const descId = useId('desc');
  const describedby = $derived(hint || error ? descId : undefined);
</script>

<div class={cn('flex flex-col gap-1.5', className)}>
  {#if label}
    <Label for={id}>
      {label}{#if required}<span class="text-danger"> *</span>{/if}
    </Label>
  {/if}

  {@render children?.({ id, describedby })}

  {#if error}
    <p id={descId} class="text-caption text-danger">{error}</p>
  {:else if hint}
    <p id={descId} class="text-caption text-muted">{hint}</p>
  {/if}
</div>
