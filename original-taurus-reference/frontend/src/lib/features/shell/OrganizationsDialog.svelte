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

  const selected = $derived($organizations.find((o) => o.id === selectedId) ?? null);
  const canManage = $derived(selected?.role === 'owner' || selected?.role === 'admin');

  const roleOptions = [
    { value: 'owner', label: 'Owner' },
    { value: 'admin', label: 'Admin' },
    { value: 'member', label: 'Member' }
  ];
  const roleTone = (role: OrgRole) => (role === 'owner' ? 'action' : role === 'admin' ? 'intel' : 'neutral');

  // Load the caller's organizations whenever the dialog opens.
  $effect(() => {
    if (!open) return;
    untrack(() => {
      newName = '';
      loadError = '';
      void refresh();
    });
  });

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
