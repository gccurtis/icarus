<script lang="ts">
  import type { Snippet } from 'svelte';
  import { tick } from 'svelte';
  import { ArrowUp, ChevronDown, Globe2 } from '@lucide/svelte';
  import { aiModeCopy, aiModeOptions, type AiMode, type AiPersona } from '$data/ai-agent';
  import { cn } from '$lib/utils';

  let {
    mode = $bindable<AiMode>('ask'),
    value = $bindable(''),
    active = false,
    class: className = '',
    placeholders = undefined,
    personas = [],
    personaId = null,
    web = false,
    onsend,
    onmodechange,
    onactivate,
    onfocuschange,
    onpersonachange,
    onwebchange,
    leading
  }: {
    mode?: AiMode;
    value?: string;
    active?: boolean;
    class?: string;
    /** Per-mode placeholder override. The defaults name the open document, which
     *  is wrong anywhere the bar is not sitting over one (e.g. the libraries). */
    placeholders?: Partial<Record<AiMode, string>>;
    /** Selectable personas; the picker renders only when this is non-empty. */
    personas?: AiPersona[];
    /** The current persona id driving the picker — the open chat's persona, or the
     *  pending pick for the chat the next turn creates. */
    personaId?: string | null;
    /** The per-turn live-web flag (the Web toggle's on/off state). */
    web?: boolean;
    onsend?: (value: string, mode: AiMode) => void;
    onmodechange?: (mode: AiMode) => void;
    onactivate?: () => void;
    onfocuschange?: (focused: boolean) => void;
    onpersonachange?: (personaId: string) => void;
    onwebchange?: (on: boolean) => void;
    leading?: Snippet;
  } = $props();

  let composer = $state<HTMLTextAreaElement>();

  function resizeComposer() {
    if (!composer) return;
    composer.style.height = 'auto';
    composer.style.height = `${Math.min(composer.scrollHeight, 88)}px`;
  }

  function submit(e: Event) {
    e.preventDefault();
    if (!value.trim()) return;
    onsend?.(value, mode);
    value = '';
    void tick().then(resizeComposer);
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) submit(event);
  }

  function focusIn() {
    onactivate?.();
    onfocuschange?.(true);
  }

  function focusOut(event: FocusEvent) {
    const form = event.currentTarget as HTMLFormElement;
    if (!(event.relatedTarget instanceof Node) || !form.contains(event.relatedTarget))
      onfocuschange?.(false);
  }

  $effect(() => {
    value;
    void tick().then(resizeComposer);
  });
</script>

<form
  onsubmit={submit}
  onfocusin={focusIn}
  onfocusout={focusOut}
  aria-label="AI Agent composer"
  data-active={active}
  class={cn(
    'surface-elevated flex min-h-qb flex-col overflow-hidden rounded-overlay',
    className
  )}
>
  <div class="flex h-8 shrink-0 items-center gap-1 border-b border-border bg-panel/70 px-2.5">
    {#if leading}
      {@render leading()}
    {:else}
      <span data-ai-agent-mark class="text-caption font-semibold tracking-wide text-muted">AI</span>
    {/if}

    <div class="relative shrink-0">
      <select
        bind:value={mode}
        onchange={() => onmodechange?.(mode)}
        aria-label="AI Agent mode"
        class="dur-micro h-6 appearance-none rounded-control border border-transparent bg-transparent pl-1.5 pr-5 text-caption font-medium text-secondary outline-none transition-colors hover:border-border hover:bg-elevated focus-visible:border-focus"
      >
        {#each aiModeOptions as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
      <ChevronDown
        class="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted"
      />
    </div>

    {#if personas.length}
      <div class="relative shrink-0">
        <select
          value={personaId ?? ''}
          onchange={(e) => onpersonachange?.(e.currentTarget.value)}
          aria-label="Chat persona"
          title="Persona for this chat"
          class="dur-micro h-6 max-w-[8rem] appearance-none truncate rounded-control border border-transparent bg-transparent pl-1.5 pr-5 text-caption font-medium text-secondary outline-none transition-colors hover:border-border hover:bg-elevated focus-visible:border-focus"
        >
          {#each personas as persona (persona.id)}
            <option value={persona.id}>{persona.name}</option>
          {/each}
        </select>
        <ChevronDown
          class="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted"
        />
      </div>
    {/if}

    <span class="min-w-0 flex-1"></span>

    {#if onwebchange}
      {@const webOn = web && mode === 'ask'}
      <button
        type="button"
        onclick={() => onwebchange?.(!web)}
        disabled={mode !== 'ask'}
        aria-pressed={webOn}
        aria-label="Consult the live web"
        title={mode === 'ask'
          ? 'Consult the live web on this Ask turn'
          : 'Web applies to Ask turns'}
        class={cn(
          'dur-micro flex h-6 shrink-0 items-center gap-1 rounded-control border px-1.5 text-caption font-medium transition-colors disabled:opacity-40',
          webOn
            ? 'border-intel/40 bg-intel/12 text-intel'
            : 'border-transparent text-muted hover:border-border hover:bg-elevated hover:text-secondary'
        )}
      >
        <Globe2 class="size-3.5" />
        Web
      </button>
    {/if}

    <button
      type="submit"
      disabled={!value.trim()}
      aria-label={`Send ${mode}`}
      class="dur-small flex size-6 shrink-0 items-center justify-center rounded-control bg-action text-action-fg transition-opacity hover:opacity-90 disabled:opacity-30"
    >
      <ArrowUp class="size-3.5" />
    </button>
  </div>

  <div class="flex w-full px-2.5 py-2">
    <textarea
      bind:this={composer}
      bind:value
      oninput={resizeComposer}
      onkeydown={onKeydown}
      rows="1"
      aria-label="AI Agent prompt"
      placeholder={placeholders?.[mode] ?? aiModeCopy[mode].placeholder}
      class="agent-composer min-h-6 w-full resize-none overflow-y-auto bg-transparent py-px text-body-sm leading-[1.375rem] text-primary outline-none placeholder:text-muted"
    ></textarea>
  </div>
</form>

<style>
  .agent-composer {
    scrollbar-width: none;
  }

  .agent-composer::-webkit-scrollbar {
    display: none;
  }
</style>
