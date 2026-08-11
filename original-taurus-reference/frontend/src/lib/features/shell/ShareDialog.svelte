<script lang="ts">
  import { Modal, Button } from '$lib/components';
  import ProjectSharing from '$lib/features/projects/ProjectSharing.svelte';

  // The top bar's Share dialog. This was a mock that copied a fixed
  // `/join/mock-share-token` and changed no access, while Project settings did
  // the real thing a few files away — so it now renders the SAME
  // `ProjectSharing` component and there is one implementation of sharing.
  //
  // Access mode, role-carrying links, and members are all real Omega calls; the
  // minted link is a working `/join/:token` that grants its role.
  let {
    open = $bindable(false),
    projectId = null,
    projectName = 'this project'
  }: { open?: boolean; projectId?: string | null; projectName?: string } = $props();
</script>

<Modal bind:open title="Share" size="md">
  <div class="space-y-4">
    <p class="text-body-sm text-secondary">
      Control who can reach <span class="font-medium text-primary">{projectName}</span>. Anyone
      opening a link joins at that link's role.
    </p>

    <ProjectSharing {projectId} />

    <div class="flex justify-end">
      <Button variant="ghost" onclick={() => (open = false)}>Done</Button>
    </div>
  </div>
</Modal>
