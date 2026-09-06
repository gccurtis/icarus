<script lang="ts">
  import Blocks from "@lucide/svelte/icons/layout-template";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import ClipboardCheck from "@lucide/svelte/icons/clipboard-check";
  import Library from "@lucide/svelte/icons/library";
  import MessagesSquare from "@lucide/svelte/icons/messages-square";
  import Shapes from "@lucide/svelte/icons/shapes";
  import Workflow from "@lucide/svelte/icons/workflow";

  import { ScreenCard, ScreenCards } from "$authored-components/screen";

  /**
   * The other demo pages, from the one everybody opens first.
   *
   * They were being reached by typing the URL, which meant that in practice only
   * the person who built them knew they existed. A reference nobody can find is
   * a reference nobody reads.
   *
   * **Each card says what the page is FOR rather than what is on it**, because
   * these pages answer different questions and picking the wrong one wastes the
   * trip: one is a catalogue of shapes, one is a working screen, one is an
   * argument about a data model, one is a conversation.
   */
  const PAGES = [
    {
      href: "/demo/editor-audit",
      title: "Editor audit",
      sub: "Document + slide deck findings, causes, and fixes",
      icon: ClipboardCheck,
      about:
        "The complete reported-issue ledger, source-traced root causes, target inspector layouts, creation repairs, priorities, acceptance tests, and evidence limits."
    },
    {
      href: "/demo/semantic-overlay/derived-output-flow",
      title: "Derived Output architecture",
      sub: "Resource text in; grounded content out",
      icon: Workflow,
      about:
        "Two purpose-built maps: the exact ingestion/generation/read procedure and the agent's prompt, tools, evidence protocol, and scaling seams."
    },
    {
      href: "/demo/document-editor-reference",
      title: "Document editor reference",
      sub: "Architecture, behavior, flows, and measured change",
      icon: BookOpen,
      about:
        "The implemented editor end to end: Context, Inspector, Content, Runtime, Backend, plus every changed file and its line count."
    },
    {
      href: "/demo/vocabulary",
      title: "Composition vocabulary",
      sub: "Every shape, and when not to use it",
      icon: Shapes,
      about:
        "The catalogue. Given something to put on a screen, which word holds it — and why that one rather than its neighbour."
    },
    {
      href: "/demo/analysis",
      title: "Analysis",
      sub: "A working chart, driven by an editable table",
      icon: ChartColumn,
      about:
        "Six chart kinds over the same data, switchable. Edit a number and the picture follows; copy the result as an image."
    },
    {
      href: "/demo/blocks",
      title: "Content blocks",
      sub: "One component, two surfaces",
      icon: Blocks,
      about:
        "A document and a slide rendering the same block with the same data. The inspector changes with how the block is sized."
    },
    {
      href: "/demo/thread",
      title: "Thread",
      sub: "A conversation, and what one has to carry",
      icon: MessagesSquare,
      about:
        "A message thread with canned replies, each demonstrating something a real thread needs: a citation, a tool call, work in flight, a finding."
    },
    {
      href: "/demo/templates",
      title: "Template library",
      sub: "The live future state and every boundary behind it",
      icon: Library,
      about:
        "A live owner-only library in a project-scoped call, beside its data flow, code inventory, access decisions and clearly deferred authoring-session proposal."
    }
  ];
</script>

<section class="flex flex-col gap-4">
  <div class="flex flex-col gap-1">
    <h2 class="text-h3 font-semibold">The other demos</h2>
    <p class="text-body-sm text-ink-secondary m-0 max-w-[70ch]">
      This page is the design system — colours, type, the registry. These demos are
      about what gets built out of it.
    </p>
  </div>

  <ScreenCards min="15rem">
    {#each PAGES as page (page.href)}
      <ScreenCard href={page.href} title={page.title} sub={page.sub} icon={page.icon}>
        <span class="text-caption text-ink-muted">{page.about}</span>
      </ScreenCard>
    {/each}
  </ScreenCards>
</section>
