
/* ============================================================
   The project the deck is set in. Real content throughout —
   every list, table, and citation refers to the same body of work.
   ============================================================ */
const PROJECT = { name: "Northwind Grid Resilience", role: "Owner", members: 7 };

/* The tab strip. Singletons come first, are icon-only, and cannot be closed —
   `permanent` is `target.kind === "singleton"`, per docs/client-model/workbench.md.
   Only tabs a person opened carry a label, which is the whole declutter. */
const TABS = [
  { k: "project-overview", label: "Overview", icon: "grid", fix: true },
  { k: "research", label: "Research", icon: "flask", fix: true },
  { k: "analysis", label: "Analysis", icon: "chart", fix: true },
  { k: "context", label: "Context", icon: "target", fix: true },
  { k: "templates", label: "Templates", icon: "template", fix: true },
  { k: "personas", label: "Personas", icon: "persona", fix: true },
  { k: "automations", label: "Automations", icon: "bolt", fix: true },
  { div: true },
  { k: "document", label: "Q3 Resilience Memo", icon: "doc", dirty: true },
  { k: "slides", label: "Board Update — October", icon: "deck" },
  { k: "spreadsheet", label: "Outage Cost Model", icon: "sheet" },
  { k: "new-tab", label: "New tab", icon: "plus" }
];

const SCREENS = {};

/* Project variables. The context panel offers these on every screen that can
   hold a formula, because that is where a formula is actually written. */
const VARIABLES = () =>
  pane("Variables", [
    sec("Tables", [
      row("outageEvents", { icon: "db", sub2: "4,182 rows · 13 fields", inspect: "variable" }),
      row("substations", { icon: "db", sub2: "41 rows · 8 fields", inspect: "variable" })
    ].join(""), { count: 2, flush: true }),
    sec("Values", [
      row("hardeningBudget", { icon: "sigma", sub2: "number · 46,000,000", inspect: "variable" }),
      row("filingDeadline", { icon: "calendar", sub2: "date · 14 Nov 2026", inspect: "variable" }),
      row("filingParty", { icon: "type", sub2: "text · Northwind Power", inspect: "variable" })
    ].join(""), { count: 3, flush: true }),
    sec("Functions", [
      row("avoidedMinutes(t)", { icon: "wrench", sub2: "table → table", inspect: "variable" }),
      row("costPerMinute(t)", { icon: "wrench", sub2: "table → number", inspect: "variable" })
    ].join(""), { count: 2, flush: true }),
    `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("Project Name Manager. Values are stored, not formulas — a formula reads the value when it runs, so what you see here is what a formula will get.")}</div>`
  ].join(""), { search: search("Search variables"), foot: btn("New variable", { icon: "plus" }) });

/* ============================================================
   Actors.
   Anything that can appear as "who did this" is inspectable from
   anywhere, so these merge into every screen's lens lookup the
   same way the Copilot's do. A person, an agent, an automation and
   a connector are all actors; only the first has an inbox.
   ============================================================ */
const ACTORS = {
  actor: { crumbs: [["Project", null], ["Mira Jain", null]], body: [
    sec("Person", `<div class="profile" style="margin-bottom:8px">${av("MJ", "int", { lg: true, name: "Mira Jain" })}
      <div class="profile-m"><span class="card-t" style="font-size:var(--t-lg)">Mira Jain</span>
      <span class="note">Owner · here now, in Outage Cost Model</span></div></div>`
      + kv([["Email", "mira.jain@northwind.example"], ["Role", chip("Owner", "int")], ["Member since", "12 Mar 2026", { mono: true }]])),
    sec("Message", `<div class="inp is-filled" style="height:auto;padding:8px;align-items:flex-start;white-space:normal"><span class="inp-w" style="white-space:normal;color:var(--ink3)">Write to Mira…</span></div>
      <div class="btn-row" style="margin-top:8px">${btn("Send", { k: "pri", icon: "at" })}</div>`
      + note("This is a comment in <b>" + esc(PROJECT.name) + "</b> addressed to Mira. It is not email and not a private inbox — it appears in her Mentions here, and anyone in the project can read it.")),
    sec("Between you", [
      row("Mentioned you on Q3 Resilience Memo", { icon: "at", sub2: "“@ana can you confirm 1,842,000…”", right: "2h", inspect: "mention" }),
      row("Mentioned you in Outage Cost Model, C2", { icon: "at", sub2: "“@ana corrected total or the old one?”", right: "1d", inspect: "mention" })
    ].join(""), { count: 2, flush: true }),
    sec("Recently", [
      row("Created Outage minutes by substation", { icon: "chart", right: "3d", inspect: "activity" }),
      row("Edited Regulatory filing shell", { icon: "template", right: "2w", inspect: "activity" })
    ].join(""), { count: 12, flush: true, shut: true }),
    sec("Access", kv([["Can", "Create, edit, manage membership, archive"], ["Change role", "Project settings"]]) + note("Role changes and removal live in Project settings rather than turning this panel into membership administration."), { shut: true })
  ].join("") },

  "actor-agent": { crumbs: [["Project", null], ["Grid Analyst", null]], body: [
    sec("Agent", `<div class="profile" style="margin-bottom:8px">${av("GA", "ai", { lg: true, name: "Grid Analyst" })}
      <div class="profile-m"><span class="card-t" style="font-size:var(--t-lg)">Grid Analyst</span>
      <span class="note">Persona · this project</span></div></div>`
      + note("Reads field data and relay logs; refuses to speculate past the record.")),
    sec("Record", `<div class="stat-row">${stat("41", "tasks")}${stat("2", "running")}${stat("128", "findings")}</div>`),
    sec("Doing now", row("Summarise overnight outage reports", { icon: "spark", sub2: "Step 3 of 5", inspect: "copilot.task" }), { count: 2, flush: true }),
    sec("No message", note("An agent has no inbox. To give it work, start a task — the Copilot, or an Automation that asks it to do something.")),
    sec("Actions", `<div class="btn-row">${btn("Open profile", { k: "pri", icon: "chevR" })}${btn("Start a task", { icon: "spark" })}</div>`)
  ].join("") },

  "actor-automation": { crumbs: [["Project", null], ["Nightly filing digest", null]], body: [
    sec("Automation", `<div class="chips" style="margin-bottom:6px">${av("NF", "ai", { name: "Nightly filing digest" })}<span class="card-t">Nightly filing digest</span></div>`
      + note("<b>When</b> the clock reaches 02:00 in New York, <b>ask Filing Editor</b> to summarise last night's reports.")),
    sec("Last fired", kv([["When", "Today, 02:00", { mono: true }], ["Result", chip("Couldn't start", "err")]])),
    sec("Why it shows as an actor", note("Work it starts is attributed to it, so “updated by Nightly filing digest” names the rule rather than the person who wrote it. The dispatching user stays in the detail.")),
    sec("Actions", `<div class="btn-row">${btn("Open rule", { k: "pri", icon: "chevR" })}</div>`)
  ].join("") },

  "actor-connector": { crumbs: [["Project", null], ["SharePoint — Ops Reports", null]], body: [
    sec("Connector", `<div class="chips" style="margin-bottom:6px">${av("SP", "off", { name: "SharePoint — Ops Reports" })}<span class="card-t">SharePoint — Ops Reports</span></div>`
      + kv([["Provider", "SharePoint"], ["Status", chip("Authentication expired", "err")], ["Files", "312", { mono: true }]])),
    sec("Why it shows as an actor", note("Files it syncs are attributed to it, because no person put them there.")),
    sec("Actions", `<div class="btn-row">${btn("Reconnect", { k: "pri" })}${btn("Open connector", { icon: "chevR" })}</div>`)
  ].join("") }
};

/** Names an actor inline, wherever "who" appears in a table or a row. */
const who = (label, key) => `<button class="crumb-b" type="button" data-inspect="${esc(key)}" style="font-size:inherit;color:inherit">${esc(label)}</button>`;

const VARIABLE_LENS = {
  crumbs: [["Variables", null], ["outageEvents", null]],
  body: [
    sec("Variable", kv([["Authored", "outageEvents", { mono: true }], ["Lookup key", "outageevents", { mono: true }], ["Type", "table", { mono: true }], ["Order", "1 of 9", { mono: true }]])),
    sec("Value", `<div class="tbl-w"><div class="tbl-c"><table class="tbl"><thead><tr><th>eventId</th><th>subId</th><th>customerMinutes</th></tr></thead><tbody><tr><td class="num">E-8841</td><td class="num">S-12</td><td class="num">612,400</td></tr><tr><td class="num">E-8842</td><td class="num">S-12</td><td class="num">704,900</td></tr><tr><td class="num">E-8843</td><td class="num">S-03</td><td class="num">318,400</td></tr></tbody></table></div></div><span class="note">3 of 4,182 rows</span>`),
    sec("Use", `<div class="btn-row">${btn("Insert into formula", { icon: "sigma", sm: true })}${btn("Use in Analysis", { icon: "chart", sm: true })}</div>`),
    sec("Attribution", kv([["Created by", who("Mira Jain", "actor")], ["Updated", "2 days ago", { mono: true }]]), { shut: true })
  ].join("")
};

/* ============================================================
   1 · Project Overview
   ============================================================ */
SCREENS["project-overview"] = {
  name: "Project Overview",
  path: "docs/screen-specs/project-overview.md",
  purpose:
    "The permanent first tab. Who is here, what is addressed to you, what exists, and the four things you can make. Every list is a project-scoped query, never a stored resource array.",
  init: { ctx: "resources", inspect: "project" },

  center: () => `
    <div class="wrap">
      <div class="hd">
        <div class="hd-m">
          <h1 class="hd-t">${PROJECT.name}</h1>
          <span class="hd-s">Winter-storm hardening case for the 2026 rate filing.</span>
        </div>
        <div class="hd-a">
          <span class="presence">${avb("AR", "a1", { name: "Ana Reyes — you", inspect: "actor" })}${avb("TK", "a2", { name: "Tomas Kaur", inspect: "actor" })}${avb("MJ", "int", { name: "Mira Jain", inspect: "actor" })}${avb("+4", "off", { name: "4 more members", inspect: "people" })}</span>
          ${btn("Settings", { icon: "gear", sm: true, inspect: "project" })}
        </div>
      </div>

      <div class="split is-2-3">
        <div style="display:flex;flex-direction:column;gap:calc(var(--u)*2)">
          <span class="eyebrow">Create</span>
          <div class="tbl-w">
            ${row("New document", { icon: "doc", inspect: "project" })}
            ${row("New slide deck", { icon: "deck", inspect: "project" })}
            ${row("New spreadsheet", { icon: "sheet", inspect: "project" })}
            ${row("Upload file", { icon: "upload", inspect: "file" })}
          </div>
          <div class="tbl-w" style="border-color:var(--err-b);background:var(--err-s)">
            <button class="row" type="button" data-inspect="connector" style="border-radius:0;padding-block:calc(var(--u)*2.5)">
              <span class="row-i" style="color:var(--err-t)">${ic("link", 15)}</span>
              <span class="row-m"><span class="row-t" style="color:var(--err-t)">SharePoint can't sync</span>
              <span class="row-s" style="color:var(--err-t)">Authentication expired — reconnect</span></span>
            </button>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:calc(var(--u)*2)">
          <div class="chips">
            ${chip(ic("at", 11) + " Mentions", "act")}${chip("Activity")}
            <span style="margin-inline-start:auto" class="note">4 new</span>
          </div>
          <div class="tbl-w">
            ${[
              ["MJ", "int", "Mira Jain", "mentioned you in a comment on <b>Q3 Resilience Memo</b>", "“@ana can you confirm 1,842,000 against the relay log?”", "2h"],
              ["TK", "a2", "Tomas Kaur", "mentioned you on <b>Board Update — October</b>, slide 4", "“@ana is this the chart you wanted on the scale from slide 3?”", "4h"],
              ["MJ", "int", "Mira Jain", "mentioned you in <b>Outage Cost Model</b>, C2", "“@ana corrected total or the old one?”", "1d"],
              ["GA", "ai", "Grid Analyst", "replied in a thread you follow on <b>Feeder 12</b>", "Both failures trace to the same relay pair.", "1d"]
            ].map(([i, t, from, what, quote, when]) => `
              <button class="row" type="button" data-inspect="mention" style="border-radius:0;border-bottom:1px solid var(--bd);padding-block:calc(var(--u)*2.5);align-items:flex-start">
                ${av(i, t, { name: from })}
                <span class="row-m">
                  <span class="row-t"><b>${from}</b> ${what}</span>
                  <span class="row-s">${quote}</span>
                </span>
                <span class="row-x">${when}</span>
              </button>`).join("")}
          </div>
        </div>
      </div>

      <div>
        <div class="chips" style="margin-bottom:calc(var(--u)*3)">
          <span style="flex:1;min-width:180px;max-width:300px">${search("Search project work")}</span>
          ${btn("All kinds", { icon: "chevD", sm: true })}
          ${btn("Anyone", { icon: "chevD", sm: true })}
          ${btn("Updated", { icon: "sort", sm: true })}
          <span style="margin-inline-start:auto" class="note">24 of 24</span>
        </div>
        ${table(
          ["Name", "Kind", "Updated", "Updated by"],
          [
            { on: true, inspect: "resource", cells: [
              { h: `<span class="cellname"><span class="row-i">${ic("doc")}</span>Q3 Resilience Memo</span>` },
              { h: "Document" }, { h: "4 minutes ago", cls: "num" }, { h: who("Ana Reyes", "actor") } ] },
            { inspect: "resource", cells: [
              { h: `<span class="cellname"><span class="row-i">${ic("deck")}</span>Board Update — October</span>` },
              { h: "Slide deck" }, { h: "2 hours ago", cls: "num" }, { h: who("Tomas Kaur", "actor") } ] },
            { inspect: "resource", cells: [
              { h: `<span class="cellname"><span class="row-i">${ic("sheet")}</span>Outage Cost Model</span>` },
              { h: "Spreadsheet" }, { h: "Yesterday", cls: "num" }, { h: who("Nightly filing digest", "actor-automation") } ] },
            { inspect: "research-row", cells: [
              { h: `<span class="cellname"><span class="row-i">${ic("flask")}</span>Why did Feeder 12 fail twice?</span>` },
              { h: "Research" }, { h: "Yesterday", cls: "num" }, { h: who("Ana Reyes", "actor") } ] },
            { inspect: "resource", cells: [
              { h: `<span class="cellname"><span class="row-i">${ic("chart")}</span>Outage minutes by substation</span>` },
              { h: "Analysis" }, { h: "3 days ago", cls: "num" }, { h: who("Mira Jain", "actor") } ] },
            { inspect: "file", cells: [
              { h: `<span class="cellname"><span class="row-i">${ic("folder")}</span>NERC-2025-winter-review.pdf</span>` },
              { h: "External file" }, { h: "4 days ago", cls: "num" }, { h: who("SharePoint — Ops Reports", "actor-connector") } ] },
            { inspect: "resource", cells: [
              { h: `<span class="cellname"><span class="row-i">${ic("quote")}</span>Undergrounding cut SAIDI 38% in Ward 3</span>` },
              { h: "Finding" }, { h: "5 days ago", cls: "num" }, { h: who("Grid Analyst", "actor-agent") } ] },
            { inspect: "connector", cells: [
              { h: `<span class="cellname"><span class="row-i">${ic("link")}</span>SharePoint — Ops Reports</span>` },
              { h: "Connector" }, { h: "6 days ago", cls: "num" }, { h: "—" } ] }
          ]
        )}
      </div>
    </div>`,

  contexts: () => [
    { id: "resources", label: "Resources", icon: "layers", body: () =>
      pane("Resources", [
        sec("Documents", [row("Q3 Resilience Memo", { icon: "doc", inspect: "resource", on: true }), row("Interconnect Failure Review", { icon: "doc", inspect: "resource" }), row("Regulatory Filing Draft", { icon: "doc", inspect: "resource" })].join(""), { count: 3, flush: true }),
        sec("Slide decks", [row("Board Update — October", { icon: "deck", inspect: "resource" }), row("Storm Hardening Options", { icon: "deck", inspect: "resource" })].join(""), { count: 2, flush: true }),
        sec("Spreadsheets", [row("Outage Cost Model", { icon: "sheet", inspect: "resource" }), row("Substation Inventory", { icon: "sheet", inspect: "resource" })].join(""), { count: 2, flush: true }),
        sec("Findings", [row("Undergrounding cut SAIDI 38%", { icon: "quote", inspect: "resource" }), row("Feeder 12 relay mis-coordinated", { icon: "quote", inspect: "resource" })].join(""), { count: 2, flush: true, shut: true }),
        sec("Files and connectors", [
          row("SharePoint — Ops Reports", { icon: "link", sub2: "Authentication expired", inspect: "connector" }),
          row("NERC-2025-winter-review.pdf", { icon: "folder", sub2: "No text layer to extract", inspect: "file", sub: true }),
          row("Google Drive — Filings", { icon: "link", sub2: "Synced 2h ago · 148 files", inspect: "connector" })
        ].join(""), { count: 9, flush: true })
      ].join(""), { search: search("Filter resources") }) },

    { id: "mentions", label: "Mentions", icon: "at", body: () =>
      pane("Mentions", [
        sec("Unread", [
          row("Mira Jain on Q3 Resilience Memo", { icon: "comment", sub2: "“@ana can you confirm 1,842,000…”", right: "2h", inspect: "mention", on: true }),
          row("Tomas Kaur on Board Update, slide 4", { icon: "comment", sub2: "“@ana is this the chart you wanted…”", right: "4h", inspect: "mention" }),
          row("Mira Jain on Outage Cost Model, C2", { icon: "comment", sub2: "“@ana corrected total or the old one?”", right: "1d", inspect: "mention" })
        ].join(""), { count: 3, flush: true }),
        sec("Read", row("Tomas Kaur on Storm Hardening Options", { icon: "comment", sub2: "“@ana approved, thanks”", right: "3d", inspect: "mention" }), { count: 1, flush: true, shut: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("A mention is addressed to you by a person. It is the one thing worth interrupting for, which is why it leads rather than sitting inside Activity.")}</div>`
      ].join("")) },

    { id: "people", label: "People", icon: "users", body: () =>
      pane("People", [
        sec("Here now", [
          row("Ana Reyes", { icon: "eye", sub2: "Q3 Resilience Memo · you", inspect: "actor" }),
          row("Tomas Kaur", { icon: "eye", sub2: "Q3 Resilience Memo · page 3", inspect: "actor" }),
          row("Mira Jain", { icon: "eye", sub2: "Outage Cost Model", inspect: "actor", on: true })
        ].join(""), { count: 3, flush: true }),
        sec("Everyone", [
          row("Ana Reyes", { icon: "persona", sub2: "Owner", inspect: "actor" }),
          row("Mira Jain", { icon: "persona", sub2: "Owner", inspect: "actor" }),
          row("Tomas Kaur", { icon: "persona", sub2: "Editor", inspect: "actor" }),
          row("Devi Rao", { icon: "persona", sub2: "Editor", inspect: "actor" }),
          row("Sam Oyelaran", { icon: "persona", sub2: "Editor", inspect: "actor" }),
          row("Priya Nandi", { icon: "persona", sub2: "Editor", inspect: "actor" }),
          row("Jon Alder", { icon: "persona", sub2: "Viewer", inspect: "actor" })
        ].join(""), { count: 7, flush: true }),
        sec("Agents and machinery", [
          row("Grid Analyst", { icon: "spark", sub2: "Persona · 41 tasks", inspect: "actor-agent" }),
          row("Filing Editor", { icon: "spark", sub2: "Persona · 18 tasks", inspect: "actor-agent" }),
          row("Nightly filing digest", { icon: "bolt", sub2: "Automation", inspect: "actor-automation" }),
          row("SharePoint — Ops Reports", { icon: "link", sub2: "Connector", inspect: "actor-connector" })
        ].join(""), { count: 4, flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("Anything that can appear as “who did this” is here and can be inspected. Only a person can be written to.")}</div>`
      ].join(""), { search: search("Search people") }) },

    { id: "activity", label: "Activity", icon: "activity", body: () =>
      pane("Activity", [
        `<div class="chips" style="padding:0 calc(var(--u)*3) calc(var(--u)*2)">${chip("Today", "act")}${chip("Anyone")}${chip("Any target")}</div>`,
        sec("Today", [
          row("<b>Ana Reyes</b> edited Q3 Resilience Memo", { icon: "doc", right: "4m", inspect: "activity" }),
          row("<b>Nightly filing digest</b> started a task", { icon: "bolt", right: "3h", inspect: "activity" }),
          row("<b>Tomas Kaur</b> created Board Update", { icon: "deck", right: "5h", inspect: "activity" })
        ].join(""), { flush: true }),
        sec("Yesterday · 14 events", row("<b>Grid Analyst</b> accepted 6 findings", { icon: "quote", right: "1d", sub2: "Digest — expand to see each", inspect: "activity" }), { flush: true, shut: true })
      ].join(""), { search: search("Search activity") }) },

    { id: "tasks", label: "Tasks", icon: "spark", body: () =>
      pane("Tasks", [
        sec("Waiting", row("Confirm filing deadline", { icon: "clock", sub2: "Filing Editor · waiting", inspect: "copilot.task" }), { count: 1, flush: true }),
        sec("Running", row("Summarise overnight outage reports", { icon: "spark", sub2: "Grid Analyst · step 3 of 5", inspect: "copilot.task", on: true }), { count: 1, flush: true }),
        sec("Failed", row("Rebuild substation crosswalk", { icon: "warn", sub2: "Grid Analyst · tool error", inspect: "copilot.task" }), { count: 1, flush: true }),
        sec("Recently completed", [row("Extract 2024 storm precedents", { icon: "ok", right: "2h", inspect: "copilot.task" }), row("Draft board talking points", { icon: "ok", right: "1d", inspect: "copilot.task" })].join(""), { count: 2, flush: true, shut: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("An unqualified <code>waiting</code> status says only Waiting. No Reply or Resume until the task model records why it is blocked.")}</div>`
      ].join(""), { foot: btn("Manage Personas", { icon: "persona" }) }) },

    { id: "health", label: "Health", icon: "pulse", body: () =>
      pane("Health", [
        sec("Connectors", [row("SharePoint — Ops Reports", { icon: "link", sub2: "Authentication expired 6d ago", inspect: "connector", on: true }), row("Google Drive — Filings", { icon: "ok", sub2: "Synced 2h ago · 148 files", inspect: "connector" })].join(""), { count: 2, flush: true }),
        sec("Extraction", row("NERC-2025-winter-review.pdf", { icon: "warn", sub2: "Scanned PDF, no text layer", inspect: "file" }), { count: 1, flush: true }),
        sec("Automations", row("Nightly filing digest", { icon: "bolt", sub2: "Last dispatch failed", inspect: "copilot.task" }), { count: 1, flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("Only things that genuinely cannot proceed. A prompt block or a formula is never listed here — both read their value when they run, so neither can fall behind.")}</div>`
      ].join(""), { foot: btn("Open Automations", { icon: "bolt" }) }) },

    { id: "variables", label: "Variables", icon: "hash", body: VARIABLES },

    { id: "contexts", label: "Context", icon: "target", body: () =>
      pane("Context", [
        sec("Saved Contexts", [
          row("Regulatory corpus", { icon: "target", sub2: "34 resources", right: "34", inspect: "resource" }),
          row("Field reports 2024–25", { icon: "target", sub2: "96 resources", right: "96", inspect: "resource" }),
          row("Everything but drafts", { icon: "target", sub2: "211 resources", right: "211", inspect: "resource" }),
          row("Storm precedents", { icon: "warn", sub2: "Resolves to 0 resources", right: "0", inspect: "resource" })
        ].join(""), { count: 4, flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${gap("A zero-member Context currently broadens retrieval to the whole project. Blocked from dispatch until an explicit-empty sentinel exists.")}</div>`
      ].join(""), { search: search("Search Contexts"), foot: btn("Open Context screen", { k: "gh" }) }) },

    { id: "templates", label: "Templates", icon: "template", body: () =>
      pane("Templates", [
        sec("Documents", [row("Regulatory filing shell", { icon: "doc", sub2: "Project · 4 variables", inspect: "resource" }), row("Incident review", { icon: "doc", sub2: "Global", inspect: "resource" })].join(""), { count: 2, flush: true }),
        sec("Slide decks", row("Board update", { icon: "deck", sub2: "Project · 2 variables", inspect: "resource" }), { count: 1, flush: true }),
        sec("Spreadsheets", row("Cost model skeleton", { icon: "sheet", sub2: "Project", inspect: "resource" }), { count: 1, flush: true })
      ].join(""), { search: search("Search templates"), foot: btn("Open Templates", { k: "gh" }) }) }
  ],

  inspectors: {
    project: { crumbs: [["Project", null]], body: [
      sec("Identity", kv([["Name", esc(PROJECT.name)], ["Description", "Winter-storm hardening case for the 2026 rate filing."], ["State", chip("Active", "ok")], ["Your role", chip("Owner", "int")]])),
      sec("People", [kv([["Owners", "2"], ["Editors", "4"], ["Viewers", "1"]]), `<div class="chips">${av("AR", "a1")}${av("TK", "a2")}${av("MJ", "int")}${av("+4", "off")}</div>`, note("The model permits multiple owners and requires at least one.")].join("")),
      sec("Dates", kv([["Created", "12 Mar 2026", { mono: true }], ["Updated", "4 minutes ago", { mono: true }]]) + note("Project has no creator or updater actor field."), { shut: true }),
      sec("Project actions", `<div class="btn-row">${btn("Settings", { icon: "gear" })}${btn("Archive", { k: "dgr" })}</div>`, { shut: true })
    ].join("") },

    mention: { crumbs: [["Project", "project"], ["Mention", null]], body: [
      sec("Mention", kv([["From", `${av("MJ", "int")} Mira Jain`], ["Where", "Q3 Resilience Memo · page 2"], ["When", "2 hours ago", { mono: true }]])),
      sec("Comment", `<div class="quote-v">“@ana can you confirm 1,842,000 against the relay log? The event log says 1,840,200.”</div>`),
      sec("Anchored to", `<div class="quote-v">nearly a third of customer-minutes lost</div>` + note("The exact text range the comment is attached to.")),
      sec("Actions", `<div class="btn-row">${btn("Open in context", { k: "pri", icon: "chevR" })}${btn("Reply")}${btn("Mark read")}</div>`)
    ].join("") },

    resource: { crumbs: [["Project", "project"], ["Q3 Resilience Memo", null]], body: [
      sec("Identity", kv([["Title", "Q3 Resilience Memo"], ["Kind", `<span class="cellname">${ic("doc")} Document</span>`], ["ID", "d_7fk2…9aq", { mono: true }]]) + `<div class="btn-row" style="margin-top:4px">${btn("Open", { k: "pri", icon: "chevR" })}${btn("Duplicate")}</div>`),
      sec("Editing now", `<div class="chips">${avb("AR", "a1", { name: "Ana Reyes", inspect: "actor" })}${avb("TK", "a2", { name: "Tomas Kaur", inspect: "actor" })}</div>` + note("Ana Reyes and Tomas Kaur. Click either to write to them.")),
      sec("Provenance", kv([["Created by", who("Ana Reyes", "actor")], ["Updated by", who("Ana Reyes", "actor")], ["From template", "Regulatory filing shell"], ["Updated", "4 minutes ago", { mono: true }]]), { shut: true }),
      sec("Relationships", [row("Linked question · Why did Feeder 12 fail twice?", { icon: "flask" }), row("Cited by · Board Update — October", { icon: "deck" })].join(""), { shut: true, flush: true }),
      sec("Actions", `<div class="btn-row">${btn("Open")}${btn("Duplicate")}${btn("Delete", { k: "dgr" })}</div>`, { shut: true })
    ].join("") },

    "research-row": { crumbs: [["Project", "project"], ["Research thread", null]], body: [
      sec("Identity", kv([["Title", "Why did Feeder 12 fail twice?"], ["Mode", chip("Question", "a1")], ["Anchor", "Q-14 · Why did Feeder 12 fail twice?"]]) + `<div class="btn-row" style="margin-top:4px">${btn("Open in Research", { k: "pri", icon: "chevR" })}</div>`),
      sec("Provenance", kv([["Created by", who("Ana Reyes", "actor")], ["Revision", "7", { mono: true }], ["Updated", "yesterday", { mono: true }]]), { shut: true }),
      sec("Note", note("Research opens the singleton Research tab with this thread selected. It does not mint a tab of its own — internal selection is view state."))
    ].join("") },

    activity: { crumbs: [["Project", "project"], ["Activity", null]], body: [
      sec("Activity", kv([["Actor", `${av("AR", "a1")} Ana Reyes <span class="note">· user</span>`], ["Action", "edited"], ["Target", "Q3 Resilience Memo"], ["When", "4 minutes ago", { mono: true }]])),
      sec("Details", kv([["Event", "resource.updated", { mono: true }], ["Source ID", "act_2m9…c41", { mono: true }]]), { shut: true }),
      sec("Navigation", `<div class="btn-row">${btn("Open target", { icon: "chevR" })}</div>`)
    ].join("") },

    people: { crumbs: [["Project", "project"], ["People", null]], body: [
      sec("Here now", [row("Ana Reyes", { icon: "eye", sub2: "Q3 Resilience Memo · you", inspect: "actor" }), row("Tomas Kaur", { icon: "eye", sub2: "page 3", inspect: "actor" }), row("Mira Jain", { icon: "eye", sub2: "Outage Cost Model", inspect: "actor" })].join(""), { count: 3, flush: true }),
      sec("Everyone", [row("Ana Reyes", { sub2: "Owner", inspect: "actor" }), row("Mira Jain", { sub2: "Owner", inspect: "actor" }), row("Tomas Kaur", { sub2: "Editor", inspect: "actor" }), row("+4 more", { sub2: "3 editors · 1 viewer", inspect: "actor" })].join(""), { count: 7, flush: true }),
      sec("Note", note("Presence requires an ephemeral collaboration channel. It is never inferred from <code>lastSeenAt</code> or from Activity."))
    ].join("") },

    file: { crumbs: [["Project", "project"], ["NERC-2025-winter-review.pdf", null]], body: [
      sec("File", kv([["Title", "NERC-2025-winter-review.pdf"], ["Type", "PDF"], ["Size", "4.2 MB", { mono: true }], ["Origin", "SharePoint — Ops Reports"]])),
      sec("Extraction", `${chip("Could not read", "err")}` + kv([["Reason", "Scanned document with no text layer"], ["Attempted", "4 days ago", { mono: true }]]) + `<div class="btn-row">${btn("Retry extraction", { icon: "refresh" })}</div>` + note("Nothing in this file is retrievable until text comes out of it.")),
      sec("Connector", kv([["Connector", "SharePoint — Ops Reports"], ["Still syncing", "No — authentication expired"]]), { shut: true })
    ].join("") },

    connector: { crumbs: [["Project", "project"], ["SharePoint — Ops Reports", null]], body: [
      sec("Connection", kv([["Provider", "SharePoint"], ["Display name", "Ops Reports"], ["Status", chip("Authentication expired", "err")]])),
      sec("Scope and delivery", kv([["Scopes", "Sites.Read.All", { mono: true }], ["Delivery", "Scheduled pull, hourly"]])),
      sec("Synchronization", kv([["Last sync", "6 days ago", { mono: true }], ["Error", "Refresh token expired"], ["Files", "312", { mono: true }]])),
      sec("Actions", `<div class="btn-row">${btn("Reconnect", { k: "pri" })}${btn("Sync now", { dis: true })}${btn("Disconnect", { k: "dgr" })}</div>`)
    ].join("") },

    variable: VARIABLE_LENS
  },

  status: () => [
    { t: "4 mentions", tone: "act", icon: "at" },
    { t: "1 connector can't sync", tone: "err", icon: "warn" },
    { t: "24 items", right: true },
    { t: "7 members", right: true }
  ],

  notes: {
    retained: ["<code>contextId</code>, panel widths and collapse", "one typed <code>resource | mention | activity | task | health</code> selection", "<code>resourceQuery</code> and <code>resourceKinds</code>", "<code>centerScrollY</code>"],
    nav: ["Every row dispatches by <code>ProjectItemRef</code>, a UI union — a Research thread is not a <code>ResourceRef</code>.", "Create is a compact vertical list rather than a card row: making a document is one line, not a poster.", "Contexts, Templates, findings, files and connectors resolve into an owning screen or the inspector — never a new editor tab kind."],
    revised: ["Mentions lead. What a person addressed to you is the only interruption worth a permanent place; machine noise moved to Health.", "The Status column is gone. A row is a thing, not a health report.", "Nothing is stale. A document pulls its prompts on load and a formula reads its value when it runs, so no derived state can fall behind and none is painted.", "Every actor is inspectable — person, agent, automation, connector. Hovering an avatar names them; clicking opens them; every “who” in a table is a link.", "A person’s lens can be written to. It is a project comment addressed to them, not email, and the panel says so."],
    gaps: ["Presence needs an ephemeral channel. <code>User.lastSeenAt</code> is not presence and Activity is not presence.", "The mention feed needs a comment-mention query and a per-user read marker; neither is modeled yet.", "<code>Updated by</code> falls back to latest attributable Activity, then an em dash. Not every kind stores an actor.", "Writing to a person needs a project-level comment with no resource anchor. Every current <code>Comment</code> anchors to a resource, so an unanchored one has nowhere to live.", "The hover card is a native tooltip here. A real one needs a portal, because a table and a panel both clip anything drawn inside them."]
  }
};

/* ============================================================
   2 · New Tab
   ============================================================ */
SCREENS["new-tab"] = {
  name: "New Tab",
  path: "docs/screen-specs/new-tab.md",
  purpose:
    "One question: which editor do you need? Three things to make, plus what you already have. Research and Analysis are not here — they are permanent tabs, one click away.",
  init: { ctx: "create", inspect: "blank-doc" },

  center: () => `
    <div class="wrap">
      <div style="max-width:640px;width:100%;margin:calc(var(--u)*8) auto 0">
        <div class="inp is-filled" style="height:44px;font-size:var(--t-body)">${ic("search", 18)}<span class="inp-w" style="color:var(--ink3)">Search ${esc(PROJECT.name)}</span></div>
      </div>

      <div style="display:flex;flex-direction:column;gap:calc(var(--u)*3);align-items:center">
        <div class="chips" style="justify-content:center">
          ${mk("Document", "doc", { inspect: "blank-doc", on: true })}
          ${mk("Slide deck", "deck", { inspect: "blank-deck" })}
          ${mk("Spreadsheet", "sheet", { inspect: "blank-sheet" })}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:calc(var(--u)*3)">
        <div class="hd">
          <div class="hd-m"><span class="eyebrow">Recent</span></div>
          <div class="hd-a">${btn("All", { k: "gh", sm: true })}</div>
        </div>
        <div class="carousel">
          ${[["Q3 Resilience Memo", "Document · 4m", "doc"], ["Board Update — October", "Slide deck · 2h", "deck"], ["Outage Cost Model", "Spreadsheet · 1d", "sheet"], ["Interconnect Failure Review", "Document · 2d", "doc"], ["Substation Inventory", "Spreadsheet · 4d", "sheet"], ["Storm Hardening Options", "Slide deck · 1w", "deck"]]
            .map(([n, m, i]) => `<button class="card" type="button" data-inspect="recent">
              <span class="thumb" style="aspect-ratio:4/3">
                <span class="thumb-l" style="left:12%;top:14%;width:58%;height:9%"></span>
                <span class="thumb-l" style="left:12%;top:30%;width:76%;height:5%"></span>
                <span class="thumb-l" style="left:12%;top:41%;width:68%;height:5%"></span>
                <span class="thumb-l" style="left:12%;top:52%;width:74%;height:5%"></span>
              </span>
              <span class="card-i">${ic(i, 15)}</span>
              <span class="card-t">${n}</span><span class="card-s">${m}</span></button>`).join("")}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:calc(var(--u)*3)">
        <div class="hd">
          <div class="hd-m"><span class="eyebrow">Start from a template</span></div>
          <div class="hd-a">${btn("All templates", { k: "gh", sm: true })}</div>
        </div>
        <div class="carousel">
          ${[["Regulatory filing shell", "Document · 4 variables", "doc"], ["Incident review", "Document · Global", "doc"], ["Board update", "Slide deck · 2 variables", "deck"], ["Cost model skeleton", "Spreadsheet", "sheet"], ["Storm brief", "Document · 3 variables", "doc"], ["Weekly ops deck", "Slide deck", "deck"]]
            .map(([n, m, i]) => `<button class="card" type="button" data-inspect="template">
              <span class="thumb" style="aspect-ratio:4/3">
                <span class="thumb-l" style="left:12%;top:14%;width:58%;height:9%"></span>
                <span class="thumb-l" style="left:12%;top:30%;width:40%;height:5%;background:color-mix(in srgb,var(--ai-b) 30%,transparent)"></span>
                <span class="thumb-l" style="left:12%;top:44%;width:76%;height:30%;background:color-mix(in srgb,var(--ai-b) 16%,transparent)"></span>
              </span>
              <span class="card-i">${ic(i, 15)}</span>
              <span class="card-t">${n}</span><span class="card-s">${m}</span></button>`).join("")}
        </div>
      </div>
    </div>`,

  contexts: () => [
    { id: "create", label: "Create", icon: "plus", body: () =>
      pane("Create", [
        sec("Editors", [row("Document", { icon: "doc", inspect: "blank-doc", on: true }), row("Slide deck", { icon: "deck", inspect: "blank-deck" }), row("Spreadsheet", { icon: "sheet", inspect: "blank-sheet" })].join(""), { flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("Research, Analysis, Context, Templates, Personas and Automations are permanent tabs. They are not created here because they are never not open.")}</div>`
      ].join("")) },

    { id: "recent", label: "Recent", icon: "clock", body: () =>
      pane("Recent", [
        sec("Today", [row("Q3 Resilience Memo", { icon: "doc", right: "4m", inspect: "recent", on: true }), row("Board Update — October", { icon: "deck", right: "2h", inspect: "recent" })].join(""), { flush: true }),
        sec("Yesterday", [row("Outage Cost Model", { icon: "sheet", right: "1d", inspect: "recent" }), row("Why did Feeder 12 fail twice?", { icon: "flask", right: "1d", inspect: "recent" })].join(""), { flush: true }),
        sec("Earlier", [row("Interconnect Failure Review", { icon: "doc", right: "2d", inspect: "recent" }), row("Substation Inventory", { icon: "sheet", right: "4d", inspect: "recent" })].join(""), { flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("Recently opened comes from local tab history; recently updated comes from <code>updatedAt</code>. Neither is a persisted favorite.")}</div>`
      ].join(""), { search: search("Search everything") }) },

    { id: "templates", label: "Templates", icon: "template", body: () =>
      pane("Templates", [
        sec("Document", [row("Regulatory filing shell", { icon: "doc", sub2: "Project · 4 variables", inspect: "template" }), row("Incident review", { icon: "doc", sub2: "Global", inspect: "template" }), row("Storm brief", { icon: "doc", sub2: "Project · 3 variables", inspect: "template" })].join(""), { count: 3, flush: true }),
        sec("Slide deck", [row("Board update", { icon: "deck", sub2: "Project · 2 variables", inspect: "template" }), row("Weekly ops deck", { icon: "deck", sub2: "Project", inspect: "template" })].join(""), { count: 2, flush: true }),
        sec("Spreadsheet", row("Cost model skeleton", { icon: "sheet", sub2: "Project", inspect: "template" }), { count: 1, flush: true })
      ].join(""), { search: search("Search templates"), foot: btn("Open Templates", { k: "gh" }) }) },

    { id: "import", label: "Bring in", icon: "upload", body: () =>
      pane("Bring in", [
        sec("Upload", row("Choose files…", { icon: "upload", sub2: "Extraction starts on arrival", inspect: "upload" }), { flush: true }),
        sec("Your connectors", [row("SharePoint — Ops Reports", { icon: "warn", sub2: "Authentication expired", inspect: "connector-new" }), row("Google Drive — Filings", { icon: "ok", sub2: "Synced 2h ago", inspect: "connector-new" })].join(""), { count: 2, flush: true }),
        sec("Add a connector", [row("SharePoint", { icon: "link", inspect: "connector-new" }), row("Google Drive", { icon: "link", inspect: "connector-new" })].join(""), { flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("Bringing content in is not a way to open an editor, so it lives in the panel rather than competing with the three things this tab exists to make.")}</div>`
      ].join("")) }
  ],

  inspectors: {
    "blank-doc": { crumbs: [["New tab", null], ["Document", null]], body: [
      sec("Identity", `<div class="fld"><span class="fld-k">Title</span><span class="fld-v"><span class="inp is-filled">Untitled document</span></span></div>`),
      sec("Page", kv([["Paper", `<span class="chips">${chip("Letter", "act")}${chip("A4")}</span>`], ["Orientation", `<span class="chips">${chip("Portrait", "act")}${chip("Landscape")}</span>`], ["Margins", "1 in all round"]])),
      sec("Create", `<div class="btn-row">${btn("Create document", { k: "pri", big: true })}</div>` + note("This tab becomes the document. It does not open a second one."))
    ].join("") },

    "blank-deck": { crumbs: [["New tab", null], ["Slide deck", null]], body: [
      sec("Identity", `<div class="fld"><span class="fld-k">Title</span><span class="fld-v"><span class="inp is-filled">Untitled deck</span></span></div>`),
      sec("Format", `<div class="chips">${chip("16:9", "act")}${chip("4:3")}</div>` + note("Asked explicitly. There is no modeled project or user default to fall back to.")),
      sec("First slide", `<div class="thumb" style="max-width:180px"><span class="thumb-l" style="left:12%;top:26%;width:60%;height:12%"></span><span class="thumb-l" style="left:12%;top:46%;width:74%;height:6%"></span></div><span class="note">Title and body</span>`),
      sec("Create", `<div class="btn-row">${btn("Create deck", { k: "pri", big: true })}</div>`)
    ].join("") },

    "blank-sheet": { crumbs: [["New tab", null], ["Spreadsheet", null]], body: [
      sec("Identity", `<div class="fld"><span class="fld-k">Title</span><span class="fld-v"><span class="inp is-filled">Untitled workbook</span></span></div>`),
      sec("Workbook", `<div class="fld"><span class="fld-k">First sheet</span><span class="fld-v"><span class="inp is-filled">Sheet1</span></span></div>`),
      sec("Create", `<div class="btn-row">${btn("Create workbook", { k: "pri", big: true })}</div>`)
    ].join("") },

    recent: { crumbs: [["New tab", null], ["Q3 Resilience Memo", null]], body: [
      sec("Identity", kv([["Title", "Q3 Resilience Memo"], ["Kind", "Document"], ["Updated", "4 minutes ago", { mono: true }], ["Updated by", who("Ana Reyes", "actor")]])),
      sec("Open", `<div class="btn-row">${btn("Open", { k: "pri", big: true, icon: "chevR" })}</div>` + note("Already open in another tab? That tab activates and this launcher closes — <code>resolveLauncher</code> never creates a duplicate target."))
    ].join("") },

    template: { crumbs: [["New tab", null], ["Regulatory filing shell", null]], body: [
      sec("Identity", kv([["Name", "Regulatory filing shell"], ["Target", "Document"], ["Scope", chip("Project", "a2")]])),
      sec("Preview", `<div class="thumb" style="aspect-ratio:4/3"><span class="thumb-l" style="left:12%;top:14%;width:58%;height:9%"></span><span class="thumb-l" style="left:12%;top:30%;width:40%;height:5%;background:color-mix(in srgb,var(--ai-b) 30%,transparent)"></span><span class="thumb-l" style="left:12%;top:44%;width:76%;height:30%;background:color-mix(in srgb,var(--ai-b) 16%,transparent)"></span></div>`),
      sec("Variables it asks for", [row("filingDocket", { icon: "hash", sub2: "Text · required" }), row("filingParty", { icon: "hash", sub2: "Text · required" }), row("outageTable", { icon: "db", sub2: "Table · required" }), row("execSummary", { icon: "spark", sub2: "Generated · optional" })].join(""), { count: 4, flush: true }),
      sec("Create", `<div class="btn-row">${btn("Use template", { k: "pri", big: true, dis: true })}</div>` + gap("Blocked until a body entity can carry a variable key. Nothing in a body currently records which variable it stands for."))
    ].join("") },

    upload: { crumbs: [["New tab", null], ["Upload", null]], body: [
      sec("Files", [row("storm-log-2026-01.csv", { icon: "sheet", sub2: "1.1 MB · text/csv" }), row("feeder-12-relay.pdf", { icon: "folder", sub2: "820 KB · application/pdf" })].join(""), { count: 2, flush: true }),
      sec("Ingestion", `${chip("Uploading 2 of 2", "act")}` + note("Staged upload IDs survive a tab switch. Raw file handles do not survive a reload."))
    ].join("") },

    "connector-new": { crumbs: [["New tab", null], ["SharePoint", null]], body: [
      sec("Provider", kv([["Provider", "SharePoint"], ["Purpose", "Sync a document library into the project as external files"]])),
      sec("Scope", `<div class="chips">${chip("Sites.Read.All", "int")}</div>` + note("Scopes are chosen explicitly, never inferred.")),
      sec("Authentication", `${chip("Expired", "err")}<div class="btn-row" style="margin-top:6px">${btn("Reconnect", { k: "pri" })}</div>` + note("The callback returns to this same launcher tab with its selection restored."))
    ].join("") }
  },

  status: () => [{ t: "Nothing created yet", icon: "info" }, { t: "Document selected", right: true }],

  notes: {
    retained: ["<code>query</code>, selected card or result, scroll", "a discriminated <code>LauncherDraft</code> — never an opaque JSON blob", "Import drafts keep staged upload IDs, never raw file handles"],
    nav: ["<code>resolveLauncher(tabId, target)</code> is atomic and dedupes on the canonical target. If another tab owns it, that tab activates and the launcher closes after transferring its draft.", "The launcher is the one target with no identity, so <code>targetKey()</code> returns <code>undefined</code> and every plus click mints a fresh tab. Open five, get five."],
    revised: ["Create is three pills. Research and Analysis left the centre because they are permanent tabs — offering to create one implied they could be absent.", "Templates and Recent are carousels: a shelf you scan sideways, not a grid that pushes the search field off the top.", "Bring content in and Organize left the centre for the panel. Neither opens an editor, which is the only question this tab asks."],
    gaps: ["The current workbench admits only persisted resource references. A launcher target plus <code>resolveLauncher</code> is a shell prerequisite.", "Template instantiation is blocked until a body entity can carry a variable key."]
  }
};

/* ============================================================
   3 · Document editor
   ============================================================ */
const PAGE_GUTTERS = (n, headerText, body) => `
  <div class="page">
    <div class="pg-head">
      <button class="furn" type="button" data-inspect="header">${headerText}</button>
    </div>
    <div class="pg-body">${body}</div>
    <div class="pg-foot">
      <button class="furn" type="button" data-inspect="footer">
        <span>Docket 2026-114</span><span class="pg-n">${n}</span>
      </button>
    </div>
  </div>`;

SCREENS["document"] = {
  name: "Document editor",
  path: "docs/screen-specs/document-editor.md",
  purpose:
    "Native DocumentBody as a paginated writing surface. Full pages with all four gutters drawn, no toolbars — every property of the thing you selected is in the inspector.",
  init: { ctx: "navigator", inspect: "text-selection" },

  center: () => `
    <div class="pasteboard">
      ${PAGE_GUTTERS(2, "Northwind Grid Resilience — Commission filing", `
        <h1 class="dh1 blk" data-inspect="text-block">Q3 Resilience Memo</h1>
        <p class="dp blk" data-inspect="text-block">Prepared for the Commission filing of
          <span class="atom" data-inspect="formula-atom">14 November 2026</span>. Storm hardening spend to date is
          <span class="atom" data-inspect="formula-atom">$41.2M</span>, against a Q3 authorization of
          <span class="atom" data-inspect="formula-atom">$46.0M</span>.</p>
        <h2 class="dh2 blk" data-inspect="text-block">What the field data shows</h2>
        <p class="dp blk" data-inspect="text-selection">Feeder 12 accounted for
          <span class="dp is-sel" style="display:inline">nearly a third of customer-minutes lost</span> across the three
          storm events, despite serving under four percent of the load.</p>
        <div class="blk" data-inspect="table">
          <table class="tbl" style="border:1px solid var(--bd)">
            <thead><tr><th>Substation</th><th>Events</th><th>Customer-minutes</th></tr></thead>
            <tbody>
              <tr><td>Feeder 12</td><td class="num">3</td><td class="num">1,842,000</td></tr>
              <tr><td>Ward 3</td><td class="num">1</td><td class="num">318,400</td></tr>
              <tr><td>Eastbrook</td><td class="num">2</td><td class="num">602,100</td></tr>
            </tbody>
          </table>
        </div>
        <div class="pblock" data-inspect="prompt-block">
          <div class="pblock-h">${ic("spark", 13)} Prompt block</div>
          <p class="dp" style="margin:0">Across the three storm events, undergrounded segments in Ward 3 lost 38% fewer
            customer-minutes than comparable overhead segments, with the gap widening under sustained icing.</p>
          <span class="note">Read on open · scope: Field reports 2024–25</span>
        </div>`)}
      ${PAGE_GUTTERS(3, "Northwind Grid Resilience — Commission filing", `
        <h2 class="dh2 blk" data-inspect="text-block">Recommendation</h2>
        <p class="dp blk" data-inspect="text-block">Reallocate the unspent Q3 balance to targeted undergrounding on Feeder 12
          rather than to system-wide vegetation cycles. The relay coordination study should be redone before any further
          reconductoring is authorized.</p>
        <h2 class="dh2 blk" data-inspect="text-block">Statutory basis</h2>
        <p class="dp blk" data-inspect="text-block">Filed by
          <span class="atom" data-inspect="formula-atom">Northwind Power</span> under §4.11(b) of the Commission's
          reliability rules, which require a written account of any feeder exceeding three sustained interruptions in a
          rolling twelve months.</p>`)}
    </div>`,

  contexts: () => [
    { id: "navigator", label: "Navigator", icon: "list", body: () =>
      pane("Navigator", [
        `<div class="chips" style="padding:0 calc(var(--u)*3) calc(var(--u)*2)">${chip("Outline", "act")}${chip("Pages")}</div>`,
        sec("Outline", [
          row("Q3 Resilience Memo", { icon: "type", right: "p.1" }),
          row("What the field data shows", { icon: "type", right: "p.2", sub: true, on: true }),
          row("Recommendation", { icon: "type", right: "p.3", sub: true }),
          row("Statutory basis", { icon: "type", right: "p.3", sub: true }),
          row("Appendix — event log", { icon: "type", right: "p.5", sub: true })
        ].join(""), { flush: true }),
        sec("Breaks and furniture", [row("Explicit page break", { icon: "rows", right: "p.4" }), row("Header", { icon: "page", inspect: "header" }), row("Footer", { icon: "page", inspect: "footer" })].join(""), { flush: true, shut: true })
      ].join(""), { search: search("Filter outline") }) },

    { id: "overview", label: "Overview", icon: "info", body: () =>
      pane("Overview", [
        sec("This document", `<div class="fld"><span class="fld-k">Title</span><span class="fld-v"><span class="inp is-filled">Q3 Resilience Memo</span></span></div>` + kv([["Kind", "Document"], ["Pages", "5", { mono: true }], ["Words", "1,204", { mono: true }]])),
        sec("Editing now", [row("Ana Reyes", { icon: "eye", sub2: "page 2 · you", inspect: "actor" }), row("Tomas Kaur", { icon: "eye", sub2: "page 3", inspect: "actor" })].join(""), { count: 2, flush: true }),
        sec("Saved", `${chip("All changes saved", "ok")}` + note("Saving, rebasing, needs review, offline and error use the shared shell language.")),
        sec("From template", kv([["Template", "Regulatory filing shell"]]) + note("Provenance only. Later template edits never reach this document."), { shut: true }),
        sec("Attribution", kv([["Created by", who("Ana Reyes", "actor")], ["Created", "12 Oct 2026", { mono: true }], ["Updated", "just now", { mono: true }]]), { shut: true })
      ].join("")) },

    { id: "find", label: "Find", icon: "search", body: () =>
      pane("Find", [
        sec("Results", [
          row("…lost across the three <b>storm</b> events…", { right: "p.2", sub2: "Body · block b_4f1", on: true }),
          row("…comparable overhead segments under <b>storm</b> icing…", { right: "p.2", sub2: "Prompt block output" }),
          row("…the 2024 <b>storm</b> precedent docket…", { right: "p.5", sub2: "Body · block b_9a2" })
        ].join(""), { count: 3, flush: true })
      ].join(""), { search: search("Find", "storm"), foot: `<span class="inp"><span class="inp-w">Replace with…</span></span>${btn("Replace", { sm: true, dis: true })}` }) },

    { id: "insert", label: "Insert", icon: "plus", body: () =>
      pane("Insert", [
        sec("Basics", [row("Text block", { icon: "type" }), row("Heading", { icon: "type" }), row("List", { icon: "list" }), row("Checklist", { icon: "check" })].join(""), { flush: true }),
        sec("Content", [row("Image", { icon: "img" }), row("Table", { icon: "sheet" }), row("Embed", { icon: "link" })].join(""), { flush: true }),
        sec("Data and AI", [row("Formula", { icon: "sigma" }), row("Prompt block", { icon: "spark" }), row("Variable", { icon: "hash", sub2: "Insert a project variable inline" })].join(""), { flush: true }),
        sec("Structure", [row("Divider row", { icon: "rows" }), row("Explicit page break", { icon: "rows" }), row("Side-by-side row", { icon: "cols" })].join(""), { flush: true, shut: true })
      ].join("")) },

    { id: "styles", label: "Styles", icon: "type", body: () =>
      pane("Styles", [
        sec("Named styles", [
          row("Body", { icon: "type", sub2: "IBM Plex Sans 15/26", inspect: "named-style", on: true }),
          row("Heading 1", { icon: "type", sub2: "IBM Plex Sans 24/32 · 600", inspect: "named-style" }),
          row("Heading 2", { icon: "type", sub2: "IBM Plex Sans 18/28 · 600", inspect: "named-style" }),
          row("Filing caption", { icon: "type", sub2: "IBM Plex Mono 12/16", inspect: "named-style" })
        ].join(""), { count: 4, flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("Font family, size, indentation and line spacing live on a named <code>TextStyle</code> — never as selection-local overrides.")}</div>`
      ].join(""), { search: search("Search styles"), foot: btn("New style", { icon: "plus" }) }) },

    { id: "page", label: "Page", icon: "page", body: () =>
      pane("Page", [
        sec("Paper", kv([["Size", `<span class="chips">${chip("Letter", "act")}${chip("A4")}</span>`], ["Orientation", `<span class="chips">${chip("Portrait", "act")}${chip("Landscape")}</span>`]])),
        sec("Gutters", kv([["Top", "1.00 in", { mono: true }], ["Bottom", "1.00 in", { mono: true }], ["Inside", "1.25 in", { mono: true }], ["Outside", "1.00 in", { mono: true }]]) + note("Drawn on the page as a dashed guide, so what is set here is visible where you write.")),
        sec("Header and footer", kv([["Header", "0.5 in"], ["Footer", "0.5 in"], ["First page differs", `<span class="tog is-on"></span>`]]), { shut: true }),
        sec("Page numbering", kv([["Start at", "1", { mono: true }], ["Position", "Footer, outside"], ["Show on first", `<span class="tog"></span>`]]), { shut: true })
      ].join("")) },

    { id: "variables", label: "Variables", icon: "hash", body: VARIABLES },

    { id: "comments", label: "Comments", icon: "comment", body: () =>
      pane("Comments", [
        `<div class="chips" style="padding:0 calc(var(--u)*3) calc(var(--u)*2)">${chip("Document")}${chip("Page 2", "act")}${chip("Selection")}</div>`,
        sec("Open", [
          row("Mira Jain", { icon: "at", sub2: "“@ana can you confirm 1,842,000…”", right: "2h", inspect: "comment", on: true }),
          row("Mira Jain", { icon: "comment", sub2: "Cite the docket number here.", right: "1d", inspect: "comment" })
        ].join(""), { count: 2, flush: true }),
        sec("Resolved", row("Ana Reyes", { icon: "ok", sub2: "Fixed the units.", right: "3d", inspect: "comment" }), { count: 1, flush: true, shut: true })
      ].join("")) },

    { id: "context", label: "Context", icon: "target", body: () =>
      pane("Context", [
        sec("Available to prompt blocks", [
          row("Field reports 2024–25", { icon: "target", sub2: "96 resources", right: "96", on: true }),
          row("Regulatory corpus", { icon: "target", sub2: "34 resources", right: "34" })
        ].join(""), { count: 2, flush: true }),
        sec("Resolved preview", [row("storm-log-2026-01.csv", { icon: "sheet" }), row("feeder-12-relay.pdf", { icon: "folder" }), row("Ward 3 undergrounding report", { icon: "doc" })].join(""), { count: 96, flush: true, shut: true })
      ].join(""), { foot: btn("Open Context screen", { k: "gh" }) }) }
  ],

  inspectors: {
    "text-selection": { crumbs: [["Document", "document"], ["Text block", "text-block"], ["Selection", null]], body: [
      sec("Selected text", `<div class="quote-v">nearly a third of customer-minutes lost</div>`),
      sec("Marks", `<div class="chips">${chip("<b>B</b> Bold", "act")}${chip("<i>I</i> Italic")}${chip("<u>U</u> Underline")}${chip("S Strike")}${chip("Code")}</div><div class="btn-row" style="margin-top:8px">${btn("Add link", { icon: "link" })}${btn("Comment", { icon: "comment" })}</div>`),
      sec("Text style", kv([["Named style", "Body"], ["Applies to", "38 characters"]]) + note("Changing family, size or spacing edits the named style rather than pretending it is a local override."))
    ].join("") },

    "text-block": { crumbs: [["Document", "document"], ["Text block", null]], body: [
      sec("Text", `<div class="quote-v">What the field data shows</div>`),
      sec("Variant", `<div class="chips">${chip("Body")}${chip("Heading 1")}${chip("Heading 2", "act")}${chip("Quote")}${chip("Code")}</div>`),
      sec("Block format", kv([["Alignment", `<span class="chips">${chip("Left", "act")}${chip("Center")}${chip("Right")}</span>`], ["Space before", "12 pt", { mono: true }], ["Space after", "6 pt", { mono: true }]])),
      sec("Placement", kv([["Row", "1 block of 1"], ["Page", "2 (computed)"]]) + note("A computed page has no ID. It is a label for where this block currently lands."), { shut: true })
    ].join("") },

    "formula-atom": { crumbs: [["Document", "document"], ["Text block", "text-block"], ["Formula", null]], body: [
      sec("Shows", `<div class="quote-v">$46.0M</div>`),
      sec("Formula", `<div class="inp is-filled" style="font-family:var(--mono);font-size:var(--t-mono)"><span class="inp-w">=hardeningBudget</span></div>` + `<div class="btn-row" style="margin-top:6px">${btn("Open variable", { icon: "hash", sm: true, inspect: "variable" })}</div>`),
      sec("Value", kv([["Type", "number", { mono: true }], ["Read", "on open, and on every change", { mono: true }]]) + note("A formula reads its value when it runs, so what is on the page is what the variable holds. There is no cached copy to fall behind.")),
      sec("Format", kv([["Display", "$#,##0.0,,\"M\"", { mono: true }]]), { shut: true })
    ].join("") },

    table: { crumbs: [["Document", "document"], ["Table", null]], body: [
      sec("Size", kv([["Rows", "4 (1 header)", { mono: true }], ["Columns", "3", { mono: true }], ["Column widths", "48% · 20% · 32%", { mono: true }]])),
      sec("Structure", [row("Header row", { icon: "rows" }), row("Body rows", { icon: "rows", right: "3" })].join(""), { flush: true, shut: true }),
      sec("Actions", `<div class="btn-row">${btn("Insert row", { sm: true })}${btn("Insert column", { sm: true })}${btn("Delete table", { sm: true, k: "dgr" })}</div>`)
    ].join("") },

    "prompt-block": { crumbs: [["Document", "document"], ["Prompt block", null]], body: [
      sec("Prompt", `<div class="inp is-filled" style="height:auto;padding:8px;align-items:flex-start"><span class="inp-w" style="white-space:normal">Compare undergrounded and overhead segment performance across the three storm events.</span></div>`),
      sec("Output", `<div class="quote-v" style="border-color:var(--ai-b);background:var(--ai-s)">Across the three storm events, undergrounded segments in Ward 3 lost 38% fewer customer-minutes…</div><div class="btn-row" style="margin-top:8px">${btn("Run again", { icon: "refresh", k: "ai" })}${btn("Copy out", { icon: "copy" })}</div>` + note("Read on open. The block runs when the document is opened, so what you see is generated against the project as it is now.")),
      sec("Scope", row("Field reports 2024–25", { icon: "target", right: "96" }), { flush: true }),
      sec("Provenance", kv([["Last run", "on open", { mono: true }], ["Model", "analyst-default", { mono: true }]]), { shut: true })
    ].join("") },

    header: { crumbs: [["Document", "document"], ["Header", null]], body: [
      sec("Header", `<div class="quote-v">Northwind Grid Resilience — Commission filing</div>`),
      sec("Spacing", kv([["From top", "0.5 in", { mono: true }], ["Height", "0.76 in", { mono: true }]])),
      sec("First page", kv([["Differs", `<span class="tog is-on"></span>`], ["First-page header", "Empty"]])),
      sec("Editing", note("Each furniture path has one canonical editor. Its appearance on every page is a read-only projection of that one state."))
    ].join("") },

    footer: { crumbs: [["Document", "document"], ["Footer", null]], body: [
      sec("Footer", `<div class="quote-v">Docket 2026-114 &nbsp;&nbsp;&nbsp;&nbsp; 2</div>`),
      sec("Page number", kv([["Position", "Outside"], ["Start at", "1", { mono: true }], ["Show on first", `<span class="tog"></span>`]]) + note("Generated from page-number settings, never typed as content.")),
      sec("Spacing", kv([["From bottom", "0.5 in", { mono: true }]]), { shut: true })
    ].join("") },

    "link-mark": { crumbs: [["Document", "document"], ["Selection", "text-selection"], ["Link", null]], body: [
      sec("Link", kv([["URL", "https://nerc.gov/docket/2026-114", { mono: true }], ["Text", "the 2026 docket"]])),
      sec("Actions", `<div class="btn-row">${btn("Open")}${btn("Copy")}${btn("Remove", { k: "dgr" })}</div>`)
    ].join("") },

    "named-style": { crumbs: [["Document", "document"], ["Styles", null], ["Body", null]], body: [
      sec("Identity", kv([["Name", "Body"], ["Based on", "Default"]])),
      sec("Typography", kv([["Family", "IBM Plex Sans"], ["Size", "15 pt", { mono: true }], ["Line height", "26 pt", { mono: true }], ["Weight", "400", { mono: true }]])),
      sec("Spacing", kv([["Space after", "8 pt", { mono: true }], ["Indent", "0 in", { mono: true }]]), { shut: true }),
      sec("Usage", note("Applied to 41 blocks in this document."), { shut: true })
    ].join("") },

    comment: { crumbs: [["Document", "document"], ["Comment", null]], body: [
      sec("Thread", `<div class="chips">${chip("Open", "warn")}${chip("Mentions you", "act")}</div>` + kv([["Started by", "Mira Jain"], ["When", "2 hours ago", { mono: true }]])),
      sec("Comment", `<div class="quote-v">“@ana can you confirm 1,842,000 against the relay log? The event log says 1,840,200.”</div>`),
      sec("Anchored to", `<div class="quote-v">nearly a third of customer-minutes lost</div>`),
      sec("Replies", row("Ana Reyes · Checking against the relay log.", { icon: "comment", right: "1h" }), { count: 1, flush: true }),
      sec("Actions", `<div class="btn-row">${btn("Reply", { k: "pri" })}${btn("Resolve")}</div>`)
    ].join("") },

    document: { crumbs: [["Document", null]], body: [
      sec("This document", `<div class="fld"><span class="fld-k">Title</span><span class="fld-v"><span class="inp is-filled">Q3 Resilience Memo</span></span></div>` + kv([["Pages", "5", { mono: true }], ["Words", "1,204", { mono: true }], ["Saved", chip("All changes saved", "ok")]])),
      sec("Nothing selected", note("Click a block, a formula, the header or the footer to change it. Insert is in the panel.")),
      sec("Page setup", kv([["Paper", "Letter"], ["Gutters", "1.00 / 1.00 / 1.25 / 1.00 in", { mono: true }]]), { shut: true }),
      sec("Attribution", kv([["Created by", who("Ana Reyes", "actor")], ["Updated", "just now", { mono: true }]]), { shut: true })
    ].join("") },

    variable: VARIABLE_LENS
  },

  status: () => [
    { t: "All changes saved", tone: "ok", icon: "ok" },
    { t: "38 characters selected", icon: "type" },
    { t: "Page 2 of 5", right: true },
    { t: "1,204 words", right: true },
    { t: "100%", right: true }
  ],

  notes: {
    retained: ["<code>zoom</code> and <code>findQuery</code> survive a reload", "<code>scrollAnchor</code> and <code>selection</code> are dropped — a position into a document that may have changed means nothing on restore", "ProseMirror views, canonical furniture editors, undo history, IME state and pending ops live in the tab runtime"],
    nav: ["Find is a context view, not a dialog.", "Only user-origin ProseMirror transactions become outbound operations; accepted-local, remote and display-refresh origins cannot echo back as new edits.", "Header and footer furniture has one canonical editor; repeated page appearances are read-only projections of it."],
    revised: ["The resource header and the formatting toolbar are gone. Identity moved to the Overview panel; every property moved to the inspector, which is where the selected thing already lives.", "The ruler is gone. Gutters are drawn on the page itself — a dashed guide on all four sides — so the margin is visible where you write rather than measured above it.", "Pages are always full height, including one that only holds two paragraphs.", "Text selection shows the selected text. Offsets and atom counts were internals and are gone.", "No stale state on formulas or prompts. Both read when they run."],
    gaps: ["Natural pages are computed views. “Page 3” is a label, not an object with an ID.", "Removing the toolbar makes the inspector load-bearing for every formatting action: it must be reachable by keyboard and must never be the only path to an essential command."]
  }
};
