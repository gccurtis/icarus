
/* ============================================================
   4 · Slide deck editor
   ============================================================ */
const SLIDE_TITLES = [
  "Board Update — October", "Where we stand", "Three storm events", "Feeder 12 in detail",
  "Undergrounding vs vegetation", "Cost per avoided minute", "Recommendation", "Appendix"
];

const slideRow = (n, title, on, hidden) => `
  <button class="strip-row${on ? " is-on" : ""}" type="button" data-inspect="slide">
    <span class="strip-n">${n}</span>
    <span class="strip-t">
      <span class="thumb${on ? " is-on" : ""}" style="max-width:124px">
        <span class="thumb-l" style="left:10%;top:18%;width:${40 + ((n * 7) % 40)}%;height:11%"></span>
        <span class="thumb-l" style="left:10%;top:40%;width:34%;height:6%"></span>
        <span class="thumb-l" style="left:10%;top:52%;width:28%;height:6%"></span>
        <span class="thumb-l" style="left:54%;top:40%;width:36%;height:36%"></span>
      </span>
      <span class="row-s" style="margin-top:3px">${esc(title)}${hidden ? " · hidden" : ""}</span>
    </span>
  </button>`;

const layoutCard = (name, meta, on) => `
  <button class="strip-row${on ? " is-on" : ""}" type="button" data-inspect="placeholder">
    <span class="strip-t">
      <span class="thumb${on ? " is-on" : ""}" style="max-width:96px">
        <span class="thumb-l" style="left:10%;top:16%;width:56%;height:12%"></span>
        <span class="thumb-l" style="left:10%;top:38%;width:36%;height:40%;background:color-mix(in srgb,var(--ai-b) 20%,transparent)"></span>
        <span class="thumb-l" style="left:54%;top:38%;width:36%;height:40%;background:color-mix(in srgb,var(--ai-b) 20%,transparent)"></span>
      </span>
      <span class="row-t" style="margin-top:4px">${esc(name)}</span>
      <span class="row-s">${esc(meta)}</span>
    </span>
  </button>`;

SCREENS["slides"] = {
  name: "Slide deck editor",
  path: "docs/screen-specs/slide-deck-editor.md",
  purpose:
    "One slide on a canvas, the deck in the panel, and every property of what you selected in the inspector. Shift-click to multi-select; arrange, align and format are inspector work, not a toolbar.",
  init: { ctx: "slides", inspect: "element" },
  lift: "tray",

  center: () => `
    <div style="display:flex;flex-direction:column;height:100%;min-height:0">
      <div class="canvas">
        <div class="slide">
          <div class="el is-lock" style="left:4%;top:80%;width:26%;height:9%" title="Locked layout element">
            <span class="note" style="font-size:9px">${esc(PROJECT.name)}</span>
          </div>
          <div class="el is-lock" style="left:86%;top:80%;width:10%;height:9%">
            <span class="note" style="font-size:9px;text-align:right">4 / 8</span>
          </div>
          <div class="el is-on" style="left:7%;top:11%;width:64%;height:16%" data-inspect="element">
            <span style="font-size:1.4rem;font-weight:600;letter-spacing:-.01em">Feeder 12 in detail</span>
            <span class="hnd" style="left:-4px;top:-4px"></span><span class="hnd" style="right:-4px;top:-4px"></span>
            <span class="hnd" style="left:-4px;bottom:-4px"></span><span class="hnd" style="right:-4px;bottom:-4px"></span>
          </div>
          <div class="el" style="left:7%;top:33%;width:44%;height:44%" data-inspect="nested-block">
            <span class="dp" style="font-size:.82rem;line-height:1.3rem">Three failures in eleven weeks, all traced to the same
              mis-coordinated relay pair. Customer-minutes lost exceeded every other substation combined.</span>
            <span class="chip t-ai is-sq" style="margin-top:6px">${ic("sigma", 11)} =outage.feeder12.minutes</span>
          </div>
          <div class="el" style="left:55%;top:33%;width:38%;height:44%" data-inspect="element">
            <span class="note" style="font-size:9px">Customer-minutes by event</span>
            <span style="display:flex;align-items:flex-end;gap:6px;height:78%;padding-top:4px">
              <span style="flex:1;height:44%;background:var(--int-f);border-radius:2px 2px 0 0"></span>
              <span style="flex:1;height:78%;background:var(--int-f);border-radius:2px 2px 0 0"></span>
              <span style="flex:1;height:100%;background:var(--act-f);border-radius:2px 2px 0 0"></span>
            </span>
          </div>
        </div>
        <div class="chips">
          ${chip("Snap to guides", "act")}${chip("Safe area")}<span class="note">Guides and snapping are view state, never persisted objects.</span>
        </div>
      </div>
      <div class="notes-tray">
        <div class="chips"><span class="eyebrow">Speaker notes — slide 4</span>${btn("Collapse", { k: "gh", sm: true })}</div>
        <p class="dp" style="font-size:.8125rem;line-height:1.25rem" data-inspect="notes-block">Lead with the relay finding, not the
          spend. If asked about the 2024 precedent, the docket number is in the appendix.</p>
      </div>
    </div>`,

  contexts: () => [
    { id: "slides", label: "Slides", icon: "deck", body: () =>
      pane("Slides", [
        sec("Opening", SLIDE_TITLES.slice(0, 2).map((t, i) => slideRow(i + 1, t, false)).join(""), { count: 2, flush: true }),
        sec("The case", SLIDE_TITLES.slice(2, 6).map((t, i) => slideRow(i + 3, t, i + 3 === 4)).join(""), { count: 4, flush: true }),
        sec("Close", SLIDE_TITLES.slice(6).map((t, i) => slideRow(i + 7, t, false, i === 1)).join(""), { count: 2, flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("Slides have thumbnails, not persisted names. A section is anchored to its first slide, so reordering re-interprets the boundaries.")}</div>`
      ].join(""), {
        actions: `${btn("New", { icon: "plus", sm: true, k: "pri", act: "new-slide" })}${btn("Duplicate", { icon: "copy", sm: true })}${btn("Delete", { icon: "trash", sm: true, k: "dgr" })}${btn("Hide", { icon: "eye", sm: true })}`
      }) },

    { id: "overview", label: "Overview", icon: "info", body: () =>
      pane("Overview", [
        sec("This deck", `<div class="fld"><span class="fld-k">Title</span><span class="fld-v"><span class="inp is-filled">Board Update — October</span></span></div>` + kv([["Slides", "8", { mono: true }], ["Aspect ratio", `<span class="chips">${chip("16:9", "act")}${chip("4:3")}</span>`]])),
        sec("Editing now", row("Tomas Kaur", { icon: "eye", sub2: "slide 6", inspect: "actor" }), { count: 1, flush: true }),
        sec("Saved", chip("All changes saved", "ok")),
        sec("From template", kv([["Template", "Board update"]]), { shut: true })
      ].join("")) },

    { id: "layers", label: "Layers", icon: "layers", body: () =>
      pane("Layers", [
        sec("Slide objects", [
          row("Chart element", { icon: "chart", sub2: "Front", inspect: "element" }),
          row("Body text", { icon: "type", sub2: "Middle", inspect: "nested-block" }),
          row("Title", { icon: "type", sub2: "Back", inspect: "element", on: true })
        ].join(""), { count: 3, flush: true }),
        sec("Layout objects", [row("Footer wordmark", { icon: "lock", sub2: "Locked · layout-owned", inspect: "locked-element" }), row("Slide number", { icon: "lock", sub2: "Locked · layout-owned", inspect: "locked-element" })].join(""), { count: 2, flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("Shift-click on the canvas or here to select several. Arrange, align and distribute appear in the inspector once more than one is selected.")}${gap("Cross-layer order between layout-owned and slide-owned objects is unresolved in the model.")}</div>`
      ].join(""), { actions: `${btn("Front", { sm: true })}${btn("Forward", { sm: true })}${btn("Back", { sm: true })}${btn("Behind", { sm: true })}` }) },

    { id: "find", label: "Find", icon: "search", body: () =>
      pane("Find", sec("Results", [
        row("…mis-coordinated <b>relay</b> pair…", { right: "s.4", sub2: "Body text · block b_2c8", on: true }),
        row("…the <b>relay</b> log confirms…", { right: "s.7", sub2: "Speaker notes" }),
        row("…<b>relay</b> coordination study, 2024…", { right: "s.8", sub2: "Appendix table" })
      ].join(""), { count: 3, flush: true }), { search: search("Search deck", "relay") }) },

    { id: "layouts", label: "Layouts", icon: "template", body: () =>
      pane("Layouts", [
        sec("Current", layoutCard("Title and two panes", "2 placeholders · 2 locked", true), { flush: true }),
        sec("Deck layouts", [layoutCard("Title slide", "1 placeholder · 2 locked"), layoutCard("Section break", "1 placeholder · 1 locked"), layoutCard("Full-bleed chart", "1 placeholder · 2 locked"), layoutCard("Blank", "no placeholders")].join(""), { count: 4, flush: true })
      ].join(""), { actions: `${btn("Apply", { sm: true, k: "pri" })}${btn("Reset to layout", { sm: true, dis: true })}${btn("Edit layout", { sm: true })}` }) },

    { id: "insert", label: "Insert", icon: "plus", body: () =>
      pane("Insert", [
        sec("Basics", [row("Text", { icon: "type" }), row("Image", { icon: "img" }), row("Table", { icon: "sheet" })].join(""), { flush: true }),
        sec("Data and AI", [row("Embed", { icon: "link" }), row("Formula", { icon: "sigma" }), row("Prompt block", { icon: "spark" }), row("Variable", { icon: "hash" })].join(""), { flush: true })
      ].join("")) },

    { id: "theme", label: "Theme", icon: "pal", body: () =>
      pane("Theme", [
        sec("Theme", kv([["Background", `<span class="chips">${chip("Paper", "act")}</span>`], ["Font", "IBM Plex Sans"], ["Palette", `<span class="chips">${chip("&nbsp;", "int")}${chip("&nbsp;", "act")}${chip("&nbsp;", "a2")}${chip("&nbsp;", "a1")}</span>`]])),
        sec("Named styles", [row("Slide title", { icon: "type", sub2: "24/32 · 600", inspect: "named-style-deck" }), row("Body", { icon: "type", sub2: "13/20 · 400", inspect: "named-style-deck" }), row("Caption", { icon: "type", sub2: "10/14 · mono", inspect: "named-style-deck" })].join(""), { count: 3, flush: true, shut: true })
      ].join("")) },

    { id: "notes", label: "Notes", icon: "quote", body: () =>
      pane("Notes", [
        sec("Slide 4", note("Lead with the relay finding, not the spend. If asked about the 2024 precedent, the docket number is in the appendix.")),
        sec("Deck", [row("1 · Board Update — October", { sub2: "No notes" }), row("2 · Where we stand", { sub2: "Two paragraphs" }), row("3 · Three storm events", { sub2: "One paragraph" }), row("4 · Feeder 12 in detail", { sub2: "One paragraph", on: true })].join(""), { flush: true })
      ].join("")) },

    { id: "variables", label: "Variables", icon: "hash", body: VARIABLES },

    { id: "comments", label: "Comments", icon: "comment", body: () =>
      pane("Comments", [
        `<div class="chips" style="padding:0 calc(var(--u)*3) calc(var(--u)*2)">${chip("Deck")}${chip("Slide 4", "act")}${chip("Element")}</div>`,
        sec("Open", row("Tomas Kaur", { icon: "at", sub2: "“@ana is this the chart you wanted…”", right: "4h", inspect: "comment-deck", on: true }), { count: 1, flush: true }),
        sec("Resolved", note("Nothing resolved yet."), { count: 0, shut: true })
      ].join("")) },

    { id: "context", label: "Context", icon: "target", body: () =>
      pane("Context", sec("Saved Contexts", [row("Field reports 2024–25", { icon: "target", right: "96", on: true }), row("Regulatory corpus", { icon: "target", right: "34" })].join(""), { count: 2, flush: true }), { foot: btn("Open Context screen", { k: "gh" }) }) }
  ],

  inspectors: {
    element: { crumbs: [["Deck", "deck"], ["Slide 4", "slide"], ["Element", null]], body: [
      sec("Content", `<div class="quote-v">Feeder 12 in detail</div>` + `<div class="btn-row" style="margin-top:6px">${btn("Edit text", { sm: true, inspect: "nested-block" })}</div>`),
      sec("Position and size", kv([["X", "0.070", { mono: true }], ["Y", "0.110", { mono: true }], ["Width", "0.640", { mono: true }], ["Height", "0.160", { mono: true }], ["Rotation", "0°", { mono: true }]]) + note("Frames are fractions in the model and pixels under the pointer.")),
      sec("Arrange", `<div class="btn-row">${btn("Front", { sm: true })}${btn("Forward", { sm: true })}${btn("Back", { sm: true })}${btn("Behind", { sm: true })}</div>` + note("Shift-click a second element and align and distribute appear here.")),
      sec("Overflow", `<div class="chips">${chip("Clip")}${chip("Shrink", "act")}${chip("Grow")}</div>`),
      sec("Box format", kv([["Fill", "None"], ["Border", "None"], ["Padding", "8 pt", { mono: true }]]), { shut: true }),
      sec("Placeholder origin", kv([["From placeholder", "title", { mono: true }], ["Reset eligible", "Yes — one match in this layout"]]) + gap("<code>SlidePlaceholder</code> has no stable key. Duplicate-role reset stays gated."), { shut: true })
    ].join("") },

    "multi-element": { crumbs: [["Deck", "deck"], ["Slide 4", "slide"], ["3 elements", null]], body: [
      sec("Selection", `<div class="chips">${chip("Title", "act")}${chip("Body text", "act")}${chip("Chart", "act")}</div>` + note("Shift-click added these. Everything below applies to all three.")),
      sec("Align", `<div class="btn-row">${btn("Left", { sm: true })}${btn("Centre", { sm: true })}${btn("Right", { sm: true })}${btn("Top", { sm: true })}${btn("Middle", { sm: true })}${btn("Bottom", { sm: true })}</div>`),
      sec("Distribute", `<div class="btn-row">${btn("Horizontally", { sm: true })}${btn("Vertically", { sm: true })}</div>`),
      sec("Arrange", `<div class="btn-row">${btn("Group", { sm: true })}${btn("Front", { sm: true })}${btn("Back", { sm: true })}</div>`),
      sec("Shared geometry", kv([["Width", "Mixed"], ["Height", "Mixed"], ["Rotation", "0°", { mono: true }]])),
      sec("Shared format", note("Fill, border and padding differ across the selection. Setting one here sets all three.")),
    ].join("") },

    "nested-block": { crumbs: [["Deck", "deck"], ["Slide 4", "slide"], ["Element", "element"], ["Text block", null]], body: [
      sec("Text", `<div class="quote-v">Three failures in eleven weeks, all traced to the same mis-coordinated relay pair.</div>`),
      sec("Style", kv([["Named style", "Body"], ["Alignment", `<span class="chips">${chip("Left", "act")}${chip("Center")}${chip("Right")}</span>`]])),
      sec("Marks", `<div class="chips">${chip("<b>B</b>")}${chip("<i>I</i>")}${chip("<u>U</u>")}${chip("Link")}</div>`),
      sec("Inline formula", row("=outage.feeder12.minutes", { icon: "sigma", sub2: "1,842,000 · read when the slide is shown", inspect: "variable" }), { flush: true }),
      sec("Ancestry", note("The element is the spatial container; the block is the ordinary content object inside it. Element frame, rotation and overflow never leak into block content."), { shut: true })
    ].join("") },

    "locked-element": { crumbs: [["Deck", "deck"], ["Layout", null], ["Locked element", null]], body: [
      sec("Content", `<div class="quote-v">Northwind Grid Resilience</div>`),
      sec("Frame", kv([["X", "0.040", { mono: true }], ["Y", "0.800", { mono: true }], ["Width", "0.260", { mono: true }], ["Owner", chip("Layout", "off")]])),
      sec("Editing", note("Layout-owned and editable only in Layout mode. Selecting it there names Layout, not Slide, as its owner."))
    ].join("") },

    slide: { crumbs: [["Deck", "deck"], ["Slide 4", null]], body: [
      sec("Slide", kv([["Layout", "Title and two panes"], ["Section", "The case"], ["Hidden", `<span class="tog"></span>`], ["Background", "Inherited from layout"]])),
      sec("Actions", `<div class="btn-row">${btn("Duplicate", { icon: "copy", sm: true })}${btn("New after", { icon: "plus", sm: true, act: "new-slide" })}${btn("Delete", { icon: "trash", sm: true, k: "dgr" })}</div>`),
      sec("Notes", note("One paragraph."), { shut: true }),
      sec("Reset", `<div class="btn-row">${btn("Reset to layout", { dis: true })}</div>` + note("Available only when <code>fromPlaceholder</code> resolves to exactly one role."), { shut: true })
    ].join("") },

    deck: { crumbs: [["Deck", null]], body: [
      sec("This deck", `<div class="fld"><span class="fld-k">Title</span><span class="fld-v"><span class="inp is-filled">Board Update — October</span></span></div>` + kv([["Slides", "8", { mono: true }], ["Aspect ratio", chip("16:9", "off")], ["Saved", chip("All changes saved", "ok")]])),
      sec("Nothing selected", note("Click an element to change it. Shift-click for several. New, duplicate and delete are at the top of the Slides panel.")),
      sec("Handout", kv([["Paper", "Letter"], ["Slides per page", "3", { mono: true }]]), { shut: true })
    ].join("") },

    theme: { crumbs: [["Deck", "deck"], ["Theme", null]], body: [
      sec("Background", kv([["Kind", "Solid"], ["Color", "Paper"]])),
      sec("Colors", `<div class="chips">${chip("Primary", "int")}${chip("Secondary", "act")}${chip("Accent 1", "a1")}${chip("Accent 2", "a2")}</div>`),
      sec("Font", kv([["Family", "IBM Plex Sans"]])),
      sec("Usage", note("Applied to 8 slides and 5 layouts."), { shut: true })
    ].join("") },

    "notes-block": { crumbs: [["Deck", "deck"], ["Slide 4", "slide"], ["Notes", null]], body: [
      sec("Notes", `<div class="quote-v">Lead with the relay finding, not the spend. If asked about the 2024 precedent, the docket number is in the appendix.</div>`),
      sec("Note", note("Notes use the same block editor and never appear on the slide canvas."))
    ].join("") },

    "named-style-deck": { crumbs: [["Deck", "deck"], ["Styles", null], ["Slide title", null]], body: [
      sec("Identity", kv([["Name", "Slide title"], ["Style key", "title", { mono: true }]])),
      sec("Typography", kv([["Family", "IBM Plex Sans"], ["Size", "24 pt", { mono: true }], ["Weight", "600", { mono: true }]])),
      sec("Usage", note("Applied to 8 elements."), { shut: true })
    ].join("") },

    "comment-deck": { crumbs: [["Deck", "deck"], ["Slide 4", "slide"], ["Comment", null]], body: [
      sec("Thread", `${chip("Open", "warn")}${chip("Mentions you", "act")}`),
      sec("Comment", `<div class="quote-v">“@ana is this the chart you wanted, on the same scale as slide 3?”</div>` + note("Tomas Kaur · 4 hours ago")),
      sec("Actions", `<div class="btn-row">${btn("Reply", { k: "pri" })}${btn("Resolve")}</div>`)
    ].join("") },

    placeholder: { crumbs: [["Deck", "deck"], ["Layout", null], ["Placeholder", null]], body: [
      sec("Placeholder", kv([["Role", "body", { mono: true }], ["Frame", "0.07 / 0.33 / 0.44 / 0.44", { mono: true }], ["Style key", "body", { mono: true }]])),
      sec("Status", gap("Read-only. Placeholders have no stable key, so they are a layout summary rather than an independently selectable object, and two with the same role cannot be told apart."))
    ].join("") },

    variable: VARIABLE_LENS
  },

  status: () => [
    { t: "All changes saved", tone: "ok", icon: "ok" },
    { t: "1 element selected", icon: "layers" },
    { t: "Slide 4 of 8", right: true },
    { t: "76%", right: true }
  ],

  notes: {
    retained: ["current slide, selected object IDs, zoom, viewport, notes expansion and height", "any open New Slide chooser state — insertion index, layout query, selected layout key", "Fabric instance, block overlay, transform gesture and undo history stay in the tab runtime"],
    nav: ["Layers owns the visible object list and the accessibility fallback. Find owns deck-wide search.", "Duplicating a slide mints new IDs for the slide and every identified descendant.", "Entering Layout mode commits or cancels the nested block edit and starts a distinct undo group."],
    revised: ["The deck header and the toolbar are gone. New, Duplicate, Delete and Hide sit at the top of the Slides panel, where the slide they act on already is.", "Arrange, align and distribute are inspector sections. Select one element for arrange; shift-click for align and distribute.", "Aspect ratio and template origin moved to the Overview panel — neither changes while you work, so neither earned permanent width."],
    gaps: ["Placeholders have no stable key — duplicate-role reset and first-class placeholder selection are gated.", "Cross-layer ordering between layout-owned and slide-owned objects is undefined in the model.", "Fabric is not installed. The adapter spike must prove IME/text alignment, nested hit testing and stable reconciliation first."]
  }
};

/* ============================================================
   5 · Spreadsheet editor
   ============================================================ */
const COLS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const SHEET_ROWS = [
  ["Substation", "Events", "Cust-min", "Underground %", "Avoided min", "Cost $M", "$/min", ""],
  ["Feeder 12", "3", "1842000", "0.04", "699960", "12.40", "17.72", ""],
  ["Ward 3", "1", "318400", "0.61", "194224", "8.10", "41.70", ""],
  ["Eastbrook", "2", "602100", "0.22", "132462", "6.90", "52.09", ""],
  ["Harlow", "2", "441800", "0.18", "79524", "5.20", "65.39", ""],
  ["Total", "8", "3204300", "", "1106170", "32.60", "29.47", ""]
];

SCREENS["spreadsheet"] = {
  name: "Spreadsheet editor",
  path: "docs/screen-specs/spreadsheet-editor.md",
  purpose:
    "A sparse SpreadsheetBody as a fast grid. Icarus owns cells, formulas, merges, spills, styles and computation. No formula bar and no name box — the inspector already shows the cell you are on and the formula in it.",
  init: { ctx: "sheets", inspect: "formula-cell" },
  lift: "bar",

  center: () => `
    <div class="grid-w">
      <div class="gscroll">
        <table class="gt">
          <thead><tr><th class="rh"></th>${COLS.map((c, i) => `<th${i === 0 ? ' class="frz"' : ""} style="width:${i === 0 ? 140 : 108}px">${c}</th>`).join("")}</tr></thead>
          <tbody>
            ${SHEET_ROWS.map((r, ri) => `<tr><td class="rh">${ri + 1}</td>${r.map((v, ci) => {
              const head = ri === 0, total = ri === 5, num = !head && /^[\d.]+$/.test(v);
              const on = ri === 2 && ci === 6, rng = ri >= 1 && ri <= 4 && ci === 6 && !on;
              const spill = ci === 4 && ri >= 1 && ri <= 4;
              const cls = [num ? "n" : "", ci === 0 ? "frz" : "", on ? "is-on" : "", rng ? "is-rng" : "", spill ? "is-spill" : ""].filter(Boolean).join(" ");
              const disp = v === "" ? "" : num && ci >= 2 ? Number(v).toLocaleString() : v;
              const target = on ? "formula-cell" : spill ? "spill" : head ? "range" : "cell";
              return `<td${cls ? ` class="${cls}"` : ""}${head || total ? ' style="font-weight:600"' : ""} data-inspect="${target}">${disp}</td>`;
            }).join("")}</tr>`).join("")}
            ${[7, 8, 9, 10, 11, 12, 13, 14].map((n) => `<tr><td class="rh">${n}</td>${COLS.map((_, ci) => `<td${ci === 0 ? ' class="frz"' : n === 8 && ci === 3 ? ' class="is-err"' : ""} data-inspect="${n === 8 && ci === 3 ? "error-cell" : "cell"}">${n === 8 && ci === 3 ? "#REF!" : ""}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div class="sheets">
        <button class="sh-t is-on" type="button" data-inspect="sheet">Cost model</button>
        <button class="sh-t" type="button" data-inspect="sheet">Event log</button>
        <button class="sh-t" type="button" data-inspect="sheet">Assumptions</button>
        <button class="sh-t" type="button" data-inspect="sheet">${ic("eye", 12)} Scratch</button>
        <button class="sh-t" type="button">${ic("plus", 13)}</button>
      </div>
    </div>`,

  contexts: () => [
    { id: "sheets", label: "Sheets", icon: "sheet", body: () =>
      pane("Sheets", sec("Sheets", [
        row("Cost model", { icon: "sheet", sub2: "A1:G6 · 1 frozen column", inspect: "sheet", on: true }),
        row("Event log", { icon: "sheet", sub2: "A1:M4183", inspect: "sheet" }),
        row("Assumptions", { icon: "sheet", sub2: "A1:C22", inspect: "sheet" }),
        row("Scratch", { icon: "eye", sub2: "Hidden", inspect: "sheet" })
      ].join(""), { count: 4, flush: true }), {
        actions: `${btn("Add", { icon: "plus", sm: true, k: "pri" })}${btn("Duplicate", { icon: "copy", sm: true })}${btn("Rename", { sm: true })}${btn("Delete", { icon: "trash", sm: true, k: "dgr" })}`
      }) },

    { id: "overview", label: "Overview", icon: "info", body: () =>
      pane("Overview", [
        sec("This workbook", `<div class="fld"><span class="fld-k">Title</span><span class="fld-v"><span class="inp is-filled">Outage Cost Model</span></span></div>` + kv([["Sheets", "4", { mono: true }], ["Populated cells", "1,204", { mono: true }]])),
        sec("Calculation", `${chip("Up to date", "ok")}` + note("Every formula reads its inputs when it runs. There is no cached result to fall behind.")),
        sec("Saved", chip("All changes saved", "ok")),
        sec("From template", kv([["Template", "Cost model skeleton"]]), { shut: true })
      ].join("")) },

    { id: "variables", label: "Variables", icon: "hash", body: VARIABLES },

    { id: "names", label: "Named ranges", icon: "pin", body: () =>
      pane("Named ranges", sec("This workbook", [
        row("costModel", { icon: "pin", sub2: "Cost model!A1:G6", inspect: "named-range", on: true }),
        row("eventLog", { icon: "pin", sub2: "Event log!A1:M4183", inspect: "named-range" }),
        row("assumptions", { icon: "pin", sub2: "Assumptions!A1:C22", inspect: "named-range" })
      ].join(""), { count: 3, flush: true }) + `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("Workbook-local. Project variables are in the Variables panel and are kept visibly apart from these.")}</div>`, { actions: btn("Name this range", { icon: "plus", sm: true, k: "pri" }) }) },

    { id: "find", label: "Find", icon: "search", body: () =>
      pane("Find", [
        `<div class="chips" style="padding:0 calc(var(--u)*3) calc(var(--u)*2)">${chip("All sheets", "act")}${chip("Formulas")}${chip("Values")}</div>`,
        sec("Results", [row("Cost model!G3", { sub2: "=IF(E3=0,\"\",F3*1000000/E3)", right: "fx", on: true }), row("Cost model!G4", { sub2: "=IF(E4=0,\"\",F4*1000000/E4)", right: "fx" }), row("Assumptions!B7", { sub2: "cost per avoided minute", right: "text" })].join(""), { count: 3, flush: true })
      ].join(""), { search: search("Find in workbook", "avoided") }) },

    { id: "dependencies", label: "Dependencies", icon: "branch", body: () =>
      pane("Dependencies", [
        sec("G3 reads", [row("E3", { icon: "chevR", sub2: "spill child of E2" }), row("F3", { icon: "chevR", sub2: "literal number" })].join(""), { count: 2, flush: true }),
        sec("G3 feeds", row("G6", { icon: "chevR", sub2: "=AVERAGE(G2:G5)" }), { count: 1, flush: true }),
        sec("Problems", row("D8 · #REF!", { icon: "warn", sub2: "Refers to a deleted range", inspect: "error-cell" }), { count: 1, flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("Derived from the current formulas. There is no persisted dependency graph.")}</div>`
      ].join("")) },

    { id: "objects", label: "Objects", icon: "chart", body: () =>
      pane("Objects", [
        sec("Cost model", [row("Column chart", { icon: "chart", sub2: "Anchored to E9", inspect: "chart" }), row("Line chart", { icon: "chart", sub2: "Anchored to A14 · overlapped", inspect: "chart" })].join(""), { count: 2, flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${gap("<code>SheetChart</code> has no stable <code>id</code>. Charts render read-only and identify themselves by array position for this view only.")}</div>`
      ].join("")) },

    { id: "insert", label: "Insert", icon: "plus", body: () =>
      pane("Insert", [
        sec("Charts", [row("Column", { icon: "chart" }), row("Bar", { icon: "chart" }), row("Line", { icon: "activity" }), row("Pie", { icon: "scope" })].join(""), { flush: true }),
        sec("Content", [row("Formula", { icon: "sigma" }), row("Variable", { icon: "hash" }), row("Prompt block", { icon: "spark" })].join(""), { flush: true }),
        sec("Structure", [row("Rows above", { icon: "rows" }), row("Columns left", { icon: "cols" }), row("Merge selection", { icon: "layers" })].join(""), { flush: true })
      ].join("")) },

    { id: "styles", label: "Styles", icon: "type", body: () =>
      pane("Styles", sec("Named styles", [row("Header", { icon: "type", sub2: "600 · centered", inspect: "named-style-sheet", on: true }), row("Currency", { icon: "type", sub2: "$#,##0.00", inspect: "named-style-sheet" }), row("Total", { icon: "type", sub2: "600 · top border", inspect: "named-style-sheet" })].join(""), { count: 3, flush: true }), { search: search("Search styles"), foot: btn("New style", { icon: "plus" }) }) },

    { id: "print", label: "Print", icon: "printer", body: () =>
      pane("Print", [
        sec("Page setup", kv([["Paper", "Letter"], ["Orientation", "Landscape"], ["Scale", "Fit to 1 page wide", { mono: true }]])),
        sec("Area and repeats", kv([["Print area", "A1:G6", { mono: true }], ["Repeat rows", "1:1", { mono: true }], ["Repeat columns", "A:A", { mono: true }]])),
        sec("Show", kv([["Gridlines", `<span class="tog"></span>`], ["Headings", `<span class="tog"></span>`]]), { shut: true })
      ].join("")) },

    { id: "comments", label: "Comments", icon: "comment", body: () =>
      pane("Comments", [
        `<div class="chips" style="padding:0 calc(var(--u)*3) calc(var(--u)*2)">${chip("Workbook")}${chip("Cost model", "act")}</div>`,
        sec("Open", row("Mira Jain on C2", { icon: "at", sub2: "“@ana corrected total or the old one?”", right: "1d", inspect: "comment-sheet", on: true }), { count: 1, flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${gap("Persisted anchors are workbook, cell, or text range only — a range, chart, row or column cannot be commented on.")}</div>`
      ].join("")) },

    { id: "context", label: "Context", icon: "target", body: () =>
      pane("Context", sec("Saved Contexts", [row("Field reports 2024–25", { icon: "target", right: "96" }), row("Regulatory corpus", { icon: "target", right: "34" })].join(""), { count: 2, flush: true }), { foot: btn("Open Context screen", { k: "gh" }) }) }
  ],

  inspectors: {
    "formula-cell": { crumbs: [["Workbook", "workbook"], ["Cost model", "sheet"], ["G3", null]], body: [
      sec("Cell", kv([["Address", "G3", { mono: true }], ["Shows", "41.70", { mono: true }], ["Type", "number", { mono: true }]])),
      sec("Formula", `<div class="inp is-filled" style="height:auto;padding:8px;align-items:flex-start;font-family:var(--mono);font-size:var(--t-mono)"><span class="inp-w" style="white-space:pre-wrap">=IF(E3=0,"",F3*1000000/E3)</span></div>` + note("Edited here or in the cell. There is no separate formula bar taking a row off the grid.")),
      sec("Reads", [row("E3", { icon: "chevR", sub2: "194,224 · spill child of E2" }), row("F3", { icon: "chevR", sub2: "8.10" })].join(""), { count: 2, flush: true }),
      sec("Feeds", row("G6", { icon: "chevR", sub2: "=AVERAGE(G2:G5)" }), { count: 1, flush: true, shut: true }),
      sec("Format", kv([["Style", "Currency"], ["Alignment", "Right"], ["Value format", "#,##0.00", { mono: true }]]), { shut: true })
    ].join("") },

    cell: { crumbs: [["Workbook", "workbook"], ["Cost model", "sheet"], ["C3", null]], body: [
      sec("Cell", kv([["Address", "C3", { mono: true }], ["Value", "318,400", { mono: true }], ["Type", "number", { mono: true }]]) + note("A cell's identity is its A1 address. Rows and columns are not identified model objects.")),
      sec("Content", `<div class="inp is-filled" style="font-family:var(--mono);font-size:var(--t-mono)"><span class="inp-w">318400</span></div>`),
      sec("Format", kv([["Style", "Currency"], ["Alignment", "Right"], ["Value format", "#,##0", { mono: true }]])),
      sec("Merge and spill", note("Not part of a merge or spill range."), { shut: true })
    ].join("") },

    "error-cell": { crumbs: [["Workbook", "workbook"], ["Cost model", "sheet"], ["D8", null]], body: [
      sec("Problem", `${chip("#REF!", "err")}` + note("This formula refers to a range that no longer exists. The formula is kept exactly as written so it can be repaired rather than guessed at.")),
      sec("Formula", `<div class="inp is-filled" style="font-family:var(--mono);font-size:var(--t-mono)"><span class="inp-w">=SUM(#REF!)</span></div>`),
      sec("Actions", `<div class="btn-row">${btn("Pick a new range", { k: "pri" })}${btn("Clear cell", { k: "dgr" })}</div>`)
    ].join("") },

    range: { crumbs: [["Workbook", "workbook"], ["Cost model", "sheet"], ["A1:G1", null]], body: [
      sec("Range", kv([["A1 range", "A1:G1", { mono: true }], ["Cells with content", "7 of 7", { mono: true }]])),
      sec("Shared formatting", kv([["Style", "Header"], ["Alignment", "Mixed"], ["Fill", "Mixed"]])),
      sec("Aggregate", kv([["Count", "7", { mono: true }]]), { shut: true }),
      sec("Actions", `<div class="btn-row">${btn("Name this range", { icon: "pin", sm: true })}${btn("Merge", { sm: true })}${btn("Clear", { sm: true, k: "dgr" })}</div>`),
      sec("Empty coordinates", gap("Formatting applies only to existing blocks. Empty cells have no persisted block to store fill, border, alignment or value format on."), { shut: true })
    ].join("") },

    spill: { crumbs: [["Workbook", "workbook"], ["Cost model", "sheet"], ["E3", null]], body: [
      sec("Spill", kv([["Origin", "E2", { mono: true }], ["Occupied", "E2:E5", { mono: true }], ["Status", chip("Read-only child", "a2")]])),
      sec("Origin formula", `<div class="inp is-filled" style="font-family:var(--mono);font-size:var(--t-mono)"><span class="inp-w">=avoidedMinutes(costModel)</span></div>`),
      sec("Behavior", note("A write into the occupied range fails visibly and names the origin."))
    ].join("") },

    sheet: { crumbs: [["Workbook", "workbook"], ["Cost model", null]], body: [
      sec("Sheet", `<div class="fld"><span class="fld-k">Name</span><span class="fld-v"><span class="inp is-filled">Cost model</span></span></div>` + kv([["Used extent", "A1:G6", { mono: true }], ["Frozen", "1 column", { mono: true }], ["Hidden", `<span class="tog"></span>`]])),
      sec("Actions", `<div class="btn-row">${btn("Duplicate", { icon: "copy", sm: true })}${btn("Move", { sm: true })}${btn("Delete", { icon: "trash", sm: true, k: "dgr" })}</div>`),
      sec("Print setup", kv([["Area", "A1:G6", { mono: true }], ["Orientation", "Landscape"]]), { shut: true })
    ].join("") },

    chart: { crumbs: [["Workbook", "workbook"], ["Cost model", "sheet"], ["Chart", null]], body: [
      sec("Chart", kv([["Type", "Column"], ["Source range", "A1:C5", { mono: true }], ["Title", "Customer-minutes by substation"]])),
      sec("Placement", kv([["Anchor", "E9", { mono: true }], ["Size", "360 × 220 px", { mono: true }]]), { shut: true }),
      sec("Status", gap("Read-only. Without a stable <code>id</code> an array index cannot support granular updates, remote reconciliation, retained selection, or comments."))
    ].join("") },

    "named-range": { crumbs: [["Workbook", "workbook"], ["Named range", null]], body: [
      sec("Name", kv([["Name", "costModel", { mono: true }], ["Sheet", "Cost model"], ["Range", "A1:G6", { mono: true }]])),
      sec("Usage", note("Referenced by 3 formulas."), { shut: true })
    ].join("") },

    "named-style-sheet": { crumbs: [["Workbook", "workbook"], ["Styles", null], ["Header", null]], body: [
      sec("Identity", kv([["Name", "Header"], ["Weight", "600", { mono: true }], ["Alignment", "Center"]])),
      sec("Usage", note("Applied to 7 cells."), { shut: true })
    ].join("") },

    "comment-sheet": { crumbs: [["Workbook", "workbook"], ["Cost model", "sheet"], ["C2", null], ["Comment", null]], body: [
      sec("Thread", `${chip("Open", "warn")}${chip("Mentions you", "act")}`),
      sec("Comment", `<div class="quote-v">“@ana corrected total or the old one? The event log says 1,840,200.”</div>` + note("Mira Jain · yesterday")),
      sec("Actions", `<div class="btn-row">${btn("Reply", { k: "pri" })}${btn("Resolve")}</div>`)
    ].join("") },

    workbook: { crumbs: [["Workbook", null]], body: [
      sec("This workbook", `<div class="fld"><span class="fld-k">Title</span><span class="fld-v"><span class="inp is-filled">Outage Cost Model</span></span></div>` + kv([["Sheets", "4", { mono: true }], ["Saved", chip("All changes saved", "ok")]])),
      sec("Nothing selected", note("Click a cell to see what is in it. Selecting a range offers formatting, naming and merge.")),
      sec("Calculation", note("Icarus's formula engine is the only calculation authority. Every formula reads its inputs when it runs."))
    ].join("") },

    variable: VARIABLE_LENS
  },

  status: () => [
    { t: "1 formula error", tone: "err", icon: "warn" },
    { t: "G3 · sum 176.90 · avg 44.23 · count 4", icon: "sigma" },
    { t: "Cost model", right: true },
    { t: "100%", right: true }
  ],

  notes: {
    retained: ["current sheet ID, A1 selection, viewport anchor, zoom, find query", "Univer instance, nested block editor, calculation buffers and undo history stay in the tab runtime", "reload validates the sheet and range against current extents, then falls back to the first visible sheet and <code>A1</code>"],
    nav: ["Find owns workbook search; Dependencies is computed; Objects owns charts and overlays.", "Icarus's formula engine is the only calculation authority — Univer's is bypassed entirely.", "Row and column insert/delete needs one structural-rebase contract covering A1 keys, formulas, comments, named ranges, merges, spills and chart anchors — atomically, or rejected with work preserved."],
    revised: ["The formula bar and the name box are gone. The inspector already names the cell and holds its formula, with what it reads and what it feeds underneath.", "The toolbar is gone. Formatting is a section of whatever cell or range is selected.", "Project variables and workbook named ranges are two separate panels, so the two scopes cannot be mistaken for each other."],
    gaps: ["<code>SheetChart</code> has no stable ID, so chart creation and editing are gated.", "Empty cells have no persisted block, so range styling of empty coordinates cannot be stored.", "Comments cannot anchor to a range, chart, row, column or sheet.", "Editing a formula without a formula bar means in-cell editing must be excellent, and long formulas need somewhere to breathe in a 320px panel."]
  }
};

/* ============================================================
   6 · Research
   ============================================================ */
SCREENS["research"] = {
  name: "Research",
  path: "docs/screen-specs/research.md",
  purpose:
    "Anchored to the question you just asked. The answer sits beside what it produced — findings you accept, the sources behind them, and the trace of how they were found. Earlier turns are history, not a scrollback you live in.",
  init: { ctx: "history", inspect: "finding" },
  noCopilot: true,

  center: () => `
    <div class="shead">
      <span class="shead-t">Why did Feeder 12 fail twice?</span>
      ${chip("Question", "a1")}
      <div class="shead-r">
        <button class="cop-sel" type="button" data-inspect="thread">${av("GA", "ai")} Grid Analyst ${ic("chevD", 12)}</button>
        ${btn("New thread", { sm: true, icon: "plus" })}
      </div>
    </div>
    <div class="wrap is-wide" style="padding-top:calc(var(--u)*5)">
      <div class="turn">
        <div style="display:flex;flex-direction:column;gap:calc(var(--u)*4)">
          <div class="ask">
            <span class="eyebrow">You asked · 10:21</span>
            <p class="ask-q">Was the coordination study ever redone after the 2024 reconductoring?</p>
            <div class="chips">${chip(ic("target", 11) + " Field reports 2024–25", "a2")}${chip(ic("scope", 11) + " Web", "int")}</div>
          </div>

          <div class="answer">
            <p class="dp" style="font-size:.9375rem">No study dated after the 2024 reconductoring appears in either the
              filings index or the Commission's public docket. The reconductoring raised available fault current on the
              Feeder 12 / Eastbrook tie by roughly 18%, which is enough to invalidate the 2019 coordination settings —
              and the two 2026 failures both cleared upstream of the intended device.</p>
            <div style="display:flex;flex-direction:column;gap:6px">
              <button class="cite" type="button" data-inspect="source">
                <span class="row-i">${ic("folder", 14)}</span>
                <span class="cite-m"><span class="row-t">feeder-12-relay.pdf · p.7</span>
                  <span class="row-s">“…the recloser operated at 0.42 s, ahead of the 0.61 s fuse clearing time…”</span></span>
              </button>
              <button class="cite" type="button" data-inspect="source">
                <span class="row-i">${ic("link", 14)}</span>
                <span class="cite-m"><span class="row-t">nerc.gov/docket/2024-882</span>
                  <span class="row-s">Reconductoring approval — no coordination study attached</span></span>
              </button>
            </div>
            <div class="chips">
              <button class="trace" type="button" data-inspect="tool-call">${ic("layers", 12)} lattice.retrieve · 4 regions · 1.2 s</button>
              <button class="trace" type="button" data-inspect="tool-call">${ic("scope", 12)} web.search · 2 results · 2.8 s</button>
            </div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:calc(var(--u)*3)">
          <div class="hd">
            <div class="hd-m"><span class="eyebrow">Findings from this answer</span></div>
            <div class="hd-a"><span class="note">2 proposed · 1 accepted</span></div>
          </div>

          <div class="finding-c is-on" data-inspect="finding">
            <div class="chips">${chip("Proposed", "a2")}</div>
            <span class="card-t">No coordination study exists after the 2024 reconductoring</span>
            <span class="card-s">Neither the filings index nor the public docket lists one, and the reconductoring raised
              fault current by ~18%.</span>
            <div class="chips">${chip("2 sources")}${chip("Supports H-3", "ok")}</div>
            <div class="btn-row">${btn("Accept", { k: "pri", sm: true, icon: "check" })}${btn("Edit", { sm: true })}${btn("Dismiss", { sm: true, k: "gh" })}</div>
          </div>

          <div class="finding-c" data-inspect="finding">
            <div class="chips">${chip("Proposed", "a2")}</div>
            <span class="card-t">The 2019 settings are invalid at current fault levels</span>
            <span class="card-s">An implication, not a quotation — no source says this outright.</span>
            <div class="chips">${chip("2 sources")}${chip("Inference", "warn")}</div>
            <div class="btn-row">${btn("Accept", { k: "pri", sm: true, icon: "check" })}${btn("Edit", { sm: true })}${btn("Dismiss", { sm: true, k: "gh" })}</div>
          </div>

          <div class="finding-c is-accepted" data-inspect="finding-accepted">
            <div class="chips">${chip("Accepted", "ok")}${chip("In the lattice", "ai")}</div>
            <span class="card-t">Relay pair mis-coordinated since 2024</span>
            <span class="card-s">Accepted from the 10:14 answer. Retrievable everywhere in the project.</span>
          </div>

          ${note("A finding is a conclusion you accept, not a passage you copied. Accepting it is what puts it in the lattice, which is why the model asks rather than writes.")}
        </div>
      </div>

      <div style="border:1px solid var(--bd);border-radius:var(--r-pan);background:var(--elev);box-shadow:var(--sh-pan)">
        <div style="display:flex;align-items:center;gap:calc(var(--u)*2);padding:calc(var(--u)*2) calc(var(--u)*3);border-bottom:1px solid var(--bd)">
          ${chip("Question mode", "a1")}<span class="note">anchored to Q-14</span>
          <span style="margin-inline-start:auto" class="chips">${btn("Context", { icon: "target", sm: true })}${btn("Web", { icon: "scope", sm: true })}</span>
        </div>
        <div style="padding:calc(var(--u)*3);display:flex;align-items:center;gap:calc(var(--u)*3)">
          <span class="note" style="flex:1">Ask the next question…</span>
          <button class="cop-send" type="button" aria-label="Send">${ic("up", 14)}</button>
        </div>
      </div>
    </div>`,

  contexts: () => [
    { id: "history", label: "History", icon: "clock", body: () =>
      pane("History", [
        sec("This thread", [
          row("Was the coordination study ever redone?", { icon: "chevR", sub2: "10:21 · 2 findings proposed", right: "now", on: true }),
          row("Why did Feeder 12 fail twice?", { icon: "chevR", sub2: "10:14 · 1 finding accepted", right: "7m" }),
          row("What does the event log show for January?", { icon: "chevR", sub2: "10:02 · no findings", right: "19m" })
        ].join(""), { count: 3, flush: true }),
        sec("Other threads", [
          row("Undergrounding beats vegetation management", { icon: "flask", sub2: "Hypothesis · 22 turns" }),
          row("Winter storm precedents", { icon: "flask", sub2: "Discover · 9 turns" })
        ].join(""), { count: 2, flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("Each turn is a prompt and what it produced. Selecting one brings it to the centre — the screen is anchored to one turn rather than scrolled through all of them.")}</div>`
      ].join(""), { actions: btn("New thread", { icon: "plus", sm: true, k: "pri" }), search: search("Search turns") }) },

    { id: "inquiry", label: "Inquiry", icon: "flask", body: () =>
      pane("Inquiry", [
        sec("Questions", [
          row("Why do feeders fail repeatedly?", { icon: "flask", sub2: "Investigating", inspect: "question" }),
          row("Why did Feeder 12 fail twice?", { icon: "flask", sub2: "Investigating · anchored", inspect: "question", sub: true, on: true }),
          row("Is Eastbrook exposed the same way?", { icon: "flask", sub2: "Open", inspect: "question", sub: true }),
          row("What did the 2024 study assume?", { icon: "ok", sub2: "Answered", inspect: "question", sub: true })
        ].join(""), { count: 4, flush: true }),
        sec("Hypotheses", [
          row("Relay coordination was never redone", { icon: "target", sub2: "Testing · confidence 0.7", inspect: "hypothesis" }),
          row("Vegetation was the shared cause", { icon: "target", sub2: "Refuted · confidence 0.9", inspect: "hypothesis" })
        ].join(""), { count: 2, flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("Answering a child does not answer its parent. Assessment is a human judgment, never a tally of supporting findings.")}</div>`
      ].join(""), { actions: `${btn("Question", { icon: "plus", sm: true })}${btn("Hypothesis", { icon: "plus", sm: true })}` }) },

    { id: "findings", label: "Findings", icon: "quote", body: () =>
      pane("Findings", [
        sec("Proposed here", [
          row("No coordination study after 2024", { icon: "quote", sub2: "From this turn", inspect: "finding", on: true }),
          row("2019 settings invalid at current fault levels", { icon: "quote", sub2: "Inference", inspect: "finding" })
        ].join(""), { count: 2, flush: true }),
        sec("Accepted in this thread", [
          row("Relay pair mis-coordinated since 2024", { icon: "ok", sub2: "Supports H-3", inspect: "finding-accepted" }),
          row("January and March share a sequence", { icon: "ok", sub2: "Neutral", inspect: "finding-accepted" })
        ].join(""), { count: 2, flush: true }),
        sec("Elsewhere in the project", row("Undergrounding cut SAIDI 38% in Ward 3", { icon: "ok", inspect: "finding-accepted" }), { count: 1, flush: true, shut: true })
      ].join("")) },

    { id: "sources", label: "Sources", icon: "book", body: () =>
      pane("Sources", [
        sec("This turn", [row("feeder-12-relay.pdf", { icon: "folder", sub2: "p.7 · excerpt", inspect: "source", on: true }), row("nerc.gov/docket/2024-882", { icon: "link", sub2: "Web · captured 10:21", inspect: "source" })].join(""), { count: 2, flush: true }),
        sec("Whole thread", [row("storm-log-2026-01.csv", { icon: "sheet", right: "2", inspect: "source" }), row("2019 coordination study.pdf", { icon: "folder", right: "1", inspect: "source" })].join(""), { count: 6, flush: true }),
        `<div style="padding:calc(var(--u)*3) calc(var(--u)*3) 0">${note("A derived ledger of what has been used. No persisted Reviewed or Accepted state exists on a source — only on a finding.")}</div>`
      ].join(""), { search: search("Filter sources") }) },

    { id: "trace", label: "Trace", icon: "wrench", body: () =>
      pane("Trace", [
        sec("This turn · 10:21", [row("lattice.retrieve", { icon: "layers", sub2: "Success · 1.2 s · 4 regions", inspect: "tool-call", on: true }), row("web.search", { icon: "scope", sub2: "Success · 2.8 s · 2 results", inspect: "tool-call" })].join(""), { flush: true }),
        sec("10:14", [row("lattice.retrieve", { icon: "layers", sub2: "Success · 1.4 s", inspect: "tool-call" }), row("resource.read", { icon: "ok", sub2: "Success · 0.3 s", inspect: "tool-call" })].join(""), { flush: true }),
        sec("10:02", row("lattice.retrieve", { icon: "info", sub2: "No sufficiently relevant material", inspect: "tool-call" }), { flush: true })
      ].join("")) },

    { id: "context", label: "Context", icon: "target", body: () =>
      pane("Context", [
        sec("This thread searches", [row("Field reports 2024–25", { icon: "target", sub2: "96 resources", right: "96", on: true }), row("The web", { icon: "scope", sub2: "Enabled for this thread" })].join(""), { flush: true }),
        sec("Resolution", kv([["Resolved", "96 resources", { mono: true }], ["Indexed", "88 · 8 with no material", { mono: true }], ["At", "10:21:04", { mono: true }]])),
        sec("Warning", gap("An absent or empty scope searches the whole lattice. A zero-member Context is blocked rather than allowed to masquerade as “search nothing.”"))
      ].join("")) }
  ],

  inspectors: {
    finding: { crumbs: [["Research", "thread"], ["Turn", null], ["Proposed finding", null]], body: [
      sec("Finding", `<div class="chips" style="margin-bottom:6px">${chip("Proposed", "a2")}</div><div class="fld"><span class="fld-k">Title</span><span class="fld-v"><span class="inp is-filled">No coordination study exists after the 2024 reconductoring</span></span></div>`),
      sec("Body", `<div class="inp is-filled" style="height:auto;padding:8px;align-items:flex-start"><span class="inp-w" style="white-space:normal">Neither the filings index nor the Commission's public docket lists a coordination study dated after the 2024 reconductoring, which raised available fault current on the tie by roughly 18%.</span></div>` + note("Editable before you accept it. What you accept is what enters the lattice.")),
      sec("Standing on", [row("feeder-12-relay.pdf · p.7", { icon: "folder", inspect: "source" }), row("nerc.gov/docket/2024-882", { icon: "link", inspect: "source" })].join(""), { count: 2, flush: true }),
      sec("Bears on", [row("Q-14 · Why did Feeder 12 fail twice?", { icon: "flask", inspect: "question" }), row("H-3 · Coordination never redone", { icon: "target", sub2: "Supports", inspect: "hypothesis" })].join(""), { count: 2, flush: true }),
      sec("Accept", `<div class="btn-row">${btn("Accept finding", { k: "pri", icon: "check" })}${btn("Dismiss", { k: "gh" })}</div>` + note("Accepting writes a <code>Finding</code> and its <code>ResearchLink</code> rows, and makes it retrievable across the project."))
    ].join("") },

    "finding-accepted": { crumbs: [["Research", "thread"], ["Finding", null]], body: [
      sec("Finding", `<div class="chips" style="margin-bottom:6px">${chip("Accepted", "ok")}${chip("In the lattice", "ai")}</div>` + kv([["Title", "Relay pair mis-coordinated since 2024"], ["Accepted by", who("Ana Reyes", "actor")], ["When", "7 minutes ago", { mono: true }]])),
      sec("Body", `<div class="quote-v">Both January and March failures cleared upstream of the intended device, at 0.42 s against a 0.61 s fuse.</div>`),
      sec("Standing on", [row("feeder-12-relay.pdf · p.7", { icon: "folder", sub2: "Excerpt copied on accept", inspect: "source" }), row("storm-log-2026-01.csv", { icon: "sheet", sub2: "Resource source · locator only", inspect: "source" })].join(""), { count: 2, flush: true, shut: true }),
      sec("Bears on", row("H-3 · Coordination never redone · Supports", { icon: "target", inspect: "hypothesis" }), { count: 1, flush: true, shut: true }),
      sec("Actions", `<div class="btn-row">${btn("Open as resource", { icon: "chevR" })}${btn("Withdraw", { k: "dgr" })}</div>`)
    ].join("") },

    source: { crumbs: [["Research", "thread"], ["Turn", null], ["Source", null]], body: [
      sec("Source", kv([["Title", "feeder-12-relay.pdf"], ["Kind", "external file", { mono: true }], ["Locator", "page 7", { mono: true }]])),
      sec("Excerpt", `<div class="quote-v">“…the recloser operated at 0.42 s, ahead of the 0.61 s fuse clearing time, so the fault was cleared upstream of the intended device…”</div>`),
      sec("Retrieval detail", kv([["Relevance", "0.86", { mono: true }], ["Density", "0.41", { mono: true }]]) + note("Shown only because the retrieval tool output supplied them. These are not generic <code>MessageSource</code> fields."), { shut: true }),
      sec("Used by", [row("This answer", { icon: "comment" }), row("1 accepted finding", { icon: "quote" })].join(""), { flush: true, shut: true }),
      sec("Actions", `<div class="btn-row">${btn("Open resource", { icon: "chevR" })}</div>`)
    ].join("") },

    "tool-call": { crumbs: [["Research", "thread"], ["Turn", null], ["Tool call", null]], body: [
      sec("Call", kv([["Tool", "lattice.retrieve", { mono: true }], ["State", chip("Success", "ok")], ["Duration", "1.2 s", { mono: true }]])),
      sec("Input", `<div class="inp is-filled" style="height:auto;padding:8px;align-items:flex-start;font-family:var(--mono);font-size:var(--t-mono)"><span class="inp-w" style="white-space:pre-wrap">{ "query": "coordination study after reconductoring",
  "scope": "rs_field_reports_2024_25" }</span></div>`),
      sec("Output", note("4 regions across 3 sources. The exact resolved scope and manifest used are recorded on this call — that is where historical scope truthfully lives."), { shut: true })
    ].join("") },

    question: { crumbs: [["Research", "thread"], ["Question", null]], body: [
      sec("Question", kv([["Text", "Why did Feeder 12 fail twice?"], ["Status", chip("Investigating", "act")], ["Parent", "Why do feeders fail repeatedly?"]])),
      sec("Linked hypotheses", [row("Relay coordination was never redone", { icon: "target", inspect: "hypothesis" }), row("Vegetation was the shared cause", { icon: "target", inspect: "hypothesis" })].join(""), { count: 2, flush: true }),
      sec("Accepted findings", row("Relay pair mis-coordinated since 2024", { icon: "quote", inspect: "finding-accepted" }), { count: 1, flush: true, shut: true })
    ].join("") },

    hypothesis: { crumbs: [["Research", "thread"], ["Hypothesis", null]], body: [
      sec("Hypothesis", kv([["Statement", "The relay coordination study was never redone after the 2024 reconductoring."], ["Assessment", chip("Testing", "act")], ["Confidence", "0.70", { mono: true }]]) + note("Assessment is an explicit human judgment. It is never calculated from the count of supporting and contradicting findings.")),
      sec("Evidence", [row("Relay pair mis-coordinated since 2024", { icon: "ok", sub2: "Supports", inspect: "finding-accepted" }), row("2024 study index lists a revision", { icon: "warn", sub2: "Contradicts", inspect: "finding-accepted" })].join(""), { count: 2, flush: true }),
      sec("Note", note("Bearing lives on each finding-to-hypothesis relationship, because the same finding can bear differently on different hypotheses."), { shut: true })
    ].join("") },

    thread: { crumbs: [["Research", null], ["Thread", null]], body: [
      sec("Thread", `<div class="fld"><span class="fld-k">Title</span><span class="fld-v"><span class="inp is-filled">Why did Feeder 12 fail twice?</span></span></div>` + kv([["Mode", `<span class="chips">${chip("Discover")}${chip("Question", "a1")}${chip("Hypothesis")}</span>`], ["Anchor", "Q-14"], ["Turns", "3", { mono: true }]])),
      sec("Agent", `<div class="chips" style="margin-bottom:6px">${av("GA", "ai")}<span class="card-t">Grid Analyst</span></div>` + kv([["Scope", "Field reports 2024–25 · 96"], ["Web", `<span class="tog is-on"></span>`], ["Tools", "4 allowed"]]) + note("Set once for the thread. Every turn in it runs as this agent — there is no per-message persona switch.")),
      sec("Note", note("Research has no Copilot dock. The whole screen is the conversation, so a second composer floating over it would be two ways to say the same thing."))
    ].join("") }
  },

  status: () => [
    { t: "2 findings proposed", tone: "act", icon: "quote" },
    { t: "Turn 3 of 3", icon: "clock" },
    { t: "Question · Q-14", right: true },
    { t: "Grid Analyst", right: true }
  ],

  notes: {
    retained: ["selected turn, one typed <code>finding | source | tool-call | question | hypothesis</code> selection", "source query and panel geometry", "streaming cursors and composer text stay in the research runtime"],
    nav: ["The thread's agent and scope are set once, at the top. There is no per-turn persona switch.", "Findings can come from any search, web or lattice, because a finding is a conclusion rather than a quotation."],
    revised: ["The Copilot dock is disabled here. Research is already a conversation with an agent; a second floating composer would be two ways to say the same thing.", "Not a chat room. The screen is anchored to the current turn — the prompt, its answer, and what it produced — with earlier turns in History.", "Findings are proposed beside the answer and accepted deliberately. Promotion is no longer a modal editorial form."],
    gaps: ["A proposed finding has no state in the model. Proposed / accepted / dismissed needs to exist before this screen can ship.", "No branch provenance from a selected turn.", "<code>FindingSource.messageId</code> still names the obsolete <code>researchMessages</code> table instead of the generic <code>messages</code> table."]
  }
};
