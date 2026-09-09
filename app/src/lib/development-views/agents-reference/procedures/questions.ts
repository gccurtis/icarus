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
  },
  {
    n: 18,
    page: "rebase",
    title: "The credential reaches this worktree by a symlink",
    matters:
      "The server will not start without intelligence.providers.openrouter.apiKey, the loader reads only YAML, and a worktree has none of the main checkout's ignored files. Every future worktree hits this on its first run after touching this branch.",
    options: [
      "Symlink app/configuration/local.yaml at the main checkout's, as done here.",
      "Copy a local.yaml into each worktree and let the two drift.",
      "Teach the loader to read a named environment variable when a key is absent."
    ],
    recommendation:
      "The symlink now, because it is one command and cannot drift. The third is the real answer if a fourth worktree needs it, and it is a change to one file."
  },
  {
    n: 19,
    page: "rebase",
    title: "The category is still one commit",
    matters:
      "One commit of 142 files replays cleanly and reviews badly. Splitting it costs nothing while it is unmerged and cannot be done afterwards.",
    options: [
      "Leave it as one commit until it lands.",
      "Split it along the five build phases: rows, capability, read model, surfaces, vocabulary and docs."
    ],
    recommendation:
      "Split it before it lands, along the phases the backend page already names. It is the same content and it is the difference between a reviewable branch and a diff nobody reads."
  },
  {
    n: 20,
    page: "intelligence",
    title: "A chat is its own capability, not another agents procedure",
    matters:
      "A chat is a research thread with a turn beside each response. A task is a run with a plan, outputs and questions. They share a thread and nothing else.",
    options: [
      "A research-chat capability with seven procedures of its own.",
      "Seven more procedures inside agents, which already owns createChat for persona threads."
    ],
    recommendation:
      "Its own capability. The agents createChat makes a persona thread and is a different row in a different table, and one index holding both would be two capabilities wearing one name."
  },
  {
    n: 21,
    page: "intelligence",
    title: "The evidence goes in a turn row, not in the message",
    matters:
      "A Message has blocks, an author, attachments and labels. Queries, evidence, tool calls and usage are facts about a run, and there is nowhere on a message to put them that does not change what a message is everywhere else.",
    options: [
      "A researchTurns row keyed to the response message.",
      "Extend Message with an optional evidence field and let every thread carry it.",
      "Write the evidence into the response as attachments and lose the rest."
    ],
    recommendation:
      "The row. It also gives the queue somewhere to live and makes the inspector a read of one row rather than a walk of the thread."
  },
  {
    n: 22,
    page: "intelligence",
    title: "The first chat does not stream",
    matters:
      "Message.state already has a streaming value and the port answers once. Streaming would be a second method on the port and a partial write on every round.",
    options: [
      "Publish when the turn settles; show queued and running from the turn row.",
      "Add a streaming method to the port before the first chat ships."
    ],
    recommendation:
      "Publish when it settles. The running state plus the tool calls arriving in the lens is most of what a stream buys, and the surfaces do not change when streaming is added later."
  },
  {
    n: 23,
    page: "intelligence",
    title: "An Explore chat has no persona",
    matters:
      "The agents category keys everything on a persona. A chat opened from the research category has nobody obvious to be, and asking for one before the first message is a dialog in front of a text box.",
    options: [
      "No persona: a project default instruction, and the grants that go with it.",
      "Always a persona, chosen in the composer beside the mode.",
      "No persona by default, with a persona settable per chat afterwards."
    ],
    recommendation:
      "The third. Explore should open on an empty box, and a chat that turns out to need a specialist can be given one without starting again."
  },
  {
    n: 24,
    page: "explore",
    title: "The centre holds one turn, and Turns holds the rest",
    matters:
      "The question at the top and the answer filling the plane is one turn on screen. A conversation has more than one, and they have to be somewhere.",
    options: [
      "A Turns panel beside Threads; choosing a turn moves the centre and the lens to it.",
      "The centre scrolls the whole transcript with the current question pinned to the top.",
      "A previous and next control above the answer."
    ],
    recommendation:
      "The first, which is what is built. Two flat panels rather than one with a nested list, so neither has to explain itself."
  },
  {
    n: 25,
    page: "explore",
    title: "Question and Hypothesis are shown and disabled",
    matters:
      "Only Explore is wired. A dropdown with one item does not read as a mode, and a mode that appears later changes what the control means.",
    options: [
      "Show all three, disable the two that do nothing.",
      "Show only Explore until the others work."
    ],
    recommendation:
      "Show all three, as asked. A disabled item with a reason is honest; a control that grows new meanings is not."
  },
  {
    n: 26,
    page: "explore",
    title: "The chat has its own composer rather than the authored one",
    matters:
      "ScreenComposer puts the scope and the send at the foot and always draws the keycaps. The chat wants a head, no caps, no gap between the field and its surface, and dropdowns that blend in. The task surface is meanwhile hiding the caps with a CSS rule, which is the wrong way to say it.",
    options: [
      "A research composer of its own, as built, and leave the authored one alone.",
      "Give ScreenComposer a controls placement and a keys flag, and use it for both."
    ],
    recommendation:
      "The second, once the chat's shape has settled. Two composers is two answers to where Send goes, and the task surface's hack disappears with the flag. It is not done yet because the chat's head is still moving."
  },
  {
    n: 27,
    page: "explore",
    title: "Citations sit in the lens rather than in the prose",
    matters:
      "The tools issue a source id per passage. The prose could carry markers, or the turn could keep its sources beside it.",
    options: [
      "Findings and sources in the lens, and nothing in the prose.",
      "Numbered markers in the prose, clickable to the passage.",
      "A row of source chips under the answer."
    ],
    recommendation:
      "The first, as built. The third was tried in the mock and dropped: it repeats the lens under the answer and takes the space the answer is for."
  },
  {
    n: 28,
    page: "explore",
    title: "An answer with no citations is published anyway",
    matters:
      "A model that answers well and forgets its sources used to have its answer replaced with the refusal text. That hides a working loop behind a wrong sentence, and the reader cannot tell the two failures apart.",
    options: [
      "One repair pass, then publish whatever came back and let the lens show zero sources.",
      "Publish the refusal text whenever nothing is cited.",
      "Retry the whole loop until something is cited."
    ],
    recommendation:
      "The first, as built. The repair costs one request in the failing case, and an uncited answer is visibly uncited rather than silently discarded."
  },
  {
    n: 29,
    page: "explore",
    title: "The first question in a project pays to index it",
    matters:
      "Nothing embeds a project until something asks. The first turn indexes every document and deck, which is about twenty seconds and a Jina bill; every later turn skips what is current.",
    options: [
      "Index on the first question, as built.",
      "Index when a resource is saved, so the first question is as fast as the second.",
      "Index the project once from a control somebody presses."
    ],
    recommendation:
      "The second, eventually, and it belongs to the semantic overlay rather than to the chat. Until then the pull boundary is honest and the cost is visible in the turn."
  },
  {
    n: 30,
    page: "explore",
    title: "The tab keeps the title of the chat it was opened on",
    matters:
      "Choosing another chat moves the centre without renaming the tab, so a tab opened on one question can be showing another. The tab's title comes from the resource it was opened with.",
    options: [
      "Rename the tab when the centre moves.",
      "Open each chat in its own tab.",
      "Leave it, and let the panel be where a chat is identified."
    ],
    recommendation:
      "Rename the tab. A tab is a place, and this one is lying about which chat it is on; opening a tab per chat would make a morning of questions into a morning of tabs."
  },
  {
    n: 31,
    page: "response",
    title: "The answer arrives as a tool call, not as a response format",
    matters:
      "The derived output capability asks for a provider-enforced JSON answer. Two of the three chat models tried answered that schema on the first turn and never searched at all.",
    options: [
      "A submit_answer tool the model calls to deliver, as built.",
      "response_format on every turn, as the derived output does.",
      "response_format only after the first tool round."
    ],
    recommendation:
      "The tool. It is one mechanism for everything the model does and it works on every provider that can call tools. The derived output capability should probably follow, and that is a change to its own loop rather than to the port."
  },
  {
    n: 32,
    page: "response",
    title: "A made block is not written to the project until somebody adds it",
    matters:
      "A chat that produces six draft tables should not leave six resources behind. But a block that lives only on the turn cannot be linked to from anywhere else.",
    options: [
      "It lives on the turn; Add writes it into a resource.",
      "Every made block is a resource the moment it exists, and Add only places it."
    ],
    recommendation:
      "The first. A turn is already a durable row, so nothing is lost, and the project stays a place where things were put deliberately."
  },
  {
    n: 33,
    page: "research-chat",
    title: "A turn runs inside the request that made it",
    matters:
      "There is no queue. A process that dies mid-run leaves a row on running with nothing to reclaim it, and a second browser watching the same chat sees nothing until the first one's request returns.",
    options: [
      "Leave it. A person is waiting, and the request they are waiting on is the run.",
      "Copy the derived output refresh queue: one durable job row, one in-process flight, reclaimed on restart."
    ],
    recommendation:
      "Copy the queue, and do it before steering rather than after. Steering needs somewhere to put a note that the loop can read between rounds, and that somewhere is the job row."
  },
  {
    n: 34,
    page: "research-chat",
    title: "Stopping a turn is not the same as cancelling it",
    matters:
      "A person who presses Stop may mean answer with what you have, or may mean throw it away. The first is useful and the second is a waste of what was already paid for.",
    options: [
      "Stop means answer now, from what has been read so far.",
      "Stop means abandon: mark the turn cancelled and keep nothing.",
      "Both, as two controls."
    ],
    recommendation:
      "Stop means answer now. The loop already has everything it needs after the first search, and a turn that cost real money should leave something behind."
  },
  {
    n: 35,
    page: "research-chat",
    title: "The two systems meet at the persona, or they do not meet at all",
    matters:
      "Research chat shares no table and no procedure with the agents system. The persona is the only thing both were meant to use, and the chat does not read one.",
    options: [
      "Wire it: a chat may hold a personaId, whose definition becomes the system prompt and whose grants become the tool set.",
      "Leave them apart: a chat gets a project-level instruction and its own fixed tools."
    ],
    recommendation:
      "Wire it, but only after Question mode exists. A persona changes what a chat is for, and a chat that is only Explore has nothing for a persona to change yet."
  },
  {
    n: 36,
    page: "research-chat",
    title: "Both systems write into threads and threadParts",
    matters:
      "It is the one thing they share. A chat opens a thread with kind researchThread and a task opens one with kind agentTask, and appendMessage is written twice, once in each capability.",
    options: [
      "Keep the duplication: two small functions over one shared shape.",
      "Promote threads to a capability of its own that both enter at its index."
    ],
    recommendation:
      "Promote it when a third system needs it, and not before. Two copies of thirty lines is cheaper than a capability nobody else uses, and the duplication is visible on this page."
  }
];

export const questionsFor = (page: PageSlug): readonly Question[] =>
  QUESTIONS.filter((question) => question.page === page);
