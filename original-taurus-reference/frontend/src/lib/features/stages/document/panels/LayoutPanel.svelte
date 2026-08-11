<script lang="ts">
  import { Combobox, NumberField } from '$lib/components';
  import { inspectorFontOptions } from '$lib/features/shared/inspector-options';
  import type { CustomTypography } from '$data/documents';
  import { editorSession } from '../editor/session';
  import CanonicalLayoutNotice from './shared/CanonicalLayoutNotice.svelte';

  // Documents render as one continuous flow, so there is no page geometry to
  // edit here — the paper's width and margins are read-only server truth. What
  // this panel owns is the document's base (default) typography, the lowest
  // level of the typography cascade.
  const defaultFont = $derived<CustomTypography>($editorSession?.defaultTypography ?? {});
  const defaultFontSize = $derived(parseInt(defaultFont.fontSize ?? '', 10) || 16);
  function setDefault(patch: Partial<CustomTypography>) {
    $editorSession?.actions.setDefaultTypography(patch);
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <p class="text-caption text-muted">Document defaults</p>
  </div>

  <CanonicalLayoutNotice
    message="This document has no canonical layout — block layout changes preview locally but are not saved."
  />

  <section class="space-y-2.5">
    <h3 class="text-label font-medium text-primary">Default typography</h3>
    <p class="text-caption text-muted">The document's base font — blocks and selections override it.</p>
    <Combobox
      value={defaultFont.fontFamily ?? ''}
      ariaLabel="Default font"
      id="layout-default-font"
      options={inspectorFontOptions}
      size="sm"
      placeholder="System default"
      onchange={(value: string) => setDefault({ fontFamily: value })}
    />
    <div class="flex flex-wrap items-center gap-3">
      <span class="flex items-center gap-1 text-caption text-secondary">
        Size
        <NumberField
          value={defaultFontSize}
          ariaLabel="Default font size (px)"
          min={8}
          max={72}
          step={1}
          class="w-16"
          onchange={(value: number) => setDefault({ fontSize: `${value}px` })}
        />
      </span>
      <label class="flex items-center gap-1.5 text-caption text-secondary">
        Text
        <input
          type="color"
          value={defaultFont.fg ?? '#202428'}
          onchange={(event: Event) => setDefault({ fg: (event.currentTarget as HTMLInputElement).value })}
          aria-label="Default text color"
          class="h-6 w-8 rounded border border-border-strong"
        />
      </label>
      <label class="flex items-center gap-1.5 text-caption text-secondary">
        Fill
        <input
          type="color"
          value={defaultFont.bg ?? '#ffffff'}
          onchange={(event: Event) => setDefault({ bg: (event.currentTarget as HTMLInputElement).value })}
          aria-label="Default background color"
          class="h-6 w-8 rounded border border-border-strong"
        />
      </label>
    </div>
  </section>

</div>
