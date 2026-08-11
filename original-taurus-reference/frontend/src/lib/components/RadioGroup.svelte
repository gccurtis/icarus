<script lang="ts">
  import { cn, useId } from '$lib/utils';

  type Option = { value: string; label: string; disabled?: boolean };

  let {
    value = $bindable(''),
    options = [],
    name = undefined,
    class: className = ''
  }: {
    value?: string;
    options?: Option[];
    name?: string;
    class?: string;
  } = $props();

  const fallbackName = useId('radio');
  const groupName = $derived(name ?? fallbackName);
</script>

<div role="radiogroup" class={cn('flex flex-col gap-2', className)}>
  {#each options as opt (opt.value)}
    <label
      class={cn(
        'inline-flex items-center gap-2 text-body-sm text-primary',
        opt.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      )}
    >
      <input
        type="radio"
        name={groupName}
        value={opt.value}
        bind:group={value}
        disabled={opt.disabled}
        class="peer sr-only"
      />
      <span
        class={cn(
          'dur-micro relative flex size-[18px] items-center justify-center rounded-full border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
          value === opt.value ? 'border-action' : 'border-border-strong'
        )}
      >
        {#if value === opt.value}
          <span class="size-2.5 rounded-full bg-action"></span>
        {/if}
      </span>
      <span>{opt.label}</span>
    </label>
  {/each}
</div>
