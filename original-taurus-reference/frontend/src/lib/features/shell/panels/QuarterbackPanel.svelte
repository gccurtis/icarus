<script lang="ts">
  import { ArrowLeft, Sparkles } from '@lucide/svelte';
  import { Badge } from '$lib/components';
  import { aiAgent, aiModeCopy, aiModeOptions, loadChats, showAiChats } from '$data/ai-agent';
  import { workspace } from '$data/workspace';
  import { modeName, modeTones } from './quarterback/helpers';
  import ContextSection from './quarterback/ContextSection.svelte';
  import ContextManager from './quarterback/ContextManager.svelte';
  import ChatList from './quarterback/ChatList.svelte';
  import Transcript from './quarterback/Transcript.svelte';
  import TaskCard from './quarterback/TaskCard.svelte';

  // The AI Agent inspector panel — since the A3 decomposition, only the VIEW
  // SWITCH lives here: the context manager, the chats view, or the active
  // conversation. Each concern (sources, attachments, chat list, transcript,
  // task card) is its own component under quarterback/.
  let managingContext = $state(false);

  const activeChat = $derived(
    $aiAgent.chats.find((chat) => chat.id === $aiAgent.activeChatId) ?? null
  );
  const modeLabel = $derived(
    aiModeOptions.find((option) => option.value === $aiAgent.mode)?.label ?? 'Ask'
  );

  // Load the project's chats when the panel opens and whenever the project changes
  // (the store resets per project). Guarded so tab switches don't reload.
  let loadedProject = $state<string | null>(null);
  $effect(() => {
    const project = $workspace?.projectId ?? null;
    if (project && project !== loadedProject) {
      loadedProject = project;
      void loadChats();
    }
  });
</script>

<div class="space-y-3">
  {#if managingContext}
    <ContextManager onback={() => (managingContext = false)} />
  {:else if $aiAgent.view === 'chats'}
    <div class="space-y-2 border-b border-border pb-3">
      <div class="flex items-center gap-2">
        <Sparkles class="size-4 text-intel" />
        <p class="text-body-sm font-medium text-primary">{modeLabel}</p>
      </div>
      <p class="text-caption text-muted">{aiModeCopy[$aiAgent.mode].cue}</p>
    </div>

    <ContextSection onmanage={() => (managingContext = true)} />
    <ChatList />
  {:else if $aiAgent.view === 'conversation'}
    <div class="sticky top-0 z-10 -mx-3 flex items-center gap-2 border-b border-border bg-panel px-3 pb-3">
      <button
        onclick={showAiChats}
        aria-label="Back to chats"
        class="dur-micro flex size-7 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-elevated hover:text-primary"
      >
        <ArrowLeft class="size-4" />
      </button>
      <div class="min-w-0 flex-1">
        <p class="truncate text-body-sm font-medium text-primary" title={activeChat?.title ?? 'Chat'}>
          {activeChat?.title ?? 'Chat'}
        </p>
        <p class="text-caption text-muted">Messages from the bar continue here</p>
      </div>
      {#if activeChat}
        <Badge tone={modeTones[activeChat.mode]} class="shrink-0 px-1.5 py-0">
          {modeName(activeChat.mode)}
        </Badge>
      {/if}
    </div>

    <ContextSection onmanage={() => (managingContext = true)} />
    <Transcript />
    <TaskCard />
  {/if}
</div>
