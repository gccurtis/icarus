<script lang="ts">
  import SectionHeading from "$views/development/demo/components/section-heading.svelte";
  import { Button } from "$vendored-components/button";
  import * as Dialog from "$vendored-components/dialog";
  import * as DropdownMenu from "$vendored-components/dropdown-menu";
  import * as Sheet from "$vendored-components/sheet";
  import * as Tooltip from "$vendored-components/tooltip";
</script>

<section class="flex flex-col gap-4">
  <SectionHeading title="Overlays" source="system/interaction/theory.md → disclosure ladder" />
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    Rungs three and four of the disclosure ladder. A dropdown groups named secondary actions; a
    sheet is a place to work beside what you were doing; a modal interrupts, so it has to earn the
    interruption.
  </p>

  <div class="flex flex-wrap items-center gap-3">
    <!-- Rung 3 — a named secondary group. The label has to be predictable
         before it is opened, which is what separates "Arrange" from "Misc". -->
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="outline">Review</Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content class="w-48">
        <DropdownMenu.Group>
          <DropdownMenu.GroupHeading>Derived work</DropdownMenu.GroupHeading>
          <DropdownMenu.Item>Accept changes</DropdownMenu.Item>
          <DropdownMenu.Item>Revert changes</DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item>Inspect provenance</DropdownMenu.Item>
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu.Root>

    <!-- An accelerator, never the only route: a tooltip names what an icon
         means, it does not carry the affordance. -->
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <Button {...props} variant="ghost">Hover me</Button>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content>Names what a control does. Never the only route to it.</Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>

    <!-- Rung 4, non-modal: work on one object while the surrounding work stays
         visible. -->
    <Sheet.Root>
      <Sheet.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="outline">Open drawer</Button>
        {/snippet}
      </Sheet.Trigger>
      <Sheet.Content side="right">
        <Sheet.Header>
          <Sheet.Title>Drawer</Sheet.Title>
          <Sheet.Description>
            A workbench for one object. Non-modal — the work behind it stays visible and in place.
          </Sheet.Description>
        </Sheet.Header>
      </Sheet.Content>
    </Sheet.Root>

    <!-- Rung 4, modal: for a decision that must not be made accidentally, and
         for nothing else. -->
    <Dialog.Root>
      <Dialog.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="destructive">Delete</Button>
        {/snippet}
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Delete this object?</Dialog.Title>
          <Dialog.Description>
            A modal interrupts, so it must earn the interruption. This one names the consequence
            rather than asking whether you are sure.
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
          <Dialog.Close>
            {#snippet child({ props })}
              <Button {...props} variant="outline">Cancel</Button>
            {/snippet}
          </Dialog.Close>
          <Button variant="destructive">Delete</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  </div>
</section>
