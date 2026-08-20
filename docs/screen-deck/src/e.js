
/* ============================================================
   7 · Analysis
   ============================================================ */
SCREENS["analysis"] = {
  name: "Analysis",
  path: "docs/screen-specs/analysis.md",
  purpose:
    "Drop a field on an axis and see a chart. Project variables are just variables — there is no root table and no join step to get through first. If two fields cannot be related, the screen says so and offers the fix.",
  init: { ctx: "overview", inspect: "placement", mode: "one" },
  modes: [["one", "One analysis", "This one"], ["library", "All analyses", "All"]],

  center: (s) => s.mode === "library" ? `
    <div class="wrap">
      <div class="hd">
        <div class="hd-m"><h1 class="hd-t">Analysis</h1>
          <span class="hd-s">Every chart built on this project's variables. One Analysis tab — which one you are on is view state.</span></div>
        <div class="hd-a">${btn("New analysis", { icon: "plus", k: "pri" })}</div>
      </div>
      <div class="chips">
        <span style="flex:1;min-width:180px;max-width:300px">${search("Search analyses")}</span>
        ${chip("All", "act")}${chip("Charts")}${chip("Tables")}
      </div>
      <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">
        ${[["Outage minutes by substation", "Bar · 6 of 41 rows", true], ["Cost per avoided minute", "Bar · 41 rows"], ["Events by month", "Line · 24 rows"], ["Spend against authorization", "Table · 4 rows"]]
          .map(([n, m, on]) => `<button class="card${on ? " is-on" : ""}" type="button" data-inspect="analysis">
            <span class="thumb" style="aspect-ratio:4/3;display:flex;align-items:flex-end;gap:6px;padding:12px">
              <span style="flex:1;height:38%;background:var(--int-f);border-radius:2px 2px 0 0"></span>
              <span style="flex:1;height:66%;background:var(--int-f);border-radius:2px 2px 0 0"></span>
              <span style="flex:1;height:92%;background:var(--act-f);border-radius:2px 2px 0 0"></span>
              <span style="flex:1;height:52%;background:var(--int-f);border-radius:2px 2px 0 0"></span>
            </span>
            <span class="card-t">${n}</span><span class="card-s">${m}</span></button>`).join("")}
      </div>
      ${note("Nothing about a result is stored. Opening one runs it again against the variables as they are now.")}
    </div>` : `
    <div class="shead">
      <span class="shead-t">Outage minutes by substation</span>
      <div class="shead-r">${chip("Saved", "ok")}${btn("Duplicate", { sm: true })}</div>
    </div>
    <div class="wrap" style="padding-top:calc(var(--u)*5)">
      <div class="plot" data-inspect="display">
        <div class="hd">
          <div class="hd-m"><span class="card-t" style="font-size:var(--t-lg)">Customer-minutes by substation, 2026 storms</span></div>
          <div class="hd-a"><div class="chips">${chip("Table")}${chip("Bar", "act")}${chip("Line")}${chip("Area")}${chip("Scatter")}${chip("Pie")}</div></div>
        </div>
        <div class="bars">
          ${[["Feeder 12", 100, true], ["Eastbrook", 33], ["Harlow", 24], ["Ward 3", 17], ["Millbrook", 12], ["Deering", 9]]
            .map(([n, h, on]) => `<span class="bar-g${on ? " is-on" : ""}" data-inspect="mark"><span class="bar" style="height:${h}%"></span><span class="bar-l">${n}</span></span>`).join("")}
        </div>
        <div class="chips">
          <span class="note">Generated from current data — the result itself is not stored.</span>
          <span style="margin-inline-start:auto" class="note">Showing 6 of 41 · limit 10</span>
        </div>
      </div>

      <div class="drops">
        <div class="drop" data-inspect="placement">
          <span class="drop-k">X — across</span>
          <div class="chips"><button class="pill t-dim" type="button" data-inspect="placement">${ic("hash", 11)} substations.name</button></div>
        </div>
        <div class="drop" data-inspect="placement">
          <span class="drop-k">Y — up</span>
          <div class="chips">
            <button class="pill is-on" type="button" data-inspect="placement">${ic("sigma", 11)} sum of customerMinutes</button>
            <button class="pill" type="button" data-inspect="placement">${ic("sigma", 11)} count of eventId</button>
          </div>
        </div>
        <div class="drop" data-inspect="filter">
          <span class="drop-k">Filters</span>
          <div class="chips">
            <button class="pill" type="button" data-inspect="filter">${ic("filter", 11)} eventDate ≥ 2026-01-01</button>
            <span class="drop-e">drop a field to filter by it</span>
          </div>
        </div>
        <div class="drop" data-inspect="sort">
          <span class="drop-k">Sort</span>
          <div class="chips"><button class="pill" type="button" data-inspect="sort">${ic("sort", 11)} sum of customerMinutes, high to low</button></div>
        </div>
        <div class="drop" data-inspect="limit">
          <span class="drop-k">Limit</span>
          <div class="chips"><button class="pill" type="button" data-inspect="limit">${ic("filter", 11)} top 10</button></div>
        </div>
        <div class="drop">
          <span class="drop-k">Colour</span>
          <span class="drop-e">this chart doesn't need one — drop a field to split the bars</span>
        </div>
      </div>

      <div class="issue">
        <span class="row-i">${ic("warn", 16)}</span>
        <span style="flex:1;min-width:0">
          <span class="card-t">Two variables, no relationship</span><br>
          <span class="card-s">You dropped <b>substations.name</b> and <b>outageEvents.customerMinutes</b>. They line up on
          <b>subId → id</b>, which is what this chart is using. Change it, or pick a different pairing.</span>
        </span>
        ${btn("Change the match", { sm: true, inspect: "issue" })}
      </div>
    </div>`,

  contexts: (s) => s.mode === "library" ? [
    { id: "analyses-l", label: "Analyses", icon: "chart", body: () =>
      pane("Analyses", sec("In this project", [
        row("Outage minutes by substation", { icon: "chart", sub2: "Bar · run 2m ago", inspect: "analysis", on: true }),
        row("Cost per avoided minute", { icon: "chart", sub2: "Bar · run yesterday", inspect: "analysis" }),
        row("Events by month", { icon: "activity", sub2: "Line · run 3d ago", inspect: "analysis" }),
        row("Spend against authorization", { icon: "sheet", sub2: "Table · run 1w ago", inspect: "analysis" })
      ].join(""), { count: 4, flush: true }), { actions: `${btn("New", { icon: "plus", sm: true, k: "pri" })}${btn("Open", { sm: true, act: "mode:one" })}${btn("Duplicate", { icon: "copy", sm: true })}`, search: search("Search analyses") }) },
    { id: "variables", label: "Variables", icon: "db", body: VARIABLES }
  ] : [
    { id: "overview", label: "Overview", icon: "info", body: () =>
      pane("Overview", [
        sec("This analysis", `<div class="fld"><span class="fld-k">Title</span><span class="fld-v"><span class="inp is-filled">Outage minutes by substation</span></span></div><div class="fld" style="margin-top:6px"><span class="fld-k">Description</span><span class="fld-v"><span class="inp is-filled">Storm-season load on the worst substations.</span></span></div>`),
        sec("Saved", `${chip("Saved · revision 12", "ok")}` + note("Revision-CAS current state. Undo covers unsaved builder actions only — there is no durable change-set history here.")),
        sec("Result", kv([["Rows", "6 of 41", { mono: true }], ["Limit", "10", { mono: true }], ["Evaluated", "2 minutes ago", { mono: true }]]) + note("Replaceable projections, not resources. Nothing about the result is stored.")),
        sec("Attribution", kv([["Created by", who("Mira Jain", "actor")], ["Updated", "2 minutes ago", { mono: true }]]), { shut: true })
      ].join(""), { actions: btn("Run again", { icon: "play", sm: true, k: "pri" }) }) },

    { id: "variables", label: "Variables", icon: "db", body: () =>
      pane("Variables", [
        sec("Tables", [
          row("outageEvents", { icon: "db", sub2: "4,182 rows", inspect: "variable", on: true }),
          row("eventId", { sub2: "text", sub: true }),
          row("subId", { sub2: "text", sub: true }),
          row("eventDate", { sub2: "date", sub: true }),
          row("customerMinutes", { sub2: "number", sub: true }),
          row("substations", { icon: "db", sub2: "41 rows", inspect: "variable" }),
          row("id", { sub2: "text", sub: true }),
          row("name", { sub2: "text", sub: true }),
          row("undergroundPct", { sub2: "number", sub: true })
        ].join(""), { count: 2, flush: true }),
        sec("Values", [row("hardeningBudget", { icon: "sigma", sub2: "number", inspect: "variable" }), row("filingDeadline", { icon: "calendar", sub2: "date", inspect: "variable" })].join(""), { count: 2, flush: true }),
        sec("Functions", row("avoidedMinutes(t)", { icon: "wrench", sub2: "not a chart input", inspect: "variable" }), { count: 2, flush: true, shut: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("Drag a field onto an axis, a filter or a sort. Every drop also has an Add menu and a keyboard path — nothing here is drag-only.")}</div>`
      ].join(""), { search: search("Search variables") }) },

    { id: "chart", label: "Chart", icon: "chart", body: () =>
      pane("Chart", `<div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(94px,1fr))">
        ${card("Table", "", { icon: "sheet", inspect: "display" })}
        ${card("Bar", "", { icon: "chart", inspect: "display", on: true })}
        ${card("Line", "", { icon: "activity", inspect: "display" })}
        ${card("Area", "", { icon: "activity", inspect: "display" })}
        ${card("Scatter", "", { icon: "scope", inspect: "display" })}
        ${card("Pie", "", { icon: "scope", inspect: "display" })}
      </div>` + `<div style="padding-top:calc(var(--u)*3)">${note("Table is the safe default. Picking a kind that needs another field adds an empty drop zone for it rather than failing.")}</div>`) },

    { id: "shelves", label: "Fields", icon: "sliders", body: () =>
      pane("Fields", [
        sec("X — across", row("substations.name", { icon: "hash", inspect: "placement" }), { count: 1, flush: true }),
        sec("Y — up", [row("sum of customerMinutes", { icon: "sigma", inspect: "placement", on: true }), row("count of eventId", { icon: "sigma", inspect: "placement" })].join(""), { count: 2, flush: true }),
        sec("Filters", row("eventDate ≥ 2026-01-01", { icon: "filter", inspect: "filter" }), { count: 1, flush: true }),
        sec("Sort", row("sum of customerMinutes, high to low", { icon: "sort", inspect: "sort" }), { count: 1, flush: true }),
        sec("Limit", row("top 10", { icon: "filter", inspect: "limit" }), { count: 1, flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${gap("Filters and sorts have no stable IDs in the model yet, so the UI cannot promise durable selection or collaboration on each one.")}</div>`
      ].join("")) },

    { id: "formula", label: "Formula", icon: "sigma", body: () =>
      pane("Formula", [
        sec("Compiled", `<div class="inp is-filled" style="height:auto;padding:8px;align-items:flex-start;font-family:var(--mono);font-size:var(--t-mono)"><span class="inp-w" style="white-space:pre-wrap">=SORT(LIMIT(GROUPBY(
   RELATE(outageEvents, substations, "subId", "id"),
   ["substations.name"],
   [SUM("customerMinutes"), COUNT("eventId")]
 ), 10), 2, "desc")</span></div>` + note("Read-only. Editing it would break round-tripping, so it is a diagnostic rather than a second way to author.")),
        sec("Evaluation", kv([["Ran", "2 minutes ago", { mono: true }], ["Rows", "6 of 41", { mono: true }], ["Duration", "0.4 s", { mono: true }]]), { shut: true })
      ].join("")) }
  ],

  inspectors: {
    placement: { crumbs: [["Analysis", "analysis"], ["Y", null], ["sum of customerMinutes", null]], body: [
      sec("Field", kv([["From", "outageEvents", { mono: true }], ["Field", "customerMinutes", { mono: true }], ["Type", "number", { mono: true }]])),
      sec("Summarise by", `<div class="chips">${chip("Each value")}${chip("Sum", "act")}${chip("Count")}${chip("Average")}${chip("Minimum")}${chip("Maximum")}</div>`),
      sec("Label", `<div class="inp is-filled"><span class="inp-w">Customer-minutes</span></div>`),
      sec("Actions", `<div class="btn-row">${btn("Move to X", { sm: true })}${btn("Move to Filters", { sm: true })}${btn("Remove", { sm: true, k: "dgr" })}</div>`)
    ].join("") },

    variable: { crumbs: [["Analysis", "analysis"], ["Variables", null], ["outageEvents", null]], body: [
      sec("Variable", kv([["Name", "outageEvents", { mono: true }], ["Type", "table", { mono: true }], ["Rows", "4,182", { mono: true }]])),
      sec("Value", `<div class="tbl-w"><div class="tbl-c"><table class="tbl"><thead><tr><th>eventId</th><th>subId</th><th>customerMinutes</th></tr></thead><tbody><tr><td class="num">E-8841</td><td class="num">S-12</td><td class="num">612,400</td></tr><tr><td class="num">E-8842</td><td class="num">S-12</td><td class="num">704,900</td></tr><tr><td class="num">E-8843</td><td class="num">S-03</td><td class="num">318,400</td></tr></tbody></table></div></div><span class="note">3 of 4,182 rows</span>`),
      sec("Relates to", row("substations · subId → id", { icon: "branch", sub2: "Used by this chart", inspect: "issue" }), { count: 1, flush: true }),
      sec("Use", `<div class="btn-row">${btn("Put on X", { sm: true })}${btn("Put on Y", { sm: true })}</div>`)
    ].join("") },

    issue: { crumbs: [["Analysis", "analysis"], ["Relationship", null]], body: [
      sec("Why you are seeing this", note("<b>substations.name</b> and <b>outageEvents.customerMinutes</b> live in different variables. A chart needs to know which rows belong together.")),
      sec("Currently matching on", kv([["Left", "outageEvents.subId", { mono: true }], ["Right", "substations.id", { mono: true }], ["Keep rows", `<span class="chips">${chip("With a match", "act")}${chip("All on the left")}${chip("All on the right")}${chip("All of both")}</span>`]])),
      sec("Other ways they line up", row("outageEvents.regionId → substations.regionId", { icon: "branch", sub2: "Matches 41 of 41 rows" }), { count: 1, flush: true }),
      sec("Actions", `<div class="btn-row">${btn("Use this", { k: "pri", sm: true })}${btn("Match on something else", { sm: true })}</div>` + note("Stated as a fix, not a modelling step. The relationship exists so a chart can be drawn, and appears only when two variables are actually in play."))
    ].join("") },

    filter: { crumbs: [["Analysis", "analysis"], ["Filters", null], ["eventDate", null]], body: [
      sec("Filter", kv([["Field", "outageEvents.eventDate", { mono: true }], ["Keep rows where", `<span class="chips">${chip("is")}${chip("is not")}${chip("≥", "act")}${chip("≤")}${chip("between")}</span>`], ["Value", "2026-01-01", { mono: true }]])),
      sec("Effect", note("4,182 rows in, 2,904 kept.")),
      sec("Actions", `<div class="btn-row">${btn("Remove", { sm: true, k: "dgr" })}</div>`),
      sec("Types", gap("Type-appropriate value controls wait on a column-schema and type-inference contract for heterogeneous table values."), { shut: true })
    ].join("") },

    sort: { crumbs: [["Analysis", "analysis"], ["Sort", null]], body: [
      sec("Sort by", kv([["Field", "sum of customerMinutes"], ["Direction", `<span class="chips">${chip("Low to high")}${chip("High to low", "act")}</span>`]]) + note("A sort targets what is on an axis, aggregation included — never a bare source field.")),
      sec("Actions", `<div class="btn-row">${btn("Remove", { sm: true, k: "dgr" })}</div>`)
    ].join("") },

    limit: { crumbs: [["Analysis", "analysis"], ["Limit", null]], body: [
      sec("Limit", kv([["Keep", "top 10", { mono: true }], ["Of", "41 groups", { mono: true }]])),
      sec("Note", note("Shown next to the chart so a truncated view is never mistaken for the whole.")),
      sec("Actions", `<div class="btn-row">${btn("Remove", { sm: true, k: "dgr" })}</div>`)
    ].join("") },

    display: { crumbs: [["Analysis", "analysis"], ["Chart", null]], body: [
      sec("Kind", `<div class="chips">${chip("Table")}${chip("Bar", "act")}${chip("Line")}${chip("Area")}${chip("Scatter")}${chip("Pie")}</div>`),
      sec("Title", `<div class="inp is-filled"><span class="inp-w">Customer-minutes by substation, 2026 storms</span></div>`),
      sec("Axes", kv([["X label", "Substation"], ["Y label", "Customer-minutes"], ["Y starts at zero", `<span class="tog is-on"></span>`], ["Stacked", `<span class="tog"></span>`]])),
      sec("Legend", `<div class="chips">${chip("None")}${chip("Right", "act")}${chip("Bottom")}</div>`, { shut: true }),
      sec("Colours", `<div class="chips">${chip("&nbsp;", "int")}${chip("&nbsp;", "act")}${chip("&nbsp;", "a2")}${chip("&nbsp;", "a1")}</div>`, { shut: true }),
      sec("Not yet modeled", gap("Colour, size, detail, label and tooltip are not persisted encodings in <code>AnalysisDefinition</code>. The empty Colour zone in the centre is a proposal, not something that can be saved today."))
    ].join("") },

    mark: { crumbs: [["Analysis", "analysis"], ["Chart", "display"], ["Feeder 12", null]], body: [
      sec("This bar", kv([["substations.name", "Feeder 12"], ["sum of customerMinutes", "1,842,000", { mono: true }], ["count of eventId", "3", { mono: true }]])),
      sec("Underneath", row("3 rows in outageEvents", { icon: "db", sub2: "E-8841, E-8842, E-8877", inspect: "variable" }), { flush: true }),
      sec("Actions", `<div class="btn-row">${btn("Filter to this", { sm: true })}${btn("Exclude", { sm: true })}</div>`)
    ].join("") },

    analysis: { crumbs: [["Analysis", null]], body: [
      sec("This analysis", `<div class="fld"><span class="fld-k">Title</span><span class="fld-v"><span class="inp is-filled">Outage minutes by substation</span></span></div>` + kv([["Saved", chip("Saved · revision 12", "ok")]])),
      sec("Nothing selected", note("Drag a field from Variables onto X or Y. Click a bar to see what is underneath it.")),
      sec("Result", kv([["Rows", "6 of 41", { mono: true }], ["Evaluated", "2 minutes ago", { mono: true }]]), { shut: true })
    ].join("") }
  },

  status: () => [
    { t: "Saved", tone: "ok", icon: "ok" },
    { t: "sum of customerMinutes selected", icon: "sigma" },
    { t: "6 of 41 rows · limit 10", right: true },
    { t: "Evaluated 2m ago", right: true }
  ],

  notes: {
    retained: ["selected placement, filter, sort or mark; result scroll and zoom", "axes, filters, sorts and display live in <code>AnalysisBody</code> — persisted model state, never duplicated into view state", "evaluator caches and drag previews stay in the tab runtime"],
    nav: ["Any non-function variable can normalise to a table and be charted. Functions are visible but never inputs.", "The compiled formula is a read-only diagnostic; editing it would break round-tripping."],
    revised: ["Inputs, joins and Root are gone. Variables are variables — you drop a field and the chart appears, with no modelling step in front of it.", "The chart is centred at the top, before any control, because it is the thing being made.", "Shelves became X, Y, Filters, Sort, Limit — plus a Colour zone that appears only when a chart kind can use one.", "A relationship is stated as a problem to solve, only when two variables are actually in play: “Two variables, no relationship”, with the match it picked and the alternatives."],
    gaps: ["No persisted colour, size, detail, label or tooltip encodings.", "Filters and sorts have no stable IDs.", "Automatic relationship discovery — “they line up on subId → id” — needs a real key-inference contract, or it becomes a guess presented as a fact.", "Chart-kind minimum-field rules need defining before an empty zone can appear only when it is genuinely needed."]
  }
};

/* ============================================================
   8 · Context
   ============================================================ */
SCREENS["context"] = {
  name: "Context",
  path: "docs/screen-specs/context.md",
  purpose:
    "A saved scope, said plainly: what is in, what is taken out, and the resources that survive. The rule stays live — a document created tomorrow is included without editing anything.",
  init: { ctx: "overview", inspect: "resource-set", mode: "one" },
  modes: [["one", "One Context", "This one"], ["library", "All Contexts", "All"]],

  center: (s) => s.mode === "library" ? `
    <div class="wrap">
      <div class="hd">
        <div class="hd-m"><h1 class="hd-t">Context</h1>
          <span class="hd-s">Saved scopes. Each is a live rule — what matches it today is what an agent can look at today.</span></div>
        <div class="hd-a">${btn("New Context", { icon: "plus", k: "pri" })}</div>
      </div>
      <div class="chips"><span style="flex:1;min-width:180px;max-width:300px">${search("Search Contexts")}</span></div>
      ${table(["Name", "The rule, in words", "Contains", "Retrievable", "Used by"], [
        { on: true, inspect: "resource-set", cells: [
          { h: `<span class="cellname"><span class="row-i">${ic("pin")}</span>Everything but drafts</span>` },
          { h: "Everything in the project, minus templates" }, { h: "211", cls: "num" }, { h: "88", cls: "num" }, { h: "2 agents" } ] },
        { inspect: "resource-set", cells: [
          { h: `<span class="cellname"><span class="row-i">${ic("target")}</span>Regulatory corpus</span>` },
          { h: "Documents, and the Filings set" }, { h: "34", cls: "num" }, { h: "34", cls: "num" }, { h: "1 agent · 1 automation" } ] },
        { inspect: "resource-set", cells: [
          { h: `<span class="cellname"><span class="row-i">${ic("target")}</span>Field reports 2024–25</span>` },
          { h: "12 chosen resources, and everything SharePoint syncs" }, { h: "96", cls: "num" }, { h: "88", cls: "num" }, { h: "1 agent · 3 prompts" } ] },
        { inspect: "resource-set", cells: [
          { h: `<span class="cellname"><span class="row-i" style="color:var(--warn-t)">${ic("warn")}</span>Storm precedents</span>` },
          { h: "Nothing matches it right now" }, { h: "0", cls: "num" }, { h: "0", cls: "num" }, { h: "—" } ] }
      ])}
      ${gap("A Context matching nothing cannot be used to narrow a search — an empty scope currently means the whole project, so it would widen rather than narrow.")}
    </div>` : `
    <div class="shead">
      <span class="shead-t">Everything but drafts</span>
      <div class="shead-r">${chip("Saved", "ok")}<span class="note">211 resources</span>${btn("Duplicate", { sm: true })}${btn("Delete", { sm: true, k: "dgr", dis: true })}</div>
    </div>
    <div class="wrap is-wide" style="padding-top:calc(var(--u)*5)">
      <div class="halves">
        <div class="half is-in">
          <div class="half-h">
            <span class="half-t">${ic("plus", 13)} Include</span>
            <span class="note">248 resources</span>
            <span style="margin-inline-start:auto">${btn("Add", { icon: "plus", sm: true })}</span>
          </div>
          <div class="half-b">
            ${row("Everything in this project", { icon: "scope", sub2: "Including anything created later", right: "248", inspect: "include-project", on: true })}
            ${row("Regulatory corpus", { icon: "target", sub2: "Another saved Context, at its current contents", right: "34", inspect: "include-set" })}
          </div>
        </div>

        <span class="minus" aria-hidden="true">${ic("minus", 15)}</span>

        <div class="half is-out">
          <div class="half-h">
            <span class="half-t">${ic("minus", 13)} Take out</span>
            <span class="note">37 resources</span>
            <span style="margin-inline-start:auto">${btn("Add", { icon: "plus", sm: true })}</span>
          </div>
          <div class="half-b">
            ${row("Every template", { icon: "template", sub2: "By kind", right: "37", inspect: "exclude-kind" })}
          </div>
        </div>
      </div>

      <div>
        <div class="chips" style="margin-bottom:calc(var(--u)*3)">
          <span class="eyebrow">What that leaves — 211 resources, right now</span>
          <span style="flex:1;min-width:140px;max-width:260px">${search("Filter")}</span>
          ${chip("All kinds", "act")}${chip("Problems only")}
        </div>
        ${table(["Name", "Kind", "In because", "Updated"], [
          { on: true, inspect: "resolved", cells: [
            { h: `<span class="cellname"><span class="row-i">${ic("doc")}</span>Q3 Resilience Memo</span>` }, { h: "Document" }, { h: "Everything in this project" }, { h: "4m", cls: "num" } ] },
          { inspect: "resolved", cells: [
            { h: `<span class="cellname"><span class="row-i">${ic("deck")}</span>Board Update — October</span>` }, { h: "Slide deck" }, { h: "Everything in this project" }, { h: "2h", cls: "num" } ] },
          { inspect: "resolved", cells: [
            { h: `<span class="cellname"><span class="row-i">${ic("sheet")}</span>Outage Cost Model</span>` }, { h: "Spreadsheet" }, { h: "Everything in this project" }, { h: "1d", cls: "num" } ] },
          { inspect: "resolved", cells: [
            { h: `<span class="cellname"><span class="row-i">${ic("folder")}</span>NERC-2025-winter-review.pdf</span>` }, { h: "External file" }, { h: "Regulatory corpus" }, { h: "4d", cls: "num" } ] },
          { inspect: "resolved", cells: [
            { h: `<span class="cellname"><span class="row-i">${ic("folder")}</span>feeder-12-relay.pdf</span>` }, { h: "External file" }, { h: "Regulatory corpus · via SharePoint" }, { h: "6d", cls: "num" } ] },
          { inspect: "resolved", cells: [
            { h: `<span class="cellname"><span class="row-i">${ic("quote")}</span>Undergrounding cut SAIDI 38%</span>` }, { h: "Finding" }, { h: "Everything in this project" }, { h: "5d", cls: "num" } ] }
        ])}
        <span class="note" style="display:block;margin-top:8px">6 of 211 shown · a Context is live, so this list changes as the project does</span>
      </div>

      <div class="sec is-shut" data-sec>
        <button class="sec-h" type="button" data-sec-t><span class="sec-c">${ic("chevD", 13)}</span><span class="sec-t">Try a search against it</span></button>
        <div class="sec-b">
          ${search("What would an agent find in here?", "relay coordination study")}
          <button class="cite" type="button" data-inspect="region">
            <span class="row-i">${ic("folder", 14)}</span>
            <span class="cite-m"><span class="row-t">feeder-12-relay.pdf · page 7</span>
            <span class="row-s">“…no coordination study appears in the filings index after the 2024 reconductoring…”</span>
            <span class="row-s">relevance 0.86 · density 0.41</span></span>
          </button>
          ${note("88 of 211 resources have indexed material. The rest are here, but nothing in them can be retrieved yet.")}
        </div>
      </div>
    </div>`,

  contexts: (s) => s.mode === "library" ? [
    { id: "contexts-l", label: "Contexts", icon: "target", body: () =>
      pane("Contexts", sec("Saved", [
        row("Everything but drafts", { icon: "pin", sub2: "211 resources", right: "211", inspect: "resource-set", on: true }),
        row("Regulatory corpus", { icon: "target", sub2: "34 resources", right: "34", inspect: "resource-set" }),
        row("Field reports 2024–25", { icon: "target", sub2: "96 resources", right: "96", inspect: "resource-set" }),
        row("Storm precedents", { icon: "warn", sub2: "Matches nothing", right: "0", inspect: "resource-set" })
      ].join(""), { count: 4, flush: true }), { actions: `${btn("New", { icon: "plus", sm: true, k: "pri" })}${btn("Open", { sm: true, act: "mode:one" })}${btn("Duplicate", { icon: "copy", sm: true })}`, search: search("Search Contexts") }) },
    { id: "resources-l", label: "Resources", icon: "layers", body: () =>
      pane("Resources", [
        sec("Documents", [row("Q3 Resilience Memo", { icon: "doc" }), row("Interconnect Failure Review", { icon: "doc" })].join(""), { count: 3, flush: true }),
        sec("Findings", row("Undergrounding cut SAIDI 38%", { icon: "quote" }), { count: 14, flush: true }),
        sec("Connector files", row("SharePoint — Ops Reports", { icon: "link", sub2: "312 files" }), { count: 2, flush: true })
      ].join(""), { search: search("Search resources") }) }
  ] : [
    { id: "overview", label: "Overview", icon: "info", body: () =>
      pane("Overview", [
        sec("This Context", `<div class="fld"><span class="fld-k">Name</span><span class="fld-v"><span class="inp is-filled">Everything but drafts</span></span></div><div class="fld" style="margin-top:6px"><span class="fld-k">About</span><span class="fld-v"><span class="inp is-filled">Everything the filing may cite, minus template bodies.</span></span></div>`),
        sec("Right now", kv([["Contains", "211 resources", { mono: true }], ["Retrievable", "88 of them", { mono: true }], ["Worked out", "12:04:31", { mono: true }]]) + note("A Context is a rule, not a list. A document created tomorrow that fits the rule is in it without anyone editing this.")),
        sec("Saved", chip("Saved · revision 9", "ok")),
        sec("Used by", note("Shown only for consumers the backend can truthfully query. There is no universal reverse index of everything using a Context."), { shut: true })
      ].join(""), { actions: `${btn("Duplicate", { icon: "copy", sm: true })}${btn("Delete", { icon: "trash", sm: true, k: "dgr", dis: true })}` }) },

    { id: "sets", label: "Contexts", icon: "target", body: () =>
      pane("Contexts", sec("Saved", [
        row("Everything but drafts", { icon: "pin", sub2: "Everything, minus templates", right: "211", inspect: "resource-set", on: true }),
        row("Regulatory corpus", { icon: "target", sub2: "Documents and the Filings set", right: "34", inspect: "resource-set" }),
        row("Field reports 2024–25", { icon: "target", sub2: "12 resources and connector files", right: "96", inspect: "resource-set" }),
        row("Storm precedents", { icon: "warn", sub2: "Nothing matches it right now", right: "0", inspect: "resource-set" })
      ].join(""), { count: 4, flush: true }), { actions: `${btn("New Context", { icon: "plus", sm: true, k: "pri" })}${btn("Duplicate", { icon: "copy", sm: true })}`, search: search("Search Contexts") }) },

    { id: "add", label: "Add", icon: "plus", body: () =>
      pane("Add to this Context", [
        sec("By rule", [
          row("Everything in this project", { icon: "scope", sub2: "Live — includes what is made later" }),
          row("Everything of one kind", { icon: "layers", sub2: "All documents, all findings…" }),
          row("Another saved Context", { icon: "target", sub2: "At its current contents" })
        ].join(""), { flush: true }),
        sec("By name", [
          row("Q3 Resilience Memo", { icon: "doc" }),
          row("Board Update — October", { icon: "deck" }),
          row("SharePoint — Ops Reports", { icon: "link", sub2: "Expands to 312 files" })
        ].join(""), { flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("Whatever you add lands on the side you are pointing at — Include or Take out. Both halves accept the same things.")}</div>`
      ].join(""), { search: search("Search resources") }) },

    { id: "contents", label: "Contents", icon: "list", body: () =>
      pane("Contents", [
        sec("Problems", row("One named resource no longer exists", { icon: "warn", sub2: "d_88a2 · kept as written", inspect: "resolved" }), { count: 1, flush: true }),
        sec("Unsaved changes", [row("Interconnect Failure Review", { icon: "plus", sub2: "Would be added" }), row("Regulatory filing shell", { icon: "minus", sub2: "Would be taken out" })].join(""), { count: 2, flush: true }),
        sec("Contents", [row("Q3 Resilience Memo", { icon: "doc", inspect: "resolved" }), row("Board Update — October", { icon: "deck", inspect: "resolved" }), row("Outage Cost Model", { icon: "sheet", inspect: "resolved" })].join(""), { count: 211, flush: true })
      ].join("")) },

    { id: "knowledge", label: "Knowledge", icon: "layers", body: () =>
      pane("Knowledge", [
        sec("What can be retrieved", [row("88 resources with indexed material", { icon: "ok" }), row("123 resources with nothing indexed yet", { icon: "info" })].join(""), { flush: true }),
        sec("Generated blocks using this", [row("Outage summary", { icon: "spark", sub2: "In Q3 Resilience Memo", inspect: "derived-output" }), row("Storm precedent brief", { icon: "spark", sub2: "In Storm Hardening Options", inspect: "derived-output" })].join(""), { count: 2, flush: true }),
        sec("Lattice, debug only", row("Cluster · relay coordination", { icon: "layers", sub2: "tier 2 · 14 members", inspect: "lattice-node" }), { flush: true, shut: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${gap("Per-source health is limited to observed evidence until a source-registry projection exists. Lattice nodes are system-managed and not editable.")}</div>`
      ].join("")) },

    { id: "used", label: "Used by", icon: "link", body: () =>
      pane("Used by", [
        sec("Personas", row("Grid Analyst", { icon: "persona", sub2: "What it can look up" }), { count: 1, flush: true }),
        sec("Prompt blocks", row("Q3 Resilience Memo · page 2", { icon: "spark" }), { count: 1, flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${gap("Only consumers the backend can query truthfully. There is no universal reverse index of everything using a Context, which is also why Delete stays disabled.")}</div>`
      ].join("")) }
  ],

  inspectors: {
    "resource-set": { crumbs: [["Context", null], ["Everything but drafts", null]], body: [
      sec("This Context", `<div class="fld"><span class="fld-k">Name</span><span class="fld-v"><span class="inp is-filled">Everything but drafts</span></span></div><div class="fld" style="margin-top:6px"><span class="fld-k">Describes</span><span class="fld-v"><span class="inp is-filled">Everything the filing may cite, minus template bodies.</span></span></div>`),
      sec("In plain words", note("<b>Everything in this project</b> and <b>Regulatory corpus</b>, minus <b>every template</b>.")),
      sec("Right now", kv([["Contains", "211 resources", { mono: true }], ["Retrievable", "88 of them", { mono: true }]]) + note("Live. A document created tomorrow is included without editing anything.")),
      sec("Saved", kv([["Revision", "9", { mono: true }], ["State", chip("Saved", "ok")]]), { shut: true }),
      sec("Delete", gap("Disabled until one query can find every Context, Persona, prompt block and generated output depending on this one. Deleting blind would create silent broken scopes."))
    ].join("") },

    "include-project": { crumbs: [["Context", "resource-set"], ["Include", null], ["Everything in this project", null]], body: [
      sec("Rule", note("Every resource in this project, including anything created after this Context was saved.")),
      sec("Right now", kv([["Matches", "248", { mono: true }]])),
      sec("Retrievable", kv([["Indexed", "231", { mono: true }], ["Nothing indexed", "17", { mono: true }]]), { shut: true }),
      sec("Actions", `<div class="btn-row">${btn("Move to Take out", { sm: true })}${btn("Remove", { sm: true, k: "dgr" })}</div>`)
    ].join("") },

    "include-set": { crumbs: [["Context", "resource-set"], ["Include", null], ["Regulatory corpus", null]], body: [
      sec("Rule", note("Whatever <b>Regulatory corpus</b> contains at the moment this one is read.")),
      sec("Right now", kv([["Matches", "34", { mono: true }], ["Circular", chip("No", "ok")]])),
      sec("Chain", note("Everything but drafts → Regulatory corpus → Filings"), { shut: true }),
      sec("Actions", `<div class="btn-row">${btn("Open that Context", { sm: true, icon: "chevR" })}${btn("Remove", { sm: true, k: "dgr" })}</div>`)
    ].join("") },

    "exclude-kind": { crumbs: [["Context", "resource-set"], ["Take out", null], ["Every template", null]], body: [
      sec("Rule", note("Every resource whose kind is <b>template</b>, whenever this is read.")),
      sec("Right now", kv([["Takes out", "37", { mono: true }]])),
      sec("What that removes", [row("Regulatory filing shell", { icon: "template" }), row("Board update", { icon: "template" }), row("Cost model skeleton", { icon: "template" })].join(""), { count: 37, flush: true, shut: true }),
      sec("Actions", `<div class="btn-row">${btn("Move to Include", { sm: true })}${btn("Remove", { sm: true, k: "dgr" })}</div>`)
    ].join("") },

    resolved: { crumbs: [["Context", "resource-set"], ["Contents", null], ["feeder-12-relay.pdf", null]], body: [
      sec("Resource", kv([["Title", "feeder-12-relay.pdf"], ["Kind", "external file"]]) + `<div class="btn-row" style="margin-top:6px">${btn("Open", { icon: "chevR" })}</div>`),
      sec("In because", note("<b>Regulatory corpus</b> includes SharePoint — Ops Reports, which produced this file.") + note("A connector expands to the files it synced. The connector record itself is not retrievable content.")),
      sec("Retrievable", kv([["Indexed regions", "12", { mono: true }]]), { shut: true }),
      sec("Take this one out", `<div class="btn-row">${btn("Add to Take out", { sm: true })}</div>`)
    ].join("") },

    region: { crumbs: [["Context", "resource-set"], ["Search", null], ["Result", null]], body: [
      sec("What was found", `<div class="quote-v">“…no coordination study appears in the filings index after the 2024 reconductoring, though the reconductoring itself raised available fault current on the tie…”</div>`),
      sec("Where", kv([["Source", "feeder-12-relay.pdf"], ["Page", "7", { mono: true }], ["Offsets", "18420 → 18604", { mono: true }]])),
      sec("Scoring", kv([["Relevance", "0.86", { mono: true }], ["Density", "0.41", { mono: true }]]), { shut: true }),
      sec("What was searched", kv([["Contents", "211 resources", { mono: true }], ["Searchable", "88 of them", { mono: true }], ["At", "12:04:31", { mono: true }]]), { shut: true })
    ].join("") },

    "derived-output": { crumbs: [["Context", "resource-set"], ["Knowledge", null], ["Outage summary", null]], body: [
      sec("Prompt", note("Summarise this week's outage reports by substation.")),
      sec("Lives in", row("Q3 Resilience Memo · page 2", { icon: "doc", sub2: "Prompt block", inspect: "resolved" }), { flush: true }),
      sec("Runs", note("On open, and whenever the block is re-run. What it produces is generated against this Context as it stands at that moment.")),
      sec("Provenance", kv([["Scope", "Everything but drafts"], ["Model", "analyst-default", { mono: true }]]), { shut: true }),
      sec("Owner lookup", gap("<code>DerivedOutput</code> stores no owner pointer, so finding the prompt block that owns it is a reverse query."))
    ].join("") },

    "lattice-node": { crumbs: [["Context", "resource-set"], ["Knowledge", null], ["Lattice node", null]], body: [
      sec("Node", kv([["Tier", "2", { mono: true }], ["Level", "cluster", { mono: true }], ["Members", "14", { mono: true }]])),
      sec("Windows", kv([["Windows", "41", { mono: true }], ["Density", "0.37", { mono: true }], ["Cohesion", "0.72", { mono: true }]]), { shut: true }),
      sec("Contradiction", gap("The knowledge model describes a singular <code>parentId</code> tree while the clustering process describes overlapping cliques. This debug view must not promise one definitive parent hierarchy until that is resolved."))
    ].join("") }
  },

  status: () => [
    { t: "Saved", tone: "ok", icon: "ok" },
    { t: "Everything but drafts", icon: "target" },
    { t: "211 resources", right: true },
    { t: "88 searchable", right: true }
  ],

  notes: {
    retained: ["selected Context, resource query and kind filters, contents scroll", "resolver proofs and provisional edits live in the screen runtime and are recomputed on reload"],
    nav: ["Contexts are live. “Everything in this project” includes what is made tomorrow.", "Findings are resources and can be retrieved. Questions and hypotheses are organisational and cannot be named by a rule.", "A connector expands to the files it synced; the connector record itself is never retrievable content."],
    revised: ["The nested expression tree is gone. Two halves — Include and Take out — with a minus between them, because that is the whole of what the model does.", "The contents table gained an <b>In because</b> column, so every row says which side put it there.", "“Resolved now — recomputed, never written back” became “What that leaves — 211 resources, right now”.", "The retrieval test is now “Try a search against it”, which is what it is for."],
    gaps: ["Nested unions inside unions cannot be drawn as two flat halves. Either the model stays one level deep, or this screen needs a way to show a group without becoming a tree again.", "<b>In because</b> needs per-result expression proofs from the resolver.", "A missing named resource needs a resolver contract: fail, omit, or return an unresolved descriptor.", "Delete is gated on a complete reverse-dependency query."]
  }
};

/* ============================================================
   9 · Templates
   ============================================================ */
SCREENS["templates"] = {
  name: "Templates",
  path: "docs/screen-specs/templates.md",
  purpose:
    "A template is an ordinary body with variables left open. Authoring is the ordinary editor; using one asks for the variables and hands back an independent copy.",
  init: { ctx: "overview", inspect: "template-card", mode: "library" },
  modes: [["library", "All templates", "All"], ["author", "One template", "This one"]],

  center: (s) => s.mode === "author" ? `
    <div class="shead">
      ${btn("Back to library", { k: "gh", sm: true, icon: "chevL", act: "mode:library" })}
      <span class="shead-t">Regulatory filing shell</span>
      ${chip("Template", "ai")}
      <div class="shead-r">${chip("Saved · revision 6", "ok")}</div>
    </div>
    <div class="pasteboard" style="padding-top:calc(var(--u)*6)">
      <div class="page">
        <div class="pg-head"><button class="furn" type="button" data-inspect="body-entity">${esc(PROJECT.name)} — Commission filing</button></div>
        <div class="pg-body">
          <h1 class="dh1 blk" data-inspect="body-entity">Filing to the Commission</h1>
          <p class="dp blk" data-inspect="body-entity">Docket <span class="atom" data-inspect="slot">filingDocket</span>, filed by
            <span class="atom" data-inspect="slot">filingParty</span> under the statutory basis set out below.</p>
          <h2 class="dh2 blk" data-inspect="body-entity">Outage record</h2>
          <div class="blk" data-inspect="slot" style="border:1px dashed var(--ai-b);border-radius:var(--r-ctl);padding:calc(var(--u)*5);text-align:center">
            <span class="mocklab">table variable · outageTable</span>
          </div>
          <div class="pblock" data-inspect="slot">
            <div class="pblock-h">${ic("spark", 13)} Generated · execSummary</div>
            <p class="dp" style="margin:0">Becomes a prompt block in the created document and runs on first open.</p>
          </div>
        </div>
        <div class="pg-foot"><button class="furn" type="button" data-inspect="body-entity"><span>Docket</span><span class="pg-n">1</span></button></div>
      </div>
    </div>` : `
    <div class="wrap">
      <div class="hd">
        <div class="hd-m"><h1 class="hd-t">Templates</h1>
          <span class="hd-s">A real body with variables left open. Using one makes an independent copy — later edits to the template never reach it.</span></div>
        <div class="hd-a">${btn("New template", { icon: "plus", k: "pri" })}</div>
      </div>
      <div class="chips">
        <span style="flex:1;min-width:180px;max-width:280px">${search("Search templates")}</span>
        ${chip("All", "act")}${chip("Project")}${chip("Global")}
        <span class="st-sep"></span>
        ${chip("Document")}${chip("Slide deck")}${chip("Slide")}${chip("Spreadsheet")}
      </div>
      <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">
        ${[["Regulatory filing shell", "Document · Project", "4 variables", true],
           ["Incident review", "Document · Global", "No variables"],
           ["Board update", "Slide deck · Project", "2 variables"],
           ["Title slide", "Slide · Project", "1 variable"],
           ["Cost model skeleton", "Spreadsheet · Project", "No variables"],
           ["Storm brief", "Document · Project", "3 variables"]]
          .map(([n, m, vars, on]) => `
          <button class="card${on ? " is-on" : ""}" type="button" data-inspect="template-card">
            <span class="thumb" style="aspect-ratio:4/3">
              <span class="thumb-l" style="left:12%;top:12%;width:60%;height:9%"></span>
              <span class="thumb-l" style="left:12%;top:28%;width:40%;height:5%;background:color-mix(in srgb,var(--ai-b) 34%,transparent)"></span>
              <span class="thumb-l" style="left:56%;top:28%;width:30%;height:5%;background:color-mix(in srgb,var(--ai-b) 34%,transparent)"></span>
              <span class="thumb-l" style="left:12%;top:44%;width:76%;height:32%;background:color-mix(in srgb,var(--ai-b) 16%,transparent)"></span>
            </span>
            <span class="card-t">${n}</span>
            <span class="card-s">${m}<br>${vars}</span>
          </button>`).join("")}
      </div>
      ${note("Previews are rendered from the real body. The model has no thumbnail, tag, category, favourite or usage count, so the library does not pretend those exist.")}
    </div>`,

  contexts: (s) => s.mode === "author" ? [
    { id: "overview", label: "Overview", icon: "info", body: () =>
      pane("Overview", [
        sec("This template", `<div class="fld"><span class="fld-k">Name</span><span class="fld-v"><span class="inp is-filled">Regulatory filing shell</span></span></div>` + kv([["Kind", "Document"], ["Available in", chip("This project", "a2")], ["Variables", "4", { mono: true }]]) + note("The kind is fixed at creation. Changing it would mean converting the body, which is not modelled.")),
        sec("Saved", chip("Saved · revision 6", "ok")),
        sec("Attribution", kv([["Created by", who("Mira Jain", "actor")], ["Updated", "2 weeks ago", { mono: true }]]), { shut: true })
      ].join(""), { actions: btn("Back to library", { icon: "chevL", sm: true, act: "mode:library" }) }) },

    { id: "variables-t", label: "Variables", icon: "hash", body: () =>
      pane("Variables in this template", [
        sec("Required", [row("filingDocket", { icon: "hash", sub2: "Text", inspect: "slot", on: true }), row("filingParty", { icon: "hash", sub2: "Text", inspect: "slot" }), row("outageTable", { icon: "db", sub2: "Table", inspect: "slot" })].join(""), { count: 3, flush: true }),
        sec("Optional", row("execSummary", { icon: "spark", sub2: "Generated · becomes a prompt block", inspect: "slot" }), { count: 1, flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${gap("Add and list work. Highlighting where a variable sits in the body, and jumping to it, stay disabled — nothing in a body records which variable it stands for.")}</div>`
      ].join(""), { actions: btn("Add variable", { icon: "plus", sm: true, k: "pri" }) }) },
    { id: "body", label: "Body", icon: "list", body: () =>
      pane("Body", sec("Outline", [row("Filing to the Commission", { icon: "type", right: "p.1", on: true }), row("Outage record", { icon: "type", right: "p.1", sub: true }), row("Statutory basis", { icon: "type", right: "p.2", sub: true })].join(""), { flush: true })) },
    { id: "insert", label: "Insert", icon: "plus", body: () =>
      pane("Insert", [
        sec("Basics", [row("Text block", { icon: "type" }), row("Heading", { icon: "type" }), row("Table", { icon: "sheet" })].join(""), { flush: true }),
        sec("Variable", [row("Text variable", { icon: "hash" }), row("Table variable", { icon: "db" }), row("Generated variable", { icon: "spark" })].join(""), { flush: true })
      ].join("")) },
    { id: "design", label: "Design", icon: "pal", body: () =>
      pane("Design", [
        sec("Styles", [row("Body", { icon: "type" }), row("Heading 1", { icon: "type" })].join(""), { flush: true }),
        sec("Page", kv([["Paper", "Letter"], ["Gutters", "1 in", { mono: true }]]))
      ].join("")) }
  ] : [
    { id: "overview", label: "Overview", icon: "info", body: () =>
      pane("Overview", [
        sec("Templates", note("A template is an ordinary body with some of it left open — the open parts are variables you fill when you use it. Authoring one is authoring a document, a deck or a spreadsheet.")),
        sec("In this project", kv([["Templates", "5", { mono: true }], ["Documents", "1", { mono: true }], ["Slide decks", "2", { mono: true }], ["Single slides", "1", { mono: true }], ["Spreadsheets", "1", { mono: true }]])),
        sec("Available everywhere", kv([["Templates", "1", { mono: true }]]) + note("A global template can be used here; who may edit it is a deployment rule, not something the absence of a project says.")),
        sec("Selected", kv([["Name", "Regulatory filing shell"], ["Variables", "4 required", { mono: true }]]) + `<div class="btn-row">${btn("Open", { k: "pri", sm: true, act: "mode:author" })}${btn("Use", { sm: true, dis: true })}</div>`)
      ].join("")) },

    { id: "library", label: "Library", icon: "template", body: () =>
      pane("Library", [
        sec("Project", [row("Regulatory filing shell", { icon: "doc", sub2: "Document · 4 variables", inspect: "template-card", on: true }), row("Board update", { icon: "deck", sub2: "Slide deck · 2 variables", inspect: "template-card" }), row("Title slide", { icon: "deck", sub2: "Slide · 1 variable", inspect: "template-card" }), row("Cost model skeleton", { icon: "sheet", sub2: "Spreadsheet", inspect: "template-card" })].join(""), { count: 5, flush: true }),
        sec("Global", row("Incident review", { icon: "doc", sub2: "Document", inspect: "template-card" }), { count: 1, flush: true })
      ].join(""), { actions: `${btn("New", { icon: "plus", sm: true, k: "pri" })}${btn("Edit", { sm: true, act: "mode:author" })}${btn("Use", { sm: true })}${btn("Duplicate", { icon: "copy", sm: true })}`, search: search("Search templates") }) },
    { id: "targets", label: "Kinds", icon: "layers", body: () =>
      pane("Kinds", [
        sec("Document", note("A paginated body with variables left open.") + `<div class="btn-row" style="margin-top:6px">${btn("New", { icon: "plus", sm: true })}</div>`),
        sec("Slide deck", note("A whole deck: layouts, theme, sections.") + `<div class="btn-row" style="margin-top:6px">${btn("New", { icon: "plus", sm: true })}</div>`),
        sec("Slide", note("One slide, reusable on its own. Inserted into any deck.") + `<div class="btn-row" style="margin-top:6px">${btn("New", { icon: "plus", sm: true })}</div>`),
        sec("Spreadsheet", note("Sheets of cells holding text and formulas.") + `<div class="btn-row" style="margin-top:6px">${btn("New", { icon: "plus", sm: true })}</div>`)
      ].join("")) },
    { id: "recent", label: "Recent", icon: "clock", body: () =>
      pane("Recent", [
        sec("Recently updated", [row("Regulatory filing shell", { icon: "doc", right: "2w" }), row("Board update", { icon: "deck", right: "3w" })].join(""), { flush: true }),
        sec("Recently used", row("Cost model skeleton", { icon: "sheet", right: "today" }), { flush: true })
      ].join("")) }
  ],

  inspectors: {
    "template-card": { crumbs: [["Templates", null], ["Regulatory filing shell", null]], body: [
      sec("This template", `<div class="fld"><span class="fld-k">Name</span><span class="fld-v"><span class="inp is-filled">Regulatory filing shell</span></span></div>` + kv([["Makes a", `${chip("Document", "off")} <span class="note">fixed at creation</span>`], ["Available in", `<span class="chips">${chip("This project", "a2")}${chip("Everywhere")}</span>`]])),
      sec("Preview", `<div class="thumb" style="aspect-ratio:4/3"><span class="thumb-l" style="left:12%;top:12%;width:60%;height:9%"></span><span class="thumb-l" style="left:12%;top:28%;width:40%;height:5%;background:color-mix(in srgb,var(--ai-b) 34%,transparent)"></span><span class="thumb-l" style="left:12%;top:44%;width:76%;height:32%;background:color-mix(in srgb,var(--ai-b) 16%,transparent)"></span></div>`),
      sec("It will ask for", [row("filingDocket", { icon: "hash", sub2: "Text · required", inspect: "slot" }), row("filingParty", { icon: "hash", sub2: "Text · required", inspect: "slot" }), row("outageTable", { icon: "db", sub2: "Table · required", inspect: "slot" }), row("execSummary", { icon: "spark", sub2: "Generated · optional", inspect: "slot" })].join(""), { count: 4, flush: true }),
      sec("Actions", `<div class="btn-row">${btn("Edit", { k: "pri", act: "mode:author" })}${btn("Use", { dis: true })}${btn("Duplicate")}</div>` + gap("Use is disabled while variables cannot be placed in the body.")),
      sec("Attribution", kv([["Created by", who("Mira Jain", "actor")], ["Revision", "6", { mono: true }]]), { shut: true })
    ].join("") },

    slot: { crumbs: [["Templates", "template-card"], ["Regulatory filing shell", "template-card"], ["filingDocket", null]], body: [
      sec("Variable", `<div class="fld"><span class="fld-k">Key</span><span class="fld-v"><span class="inp is-filled" style="font-family:var(--mono)">filingDocket</span></span></div>` + kv([["Label", "Docket number"], ["Asks for", `<span class="chips">${chip("Text", "act")}${chip("Image")}${chip("Table")}${chip("Generated")}</span>`], ["Required", `<span class="tog is-on"></span>`]])),
      sec("Default", kv([["Value", "—"]]) + note("Always a string today, which needs clarifying for image and table variables."), { shut: true }),
      sec("Where it appears", gap("Cannot highlight or jump to it. Do not infer placement from labels, text, array position or prompt content — add one explicit mechanism first."))
    ].join("") },

    "body-entity": { crumbs: [["Templates", "template-card"], ["Body", null], ["Text block", null]], body: [
      sec("Text", `<div class="quote-v">Filing to the Commission</div>`),
      sec("Variant", `<div class="chips">${chip("Body")}${chip("Heading 1", "act")}${chip("Heading 2")}</div>` + note("The ordinary document inspector, reused exactly. Only the persistence adapter differs — a template embeds its body and saves through revision-CAS.")),
      sec("Owner", kv([["Template", "Regulatory filing shell"]]), { shut: true })
    ].join("") },

    instantiation: { crumbs: [["Templates", "template-card"], ["Use", null]], body: [
      sec("Makes", kv([["A", "Document"], ["Called", "Q4 Filing Draft"], ["In", esc(PROJECT.name)]])),
      sec("Asks you for", [row("filingDocket", { icon: "hash", sub2: "Not set" }), row("filingParty", { icon: "hash", sub2: "Not set" }), row("outageTable", { icon: "db", sub2: "Not set" })].join(""), { count: 3, flush: true }),
      sec("Generated on open", row("execSummary", { icon: "spark", sub2: "Becomes a prompt block" }), { count: 1, flush: true, shut: true }),
      sec("Create", `<div class="btn-row">${btn("Create", { k: "pri", big: true, dis: true })}</div>` + note("One durable action. The result records where it came from and nothing else — later template edits never mutate it."))
    ].join("") }
  },

  status: (s) => [
    { t: "Saved", tone: "ok", icon: "ok" },
    { t: s.mode === "author" ? "Regulatory filing shell · revision 6" : "Regulatory filing shell", icon: "template" },
    { t: s.mode === "author" ? "Makes a document" : "6 templates", right: true }
  ],

  notes: {
    retained: ["Library/Authoring mode, selected template, filters, query, preview scroll", "the ordinary editor runtime is retained by the tab while Authoring is active; the body itself is persisted model state"],
    nav: ["Authoring replaces the library with the matching ordinary editor. The tab stays a Templates screen with a visible label and a way back.", "What a template makes is chosen at creation and immutable — changing it would need destructive body conversion.", "Copying a project template to global scope creates another template. There is no live shared ownership."],
    revised: ["Library and Authoring became buttons at the top of the panel rather than a bar across the screen.", "“Slot” became <b>variable</b> throughout, which is what they are: a resource-set variable inside a body.", "A single slide is now a template kind of its own, alongside document, deck and spreadsheet."],
    gaps: ["No body entity carries a variable key. Placement, highlighting, jump-to and use of any template with variables are all blocked on it.", "<code>TemplateSlot.default</code> is always a string, unclear for image and table variables.", "Slide-level templates need a target discriminant the model does not have."]
  }
};

/* ============================================================
   10 · Personas
   ============================================================ */
SCREENS["personas"] = {
  name: "Personas",
  path: "docs/screen-specs/personas.md",
  purpose:
    "A profile for each agent: who it is, what it knows, what it may touch, and everything it has done. Background is prompt material; Context is retrievable material — the screen never confuses the two.",
  init: { ctx: "overview", inspect: "persona", mode: "author" },
  modes: [["library", "All personas", "All"], ["author", "One persona", "This one"]],

  center: (s) => s.mode === "library" ? `
    <div class="wrap">
      <div class="hd">
        <div class="hd-m"><h1 class="hd-t">Personas</h1>
          <span class="hd-s">Reusable agent behaviour. Provider credentials and deployment setup stay outside project data.</span></div>
        <div class="hd-a">${btn("New Persona", { icon: "plus", k: "pri" })}</div>
      </div>
      <div class="chips"><span style="flex:1;min-width:180px;max-width:280px">${search("Search Personas")}</span>${chip("All", "act")}${chip("This project")}${chip("Everywhere")}</div>
      <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr))">
        ${[["GA", "ai", "Grid Analyst", "Reads field data and relay logs; refuses to speculate past the record.", "41 tasks · 2 running", true],
           ["FE", "a1", "Filing Editor", "Turns findings into filing prose in the Commission's register.", "18 tasks"],
           ["SK", "a2", "Skeptic", "Argues the other side of every hypothesis before it is accepted.", "6 tasks"]]
          .map(([i, t, n, d, work, on]) => `
          <button class="card${on ? " is-on" : ""}" type="button" data-inspect="persona">
            <span class="chips">${av(i, t)}<span class="card-t">${n}</span></span>
            <span class="card-s">${d}</span>
            <span class="chips">${chip(work, "off")}</span>
          </button>`).join("")}
      </div>
    </div>` : `
    <div class="shead">
      ${btn("Back to library", { k: "gh", sm: true, icon: "chevL", act: "mode:library" })}
      <span class="shead-t">Grid Analyst</span>
      <div class="shead-r">${chip("Saved · revision 14", "ok")}</div>
    </div>
    <div class="wrap">
      <div class="profile">
        <button class="card" type="button" data-inspect="persona" style="padding:0;border:none;background:none;box-shadow:none">${av("GA", "ai", { lg: true })}</button>
        <div class="profile-m">
          <h1 class="hd-t">Grid Analyst</h1>
          <span class="hd-s">Reads field data and relay logs; refuses to speculate past the record.</span>
          <div class="chips" style="margin-top:6px">${chip("This project", "a2")}${chip("analyst-default", "off")}${chip("4 tools")}</div>
        </div>
      </div>

      <div class="stat-row">
        ${stat("41", "tasks run")}
        ${stat("2", "running now")}
        ${stat("1", "failed")}
        ${stat("128", "findings accepted")}
      </div>

      <div class="split is-3-2">
        <div style="display:flex;flex-direction:column;gap:calc(var(--u)*2)">
          <span class="eyebrow">How it behaves</span>
          <div class="tbl-w">
            <div class="sec" data-sec>
              <button class="sec-h" type="button" data-sec-t><span class="sec-c">${ic("chevD", 13)}</span><span class="sec-t">Focus</span></button>
              <div class="sec-b"><div class="inp is-filled" style="height:auto;padding:10px;align-items:flex-start"><span class="inp-w" style="white-space:normal">Concentrate on outage causation from field evidence: relay logs, event sequences, weather records. Leave cost allocation and rate design to the Filing Editor.</span></div></div>
            </div>
            ${[["Background", "Northwind operates 41 substations across three counties. The 2024 reconductoring raised…"],
               ["Approach", "Establish the event sequence before proposing a mechanism. Name the document and page…"],
               ["Output", "Lead with the mechanism in one sentence, then the evidence. Cite every claim…"],
               ["Verification", "Before finishing, confirm every cited page number resolves and no claim rests on…"]]
              .map(([t, prev]) => `<div class="sec is-shut" data-sec>
                <button class="sec-h" type="button" data-sec-t><span class="sec-c">${ic("chevD", 13)}</span><span class="sec-t">${t}</span><span class="sec-n">written</span></button>
                <div class="sec-b">${note(prev)}</div></div>`).join("")}
          </div>
          ${note("All of it is prompt text and costs context on every call. What it can look things up in is separate, and below.")}
        </div>

        <div style="display:flex;flex-direction:column;gap:calc(var(--u)*4)">
          <div style="display:flex;flex-direction:column;gap:calc(var(--u)*2)">
            <span class="eyebrow">What it can look up</span>
            <div class="tbl-w">
              ${row("Field reports 2024–25", { icon: "target", sub2: "96 resources · not pasted into the prompt", right: "96", inspect: "scope-node" })}
              ${row("The web", { icon: "scope", sub2: "Not allowed", inspect: "tool" })}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:calc(var(--u)*2)">
            <span class="eyebrow">What it may do</span>
            <div class="tbl-w">
              ${row("lattice.retrieve", { icon: "check", sub2: "Allowed", inspect: "tool" })}
              ${row("resource.read", { icon: "check", sub2: "Allowed", inspect: "tool" })}
              ${row("finding.create", { icon: "check", sub2: "Allowed", inspect: "tool" })}
              ${row("resource.write", { icon: "x", sub2: "Not allowed", inspect: "tool" })}
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:calc(var(--u)*3)">
        <div class="hd">
          <div class="hd-m"><span class="eyebrow">Everything it has done</span></div>
          <div class="hd-a"><div class="chips">${chip("All", "act")}${chip("Running")}${chip("Failed")}${chip("Conversations")}</div></div>
        </div>
        ${table(["Task", "Started by", "When", "Result"], [
          { on: true, inspect: "task", cells: [
            { h: `<span class="cellname"><span class="row-i">${ic("spark")}</span>Summarise overnight outage reports</span>` },
            { h: who("Nightly filing digest", "actor-automation") }, { h: "02:00", cls: "num" }, { h: chip("Running · 3 of 5", "act") } ] },
          { inspect: "task", cells: [
            { h: `<span class="cellname"><span class="row-i">${ic("warn")}</span>Rebuild substation crosswalk</span>` },
            { h: who("Ana Reyes", "actor") }, { h: "Yesterday", cls: "num" }, { h: chip("Failed · tool not permitted", "err") } ] },
          { inspect: "task", cells: [
            { h: `<span class="cellname"><span class="row-i">${ic("ok")}</span>Extract 2024 storm precedents</span>` },
            { h: who("Ana Reyes", "actor") }, { h: "2 hours ago", cls: "num" }, { h: chip("14 findings accepted", "ok") } ] },
          { inspect: "task", cells: [
            { h: `<span class="cellname"><span class="row-i">${ic("comment")}</span>Relay coordination history</span>` },
            { h: who("Ana Reyes", "actor") }, { h: "2 hours ago", cls: "num" }, { h: "Conversation · 14 turns" } ] }
        ])}
      </div>
    </div>`,

  contexts: () => [
    { id: "overview", label: "Overview", icon: "info", body: () =>
      pane("Overview", [
        sec("This persona", `<div class="chips" style="margin-bottom:6px">${avb("GA", "ai", { name: "Grid Analyst", inspect: "actor-agent" })}<span class="card-t">Grid Analyst</span></div><div class="fld"><span class="fld-k">Does</span><span class="fld-v"><span class="inp is-filled">Reads field data and relay logs</span></span></div>` + kv([["Available in", chip("This project", "a2")]])),
        sec("Record", `<div class="stat-row">${stat("41", "tasks")}${stat("2", "running")}${stat("128", "findings")}</div>`),
        sec("Set up", kv([["Behaviour", "5 of 5 written", { mono: true }], ["Can look up", "Field reports 2024–25 · 96", { mono: true }], ["May use", "4 of 6 tools", { mono: true }]])),
        sec("Saved", chip("Saved · revision 14", "ok")),
        sec("Attribution", kv([["Created by", who("Mira Jain", "actor")], ["Updated", "3 days ago", { mono: true }]]), { shut: true })
      ].join(""), { actions: btn("Back to library", { icon: "chevL", sm: true, act: "mode:library" }) }) },

    { id: "library", label: "Personas", icon: "persona", body: () =>
      pane("Personas", [
        sec("This project", [row("Grid Analyst", { icon: "pin", sub2: "41 tasks · 2 running", inspect: "persona", on: true }), row("Filing Editor", { icon: "persona", sub2: "18 tasks", inspect: "persona" })].join(""), { count: 2, flush: true }),
        sec("Everywhere", row("Skeptic", { icon: "persona", sub2: "6 tasks", inspect: "persona" }), { count: 1, flush: true })
      ].join(""), { actions: `${btn("New", { icon: "plus", sm: true, k: "pri" })}${btn("Open", { sm: true, act: "mode:author" })}${btn("Duplicate", { icon: "copy", sm: true })}`, search: search("Search Personas") }) },

    { id: "work", label: "Work", icon: "spark", body: () =>
      pane("Work", [
        sec("Running", row("Summarise overnight outage reports", { icon: "spark", sub2: "Step 3 of 5 · from Nightly filing digest", inspect: "task", on: true }), { count: 2, flush: true }),
        sec("Failed", row("Rebuild substation crosswalk", { icon: "warn", sub2: "Tool not permitted: web.search", inspect: "task" }), { count: 1, flush: true }),
        sec("Completed", [row("Extract 2024 storm precedents", { icon: "ok", right: "2h", inspect: "task" }), row("Draft board talking points", { icon: "ok", right: "1d", inspect: "task" })].join(""), { count: 38, flush: true }),
        sec("Conversations", [row("Relay coordination history", { icon: "comment", right: "2h", inspect: "task" }), row("Reading the 2024 study", { icon: "comment", right: "1d", inspect: "task" })].join(""), { count: 6, flush: true, shut: true })
      ].join("")) },

    { id: "definition", label: "Behaviour", icon: "book", body: () =>
      pane("Behaviour", [
        sec("Sections", [
          row("Focus", { icon: "ok", sub2: "168 characters", inspect: "definition-section", on: true }),
          row("Background", { icon: "ok", sub2: "402 characters", inspect: "definition-section" }),
          row("Approach", { icon: "ok", sub2: "291 characters", inspect: "definition-section" }),
          row("Output", { icon: "ok", sub2: "184 characters", inspect: "definition-section" }),
          row("Verification", { icon: "ok", sub2: "143 characters", inspect: "definition-section" })
        ].join(""), { count: 5, flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("Empty sections are left out of the prompt entirely. A Persona with five empty sections and a scope is legal.")}</div>`
      ].join("")) },

    { id: "scope", label: "Context", icon: "target", body: () =>
      pane("Context", [
        sec("It can look up", row("Field reports 2024–25", { icon: "target", sub2: "96 resources", right: "96", inspect: "scope-node", on: true }), { flush: true }),
        sec("Contents", [row("storm-log-2026-01.csv", { icon: "sheet" }), row("feeder-12-relay.pdf", { icon: "folder" }), row("Ward 3 undergrounding report", { icon: "doc" })].join(""), { count: 96, flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${gap("A Context that matches nothing is unsafe while empty is treated as whole-project. Warn or block until explicit-empty is distinguishable.")}</div>`
      ].join(""), { foot: btn("Open Context screen", { k: "gh" }) }) },

    { id: "tools", label: "Tools", icon: "wrench", body: () =>
      pane("Tools", [
        sec("Allowed", [row("lattice.retrieve", { icon: "check", inspect: "tool" }), row("resource.read", { icon: "check", inspect: "tool" }), row("finding.create", { icon: "check", inspect: "tool" }), row("analysis.evaluate", { icon: "check", inspect: "tool" })].join(""), { count: 4, flush: true }),
        sec("Not allowed", [row("resource.write", { icon: "x", inspect: "tool" }), row("web.search", { icon: "x", inspect: "tool" })].join(""), { count: 2, flush: true }),
        sec("Model", row("analyst-default", { icon: "gear", sub2: "A binding name, not a credential", inspect: "model-binding" }), { flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("Provider credentials never appear here. Tool availability is operational, not decorative — there is no universal Web toggle.")}</div>`
      ].join(""), { search: search("Search tools") }) }
  ],

  inspectors: {
    persona: { crumbs: [["Personas", null], ["Grid Analyst", null]], body: [
      sec("Profile", `<div class="chips" style="margin-bottom:8px">${av("GA", "ai", { lg: true })}</div><div class="fld"><span class="fld-k">Name</span><span class="fld-v"><span class="inp is-filled">Grid Analyst</span></span></div><div class="fld" style="margin-top:6px"><span class="fld-k">Describes</span><span class="fld-v"><span class="inp is-filled">Reads field data and relay logs.</span></span></div>` + kv([["Picture", `<span class="chips">${btn("Choose", { sm: true, icon: "img" })}</span>`], ["Available in", `<span class="chips">${chip("This project", "a2")}${chip("Everywhere")}</span>`]])),
      sec("Record", `<div class="stat-row">${stat("41", "tasks")}${stat("128", "findings")}</div>`),
      sec("Behaviour", note("Focus · Background · Approach · Output · Verification — all five written.")),
      sec("Can look up", row("Field reports 2024–25", { icon: "target", right: "96", inspect: "scope-node" }), { flush: true }),
      sec("May do", kv([["Tools", "4 of 6 allowed", { mono: true }], ["Model", "analyst-default", { mono: true }]]), { shut: true }),
      sec("Removal", gap("Delete is removed rather than shown. Deletion is gated on a dependency and tombstone policy — 41 tasks and 6 conversations name this Persona, and hard deletion would break every one of those labels."))
    ].join("") },

    task: { crumbs: [["Personas", "persona"], ["Grid Analyst", "persona"], ["Task", null]], body: [
      sec("Task", `<div class="chips" style="margin-bottom:6px">${chip("Running", "act")}${chip("step 3 of 5", "off")}</div>` + kv([["Title", "Summarise overnight outage reports"], ["Started by", "Nightly filing digest"], ["Started", "02:00", { mono: true }]])),
      sec("Asked to", `<div class="quote-v">Summarise last night's outage reports by substation and flag anything that changes the filing position.</div>` + note("Immutable. Changing it requires a new task.")),
      sec("Plan", [
        row("Resolve what it can look up", { icon: "ok", sub2: "Done" }),
        row("Read overnight reports", { icon: "ok", sub2: "Done · 14 sources" }),
        row("Group by substation", { icon: "refresh", sub2: "Active", on: true }),
        row("Flag filing-relevant changes", { icon: "clock", sub2: "Pending" }),
        row("Write the summary", { icon: "clock", sub2: "Pending" })
      ].join(""), { count: 5, flush: true }),
      sec("Produced", note("Nothing yet. A result is not a resource — promote it into a finding, document, deck or workbook to make it retrievable."), { shut: true }),
      sec("Actions", `<div class="btn-row">${btn("Follow", { k: "pri" })}${btn("Cancel", { k: "dgr" })}</div>` + note("Retry is unavailable until retry semantics are modeled."))
    ].join("") },

    "definition-section": { crumbs: [["Personas", "persona"], ["Grid Analyst", "persona"], ["Focus", null]], body: [
      sec("What this is for", note("What to concentrate on and what to leave alone.")),
      sec("Text", `<div class="inp is-filled" style="height:auto;padding:8px;align-items:flex-start"><span class="inp-w" style="white-space:normal">Concentrate on outage causation from field evidence: relay logs, event sequences, weather records. Leave cost allocation and rate design to the Filing Editor.</span></div>`),
      sec("Cost", note("168 characters, sent on every call this Persona makes."))
    ].join("") },

    "scope-node": { crumbs: [["Personas", "persona"], ["Grid Analyst", "persona"], ["Context", null]], body: [
      sec("Can look up", kv([["Context", "Field reports 2024–25"], ["Contains", "96 resources", { mono: true }], ["Searchable", "88 of them", { mono: true }]])),
      sec("How it combines", note("This Context plus whatever the request adds. Project membership is always enforced and is never one of the parts. Changing this means editing the Persona, not switching it off for one turn.")),
      sec("Portability", gap("For a Persona available everywhere, rules like “everything in this project” resolve wherever it runs, but named resources and named project Contexts do not travel. The editor blocks them until cross-project binding exists."), { shut: true })
    ].join("") },

    tool: { crumbs: [["Personas", "persona"], ["Grid Analyst", "persona"], ["lattice.retrieve", null]], body: [
      sec("Tool", kv([["Name", "lattice.retrieve", { mono: true }], ["Allowed", `<span class="tog is-on"></span>`]])),
      sec("What it does", note("Retrieves verbatim regions from the knowledge lattice, within what this Persona can look up."))
    ].join("") },

    "model-binding": { crumbs: [["Personas", "persona"], ["Grid Analyst", "persona"], ["Model", null]], body: [
      sec("Binding", kv([["Name", "analyst-default", { mono: true }], ["Default", "Yes"]])),
      sec("Boundary", note("A binding name only. Providers, credentials and deployment setup belong outside the project workbench."))
    ].join("") }
  },

  status: (s) => [
    { t: "Saved", tone: "ok", icon: "ok" },
    { t: s.mode === "author" ? "Grid Analyst · revision 14" : "Grid Analyst", icon: "persona" },
    { t: "2 tasks running", right: true },
    { t: "41 tasks total", right: true }
  ],

  notes: {
    retained: ["Library/Profile mode, selected Persona, filters, query", "an optional typed authoring-session ID owning the five sections, tool and model choices and dirty fields — not permission to store an opaque JSON blob"],
    nav: ["Entry points are the Copilot, New Tab, and the Project Overview Tasks view.", "Past tasks reference the live Persona by ID, so they show its current configuration. Execution-time behaviour cannot be reconstructed."],
    revised: ["The five-field form became a profile: picture, name, a record of what it has done, then behaviour, then what it can look up and may do.", "Everything it has done is now a first-class table on the screen — tasks and conversations together, with results.", "This is where agent work lives. If the object is renamed to Agent, the screen does not change shape."],
    gaps: ["Task counts and a findings-accepted tally need a per-Persona aggregate the model does not expose.", "Deletion needs a dependency and tombstone policy before it can appear at all.", "Global-Persona edit authority is a deployment rule, undefined by the model."]
  }
};

/* ============================================================
   11 · Automations
   ============================================================ */
SCREENS["automations"] = {
  name: "Automations",
  path: "docs/screen-specs/automations.md",
  purpose:
    "Standing one-trigger/one-action rules, read as a sentence. A run is a dispatch: success means the task was created, not that it finished.",
  init: { ctx: "overview", inspect: "automation", mode: "library" },
  modes: [["library", "All automations", "All"], ["author", "One rule", "This one"]],

  center: (s) => s.mode === "author" ? `
    <div class="shead">
      ${btn("Back to list", { k: "gh", sm: true, icon: "chevL", act: "mode:library" })}
      <span class="shead-t">Nightly filing digest</span>
      <span class="tog is-on"></span><span class="note">On</span>
      <div class="shead-r">${chip("Saved", "ok")}${btn("Run now", { sm: true, icon: "play" })}</div>
    </div>
    <div class="wrap">
      <div class="hd"><div class="hd-m">
        <h1 class="hd-t" style="font-size:var(--t-lg);line-height:1.75rem">When <span style="color:var(--act-t)">the clock reaches 02:00 in New York</span>,
          <span style="color:var(--ai-t)">ask Filing Editor to do something</span>.</h1>
        <span class="hd-s">One trigger, one action. Two things to do means two Automations.</span>
      </div></div>

      <div class="split">
        <div style="display:flex;flex-direction:column;gap:calc(var(--u)*3)">
          <span class="eyebrow">When</span>
          ${[["On a schedule", "A time and a timezone", "calendar", true], ["Something changes", "A kind of resource, or one exact resource", "doc"], ["A connector syncs", "One connector", "link"], ["A finding is accepted", "Optionally under one question", "quote"], ["Only when I say", "Never fires on its own", "play"]]
            .map(([n, d, i, on]) => `<button class="card${on ? " is-on" : ""}" type="button" data-inspect="schedule-trigger" style="flex-direction:row;align-items:flex-start;gap:calc(var(--u)*3)">
              <span class="card-i">${ic(i, 16)}</span><span><span class="card-t">${n}</span><br><span class="card-s">${d}</span></span></button>`).join("")}
          <div class="tbl-w" style="padding:calc(var(--u)*3);display:flex;flex-direction:column;gap:calc(var(--u)*2)">
            ${kv([["At", "02:00 daily", { mono: true }], ["Timezone", "America/New_York", { mono: true }], ["Next", "Tomorrow, 02:00", { mono: true }]])}
            ${note("Next run comes from the scheduler, not from the browser.")}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:calc(var(--u)*3)">
          <span class="eyebrow">Do this</span>
          ${[["Ask an agent to do something", "A Persona and what to ask it", "spark", true], ["Re-run a generated block", "One prompt block in a document, deck or workbook", "refresh"]]
            .map(([n, d, i, on]) => `<button class="card${on ? " is-on" : ""}" type="button" data-inspect="agent-action" style="flex-direction:row;align-items:flex-start;gap:calc(var(--u)*3)">
              <span class="card-i">${ic(i, 16)}</span><span><span class="card-t">${n}</span><br><span class="card-s">${d}</span></span></button>`).join("")}
          <div class="tbl-w" style="padding:calc(var(--u)*3);display:flex;flex-direction:column;gap:calc(var(--u)*2)">
            ${kv([["Agent", `${av("FE", "a1")} Filing Editor`]])}
            <span class="fld-k">Ask it to</span>
            <div class="inp is-filled" style="height:auto;padding:8px;align-items:flex-start"><span class="inp-w" style="white-space:normal">Summarise last night's outage reports by substation and flag anything that changes the filing position.</span></div>
          </div>
          <div class="tbl-w" style="padding:calc(var(--u)*3)">
            ${kv([["Last fired", "Today, 02:00", { mono: true }], ["Result", chip("Couldn't start", "err")], ["Why", "Filing Editor may not use web.search"], ["Fired about", "184 times", { mono: true }]])}
          </div>
        </div>
      </div>
    </div>` : `
    <div class="wrap">
      <div class="hd">
        <div class="hd-m"><h1 class="hd-t">Automations</h1>
          <span class="hd-s">A run is a dispatch. Success means the task was created — what it then does is the task's own story.</span></div>
        <div class="hd-a">${btn("New Automation", { icon: "plus", k: "pri" })}</div>
      </div>
      <div class="chips">
        <span style="flex:1;min-width:180px;max-width:260px">${search("Search Automations")}</span>
        ${chip("All", "act")}${chip("On")}${chip("Off")}${chip("Not working", "err")}
      </div>
      ${table(["On", "Name", "When", "Do this", "Last fired", "Result"], [
        { on: true, inspect: "automation", cells: [
          { h: `<span class="tog is-on"></span>` }, { h: who("Nightly filing digest", "actor-automation") }, { h: "02:00 daily", cls: "num" },
          { h: "Ask Filing Editor" }, { h: "Today, 02:00", cls: "num" }, { h: chip("Couldn't start", "err") } ] },
        { inspect: "automation", cells: [
          { h: `<span class="tog is-on"></span>` }, { h: "Refresh outage summary" }, { h: "SharePoint syncs", cls: "num" },
          { h: "Re-run a generated block" }, { h: "2 hours ago", cls: "num" }, { h: chip("Started", "ok") } ] },
        { inspect: "automation", cells: [
          { h: `<span class="tog is-on"></span>` }, { h: "Brief on new finding" }, { h: "A finding is accepted", cls: "num" },
          { h: "Ask Grid Analyst" }, { h: "Yesterday", cls: "num" }, { h: chip("Started", "ok") } ] },
        { inspect: "automation", cells: [
          { h: `<span class="tog"></span>` }, { h: "Weekly board pack" }, { h: "Mondays, 07:00", cls: "num" },
          { h: "Ask Filing Editor" }, { h: "Never", cls: "num" }, { h: "—" } ] }
      ])}
      ${note("Duplicating one leaves it off, so a copy cannot fire before you have read it. Last result is Started or Couldn't start — an Automation is never itself “running”.")}
    </div>`,

  contexts: () => [
    { id: "overview", label: "Overview", icon: "info", body: () =>
      pane("Overview", [
        sec("Automations", note("A standing rule: when one thing happens, do one other thing. Two triggers means two rules.")),
        sec("In this project", kv([["Rules", "4", { mono: true }], ["On", "3", { mono: true }], ["Not working", "1", { mono: true }]])),
        sec("Selected", `<div class="fld"><span class="fld-k">Name</span><span class="fld-v"><span class="inp is-filled">Nightly filing digest</span></span></div>`
          + note("<b>When</b> the clock reaches 02:00 in New York, <b>ask Filing Editor</b> to summarise last night's reports.")
          + kv([["On", `<span class="tog is-on"></span>`], ["Last result", chip("Couldn't start", "err")], ["Fired about", "184 times", { mono: true }]])),
        sec("Actions", `<div class="btn-row">${btn("Open", { k: "pri", sm: true, act: "mode:author" })}${btn("Run now", { icon: "play", sm: true })}</div>`)
      ].join("")) },

    { id: "automations", label: "Automations", icon: "bolt", body: () =>
      pane("Automations", [
        sec("Not working", row("Nightly filing digest", { icon: "warn", sub2: "Agent may not use web.search", inspect: "automation", on: true }), { count: 1, flush: true }),
        sec("On", [row("Refresh outage summary", { icon: "ok", sub2: "When SharePoint syncs", inspect: "automation" }), row("Brief on new finding", { icon: "ok", sub2: "When a finding is accepted", inspect: "automation" })].join(""), { count: 2, flush: true }),
        sec("Off", row("Weekly board pack", { icon: "power", sub2: "Never fired", inspect: "automation" }), { count: 1, flush: true })
      ].join(""), { actions: `${btn("New", { icon: "plus", sm: true, k: "pri" })}${btn("Open", { sm: true, act: "mode:author" })}${btn("Run now", { icon: "play", sm: true })}${btn("Duplicate", { icon: "copy", sm: true })}`, search: search("Search Automations") }) },

    { id: "triggers", label: "When", icon: "clock", body: () =>
      pane("When", [
        sec("On a schedule", kv([["At", "02:00 daily", { mono: true }], ["Timezone", "America/New_York", { mono: true }], ["Next", "Tomorrow, 02:00", { mono: true }]]) + `<div class="chips" style="margin-top:6px">${chip("Chosen", "act")}</div>`),
        sec("Something changes", note("A kind of resource, or one exact resource."), { shut: true }),
        sec("A connector syncs", note("One connector."), { shut: true }),
        sec("A finding is accepted", note("Optionally only under one question."), { shut: true }),
        sec("Only when I say", note("Never fires on its own. Run now is the point of it."), { shut: true })
      ].join("")) },

    { id: "actions", label: "Do this", icon: "spark", body: () =>
      pane("Do this", [
        sec("Ask an agent", kv([["Agent", "Filing Editor"], ["Ask it to", "Summarise last night's outage reports…"]]) + `<div class="chips" style="margin-top:6px">${chip("Chosen", "act")}</div>`),
        sec("Re-run a generated block", [row("Outage summary", { icon: "spark", sub2: "In Q3 Resilience Memo", inspect: "refresh-action" }), row("Storm precedent brief", { icon: "spark", sub2: "In Storm Hardening Options", inspect: "refresh-action" })].join(""), { flush: true, shut: true })
      ].join("")) },

    { id: "health", label: "Health", icon: "pulse", body: () =>
      pane("Health", [
        sec("Not working", row("Nightly filing digest", { icon: "warn", sub2: "Today, 02:00 · tool not permitted", inspect: "last-run", on: true }), { count: 1, flush: true }),
        sec("Never fired", row("Weekly board pack", { icon: "power", sub2: "Off", inspect: "automation" }), { count: 1, flush: true }),
        sec("Working", [row("Refresh outage summary", { icon: "ok", sub2: "~412 times" }), row("Brief on new finding", { icon: "ok", sub2: "~37 times" })].join(""), { count: 2, flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("No fabricated timeline. There is no run table, no retry model and no history beyond the last fire.")}</div>`
      ].join("")) }
  ],

  inspectors: {
    automation: { crumbs: [["Automations", null], ["Nightly filing digest", null]], body: [
      sec("This rule", `<div class="fld"><span class="fld-k">Name</span><span class="fld-v"><span class="inp is-filled">Nightly filing digest</span></span></div>` + kv([["On", `<span class="tog is-on"></span>`]]) + `<div style="margin-top:8px">${note("<b>When</b> the clock reaches 02:00 in New York, <b>ask Filing Editor</b> to summarise last night's reports.")}</div>` + `<div class="btn-row" style="margin-top:8px">${btn("Open", { k: "pri", act: "mode:author" })}${btn("Run now", { icon: "play" })}</div>`),
      sec("Last fired", kv([["When", "Today, 02:00", { mono: true }], ["Result", chip("Couldn't start", "err")], ["Why", "Filing Editor may not use web.search"]])),
      sec("Attribution", kv([["Created by", who("Mira Jain", "actor")], ["Revision", "4", { mono: true }]]), { shut: true }),
      sec("Removal", gap("Turning it off is the safe removal. Hard deletion can break historical actor labels, so Delete stays gated until a tombstone policy exists."))
    ].join("") },

    "schedule-trigger": { crumbs: [["Automations", "automation"], ["When", null]], body: [
      sec("On a schedule", kv([["At", "02:00", { mono: true }], ["Repeats", `<span class="chips">${chip("Daily", "act")}${chip("Weekdays")}${chip("Weekly")}${chip("Custom")}</span>`], ["Timezone", "America/New_York", { mono: true }]])),
      sec("Next", kv([["Next fire", "Tomorrow, 02:00", { mono: true }]]) + note("Supplied by the scheduler.")),
      sec("Advanced", kv([["Cron", "0 2 * * *", { mono: true }]]) + note("Shown for people who want it. Invalid cron and unsupported timezone are reported separately."), { shut: true })
    ].join("") },

    "agent-action": { crumbs: [["Automations", "automation"], ["Do this", null]], body: [
      sec("Ask an agent", kv([["Agent", `${av("FE", "a1")} Filing Editor`]])),
      sec("Ask it to", `<div class="quote-v">Summarise last night's outage reports by substation and flag anything that changes the filing position.</div>` + note("Sent verbatim.")),
      sec("That agent", kv([["Can look up", "Regulatory corpus · 34"], ["Tools", "2 allowed"]]), { shut: true }),
      sec("What comes out", note("A task, marked as started by this Automation. That task is the whole trace, and it opens in the Copilot."))
    ].join("") },

    "refresh-action": { crumbs: [["Automations", "automation"], ["Do this", null], ["Outage summary", null]], body: [
      sec("Block", kv([["Prompt", "Summarise this week's outage reports by substation."], ["Lives in", "Q3 Resilience Memo · page 2"]])),
      sec("What re-running does", note("Runs the block again now, instead of waiting for someone to open the document. The block already runs on open — this is for when the answer should be ready before anyone looks.")),
      sec("Record", note("A re-run leaves no run record of its own. Only this Automation's last fire and the block's own provenance."))
    ].join("") },

    "last-run": { crumbs: [["Automations", "automation"], ["Last fired", null]], body: [
      sec("Summary", kv([["When", "Today, 02:00", { mono: true }], ["Result", chip("Couldn't start", "err")], ["Why", "Filing Editor may not use web.search"], ["Fired about", "184 times", { mono: true }]])),
      sec("What Started means", note("The task was created. Whether it finished is the task's own story, and a later failure never rewrites this line.")),
      sec("The task it made", row("Summarise overnight outage reports", { icon: "spark", sub2: "Running · step 3 of 5", inspect: "copilot.task" }), { flush: true, shut: true })
    ].join("") }
  },

  status: (s) => [
    { t: "1 Automation not working", tone: "err", icon: "warn" },
    { t: s.mode === "author" ? "Nightly filing digest" : "4 Automations", icon: "bolt" },
    { t: "~184 fires", right: true }
  ],

  notes: {
    retained: ["Library/Rule mode, selected Automation, status filter, query", "an optional typed authoring-session ID owning the trigger and action unions and dirty fields", "reload never converts a partly configured rule into an enabled one"],
    nav: ["Entry points are New Tab, Project Overview Health, and automation attribution links.", "Run now uses the saved configuration. It does not become a multi-step task editor.", "Missing Persona, connector, question or block references block save and run, and name the field."],
    revised: ["Cron moved behind Advanced. “02:00 daily, New York” is what the rule means; <code>0 2 * * *</code> is how it is stored.", "Trigger and action names are what happens, not model nouns: “A finding is accepted”, “Ask an agent to do something”.", "Success became <b>Started</b>, which is the honest word for a dispatch."],
    gaps: ["There is no run table, no retry model and no history beyond the last fire.", "Delete is gated on a tombstone or label-retention policy; turning it off is the safe action.", "The fire count is approximate and must stay labelled as such."]
  }
};
