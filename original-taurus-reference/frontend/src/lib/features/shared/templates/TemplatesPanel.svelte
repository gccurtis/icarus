<script lang="ts">
  import { SquareStack } from '@lucide/svelte';
  import { Button, Input, MockBadge, RadioGroup, toast } from '$lib/components';
  import AddTemplateModal from './AddTemplateModal.svelte';

  // The Templates rail panel — the in-editor face of the template library
  // (2026-07-28 plan). Two sections: drop a template in, or make one from what
  // you have. Both are MOCKED (badged): there is no template backend yet.
  //
  // `scope` only changes the Make section: a slides deck can be saved per-slide
  // or whole-deck; a document is its own scope. Rail sections render with no
  // props, so each stage registers a tiny wrapper that pins its scope.
  let { scope = 'document' }: { scope?: 'document' | 'slides' } = $props();

  let addOpen = $state(false);
  let name = $state('');
  let description = $state('');
  let slideScope = $state('slide');

  function makeTemplate() {
    const made = name.trim();
    if (!made) return;
    const what =
      scope === 'slides' ? (slideScope === 'deck' ? 'the whole deck' : 'this slide') : 'this document';
    toast(`“${made}” would be saved from ${what} — templates are mocked for now.`, {
      tone: 'intel'
    });
    name = '';
    description = '';
  }
</script>

<div class="space-y-3">
  <section class="space-y-2" aria-labelledby="templates-add-heading">
    <p
      id="templates-add-heading"
      class="flex items-center gap-2 text-caption font-medium text-secondary"
    >
      Add a template
      <MockBadge class="px-1.5 py-0" />
    </p>
    <p class="text-caption text-muted">
      Drop a reusable template into this {scope === 'slides' ? 'deck' : 'document'}.
    </p>
    <Button variant="secondary" size="sm" class="w-full" onclick={() => (addOpen = true)}>
      <SquareStack class="size-3.5" />
      Add template
    </Button>
  </section>

  <section class="space-y-2 border-t border-border pt-3" aria-labelledby="templates-make-heading">
    <p
      id="templates-make-heading"
      class="flex items-center gap-2 text-caption font-medium text-secondary"
    >
      Make a template
      <MockBadge class="px-1.5 py-0" />
    </p>
    <Input bind:value={name} size="sm" placeholder="Template name" aria-label="Template name" />
    <textarea
      bind:value={description}
      placeholder="What is this template for?"
      aria-label="Template description"
      class="dur-small min-h-[72px] w-full resize-y rounded-control border border-border bg-panel px-3 py-2 text-body-sm text-primary placeholder:text-muted focus:border-action focus:outline-none"
    ></textarea>
    {#if scope === 'slides'}
      <RadioGroup
        bind:value={slideScope}
        class="flex-row gap-3"
        options={[
          { value: 'slide', label: 'This slide' },
          { value: 'deck', label: 'Whole deck' }
        ]}
      />
    {/if}
    <Button
      variant="secondary"
      size="sm"
      class="w-full"
      disabled={!name.trim()}
      onclick={makeTemplate}
    >
      Make template
    </Button>
  </section>
</div>

<AddTemplateModal bind:open={addOpen} />
