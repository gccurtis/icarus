<script lang="ts">
  import { untrack } from 'svelte';
  import { get } from 'svelte/store';
  import { Button, toast } from '$lib/components';
  import { isApiError } from '$data/api';
  import { workspace } from '$data/workspace';
  import { currentUserId, fetchMembers, type Member } from '$data/projects';
  import { organizations, loadOrganizations } from '$data/organizations';
  import { setResourceAccess, type AccessScope, type Resource } from '$data/resources';

  /**
   * The access editor for one resource. Rendered by BOTH the resource settings
   * dialog and the Overview inspector's Share modal, so the two cannot drift —
   * the same arrangement `ProjectSharing` has with project Share / settings.
   */
  let { resource, kindLabel }: { resource: Resource; kindLabel: string } = $props();

  let projectWide = $state(true);
  let selectedUserIds = $state<string[]>([]);
  let orgIds = $state<string[]>([]);
  let members = $state<Member[]>([]);
  let membersError = $state('');
  let saving = $state(false);

  // Omega allows only the owner to change access; an unknown creator is optimistic
  // (mock kinds save locally, documents surface the backend's 403 as a toast).
  const isOwner = $derived(!resource.creatorId || resource.creatorId === currentUserId());

  const sameSet = (x: string[], y: string[]) => x.length === y.length && x.every((v) => y.includes(v));
  const changed = $derived.by(() => {
    const a = resource.access;
    if (projectWide !== a.projectWide) return true;
    if (projectWide) return false;
    return !sameSet(selectedUserIds, a.userIds) || !sameSet(orgIds, a.orgIds);
  });

  $effect(() => {
    resource;
    const r = untrack(() => resource);
    projectWide = r.access.projectWide;
    selectedUserIds = [...r.access.userIds];
    orgIds = [...r.access.orgIds];
    members = [];
    membersError = '';
    saving = false;
    void loadMembers();
    void loadOrganizations().catch(() => {});
  });

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

  function toggleUser(userId: string) {
    selectedUserIds = selectedUserIds.includes(userId)
      ? selectedUserIds.filter((id) => id !== userId)
      : [...selectedUserIds, userId];
  }

  function toggleOrg(orgId: string) {
    orgIds = orgIds.includes(orgId) ? orgIds.filter((id) => id !== orgId) : [...orgIds, orgId];
  }

  async function save() {
    saving = true;
    const access: AccessScope = projectWide
      ? { projectWide: true, orgIds: [], userIds: [] }
      : { projectWide: false, orgIds, userIds: selectedUserIds };
    try {
      await setResourceAccess(resource.id, access);
      toast('Access updated.', { tone: 'success' });
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not update access.', { tone: 'danger' });
    } finally {
      saving = false;
    }
  }
</script>

{#if !isOwner}
  <p class="mb-2 rounded-control border border-border bg-panel px-3 py-2 text-caption text-muted">
    Only the owner can change who sees this {kindLabel.toLowerCase()}.
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
    <Button variant="secondary" size="sm" onclick={save} disabled={saving || !changed}>
      {saving ? 'Saving…' : 'Save access'}
    </Button>
  </div>
{/if}
