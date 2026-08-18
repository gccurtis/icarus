
/* ============================================================
   The Copilot.
   It lives in the middle section of the status bar and rises
   straight up out of it — same width, same edges, so opening it
   reads as the bar growing rather than a panel arriving.
   ============================================================ */
const COPILOT = {
  "copilot.home": { crumbs: [["Copilot", null], ["Home", null]], body: [
    `<div class="pane-s">${search("Search conversations and tasks")}</div>`,
    sec("Waiting", row("Confirm filing deadline", { icon: "clock", sub2: "Filing Editor · waiting", inspect: "copilot.task" }), { count: 1, flush: true }),
    sec("Not working", row("Rebuild substation crosswalk", { icon: "warn", sub2: "Grid Analyst · tool not permitted", inspect: "copilot.task" }), { count: 1, flush: true }),
    sec("Running", row("Summarise overnight outage reports", { icon: "spark", sub2: "Grid Analyst · step 3 of 5", inspect: "copilot.task", on: true }), { count: 1, flush: true }),
    sec("Recent conversations", [
      row("Relay coordination history", { icon: "comment", sub2: "Grid Analyst", right: "2h", inspect: "copilot.thread" }),
      row("Filing tone check", { icon: "comment", sub2: "Filing Editor", right: "3d", inspect: "copilot.thread" })
    ].join(""), { count: 2, flush: true }),
    sec("Done", [row("Extract 2024 storm precedents", { icon: "ok", right: "2h", inspect: "copilot.task" }), row("Draft board talking points", { icon: "ok", right: "1d", inspect: "copilot.task" })].join(""), { count: 2, flush: true, shut: true }),
    `<div style="padding:calc(var(--u)*3)">${note("Waiting stays generic until the task model records why it is waiting and who can unblock it. State uses words and icons, never colour alone.")}</div>`
  ].join("") },

  "copilot.thread": { crumbs: [["Copilot", "copilot.home"], ["Conversation", null]], body: [
    sec("Conversation", `<div class="chips" style="margin-bottom:6px">${av("GA", "ai")}<span class="card-t">Relay coordination history</span></div>` + kv([["Agent", "Grid Analyst"], ["Turns", "14", { mono: true }]])),
    sec("Latest", `<div class="quote-v">The filings index lists a 2019 study and no successor. Two sources.</div>` + note("Grid Analyst · 14:02")),
    sec("Actions", `<div class="btn-row">${btn("Continue", { k: "pri" })}${btn("Start a task from this", { icon: "spark" })}</div>`)
  ].join("") },

  "copilot.task": { crumbs: [["Copilot", "copilot.home"], ["Task", null]], body: [
    sec("Task", `<div class="chips" style="margin-bottom:6px">${chip("Running", "act")}${chip("step 3 of 5", "off")}</div>` + kv([["Title", "Summarise overnight outage reports"], ["Agent", `${av("GA", "ai")} Grid Analyst`], ["Started by", "Nightly filing digest"], ["Started", "02:00", { mono: true }]])),
    sec("Asked to", `<div class="quote-v">Summarise last night's outage reports by substation and flag anything that changes the filing position.</div>` + note("Immutable. Changing it requires a new task.")),
    sec("Plan", [
      row("Resolve what it can look up", { icon: "ok", sub2: "Done" }),
      row("Read overnight reports", { icon: "ok", sub2: "Done · 14 sources" }),
      row("Group by substation", { icon: "refresh", sub2: "Active", on: true }),
      row("Flag filing-relevant changes", { icon: "clock", sub2: "Pending" }),
      row("Write the summary", { icon: "clock", sub2: "Pending" })
    ].join(""), { count: 5, flush: true }),
    sec("Tools used", [row("lattice.retrieve · 1.4 s", { icon: "ok", sub2: "14 regions" }), row("resource.read · 0.3 s", { icon: "ok" })].join(""), { count: 2, flush: true, shut: true }),
    sec("Produced", note("Nothing yet. A result is not a resource — promote it into a finding, document, deck or workbook to make it retrievable."), { shut: true }),
    sec("Actions", `<div class="btn-row">${btn("Follow", { k: "pri" })}${btn("Cancel", { k: "dgr" })}</div>` + note("Retry is unavailable until retry semantics are modeled."))
  ].join("") },

  "copilot.context": { crumbs: [["Copilot", "copilot.home"], ["What it can see", null]], body: [
    sec("Suggested", [row("This selection · 38 characters", { icon: "type", sub2: "Suggested, not attached until you say so" }), row("Q3 Resilience Memo", { icon: "doc", sub2: "The document you are in" })].join(""), { count: 2, flush: true }),
    `<div class="pane-s">${search("Search project resources")}</div>`,
    sec("Saved Contexts", [row("Field reports 2024–25", { icon: "target", right: "96", on: true }), row("Regulatory corpus", { icon: "target", right: "34" }), row("Storm precedents", { icon: "warn", sub2: "Matches nothing — blocked", right: "0" })].join(""), { count: 3, flush: true }),
    sec("The agent's own", row("Field reports 2024–25", { icon: "lock", sub2: "Grid Analyst always has this", right: "96" }) + note("Changing it means editing the Persona, not switching part of it off for one turn."), { flush: true }),
    sec("Altogether", kv([["Can look up", "96 resources", { mono: true }], ["Membership", "Always enforced, never one of the parts"]]) + gap("Chips are draft state. <code>Message</code>, <code>PersonaThread</code> and <code>AgentTask</code> have no request-level scope or attachment list, so reopening an old turn cannot restore them.")),
    `<div class="pane-f">${btn("Back", { k: "gh", icon: "chevL", act: "copilot" })}${btn("Done", { k: "pri", act: "copilot" })}</div>`
  ].join("") }
};

const COP_LIFT = () => `
  <div class="cop-lift">
    <div class="cop-h">
      <span class="row-i" style="color:var(--ai-t)">${ic("spark", 14)}</span>
      <span class="pane-t">Copilot</span>
      <span class="note">1 running · 1 waiting</span>
      <button class="ico-btn" type="button" data-act="copilot-shut" aria-label="Close the Copilot" style="margin-inline-start:auto">${ic("chevD", 15)}</button>
    </div>
    <div class="cop-b">${COPILOT["copilot.home"].body}</div>
    <div class="cop-f">
      <div class="cop-row">
        <button class="cop-sel is-mode" type="button">Plan ${ic("chevD", 11)}</button>
        <button class="cop-sel" type="button">${av("GA", "ai")} Grid Analyst ${ic("chevD", 11)}</button>
        <button class="cop-sel" type="button" data-act="copilot-context">${ic("target", 11)} Field reports 2024–25 ${ic("plus", 11)}</button>
      </div>
      <div class="cop-in">
        <span class="cop-txt">Describe the next move</span>
        <button class="cop-send" type="button" aria-label="Send">${ic("up", 14)}</button>
      </div>
      <span class="note">To <b>New task</b> · Plan writes a reviewable checklist and waits for you to accept it</span>
    </div>
  </div>`;

/* ============================================================
   New Slide — a chooser owned by a slide-deck tab, never a tab.
   ============================================================ */
const NEW_SLIDE = () => `
  <div class="ovl">
    <div class="ovl-p">
      <div class="ovl-h">
        <span class="pane-t">New slide</span>
        ${chip("After slide 4", "act")}
        <button class="ico-btn" type="button" data-act="close-overlay" aria-label="Cancel" style="margin-inline-start:auto">${ic("x", 15)}</button>
      </div>
      <div class="ovl-b">
        <div style="display:flex;flex-direction:column;gap:calc(var(--u)*2)">
          <span class="eyebrow">Where</span>
          <div class="chips">
            ${chip("After this slide", "act")}${chip("Before this slide")}${chip("End of “The case”")}${chip("End of deck")}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:calc(var(--u)*2)">
          <span class="eyebrow">Start from</span>
          <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
            ${card("A copy of this slide", "Layout, elements, notes and background", { icon: "copy" })}
            ${card("Blank", "Deck theme, nothing on it", { icon: "deck" })}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:calc(var(--u)*2)">
          <span class="eyebrow">Or a layout</span>
          <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
            ${[["Title and two panes", "title, body ×2", true], ["Title slide", "title, subtitle"], ["Section break", "section title"], ["Full-bleed chart", "chart"]]
              .map(([n, roles, on]) => `<button class="card${on ? " is-on" : ""}" type="button" data-inspect="placeholder">
                <span class="thumb"><span class="thumb-l" style="left:10%;top:16%;width:56%;height:12%"></span>
                <span class="thumb-l" style="left:10%;top:38%;width:36%;height:40%;background:color-mix(in srgb,var(--ai-b) 20%,transparent)"></span>
                <span class="thumb-l" style="left:54%;top:38%;width:36%;height:40%;background:color-mix(in srgb,var(--ai-b) 20%,transparent)"></span></span>
                <span class="card-t">${n}</span><span class="card-s">${roles}</span></button>`).join("")}
          </div>
        </div>
        ${note("Each placeholder in the layout becomes an ordinary element you can edit. Locked layout content stays with the layout and is never copied in.")}
      </div>
      <div class="ovl-f">
        <span class="note">Arrow keys move through cards · Enter confirms · Escape cancels</span>
        <span style="margin-inline-start:auto" class="btn-row">${btn("Cancel", { act: "close-overlay" })}${btn("Add slide", { k: "pri" })}</span>
      </div>
    </div>
  </div>`;

/* ============================================================
   The deck.
   ============================================================ */
const SLIDES = [
  { s: "project-overview", label: "1 · Project Overview" },
  { s: "new-tab", label: "2 · New Tab" },
  { s: "document", label: "3 · Document editor", st: { ctx: "navigator", inspect: "text-selection" } },
  { s: "document", label: "4 · Document — Copilot open", st: { ctx: "navigator", inspect: "text-selection", copilot: true } },
  { s: "slides", label: "5 · Slide deck editor", st: { ctx: "slides", inspect: "element" } },
  { s: "slides", label: "6 · Slides — multi-select", st: { ctx: "layers", inspect: "multi-element" } },
  { s: "slides", label: "7 · New Slide chooser", st: { overlay: true, inspect: "placeholder" } },
  { s: "spreadsheet", label: "8 · Spreadsheet editor" },
  { s: "research", label: "9 · Research" },
  { s: "analysis", label: "10 · Analysis" },
  { s: "context", label: "11 · Context" },
  { s: "templates", label: "12 · Templates — library", st: { mode: "library", ctx: "library", inspect: "template-card" } },
  { s: "templates", label: "13 · Templates — authoring", st: { mode: "author", ctx: "variables-t", inspect: "slot" } },
  { s: "personas", label: "14 · Personas — profile", st: { mode: "author", ctx: "work", inspect: "persona" } },
  { s: "automations", label: "15 · Automations — library", st: { mode: "library", ctx: "automations", inspect: "automation" } },
  { s: "automations", label: "16 · Automations — one rule", st: { mode: "author", ctx: "triggers", inspect: "schedule-trigger" } }
];

/* ============================================================
   Runtime
   ============================================================ */
const $ = (id) => document.getElementById(id);
const frame = $("frame");

let slide = 0;
const state = {};

const screenOf = (i) => SCREENS[SLIDES[i].s];
const stOf = (i) => state[SLIDES[i].s];

const initState = () => {
  for (const key of Object.keys(SCREENS)) {
    state[key] = Object.assign(
      { ctxShut: false, inspShut: false, overlay: false, copilot: false, prev: null },
      SCREENS[key].init
    );
  }
};

/* The Copilot and every actor belong to no screen, so they resolve before a
   screen's own lenses and are reachable from all of them. */
const lensFor = (screen, key) => COPILOT[key] || ACTORS[key] || screen.inspectors[key] || null;

const renderTop = () => {
  $("topbar").innerHTML = `
    <div class="tb-left">
      <button class="tb-proj" type="button">${ic("folder", 15)} ${esc(PROJECT.name)} ${ic("chevD", 13)}</button>
    </div>
    <button class="tb-wordmark" type="button" data-act="theme" title="Switch between Celestial and Cyberpunk">ICARUS ${ic("sun", 13)}</button>
    <div class="tb-right">
      <button class="ico-btn is-txt" type="button">${ic("search", 14)} Search</button>
      <button class="ico-btn is-txt" type="button">${ic("upload", 14)} Import</button>
      <button class="ico-btn is-txt" type="button" disabled title="No exporter path for the current selection yet">${ic("share", 14)} Share</button>
      <button class="ico-btn" type="button" aria-label="Help">${ic("help", 15)}</button>
      <button class="ico-btn" type="button" aria-label="Settings">${ic("sliders", 15)}</button>
      <span class="av" style="background:var(--a1-f)">AR</span>
    </div>`;
};

const renderTabs = (activeKey) => {
  $("tabstrip").innerHTML = TABS.map((t) => {
    if (t.div) return `<span class="tab-div" aria-hidden="true"></span>`;
    const on = t.k === activeKey;
    return `
    <div class="tab${on ? " is-on" : ""}${t.fix ? " is-fix" : ""}">
      <button class="tab-sel" type="button" data-tab="${t.k}" title="${esc(t.label)}"${on ? ' aria-current="true"' : ""}>
        ${ic(t.icon, 15)}${t.fix ? "" : `<span>${esc(t.label)}</span>`}${t.dirty ? '<span class="tab-dot" title="Unsaved edits"></span>' : ""}
      </button>
      ${t.fix ? "" : `<button class="tab-x" type="button" aria-label="Close ${esc(t.label)}">${ic("x", 12)}</button>`}
    </div>`;
  }).join("") + `<button class="tab-add" type="button" data-tab="new-tab" aria-label="New tab">${ic("plus", 15)}</button>`;
};

const renderContext = (screen, st) => {
  const list = screen.contexts(st);
  const active = list.find((c) => c.id === st.ctx) || list[0];
  st.ctx = active.id;
  $("rail").innerHTML = list.map((c) => `
    <button class="rail-b${c.id === active.id ? " is-on" : ""}" type="button" data-ctx="${c.id}" title="${esc(c.label)}" aria-label="${esc(c.label)}" aria-pressed="${c.id === active.id}">
      ${ic(c.icon, 17)}
    </button>`).join("");
  $("ctxbody").innerHTML = active.body(st);
};

const renderInspector = (screen, st) => {
  const el = $("insp");
  if (st.inspShut) {
    el.innerHTML = `<button class="insp-rail" type="button" data-act="insp-open" aria-label="Open the inspector" aria-expanded="false">
      ${ic("sliders", 18)}<span class="vt">Inspector</span></button>`;
    return;
  }
  const view = lensFor(screen, st.inspect);
  if (!view) {
    el.innerHTML = lens([["Nothing selected", null]], `<div style="padding:calc(var(--u)*3)">${note("Nothing is selected. This is a real state, not a blank panel — it shows what the whole thing is, and what you can do next.")}</div>`);
    return;
  }
  el.innerHTML = lens(view.crumbs, view.body);
};

const renderStatus = (screen, st) => {
  const items = screen.status(st);
  const left = items.filter((i) => !i.right), right = items.filter((i) => i.right);
  const one = (i) => `<span class="st-i${i.tone ? " t-" + i.tone : ""}">${i.icon ? ic(i.icon, 12) : ""}${esc(i.t)}</span>`;
  const mid = screen.noCopilot
    ? `<span class="st-sect is-mid"><span class="cop-btn" style="cursor:default;opacity:.5">${ic("spark", 12)} Copilot is the whole screen here</span></span>`
    : `<span class="st-sect is-mid">
        <button class="cop-btn${st.copilot ? " is-on" : ""}" type="button" data-act="copilot" aria-expanded="${!!st.copilot}">
          ${ic("spark", 13)} Copilot <span class="cop-badge">1 running · 1 waiting</span> ${ic(st.copilot ? "chevD" : "up", 12)}
        </button></span>`;
  $("statusbar").innerHTML =
    `<span class="st-sect">${left.map(one).join('<span class="st-sep"></span>')}</span>` +
    mid +
    `<span class="st-sect is-right">${right.map(one).join('<span class="st-sep"></span>')}</span>`;
};

const renderCopilot = (screen, st) => {
  $("copilot").innerHTML = !screen.noCopilot && st.copilot ? COP_LIFT() : "";
};

const renderNotes = (screen, st) => {
  const list = (arr, cls) => `<ul class="nd-l${cls ? " " + cls : ""}">${arr.map((x) => `<li>${x}</li>`).join("")}</ul>`;
  const ctxs = screen.contexts(st);
  $("ndTitle").textContent = screen.name;
  $("ndPath").textContent = screen.path;
  $("ndBody").innerHTML = `
    <div class="nd-s"><span class="nd-k">Driving this mock</span>${list([
      "Click a <b>rail icon</b> to change the context view.",
      "Click a <b>row, cell, pill, node or slide object</b> to change the inspector.",
      "<b>Breadcrumbs are navigable</b> — click an ancestor to select it.",
      "The <b>Copilot</b> lives in the middle of the status bar and rises out of it.",
      "<b>ICARUS</b> in the top bar switches Celestial and Cyberpunk.",
      "<b>← →</b> move between screens; <b>Escape</b> closes an overlay or this drawer."
    ])}</div>
    <div class="nd-s"><span class="nd-k">What this screen is for</span><p class="nd-l" style="padding:0">${screen.purpose}</p>
      <span class="nd-k" style="margin-top:8px">Context rail</span>${list(ctxs.map((c) => `<b>${esc(c.label)}</b>${c.id === ctxs[0].id ? " — default" : ""}`))}</div>
    <div class="nd-s"><span class="nd-k">Changed in this revision</span>${list(screen.notes.revised || [], "nd-new")}
      <span class="nd-k" style="margin-top:8px">Deliberate choices</span>${list(screen.notes.nav)}</div>
    <div class="nd-s"><span class="nd-k">Retained tab view state</span>${list(screen.notes.retained)}
      <span class="nd-k" style="margin-top:8px">Model gaps that gate UI</span>${list(screen.notes.gaps, "nd-gap")}</div>`;
};

const renderModes = (screen, st) => {
  // Library / editor mode is a screen affordance, so it renders inside the
  // panel's action row rather than as another bar across the application.
  if (!screen.modes) return;
  const host = document.querySelector(".pane-a");
  if (!host) return;
  const html = screen.modes.map(([m, label]) =>
    `<button class="btn is-sm${st.mode === m ? " is-pri" : ""}" type="button" data-act="mode:${m}">${esc(label)}</button>`).join("");
  host.insertAdjacentHTML("afterbegin", `<span class="chips" style="gap:4px;padding-inline-end:calc(var(--u)*2);border-inline-end:1px solid var(--bd);margin-inline-end:calc(var(--u)*1)">${html}</span>`);
};

const render = () => {
  const def = SLIDES[slide], screen = SCREENS[def.s], st = state[def.s];
  frame.classList.toggle("ctx-shut", st.ctxShut);
  frame.classList.toggle("insp-shut", st.inspShut);
  if (screen.lift) frame.setAttribute("data-lift", screen.lift); else frame.removeAttribute("data-lift");
  renderTop();
  renderTabs(def.s);
  renderContext(screen, st);
  renderModes(screen, st);
  $("surface").innerHTML = screen.center(st);
  $("surface").scrollTop = 0;
  renderInspector(screen, st);
  renderStatus(screen, st);
  renderCopilot(screen, st);
  renderNotes(screen, st);
  $("overlay").innerHTML = st.overlay ? NEW_SLIDE() : "";
  $("pick").value = String(slide);
  $("count").textContent = `${slide + 1} / ${SLIDES.length}`;
  $("prev").disabled = slide === 0;
  $("next").disabled = slide === SLIDES.length - 1;
};

const goto = (i) => {
  slide = Math.max(0, Math.min(SLIDES.length - 1, i));
  const def = SLIDES[slide];
  const st = state[def.s];
  Object.assign(st, { overlay: false, copilot: false }, def.st || {});
  render();
  try { history.replaceState(null, "", "#" + (slide + 1)); } catch { /* sandboxed */ }
};

const toggleTheme = () => {
  const root = document.documentElement;
  const dark = root.dataset.theme
    ? root.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
};

/* ---- delegated interaction ---- */
frame.addEventListener("click", (e) => {
  const st = stOf(slide), screen = screenOf(slide);

  const secT = e.target.closest("[data-sec-t]");
  if (secT) { secT.closest("[data-sec]").classList.toggle("is-shut"); return; }

  const act = e.target.closest("[data-act]");
  if (act) {
    const a = act.dataset.act;
    if (a === "ctx-shut") { st.ctxShut = true; render(); return; }
    if (a === "insp-shut") { st.inspShut = true; render(); return; }
    if (a === "insp-open") { st.inspShut = false; render(); return; }
    if (a === "theme") { toggleTheme(); return; }
    if (a === "new-slide") { st.overlay = true; render(); return; }
    if (a === "close-overlay") { st.overlay = false; render(); return; }
    if (a === "copilot") { st.copilot = !st.copilot; render(); return; }
    if (a === "copilot-shut") { st.copilot = false; render(); return; }
    if (a === "copilot-context") {
      if (!st.inspect.startsWith("copilot.")) st.prev = st.inspect;
      st.inspect = "copilot.context"; st.inspShut = false; render(); return;
    }
    if (a.startsWith("mode:")) {
      st.mode = a.slice(5);
      st.ctx = screen.contexts(st)[0].id;
      st.inspect = Object.keys(screen.inspectors)[0];
      render(); return;
    }
  }

  const ctxBtn = e.target.closest("[data-ctx]");
  if (ctxBtn) { st.ctx = ctxBtn.dataset.ctx; st.ctxShut = false; render(); return; }

  const tabBtn = e.target.closest("[data-tab]");
  if (tabBtn) {
    const i = SLIDES.findIndex((d) => d.s === tabBtn.dataset.tab);
    if (i >= 0) goto(i);
    return;
  }

  const insBtn = e.target.closest("[data-inspect]");
  if (insBtn) {
    const key = insBtn.dataset.inspect;
    if (lensFor(screen, key)) { st.inspect = key; st.inspShut = false; render(); }
    return;
  }
});

(function boot() {
  initState();

  $("pick").innerHTML = SLIDES.map((d, i) => `<option value="${i}">${esc(d.label)}</option>`).join("");
  $("pick").addEventListener("change", (e) => goto(Number(e.target.value)));
  $("prev").addEventListener("click", () => goto(slide - 1));
  $("next").addEventListener("click", () => goto(slide + 1));

  const notes = $("notes"), notesBtn = $("notesBtn");
  const setNotes = (open) => {
    notes.classList.toggle("is-open", open);
    notesBtn.classList.toggle("is-on", open);
    notesBtn.setAttribute("aria-pressed", String(open));
  };
  notesBtn.addEventListener("click", () => setNotes(!notes.classList.contains("is-open")));
  $("ndClose").addEventListener("click", () => setNotes(false));

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;
    if (e.key === "ArrowRight") { goto(slide + 1); e.preventDefault(); }
    if (e.key === "ArrowLeft") { goto(slide - 1); e.preventDefault(); }
    if (e.key === "Escape") {
      const st = stOf(slide);
      if (st.overlay) { st.overlay = false; render(); }
      else if (st.copilot) { st.copilot = false; render(); }
      else setNotes(false);
    }
  });

  const asked = parseInt(location.hash.slice(1), 10);
  goto(Number.isFinite(asked) ? asked - 1 : 0);
})();
