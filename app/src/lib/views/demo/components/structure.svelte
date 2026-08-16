<script lang="ts">
  import SectionHeading from "$views/demo/components/section-heading.svelte";
  import * as Resizable from "$lib/simple-components/resizable";
  import { ScrollArea } from "$lib/simple-components/scroll-area";
  import { Skeleton } from "$lib/simple-components/skeleton";
  import * as Tabs from "$lib/simple-components/tabs";

  const ROWS = Array.from({ length: 12 }, (_, i) => `Row ${i + 1}`);
</script>

<section class="flex flex-col gap-4">
  <SectionHeading title="Structure" source="shadcn-svelte, bridged to our tokens" />
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    The primitives the application frame will be built from. None of these are wired into
    <code class="font-mono">/app</code> yet — its zones are authored components rather than registry
    ones, so this section is a reference for what they can become.
  </p>

  <h3 class="text-h4 font-semibold">Tabs</h3>
  <Tabs.Root value="one">
    <Tabs.List>
      <Tabs.Trigger value="one">First</Tabs.Trigger>
      <Tabs.Trigger value="two">Second</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="one">
      <p class="text-body-sm text-ink-secondary pt-2">
        The ARIA tablist pattern: this component owns both the tabs and their panels. The
        application's tab bar is a different thing — open objects whose content is the work surface,
        with no panel relationship to declare — so this is a reference rather than a drop-in.
      </p>
    </Tabs.Content>
    <Tabs.Content value="two">
      <p class="text-body-sm text-ink-secondary pt-2">Second panel.</p>
    </Tabs.Content>
  </Tabs.Root>

  <h3 class="text-h4 font-semibold">Scroll area</h3>
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    Suppressed scrollbar chrome that still scrolls by wheel, touch, and keyboard. Your accessibility
    module makes that a hard requirement, not a preference.
  </p>
  <ScrollArea class="border-border-subtle rounded-panel h-40 w-full border p-3">
    <div class="flex flex-col gap-1">
      {#each ROWS as row (row)}
        <span class="text-body-sm text-ink-secondary">{row}</span>
      {/each}
    </div>
  </ScrollArea>

  <h3 class="text-h4 font-semibold">Resizable</h3>
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    What will enforce a panel's range. A user may resize between a minimum and a maximum; nothing may
    drag past either, because below the minimum a panel stops being readable and above the maximum it
    competes with the work surface.
  </p>
  <Resizable.PaneGroup direction="horizontal" class="border-border-subtle rounded-panel h-40 border">
    <Resizable.Pane defaultSize={30} minSize={20} maxSize={45}>
      <div class="text-caption text-ink-muted p-3">context</div>
    </Resizable.Pane>
    <Resizable.Handle withHandle />
    <Resizable.Pane defaultSize={70}>
      <div class="text-caption text-ink-muted p-3">work surface</div>
    </Resizable.Pane>
  </Resizable.PaneGroup>

  <h3 class="text-h4 font-semibold">Skeleton</h3>
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    A pending state. Per the state matrix, a wait names itself in copy — a skeleton shows where
    content will land, it does not replace saying what is being waited on.
  </p>
  <div class="flex flex-col gap-2">
    <Skeleton class="h-4 w-64" />
    <Skeleton class="h-4 w-48" />
  </div>
</section>
