<script lang="ts">
  import { Building2, Pencil, Share2, User } from '@lucide/svelte';
  import {
    Avatar,
    Button,
    Chip,
    Input,
    InspectorSection,
    Modal,
    Select,
    Textarea
  } from '$lib/components';
  import { iconTileClass } from '$data/projects';
  import { OWNERS, type LibraryAsset } from './library-mock';

  // The right-hand DETAIL PANEL (not "inspector" — this is a route, and there is
  // no selection to inspect; it borrows `surface-inspector` for its material).
  // Three sections: what the asset is, who it reaches, and where it came from.
  // Structural over LibraryAsset so contexts, templates, AND personalities all
  // render through the one panel; only the copy varies by space.
  let {
    asset,
    descriptionHint = 'Shown in pickers — and sent to the agent as guidance.',
    copiesNote = 'Editing this here does not change the copy it was made from.'
  }: {
    asset: LibraryAsset;
    descriptionHint?: string;
    /** The copy rule, named for THIS kind of asset — see the panel footer. */
    copiesNote?: string;
  } = $props();

  let shareOpen = $state(false);

  const ownerLabel = (id: string) => OWNERS.find((o) => o.id === id)?.label ?? id;
  const isOrg = (id: string) => OWNERS.find((o) => o.id === id)?.kind === 'org';
</script>

<!-- Content only: the aside, its scroll, and the Details/Assistant switch belong
     to LibraryPanel, which every space shares. -->
<div>
  <InspectorSection title="Details">
    <div class="space-y-3">
      <div>
        <label class="mb-1 block text-caption text-muted" for="asset-name">Name</label>
        <Input id="asset-name" size="sm" value={asset.name} />
      </div>
      <div>
        <label class="mb-1 block text-caption text-muted" for="asset-desc">Description</label>
        <Textarea id="asset-desc" rows={3} value={asset.description} />
        <p class="mt-1 text-caption text-muted">{descriptionHint}</p>
      </div>
    </div>
  </InspectorSection>

  <!-- Owner is a FACT, not a control: changing reach is what Share does. The
       owner row sits on `bg-work` with a tinted tile so the section does not
       read as one flat block of grey.
       Closed at rest, with About: three sections expanded at once filled the
       panel and read as crowding, which is the opposite of what this shell is
       for. Details is the one you came for; these two are answers to questions
       you have to ask. -->
  <InspectorSection title="Sharing" open={false}>
    <div class="space-y-2.5">
      <div class="flex items-center gap-2.5 rounded-control border border-border bg-work px-2.5 py-2">
        <span
          class="flex size-7 shrink-0 items-center justify-center rounded-control {iconTileClass(
            isOrg(asset.ownerId) ? 'intel' : 'action'
          )}"
        >
          {#if isOrg(asset.ownerId)}
            <Building2 class="size-3.5" />
          {:else}
            <User class="size-3.5" />
          {/if}
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-caption text-muted">Owner</span>
          <span class="block truncate text-body-sm font-medium text-primary">
            {ownerLabel(asset.ownerId)}
          </span>
        </span>
      </div>

      <Button variant="primary" size="sm" class="w-full" onclick={() => (shareOpen = true)}>
        <Share2 class="size-3.5" /> Share
      </Button>

      <!-- Its own bounded sub-section: an asset shared with thirty people must
           not push About off the panel. -->
      <div class="rounded-control border border-border">
        <p class="border-b border-border px-2.5 py-1.5 text-caption text-muted">
          Shared with {asset.sharedWith.length}
        </p>
        {#if asset.sharedWith.length}
          <div class="quiet-scroll max-h-36 overflow-y-auto p-1">
            {#each asset.sharedWith as s (s.id)}
              <div class="flex items-center gap-2 rounded-control px-1.5 py-1 hover:bg-work">
                {#if s.kind === 'org'}
                  <span
                    class="flex size-6 shrink-0 items-center justify-center rounded-control {iconTileClass(
                      'intel'
                    )}"
                  >
                    <Building2 class="size-3.5" />
                  </span>
                {:else}
                  <Avatar name={s.name} size="sm" />
                {/if}
                <span class="flex-1 truncate text-caption text-primary">{s.name}</span>
                <span class="shrink-0 text-caption text-muted">{s.access}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="px-2.5 py-2 text-caption text-muted">No one yet.</p>
        {/if}
      </div>
    </div>
  </InspectorSection>

  <!-- Origin, history, and reach were three thin sections; one reads better. -->
  <InspectorSection title="About" open={false}>
    <dl class="space-y-2.5">
      <div>
        <dt class="text-caption text-muted">Origin</dt>
        <dd class="text-caption text-secondary">
          Copied from <span class="font-medium text-action">{asset.origin.project}</span> on
          {asset.origin.date}
        </dd>
      </div>
      <div>
        <dt class="text-caption text-muted">Last edited</dt>
        <dd class="text-caption text-secondary">
          {asset.lastEdited} by <span class="text-primary">{asset.editedBy}</span>
        </dd>
      </div>
      <div>
        <dt class="mb-1 text-caption text-muted">Used in</dt>
        <dd>
          {#if asset.usedIn.length}
            <span class="flex flex-wrap gap-1.5">
              {#each asset.usedIn as p (p)}
                <Chip tone="action">{p}</Chip>
              {/each}
            </span>
          {:else}
            <span class="text-caption text-muted">No project yet</span>
          {/if}
        </dd>
      </div>
    </dl>
  </InspectorSection>

  <!-- The copy rule is a standing condition of this whole screen, not a detail
       about one asset — so it sits at the foot of the panel rather than inside a
       section that closes over it. It is the part of the model most likely to
       surprise someone, and it must be readable without opening anything.
       Worded by the CALLER, because the rule differs: a template can be brought
       into a project (copied again), and a context cannot. -->
  <p class="px-4 py-3 text-caption leading-relaxed text-muted">{copiesNote}</p>
</div>

<Modal bind:open={shareOpen} title="Share “{asset.name}”" size="sm">
  <div class="space-y-3">
    <p class="text-body-sm text-secondary">
      Give people or an organization access to the library original.
    </p>
    <Select
      size="sm"
      value="org-atlas"
      aria-label="Share with"
      options={[
        ...OWNERS.filter((o) => o.kind === 'org').map((o) => ({
          value: o.id,
          label: `${o.label} (organization)`
        })),
        { value: 'u-rivera', label: 'Sam Rivera' },
        { value: 'u-okafor', label: 'Ada Okafor' }
      ]}
    />
    <Select
      size="sm"
      value="use"
      aria-label="Access"
      options={[
        { value: 'use', label: 'Can use' },
        { value: 'edit', label: 'Can edit' }
      ]}
    />
    <div class="flex items-start gap-2 rounded-control border border-attention/40 bg-attention/5 p-2.5">
      <Pencil class="mt-0.5 size-3.5 shrink-0 text-attention" />
      <p class="text-caption text-secondary">
        Projects that already brought this in keep their copy — sharing changes who can reach the
        library original, not what has already been used.
      </p>
    </div>
  </div>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (shareOpen = false)}>Cancel</Button>
    <Button onclick={() => (shareOpen = false)}>Share</Button>
  {/snippet}
</Modal>

<style>
  .quiet-scroll {
    scrollbar-width: none;
  }
  .quiet-scroll::-webkit-scrollbar {
    display: none;
  }
</style>
