import type { PageSlug, Question } from "$development-views/agents-reference/types";

export const QUESTIONS: readonly Question[] = [
  {
    n: 1,
    page: "context",
    title: "A chat opens as a research thread, keyed by the persona thread",
    matters:
      "A chat is started from a persona and opens in its own research tab. The research thread surface is still a static mock, so the tab opens but does not yet read the thread it was opened on.",
    options: [
      "Open research.thread with the personaThreads id as the tab's resource, and wire the research surface to read it next.",
      "Give Agents its own chat surface now and leave research alone."
    ],
    recommendation:
      "The first, and it is what is built. The thread rows exist and the tab is titled from them; the research surface is the one place left to teach."
  },
  {
    n: 2,
    page: "library",
    title: "The Tasks table lists tasks only",
    matters:
      "Automations are rows of a different kind. They are reached from the Automations panel, from a persona's own band, and from a task's origin.",
    options: [
      "Tasks only in the table, automations everywhere else.",
      "A Tasks · Automations toggle above the table, keeping one plane for both."
    ],
    recommendation: "Tasks only, as built. A task row and a rule row do not share columns, and the panel already lists the rules."
  },
  {
    n: 11,
    page: "library",
    title: "Create still shows Skill, and it does nothing",
    matters:
      "Skills were removed from the build. The pill was kept so the shape of Create does not change when they come back.",
    options: [
      "Keep the pill inert and quiet, as built.",
      "Drop the pill until skills exist, and add it back with them."
    ],
    recommendation:
      "Keep it, as asked. It is the one control in the category that does nothing, and it says so in its title."
  },
  {
    n: 12,
    page: "library",
    title: "The persona filter is the library's own state",
    matters:
      "The review found a narrowing that survived a refresh and asked for Any as the start. The filter now lives in the library surface and resets whenever the library is shown; the rail inspects and never narrows.",
    options: [
      "Local state that starts on Any, as built.",
      "Workspace state again, with an explicit Any that persists across reloads."
    ],
    recommendation: "Local, as built. A filter that is remembered is a filter that surprises."
  },
  {
    n: 3,
    page: "automation",
    title: "New automation creates a row switched off; New task is a form",
    matters:
      "A persona is created at once under a working name and opened, the way Templates does it. A task starts running when it exists, so it needs its instruction first.",
    options: [
      "Create the automation at once, off and unwritten, and refuse to run or enable it until the instruction is written.",
      "A form for automations too, mirroring the task form."
    ],
    recommendation: "Create at once. Editing in place is the category's idiom, and Off is an honest state for a rule nobody has written."
  },
  {
    n: 5,
    page: "context",
    title: "Manual is a section of Automations",
    matters:
      "A task is a run, so a task cannot be run again. What a person runs by hand is a rule with a manual trigger, and each press makes one task. It used to be a panel of its own.",
    options: [
      "One Automations panel with Manual, On and Off as sections.",
      "A separate Manual panel again, for the work a person starts."
    ],
    recommendation: "One panel, as asked. Three sections cost nothing and the rail is shorter for it."
  },
  {
    n: 6,
    page: "task",
    title: "Run now and Create make a real running task with no plan",
    matters:
      "There is no runner. A created task sits running with an empty plan, and the surface says a runner has not picked it up.",
    options: [
      "Write the row. The record is honest and the runner, when it exists, picks up exactly this.",
      "Keep Run and Create disabled with the missing runner in their title."
    ],
    recommendation: "Write the row, as built. The write side is in scope; a disabled control would leave the whole task path untested."
  },
  {
    n: 8,
    page: "task",
    title: "An answer also lands in the thread",
    matters: "A question is answered in its own band. The runner reads the thread.",
    options: [
      "Record the answer on the question and append it to the thread as a person's message.",
      "Record it on the question only."
    ],
    recommendation: "Both, as built. The thread is what an agent reads; the question band is what a person reads."
  },
  {
    n: 13,
    page: "task",
    title: "Outputs carries a count only when it is zero",
    matters:
      "Every matched-of-total count was removed. One number was kept: the zero on Outputs, so an empty band reads as empty rather than unloaded.",
    options: [
      "Show 0 on Outputs and nothing when there are outputs, as built.",
      "Show no count anywhere, and let the empty state's sentence carry it."
    ],
    recommendation: "The zero, as asked. It is the one case the review named."
  },
  {
    n: 14,
    page: "task",
    title: "Reject settles the question and tells the agent",
    matters:
      "A rejected question is closed on the record, and a message goes into the thread telling the agent to use its judgement, so the runner is not left waiting on a question nobody will answer.",
    options: [
      "Close it and append the message, as built.",
      "Close it silently; the runner notices the question is no longer open."
    ],
    recommendation: "The message, as built. The thread is what the runner reads."
  },
  {
    n: 15,
    page: "backend",
    title: "Skills are gone, rows and all",
    matters:
      "The skills table, its four procedures, its surface, its lens, its panel and the skillIds on every persona, task and automation were deleted rather than hidden. Nothing was committed, so the work is not recoverable from git.",
    options: [
      "Delete the whole layer and build it again when conditional steps are worth designing.",
      "Keep the rows and procedures dormant behind a hidden surface."
    ],
    recommendation:
      "Delete it, as asked. A dormant table is a thing every later change has to keep working."
  },
  {
    n: 16,
    page: "backend",
    title: "A scope on a task or a rule, inheriting from the persona",
    matters:
      "The persona carries a default scope. A task or an automation may carry its own; when it does not, it reads whatever the persona reads, and the surface says so.",
    options: [
      "An optional scope on both rows, cleared with one control back to the persona's.",
      "Copy the persona's scope onto the row at creation, so every task carries its own from the start."
    ],
    recommendation:
      "Optional, as built. A copy taken at creation goes stale the moment the persona's changes."
  },
  {
    n: 9,
    page: "backend",
    title: "Everything is project-scoped",
    matters: "A persona may still have no project. Personal personas get pulled into a project and every count is relative to the project.",
    options: [
      "Visible personas are the project's, plus the viewer's own project-less ones; every seeded persona has the project.",
      "Only the project's personas, ever."
    ],
    recommendation: "The first, as built. Nothing in the UI distinguishes the two; the extra rule only stops a viewer losing something they made."
  },
  {
    n: 10,
    page: "backend",
    title: "The tool catalogue is a constant, not a table",
    matters: "Tools are what a runner offers. Nobody creates one in a project.",
    options: [
      "A constant in the representation's behavior, with a closed ToolId union.",
      "A tools table, seeded, so a project could add one."
    ],
    recommendation: "A constant, as built. A tool id outside the catalogue is refused at the door."
  },
  {
    n: 17,
    page: "persona",
    title: "Model preference left the surface, not the row",
    matters:
      "Strength and speed are still on the persona row and still default to medium. No control sets them any more.",
    options: [
      "Keep the field, show nothing, and decide later what sets it.",
      "Drop the field from the row as well."
    ],
    recommendation:
      "Keep the field, as asked. What model runs a persona is a decision, but not one this surface was making well."
  }
];

export const questionsFor = (page: PageSlug): readonly Question[] =>
  QUESTIONS.filter((question) => question.page === page);
