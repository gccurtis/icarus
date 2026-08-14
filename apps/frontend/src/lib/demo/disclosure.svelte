<script lang="ts">
  import SectionHeading from "$lib/demo/section-heading.svelte";
  import * as Accordion from "$lib/simple-components/accordion";
  import * as AlertDialog from "$lib/simple-components/alert-dialog";
  import * as Breadcrumb from "$lib/simple-components/breadcrumb";
  import { Button } from "$lib/simple-components/button";
  import * as Collapsible from "$lib/simple-components/collapsible";
  import * as ContextMenu from "$lib/simple-components/context-menu";
  import * as HoverCard from "$lib/simple-components/hover-card";
  import { Kbd } from "$lib/simple-components/kbd";
  import * as Popover from "$lib/simple-components/popover";
</script>

<section class="flex flex-col gap-4">
  <SectionHeading title="Disclosure" source="system/interaction/theory.md" />
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    Depth ordered rather than hidden. The default view answers the common question, one step reaches
    the supporting material, and full lineage stays reachable without being imposed.
  </p>

  <div class="flex flex-wrap items-center gap-3">
    <!-- One step to the supporting material: what produced a value, from what. -->
    <Popover.Root>
      <Popover.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="outline">Provenance</Button>
        {/snippet}
      </Popover.Trigger>
      <Popover.Content class="w-72">
        <p class="text-body-sm text-ink-secondary">
          Derived output that cannot show where it came from is not finished, and must not look
          finished.
        </p>
      </Popover.Content>
    </Popover.Root>

    <!-- Hover is an accelerator. It may reveal, but never carries the only route. -->
    <HoverCard.Root>
      <HoverCard.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="ghost">Hover for detail</Button>
        {/snippet}
      </HoverCard.Trigger>
      <HoverCard.Content class="w-64">
        <p class="text-body-sm text-ink-secondary">
          An accelerator, not a path. Anything reachable only by hover does not exist for most users.
        </p>
      </HoverCard.Content>
    </HoverCard.Root>

    <!-- Right-click accelerates a visible path; it never replaces one. -->
    <ContextMenu.Root>
      <ContextMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="outline">Right-click me</Button>
        {/snippet}
      </ContextMenu.Trigger>
      <ContextMenu.Content class="w-48">
        <ContextMenu.Item>Inspect</ContextMenu.Item>
        <ContextMenu.Item>Refresh binding</ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item>Revert</ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>

    <!-- A modal for a decision that must not be made accidentally, and nothing else. -->
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="destructive">Revert changes</Button>
        {/snippet}
      </AlertDialog.Trigger>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Revert derived changes?</AlertDialog.Title>
          <AlertDialog.Description>
            Names the consequence rather than asking whether you are sure.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Keep</AlertDialog.Cancel>
          <AlertDialog.Action>Revert</AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  </div>

  <h3 class="text-h4 font-semibold">Breadcrumb</h3>
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    What the inspection ancestry renders as. Selected text inside a table inside a document is one
    caret with three plausible targets; the innermost shows by default and the rest stay one step
    away.
  </p>
  <Breadcrumb.Root>
    <Breadcrumb.List>
      <Breadcrumb.Item><Breadcrumb.Link href="##">Document</Breadcrumb.Link></Breadcrumb.Item>
      <Breadcrumb.Separator />
      <Breadcrumb.Item><Breadcrumb.Link href="##">Table</Breadcrumb.Link></Breadcrumb.Item>
      <Breadcrumb.Separator />
      <Breadcrumb.Item><Breadcrumb.Page>Selection</Breadcrumb.Page></Breadcrumb.Item>
    </Breadcrumb.List>
  </Breadcrumb.Root>

  <h3 class="text-h4 font-semibold">Collapsible and accordion</h3>
  <div class="flex flex-col gap-4">
    <Collapsible.Root>
      <Collapsible.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="ghost" size="sm">Show inputs</Button>
        {/snippet}
      </Collapsible.Trigger>
      <Collapsible.Content>
        <p class="text-body-sm text-ink-secondary pt-2">
          The inputs behind a result. Depth that cannot be skipped is not depth; it is friction.
        </p>
      </Collapsible.Content>
    </Collapsible.Root>

    <Accordion.Root type="single">
      <Accordion.Item value="a">
        <Accordion.Trigger>What produced this?</Accordion.Trigger>
        <Accordion.Content>
          <p class="text-body-sm text-ink-secondary">The run, its scope, and when it resolved.</p>
        </Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="b">
        <Accordion.Trigger>From what inputs?</Accordion.Trigger>
        <Accordion.Content>
          <p class="text-body-sm text-ink-secondary">Each input, and the origin behind it.</p>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  </div>

  <h3 class="text-h4 font-semibold">Keyboard</h3>
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    Accelerators name themselves. A shortcut that is the fastest route to a common task means the
    navigation is wrong.
  </p>
  <div class="flex flex-wrap items-center gap-2">
    <Kbd>⌘</Kbd><Kbd>K</Kbd>
    <span class="text-caption text-ink-muted">opens command search</span>
  </div>
</section>
