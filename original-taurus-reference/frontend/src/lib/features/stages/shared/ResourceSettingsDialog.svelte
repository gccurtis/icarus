<script lang="ts">
  import type { Component } from 'svelte';
  import { untrack } from 'svelte';
  import { get } from 'svelte/store';
  import { Trash2 } from '@lucide/svelte';
  import { Modal, Field, Input, Switch, Button, Badge, Divider, toast, type Tone } from '$lib/components';
  import { isApiError } from '$data/api';
  import { setResourcePinned, type Resource, type ResourceKind } from '$data/resources';
  import ResourceSharing from './ResourceSharing.svelte';

  type KindMeta = Record<ResourceKind, { icon: Component; tone: Tone; label: string }>;

  let {
    open = $bindable(false),
    resource = null,
    kindMeta,
    onrename,
    onremove
  }: {
    open?: boolean;
    resource?: Resource | null;
    kindMeta: KindMeta;
    onrename: (id: string, name: string) => void;
    onremove: (r: Resource) => void;
  } = $props();

  let name = $state('');
  let confirmDelete = $state(false);
  let pinned = $state(false);

  const meta = $derived(resource ? kindMeta[resource.kind] : null);
  // Access is a backend concept for real (document) resources only.
  const isDocument = $derived(resource?.kind === 'document');

  // Re-sync the editable fields when the target resource / open state changes.
  // Access state is no longer among them — ResourceSharing owns its own.
  $effect(() => {
    open;
    resource;
    const r = untrack(() => resource);
    name = r?.name ?? '';
    confirmDelete = false;
    pinned = r?.pinned ?? false;
  });

  function saveName() {
    if (resource && name.trim()) onrename(resource.id, name.trim());
  }

  function remove() {
    if (resource) {
      onremove(resource);
      open = false;
    }
  }

  async function togglePinned(next: boolean) {
    if (!resource) return;
    try {
      await setResourcePinned(resource.id, next);
    } catch (e) {
      pinned = !next; // revert the bound state
      toast(isApiError(e) ? e.message : 'Could not update the pin.', { tone: 'danger' });
    }
  }

</script>

<Modal bind:open title="Resource settings" size="md">
  {#if resource && meta}
    {@const Icon = meta.icon}
    <div class="space-y-5">
      <!-- Identity -->
      <div class="flex items-center gap-3">
        <span class="flex size-9 items-center justify-center rounded-control {meta.tone === 'neutral' ? 'bg-panel text-muted' : ''}">
          <Icon class="size-5" />
        </span>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>

      <!-- Name (real: renames the resource) -->
      <div class="flex items-end gap-2">
        <Field label="Name" class="flex-1">
          {#snippet children({ id })}
            <Input {id} bind:value={name} />
          {/snippet}
        </Field>
        <Button variant="secondary" onclick={saveName} disabled={!name.trim() || name === resource.name}>Save</Button>
      </div>

      {#if isDocument}
        <!-- Access (real: PATCH /resources/:kind/:id/access, owner-only). The editor
             itself lives in ResourceSharing, which the Overview inspector's Share
             modal also renders — one implementation, so the two cannot drift. -->
        <div>
          <p class="mb-1.5 text-label font-medium text-secondary">Access</p>
          <ResourceSharing {resource} kindLabel={meta.label} />
        </div>
      {/if}

      <!-- Options (real: pin to top of the table) -->
      <div>
        <p class="mb-2 text-label font-medium text-secondary">Options</p>
        <Switch
          bind:checked={pinned}
          onchange={(e: Event) => togglePinned((e.currentTarget as HTMLInputElement).checked)}
          label="Pin to top of the table"
        />
      </div>

      <Divider />

      <!-- Danger (real: removes the resource) -->
      <div>
        {#if !confirmDelete}
          <Button variant="ghost" class="text-danger hover:bg-danger/10" onclick={() => (confirmDelete = true)}>
            <Trash2 class="size-4" /> Remove resource
          </Button>
        {:else}
          <div class="flex items-center gap-2 rounded-panel border border-danger/30 bg-danger/8 p-3">
            <span class="flex-1 text-body-sm text-primary">Remove "{resource.name}"?</span>
            <Button variant="ghost" onclick={() => (confirmDelete = false)}>Cancel</Button>
            <Button variant="danger" onclick={remove}>Remove</Button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</Modal>
