<script lang="ts">
  import Blocks from "@lucide/svelte/icons/layout-template";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Bot from "@lucide/svelte/icons/bot";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import ClipboardCheck from "@lucide/svelte/icons/clipboard-check";
  import FlaskConical from "@lucide/svelte/icons/flask-conical";
  import Library from "@lucide/svelte/icons/library";
  import MessagesSquare from "@lucide/svelte/icons/messages-square";
  import Network from "@lucide/svelte/icons/network";
  import ScanEye from "@lucide/svelte/icons/scan-eye";
  import Shapes from "@lucide/svelte/icons/shapes";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Workflow from "@lucide/svelte/icons/workflow";

  import { ScreenCard, ScreenCards } from "$authored-components/screen";

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
        "A connected architecture set: exact procedure flow, agent runtime, resource reading, semantic materials, evidence protocol, and scaling seams."
    },
    {
      href: "/demo/semantic-overlay/ingestion-and-tools",
      title: "Semantic intake and agent sightline",
      sub: "What updates the overlay; what the writer can actually observe",
      icon: Network,
      about:
        "The current implementation switchboard: every automatic ingestion hook, both durable lanes, processing conditions, and all sixteen executable agent tools."
    },
    {
      href: "/demo/semantic-overlay/slide-prompt-blocks",
      title: "Slide Prompt Blocks",
      sub: "One ordinary text box; one generated relationship",
      icon: Sparkles,
      about:
        "The implemented slide interaction: in-place conversion, editor/server ownership, collaborative refresh, editable publication, and its exact file map."
    },
    {
      href: "/demo/semantic-overlay/derived-output-live",
      title: "Executable Derived Output",
      sub: "Type a fact; retrieve and render it",
      icon: FlaskConical,
      about:
        "The real vertical slice: create a document, publish its Semantic Overlay, generate a grounded direct or named-variable output, and inspect copied evidence."
    },
    {
      href: "/demo/semantic-overlay/resource-reading",
      title: "Resource reading and evidence",
      sub: "Several narrow tools; one explicit authority grammar",
      icon: ScanEye,
      about:
        "The proposed traversal, contextual slide view, specialized evidence readers, evidence kinds, and shared document/deck projection seam."
    },
    {
      href: "/demo/semantic-overlay/material-layer",
      title: "Semantic material layer",
      sub: "Make data, images, tables, and code discoverable",
      icon: Sparkles,
      about:
        "The goal-state material registry, profiling and description pipeline, two-lane overlay, interpreted evidence policy, native readers, and implementation surface."
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
      title: "Template reference",
      sub: "How templates work, and everything that changed",
      icon: Library,
      about:
        "Two pages: the model, the three verbs, the working copy and the panels; then the ten systematic changes, the decisions three reviews settled, every file and every check."
    },
    {
      href: "/demo/agents-reference",
      title: "Agents reference",
      sub: "Nine pages staging the built category, with a note gutter on every row",
      icon: Bot,
      about:
        "The real library, persona, task and automation surfaces, the rail and the lenses, each live over the project's store, then the rows, doors and seed behind them. Nothing runs an agent."
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
