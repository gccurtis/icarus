# Icarus delivery backlog

Updated September 11, 2026 · source baseline: `main@7d14ddb`.

**Direction confirmed by the owner: reliable end-to-end work first.** This is a
planning and dispatch file, not a declaration that its features are missing or
permission to implement everything in it. The proposed ordering below is a
recommendation.

This revision consolidates the September 10 intake, retains its settled choices,
and separates work type, evidence, and priority. Source inspection
is identified explicitly; no product workflows were run for this backlog review.

Navigate: [Dispatch](#dispatch) · [Register](#register) · [Constraints](#constraints) ·
[Work packages](#packages) · [Decisions](#decisions) · [Evidence](#evidence) ·
[Intake coverage](#coverage) · [Maintenance](#maintenance).

<a id="dispatch"></a>
## 1. What to work on next

Start by closing complete journeys, including reload, failure, inspection, and
recovery. A green unit test or an attractive panel alone does not close a journey.
Do not defer a confirmed data-loss or authorization defect behind this ordering.

| Proposed tranche | User outcome | Packages | Exit evidence |
| --- | --- | --- | --- |
| A — Trust the current workspace | Upload and distinguish files; inspect their state/history; use variables without losing context | [EXT-02](#ext-02), [EXT-04](#ext-04), [EXT-05](#ext-05), [COL-01](#col-01), [COL-02](#col-02), [EDIT-01](#edit-01) | Realistic same-name files, re-upload/reload, navigable activity, and document/presentation variable workflows pass; compact and zoomed Chromium states inspected |
| B — Trust project knowledge | Inspect a research claim and its sources, accept only intended material, then use that knowledge in another resource | [RSH-01](#rsh-01), [RSH-02](#rsh-02), [RSH-03](#rsh-03), [SCOPE-01](#scope-01), [SCOPE-02](#scope-02), [AI-01](#ai-01), [AI-03](#ai-03) | Unaccepted material stays outside accepted project knowledge; accepted material survives reload and has provenance; task/chat configuration is reproducible |
| C — Trust reuse and analysis | Instantiate spreadsheet templates; calculate across native surfaces; carry structured content and linked charts without flattening it | [ASSET-04](#asset-04), [ASSET-05](#asset-05), [EDIT-02](#edit-02), [ANL-01](#anl-01), [ANL-03](#anl-03), [IO-02](#io-02), [IO-03](#io-03) | Two distinct source scopes produce distinct correct outputs; formula/clipboard/embedding behavior and rendered appearance are verified |
| D — Expand deliberately | Add the selected connector, wider analytics/import formats, real accounts and collaboration, Copilot, and product Skills | Remaining P2 packages, promoted when needed by an actual workflow | Each package's own acceptance criteria, not a feature-count target |
| Separate authorized initiative | Replace the documentation/reference system with the Markdown wiki | [WIKI-01](#wiki-01), [WIKI-02](#wiki-02) | Approved deletion inventory, replacement navigation, and resolved code links |

These are delivery groupings, **not a waterfall**. Metadata discovery, a bounded
variable fix, and activity navigation can run independently. Tranche B design can
start while A lands. Connector discovery and identity design can also start early.
Only explicit gates in package cards and decision briefs block implementation;
related themes do not.

Authentication is not optional for a real multi-user deployment. [ID-01](#id-01)
is a release gate even when single-user workflow reliability is scheduled first.

### Dispatch rules

1. Select a package and its **first slice**, not an entire epic. Create a task
   handoff using the existing agent tooling; record active ownership there.
2. Reproduce/recheck the relevant current behavior before changing it. Preserve
   working foundations; finding code is not proof that the requested workflow works.
3. Resolve only the package's open gates. Do not reopen [settled choices](#constraints).
4. Name exact owned paths and overlapping state/representation boundaries in the
   handoff. Different editor procedures remain independently owned.
5. Return evidence and a small reviewable change. A package remains open when only
   one slice is delivered; record the remaining slice instead of checking it off.

### Landed baseline carried through the September 10 rebase

The following bounded interface work is already on `main`; it is recorded here so
the consolidated packages do not accidentally schedule it again:

- Project Overview and External Files use the simplified History dropdown; External
  history is searchable and no longer carries the redundant explanatory footer.
- External Files is the user-facing category name. Its table has Author filtering,
  compact path/time presentation, readable Size, and a same-row Table/Directory
  toggle. Redundant library/directory helper text is gone while directory inspection
  remains available.
- The External file inspector places information before its action grid, keeps
  rename in its owning surface, removes the duplicate rename/path/selection blocks,
  and uses the simplified semantic-status treatment.
- Persona configuration uses Scope/Default Scope, and the four permanent workspace
  tabs remain fixed while transient tabs accept wheel and horizontal-trackpad scroll.

These landed slices do not by themselves close the broader EXT-04, EXT-05, COL-01,
COL-02, SCOPE-02, or KEY-02 outcomes. Their remaining closeout and workflow evidence
still follow the package cards below.

<a id="register"></a>
## 2. Delivery register

The register is a compact navigation and priority index. Package cards carry scope,
first slices, dependencies, and completion criteria. Active scheduling state,
ownership, and detailed execution evidence belong in the assigned task handoff so
this index stays readable.

Work type belongs in the card: **Audit**, **Design**, **Build**, **Refine**, or
**Tactical**. Priority is independent: **P0** confirmed urgent integrity/security
failure; **P1** reliability-critical current workflows; **P2** capability expansion;
**P3** deliberately later. No P0 incident is asserted by this source-only review.
Priorities are proposed; gates are requirements, not estimated dates or effort.

| ID                    | Package                                          | Priority          |
| --------------------- | ------------------------------------------------ | ----------------- |
| [EXT-02](#ext-02)     | Complete and verify ingestion lifecycle          | P1                |
| [EXT-03](#ext-03)     | First operational connector                      | P2                |
| [EXT-04](#ext-04)     | File table and directory clarity                 | P1                |
| [EXT-05](#ext-05)     | File inspector and context cleanup               | P1                |
| [RSH-01](#rsh-01)     | Findings lifecycle and publication               | P1                |
| [RSH-02](#rsh-02)     | Explicit source acceptance                       | P1                |
| [RSH-03](#rsh-03)     | Research turn and result inspection              | P1                |
| [AI-01](#ai-01)       | Task execution contract and reliability          | P1                |
| [AI-02](#ai-02)       | Copilot task supervision                         | P2                |
| [AI-03](#ai-03)       | Chat modes, personas, and execution tools        | P1                |
| [AI-04](#ai-04)       | Collaborative chat branching                     | P2                |
| [SCOPE-01](#scope-01) | Inspectable resource sets across surfaces        | P1                |
| [SCOPE-02](#scope-02) | Persona scope and execution-owned tools          | P1                |
| [ID-01](#id-01)       | Authentication and access lifecycle              | P2 / release gate |
| [ID-02](#id-02)       | Coherent personal/project asset ownership        | P2                |
| [ID-03](#id-03)       | Top bar and settings boundaries                  | P2                |
| [DATA-01](#data-01)   | Graceful stale display references                | P2                |
| [ASSET-01](#asset-01) | Independent template copies across scopes        | P2                |
| [ASSET-02](#asset-02) | Independent persona copies across scopes         | P2                |
| [ASSET-03](#asset-03) | Product Skills                                   | P2                |
| [ASSET-04](#asset-04) | Spreadsheet template editor                      | P1                |
| [ASSET-05](#asset-05) | Template UI and terminology                      | P1                |
| [ANL-01](#anl-01)     | Canonical analytic identity and editing contract | P2                |
| [ANL-02](#anl-02)     | Analysis graph tabs and graph editor             | P2                |
| [ANL-03](#anl-03)     | Linked analytic placements across editors        | P2                |
| [ANL-04](#anl-04)     | Inspectable text-to-table extraction             | P2                |
| [EDIT-01](#edit-01)   | Document/presentation Variables panels           | P1                |
| [EDIT-02](#edit-02)   | Cross-editor formula contract and built-ins      | P1                |
| [IO-01](#io-01)       | Native import/export                             | P2                |
| [IO-02](#io-02)       | External rich paste and external-copy contract   | P1                |
| [IO-03](#io-03)       | Native structured and linked copy/paste          | P2                |
| [KEY-01](#key-01)     | Retire the product command abstraction           | P2                |
| [KEY-02](#key-02)     | Direct keyboard shortcuts and desktop behavior   | P2                |
| [COL-01](#col-01)     | Project activity navigation and readable history | P1                |
| [COL-02](#col-02)     | External/Agents activity parity                  | P1                |
| [COL-03](#col-03)     | Presence with explicit lifetime                  | P2                |
| [WIKI-01](#wiki-01)   | Wiki reset inventory and replacement plan        | P3                |
| [WIKI-02](#wiki-02)   | Markdown wiki and retirement of old pages        | P3                |

The tool/scope dependencies are a **shared contract**, not a circular build order:
agree chat/task-owned configuration first, then wire consumers and remove persona
tool persistence in one coordinated landing. Likewise, findings/source acceptance
shares vocabulary; accepting one need not force acceptance of the other.

<a id="constraints"></a>
## 3. Settled constraints — do not turn these back into open questions

These combine the intake's settled choices with standing owner instructions:
Chromium/current-schema-only work, independently owned editor behavior, and keeping
resource-set management out of Project Overview. Broader reusable context views
remain in scope at their points of use.

| Constraint | Required interpretation |
| --- | --- |
| External boundary | Connectors, direct uploads/re-uploads, and accepted external research sources enter the External Files system; retain origin and stable identity. |
| Acceptance | A discovered research source does not become an external file merely because a model found or cited it. Explicit user acceptance is required. An already-existing project file is not a new external source. |
| Findings | The existing canonical finding representation is authoritative. Design inspection, lifecycle, publication, dismissal, and history around it. |
| Chat versus tasks | Delegated tasks have their own configuration, state, execution, and outputs. They are not a renamed chat mode. |
| Tools and personas | Tools belong to chats/tasks. Personas carry behavior and scope, not a persistent tool bundle. |
| Asset transfers | Personal/project template and persona transfers are independent copies in either direction, never shared mutable moves. Design both inside the broader per-user system. |
| Context scope | Reuse resource-set/context concepts across surfaces; inspect individual members. Define context where it is needed; do not restore the removed Project Overview resource-set management panel. |
| Native analytics | A chart is a canonical analytic object; native placements link to it by default and propagate changes. This is deliberately different from personal/project asset copies. |
| Product commands | Retire the partial command palette/registry architecture; implement keyboard shortcuts directly. This does not mean deleting backend command admission or ordinary procedural calls. |
| External UX | Paths are compressed secondary metadata with full-path hover text. Table/Directory is one toggle in the same control row. Preserve directory exploration in the inspector and Generated Description. |
| Unchanged comments | Leave the document/presentation empty Comments state alone; the proposed extra empty-state action was withdrawn. |
| Naming and browser | Use presentation for the resource, slide for its contents. Chromium is the target; browser versus desktop shortcut behavior is not a cross-browser project. |
| Architecture and quality | Follow root AGENTS: explicit state lifetime, bounded procedural chains, modular/reviewable files, no new baseline debt, current-schema-only changes, atomic Store intents and recovery. No legacy readers, renamed aliases, or migration scaffolding. |
| Wiki | Markdown with useful Mermaid diagrams and selective HTML replaces the old system in a separately authorized reset. This backlog rewrite does not perform that reset. |

<a id="packages"></a>
## 4. Work packages

Each card supplies a dispatchable first slice and an outcome-based closeout. Source
links in [the evidence ledger](#evidence) are starting points, not exhaustive audits.
For multi-slice packages, put execution details and active ownership in
`.agents/tasks/<task>/handoff.md`.

### External Files and connectors

<a id="ext-02"></a>
#### EXT-02 — Complete and certify one ingestion lifecycle

**Work:** Audit / Refine. **First slice:** run and inspect upload → semantic state → re-upload → download → history → reload with realistic duplicate-name fixtures.

- Extend the existing transactional upload/revision/semantic-outbox path; do not rebuild it. Specify admission boundaries for upload, re-upload, connector refresh, and accepted research material.
- Stable resource identity is not the filename. Preserve same-name files at different paths/origins; decide same-path conflict/reuse rules and retain the source attribution needed to explain them.
- **Close when:** accepted bytes, revision/history, semantic status, and downloaded content agree after success, failure, retry, and restart; rejected admission leaves no partial intent; changed content is not silently represented by stale semantic output. Connector/source paths must consume this contract when added.

<a id="ext-03"></a>
#### EXT-03 — Deliver the first operational connector

**Work:** Build on existing connector representation. **First slice:** after Q1, connect one real source through the External boundary; do not begin with an unbounded adapter catalog.

- Cover credential ownership, source selection, initial fetch, refresh/re-upload, origin/path collisions, permission loss, failure/retry, and disconnect. Decide what disconnect does to already accepted project files before coding deletion behavior.
- **Close when:** the selected connector's files use EXT-02 identity/revision/semantic rules, keep origin metadata, and can be inspected/downloaded after reload. Bounded live-provider evidence and deterministic failure tests are both recorded; no secrets enter rows intended for display or logs.

<a id="ext-04"></a>
#### EXT-04 — Make the file table and directory view clear

**Work:** Tactical. **First slice:** compare compact and wide Chromium views with long paths, duplicate names, large sizes, and recent updates; recheck already-implemented path truncation/tooltip behavior.

- Give any attribution column one explicit label and meaning; show compressed paths with full-path hover text, readable Size, and compact times such as `3 HR` without repeating “ago.”
- Put the Table/Directory toggle in the same control row. Remove “native project files live here,” the directory-path explanation, and the repeated directory name. Preserve directory exploration inside the inspector.
- **Close when:** both views remain usable at narrow widths and zoom, duplicate files stay distinguishable, and sorting/filtering/selection/navigation still work. Do not mark already-correct behavior as newly implemented.

<a id="ext-05"></a>
#### EXT-05 — Simplify the file inspector and context panel

**Work:** Tactical / Refine. **First slice:** land layout-only improvements without waiting for metadata decisions.

- Put file information first, actions below in a two-by-two grid; remove duplicate Rename, the “selection belongs to file inspector” block, and the separate path inspector. Preserve rename in its owning file section and secondary path information elsewhere.
- Evaluate collapsible sections in both panels. Replace the uneven Semantic Status pill with simple aligned status text; use green for ready without relying on color alone. Remove redundant explanatory text, not meaningful error/recovery information.
- **Close when:** useful Generated Description remains, any retained adjacent fields are clearly labeled, and compact/zoomed inspectors show no clipped controls or broken actions. History behavior belongs to COL-02.

### Research and accepted project knowledge

<a id="rsh-01"></a>
#### RSH-01 — Make findings inspectable and publishable

**Work:** Design / Build. **First slice:** map a turn-local claim to inspection and explicit publication using the existing stored finding representation; do not redesign that representation.

- Define discovered, inspectable, accepted, and rejected/dismissed behavior, with supersession/history. Distinguish a transient research claim from an accepted finding resource and preserve evidence/source snapshots.
- Coordinate source acceptance with RSH-02 so neither action silently publishes the other.
- **Close when:** the user can inspect, accept, dismiss, revisit, and locate the resulting finding in the semantic overlay; provenance/history survives reload; cancellation, repeated acceptance, storage failure, and project isolation have executable contracts.

<a id="rsh-02"></a>
#### RSH-02 — Require explicit source acceptance

**Work:** Design / Build. **First slice:** distinguish citations to existing project resources from newly discovered external sources and define an inspectable acceptance transition.

- Preserve source metadata and content/revision provenance when accepted material enters External Files and the semantic overlay. Do not create another external file simply to cite an existing one.
- Make state visible in research and External views; record acceptance/dismissal/supersession in activity. Decide what a changed or unavailable source means before retrying acceptance. Direct upload already expresses an import intent; do not add an unrelated confirmation flow by accident.
- **Close when:** unaccepted new sources are not imported/indexed, accepted ones are durable and inspectable, and double-click/retry cannot duplicate publication. Prove the negative case as well as success. The intake's prohibition on automatic import is an invariant, not a reproduced current bug ([E3](#e3)).

<a id="rsh-03"></a>
#### RSH-03 — Redesign research turns around inspectable results

**Work:** Refine. **First slice:** define and render one complete turn with answer, findings, sources, and turn context, including empty/error/cancelled states.

- Findings and sources are first-class inspection targets; acceptance actions reflect RSH-01/RSH-02, not decorative rows. Redesign the turn-level context panel and professional visual hierarchy.
- Align persona/mode controls and overall chat appearance with AI-03 while retaining research-specific behavior.
- **Close when:** a user can move answer → finding → evidence/source → accepted resource without dead targets or stale inspectors; keyboard navigation, reload/tab switching, and narrow/zoomed states are verified with realistic data.

### Chats, tasks, and Copilot

<a id="ai-01"></a>
#### AI-01 — Certify the task execution and output contract

**Work:** Audit / Refine. **First slice:** exercise one existing task through create, configure, run, observe, cancel/retry, review output, and reload; task execution already exists ([E5](#e5)).

- Specify task-owned configuration, execution state, resources, tools, outputs, and supervision. Trace workspace/client lifetime and backend ownership; keep tasks separate from chat turns.
- Agree per-task/per-chat tool storage with AI-03/SCOPE-02 before removing persona tool persistence. A provider/storage fault must not appear as a successful task or a silent refusal.
- **Close when:** lifecycle, cancellation/resumption, output provenance, project isolation, and no half-persisted result are tested through the real capabilities; every user-visible state has an actionable outcome. Report configured-provider skips honestly.

<a id="ai-02"></a>
#### AI-02 — Build Copilot around supervised tasks

**Work:** Design / Build. **First slice:** one complete create-and-supervise task journey using AI-01, not a second task executor.

- Define how conversational intent becomes a task, where its configuration is reviewed, and how progress/output returns to the user. Surface authority, failure, cancellation, and any approval boundary explicitly.
- **Close when:** the user can create, inspect, supervise, and use a task's project-resource output from Copilot; chat history and task state remain distinct and traceable after reload.

<a id="ai-03"></a>
#### AI-03 — Make chat configuration coherent during a conversation

**Work:** Refine. **First slice:** trace persona switching, the currently fixed research mode, and effective tools through a new turn and a reload.

- Allow active persona and mode switching and explicit chat-owned tools. Completed turns must remain honestly attributable to the configuration that produced them; settle in-flight change behavior as part of implementation.
- Redesign general chat for a cleaner professional hierarchy, coordinating research-specific context in RSH-03. Do not turn a task into a chat mode.
- **Close when:** switching controls affect exactly the intended turns, an in-flight turn is not silently reconfigured, persona tool defaults no longer leak into execution, and reload preserves the same interpretable history.

<a id="ai-04"></a>
#### AI-04 — Branch collaborative chats without rewriting another user's line

**Work:** Design / Build. **First slice:** specify ancestry, inherited context/configuration, ownership, and the “another user last continued/edited” trigger using two real identities.

- Continuing another user's line creates a branch instead of silently appending. Define simultaneous continuation behavior and how origin/ancestry are shown.
- **Close when:** concurrent users cannot overwrite or ambiguously append to the same line, branches retain inspectable origins, inherited state follows the agreed contract, and access checks and reload preserve both histories.

### Scope and identity

<a id="scope-01"></a>
#### SCOPE-01 — Complete inspectable resource-set context

**Work:** Audit / Refine. **First slice:** audit existing resource-set CRUD, scope-builder reuse, and attachment UX before adding another scope component ([E4](#e4)).

- Provide a reusable context view for individual resources and sets, with every member inspectable, across personas/chats/tasks and relevant editor surfaces. Create/manage context where it is needed, not through a restored global Overview panel.
- Define membership update/removal, nested/cyclic references, permission loss, and whether an attachment is live or snapshotted. Past execution evidence must remain interpretable after later set edits.
- **Close when:** attach → inspect member → edit/remove set → execute → reload has explicit behavior, dangling/private/cross-project references fail safely, and state is owned by the relevant workspace/resource lifetime.

<a id="scope-02"></a>
#### SCOPE-02 — Keep persona context inspectable and move tools to execution

**Work:** Refine. **First slice:** inspect existing individual-resource/set attachment and effective tool inheritance; agree the removal/wiring boundary with AI-01/AI-03.

- Make attached resources and sets inspectable; keep the working add controls. Rename Default to Scope or Default Scope according to meaning. Preserve behavioral persona configuration.
- Remove persona Tools UI and persistent tool configuration only as execution-owned configuration lands. Do not preserve old fields or aliases as compatibility bridges.
- **Close when:** personas reload with correct inspectable scope, chats/tasks choose their own tools, no retired persona-tool consumer remains, and coordinated changes preserve current task/chat execution.

<a id="id-01"></a>
#### ID-01 — Replace development identity with real authentication

**Work:** Design / Build. **First slice:** decide Q3 and inventory the current session/Scope boundary; development configuration is not a login system ([E6](#e6)).

- Define sign-in/out, session expiry/revocation, project membership/access, authorship, and the relation between account and person/profile records. Identity must come from server-established authority, never a client-supplied user ID.
- **Close when:** two users and two projects exercise successful access, denied access without disclosure, expired/revoked sessions, sign-out across tabs, and personal-resource isolation. No development identity remains reachable in the chosen real-user deployment. This is a release gate, not just a UI task.

<a id="id-02"></a>
#### ID-02 — Design one personal/project asset ownership system

**Work:** Design. **First slice:** map existing user/project template/persona rows and versions into a common ownership and copy-provenance contract.

- Cover persistence, versioning, permissions, common versus asset-specific storage, and future personal asset types. Template/persona tables must not be designed independently of this system.
- **Close when:** both copy directions, fresh identity, immediate independence, future versions, deletion, and access loss are specified with executable-test scenarios. No migration/legacy-reader requirement is introduced; fixture replacement and real-data handling are explicit choices, not silent deletions.

<a id="id-03"></a>
#### ID-03 — Complete the top bar and settings model

**Work:** Refine / Build. **First slice:** separate account/personal actions from current-project actions in the existing top bar.

- Include sign-in/account access, user options/settings, and project options/settings; preserve useful current controls instead of inventing a second top bar.
- **Close when:** authenticated/unauthenticated and project/no-project states have clear controls; changing identity or project cannot leave stale personal settings or controls pointing at the previous scope; compact/zoomed layouts remain usable.

<a id="data-01"></a>
#### DATA-01 — Keep valid resources visible when display references go stale

**Work:** Refine / Build. **First slice:** inventory user, owner, connector, task,
and similar relations used only to render names or links, starting with resource
lists and inspectors ([E12](#e12)).

- Strictly validate the resource being shown and its project ownership. A missing
  related display record must not hide an otherwise valid resource or create a
  dead tab.
- When a related subject no longer exists or is no longer visible in the project,
  show a neutral non-linking value such as **User no longer available**. Never
  recover a label by disclosing a record outside the current project.
- Distinguish stale display relations from malformed authoritative resource data.
  The latter remains a real integrity fault and must not be disguised with a
  friendly missing-user label.
- **Close when:** removal and access-loss scenarios across resource lists,
  inspectors, history, and activity keep valid resources usable, disable only the
  stale relation link, disclose no cross-project identity, and pass reload plus
  Chromium interaction tests.

### Personal assets and templates

<a id="asset-01"></a>
#### ASSET-01 — Copy templates between personal and project scopes

**Work:** Build on existing templates/versioning. **First slice:** implement one copy direction against ID-02, then the reverse using the same ownership contract.

- Copy body, slots/default scope, styles, relevant versions/provenance, and referenced-resource behavior deliberately. A cross-scope reference must not smuggle inaccessible project material into a personal asset.
- **Close when:** personal → project and project → personal produce new independent IDs; editing/versioning/deleting either copy does not mutate its origin; permission and provenance tests cover both directions.

<a id="asset-02"></a>
#### ASSET-02 — Copy personas between personal and project scopes

**Work:** Build on existing project personas. **First slice:** apply ID-02 to behavior and scope copies, respecting SCOPE-02's execution-owned tools.

- Define copied resource/set access and provenance; copying does not grant access to the source's private resources.
- **Close when:** both directions create immediately independent personas, future changes do not propagate, permissions remain correct, and scope inspection explains any unavailable references.

<a id="asset-03"></a>
#### ASSET-03 — Implement product Skills

**Work:** Design / Build. **First slice:** define the product Skill's configuration, ownership, and execution relationship to personas, chats, and tasks after the core task/persona contracts.

- Keep Skills in the product; do not delete the section to close this item. Product Skills are distinct from this repository's `.agents/skills` instructions.
- **Close when:** one Skill can be configured, inspected, used in the intended execution context, and reloaded with clear provenance/authority. The full configuration model follows the agreed core contract, not a placeholder list.

<a id="asset-04"></a>
#### ASSET-04 — Make spreadsheet templates first-class editable resources

**Work:** Build / Refine. **First slice:** connect the existing spreadsheet template representation/materialization to an actual editor; do not rebuild all templates as greenfield ([E7](#e7)).

- Cover editing, save/discard, revisions, text slots, scope slots, formulas/references, and instantiation into a usable spreadsheet with a real resource ID. Preserve source template independence.
- **Close when:** editing survives reload and two instantiations using distinct scopes/content remain isolated and correct. Verify formulas, cell/range behavior, rendering, and failure recovery through Chromium and capability tests.

<a id="asset-05"></a>
#### ASSET-05 — Clarify the selected-template/prompt-block interface

**Work:** Tactical / Design. **First slice:** improve the section beneath a selected prompt block, especially in documents, without coupling the layout fix to a global rename.

- Inventory template and prompt-block terminology across editors; Q6 decides whether to rename. Any approved rename must be coherent and current-only, not an alias layer.
- **Close when:** selected block → scope/slot inspection → edit → save/instantiate is visually coherent in documents and presentations, normal/compact/zoomed states are inspected, and existing white presentation canvas/source-isolation contracts remain intact.

### Analysis and structured data

<a id="anl-01"></a>
#### ANL-01 — Define the canonical analytic object and edit boundary

**Work:** Audit / Design. **First slice:** inspect existing analysis/chart types, formula data and render paths; distinguish a graph editor, a chart, and an embedding before introducing new representation.

- Define canonical identity, source data, editing ownership, object-level versus placement-level formatting, and references across Analysis/documents/presentations/spreadsheets. Reuse one analytic object rather than rebuilding charts per editor.
- **Close when:** the identity/link/update/access/deletion contract, schema changes actually needed, and representative embedding tests are specified before implementation.

<a id="anl-02"></a>
#### ANL-02 — Complete Analysis graph tabs and graph editing

**Work:** Build / Refine. **First slice:** one graph tab with real persisted data and a working edit/inspect/reload loop, using the applicable ANL-01 boundaries.

- Implement both navigable Analysis graph tabs and the graph editor; do not count a static chart preview as completing either. Define how structured/analytic inputs enter the editor.
- **Close when:** create/open/edit/save/reopen and inspect work on realistic graphs, invalid edits/failures are visible, and workspace/tab state cannot leak between graphs or projects.

<a id="anl-03"></a>
#### ANL-03 — Embed one analytic object across native editors

**Work:** Build. **First slice:** create a spreadsheet chart and place linked views in a document and presentation.

- All placements reference the same canonical analytic object by default. Separate shared data/chart edits from per-placement layout; coordinate native clipboard behavior with IO-03.
- **Close when:** editing the object updates all placements across tabs and reload, per-placement styling behaves as specified, and deletion/access-loss behavior is explicit without exposing stale private content.

<a id="anl-04"></a>
#### ANL-04 — Derive inspectable, correctable tables from text

**Work:** Design / Build. **First slice:** extract one useful quantitative table with a source span for each value, review it, and materialize it as native spreadsheet/table data.

- Specify units, dates, currencies, ranges, percentages, and confidence/uncertainty. Define the proposed-table versus accepted-native-table boundary, correction provenance, and regeneration behavior.
- **Close when:** users can inspect supporting text, correct values, accept a native table, and regenerate without silently overwriting corrections. Ambiguous/missing values remain identifiable; extracted data is not silently authoritative. Keep this independent of finishing all chart features.

### Native editors and interoperability

<a id="edit-01"></a>
#### EDIT-01 — Repair document and presentation Variables workflows

**Work:** Audit / targeted fix. **First slice:** reproduce the reported panel defects in each editor and record actual versus expected behavior before editing.

- Trace list/read/edit/use, project scope, active selection/next-letter state where relevant, inspector switching, errors, and reload. Keep document and presentation panel procedures independently owned.
- **Close when:** realistic variables can be discovered, edited and used in both editors without stale inspectors, wrong-project values, lost edits, or broken focus; add focused regressions for the reproduced causes. Existing spreadsheet formula evaluation is not proof these panels work.

<a id="edit-02"></a>
#### EDIT-02 — Complete cross-editor formula semantics and the needed catalog

**Work:** Audit / Design / Refine. **First slice:** inventory implemented built-ins and execution consumers; contrast spreadsheet evaluation with document/presentation resolved formula snapshots ([E8](#e8)).

- Specify evaluation/refresh/revision semantics in documents, presentations and embedded structured/analytic content. Name missing built-ins from concrete workflow gaps, not an unbounded formula-parity target.
- **Close when:** representative formulas yield consistent documented values/errors in all supported placements, references and project-scoped variables update correctly, and stale snapshots/cycles/invalid inputs have explicit behavior. Parser-only tests do not close this package.

<a id="io-01"></a>
#### IO-01 — Import and export supported native resources

**Work:** Design / Build. **First slice:** choose one required format pair, define current-schema mappings and acceptable losses, then complete a real import/edit/export journey.

- Cover documents, presentations and spreadsheets incrementally with an explicit support matrix. Report unsupported structures and fidelity loss; do not promise full external-format parity or round-tripping by implication.
- **Close when:** each declared format has realistic fixtures, safe invalid/oversized input handling, usable native IDs/resources, and verified exported content. Import/convert failures do not leave partially persisted resources.

<a id="io-02"></a>
#### IO-02 — Define and deliver external rich clipboard behavior

**Work:** Audit / Design / Build. **First slice:** inspect current clipboard paths and actual Chromium clipboard formats from Markdown, Word and Google Docs; define the initial fidelity matrix.

- Normalize meaningful structure/formatting into current native models. Test lists, tables, links, styles and unsupported content instead of only plain paragraphs.
- Decide copying back into external applications **inside this Copy System design**, including available formats, desktop/browser differences, and disclosed losses. Do not treat it as a separate settled product promise.
- **Close when:** the declared paste/copy paths preserve their promised structure, sanitize unsafe content, fail visibly when unsupported, and have real clipboard plus visual regressions.

<a id="io-03"></a>
#### IO-03 — Preserve rich native semantics through copy/paste

**Work:** Design / Build. **First slice:** one native structured-content transfer and one linked analytic transfer across editors, with an explicit identity table for each object kind.

- Cover documents, presentations, spreadsheets, charts, tables and rich blocks without flattening understood content to images/plain text. Preserve semantics and intended shared references without accidentally duplicating unique placement IDs.
- When spreadsheet formulas are copied within or between compatible spreadsheet surfaces, shift relative row and column references by the pasted-cell offset, preserve absolute references, and shift only the relative axis in mixed references.
- Charts link to the canonical object by default. Define optional duplicate/detach behavior and distinguish it from ordinary content copying and copy-only personal assets.
- **Close when:** source changes propagate only to intended linked views, independent copies remain independent, copied formulas resolve to the intended cells and ranges, and cut/paste, undo/redo, reload, source deletion and access revocation follow the declared contract.

### Keyboard operation and activity

<a id="key-01"></a>
#### KEY-01 — Retire the product command system cleanly

**Work:** Refine / removal. **First slice:** inventory the live command model, registry, dialog, and runtime key dispatcher; map useful behavior to direct shortcuts before deleting it ([E10](#e10)).

- Remove the partial product command abstraction and palette, including dead wiring/configuration/tests. Do not keep a parallel architecture or compatibility facade.
- **Close when:** useful shortcut behavior is preserved through KEY-02, retired product-command imports/UI are absent, and backend command admission/ordinary application procedures remain intact.

<a id="key-02"></a>
#### KEY-02 — Define direct shortcuts for Chromium and desktop

**Work:** Design / Build. **First slice:** publish and test an essential shortcut/focus matrix, including what the browser reserves and what a desktop shell can own.

- Prioritize keyboard-efficient desktop behavior, preserve browser-compatible alternatives, and define platform conflicts, editor/input focus, composition, and modifier handling. Decide whether customization is needed and where it would be stored; it is not assumed in v1.
- **Close when:** documented shortcuts work in their declared contexts without firing while typing or stealing reserved browser actions; desktop-only claims have actual desktop evidence, otherwise are explicitly unverified.

<a id="col-01"></a>
#### COL-01 — Make project activity readable and navigable

**Work:** Audit / Tactical. **First slice:** inventory activity verbs and target/actor types and exercise their current routes; some inspection/opening already exists ([E11](#e11)).

- Make meaningful Where values open the correct document, presentation, spreadsheet, external file, chat, task, analytic or other supported resource. Improve opaque What labels without rewriting historical actor identity.
- Simplify the existing History filter to a straightforward dropdown, preserving useful search/filter behavior. Make history activities selectable; person links open profiles and resource links use names rather than paths.
- **Close when:** each supported target/actor type has a tested inspect/open route; deleted/inaccessible/unsupported targets have explicit states rather than dead tabs; duplicate names remain disambiguated. Existing navigation is retained and gaps are closed.

<a id="col-02"></a>
#### COL-02 — Align External and Agents history with project activity

**Work:** Refine / Tactical. **First slice:** implement the COL-01 interaction pattern for external history and compare persona/Agents activity against it. Existing actor labels can support search, selection and navigation now.

- External history rows are selectable activity records, searchable, and free of redundant bottom explanations. Person names open profiles; file names are primary clickable targets; secondary path/origin distinguishes duplicate names.
- Match Agents Library/persona activity to Project Overview's presentation and behavior. Preserve domain-owned state/procedures; share appropriate UI primitives rather than forcing one editor implementation.
- **Close when:** filtering/selecting/inspecting/opening and reload work consistently in all three surfaces, with correct attribution and empty/error/unavailable-target states.

<a id="col-03"></a>
#### COL-03 — Show presence without stale or cross-project state

**Work:** Design / Build. **First slice:** two authenticated users viewing/editing one resource, with connect, disconnect, tab change, and expiry behavior.

- Highlight present profiles and show participation within document, presentation, spreadsheet and other resource tabs. Define viewing versus editing and resource/project lifetime; do not use browser-global shortcuts for resource state.
- **Close when:** joining/leaving/idle/disconnected users produce accurate resource-local indicators, stale presence expires, and unauthorized projects cannot observe one another.

### Later wiki reset

<a id="wiki-01"></a>
#### WIKI-01 — Inventory and plan the Markdown wiki reset

**Work:** Audit / Design, deferred. **First slice:** after authorization, inventory current documentation/reference routes, important directories/files, dependencies, and replacement ownership.

- Name the exact old material to retire and what must be captured before deletion. Define navigation, coverage, maintenance responsibility, and source-to-page links; this backlog and agent instructions need explicit treatment in that inventory.
- **Close when:** the replacement/deletion map is reviewed and scoped, including broken-link/route tests. Do not start deleting old material as an incidental cleanup task.

<a id="wiki-02"></a>
#### WIKI-02 — Build the Markdown wiki and retire the old system

**Work:** Build / retirement, deferred. **First slice:** deliver one end-to-end system → directory → key-file navigation path from WIKI-01's approved plan.

- Describe every structurally important directory's role, ownership, allowed contents, naming and flow; provide individual pages for key architecture/schema/execution/state/configuration files. Use Mermaid where it clarifies relationships and HTML where Markdown is insufficient.
- Keep links/navigation maintainable and remove approved old documentation/reference pages as the reset lands; do not leave two competing authoritative systems.
- **Close when:** the approved coverage exists, code/page links and replacement routes validate, and the exact old system has been retired with a recoverable Git record.

<a id="decisions"></a>
## 5. Decisions that need the owner — at the point they block work

The delivery objective is already answered: **reliable end-to-end work first**.
The questions below are not all required to start tranche A. An assigned agent
should first collect the grounding material specified by its package, then request
the relevant choice. Recommendations are proposals, not silently settled policy.
Technical decisions within the established guardrails remain delegated.

| Decision | Needed before | Can proceed meanwhile |
| --- | --- | --- |
| [Q1](#q1) First connector/source | EXT-03 adapter implementation | EXT-02 lifecycle audit and External UX |
| [Q3](#q3) First real-user deployment/access model | ID-01 implementation and real-user release | ID-02 ownership design; single-user workflow work |
| [Q6](#q6) Template/prompt-block terminology | Global rename in ASSET-05 | Selected-block layout and template reliability fixes |

<a id="q1"></a>
### Q1 — Which real external source should the first connector serve?

**Context:** uploads and connector representation already exist, but an operational
connector adds credentials, synchronization, source identity, permission failure,
and retention choices. Selecting a real source bounds that work and supplies an
honest acceptance fixture. EXT-03 must also determine what disconnect retains.

**Recommendation:** name the provider/source you actually use and prove one complete
connector before generalizing adapters. Evaluate immediate usefulness, coverage of
the lifecycle, and credential/operational complexity.

| Alternative | Real-work usefulness | Lifecycle proof | Scope/operations |
| --- | --- | --- | --- |
| One concrete connected source (recommended) | High when chosen from your work | Exercises actual identity/refresh failures | Bounded adapter and credential surface |
| A constrained generic URL/API connector first | Useful for varied public/simple sources | May miss provider-specific lifecycle behavior | General request/auth rules need careful limits |
| Several providers in the first release | Broad coverage | Harder to certify each thoroughly | Largest maintenance and credential surface |

**Owner response:** _Provider/source, representative files, refresh expectation,
and any credential or retention constraints._

<a id="q3"></a>
### Q3 — What is the first deployment that must support real identities?

**Context:** current session resolution uses development configuration. Choosing
desktop-first account behavior, hosted project collaboration, or both changes the
authentication/session design, user provisioning, settings, and presence scope.
The current development identity must not be mistaken for production authentication.

**Recommendation:** if the stated Chromium desktop-client direction still holds,
certify desktop-first real accounts before supporting both deployment models.
Confirm that assumption here before choosing a login provider or enterprise feature
set. Server-side ownership and personal/project isolation remain non-negotiable.

| Alternative | Near-term scope | Collaboration capability | Verification burden |
| --- | --- | --- | --- |
| Desktop-first real accounts (conditional recommendation) | Matches the stated desktop direction | Must define access to any shared backend | One desktop/session/access lifecycle first |
| Hosted multi-user projects first | Membership/account UX required immediately | Directly unlocks shared work and presence | Session, permissions and concurrency checks upfront |
| Desktop and hosted identities together | Broadest initial design | Both targets | Multiple session/storage/runtime behaviors to certify |

**Owner response:** _Initial deployment, who signs in, how they join projects,
and any account/identity-provider requirements._

<a id="q6"></a>
### Q6 — Should Templates and prompt blocks be renamed?

**Context:** the intake asks to reconsider terminology, not to perform a predetermined
rename. The selected-block UI can improve independently. A rename touches creation,
editing, inspection, empty states, testing and navigation, so it should clarify a
concept rather than merely replace a label everywhere.

**Recommendation:** retain Templates initially and test prompt-block wording against
the corrected UI. Bring concrete alternatives and screenshots before a global rename.

| Alternative | Immediate clarity | Consistency/change surface | Delivery cost |
| --- | --- | --- | --- |
| Keep Templates; improve the selected-block experience (recommended) | Tests whether wording is really the issue | Small | Lowest |
| Rename only the prompt-block concept | Can clarify generation behavior | Requires consistent editor terminology | Bounded |
| Rename the whole template concept and its blocks | Useful only if the current concept is genuinely misleading | Largest | Highest |

**Owner response:** _Keep current names, or describe the misunderstanding new names
should fix. Candidate labels should be evaluated in the actual UI._

<a id="evidence"></a>
## 6. Current implementation evidence — extend these foundations

All entries are **source-observed at c2505f0**, not runtime-certified. Test files
below were inspected as contracts that exist; their presence is not a claimed
passing result. Recheck the relevant source/test head when assigning a package.

<a id="e1"></a>
### E1 — External lifecycle and duplicate paths already have implementation

[Upload transaction](../app/src/lib/capabilities/external-files/api/upload-external-files/transaction.ts)
and [mutation coordination](../app/src/lib/capabilities/external-files/api/shared/mutations.ts)
cover existing upload/revision/history/semantic intent. [Upload admission tests](../app/src/lib/capabilities/external-files/test/unit/upload-admission.test.ts)
include identical leaf names under different directories; [Chromium workflows](../app/test/browser/external-files.spec.ts)
cover much of the lifecycle. [File table](../app/src/lib/app-views/categories/external/components/file-table.svelte)
already has path truncation and hover text. The gap is not “invent file IDs/upload.”
The [connector type](../app/src/lib/representation/data/types/external/connector.ts)
is not evidence that operational provider sync is complete.

<a id="e2"></a>
### E2 — Purpose/facets have provenance and retrieval use

[Material description](../app/src/lib/capabilities/semantic-overlay/api/shared/material-description.ts)
obtains summary, purpose, entities and themes in one structured response;
[material facets](../app/src/lib/capabilities/semantic-overlay/api/shared/material-facets.ts)
uses them in embedded generated text. [Semantic status UI](../app/src/lib/app-views/categories/external/components/file-semantic-status.svelte)
already places Purpose below Generated Description. [External projection](../app/src/lib/capabilities/external-files/api/shared/rows.ts)
identifies corrupt/unavailable metadata; do not confuse that with source acceptance.

<a id="e3"></a>
### E3 — Turn claims are not yet the complete accepted-finding workflow

[Canonical finding storage](../app/src/lib/representation/store/tables/investigation.ts)
and [turn-local findings/sources](../app/src/lib/representation/data/types/investigation/research-turn.ts)
are distinct. [Ask](../app/src/lib/capabilities/research-chat/api/ask/ask.ts)
persists turn claims; [turn inspection](../app/src/lib/app-views/categories/research/inspector/turn.svelte)
shows rows without the requested inspection/acceptance actions. Sampled sources
reference existing project resources; automatic external import was not demonstrated.

<a id="e4"></a>
### E4 — Resource sets, attachment, and scope-building already exist

[Create Resource Set](../app/src/lib/capabilities/resource-sets/api/create-resource-set/create-resource-set.ts),
[resource-set tests](../app/src/lib/capabilities/resource-sets/test/unit/resource-sets.test.ts),
[Agents scope editor](../app/src/lib/app-views/categories/agents/components/scope-editor.svelte),
and [reusable scope builder](../app/src/lib/components/authored/scope-builder/scope-builder.svelte)
provide foundations. The sampled attachment rows lack inspection actions;
reusable member inspection and cross-surface consistency remain work.

<a id="e5"></a>
### E5 — Tasks execute; chat/persona configuration is partly wired

[Task creation](../app/src/lib/capabilities/agents/api/create-task/create-task.ts),
[task execution](../app/src/lib/capabilities/agents/api/shared/execute-agent-task.ts),
and [grounded-runner contracts](../app/src/lib/capabilities/agents/test/non-functional/grounded-runner.test.ts)
exist. [Thread UI](../app/src/lib/app-views/categories/research/content/thread.svelte)
wires persona switching but fixes mode to explore; [set-persona](../app/src/lib/capabilities/research-chat/api/set-thread-persona/set-thread-persona.ts)
persists that choice. Persona tools are persisted/inherited, so removal affects
execution and [agent storage](../app/src/lib/representation/store/tables/agents.ts), not just labels.

<a id="e6"></a>
### E6 — Real authentication is not provided by the development session

[Session and Scope](../app/src/lib/runtime/server/scope.server.ts) resolve the
development identity and configured project mapping. This is an existing authority
boundary to complete, not production sign-in. The [top bar](../app/src/lib/surfaces/top-bar/top-bar.svelte)
already exists; account/project settings extend it.

<a id="e7"></a>
### E7 — Templates have versions/materialization; spreadsheet editing is unfinished

[Template storage](../app/src/lib/representation/store/tables/templates.ts) and
[duplication](../app/src/lib/capabilities/templates/api/duplicate-template/duplicate-template.ts)
already create project-local copies/versions. [Spreadsheet materialization](../app/src/lib/capabilities/templates/api/shared/spreadsheet-materialization.ts)
and [its body tests](../app/src/lib/capabilities/templates/test/unit/template-spreadsheet-body.test.ts)
exist, while [template editor UI](../app/src/lib/app-views/categories/templates/content/editor.svelte)
excludes first-class spreadsheet editing. [Persona duplication](../app/src/lib/capabilities/agents/api/duplicate-persona/duplicate-persona.ts)
is also project-local, not the requested personal/project transfer system.

<a id="e8"></a>
### E8 — Formula infrastructure is not the same as content evaluation

[Built-ins](../app/src/lib/representation/data/behavior/formulas/builtins.ts) and
[spreadsheet recalculation](../app/src/lib/app-views/categories/spreadsheet-editor/procedures/recalculation.ts)
exist. [Content blocks](../app/src/lib/representation/data/types/content/content-block.ts)
describe resolved document/presentation formula snapshots without a content evaluator;
[presentation Variables](../app/src/lib/app-views/categories/presentation-editor/context/variables.svelte)
is a placeholder. EDIT-01/EDIT-02 must inspect actual consumers, not only the parser.

<a id="e9"></a>
### E9 — Chart rendering prototypes and cell clipboard paths are useful but insufficient

[Analysis procedures](../app/src/lib/app-views/categories/analysis/procedures/analysis.ts)
use stub reads; [ChartSpec](../app/src/lib/components/authored/chart/chart-spec.ts)
exists without proving a durable canonical analytic resource. [Spreadsheet clipboard](../app/src/lib/app-views/categories/spreadsheet-editor/procedures/clipboard.ts)
already handles cell operations. Preserve that behavior while designing native rich
objects and linked placements; neither foundation proves cross-editor linking.

<a id="e10"></a>
### E10 — Product command removal is still work, not a completed fact

[Command registry](../app/src/lib/model/client/commands/methods/registry.ts),
[runtime composition](../app/src/lib/runtime/client/start.ts),
[command dialog](../app/src/lib/surfaces/command-bar/command-bar.svelte), and
[key dispatch](../app/src/lib/surfaces/app/effects/dispatch-commands.svelte.ts)
are live. The intake's “removed” language records the desired decision; deletion
must still preserve useful keyboard behavior.

<a id="e11"></a>
### E11 — Project history already has filtering and some navigation

[History](../app/src/lib/app-views/categories/project-overview/context/history.svelte)
already contains a dropdown, search and selectable activities; the requested filter
change is simplification of its presentation. [Activity inspection](../app/src/lib/app-views/categories/project-overview/inspector/activity.svelte)
includes actor inspection and document/presentation opening. Complete the target
matrix and consistency; do not remove working inspection to rebuild the feed.

<a id="e12"></a>
### E12 — Display relations already degrade differently across resource projections

[External projection](../app/src/lib/capabilities/external-files/api/shared/rows.ts)
currently treats some missing actor/connector/task relations as a reason to omit an
otherwise admitted file. [Project-resource actor projection](../app/src/lib/capabilities/project-resources/api/read-project-resource-index/projected-actor.ts)
instead returns no actor when the exact related subject cannot be resolved, and
[resource inspection](../app/src/lib/app-views/categories/project-overview/inspector/resource.svelte)
renders a non-linking fallback. DATA-01 should establish one product contract while
keeping authority and current-row admission inside each owning capability.

<a id="coverage"></a>
## 7. Intake coverage and consolidation

Every operational/tactical theme from the original September 10 intake has a home
below. Repeated checkboxes become one package with multiple acceptance criteria;
preserve/no-change statements become constraints, not unfinished build tasks.
Original epic names map to the corresponding ID prefixes; the UX epics are folded
into their owning feature packages instead of being scheduled twice.

| Original intake | Canonical home |
| --- | --- |
| 1.1 Connectors, lifecycle and duplicate identity | EXT-02–EXT-05; Q1 |
| 1.2 Findings, explicit source acceptance, states, research overhaul | RSH-01–RSH-03 |
| 1.3 Copilot, tasks, active chat configuration, branching, persona tools | AI-01–AI-04; SCOPE-02 |
| 1.4 Auth/top bar, personal templates/personas, ownership, spreadsheet editor, Skills, terminology | ID-01–ID-03; ASSET-01–ASSET-05; Q3/Q6 |
| 1.5 Sets, reusable context, persona resource/set scope and inspection | SCOPE-01/SCOPE-02 |
| 1.6 Graph tabs/editor, canonical/portable charts, structured extraction | ANL-01–ANL-04 |
| 1.7 Cross-editor formulas/catalog and Variables | EDIT-01/EDIT-02 |
| 1.8 Native import/export, external paste/outward-copy design, rich/linked native transfer | IO-01–IO-03; ANL-03 |
| 1.9 Remove commands; direct desktop/browser-safe shortcuts | KEY-01/KEY-02 |
| 1.10 Presence, Where/What, activity parity, simple filter, clickable history/people/file names | COL-01–COL-03 |
| 1.11 Retire old material, Markdown wiki, directories, key files, diagrams, navigation | WIKI-01/WIKI-02, deferred |
| 2.1 Overview activity/navigation/filter | COL-01 |
| 2.2 Attribution, path/size/time, inaccurate helper text, same-row toggle | EXT-04 |
| 2.3 Directory explanations/repeated name; preserve inspector exploration | EXT-04; settled constraints |
| 2.4 Duplicate Rename, info/actions, collapsing, history text/search, labels/status, Generated Description and path inspector | EXT-05; COL-02 |
| 2.5 Selectable history, people/file links, duplicate-name context | COL-02 |
| 2.6 Agents activity, inspectable scope, add resource/set, remove Tools, scope label, preserve Skills | COL-02; SCOPE-01/SCOPE-02; ASSET-03 |
| 2.7 Turn panel, finding/source inspection/acceptance, chat overhaul | RSH-01–RSH-03; AI-03 |
| 2.8 Variables, selected-template section, unchanged empty Comments | EDIT-01; ASSET-05; settled constraints |
| 4–6 Dependencies, epic index and settled decisions | Register, constraints, package cards and retained decision briefs replace the duplicated lists |

Two intake dependencies have been made more precise: activity UX can improve using
existing actors before full sign-in ships; extraction does not require completion
of every analytical feature. Conversely, real multi-user presence/branching does
require authentication, and a prototype renderer does not satisfy canonical linked
analytic identity. No blanket “stabilize the whole schema first” gate is imposed on
bounded current-format work.

<a id="maintenance"></a>
## 8. Keep the backlog useful

### Completion gate

- **Audit/Design:** link source evidence, observed versus intended behavior,
  decisions made or still needed, the implementation contract, and executable
  acceptance scenarios. Design evidence does not mean its feature shipped.
- **Implementation:** the defined user journey works on the agreed current schema;
  relevant failure/ownership/revision/recovery checks and Chromium interaction tests
  pass; changed UI is visually inspected with realistic data and relevant compact/
  zoomed states. Report untested platforms and provider skips separately.
- **Integration:** record reviewed commit/head, target base, actual commands/results,
  remaining scope, and the authorized merge/push. Treat a delivery package as
  complete only after its required slices land on main and its acceptance evidence
  is recorded.
  Do not run every application suite for a Markdown-only planning edit.

### Small working record, not a second backlog

Create a task handoff for the selected package and record its active owner there.
A useful dispatch request names: package ID, first slice, expected outcome, owned
paths, constraints, unresolved gates, acceptance scenarios, and exact integration
authority. Use the existing [AGENTS.md](../AGENTS.md),
[task template](../.agents/tasks/_template/handoff.md) and
[worktree helper](../.agents/scripts/worktree.mjs); do not invent another task runner.

After each material finding or landing, update only the affected package card and
task handoff: actual evidence, remaining slice, ownership, and dependency effects.
Add newly discovered work with a stable ID; do not recycle IDs or silently broaden
an active assignment. Before adding a duplicate, search the coverage map and cards.
Keep finished evidence concise and linked; move detailed execution history to the
task handoff, not into an ever-growing narrative here.

This file does not schedule dates, allocate people, certify today's product, or
authorize the wiki deletion, a deployment, broad provider spending, or a main merge.
Those are separate explicit decisions. No implementation package was completed by
the act of reorganizing this backlog.
