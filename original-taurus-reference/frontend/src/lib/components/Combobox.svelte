<script lang="ts">
  import { Check, ChevronDown } from '@lucide/svelte';
  import { cn } from '$lib/utils';
  import type { Size } from './types';

  type Option = { value: string; label: string; disabled?: boolean };

  let {
    value = $bindable(''),
    options = [],
    placeholder = 'Select or type…',
    ariaLabel,
    id,
    size = 'md',
    disabled = false,
    invalid = false,
    class: className = '',
    onchange = undefined
  }: {
    value?: string;
    options?: Option[];
    placeholder?: string;
    ariaLabel: string;
    id?: string;
    size?: Size;
    disabled?: boolean;
    invalid?: boolean;
    class?: string;
    /** Fired when the value is committed (option chosen or field blurred), not per keystroke. */
    onchange?: (value: string) => void;
  } = $props();

  const sizes: Record<Size, string> = {
    sm: 'h-8 pl-2.5 pr-9 text-label',
    md: 'h-9 pl-3 pr-10 text-body-sm',
    lg: 'h-11 pl-3.5 pr-11 text-body'
  };

  const listboxId = $derived(
    `${id ?? ariaLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-options`
  );
  let host = $state<HTMLDivElement>();
  let input = $state<HTMLInputElement>();
  let query = $state('');
  let open = $state(false);
  let focused = $state(false);
  let activeIndex = $state(0);
  let showAll = $state(false);

  const selectedOption = $derived(options.find((option) => option.value === value));
  const filteredOptions = $derived.by(() => {
    const filter =
      showAll || (selectedOption && query === selectedOption.label)
        ? ''
        : query.trim().toLocaleLowerCase();
    if (!filter) return options;
    return options.filter(
      (option) =>
        option.label.toLocaleLowerCase().includes(filter) ||
        option.value.toLocaleLowerCase().includes(filter)
    );
  });

  $effect(() => {
    if (!focused) query = selectedOption?.label ?? value;
  });

  function showOptions(all = false) {
    if (disabled) return;
    showAll = all;
    open = true;
    activeIndex = Math.max(0, filteredOptions.findIndex((option) => !option.disabled));
  }

  function choose(option: Option) {
    if (option.disabled) return;
    value = option.value;
    query = option.label;
    open = false;
    showAll = false;
    input?.focus();
    onchange?.(value);
  }

  function typeValue(event: Event) {
    query = (event.currentTarget as HTMLInputElement).value;
    value = query;
    activeIndex = 0;
    showOptions(false);
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      showOptions(false);
      if (filteredOptions.length === 0) return;
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      let next = activeIndex;
      for (let attempts = 0; attempts < filteredOptions.length; attempts += 1) {
        next = (next + direction + filteredOptions.length) % filteredOptions.length;
        if (!filteredOptions[next]?.disabled) break;
      }
      activeIndex = next;
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      const option = filteredOptions[activeIndex];
      if (option) choose(option);
      else open = false;
    } else if (event.key === 'Escape') {
      event.preventDefault();
      open = false;
    }
  }

  function leave(event: FocusEvent) {
    const next = event.relatedTarget;
    if (next instanceof Node && host?.contains(next)) return;
    focused = false;
    query = query.trim();
    const committed = value !== query;
    value = query;
    open = false;
    showAll = false;
    if (committed) onchange?.(value);
  }
</script>

<div
  bind:this={host}
  class={cn('relative w-full', className)}
  onfocusout={leave}
>
  <div
    class={cn(
      'dur-small relative flex w-full rounded-control border bg-work text-primary transition-colors focus-within:border-focus',
      invalid ? 'border-danger' : 'border-border hover:border-border-strong',
      disabled && 'cursor-not-allowed opacity-50'
    )}
  >
    <input
      bind:this={input}
      value={query}
      {id}
      role="combobox"
      aria-label={ariaLabel}
      aria-autocomplete="list"
      aria-controls={listboxId}
      aria-expanded={open}
      aria-activedescendant={open && filteredOptions[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
      aria-invalid={invalid}
      {placeholder}
      {disabled}
      autocomplete="off"
      onfocus={() => {
        focused = true;
        showOptions(true);
      }}
      oninput={typeValue}
      onkeydown={onKeydown}
      class={cn('min-w-0 flex-1 rounded-control bg-transparent outline-none', sizes[size])}
    />
    <button
      type="button"
      aria-label={`Show ${ariaLabel} options`}
      aria-expanded={open}
      {disabled}
      onpointerdown={(event) => event.preventDefault()}
      onclick={() => {
        if (open && showAll) open = false;
        else {
          focused = true;
          showOptions(true);
          input?.focus();
        }
      }}
      class="dur-micro absolute inset-y-0 right-0 flex w-8 items-center justify-center rounded-r-control text-muted transition-colors hover:bg-panel hover:text-primary"
    >
      <ChevronDown class={cn('size-4 transition-transform', open && 'rotate-180')} />
    </button>
  </div>

  {#if open}
    <ul
      id={listboxId}
      role="listbox"
      aria-label={`${ariaLabel} options`}
      class="surface-elevated absolute left-0 right-0 top-full z-40 mt-1 max-h-52 overflow-y-auto rounded-panel p-1"
    >
      {#each filteredOptions as option, index (option.value)}
        <li role="presentation">
          <button
            id={`${listboxId}-${index}`}
            type="button"
            role="option"
            aria-selected={option.value === value}
            disabled={option.disabled}
            onpointerdown={(event) => event.preventDefault()}
            onmouseenter={() => (activeIndex = index)}
            onclick={() => choose(option)}
            class={cn(
              'dur-micro flex w-full items-center justify-between gap-3 rounded-control px-2 py-1.5 text-left text-label transition-colors',
              index === activeIndex ? 'bg-panel text-primary' : 'text-secondary hover:bg-panel',
              option.disabled && 'opacity-40'
            )}
          >
            <span class="truncate">{option.label}</span>
            {#if option.value === value}
              <Check class="size-3.5 shrink-0 text-action" />
            {/if}
          </button>
        </li>
      {:else}
        <li class="px-2 py-1.5 text-caption text-muted">
          Keep typing to use “{query}”.
        </li>
      {/each}
    </ul>
  {/if}
</div>
