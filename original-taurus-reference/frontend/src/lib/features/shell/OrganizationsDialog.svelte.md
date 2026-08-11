# src/lib/features/shell/OrganizationsDialog.svelte — breakdown

Companion to [OrganizationsDialog.svelte](OrganizationsDialog.svelte). The user-menu **Organizations** manager. Organizations are user-scoped (not project-scoped), so this master-detail modal lists the caller's organizations with role badges and a create field on the left, and — for the selected org — rename (owner/admin) plus member management on the right: a roster with names resolved from user ids via the identity directory, role changes, removal, and add-by-user-id. It is backed by the real Omega `organization` capability.

## Script — imports

### Component imports: Svelte, icons, data clients, and the UI kit

```svelte
<script lang="ts">
  import { untrack } from 'svelte';
  import { Trash2, Plus, Building2 } from '@lucide/svelte';
  import { cn } from '$lib/utils';
  import { isApiError } from '$data/api';
  import { Modal, Field, Input, Select, Button, IconButton, Badge, Divider, toast } from '$lib/components';
  import { resolveFromUserId } from '$data/identity-directory';
  import {
    organizations,
    loadOrganizations,
    createOrganization,
    renameOrganization,
    fetchOrgMembers,
    addOrgMember,
    setOrgMemberRole,
    removeOrgMember,
    type OrgRole
  } from '$data/organizations';

```

The imports gather everything the dialog composes: `untrack` to run open-time setup without subscribing to it, the three Lucide icons, the `cn` class helper and `isApiError` guard, the component library primitives (modal, form controls, badge, divider, toast), the identity directory's `resolveFromUserId` for turning user ids into names, and the full organizations data surface re-exported from `$data/organizations`.

## Script — props and state

### The open prop, the member-row shape, and reactive state

```svelte
  let { open = $bindable(false) }: { open?: boolean } = $props();

  type MemberRow = { userId: string; role: OrgRole; name: string; email?: string };

  let loadError = $state('');
  let newName = $state('');
  let selectedId = $state<string | null>(null);
  let editName = $state('');
  let members = $state<MemberRow[]>([]);
  let membersError = $state('');
  let inviteUserId = $state('');
  let inviteRole = $state<OrgRole>('member');
  let busy = $state(false);

```

`open` is the single bindable prop so a parent can control the modal with `bind:open`. `MemberRow` extends the bare `OrgMember` with the display `name`/`email` the identity directory fills in. The `$state` block holds all local UI state: the list-level load error, the create field, the selected org id and its editable name, the enriched member list plus its own error, the invite inputs, and a `busy` flag that guards the async create/invite buttons.

## Script — derived and options

### Selected org, manage permission, and the role option lists

```svelte
  const selected = $derived($organizations.find((o) => o.id === selectedId) ?? null);
  const canManage = $derived(selected?.role === 'owner' || selected?.role === 'admin');

  const roleOptions = [
    { value: 'owner', label: 'Owner' },
    { value: 'admin', label: 'Admin' },
    { value: 'member', label: 'Member' }
  ];
  const roleTone = (role: OrgRole) => (role === 'owner' ? 'action' : role === 'admin' ? 'intel' : 'neutral');

```

`selected` resolves the highlighted org from the store by id (recomputing whenever the store or selection changes), and `canManage` gates every mutating control on the caller being an owner or admin. `roleOptions` feeds the role `<select>`s, and `roleTone` maps a role to a `Badge` tone so owner/admin/member read as distinct accent colors.

## Script — load effect

### Refresh the organization list whenever the dialog opens

```svelte
  // Load the caller's organizations whenever the dialog opens.
  $effect(() => {
    if (!open) return;
    untrack(() => {
      newName = '';
      loadError = '';
      void refresh();
    });
  });

```

The effect tracks only `open`: when the dialog becomes visible it resets the create field and error, then kicks off a refresh. Wrapping the resets and the `refresh()` call in `untrack` keeps the effect from re-subscribing to the state it writes, so it fires once per open rather than looping on its own writes.

## Script — refresh and select

### Reload organizations, and select one to view its detail

```svelte
  async function refresh() {
    try {
      await loadOrganizations();
      loadError = '';
    } catch (e) {
      loadError = isApiError(e) ? e.message : 'Could not load organizations.';
    }
  }

  async function select(id: string) {
    selectedId = id;
    editName = $organizations.find((o) => o.id === id)?.name ?? '';
    members = [];
    membersError = '';
    inviteUserId = '';
    inviteRole = 'member';
    await loadMembers(id);
  }

```

`refresh` loads the org list into the store and clears or sets `loadError` from the caught error (using the API message when it is a structured `ApiError`). `select` switches the detail pane to an org: it records the id, seeds the editable name from the store, resets the member and invite state so stale data from a previous org never flashes, and then loads the new org's members.

## Script — loading members

### Fetch the roster, then enrich user ids into real names

```svelte
  async function loadMembers(orgId: string) {
    try {
      const raw = await fetchOrgMembers(orgId);
      if (selectedId !== orgId) return;
      members = raw.map((m) => ({ userId: m.userId, role: m.role, name: m.userId }));
      membersError = '';
      // Enrich user ids → real names (cached; falls back to the id on failure).
      for (const m of raw) {
        const profile = await resolveFromUserId(m.userId, m.userId);
        if (selectedId !== orgId) return;
        members = members.map((r) =>
          r.userId === m.userId ? { ...r, name: profile.name, email: profile.email } : r
        );
      }
    } catch {
      if (selectedId === orgId) membersError = 'Could not load members.';
    }
  }

```

`loadMembers` first renders the roster immediately with the user id standing in for the name, so the list appears without waiting on identity lookups. It then resolves each id to a real name/email through the identity directory and patches that row. The repeated `selectedId !== orgId` guards abort the work if the user switched orgs mid-flight, preventing one org's members from bleeding into another's view; any failure surfaces as a per-list `membersError`.

## Script — create and rename

### Create a new organization, and rename the selected one

```svelte
  async function create() {
    const name = newName.trim();
    if (!name) return;
    busy = true;
    try {
      const org = await createOrganization(name);
      newName = '';
      await select(org.id);
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not create the organization.', { tone: 'danger' });
    } finally {
      busy = false;
    }
  }

  async function rename() {
    if (!selected || !editName.trim() || editName.trim() === selected.name) return;
    try {
      await renameOrganization(selected.id, editName.trim());
      toast('Organization renamed.', { tone: 'success' });
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not rename the organization.', { tone: 'danger' });
    }
  }

```

`create` ignores empty input, flips `busy` to disable the button, creates the org, clears the field, and auto-selects the new org so the user lands on its detail; the `finally` always clears `busy`. `rename` no-ops unless there is a selection and the trimmed name actually changed, then calls the API and reports success or failure via a toast. Both surface errors as toasts rather than inline text because they are triggered by explicit button presses, not passive loads.

## Script — member mutations

### Invite a member, change a role, and remove a member

```svelte
  async function invite() {
    if (!selected || !inviteUserId.trim()) return;
    busy = true;
    try {
      await addOrgMember(selected.id, inviteUserId.trim(), inviteRole);
      inviteUserId = '';
      await loadMembers(selected.id);
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not add the member.', { tone: 'danger' });
    } finally {
      busy = false;
    }
  }

  async function changeRole(userId: string, role: OrgRole) {
    if (!selected) return;
    try {
      await setOrgMemberRole(selected.id, userId, role);
      members = members.map((r) => (r.userId === userId ? { ...r, role } : r));
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not change the role.', { tone: 'danger' });
      await loadMembers(selected.id);
    }
  }

  async function remove(userId: string) {
    if (!selected) return;
    try {
      await removeOrgMember(selected.id, userId);
      members = members.filter((r) => r.userId !== userId);
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not remove the member.', { tone: 'danger' });
    }
  }
</script>

```

The three member mutations each guard on a selection and report failures via toast. `invite` adds by user id and reloads the roster so the new member arrives fully enriched. `changeRole` optimistically patches the local row, then reloads from the server on failure to undo the guess. `remove` optimistically drops the row and leaves it removed unless the call throws. The closing `</script>` ends the component's logic; markup follows.

## Markup — left column

### The modal shell and the list of the caller's organizations with a create field

```svelte
<Modal bind:open title="Organizations" size="lg">
  <div class="grid gap-5 md:grid-cols-[minmax(0,15rem)_1fr]">
    <!-- Left: the caller's organizations + create -->
    <div class="space-y-3">
      <p class="text-caption font-medium text-secondary">Your organizations</p>
      {#if loadError}
        <p class="rounded-control border border-danger/30 bg-danger/5 px-2.5 py-2 text-caption text-danger">
          {loadError}
        </p>
      {:else if !$organizations.length}
        <p class="rounded-control border border-dashed border-border px-2.5 py-3 text-caption text-muted">
          No organizations yet. Create one below.
        </p>
      {:else}
        <div class="space-y-1">
          {#each $organizations as org (org.id)}
            <button
              type="button"
              onclick={() => select(org.id)}
              class={cn(
                'dur-micro flex w-full items-center gap-2 rounded-control border px-2 py-2 text-left transition-colors',
                selectedId === org.id ? 'border-action/40 bg-action/5' : 'border-transparent hover:border-border'
              )}
            >
              <Building2 class="size-4 shrink-0 text-muted" />
              <span class="min-w-0 flex-1 truncate text-label font-medium text-secondary">{org.name}</span>
              <Badge tone={roleTone(org.role)} class="shrink-0 px-1 py-0 capitalize">{org.role}</Badge>
            </button>
          {/each}
        </div>
      {/if}

      <div class="flex items-end gap-2 border-t border-border pt-3">
        <Field label="New organization" class="flex-1">
          {#snippet children({ id })}
            <Input {id} bind:value={newName} placeholder="Name" onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && create()} />
          {/snippet}
        </Field>
        <Button variant="secondary" onclick={create} disabled={busy || !newName.trim()}>
          <Plus class="size-4" /> Create
        </Button>
      </div>
    </div>

```

The `Modal` hosts a two-column grid that collapses to one column below `md`. The left column titles the section, then branches three ways: a danger-styled `loadError` box, a dashed empty state, or the org list. Each org is a selectable button that highlights when it is the current `selectedId`, showing a building icon, the truncated name, and a role `Badge`. Below the list, a bordered footer holds the "New organization" field — Enter submits via the `onkeydown` — and a Create button disabled while `busy` or the name is blank.

## Markup — rename

### The right column header: rename the selected organization (owner/admin)

```svelte
    <!-- Right: the selected organization's detail -->
    <div class="min-w-0">
      {#if !selected}
        <div class="flex h-full min-h-40 items-center justify-center rounded-panel border border-dashed border-border">
          <p class="text-caption text-muted">Select an organization to manage it.</p>
        </div>
      {:else}
        <div class="space-y-5">
          <!-- Rename (owner/admin) -->
          <div class="flex items-end gap-2">
            <Field label="Name" class="flex-1">
              {#snippet children({ id })}
                <Input {id} bind:value={editName} disabled={!canManage} />
              {/snippet}
            </Field>
            {#if canManage}
              <Button variant="secondary" onclick={rename} disabled={!editName.trim() || editName.trim() === selected.name}>Save</Button>
            {/if}
          </div>

          <Divider />

```

The right column shows a dashed placeholder until an org is selected. Once one is, it opens the detail stack with the rename row: a Name field bound to `editName`, disabled unless `canManage`, and a Save button that appears only for managers and stays disabled until the name is both non-empty and actually different from the current name. A `Divider` separates rename from the members section that follows.

## Markup — members list

### The members list with per-member role select and remove

```svelte
          <!-- Members -->
          <div class="space-y-2">
            <p class="text-caption font-medium text-secondary">Members</p>
            {#if membersError}
              <p class="text-caption text-danger">{membersError}</p>
            {:else if !members.length}
              <p class="text-caption text-muted">No members yet.</p>
            {:else}
              <ul class="divide-y divide-border overflow-hidden rounded-control border border-border">
                {#each members as member (member.userId)}
                  <li class="flex items-center gap-2 px-2.5 py-1.5">
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-label font-medium text-secondary">{member.name}</span>
                      {#if member.email}<span class="block truncate text-caption text-muted">{member.email}</span>{/if}
                    </span>
                    {#if canManage}
                      <Select
                        value={member.role}
                        options={roleOptions}
                        size="sm"
                        class="w-24"
                        onchange={(e: Event) => changeRole(member.userId, (e.currentTarget as HTMLSelectElement).value as OrgRole)}
                      />
                      <IconButton label={`Remove ${member.name}`} size="sm" onclick={() => remove(member.userId)}>
                        <Trash2 class="size-4" />
                      </IconButton>
                    {:else}
                      <Badge tone={roleTone(member.role)} class="shrink-0 px-1 py-0 capitalize">{member.role}</Badge>
                    {/if}
                  </li>
                {/each}
              </ul>
            {/if}

```

The members block again branches three ways: an inline error, a "No members yet." note, or the roster. Each row shows the resolved name and, when present, the email. Managers get interactive controls — a role `Select` that calls `changeRole` with the newly chosen value, and a trash `IconButton` that calls `remove` — while non-managers see the member's role as a read-only `Badge`. Keying the `{#each}` on `member.userId` keeps rows stable as enrichment patches them in place.

## Markup — add member

### The add-member-by-id form and the closing tags

```svelte
            {#if canManage}
              <div class="flex items-end gap-2 pt-1">
                <Field label="Add member by user id" class="flex-1">
                  {#snippet children({ id })}
                    <Input {id} bind:value={inviteUserId} placeholder="user id" />
                  {/snippet}
                </Field>
                <Select bind:value={inviteRole} options={roleOptions} size="md" class="w-28" />
                <Button variant="secondary" onclick={invite} disabled={busy || !inviteUserId.trim()}>Add</Button>
              </div>
              <p class="text-caption text-muted">
                Omega adds organization members by user id (there is no email lookup yet).
              </p>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
</Modal>
```

For managers only, the footer adds a member: a user-id field, a role `Select` bound to `inviteRole`, and an Add button disabled while `busy` or the id is blank. The helper caption spells out the Omega constraint that members are added by user id because there is no email lookup yet — a note that documents the backend limitation right where the user meets it. The remaining lines close the members block, the detail stack, the `{#if selected}` branch, both grid columns, and the `Modal`.
