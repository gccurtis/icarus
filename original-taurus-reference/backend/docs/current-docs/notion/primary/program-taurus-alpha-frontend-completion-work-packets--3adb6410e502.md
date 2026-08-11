---
title: "Program — Taurus Alpha Frontend Completion Work Packets"
notion_page_id: "3adb6410e50281aca831cc1b970e1586"
notion_url: "https://app.notion.com/3adb6410e50281aca831cc1b970e1586"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-30 06:23:38Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Program — Taurus Alpha Frontend Completion Work Packets

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Program outcome:** Take Taurus Alpha from the reviewed implementation at `d2b1bdc` to a production-complete frontend: explicit runtime boundaries, real Omega integration, actual Svelte/HTML and visual reconstruction, a certified component system, complete resource editors, control-plane screens, ingestion/interchange, deployment, and end-to-end evidence.
> **Status:** Defined. Packet execution has not started. The packet order is integration order; explicitly independent work may run in parallel, but gates close cumulatively.
## Completion definition
Alpha is complete only when it is a truthful, accessible, optimistic projection of Omega:
1. it synchronizes confirmed state, optimistic operations, acknowledgements, durable change descriptors, jobs, and recovery;
2. it interprets user interaction into typed intent and stable actions;
3. it converts eligible actions into explicit control-plane, Workspace, Project capability, editor, AI, ingestion, or transfer operations;
4. its actual Svelte/HTML, component composition, responsive behavior, and visual states satisfy the governing design authorities; and
5. every current mock, placeholder, ambient Project dependency, direct transport path, and superseded compatibility path is removed or explicitly deferred.
Components render state and emit semantic events. Controllers interpret those events. Frontend runtimes own coordination and synchronization. Editor adapters contain engine coupling. Omega owns authorization, canonical resources, revisions, jobs, durable history, and audit.
## Frozen source baseline
- [Taurus Alpha reviewed commit d2b1bdc](https://github.com/gccurtis/taurus-alpha/tree/d2b1bdcd02307f29ab4a895232cbf857d8157a56)
- Svelte 5.56.6, SvelteKit 2.70.1, TypeScript 5.9.3, Vite 8.1.5, Tailwind 4.3.3
- ProseMirror is the existing production Document engine and remains behind the Document adapter.
- Fabric.js 7.4.0 is already installed and used by the Slides prototype. The program productionizes it behind a Taurus adapter unless the measured capability audit proves it cannot satisfy the contract; Fabric state never becomes canonical deck state.
- Spreadsheet currently has no stage or grid dependency. Its governed model is one Spreadsheet Resource containing one sparse grid—never a workbook/sheet-tab UI.
- Chat currently has no Resource stage. Its target is the revisioned Prompt+Response turn tree and remains distinct from Project Quarterback.
- The shell and many screens are visually mature; packets preserve aligned markup and reconstruct the parts whose responsibilities, accessibility, composition, or visual contract are wrong.
## Governing invariants
- A browser application instance owns one User Cell for the authenticated User/session generation.
- Its Project runtime is keyed by User Cell identity plus ProjectID and corresponds to that User's logical backend Project Subcell.
- Multiple Workspace views in one browser may reuse that runtime. Another browser tab/window has independent frontend memory unless a future SharedWorker architecture explicitly changes this; clients converge through Omega.
- Every Project request carries ProjectID and receives authoritative admission. A mutable selected Project is navigation preference, never authorization.
- Workspace entries are exactly `system | launcher | resource`. Overview and Project Agents are permanent system tabs; New Tab is a launcher resolved in place; preview is a resource adapter. Reorder uses stable IDs and is undoable. There is no pin/unpin command.
- Durable Project changes are descriptors/cursors that invalidate or trigger bounded reads. Chat/AI stream deltas are transient until durable commit.
- One durable SubmissionID/idempotency key survives retries; RequestID is per-attempt tracing identity.
- Context exposes available working context. Inspector adapts to an extensible stable selection envelope. Neither owns transport or canonical state.
- All editor engines are replaceable implementation details behind resource adapters. Raw ProseMirror, Fabric, grid, or viewer state does not cross generic runtime or wire boundaries.
- No completion gate can pass on an invisible mock, generic placeholder, fake save status, or disabled control that claims unsupported capability.
## Implementation and evidence rules
Every packet must:
- begin from the pinned baseline and record any intervening commits;
- cite the governing Yesod and Omega authorities;
- list exact current files/surfaces and the target boundary;
- implement runtime, wire, Svelte/HTML, visual, accessibility, security, and failure behavior within its scope;
- use only free and open-source dependencies, recording license, pinned version, browser/Node requirements, and replacement boundary;
- include unit, component, browser, visual, accessibility, integration, real-stack, and sabotage tests as applicable;
- remove superseded code after parity instead of retaining two authorities;
- attach completion evidence: changed files, commands/test output, screenshots, traces, backend baseline, residual gaps, and rollback/recovery notes.
A packet is not complete because code compiles or the happy path is visible.
## Waves and gates
<table fit-page-width="true" header-row="true">
<tr>
<td>Wave</td>
<td>Packets</td>
<td>Cumulative gate</td>
</tr>
<tr>
<td>0 — Evidence and build foundation</td>
<td>Α-001–Α-004</td>
<td>Baseline, contracts, and verification are trustworthy.</td>
</tr>
<tr>
<td>1 — Component and visual substrate</td>
<td>Α-005–Α-010</td>
<td>Frontend Foundation Ready.</td>
</tr>
<tr>
<td>2 — User Cell and Project Subcell runtime</td>
<td>Α-011–Α-025</td>
<td>Frontend Runtime Ready.</td>
</tr>
<tr>
<td>3 — Shell, routes and control surfaces</td>
<td>Α-026–Α-034</td>
<td>Control and Shell Surfaces Ready.</td>
</tr>
<tr>
<td>4 — Project workspace and panels</td>
<td>Α-035–Α-040</td>
<td>Project Workspace Ready.</td>
</tr>
<tr>
<td>5 — Editors and resource views</td>
<td>Α-041–Α-053</td>
<td>Resource Editor Ready.</td>
</tr>
<tr>
<td>6 — AI, ingestion and interchange</td>
<td>Α-054–Α-059</td>
<td>Integrated Product Frontend Ready.</td>
</tr>
<tr>
<td>7 — Security, quality and production certification</td>
<td>Α-060–Α-067</td>
<td>Taurus Alpha Product Frontend Complete.</td>
</tr>
</table>
## Critical path and parallel lanes
The security-critical path is `Α-001 → Α-003 → Α-011 → Α-012 → Α-013 → Α-015 → Α-016 → Α-017–Α-020`. Component reconstruction `Α-005–Α-010` can proceed in parallel after the harness. Document completion and the initial Slides domain/Fabric productionization may begin once the shared runtime/host prerequisites are stable. Spreadsheet begins with the one-grid/FOSS adapter decision in Α-048. Chat remains a separate Resource vertical in Α-051–Α-052.
Frontend packets may implement against deterministic Omega fixtures before a backend packet lands, but their real-stack completion gate waits for the cited Omega contract. They must not invent a competing backend contract.
## Explicitly deferred
- audio recording, transcription, and specialized audio playback beyond safe generic download;
- legacy XLS import unless Omega adds an authoritative supported contract;
- durable offline mutation/editing;
- native mobile or desktop shells;
- marketing/public website work; and
- new resource capabilities outside the settled Taurus Yesod/Omega corpus.
## Authorities
- <mention-page url="https://app.notion.com/p/3adb6410e502818fb987d5f5004117e3"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502814fabcad526f8abf0de"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281ddaa6dca8f6e1802fb"/>
- <mention-page url="https://app.notion.com/p/3acb6410e5028147909ef7214406baad"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281e286aff541de343991"/>
- <mention-page url="https://app.notion.com/p/392b6410e50281f1a374fa89a941626a"/>
# Ordered packet registry
The following pages are the executable program. Numbering is integration order; packet-local dependency sections govern any parallel start.
## Wave 0 — Evidence and build foundation
- <mention-page url="https://app.notion.com/p/3adb6410e50281059f58e7581579de87"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502816e8161de23d0ec440c"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502814aa4bfc5460a9477aa"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502817b9f99f7ca6a86d962"/>
## Wave 1 — Component and visual substrate
- <mention-page url="https://app.notion.com/p/3adb6410e5028100b19ec124ac610204"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281dd8ccff24512ba807c"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028107bdf9d8c9b93851aa"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281d8911fe1435ba73d60"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028101b602c377835b67ba"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502818d9a73f95b5271fea6"/>
## Wave 2 — User Cell and Project Subcell runtime
- <mention-page url="https://app.notion.com/p/3adb6410e5028113aec8f89f6c0ddaf5"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281959ba6ea70f4037a0e"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028128bf04e1b373dd8dce"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281639bd6e45a0bce1611"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028111a985fec23dc8df19"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502815ca220dc2df0e22d7e"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502815a9274f706799e3d69"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028118a42ae8adeb21bb3f"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281269f00ed95f9ab08b4"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281ba8aeac72f0256427a"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281039dcffe3c6c16a768"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028179b214e38d89b8397a"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281b0831ad550a2b388e8"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281489af5fa4d21b720c7"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502818bbcdbe442448a333f"/>
## Wave 3 — Shell, routes and control surfaces
- <mention-page url="https://app.notion.com/p/3adb6410e5028156aba7c1722ca61e9a"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502817ba8beca790bb2b883"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281fc90f1eb658619f295"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281ddafd7df8d7b0ebff3"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502818fa136f2b4f5108b21"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281c9a771e89b521e049a"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281d7ab11dc6aff94494c"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028104bc56ea4e092e77bc"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502814e96c9fc41d1b29236"/>
## Wave 4 — Project workspace and panels
- <mention-page url="https://app.notion.com/p/3adb6410e50281f78391dd29f52e11bd"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028159a309e6a822b933aa"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502812ea912d33ca0e16d34"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028125a019efb07e1ffb36"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028145be60e6875bee91fd"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281ceb74afe850de03ff4"/>
## Wave 5 — Editors and resource views
- <mention-page url="https://app.notion.com/p/3adb6410e50281cfa7a0d588a264bc07"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028141b5ceea9a4cc45604"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281f193ced1daebcfcf76"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502815ba8e6f516e4cb3034"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028103916dde28ea82d7af"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281b3be53f3821894dc9a"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028180924fe360b82641f5"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502817ba915c7bb3db6bc0e"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281468b8adfd3d58bf31b"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028193bdfbf65f0a493613"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502812d803dcedc917f4601"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028123ab0be5c41a94665e"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028106b264fffc8aee2399"/>
## Wave 6 — AI, ingestion and interchange
- <mention-page url="https://app.notion.com/p/3adb6410e5028145a6cec0e6073fe0e1"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502813ca52dd0645d48d848"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281c482a9c67a509bb54f"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502815fb293d572197c3466"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281169c35fc3232c0ccf9"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281fda012ecf6bf5a6a40"/>
## Wave 7 — Security, quality and production certification
- <mention-page url="https://app.notion.com/p/3adb6410e50281599a1efc22ff7b1dbc"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502812bada7c3bab6f26af4"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281669d7ef62dd243971b"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028192a721cdcabc77c9fe"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028167b363e4b192d35748"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502817cbd8bfdcbfade2b8d"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281a188ffed128568eee0"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502813e8007ef9c301357ff"/>
## Editor authority additions
- <mention-page url="https://app.notion.com/p/3adb6410e502810dae4ae1b4866d8c6d"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502816fbecde3c54898886b"/>

