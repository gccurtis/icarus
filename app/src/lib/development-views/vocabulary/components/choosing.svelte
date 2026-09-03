<script lang="ts">
  import CommentBox from "$development-views/vocabulary/components/comment-box.svelte";
  import SectionTitle from "$development-views/vocabulary/components/section-title.svelte";

  /**
   * The decision table: what you have, and what to reach for.
   *
   * This is the part of the page that is actually the language. The components
   * are easy to enumerate; choosing between two that could both hold the same
   * content is the thing that has to be written down, because otherwise every
   * author decides it again and the panels drift apart.
   */
  const CHOICES = [
    {
      have: "Show a list of things, each one openable",
      use: "PanelSection flush + PanelRow",
      why: "A row is a target. Rows run edge to edge so a hover fill reads as a target rather than a card."
    },
    {
      have: "Show a list of things that go nowhere",
      use: "PanelRow with no onselect",
      why: "It renders as a div, stays out of the tab order, and offers no hover. A dead target is worse than plain text."
    },
    {
      have: "Show what is true of one thing",
      use: "PanelFields + PanelField",
      why: "A description list, so a screen reader can say that the value is described by the label."
    },
    {
      have: "Show a fact whose value is long — a title, a description",
      use: "PanelField stacked",
      why: "The label column takes a third of a flank. Set beside it, a title wraps three times and reads as a paragraph with a word stuck to its left."
    },
    {
      have: "Show a state, a category, a count",
      use: "PanelChip",
      why: "Always with a word in it. State is never carried by colour alone."
    },
    {
      have: "Show who did something",
      use: "PanelActor",
      why: "A face, the name beside it, and what it is. The face is always a target, and a person, an agent and an Automation are tellable apart at a glance."
    },
    {
      have: "Show something that has a picture but no name",
      use: "PanelThumbs + PanelThumb",
      why: "A slide, a layout, a page. Every other word here identifies by a string; these have none, so the caption is an index or a role rather than an invented title."
    },
    {
      have: "Show text from somewhere else — a comment, a prompt, an answer",
      use: "PanelQuote + source",
      why: "The panel is showing it rather than saying it. The reference is not optional: a fragment with no way back has lost the context that made it mean anything."
    },
    {
      have: "Show a formula, an expression, a call's arguments",
      use: "PanelCode",
      why: "Wraps rather than scrolls. A horizontal scroll inside a panel hides the end of a formula behind a gesture nobody makes."
    },
    {
      have: "Explain something the panel is doing",
      use: "PanelNote",
      why: "A rule that is not obvious, or a control absent on purpose. Panels here say why."
    },
    {
      have: "Admit something the model cannot store yet",
      use: "PanelNote tone=\"gap\"",
      why: "Visually distinct from ordinary explanation, so a permanent limitation does not read as a passing hint."
    },
    {
      have: "Let someone change a value in place",
      use: "PanelEditableText",
      why: "Double-click when the text is mostly there to be read, single click when changing it is why they came. Every gesture has a keyboard equivalent, because no one double-clicks with a keyboard."
    },
    {
      have: "Let someone write a paragraph — a description, a brief",
      use: "PanelEditableText multiline",
      why: "Enter stays a newline and Cmd-Enter commits. A paragraph whose Enter key closes the editor cannot be written."
    },
    {
      have: "Let someone pick one of a known set",
      use: "PanelSelect",
      why: "Editable text would accept anything typed into it, which for a closed set means accepting a value the model will reject."
    },
    {
      have: "Let someone pick one of a few, with all of them visible",
      use: "PanelChoice",
      why: "A scope above the list it narrows. The set being visible is the point, which is the whole difference from PanelSelect — and it is a real control, not two tinted spans."
    },
    {
      have: "Let someone turn something on",
      use: "PanelToggle",
      why: "For a setting that takes effect immediately. A value submitted with a form is a checkbox, and nothing here submits."
    },
    {
      have: "Let someone create the rows as well as fill them",
      use: "PanelPairs + PanelPair",
      why: "The left column is the reader's, which is the whole difference from PanelFields. Variables, headers, template inputs."
    },
    {
      have: "Offer controls acting on the whole panel",
      use: "Panel actions snippet + PanelButton",
      why: "Under the title, before the content. The panel had a footer band and every button in it was buried — last in reading order, below a list of unbounded length."
    },
    {
      have: "Let someone narrow a list",
      use: "PanelSearch",
      why: "It contains what it searches, so the scope is the markup. A field that does not hold its own content leaves \"what does this filter?\" answerable only by reading the caller. The count is matched-of-total or it lies."
    },
    {
      have: "Name a band of the plane",
      use: "ScreenGroup",
      why: "A caption in caps over whatever the band holds. It never collapses — disclosure is a flank problem, and a plane that can hide half of itself gives no way to know it had."
    },
    {
      have: "Offer the one thing this screen makes",
      use: "ScreenAction",
      why: "32px rather than the panel's 24, in the interactive role, and only ever one. A screen with two equally loud actions has not decided what it is for."
    },
    {
      have: "Qualify what is on the screen, quietly",
      use: "ScreenNote",
      why: "Read after the work, permanent, not dismissible. A banner is read before the work and is loud on purpose; a caveat in a banner shouts a footnote."
    },
    {
      have: "Show rows of things, at screen width",
      use: "ScreenTable + ScreenRow + ScreenCell",
      why: "Eight screens list what they hold this way. Columns are the caller's; no two of these tables carry the same ones."
    },
    {
      have: "Show a header that is more than a row of words",
      use: "ScreenTable head + ScreenHeadCell",
      why: "A group over two columns, a sort control, a unit under a name. A column model general enough for all of them would be a schema for eight one-off shapes."
    },
    {
      have: "Show things you recognise by looking",
      use: "ScreenCards + ScreenCard + ScreenThumb",
      why: "A template, a chart and a layout are shapes. A list of chart titles is not a way to find a chart."
    },
    {
      have: "Let someone browse those things rather than search them",
      use: "ScreenShelf + ScreenShelfItem",
      why: "The carousel shelf: a row you push, with the well and the overhang. Right for six recent things, wrong for sixty — what is off the edge cannot be scanned."
    },
    {
      have: "Let someone move something somewhere else",
      use: "Draggable + DropZone",
      why: "Both take the destinations rather than only firing events, so the drag and the menu that does it without one are the same declaration. Nothing here is drag-only."
    },
    {
      have: "Let someone scroll a row of cards with two fingers",
      use: "ScreenStrip",
      why: "A native scroll container, so the browser's gestures come free. The shelf's motion is embla's, which owns the pointer but not the wheel."
    },
    {
      have: "Show a screen with nothing on it",
      use: "ScreenEmpty",
      why: "Never used and filtered-to-nothing look identical and want opposite things — an invitation, or the filter cleared."
    },
    {
      have: "Show how far through something is",
      use: "PanelProgress",
      why: "Always with the figure beside it. Omitting the value draws the indeterminate form, because a bar at zero and work that never started are the same picture."
    },
    {
      have: "Show that you are still finding out",
      use: "PanelSkeleton",
      why: "Shaped like what is coming, so nothing moves when it lands. A spinner says only 'wait' and then shifts the layout."
    },
    {
      have: "Show several actors at once",
      use: "PanelFaces",
      why: "Presence, as faces. The overflow is a control — a plus-three you cannot press hides three of the people this shape exists to name."
    },
    {
      have: "Say something about the whole screen",
      use: "ScreenBanner",
      why: "Something that has to be said before the work rather than after, and would be dismissed and forgotten as a toast."
    },
    {
      have: "Stand in for a framework surface — ProseMirror, Fabric, Univer",
      use: "ScreenPlaceholder",
      why: "Name the framework and what we add. A drawn imitation is one nobody can tell from the real thing."
    }
  ];
</script>

<section class="flex flex-col gap-4">
  <SectionTitle title="Choosing" source="the part that is actually a language">
    Two components can usually both hold the same content. Which one is right is
    the decision worth writing down, because otherwise every author makes it
    again and the panels drift apart. The left column is an <em>intent</em>
    rather than a thing you are holding — read down it and the gaps become
    visible, which is how the editing row of this table found the four
    components that were missing.
  </SectionTitle>

  <!--
    The note column is the table's own fourth column rather than a gutter beside
    it, because a row is the unit being judged here and a box that only lined up
    with a row would come apart the first time one wrapped to three lines.
  -->
  <table class="w-full border-collapse">
    <thead>
      <tr>
        {#each ["What you want to show or provide", "What to reach for", "Why that one"] as column (column)}
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
      {#each CHOICES as choice (choice.have)}
        <tr>
          <td class="text-body-sm border-border-subtle border-b py-2 pr-3 pl-0 align-top">
            {choice.have}
          </td>
          <td
            class="text-mono text-ink-primary border-border-subtle border-b px-3 py-2 align-top font-mono whitespace-nowrap"
          >
            {choice.use}
          </td>
          <td class="text-caption text-ink-muted border-border-subtle border-b px-3 py-2 align-top">
            {choice.why}
          </td>
          <td class="border-border-subtle w-[18.5rem] border-b py-2 pr-0 pl-6 align-top">
            <CommentBox scope="choosing" label={choice.have} />
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>
