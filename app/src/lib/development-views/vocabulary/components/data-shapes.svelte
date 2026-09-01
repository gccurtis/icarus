<script lang="ts">
  import CommentBox from "$development-views/vocabulary/components/comment-box.svelte";
  import SectionTitle from "$development-views/vocabulary/components/section-title.svelte";
  import { PanelChip } from "$authored-components/panel";

  /**
   * What each form implies about the query behind it.
   *
   * **This is the section that keeps the page honest.** Every example above
   * renders a string. A shape is only worth adopting if something can actually
   * fill it, so each row here names what the view will ask for and whether that
   * question can be answered yet.
   *
   * The `Needs` lines in `docs/screen-panel-views` are the per-panel version of
   * this table; taken together they are the list of queries the capabilities
   * layer has to grow.
   */
  const SHAPES = [
    {
      form: "PanelRow list",
      needs: "A page of records with a title, one qualifying string, and a stable id to inspect by.",
      from: "A project-scoped query per kind. Never an array stored on the project.",
      state: "missing" as const
    },
    {
      form: "PanelSection count",
      needs: "A total, separate from the page. The count is of everything, not of what was returned.",
      from: "The same query, returning a count alongside its page.",
      state: "missing" as const
    },
    {
      form: "PanelFields on one thing",
      needs: "One record, whole. Fields are read together, so this is one read rather than one per row.",
      from: "A read by id, in the capability that owns the kind.",
      state: "missing" as const
    },
    {
      form: "PanelChip carrying state",
      needs: "A state the server computed. A view must not derive 'expired' from a timestamp — two clients would disagree.",
      from: "A state field on the record.",
      state: "partial" as const
    },
    {
      form: "PanelQuote of a comment",
      needs: "The comment body, its author, and the text range it anchors to, resolved to current text.",
      from: "The comment capability. The anchor resolution is the hard half.",
      state: "partial" as const
    },
    {
      form: "PanelLink to an actor",
      needs: "An actor reference that resolves to a name and a kind — person, agent, automation, connector.",
      from: "One actor read, shared by every 'who' on every screen.",
      state: "partial" as const
    },
    {
      form: "Presence — 'here now'",
      needs: "Who is in the project this second, and roughly where.",
      from: "An ephemeral channel. Never lastSeenAt, and never Activity — both report someone who closed the tab an hour ago.",
      state: "missing" as const
    },
    {
      form: "The mentions feed",
      needs: "Comments mentioning the current user, and a per-user read marker.",
      from: "A mention query. The read marker does not exist in the model at all.",
      state: "missing" as const
    },
    {
      form: "ScreenTable of project work",
      needs: "Every kind in one page, each row carrying which kind it is — a Research thread is not a resource.",
      from: "One query returning a discriminated reference per row.",
      state: "missing" as const
    },
    {
      form: "ScreenFilters count",
      needs: "Matched and total, from the same query, so a filtered view cannot read as the whole.",
      from: "The query returns both. Counting client-side over a page gives the wrong answer.",
      state: "missing" as const
    },
    {
      form: "ScreenThumb of a real body",
      needs: "Enough of a body to draw its shape, without fetching the body.",
      from: "A summary the server derives once, or a render on demand. Not a stored thumbnail — the model has no such field.",
      state: "open" as const
    },
    {
      form: "A Context's resolved count",
      needs: "What the rule matches right now, and how much of that is indexed.",
      from: "The resolver, which also has to supply per-result proofs for the 'In because' column.",
      state: "missing" as const
    },
    {
      form: "A persona's record",
      needs: "Tasks run, running, failed, and findings accepted, per persona.",
      from: "An aggregate. Counting client-side does not survive the first page of tasks.",
      state: "missing" as const
    },
    {
      form: "PanelEditableText committing",
      needs: "A write that takes the new value and says whether it was taken, plus the field's current value to fall back to.",
      from: "A command on the owning capability. The panel must not write the model directly — a rejected edit has to be able to put the old value back.",
      state: "missing" as const
    },
    {
      form: "PanelEditableText while in flight",
      needs: "Whether this particular value is saving, and whether it failed. Per field, not per panel.",
      from: "Undecided, and the decision is the model's: optimistic with a rollback, or held until the server answers. Both are defensible; only one can be built.",
      state: "open" as const
    },
    {
      form: "PanelSelect options",
      needs: "The allowed values, and which of them this reader may choose.",
      from: "The capability that owns the field. A list hard-coded in a view is a second copy of a rule the server enforces.",
      state: "missing" as const
    },
    {
      form: "PanelPairs add and remove",
      needs: "Create and delete, and a name uniqueness rule that answers before the row is committed.",
      from: "Commands on the owning capability. Uniqueness is a server rule — two readers can add the same name in the same second.",
      state: "missing" as const
    },
    {
      form: "Any edit, with someone else editing",
      needs: "What happens when the value changed underneath. Last-write-wins, a conflict, or a merge.",
      from: "Undecided. The revisions capability is the natural home, but nothing in the model says which of the three this is yet.",
      state: "open" as const
    }
  ];

  const TONE = {
    missing: { tone: "danger" as const, label: "No query yet" },
    partial: { tone: "attention" as const, label: "Partly modeled" },
    open: { tone: "accent-2" as const, label: "Undecided" }
  };
</script>

<section class="flex flex-col gap-4">
  <SectionTitle title="What each form needs" source="docs/screen-panel-views — the Needs lines, gathered">
    Every example on this page renders a string. A shape is only worth adopting if
    something can fill it, so this is the other half: what the view will ask for,
    and whether that question can be answered yet.
  </SectionTitle>

  <table class="w-full border-collapse">
    <thead>
      <tr>
        {#each ["Form", "What the view needs", "Where it comes from", ""] as column, index (index)}
          <th
            scope="col"
            class="text-caption text-ink-muted border-border-subtle border-b px-3 py-2 text-start font-semibold tracking-wide uppercase"
          >
            {column}
          </th>
        {/each}
        <th
          scope="col"
          class="text-caption text-ink-muted border-border-subtle w-[18.5rem] border-b py-2 pr-0 pl-6 text-start font-semibold tracking-wide uppercase"
        >
          Notes
        </th>
      </tr>
    </thead>
    <tbody>
      {#each SHAPES as shape (shape.form)}
        <tr>
          <td
            class="text-mono text-ink-primary border-border-subtle border-b py-2 pr-3 pl-0 align-top font-mono"
          >
            {shape.form}
          </td>
          <td class="text-body-sm border-border-subtle border-b px-3 py-2 align-top">
            {shape.needs}
          </td>
          <td class="text-caption text-ink-muted border-border-subtle border-b px-3 py-2 align-top">
            {shape.from}
          </td>
          <td class="border-border-subtle border-b px-3 py-2 align-top">
            <PanelChip tone={TONE[shape.state].tone}>{TONE[shape.state].label}</PanelChip>
          </td>
          <td class="border-border-subtle w-[18.5rem] border-b py-2 pr-0 pl-6 align-top">
            <CommentBox scope="shape" label={shape.form} />
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <p class="text-body-sm text-ink-secondary m-0 max-w-[70ch]">
    Until those exist, every panel holds its sample content inline and says so in
    its own doc comment. A shared fixture module would be worse and is also
    impossible here: the view standard forbids one view reaching inside another,
    so the workspace, the context panel and the inspector could not share it. The
    duplication is the cost of not faking a backend, and it disappears the moment
    all three read the same query.
  </p>
</section>
