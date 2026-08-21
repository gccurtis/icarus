<script lang="ts">
  import CircleQuestionMark from "@lucide/svelte/icons/circle-question-mark";
  import FlaskConical from "@lucide/svelte/icons/flask-conical";

  import { Panel, PanelRow, PanelSection } from "$lib/unique-components/panel";
  import { hypotheses, questions, type HypothesisRow } from "$mock-capabilities/library";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * What the project is trying to find out, without a current thread to anchor
   * against.
   *
   * `docs/screen-panel-views/context/library/inquiry.md` is the specification.
   * Questions nest exactly one level: a child hangs off its parent, and a child
   * of a child would be a tree this panel is 300px too narrow to draw.
   *
   * The section is called *Ideas being tested* rather than *Hypotheses*, which is
   * the wording the single-question subscreen still uses. The two disagree and
   * one of them will lose; this file follows its own specification until then.
   */
  const allQuestions = $derived(questions().current);
  const allHypotheses = $derived(hypotheses().current);

  const roots = $derived(allQuestions.filter((row) => row.parentId === undefined));
  const childrenOf = (parentId: string) =>
    allQuestions.filter((row) => row.parentId === parentId);

  /** Ruled out and supported are settled; testing is live; untested is neither. */
  const ASSESSMENT: Record<
    HypothesisRow["assessment"],
    "default" | "success" | "danger" | "attention"
  > = {
    Untested: "default",
    Testing: "attention",
    Supported: "success",
    "Ruled out": "danger"
  };

  const openQuestion = (id: string) =>
    mockWorkbench.inspect("research.question", { kind: "question", id });
</script>

<Panel title="Inquiry">
  <PanelSection title="Questions" count={allQuestions.length} flush>
    {#each roots as root (root.id)}
      <PanelRow
        title={root.title}
        meta={root.status}
        icon={CircleQuestionMark}
        onselect={() => openQuestion(root.id)}
      />
      {#each childrenOf(root.id) as child (child.id)}
        <PanelRow
          title={child.title}
          meta={child.status}
          icon={CircleQuestionMark}
          indent
          onselect={() => openQuestion(child.id)}
        />
      {/each}
    {/each}
  </PanelSection>

  <PanelSection title="Ideas being tested" count={allHypotheses.length} flush>
    {#each allHypotheses as idea (idea.id)}
      <PanelRow
        title={idea.title}
        meta={idea.assessment}
        icon={FlaskConical}
        tone={ASSESSMENT[idea.assessment]}
        onselect={() =>
          mockWorkbench.inspect("research.hypothesis", { kind: "hypothesis", id: idea.id })}
      />
    {/each}
  </PanelSection>
</Panel>
