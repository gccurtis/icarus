<script lang="ts">
  import ListChecks from "@lucide/svelte/icons/list-checks";
  import MessageSquare from "@lucide/svelte/icons/message-square";

  import {
    Panel,
    PanelActor,
    PanelButton,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelQuote,
    PanelSection
  } from "$authored-components/panel";
  import { Separator } from "$vendored-components/separator";
  import { actorName } from "$capabilities/cast";
  import { conversation, latestMessage } from "$capabilities/copilot";
  import { viewState } from "$model/client/view-state";

  /**
   * One thread with one agent, summarised enough to decide whether to go back
   * into it.
   *
   * `docs/screen-panel-views/inspector/copilot/conversation.md` is the
   * specification.
   *
   * **A summary and a way back in, not a transcript.** The transcript belongs in
   * the Copilot's own surface, which is why *Latest* is one message: the last
   * thing said is what tells you whether this is the thread you meant, and
   * anything more here is the composer redrawn badly in 300px.
   *
   * **Both actions are callbacks.** Continue reopens the thread in the composer
   * and Start a task hands the thread to the task machinery; neither is something
   * a lens can do on its own, so each is disabled until whoever mounted this says
   * what it means.
   */
  let {
    chatId = "ch-1",
    oncontinue,
    onstarttask
  }: {
    chatId?: string;
    /** Reopen this thread in the composer. */
    oncontinue?: () => void;
    /** Turn this conversation into work. */
    onstarttask?: () => void;
  } = $props();

  const view = viewState();

  const chat = $derived(conversation(chatId).current);
  const latest = $derived(latestMessage(chatId).current);

  const agent = $derived(actorName(chat.agent));

  const trail = $derived([{ label: "Copilot", key: "home" }, { label: chat.title }]);
</script>

<Panel title={chat.title}>
  {#snippet crumbs()}
    <PanelCrumbs {trail} onnavigate={() => view.inspect("copilot.home")} />
  {/snippet}

  {#snippet actions()}
    <PanelButton
      label="Continue"
      icon={MessageSquare}
      tone="primary"
      disabled={oncontinue === undefined}
      title="Reopen this thread in the composer"
      onclick={oncontinue}
    />
    <PanelButton
      label="Start a task from this"
      icon={ListChecks}
      disabled={onstarttask === undefined}
      title="Turn this conversation into work"
      onclick={onstarttask}
    />
  {/snippet}

  <PanelSection title="Conversation">
    <PanelFields>
      <PanelField label="Agent">
        <PanelActor
          name={agent}
          kind="agent"
          onselect={() =>
            view.inspect("agents.persona", { kind: "agent", id: chat.agent })}
        />
      </PanelField>
      <PanelField label="Turns" mono>{chat.turns}</PanelField>
      <PanelField label="Started">{chat.started}</PanelField>
      <PanelField label="Last active">{chat.lastActive}</PanelField>
    </PanelFields>
  </PanelSection>

  <!--
    The source line names the author rather than linking to them: a message
    carries a name and a time, and no id to open a lens with.
  -->
  <PanelSection title="Latest">
    <PanelQuote source="{latest.author} · {latest.at}">{latest.body}</PanelQuote>
  </PanelSection>

  <Separator />

  <!--
    The Actions band's two buttons are in the actions row under the title, where
    a control is found. What is left down here is what the panel has to say after
    its contents, which is a footnote rather than a control.
  -->
  <PanelNote tone="gap">
    What a task inherits from the conversation it came from is undefined. The
    prompt, the scope and the history are three different answers.
  </PanelNote>
</Panel>
