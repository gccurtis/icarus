<script lang="ts">
  import { FileUp, FolderUp, Paperclip, X } from '@lucide/svelte';
  import { Button, Tooltip } from '$lib/components';
  import { aiAgent, attachFiles, attachFolder, removeAttachment } from '$data/ai-agent';

  // Chat-scoped attachments — Omega feeds a text attachment to the turn as
  // context. Behind the Files capability, so degrade to a notice if absent.

  // Hidden pickers the File/Folder buttons trigger. `webkitdirectory` isn't in the
  // HTML attribute types, so it's set imperatively on the folder input.
  let fileInput = $state<HTMLInputElement>();
  let folderInput = $state<HTMLInputElement>();
  $effect(() => {
    folderInput?.setAttribute('webkitdirectory', '');
  });

  function onFilePicked(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    if (input.files?.length) void attachFiles(input.files);
    input.value = '';
  }

  function onFolderPicked(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    if (input.files?.length) void attachFolder(input.files);
    input.value = '';
  }
</script>

{#if $aiAgent.attachmentsUnavailable}
  <p class="rounded-control border border-dashed border-border px-2.5 py-2 text-caption text-muted">
    Attachments aren’t enabled on this server.
  </p>
{:else}
  <input
    bind:this={fileInput}
    type="file"
    multiple
    class="sr-only"
    tabindex="-1"
    aria-label="Attach a file"
    onchange={onFilePicked}
  />
  <input
    bind:this={folderInput}
    type="file"
    class="sr-only"
    tabindex="-1"
    aria-label="Attach a folder"
    onchange={onFolderPicked}
  />
  <div class="grid grid-cols-2 gap-1.5">
    <Button
      variant="secondary"
      size="sm"
      aria-label="Add file"
      disabled={!$aiAgent.activeChatId}
      onclick={() => fileInput?.click()}
    >
      <FileUp class="size-3.5" />
      File
    </Button>
    <Button
      variant="secondary"
      size="sm"
      aria-label="Add folder"
      disabled={!$aiAgent.activeChatId}
      onclick={() => folderInput?.click()}
    >
      <FolderUp class="size-3.5" />
      Folder
    </Button>
  </div>
  {#if !$aiAgent.activeChatId}
    <p class="text-caption text-muted">Start a chat to attach files.</p>
  {:else if $aiAgent.attachments.length}
    <ul class="space-y-1">
      {#each $aiAgent.attachments as attachment (attachment.id)}
        <li class="flex min-h-9 items-center gap-2 rounded-control border border-border px-2 py-1.5">
          <Paperclip class="size-3.5 shrink-0 text-muted" />
          <span
            class="min-w-0 flex-1 truncate text-caption text-secondary"
            title={attachment.relativePath ?? attachment.name}
          >
            {attachment.name}
          </span>
          <Tooltip content={`Remove ${attachment.name}`} placement="left">
            <button
              type="button"
              onclick={() => removeAttachment(attachment.id)}
              aria-label={`Remove ${attachment.name}`}
              class="dur-micro flex size-6 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-elevated hover:text-danger"
            >
              <X class="size-3.5" />
            </button>
          </Tooltip>
        </li>
      {/each}
    </ul>
  {/if}
{/if}
