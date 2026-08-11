# src/lib/features/stages/shared/ResourceSettingsDialog.svelte — breakdown

Companion to [ResourceSettingsDialog.svelte](ResourceSettingsDialog.svelte). The per-resource settings modal opened from a row's settings menu: rename (real, via `onrename`), see the kind, set **Access** (documents only — a real `AccessScope` edit via `PATCH /resources/:kind/:id/access`, owner-only, project-wide vs an allow-list of project **members and organizations**), toggle the real **Pin** (`PATCH …/attributes`), and remove it (real, via `onremove`).

## Script: imports

### Import Svelte primitives, UI components, data clients, and resource types

```svelte
<script lang="ts">
  import type { Component } from 'svelte';
  import { untrack } from 'svelte';
  import { get } from 'svelte/store';
  import { Trash2 } from '@lucide/svelte';
  import { Modal, Field, Input, Switch, Button, Badge, Divider, toast, type Tone } from '$lib/components';
  import { isApiError } from '$data/api';
  import { workspace } from '$data/workspace';
  import { currentUserId, fetchMembers, type Member } from '$data/projects';
  import { organizations, loadOrganizations } from '$data/organizations';
  import {
    setResourceAccess,
    setResourcePinned,
    type AccessScope,
    type Resource,
    type ResourceKind
  } from '$data/resources';

```

The imports pull in the pieces the dialog composes: `untrack` (to read state inside the sync effect without subscribing), `get` (to read the workspace synchronously), the `Trash2` icon, the component library primitives (`Modal`, `Field`, `Switch`, etc.), the `isApiError` guard for toast messages, and the project/organization data used by the access editor. From the resources system it takes the two real mutations it performs — `setResourceAccess` and `setResourcePinned` — plus the domain types. The trailing blank line separates the imports from the local type alias.

## Props and the kind-meta type

### The KindMeta lookup type and the component's bindable props

```svelte
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

```

`KindMeta` maps each resource kind to its display metadata (icon, tone, label) so the dialog can render the resource's identity without hard-coding per-kind visuals. The props: `open` is `$bindable` so the parent controls visibility two-way; `resource` is the target (nullable while nothing is selected); `kindMeta` is supplied by the parent; and `onrename`/`onremove` are the real mutation callbacks the dialog delegates to. The trailing blank line separates the props from the local state.

## Local state

### Editable name, delete-confirm, pin, and the access-editor fields

```svelte
  let name = $state('');
  let confirmDelete = $state(false);
  let pinned = $state(false);

  // Access editor state. `orgIds` is carried untouched — the org picker arrives
  // with the Organizations feature; here we preserve any orgs already granted.
  let projectWide = $state(true);
  let selectedUserIds = $state<string[]>([]);
  let orgIds = $state<string[]>([]);
  let members = $state<Member[]>([]);
  let membersError = $state('');
  let savingAccess = $state(false);

```

The first group is the simple editable state: the working `name`, a two-step `confirmDelete` guard for the destructive action, and the bound `pinned` toggle. The second group backs the access editor: `projectWide` chooses between "everyone" and "restricted"; `selectedUserIds` and `orgIds` are the allow-lists; `members` (and its `membersError`) are the fetched project members to choose from; and `savingAccess` disables the save button while the PATCH is in flight. The trailing blank line separates the state from the derived values.

## Derived values

### Kind metadata, document/owner gating, and change detection

```svelte
  const meta = $derived(resource ? kindMeta[resource.kind] : null);
  // Access is a backend concept for real (document) resources only.
  const isDocument = $derived(resource?.kind === 'document');
  // Omega allows only the owner to change access; an unknown creator is optimistic
  // (mock kinds save locally, documents surface the backend's 403 as a toast).
  const isOwner = $derived(!resource?.creatorId || resource.creatorId === currentUserId());

  const sameSet = (x: string[], y: string[]) => x.length === y.length && x.every((v) => y.includes(v));
  const accessChanged = $derived.by(() => {
    if (!resource) return false;
    const a = resource.access;
    if (projectWide !== a.projectWide) return true;
    if (projectWide) return false;
    return !sameSet(selectedUserIds, a.userIds) || !sameSet(orgIds, a.orgIds);
  });

```

`meta` resolves the current resource's display metadata (null when nothing is selected). `isDocument` gates the whole access section, which only applies to real backend resources. `isOwner` decides whether the access controls are editable — true when there is no known creator (optimistic) or the creator is the current user. `sameSet` is an order-insensitive array-equality helper, and `accessChanged` uses it to decide whether the Save-access button should enable: it returns false with no resource, compares the project-wide flag first, treats any project-wide scope as unchanged (the id lists are irrelevant then), and otherwise diffs both allow-lists against the resource's stored access. The trailing blank line separates the derived block from the sync effect.

## Effect: re-sync editable fields

### Reset the form whenever the target resource or open state changes

```svelte
  // Re-sync the editable fields when the target resource / open state changes.
  $effect(() => {
    open;
    resource;
    const r = untrack(() => resource);
    name = r?.name ?? '';
    confirmDelete = false;
    pinned = r?.pinned ?? false;
    projectWide = r?.access.projectWide ?? true;
    selectedUserIds = r ? [...r.access.userIds] : [];
    orgIds = r ? [...r.access.orgIds] : [];
    members = [];
    membersError = '';
    savingAccess = false;
    if (open && r?.kind === 'document') {
      void loadMembers();
      void loadOrganizations().catch(() => {});
    }
  });

```

This effect keeps the form in sync with its target. It explicitly reads `open` and `resource` to register them as dependencies, then re-reads `resource` through `untrack` so the assignments inside don't create further reactive edges. Every editable field is reset from the incoming resource (name, pin, and a fresh copy of the access lists via spread, so editing them never mutates the store record), and the transient fields are cleared. Finally, when the dialog is open on a document, it kicks off loading the project members and organizations (the org load's failure is swallowed since it is only supplementary). The trailing blank line separates the effect from the handlers.

## loadMembers

### Fetch the project's members for the access allow-list

```svelte
  async function loadMembers() {
    const projectId = get(workspace)?.projectId;
    if (!projectId) return;
    try {
      members = await fetchMembers(projectId);
      membersError = '';
    } catch {
      membersError = 'Could not load members.';
    }
  }

```

`loadMembers` reads the active project id from the workspace store and fetches its member list to populate the restricted-access picker. On success it clears any prior error; on failure it records a short message the markup shows in place of the list. The trailing blank line separates it from the name/remove handlers.

## saveName and remove

### Commit a rename, and confirm-then-remove the resource

```svelte
  function saveName() {
    if (resource && name.trim()) onrename(resource.id, name.trim());
  }

  function remove() {
    if (resource) {
      onremove(resource);
      open = false;
    }
  }

```

`saveName` delegates the rename to the parent's `onrename` callback, guarding against an empty resource or blank name and trimming before it commits. `remove` fires the parent's `onremove` and closes the dialog; it is only reached after the in-markup `confirmDelete` step, so the destructive action always takes two clicks. The trailing blank line separates these from the pin handler.

## togglePinned

### Persist the pin toggle, reverting the bound state on failure

```svelte
  async function togglePinned(next: boolean) {
    if (!resource) return;
    try {
      await setResourcePinned(resource.id, next);
    } catch (e) {
      pinned = !next; // revert the bound state
      toast(isApiError(e) ? e.message : 'Could not update the pin.', { tone: 'danger' });
    }
  }

```

`togglePinned` persists the new pin value through the resources API. Because the `Switch` is bound to `pinned` and updates optimistically, a failed request reverts the bound state to `!next` and surfaces the error as a danger toast (using the API error's message when available). The trailing blank line separates it from the access-list toggles.

## toggleUser and toggleOrg

### Add or remove a user or organization from the allow-lists

```svelte
  function toggleUser(userId: string) {
    selectedUserIds = selectedUserIds.includes(userId)
      ? selectedUserIds.filter((id) => id !== userId)
      : [...selectedUserIds, userId];
  }

  function toggleOrg(orgId: string) {
    orgIds = orgIds.includes(orgId) ? orgIds.filter((id) => id !== orgId) : [...orgIds, orgId];
  }

```

These two mirror-image handlers toggle a user or organization in and out of the restricted-access allow-lists. Each reassigns a new array (rather than mutating in place) so Svelte's reactivity and the `accessChanged` derivation pick up the change. The trailing blank line separates them from `saveAccess`.

## saveAccess and script close

### Assemble the access scope, persist it, and toast the outcome

```svelte
  async function saveAccess() {
    if (!resource) return;
    savingAccess = true;
    const access: AccessScope = projectWide
      ? { projectWide: true, orgIds: [], userIds: [] }
      : { projectWide: false, orgIds, userIds: selectedUserIds };
    try {
      await setResourceAccess(resource.id, access);
      toast('Access updated.', { tone: 'success' });
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not update access.', { tone: 'danger' });
    } finally {
      savingAccess = false;
    }
  }
</script>

```

`saveAccess` builds the `AccessScope` from the editor state — a clean project-wide scope with empty lists, or a restricted scope carrying the current allow-lists — and PATCHes it via `setResourceAccess`. It flags `savingAccess` around the request (cleared in `finally`) to disable the button and show a spinner label, and reports success or failure through a toast, preferring the API error's message for the owner-only 403. The `</script>` closes the logic; the trailing blank line separates the script from the markup.

## Markup: modal shell, identity, and name

### The modal frame, the kind badge, and the rename row

```svelte
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

```

The `Modal` is bound to `open` and only renders content when there is both a `resource` and resolved `meta`. `{@const Icon = meta.icon}` binds the kind's icon component for use as `<Icon>`. The Identity block shows that icon in a tinted tile (neutral tone gets a muted panel background) beside a `Badge` naming the kind. The Name block pairs a `Field`/`Input` bound to `name` with a Save `Button` that stays disabled until the name is non-blank and actually differs from the current name. The trailing blank line separates this from the access section.

## Markup: access editor (documents only)

### The project-wide/restricted toggle with member and org allow-lists

```svelte
      {#if isDocument}
        <!-- Access (real: PATCH /resources/:kind/:id/access, owner-only) -->
        <div>
          <p class="mb-1.5 text-label font-medium text-secondary">Access</p>
          {#if !isOwner}
            <p class="mb-2 rounded-control border border-border bg-panel px-3 py-2 text-caption text-muted">
              Only the owner can change who sees this {meta.label.toLowerCase()}.
            </p>
          {/if}
          <div class="inline-flex rounded-control border border-border bg-panel p-1">
            {#each [{ v: true, l: 'Everyone in project' }, { v: false, l: 'Restricted' }] as opt (opt.l)}
              <button
                type="button"
                disabled={!isOwner}
                onclick={() => (projectWide = opt.v)}
                class={'dur-small rounded-[5px] px-3 py-1 text-label font-medium transition-colors disabled:opacity-50 ' +
                  (projectWide === opt.v ? 'bg-work text-primary shadow-panel' : 'text-muted hover:text-secondary')}
              >
                {opt.l}
              </button>
            {/each}
          </div>

          {#if !projectWide}
            <div class="mt-2 space-y-2.5">
              <div class="space-y-1.5">
                <p class="text-caption text-muted">People who can see it (the owner always can):</p>
                {#if membersError}
                  <p class="text-caption text-danger">{membersError}</p>
                {:else if !members.length}
                  <p class="text-caption text-muted">Loading members…</p>
                {:else}
                  <ul class="max-h-40 space-y-0.5 overflow-y-auto rounded-control border border-border p-1">
                    {#each members as member (member.id)}
                      <li>
                        <label class="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-label hover:bg-work">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(member.id)}
                            onchange={() => toggleUser(member.id)}
                            disabled={!isOwner}
                          />
                          <span class="min-w-0 flex-1 truncate text-secondary">{member.name}</span>
                          <span class="shrink-0 text-caption text-muted">{member.email}</span>
                        </label>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>

              {#if $organizations.length}
                <div class="space-y-1.5">
                  <p class="text-caption text-muted">Organizations with access:</p>
                  <ul class="max-h-32 space-y-0.5 overflow-y-auto rounded-control border border-border p-1">
                    {#each $organizations as org (org.id)}
                      <li>
                        <label class="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-label hover:bg-work">
                          <input
                            type="checkbox"
                            checked={orgIds.includes(org.id)}
                            onchange={() => toggleOrg(org.id)}
                            disabled={!isOwner}
                          />
                          <span class="min-w-0 flex-1 truncate text-secondary">{org.name}</span>
                        </label>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/if}

          {#if isOwner}
            <div class="mt-2">
              <Button variant="secondary" size="sm" onclick={saveAccess} disabled={savingAccess || !accessChanged}>
                {savingAccess ? 'Saving…' : 'Save access'}
              </Button>
            </div>
          {/if}
        </div>
      {/if}

```

The whole access editor is gated on `isDocument`, since access is a real backend concept only for documents. When the viewer is not the owner, an explanatory notice appears and the controls are disabled. The segmented toggle switches `projectWide` between "Everyone in project" and "Restricted", highlighting the active option. When restricted, it renders a members list (showing the error, a loading message, or the checkbox rows depending on fetch state) and, when any exist, an organizations list — each checkbox reflecting and toggling membership in the allow-lists. The Save-access button is shown only to the owner and stays disabled while saving or when nothing has changed. The trailing blank line separates the access section from the options/danger block.

## Markup: options, divider, and danger zone

### The pin switch and the confirm-to-remove action, closing the modal

```svelte
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
```

The Options block is a `Switch` bound to `pinned`; its `onchange` calls `togglePinned` with the checkbox's new checked value so the pin is persisted (and reverted on error). After a `Divider`, the Danger block implements the two-step delete: initially a ghost "Remove resource" button that only sets `confirmDelete`, then an inline danger panel naming the resource with explicit Cancel and Remove buttons — Remove calling `remove()`. The closing `</div>`, `{/if}`, and `</Modal>` end the content, the conditional, and the modal frame.

## The access editor moved out

The Everyone/Restricted toggle, member and organization checkboxes, and Save now live in
[`ResourceSharing.svelte`](ResourceSharing.svelte.md), which this dialog renders:

```svelte
<ResourceSharing {resource} kindLabel={meta.label} />
```

The Overview inspector's Share modal renders the same component, so a permissions editor exists once
rather than twice — the arrangement `ProjectSharing` has with project Share / settings.

Sections above that describe this dialog's own access state (`projectWide`, `selectedUserIds`,
`orgIds`, `members`, `savingAccess`) and its `saveAccess` / `toggleUser` / `toggleOrg` handlers
describe code that has moved. The behaviour is unchanged; `ResourceSharing` owns it now, along with
the owner check that gates it.
