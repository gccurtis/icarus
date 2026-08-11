<script lang="ts">
  import { Minus, Plus } from '@lucide/svelte';
  import { cn } from '$lib/utils';

  let {
    value = $bindable(0),
    min = undefined,
    max = undefined,
    step = 1,
    ariaLabel,
    suffix = undefined,
    readonly = false,
    disabled = false,
    invalid = false,
    class: className = '',
    onchange = undefined
  }: {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    ariaLabel: string;
    suffix?: string;
    readonly?: boolean;
    disabled?: boolean;
    invalid?: boolean;
    class?: string;
    onchange?: (value: number) => void;
  } = $props();

  let draft = $state(String(value));
  let focused = $state(false);

  $effect(() => {
    if (!focused) draft = String(value);
  });

  function bounded(next: number) {
    return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, next));
  }

  function commit(next = Number(draft)) {
    if (!Number.isFinite(next)) {
      draft = String(value);
      return;
    }
    value = bounded(next);
    draft = String(value);
    onchange?.(value);
  }

  function typeValue(event: Event) {
    draft = (event.currentTarget as HTMLInputElement).value;
    const next = Number(draft);
    if (draft !== '' && Number.isFinite(next)) value = bounded(next);
  }

  function changeBy(direction: -1 | 1) {
    const base = Number.isFinite(Number(draft)) ? Number(draft) : value;
    commit(base + direction * step);
  }

  function onKeydown(event: KeyboardEvent) {
    if (readonly || disabled) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      changeBy(event.key === 'ArrowUp' ? 1 : -1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      draft = String(value);
    }
  }
</script>

<div
  role="group"
  aria-label={`${ariaLabel} field`}
  class={cn(
    'dur-small flex h-8 overflow-hidden rounded-control text-primary transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
    invalid && 'outline-2 outline-offset-2 outline-danger',
    disabled && 'opacity-50',
    className || 'w-20'
  )}
>
  <div class="flex min-w-0 flex-1 items-center gap-1 px-1.5">
    <input
      bind:value={draft}
      type="text"
      inputmode="decimal"
      aria-label={ariaLabel}
      aria-invalid={invalid}
      data-min={min}
      data-max={max}
      {readonly}
      {disabled}
      onfocus={() => (focused = true)}
      onblur={() => {
        focused = false;
        commit();
      }}
      oninput={typeValue}
      onkeydown={onKeydown}
      class="min-w-0 flex-1 bg-transparent text-right text-label tabular-nums outline-none"
    />
    {#if suffix}
      <span class="shrink-0 text-caption text-muted">{suffix}</span>
    {/if}
  </div>

  {#if !readonly}
    <div class="flex w-5 shrink-0 flex-col">
      <button
        type="button"
        aria-label={`Increase ${ariaLabel}`}
        disabled={disabled || (max !== undefined && value >= max)}
        onclick={() => changeBy(1)}
        class="dur-micro flex flex-1 items-center justify-center text-muted transition-colors hover:text-primary disabled:opacity-30"
      >
        <Plus class="size-2.5" />
      </button>
      <button
        type="button"
        aria-label={`Decrease ${ariaLabel}`}
        disabled={disabled || (min !== undefined && value <= min)}
        onclick={() => changeBy(-1)}
        class="dur-micro flex flex-1 items-center justify-center text-muted transition-colors hover:text-primary disabled:opacity-30"
      >
        <Minus class="size-2.5" />
      </button>
    </div>
  {/if}
</div>
