<script lang="ts">
  import SectionHeading from "$lib/demo/section-heading.svelte";

  /**
   * Each class is written out in full rather than built as `text-{token}`.
   * Tailwind scans source text for literal candidates, so an interpolated class
   * name generates nothing — the previous version of this page interpolated,
   * which meant `text-body-lg` was never emitted and its row silently rendered
   * at the inherited size. A demo that does not generate the utility it claims
   * to show is worse than no demo.
   */
  const SCALE = [
    { cls: "text-h1", token: "h1", use: "Major screen or page title" },
    { cls: "text-h2", token: "h2", use: "Document section or modal title" },
    { cls: "text-h3", token: "h3", use: "Panel major heading, object title" },
    { cls: "text-h4", token: "h4", use: "Inspector and drawer section heading" },
    { cls: "text-body-lg", token: "body-lg", use: "Optional long-form editor body" },
    { cls: "text-body", token: "body", use: "Main prose and document content" },
    { cls: "text-body-sm", token: "body-sm", use: "Panels, tables, inspector body" },
    { cls: "text-label", token: "label", use: "Controls, tabs, field labels" },
    { cls: "text-caption", token: "caption", use: "Metadata, helper text, status" },
  ];
</script>

<section class="flex flex-col gap-4">
  <SectionHeading title="Typography" source="system/typography/component.md" />
  <div class="flex flex-col gap-3">
    {#each SCALE as { cls, token, use } (token)}
      <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span class="text-caption text-ink-muted w-24 shrink-0 font-mono">{token}</span>
        <span class={cls}>The work surface is sacred</span>
        <span class="text-caption text-ink-muted">{use}</span>
      </div>
    {/each}
    <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <span class="text-caption text-ink-muted w-24 shrink-0 font-mono">mono</span>
      <span class="text-mono font-mono tabular-nums">2026-08-12T09:41:07.284Z</span>
      <span class="text-caption text-ink-muted">Identifiers, timestamps, technical data</span>
    </div>
  </div>
</section>
