<script lang="ts">
  import type { Tab } from "$model/client";
  import { clientModel } from "$model/client";
  import { Panel, PanelNote, PanelRow, PanelSection } from "$lib/unique-components/panel";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import MessageSquare from "@lucide/svelte/icons/message-square";

  /**
   * What a person addressed to you, and nothing else.
   *
   * A mention is the one thing worth interrupting for, which is why it leads the
   * screen rather than sitting inside Activity, and why machine noise is not
   * mixed into it. An agent replying in a thread you follow belongs here too —
   * it was addressed at you. A resource changing did not.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();

  const UNREAD = [
    { who: "Mira Jain on Q3 Resilience Memo", quote: "“@ana can you confirm 1,842,000…”", when: "2h" },
    { who: "Tomas Kaur on Board Update, slide 4", quote: "“@ana is this the chart you wanted…”", when: "4h" },
    { who: "Mira Jain on Outage Cost Model, C2", quote: "“@ana corrected total or the old one?”", when: "1d" }
  ];
</script>

<Panel title="Mentions">
  <PanelSection title="Unread" count={3} flush>
    {#each UNREAD as mention (mention.quote)}
      <PanelRow
        title={mention.who}
        sub={mention.quote}
        meta={mention.when}
        icon={MessageSquare}
        tone="active"
        onselect={() => workbench.inspect("project.mention")}
      />
    {/each}
  </PanelSection>

  <PanelSection title="Read" count={1} open={false} flush>
    <PanelRow
      title="Tomas Kaur on Storm Hardening Options"
      sub="“@ana approved, thanks”"
      meta="3d"
      icon={CircleCheck}
      onselect={() => workbench.inspect("project.mention")}
    />
  </PanelSection>

  <PanelNote>
    A mention is addressed to you by a person. It is the one thing worth
    interrupting for, which is why it leads rather than sitting inside Activity.
  </PanelNote>
</Panel>
