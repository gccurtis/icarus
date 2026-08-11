<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { Badge, IdentityHoverCard, toast } from '$lib/components';
  import { isApiError } from '$data/api';
  import { documentEditRelative, documentEditStamp } from '$data/time';
  import { resolveFromUserId, getIdentityProfile } from '$data/identity-directory';
  import type { IdentityProfile } from '$data/identity-directory';
  import { editorSession } from '../editor/session';

  let now = $state(Date.now());
  let clock: ReturnType<typeof setInterval> | null = null;
  let editingTitle = $state(false);
  let titleDraft = $state('');
  let renaming = $state(false);
  let titleInput = $state<HTMLInputElement>();

  const currentName = $derived($editorSession?.name ?? '');
  const createdIso = $derived($editorSession?.createdAt ?? '');
  const createdAt = $derived(Date.parse(createdIso));
  const createdRelative = $derived(documentEditRelative(createdAt, now));
  const createdStamp = $derived(documentEditStamp(createdAt));

  // Resolve the real creator's profile from the document's creatorId/creatorName.
  let creatorProfile = $state<IdentityProfile | null>(null);
  $effect(() => {
    const id = $editorSession?.creatorId;
    const name = $editorSession?.creatorName ?? '';
    if (id) void resolveFromUserId(id, name).then((profile) => (creatorProfile = profile));
    else creatorProfile = null;
  });
  const creator = $derived(creatorProfile ?? getIdentityProfile($editorSession?.creatorName ?? ''));

  async function beginTitleEdit() {
    if (renaming) return;
    titleDraft = currentName;
    editingTitle = true;
    await tick();
    titleInput?.focus();
    titleInput?.select();
  }

  function cancelTitleEdit() {
    editingTitle = false;
    titleDraft = currentName;
  }

  async function commitTitle() {
    if (!editingTitle || renaming || !$editorSession) return;
    const next = titleDraft.trim();
    if (!next || next === currentName) {
      cancelTitleEdit();
      return;
    }
    renaming = true;
    try {
      await $editorSession.actions.renameDocument(next);
      editingTitle = false;
    } catch (error) {
      cancelTitleEdit();
      toast(isApiError(error) ? error.message : 'Could not rename the document.', {
        tone: 'danger'
      });
    } finally {
      renaming = false;
    }
  }

  function onTitleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void commitTitle();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelTitleEdit();
    }
  }

  onMount(() => {
    clock = setInterval(() => (now = Date.now()), 30000);
  });
  onDestroy(() => {
    if (clock) clearInterval(clock);
  });
</script>

{#snippet metric(label: string, value: number)}
  <div class="flex items-center justify-between gap-4 py-1.5" aria-label={`${label}: ${value}`}>
    <dt class="text-caption text-muted">{label}</dt>
    <dd class="text-caption font-medium tabular-nums text-secondary">{value}</dd>
  </div>
{/snippet}

{#if $editorSession}
  <div>
    <section class="pb-3">
      {#if editingTitle}
        <input
          bind:this={titleInput}
          bind:value={titleDraft}
          onkeydown={onTitleKeydown}
          onblur={() => void commitTitle()}
          disabled={renaming}
          aria-label="Rename document from Info"
          class="-ml-1 h-7 w-full border-0 border-b border-border bg-transparent px-1 text-body-sm font-medium text-primary outline-none"
        />
      {:else}
        <button
          type="button"
          ondblclick={() => void beginTitleEdit()}
          onkeydown={(event) => {
            if (event.key === 'Enter' || event.key === 'F2') {
              event.preventDefault();
              void beginTitleEdit();
            }
          }}
          aria-label={`Document name in Info: ${currentName}. Double-click to rename`}
          title="Double-click to rename"
          class="-ml-1 block max-w-full truncate rounded-control px-1 py-0.5 text-left text-body-sm font-medium text-primary hover:bg-elevated"
        >
          {currentName}
        </button>
      {/if}
    </section>

    <section
      class="border-t border-border py-2.5"
      aria-label={`Created ${createdRelative} by ${creator.name}`}
    >
      <p class="flex flex-wrap items-center gap-x-1 text-caption text-secondary">
        <span class="text-muted">Created</span>
        <time datetime={createdIso} title={createdStamp}>{createdRelative}</time>
        <span class="text-muted">by</span>
        <IdentityHoverCard
          profile={creator}
          showAvatar={false}
          showName
          portalled
          class="-mx-0.5 font-medium"
        />
      </p>
      <div class="mt-0.5">
        <time datetime={createdIso} class="text-caption text-muted">{createdStamp}</time>
      </div>
    </section>

    <dl aria-label="Document metrics" class="border-y border-border py-1">
      {@render metric('Words', $editorSession.words)}
      {@render metric('Characters', $editorSession.chars)}
    </dl>
  </div>
{/if}
