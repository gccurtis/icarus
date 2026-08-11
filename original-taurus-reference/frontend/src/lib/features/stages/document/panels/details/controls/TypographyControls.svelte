<script lang="ts">
  import { Bold, Code, Italic, Quote as QuoteIcon, Strikethrough, Underline } from '@lucide/svelte';
  import { Combobox, Input, NumberField, Select, toast } from '$lib/components';
  import { inspectorFontOptions, inspectorReferenceOptions } from '$lib/features/shared/inspector-options';
  import type { MarkKind } from '$data/documents';
  import { cn } from '$lib/utils';
  import { editorSession, type TypographyState } from '../../../editor/session';
  import ColorPopover from './ColorPopover.svelte';

  // Inline formatting for the three text-bearing lenses (Selected Text, Next Text,
  // New Block). Everything here is a range-based mark, so it applies to the selection
  // or is stored for the next typed character — never to a whole block.
  let {
    typography,
    selectionKey
  }: { typography: TypographyState; selectionKey: string } = $props();

  const styleToggles: { kind: MarkKind; label: string; icon: typeof Bold }[] = [
    { kind: 'bold', label: 'Bold', icon: Bold },
    { kind: 'italic', label: 'Italic', icon: Italic },
    { kind: 'underline', label: 'Underline', icon: Underline },
    { kind: 'strike', label: 'Strikethrough', icon: Strikethrough },
    { kind: 'code', label: 'Code', icon: Code }
  ];

  // Color-popover state (foreground + background) and the shared native picker.
  let fgOpen = $state(false);
  let bgOpen = $state(false);
  let colorTarget = $state<'fg' | 'bg'>('fg');
  let colorPicker = $state<HTMLInputElement>();
  // The reference draft is local until committed, so typing is never clobbered.
  let referenceType = $state('link');
  let linkDraft = $state('');
  let linkFor = $state('');

  const currentFontFamily = $derived(typography.fontFamily ?? '');
  // Font size shown as a number (px); Omega stores the string form ("16px").
  const currentFontSize = $derived(parseInt(typography.fontSize ?? '', 10) || 16);
  const currentFg = $derived(typography.fg || '#202428');
  const currentBg = $derived(typography.bg || '#ffffff');

  // Re-seed the reference draft when the inspected target changes, not on every render.
  $effect(() => {
    if (selectionKey !== linkFor) {
      linkFor = selectionKey;
      linkDraft = typography.linkHref ?? '';
      referenceType = 'link';
    }
  });

  // Apply/clear an inline color mark; a blank value clears it.
  function applyColor(target: 'fg' | 'bg', value: string) {
    $editorSession?.actions.setInlineStyle(target, value ? { value } : null);
    fgOpen = false;
    bgOpen = false;
  }

  function commitReference() {
    if (referenceType !== 'link') {
      toast(
        `Adding a ${referenceType} reference is mocked until Omega supports this inspector capability.`,
        { tone: 'attention' }
      );
      return;
    }
    $editorSession?.actions.setLink(linkDraft.trim() || null);
  }
</script>

<!-- Hidden native color input, opened by a popover's "Custom color…" action. -->
<input
  bind:this={colorPicker}
  value={colorTarget === 'fg' ? currentFg : currentBg}
  onchange={(event: Event) =>
    applyColor(colorTarget, (event.currentTarget as HTMLInputElement).value)}
  type="color"
  aria-label="Custom color"
  class="sr-only"
/>

<div class="space-y-2.5">
  <div class="space-y-2">
    <p class="text-caption text-secondary">Font</p>
    <Combobox
      value={currentFontFamily}
      ariaLabel="Font family"
      id="inspector-font"
      options={inspectorFontOptions}
      size="sm"
      placeholder="Default font"
      onchange={(family: string) => $editorSession?.actions.setInlineStyle('font', { family })}
    />
    <div class="flex items-center gap-1.5">
      <span class="flex items-center gap-1 text-caption text-secondary">
        Size
        <NumberField
          value={currentFontSize}
          ariaLabel="Font size (px)"
          min={6}
          max={144}
          step={1}
          class="w-16"
          onchange={(px: number) => $editorSession?.actions.setInlineStyle('font', { size: `${px}px` })}
        />
      </span>
      <div class="relative">
        <button
          onclick={() => {
            fgOpen = !fgOpen;
            bgOpen = false;
          }}
          aria-label="FG color"
          aria-expanded={fgOpen}
          class="flex h-7 items-center gap-1.5 rounded-control px-1.5 text-caption text-secondary hover:bg-elevated"
        >
          <span>FG</span>
          <span
            class="size-4 rounded-sm border border-border-strong"
            style={`background-color: ${currentFg}`}
          ></span>
        </button>
        {#if fgOpen}
          <ColorPopover
            target="fg"
            current={currentFg}
            onpick={(value) => applyColor('fg', value)}
            oncustom={() => {
              colorTarget = 'fg';
              colorPicker?.click();
            }}
          />
        {/if}
      </div>
      <div class="relative">
        <button
          onclick={() => {
            bgOpen = !bgOpen;
            fgOpen = false;
          }}
          aria-label="BG color"
          aria-expanded={bgOpen}
          class="flex h-7 items-center gap-1.5 rounded-control px-1.5 text-caption text-secondary hover:bg-elevated"
        >
          <span>BG</span>
          <span
            class="size-4 rounded-sm border border-border-strong"
            style={`background-color: ${currentBg}`}
          ></span>
        </button>
        {#if bgOpen}
          <ColorPopover
            target="bg"
            current={currentBg}
            onpick={(value) => applyColor('bg', value)}
            oncustom={() => {
              colorTarget = 'bg';
              colorPicker?.click();
            }}
          />
        {/if}
      </div>
    </div>
  </div>

  <div class="flex items-center gap-0.5">
    {#each styleToggles as toggle (toggle.kind)}
      {@const Icon = toggle.icon}
      <button
        onclick={() => $editorSession?.actions.toggleMark(toggle.kind)}
        aria-label={toggle.label}
        aria-pressed={typography.marks[toggle.kind]}
        title={toggle.label}
        class={cn(
          'dur-micro flex size-6 items-center justify-center rounded-control transition-colors',
          typography.marks[toggle.kind]
            ? 'bg-action/12 text-action'
            : 'text-muted hover:bg-elevated hover:text-primary'
        )}
      >
        <Icon class="size-4" />
      </button>
    {/each}
    <button
      onclick={() => $editorSession?.actions.quoteSelection()}
      aria-label="Wrap selection in quotation marks"
      title="Quote"
      class="dur-micro flex size-6 items-center justify-center rounded-control text-muted transition-colors hover:bg-elevated hover:text-primary"
    >
      <QuoteIcon class="size-3.5" />
    </button>
  </div>

  <div class="space-y-2">
    <p class="text-caption text-secondary">Reference</p>
    <Select
      bind:value={referenceType}
      aria-label="Reference type"
      options={inspectorReferenceOptions}
      size="sm"
    />
    <Input
      bind:value={linkDraft}
      aria-label="Reference target"
      placeholder={referenceType === 'link' ? 'https://…' : 'Choose a target…'}
      onchange={commitReference}
      onkeydown={(event: KeyboardEvent) => event.key === 'Enter' && commitReference()}
    />
  </div>
</div>
