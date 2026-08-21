<script lang="ts">
  import CircleQuestionMark from "@lucide/svelte/icons/circle-question-mark";
  import FlaskConical from "@lucide/svelte/icons/flask-conical";
  import Plus from "@lucide/svelte/icons/plus";

  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import {
    hypothesesIn,
    questionsIn,
    type Hypothesis,
    type Question
  } from "$mock-capabilities/research";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * The questions and ideas this project is working on, above any one thread.
   *
   * `docs/screen-panel-views/context/research/inquiry.md` is the specification. A
   * thread is an activity; a question is something the project wants to know and
   * outlives every thread that works on it, which is why it is listed here rather
   * than inside the thread's own history.
   *
   * **Nothing is rolled up.** Each question carries the status a person set on it,
   * so a parent reading Investigating while all three children are answered is a
   * legal state and is drawn as one — answering a child does not answer its
   * parent.
   *
   * The question the current thread is anchored to is marked in place, rather
   * than lifted out of the tree: where it sits under its parent is half of what
   * it means.
   */
  const questions = $derived(questionsIn(mockWorkbench.project.id).current);
  const ideas = $derived(hypothesesIn(mockWorkbench.project.id).current);

  const roots = $derived(questions.filter((row) => row.parentId === undefined));
  const childrenOf = (parentId: string) => questions.filter((row) => row.parentId === parentId);

  const STATUS: Record<Question["status"], "default" | "attention" | "success"> = {
    Open: "default",
    Investigating: "attention",
    Answered: "success"
  };

  /** Refuted is settled and testing is live; neither is a tally of what bears on it. */
  const ASSESSMENT: Record<Hypothesis["assessment"], "attention" | "success" | "danger"> = {
    Testing: "attention",
    Supported: "success",
    Refuted: "danger"
  };

  const openQuestion = (id: string) =>
    mockWorkbench.inspect("research.question", { kind: "question", id });

  const openHypothesis = (id: string) =>
    mockWorkbench.inspect("research.hypothesis", { kind: "hypothesis", id });
</script>

<Panel title="Inquiry">
  {#snippet actions()}
    <PanelButton label="Question" icon={Plus} tone="primary" onclick={() => openQuestion("new")} />
    <PanelButton label="Hypothesis" icon={Plus} onclick={() => openHypothesis("new")} />
  {/snippet}

  <!--
    One level of nesting and no more: a child of a child is a tree a 300px panel
    cannot draw, and the model's depth stops at one for the same reason.
  -->
  <PanelSection title="Questions" count={questions.length} flush>
    {#each roots as root (root.id)}
      <PanelRow
        title={root.text}
        sub={root.anchored ? "This thread is anchored here" : undefined}
        meta={root.status}
        icon={CircleQuestionMark}
        tone={STATUS[root.status]}
        selected={root.anchored}
        onselect={() => openQuestion(root.id)}
      />

      {#each childrenOf(root.id) as child (child.id)}
        <PanelRow
          title={child.text}
          sub={child.anchored ? "This thread is anchored here" : undefined}
          meta={child.status}
          icon={CircleQuestionMark}
          tone={STATUS[child.status]}
          selected={child.anchored}
          indent
          onselect={() => openQuestion(child.id)}
        />
      {/each}
    {/each}

    <PanelNote>
      Every status is set on its own question. Answering a child leaves its parent
      exactly where it was.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Hypotheses" count={ideas.length} flush>
    {#each ideas as idea (idea.id)}
      <PanelRow
        title={idea.statement}
        sub="Confidence {idea.confidence}"
        meta={idea.assessment}
        icon={FlaskConical}
        tone={ASSESSMENT[idea.assessment]}
        onselect={() => openHypothesis(idea.id)}
      />
    {/each}

    <PanelNote tone="gap">
      A confidence has no author and no date on it. 0.7 set by a person last month
      and 0.7 left by the last turn read identically and are not the same claim.
    </PanelNote>
  </PanelSection>
</Panel>
