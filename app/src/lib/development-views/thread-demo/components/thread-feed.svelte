<script lang="ts">
  import AtSign from "@lucide/svelte/icons/at-sign";
  import Check from "@lucide/svelte/icons/check";
  import FilePen from "@lucide/svelte/icons/file-pen";
  import GitCommitVertical from "@lucide/svelte/icons/git-commit-vertical";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Upload from "@lucide/svelte/icons/upload";

  import { Panel, PanelNote, PanelRow, PanelSection } from "$authored-components/panel";

  /**
   * The feed, rendered — because the page next door argues at length that a feed
   * needs no new component and then shows nobody a feed.
   *
   * Every row here is `PanelRow` inside `PanelSection`, which is the whole
   * claim: a feed is a query plus a row, and the row already exists. What makes
   * these rows a *feed* rather than a thread is on the record, not in the
   * markup — each one carries an origin ("on Q3 Resilience Memo"), each one is
   * finished the moment it is written, and there is no composer at the foot,
   * because there is no *here* for a new row to belong to.
   */
  let { onopen }: { onopen: (what: string) => void } = $props();

  const ACTIVITY = [
    {
      day: "Today",
      rows: [
        {
          title: "Ana Reyes edited",
          sub: "Q3 Resilience Memo",
          meta: "4m",
          icon: FilePen,
          tone: "default" as const
        },
        {
          title: "Research accepted a finding",
          sub: "Undergrounding · storm response",
          meta: "22m",
          icon: Check,
          tone: "success" as const
        },
        {
          title: "Mira Jain uploaded",
          sub: "field-reports-2025-Q3.csv",
          meta: "1h",
          icon: Upload,
          tone: "default" as const
        },
        {
          title: "Outage model re-ran",
          sub: "12 feeders · 3 changed",
          meta: "2h",
          icon: Sparkles,
          tone: "intelligence" as const
        }
      ]
    },
    {
      day: "Yesterday",
      rows: [
        {
          title: "Dev Okonkwo published",
          sub: "Winter readiness brief",
          meta: "16:40",
          icon: GitCommitVertical,
          tone: "default" as const
        },
        {
          title: "Ana Reyes reverted a change",
          sub: "Q3 Resilience Memo · §2",
          meta: "11:02",
          icon: FilePen,
          tone: "attention" as const
        }
      ]
    }
  ];

  const MENTIONS = [
    {
      title: "Mira Jain",
      sub: "“@you — is the 38% figure customer-minutes or events?”",
      meta: "18m"
    },
    {
      title: "Dev Okonkwo",
      sub: "“@you can we cite the 2023 spans study here rather than the memo?”",
      meta: "3h"
    }
  ];
</script>

<Panel title="Feed">
  {#each ACTIVITY as { day, rows } (day)}
    <PanelSection title={day} count={rows.length} flush chevron="end">
      {#each rows as row (row.title + row.meta)}
        <PanelRow
          title={row.title}
          sub={row.sub}
          meta={row.meta}
          icon={row.icon}
          tone={row.tone}
          onselect={() => onopen(`${row.title} — ${row.sub}`)}
        />
      {/each}
    </PanelSection>
  {/each}

  <PanelSection title="Mentions" count={MENTIONS.length} flush chevron="end">
    {#each MENTIONS as mention (mention.title + mention.meta)}
      <PanelRow
        title={mention.title}
        sub={mention.sub}
        meta={mention.meta}
        icon={AtSign}
        tone="active"
        onselect={() => onopen(`${mention.title}'s mention`)}
      />
    {/each}
  </PanelSection>

  <PanelNote>
    Same component as a thread turn's record, one line instead of a paragraph. The difference is
    not density: a feed row is an event that is finished the moment it is written, and a thread
    message is not. Append-only against append-and-amend — a different data structure, not a
    different stylesheet.
  </PanelNote>
</Panel>
