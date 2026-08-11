<script lang="ts">
  import { untrack } from 'svelte';
  import { Trash2 } from '@lucide/svelte';
  import { cn } from '$lib/utils';
  import { isApiError } from '$data/api';
  import { Modal, Field, Input, Button, Divider, toast } from '$lib/components';
  import {
    projects,
    updateProject,
    deleteProject,
    leaveProject,
    iconDotClass,
    ICON_COLORS,
    type IconColor
  } from '$data/projects';
  import ProjectSharing from './ProjectSharing.svelte';

  let {
    open = $bindable(false),
    projectId = null,
    onexit = undefined
  }: { open?: boolean; projectId?: string | null; onexit?: () => void } = $props();

  const project = $derived($projects.find((p) => p.id === projectId) ?? null);
  const isOwner = $derived(project?.role === 'owner');

  let editName = $state('');
  let confirmDelete = $state(false);

  // Access, links, and members now live in `ProjectSharing`, which loads them
  // itself. This dialog keeps only what is unique to settings: name, icon, and
  // the danger zone.
  $effect(() => {
    const id = projectId;
    if (open && id) {
      untrack(() => {
        editName = project?.name ?? '';
        confirmDelete = false;
      });
    }
  });

  async function saveName() {
    const next = editName.trim();
    if (!projectId || !next || next === project?.name) return;
    try {
      await updateProject(projectId, { name: next });
      toast('Project renamed', { tone: 'success' });
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not rename project', { tone: 'danger' });
    }
  }

  async function chooseIcon(c: IconColor) {
    if (!projectId) return;
    try {
      await updateProject(projectId, { icon: c });
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not update icon', { tone: 'danger' });
    }
  }

  async function remove() {
    if (!project) return;
    try {
      await deleteProject(project.id);
      open = false;
      toast('Project deleted', { tone: 'danger' });
      onexit?.();
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not delete project', { tone: 'danger' });
    }
  }
  async function leave() {
    if (!project) return;
    try {
      await leaveProject(project.id);
      open = false;
      toast('Left project');
      onexit?.();
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not leave project', { tone: 'danger' });
    }
  }
</script>

<Modal bind:open title="Project settings" size="lg">
  {#if project}
    <div class="space-y-6">
      <!-- Name (owner-editable; rename via PATCH /projects/:id) -->
      <Field label="Name">
        {#snippet children({ id })}
          {#if isOwner}
            <div class="flex items-center gap-2">
              <Input {id} bind:value={editName} class="flex-1" />
              <Button
                variant="secondary"
                onclick={saveName}
                disabled={!editName.trim() || editName.trim() === project.name}
              >
                Save
              </Button>
            </div>
          {:else}
            <Input {id} value={project.name} readonly />
          {/if}
        {/snippet}
      </Field>

      <!-- Icon (owner-editable; stored in Omega's icon field) -->
      <div>
        <p class="mb-1.5 text-label font-medium text-secondary">Icon</p>
        <div class="flex items-center gap-2">
          {#each ICON_COLORS as c (c)}
            <button
              type="button"
              disabled={!isOwner}
              aria-label={`Icon color ${c}`}
              onclick={() => chooseIcon(c)}
              class={cn(
                'dur-small size-6 rounded-full ring-2 ring-offset-2 ring-offset-elevated transition-transform disabled:opacity-60',
                iconDotClass(c),
                project.icon === c ? 'scale-110 ring-focus' : 'ring-transparent hover:scale-110'
              )}
            ></button>
          {/each}
        </div>
      </div>

      <!-- Access, share links, and members — the SAME component the top bar's
           Share dialog renders, so the two surfaces cannot drift. -->
      <ProjectSharing {projectId} />

      <Divider />

      <!-- Danger zone (real) -->
      <div>
        {#if isOwner}
          {#if !confirmDelete}
            <Button variant="ghost" class="text-danger hover:bg-danger/10" onclick={() => (confirmDelete = true)}>
              <Trash2 class="size-4" /> Delete project
            </Button>
          {:else}
            <div class="flex items-center gap-2 rounded-panel border border-danger/30 bg-danger/8 p-3">
              <span class="flex-1 text-body-sm text-primary">Delete "{project.name}" permanently?</span>
              <Button variant="ghost" onclick={() => (confirmDelete = false)}>Cancel</Button>
              <Button variant="danger" onclick={remove}>Delete</Button>
            </div>
          {/if}
        {:else}
          <Button variant="outline" onclick={leave}>Leave project</Button>
        {/if}
      </div>
    </div>
  {/if}
</Modal>
