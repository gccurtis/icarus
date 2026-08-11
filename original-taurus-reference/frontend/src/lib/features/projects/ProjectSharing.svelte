<script lang="ts">
  import { Copy, RefreshCw, X } from '@lucide/svelte';
  import { isApiError } from '$data/api';
  import { Avatar, Button, Divider, IconButton, Input, Select, toast } from '$lib/components';
  import {
    projects,
    updateProject,
    fetchMembers,
    addMember,
    setMemberRole,
    removeMember,
    fetchLinks,
    rotateLink,
    disableLink,
    currentUserId,
    type Role,
    type Member,
    type Visibility,
    type ShareLink
  } from '$data/projects';

  // Everything about WHO can reach a project: its access mode, its role-carrying
  // share links, and its members. Rendered by both the top-bar Share dialog and
  // Project settings, so the two can never drift — before this, Share was a mock
  // that copied a fake link while settings did the real thing.
  //
  // Mounted only while its host modal is open (Modal renders children behind
  // `{#if open}`), so mounting IS the lazy load — no extra open-guard needed.
  let { projectId, compact = false }: { projectId: string | null; compact?: boolean } = $props();

  const project = $derived($projects.find((p) => p.id === projectId) ?? null);
  const isOwner = $derived(project?.role === 'owner');

  let members = $state<Member[]>([]);
  let membersError = $state('');
  let shareLinks = $state<ShareLink[]>([]);
  let inviteEmail = $state('');
  let inviteRole = $state<Role>('editor');

  const roleOptions = [
    { value: 'owner', label: 'Owner' },
    { value: 'editor', label: 'Editor' },
    { value: 'viewer', label: 'Viewer' }
  ];
  const linkRoles: ('read' | 'edit')[] = ['read', 'edit'];

  // Load for whichever project is targeted. Every write below re-checks
  // `projectId === id` before committing, so a switch mid-flight cannot land the
  // previous project's members in the list.
  $effect(() => {
    const id = projectId;
    members = [];
    shareLinks = [];
    membersError = '';
    if (!id) return;
    void loadMembers(id);
    void loadLinks(id);
  });

  async function loadMembers(id: string) {
    try {
      const list = await fetchMembers(id);
      if (projectId === id) members = list;
    } catch (e) {
      if (projectId === id) membersError = isApiError(e) ? e.message : 'Could not load members';
    }
  }

  async function loadLinks(id: string) {
    try {
      const l = await fetchLinks(id);
      if (projectId === id) shareLinks = l;
    } catch {
      // Owner-only on Omega; a non-owner simply sees no link controls.
    }
  }

  async function chooseVisibility(v: Visibility) {
    if (!projectId) return;
    try {
      await updateProject(projectId, { visibility: v });
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not update access', { tone: 'danger' });
    }
  }

  async function rotate(role: 'read' | 'edit') {
    if (!projectId) return;
    try {
      const l = await rotateLink(projectId, role);
      shareLinks = [...shareLinks.filter((x) => x.role !== role), l];
      toast(`${role === 'edit' ? 'Edit' : 'Read'} link ready`, { tone: 'success' });
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not create link', { tone: 'danger' });
    }
  }

  async function turnOff(role: 'read' | 'edit') {
    if (!projectId) return;
    try {
      await disableLink(projectId, role);
      shareLinks = shareLinks.filter((x) => x.role !== role);
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not turn off link', { tone: 'danger' });
    }
  }

  function copyShareLink(url: string) {
    navigator.clipboard?.writeText(url);
    toast('Link copied', { tone: 'success' });
  }

  async function invite() {
    const id = projectId;
    if (!id || !inviteEmail.trim()) return;
    try {
      const m = await addMember(id, inviteEmail, inviteRole);
      if (projectId === id) members = [...members, m];
      inviteEmail = '';
      toast('Member added', { tone: 'success' });
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not add member', { tone: 'danger' });
    }
  }

  async function changeRole(userId: string, role: Role) {
    if (!projectId) return;
    try {
      await setMemberRole(projectId, userId, role);
      members = members.map((m) => (m.id === userId ? { ...m, role } : m));
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not change role', { tone: 'danger' });
    }
  }

  async function kick(userId: string) {
    if (!projectId) return;
    try {
      await removeMember(projectId, userId);
      members = members.filter((m) => m.id !== userId);
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not remove member', { tone: 'danger' });
    }
  }
</script>

{#if project}
  <div class="space-y-6">
    <!-- Access / visibility — the master switch the links depend on -->
    <div>
      <p class="mb-1.5 text-label font-medium text-secondary">Access</p>
      <div class="inline-flex rounded-control border border-border bg-panel p-1">
        {#each [{ v: 'private', l: 'Private' }, { v: 'link', l: 'Anyone with link' }] as opt (opt.v)}
          <button
            type="button"
            disabled={!isOwner}
            onclick={() => chooseVisibility(opt.v as Visibility)}
            class={'dur-small rounded-[5px] px-3 py-1 text-label font-medium transition-colors disabled:opacity-60 ' +
              (project.visibility === opt.v
                ? 'bg-work text-primary shadow-panel'
                : 'text-muted hover:text-secondary')}
          >
            {opt.l}
          </button>
        {/each}
      </div>
      {#if !isOwner}
        <p class="mt-1.5 text-caption text-muted">Only an owner can change access.</p>
      {/if}
    </div>

    <!-- Share links (owner-managed, role-carrying; /join/:token grants that role) -->
    {#if isOwner}
      <div>
        <p class="mb-1.5 text-label font-medium text-secondary">Share links</p>
        {#if project.visibility !== 'link'}
          <p class="mb-2 text-caption text-muted">
            Sharing is off — set Access to “Anyone with link” for these to work.
          </p>
        {/if}
        <div class="space-y-2">
          {#each linkRoles as role (role)}
            {@const lk = shareLinks.find((l) => l.role === role)}
            <div class="flex items-center gap-2">
              <span class="w-12 shrink-0 text-caption capitalize text-muted">{role}</span>
              {#if lk}
                <Input value={lk.url} readonly class="flex-1 font-mono text-caption" />
                <IconButton label={`Copy ${role} link`} size="sm" onclick={() => copyShareLink(lk.url)}>
                  <Copy class="size-4" />
                </IconButton>
                <IconButton label={`Rotate ${role} link`} size="sm" onclick={() => rotate(role)}>
                  <RefreshCw class="size-4" />
                </IconButton>
                <IconButton label={`Turn off ${role} link`} size="sm" onclick={() => turnOff(role)}>
                  <X class="size-4" />
                </IconButton>
              {:else}
                <Button variant="outline" onclick={() => rotate(role)}>Create {role} link</Button>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if !compact}
      <Divider />

      <!-- Members (real: GET/POST/PATCH/DELETE /projects/:id/members) -->
      <div>
        <p class="mb-2 text-label font-medium text-secondary">
          Members <span class="text-muted">· {members.length}</span>
        </p>
        {#if membersError}
          <p class="mb-2 text-caption text-danger">{membersError}</p>
        {/if}
        <ul class="space-y-2">
          {#each members as m (m.id)}
            {@const isMe = m.id === currentUserId()}
            <li class="flex items-center gap-3">
              <Avatar name={m.name} size="sm" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-body-sm text-primary">{isMe ? 'You' : m.name}</p>
                <p class="truncate text-caption text-muted">{m.email}</p>
              </div>
              {#if isOwner && !isMe}
                <Select
                  value={m.role}
                  options={roleOptions}
                  size="sm"
                  class="w-28"
                  onchange={(e: Event) =>
                    changeRole(m.id, (e.currentTarget as HTMLSelectElement).value as Role)}
                />
                <IconButton label="Remove member" size="sm" onclick={() => kick(m.id)}>
                  <X class="size-4" />
                </IconButton>
              {:else}
                <span class="text-caption capitalize text-muted">{m.role}</span>
              {/if}
            </li>
          {/each}
        </ul>

        {#if isOwner}
          <div class="mt-3 flex items-center gap-2">
            <Input bind:value={inviteEmail} placeholder="Invite by email…" class="flex-1" />
            <Select bind:value={inviteRole} options={roleOptions} size="md" class="w-28" />
            <Button variant="secondary" onclick={invite} disabled={!inviteEmail.trim()}>Add</Button>
          </div>
          <p class="mt-1.5 text-caption text-muted">Add teammates who already have a Taurus account.</p>
        {/if}
      </div>
    {/if}
  </div>
{/if}
