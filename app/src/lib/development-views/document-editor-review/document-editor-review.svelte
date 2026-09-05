<script lang="ts">
  type View = "audit" | "target" | "plan";
  type Mock = "text" | "comment" | "layout";
  type Picker = "fg" | "bg" | undefined;

  const issues = [
    {
      priority: "P0",
      title: "Repeat color and link replacement can throw",
      evidence: "A replacement removes the last mark, then inserts after the deleted ID.",
      owner: "marks · operations"
    },
    {
      priority: "P0",
      title: "Selection state is not preserved across panel writes",
      evidence: "Reprojection resets held-highlight state and collapses multi-selection to one range.",
      owner: "projection · selection"
    },
    {
      priority: "P0",
      title: "Enter produces data/pixel disagreement",
      evidence: "The new block says Body while copied presentation can leave it looking like Quote.",
      owner: "editing · styles"
    },
    {
      priority: "P0",
      title: "Ctrl/Cmd-click selects a block instead of opening its link",
      evidence: "Reproduced: no new page; the whole block receives raw ProseMirror selection chrome.",
      owner: "gestures · links"
    },
    {
      priority: "P1",
      title: "Sections exposes fractional placement and loses long titles",
      evidence: "Winter readiness renders l.11.999999999999998 and a near-empty second row.",
      owner: "sections"
    },
    {
      priority: "P1",
      title: "Detached comments float beside the header",
      evidence: "Detached pins are placed from the top of the pasteboard instead of leaving the page.",
      owner: "comments"
    },
    {
      priority: "P1",
      title: "Header/footer editing is flattened and in the wrong place",
      evidence: "The mini inspector editor stores rich rows; the page widget renders only textContent.",
      owner: "furniture"
    },
    {
      priority: "P1",
      title: "Green tests do not cover the broken interactions",
      evidence: "652 unit tests and 63 lint checks pass; there is no editor browser regression suite.",
      owner: "quality gate"
    }
  ] as const;

  const comparison = [
    ["Engine", "Mock controls; narrow projection", "Live body, real ops, persistence", "Keep branch engine"],
    ["Formatting", "4-up responsive B/I/U/S", "5 wrapping word chips", "Main layout + real handlers"],
    ["Color", "Inline popover, eyedropper, Custom", "Two swatch walls; replacement bug", "Shared real picker"],
    ["Links", "URL + notes mock", "Real URL; notes removed", "Persist URL + notes"],
    ["Furniture", "Absent", "Stored/repeated but flattened", "On-page rich editing"],
    ["Coverage", "Static and unit checks", "More unit checks, same browser gap", "Interaction suite before merge"]
  ] as const;

  const captured = [
    "Persistent selection highlight",
    "No raw text-block outline",
    "Bold · Italic · Underline · Strikethrough",
    "Full words when space allows; B/I/U/S when it does not",
    "One full-width formatting row",
    "FG and BG on one row",
    "Shared color picker · eyedropper · More colors",
    "Body style = alignment + spacing",
    "Space above / Space below labels",
    "Direct number input; no plus/minus controls",
    "Zero values remain visibly editable",
    "URL input + link notes",
    "Editable link color and underline",
    "No hard-coded quote bar",
    "Correct next style after Enter",
    "Font gets space; size stays compact",
    "Commented text distinct from opener and replies",
    "No detached comment pin at the page header",
    "On-page rich header/footer editing",
    "No From edge controls",
    "First visible page defaults to 1",
    "One-row orientation",
    "Cleaner key/value composition and stronger sections",
    "Sections title and line repair",
    "Ctrl/Cmd-click opens links",
    "Double-click word; Shift-double-click block",
    "Variables · Templates · Prompts remain placeholders",
    "Clean console and merge gate"
  ] as const;

  const phases = [
    {
      number: "01",
      title: "Correctness spine",
      body: "Repair mark replacement, preserve full selections, define next-style behavior, open links correctly, round Sections, and clear the console.",
      gate: "Every P0 has a failing test first"
    },
    {
      number: "02",
      title: "Shared controls",
      body: "Make PanelMarks responsive, extract PanelColorPicker, simplify PanelNumber, and add compact key/value rows.",
      gate: "Narrow · default · wide snapshots"
    },
    {
      number: "03",
      title: "Inspector convergence",
      body: "Wire the main-branch interaction design to branch operations, add Body style, and remove immutable Code/link/quote presentation.",
      gate: "Data and pixels agree after every action"
    },
    {
      number: "04",
      title: "Comments and links",
      body: "Persist notes, clarify thread hierarchy, remove detached pins from the page, and make comment range limits explicit.",
      gate: "Create · edit · resolve · detach · undo"
    },
    {
      number: "05",
      title: "Furniture and layout",
      body: "Edit header/footer on the page, render their styles, compact Layout, and correct first-visible numbering.",
      gate: "Repeated furniture matches on every page"
    },
    {
      number: "06",
      title: "Merge gate",
      body: "Rebase, run every static and browser gate, reset the fixture, and review Winter readiness at all rail widths.",
      gate: "Zero errors · zero unexpected requests"
    }
  ] as const;

  const colors = [
    { id: "ink", label: "Ink", css: "var(--token-ink-primary)" },
    { id: "secondary", label: "Secondary", css: "var(--token-ink-secondary)" },
    { id: "muted", label: "Muted", css: "var(--token-ink-muted)" },
    { id: "rose", label: "Accent 1", css: "var(--token-color-accent-1-fill)" },
    { id: "teal", label: "Accent 2", css: "var(--token-color-accent-2-fill)" },
    { id: "amber", label: "Attention", css: "var(--token-color-attention-fill)" },
    { id: "green", label: "Success", css: "var(--token-color-success-fill)" },
    { id: "blue", label: "Interactive", css: "var(--token-color-interactive-fill)" },
    { id: "paper", label: "Paper", css: "var(--token-surface-elevated)" },
    {
      id: "none",
      label: "None",
      css: "linear-gradient(135deg, var(--token-surface-elevated) 46%, var(--token-color-danger-fill) 47%, var(--token-color-danger-fill) 53%, var(--token-surface-elevated) 54%)"
    }
  ] as const;

  const marks = [
    { id: "bold", letter: "B", word: "Bold" },
    { id: "italic", letter: "I", word: "Italic" },
    { id: "underline", letter: "U", word: "Underline" },
    { id: "strike", letter: "S", word: "Strikethrough" }
  ] as const;

  let view = $state<View>("audit");
  let mock = $state<Mock>("text");
  let panelWidth = $state(376);
  let activeMarks = $state<string[]>(["bold"]);
  let foreground = $state("ink");
  let background = $state("none");
  let picker = $state<Picker>("fg");
  let editingFurniture = $state<"header" | "footer" | undefined>(undefined);
  let hideFirst = $state(true);

  const toggleMark = (id: string) => {
    activeMarks = activeMarks.includes(id)
      ? activeMarks.filter((held) => held !== id)
      : [...activeMarks, id];
  };

  const colorOf = (id: string) => colors.find((color) => color.id === id)?.css ?? "transparent";

  const chooseColor = (id: string) => {
    if (picker === "fg") foreground = id;
    if (picker === "bg") background = id;
  };
</script>

<svelte:head>
  <title>Document editor review · Icarus</title>
  <link rel="icon" href="/favicon.svg" />
  <meta
    name="description"
    content="Review, target interface, and merge plan for work/document-editor."
  />
</svelte:head>

<div class="artifact">
  <header class="mast">
    <div class="mast-copy">
      <p class="eyebrow">Work / document-editor · review artifact</p>
      <h1>Keep the engine.<br />Recover the interface.</h1>
      <p class="lede">
        The branch makes the editor real, but it replaces deliberate interaction work from
        <code>main</code> and leaves common editing paths unsafe. This is the convergence target.
      </p>
    </div>
    <aside class="decision">
      <span class="decision-label">Merge decision</span>
      <strong>Hold</strong>
      <p>Four correctness blockers, then one focused interaction pass.</p>
      <span class="commit">55a7b22 → 98d9cd0</span>
    </aside>
  </header>

  <nav class="tabs" aria-label="Artifact views">
    <button type="button" class:active={view === "audit"} onclick={() => (view = "audit")}>
      <span>01</span> Audit
    </button>
    <button type="button" class:active={view === "target"} onclick={() => (view = "target")}>
      <span>02</span> Target UI
    </button>
    <button type="button" class:active={view === "plan"} onclick={() => (view = "plan")}>
      <span>03</span> Merge plan
    </button>
  </nav>

  {#if view === "audit"}
    <main class="page audit-page">
      <section class="summary-grid" aria-label="Branch summary">
        <div><strong>7</strong><span>branch commits</span></div>
        <div><strong>78</strong><span>changed files</span></div>
        <div><strong>8,064</strong><span>lines added</span></div>
        <div><strong>652</strong><span>unit tests pass</span></div>
        <div class="warn"><strong>0</strong><span>browser paths covered</span></div>
      </section>

      <section class="intro-card">
        <div>
          <span class="section-kicker">Assessment</span>
          <h2>Architecturally promising; behaviorally not merge-ready.</h2>
        </div>
        <p>
          Static checks are clean. The running <em>Winter readiness brief</em> still exposes
          deterministic failures that those checks cannot see: repeat mark replacement, selection
          repaint, next-style projection, link gestures, comment placement, and Sections layout.
        </p>
      </section>

      <section class="section-block">
        <div class="section-head">
          <div><span class="section-kicker">Observed and traced</span><h2>Findings</h2></div>
          <p>P0 blocks merge. P1 is required for the intended editor experience.</p>
        </div>
        <div class="findings">
          {#each issues as issue}
            <article class:p0={issue.priority === "P0"} class="finding-card">
              <div class="finding-top">
                <span class="priority">{issue.priority}</span>
                <span class="owner">{issue.owner}</span>
              </div>
              <h3>{issue.title}</h3>
              <p>{issue.evidence}</p>
            </article>
          {/each}
        </div>
      </section>

      <section class="section-block">
        <div class="section-head">
          <div><span class="section-kicker">Do not choose a side wholesale</span><h2>Main × branch</h2></div>
          <p>The branch engine and the main interaction mock are complementary.</p>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Concern</th><th>Main</th><th>Branch</th><th>Converge</th></tr></thead>
            <tbody>
              {#each comparison as row}
                <tr>{#each row as cell}<td>{cell}</td>{/each}</tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <section class="section-block captured-block">
        <div class="section-head">
          <div><span class="section-kicker">Feedback ledger</span><h2>Everything captured</h2></div>
          <p>Twenty-eight explicit outcomes, grouped into implementation work in the plan.</p>
        </div>
        <div class="captured">
          {#each captured as item, index}
            <div><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></div>
          {/each}
        </div>
      </section>
    </main>
  {:else if view === "target"}
    <main class="page target-page">
      <section class="target-intro">
        <div>
          <span class="section-kicker">Interactive proposal</span>
          <h2>One panel system, three clear modes.</h2>
          <p>
            Resize the inspector, switch its mode, try the color picker, and enter header/footer
            editing. The mock demonstrates layout and hierarchy; it does not mutate a document.
          </p>
        </div>
        <label class="width-control">
          <span>Inspector width</span>
          <input type="range" min="280" max="500" step="4" bind:value={panelWidth} />
          <output>{panelWidth}px</output>
        </label>
      </section>

      <div class="mock-shell">
        <section class="document-stage" aria-label="Proposed document canvas">
          <div class="stage-bar"><span>Winter readiness brief</span><span>Saved · Page 1 of 3</span></div>
          <article class="paper">
            <button
              type="button"
              class="furniture header"
              class:editing={editingFurniture === "header"}
              onclick={() => (editingFurniture = "header")}
            >
              <span>HEADER</span>
              <b>Grid Resilience 2027</b>
            </button>
            <div class="paper-body">
              <h3>Winter readiness brief</h3>
              <p class="date">Revised 4 February</p>
              <p>
                Peak demand on the western interconnect is forecast to exceed last winter's record
                by <span class="selection">four percent</span>, and two substations have since been
                derated.
              </p>
              <h4>Where the exposure sits</h4>
              <p>
                Substation 14 is the binding constraint. Its transformer bank was derated in
                September after the oil analysis came back.
              </p>
              <p class="commented">The coastal tie has carried an unplanned outage in each of the last three winters.</p>
            </div>
            <button
              type="button"
              class="furniture footer"
              class:editing={editingFurniture === "footer"}
              onclick={() => (editingFurniture = "footer")}
            >
              <b>Draft · internal</b>
              <span>1</span>
            </button>
            <span class="comment-pin" title="Open anchored comment">1</span>
          </article>
          <p class="canvas-note">
            {#if editingFurniture === "header"}
              Header editing is active on the page. The normal text inspector would style it.
            {:else if editingFurniture === "footer"}
              Footer editing is active on the page. Repeated footers stay projections.
            {:else}
              Click the header or footer, or use Edit on page in Layout.
            {/if}
          </p>
        </section>

        <aside class="inspector-mock" style:width={panelWidth + "px"}>
          <div class="panel-switcher" aria-label="Mock inspector mode">
            <button type="button" class:active={mock === "text"} onclick={() => (mock = "text")}>Text</button>
            <button type="button" class:active={mock === "comment"} onclick={() => (mock = "comment")}>Comment</button>
            <button type="button" class:active={mock === "layout"} onclick={() => (mock = "layout")}>Layout</button>
          </div>

          {#if mock === "text"}
            <div class="panel-title"><span>Document › Selection</span><h3>Text selection</h3></div>
            <div class="selection-quote">
              <q>four percent</q><span>12 characters</span>
            </div>

            <section class="panel-section open">
              <div class="panel-section-head"><b>Style</b></div>
              <div class="panel-body">
                <label class="field stack"><span>Style</span><select><option>Body</option><option>Heading 1</option><option>Quote</option></select></label>
                <div class="font-row">
                  <label class="field"><span class="sr-only">Font</span><select><option>IBM Plex Sans</option><option>Georgia</option><option>Iowan Old Style</option></select></label>
                  <label class="number"><span class="sr-only">Font size</span><input type="number" value="16" min="8" max="96" /></label>
                </div>

                <div class="format-grid" aria-label="Formatting">
                  {#each marks as mark}
                    <button
                      type="button"
                      class:active={activeMarks.includes(mark.id)}
                      class:italic={mark.id === "italic"}
                      class:underline={mark.id === "underline"}
                      class:strike={mark.id === "strike"}
                      onclick={() => toggleMark(mark.id)}
                    >
                      <span class="letter">{mark.letter}</span><span class="word">{mark.word}</span>
                    </button>
                  {/each}
                </div>

                <div class="color-row">
                  <div><span>FG</span><button type="button" onclick={() => (picker = picker === "fg" ? undefined : "fg")}><i style:background={colorOf(foreground)}></i><b>Foreground</b><em>⌄</em></button></div>
                  <div><span>BG</span><button type="button" onclick={() => (picker = picker === "bg" ? undefined : "bg")}><i style:background={colorOf(background)}></i><b>Background</b><em>⌄</em></button></div>
                </div>

                {#if picker !== undefined}
                  <div class="color-picker">
                    <div class="picker-head"><b>{picker === "fg" ? "Foreground" : "Background"}</b><span>Document colors</span></div>
                    <div class="swatch-grid">
                      {#each colors as color}
                        <button
                          type="button"
                          class:active={(picker === "fg" ? foreground : background) === color.id}
                          title={color.label}
                          aria-label={color.label}
                          onclick={() => chooseColor(color.id)}
                        ><i style:background={color.css}></i></button>
                      {/each}
                    </div>
                    <button type="button" class="picker-action"><span>⌖</span> Pick from screen</button>
                    <button type="button" class="picker-action"><span>◒</span> More colors…</button>
                  </div>
                {/if}
              </div>
            </section>

            <section class="panel-section open body-style">
              <div class="panel-section-head"><b>Body style</b><span>⌄</span></div>
              <div class="panel-body">
                <div class="alignment" aria-label="Alignment">
                  <button type="button" class="active" aria-label="Left">≡</button>
                  <button type="button" aria-label="Centre">≡</button>
                  <button type="button" aria-label="Right">≡</button>
                  <button type="button" aria-label="Justify">≡</button>
                </div>
                <div class="value-grid">
                  <label><span>Space above</span><div><input type="number" value="0" min="0" /><em>px</em></div></label>
                  <label><span>Space below</span><div><input type="number" value="16" min="0" /><em>px</em></div></label>
                  <label><span>Line height</span><div><input type="number" value="26" min="8" /><em>px</em></div></label>
                  <label><span>Indent</span><div><input type="number" value="0" min="0" /><em>px</em></div></label>
                </div>
              </div>
            </section>

            <section class="panel-section shut"><div class="panel-section-head"><b>Comments</b><span>1 ›</span></div></section>
            <section class="panel-section shut"><div class="panel-section-head"><b>Links</b><span>1 ›</span></div></section>
          {:else if mock === "comment"}
            <div class="panel-title"><span>Document › Comment</span><h3>Comment thread</h3></div>
            <div class="panel-actions"><button type="button" class="primary">Reply</button><button type="button">Resolve</button><button type="button">Show in document</button></div>
            <section class="thread-source">
              <span>Commented text</span>
              <q>The coastal tie has carried an unplanned outage in each of the last three winters.</q>
            </section>
            <div class="thread-divider"><span>Thread</span></div>
            <article class="comment-card opener">
              <div><span class="avatar">AR</span><p><b>Ana Reyes</b><small>31 minutes ago · Opening comment</small></p></div>
              <p>This is the sentence the brief turns on. Can we put the spare-breaker position beside it?</p>
            </article>
            <article class="comment-card reply">
              <div><span class="avatar alt">TO</span><p><b>Tom Okafor</b><small>12 minutes ago</small></p></div>
              <p>Yes. I checked the outage log and can add the reference.</p>
            </article>
            <div class="reply-box"><textarea placeholder="Reply…"></textarea><button type="button" class="primary">Send reply</button></div>
            <div class="detached-note"><b>Detached threads stay in Comments</b><p>No unanchored pin is drawn at the top of the page.</p></div>
          {:else}
            <div class="panel-title"><span>Document</span><h3>Layout</h3></div>
            <section class="panel-section open">
              <div class="panel-section-head"><b>Paper</b></div>
              <div class="panel-body">
                <label class="field stack"><span>Size</span><select><option>Letter</option><option>A4</option><option>A5</option></select></label>
                <div class="orientation"><span>Orientation</span><div><button type="button" class="active">Portrait</button><button type="button">Landscape</button></div></div>
              </div>
            </section>
            <section class="panel-section open">
              <div class="panel-section-head"><b>Margins (in)</b></div>
              <div class="panel-body value-grid margins">
                {#each ["Top", "Right", "Bottom", "Left"] as side}
                  <label><span>{side}</span><div><input type="number" value="0.75" min="0" step="0.05" /></div></label>
                {/each}
              </div>
            </section>
            <section class="panel-section open">
              <div class="panel-section-head"><b>Header and footer</b></div>
              <div class="panel-body furniture-rows">
                <div><span><i class="switch on"></i><b>Header</b></span><button type="button" onclick={() => (editingFurniture = "header")}>Edit on page</button></div>
                <div><span><i class="switch on"></i><b>Footer</b></span><button type="button" onclick={() => (editingFurniture = "footer")}>Edit on page</button></div>
              </div>
            </section>
            <section class="panel-section open">
              <div class="panel-section-head"><b>Page numbers</b></div>
              <div class="panel-body">
                <label class="field stack"><span>Position</span><select><option>Right</option><option>Centre</option><option>Left</option></select></label>
                <label class="check-row"><input type="checkbox" bind:checked={hideFirst} /><span>Hide on first page</span></label>
                <label class="first-number"><span>First visible number</span><input type="number" value="1" min="0" /></label>
                {#if hideFirst}<p class="inline-note">Page 2 displays <b>1</b> by default.</p>{/if}
              </div>
            </section>
          {/if}
        </aside>
      </div>

      <section class="gesture-section">
        <div class="section-head"><div><span class="section-kicker">Interaction contract</span><h2>Gestures say one thing.</h2></div></div>
        <div class="gestures">
          <div><kbd>Click</kbd><span>Place caret</span></div>
          <div><kbd>Drag</kbd><span>Select range</span></div>
          <div><kbd>Double-click</kbd><span>Select word</span></div>
          <div><kbd>Shift</kbd><b>+</b><kbd>Double-click</kbd><span>Select block text</span></div>
          <div><kbd>Ctrl / Cmd</kbd><b>+</b><kbd>Drag</kbd><span>Add range</span></div>
          <div><kbd>Ctrl / Cmd</kbd><b>+</b><kbd>Click link</kbd><span>Open link</span></div>
        </div>
      </section>
    </main>
  {:else}
    <main class="page plan-page">
      <section class="plan-intro">
        <span class="section-kicker">Build order</span>
        <h2>Correctness first. Components second. Merge last.</h2>
        <p>
          The computed merge is clean today—two commits on main, seven on the branch—but a clean
          tree does not make unsafe interactions safe. Each phase below closes with evidence.
        </p>
      </section>
      <section class="phase-list">
        {#each phases as phase}
          <article>
            <span class="phase-number">{phase.number}</span>
            <div><h3>{phase.title}</h3><p>{phase.body}</p></div>
            <aside><span>Exit gate</span><b>{phase.gate}</b></aside>
          </article>
        {/each}
      </section>
      <section class="merge-gate">
        <div><span class="section-kicker">Final evidence</span><h2>Ready means quiet.</h2></div>
        <ul>
          <li><span>✓</span> Typecheck, unit tests, lint, and production build</li>
          <li><span>✓</span> Narrow, default, and expanded inspector/browser runs</li>
          <li><span>✓</span> Ten consecutive FG/BG changes plus undo/redo</li>
          <li><span>✓</span> Style continuation matrix for Body, headings, Quote, Caption, Code</li>
          <li><span>✓</span> Comments, links, header/footer, page numbering, and Sections paths</li>
          <li><span>✓</span> Zero console errors, page errors, or unexpected failed requests</li>
        </ul>
      </section>
    </main>
  {/if}
</div>

<style>
  :global(body) { margin: 0; }
  :global(*) { box-sizing: border-box; }
  :global(button), :global(input), :global(select), :global(textarea) { font: inherit; }

  .artifact {
    --ground: var(--token-surface-canvas);
    --panel: var(--token-surface-panel);
    --raised: var(--token-surface-elevated);
    --pasteboard: var(--token-surface-pasteboard);
    --ink: var(--token-ink-primary);
    --ink-2: var(--token-ink-secondary);
    --ink-3: var(--token-ink-muted);
    --rule: var(--token-border-subtle);
    --rule-strong: var(--token-border-strong);
    --blue: var(--token-color-interactive-text);
    --blue-soft: var(--token-color-interactive-surface);
    --rose: var(--token-color-accent-1-text);
    --rose-soft: var(--token-color-accent-1-surface);
    --amber: var(--token-color-attention-text);
    --amber-soft: var(--token-color-attention-surface);
    min-height: 100vh;
    background: var(--ground);
    color: var(--ink);
    font-family: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.5;
  }

  button { color: inherit; }
  code, kbd, .commit, .owner, .priority, .phase-number { font-family: "IBM Plex Mono", ui-monospace, monospace; }
  code { padding: 1px 5px; border: 1px solid var(--rule); border-radius: 4px; background: var(--panel); font-size: .86em; }
  .mast { display: grid; grid-template-columns: minmax(0, 1fr) 17rem; gap: 4rem; max-width: 92rem; margin: 0 auto; padding: 4.5rem 3.5rem 3rem; }
  .eyebrow, .section-kicker { display: block; margin: 0 0 .75rem; color: var(--rose); font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
  h1 { max-width: 13ch; margin: 0; font-size: clamp(3rem, 6vw, 5.6rem); line-height: .94; letter-spacing: -.055em; }
  .lede { max-width: 63ch; margin: 1.6rem 0 0; color: var(--ink-2); font-size: 1.08rem; }
  .decision { align-self: end; padding: 1.1rem 1.2rem; border: 1px solid color-mix(in srgb, var(--rose) 35%, var(--rule)); border-left: 4px solid var(--rose); border-radius: 0 10px 10px 0; background: var(--rose-soft); }
  .decision-label { display: block; color: var(--rose); font-size: 10px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; }
  .decision strong { display: block; margin: .2rem 0; font-size: 2rem; line-height: 1; }
  .decision p { margin: .45rem 0 .8rem; color: var(--ink-2); font-size: 13px; }
  .commit { color: var(--ink-3); font-size: 10.5px; }
  .tabs { position: sticky; top: 0; z-index: 20; display: flex; gap: 0; border-block: 1px solid var(--rule); background: color-mix(in srgb, var(--ground) 92%, transparent); backdrop-filter: blur(12px); }
  .tabs button { flex: 1; padding: .85rem 1rem; border: 0; border-right: 1px solid var(--rule); background: transparent; color: var(--ink-3); cursor: pointer; font-size: 13px; font-weight: 650; }
  .tabs button:last-child { border-right: 0; }
  .tabs button span { margin-right: .5rem; color: var(--rule-strong); font-family: "IBM Plex Mono", monospace; font-size: 10px; }
  .tabs button.active { box-shadow: inset 0 -3px 0 var(--blue); background: var(--blue-soft); color: var(--blue); }
  .page { max-width: 92rem; margin: 0 auto; padding: 3rem 3.5rem 7rem; }
  .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); border: 1px solid var(--rule); border-radius: 12px; overflow: hidden; }
  .summary-grid div { min-height: 7rem; padding: 1.15rem; border-right: 1px solid var(--rule); background: var(--raised); }
  .summary-grid div:last-child { border-right: 0; }
  .summary-grid strong { display: block; font-size: 2.2rem; line-height: 1; letter-spacing: -.04em; }
  .summary-grid span { display: block; margin-top: .6rem; color: var(--ink-3); font-size: 12px; }
  .summary-grid .warn { background: var(--rose-soft); }
  .summary-grid .warn strong { color: var(--rose); }
  .intro-card { display: grid; grid-template-columns: minmax(18rem, .8fr) minmax(20rem, 1fr); gap: 3rem; margin-top: 1.5rem; padding: 2.2rem; border-radius: 12px; background: var(--ink); color: var(--ground); }
  .intro-card h2, .section-head h2, .target-intro h2, .plan-intro h2, .merge-gate h2 { margin: 0; font-size: clamp(1.8rem, 3vw, 2.8rem); line-height: 1.05; letter-spacing: -.035em; }
  .intro-card p { margin: 1.25rem 0 0; color: var(--token-ink-on-fill); }
  .section-block, .gesture-section { margin-top: 5rem; }
  .section-head { display: flex; align-items: end; justify-content: space-between; gap: 2rem; padding-bottom: 1rem; border-bottom: 2px solid var(--ink); }
  .section-head p { max-width: 36rem; margin: 0; color: var(--ink-3); font-size: 13px; text-align: right; }
  .findings { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; margin-top: 1.25rem; border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; background: var(--rule); }
  .finding-card { min-height: 13.5rem; padding: 1.25rem; background: var(--raised); }
  .finding-card.p0 { background: linear-gradient(145deg, var(--rose-soft), var(--raised) 68%); }
  .finding-top { display: flex; justify-content: space-between; gap: 1rem; }
  .priority { color: var(--amber); font-size: 10px; font-weight: 700; }
  .p0 .priority { color: var(--rose); }
  .owner { color: var(--ink-3); font-size: 10px; }
  .finding-card h3 { max-width: 28ch; margin: 1.6rem 0 .55rem; font-size: 1.18rem; line-height: 1.2; }
  .finding-card p { max-width: 54ch; margin: 0; color: var(--ink-2); font-size: 13px; }
  .table-wrap { margin-top: 1.25rem; overflow-x: auto; border: 1px solid var(--rule); border-radius: 10px; background: var(--raised); }
  table { width: 100%; border-collapse: collapse; min-width: 55rem; }
  th { padding: .8rem 1rem; border-bottom: 1px solid var(--rule-strong); color: var(--ink-3); font-size: 10px; letter-spacing: .12em; text-align: left; text-transform: uppercase; }
  td { padding: .8rem 1rem; border-bottom: 1px solid var(--rule); color: var(--ink-2); font-size: 13px; vertical-align: top; }
  tr:last-child td { border-bottom: 0; }
  td:first-child, td:last-child { color: var(--ink); font-weight: 600; }
  .captured { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; margin-top: 1.25rem; border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; background: var(--rule); }
  .captured div { display: grid; grid-template-columns: 2rem 1fr; gap: .5rem; min-height: 4.25rem; padding: .8rem; background: var(--raised); }
  .captured span { color: var(--blue); font-family: "IBM Plex Mono", monospace; font-size: 10px; }
  .captured p { margin: 0; font-size: 12.5px; line-height: 1.35; }

  .target-intro { display: grid; grid-template-columns: minmax(0, 1fr) 18rem; gap: 3rem; align-items: end; }
  .target-intro p, .plan-intro p { max-width: 65ch; margin: 1rem 0 0; color: var(--ink-2); }
  .width-control { display: grid; grid-template-columns: 1fr auto; gap: .45rem .8rem; padding: .9rem 1rem; border: 1px solid var(--rule); border-radius: 9px; background: var(--raised); }
  .width-control span { color: var(--ink-3); font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .width-control input { grid-column: 1 / -1; width: 100%; accent-color: var(--blue); }
  .width-control output { color: var(--blue); font-family: "IBM Plex Mono", monospace; font-size: 11px; }
  .mock-shell { display: grid; grid-template-columns: minmax(30rem, 1fr) auto; gap: 1rem; align-items: start; margin-top: 2rem; padding: 1rem; border: 1px solid var(--rule-strong); border-radius: 12px; background: var(--pasteboard); overflow-x: auto; }
  .document-stage { min-width: 30rem; }
  .stage-bar { display: flex; justify-content: space-between; gap: 1rem; padding: .65rem .8rem; border-radius: 7px 7px 0 0; background: var(--panel); color: var(--ink-2); font-size: 11px; }
  .stage-bar span:last-child { color: var(--ink-3); }
  .paper { position: relative; width: min(100%, 49rem); min-height: 46rem; margin: 1.5rem auto .75rem; padding: 6.2rem 5.5rem 5.2rem; background: var(--raised); box-shadow: var(--token-shadow-overlay); }
  .paper-body { max-width: 42rem; }
  .paper-body h3 { margin: 0 0 .4rem; font-size: 2rem; line-height: 1.1; }
  .paper-body h4 { margin: 2rem 0 .5rem; font-size: 1.1rem; }
  .paper-body p { margin: 0 0 1.2rem; color: var(--ink-2); font-family: Georgia, serif; font-size: 1.05rem; line-height: 1.7; }
  .paper-body .date { color: var(--ink-3); font-family: inherit; font-size: .95rem; }
  .selection { padding: 1px 2px; background: var(--token-surface-selection); box-shadow: inset 0 -1px 0 var(--token-color-interactive-border); }
  .commented { background: linear-gradient(transparent 68%, var(--token-color-attention-surface-hover) 68%); }
  .furniture { position: absolute; right: 5.5rem; left: 5.5rem; display: flex; align-items: baseline; justify-content: space-between; padding: .35rem .45rem; border: 1px solid transparent; background: transparent; color: var(--ink-3); text-align: left; cursor: text; }
  .furniture.header { top: 2.1rem; }
  .furniture.footer { bottom: 1.8rem; }
  .furniture span { color: var(--ink-3); font-family: "IBM Plex Mono", monospace; font-size: 9px; letter-spacing: .1em; }
  .furniture b { font-size: 11px; font-weight: 500; outline: none; }
  .furniture.editing { border-color: var(--blue); background: var(--blue-soft); color: var(--blue); }
  .comment-pin { position: absolute; right: -2rem; top: 29rem; display: grid; width: 1.5rem; height: 1.5rem; place-items: center; border-radius: 50%; background: var(--amber); color: white; font-size: 10px; font-weight: 700; }
  .canvas-note { margin: .5rem .75rem 0; color: var(--ink-3); font-size: 11px; text-align: center; }

  .inspector-mock { container-type: inline-size; min-width: 280px; max-width: 500px; min-height: 51rem; border: 1px solid var(--rule); border-radius: 9px; background: var(--ground); box-shadow: var(--token-shadow-raised); overflow: hidden; }
  .panel-switcher { display: grid; grid-template-columns: repeat(3, 1fr); border-bottom: 1px solid var(--rule); background: var(--panel); }
  .panel-switcher button { padding: .55rem .4rem; border: 0; border-right: 1px solid var(--rule); background: transparent; color: var(--ink-3); cursor: pointer; font-size: 11px; }
  .panel-switcher button:last-child { border-right: 0; }
  .panel-switcher button.active { box-shadow: inset 0 -2px 0 var(--blue); background: var(--blue-soft); color: var(--blue); font-weight: 700; }
  .panel-title { padding: .8rem .85rem .6rem; }
  .panel-title span { color: var(--ink-3); font-size: 10px; }
  .panel-title h3 { margin: .15rem 0 0; font-size: 14px; }
  .selection-quote { display: flex; flex-direction: column; gap: .25rem; margin: 0 .85rem .8rem; padding: .65rem .75rem; border-left: 2px solid var(--rule-strong); border-radius: 0 6px 6px 0; background: var(--panel); }
  .selection-quote q { font-size: 13px; }
  .selection-quote span { color: var(--ink-3); font-size: 10px; }
  .panel-section { border-top: 1px solid var(--rule); }
  .panel-section-head { display: flex; align-items: center; justify-content: space-between; min-height: 2.1rem; padding: .48rem .85rem; color: var(--ink-2); }
  .panel-section-head b { font-size: 10px; letter-spacing: .09em; text-transform: uppercase; }
  .panel-section-head span { color: var(--ink-3); font-size: 10px; }
  .panel-section.open .panel-section-head { background: color-mix(in srgb, var(--panel) 54%, transparent); }
  .panel-section.body-style .panel-section-head { border-left: 3px solid var(--blue); background: var(--blue-soft); color: var(--blue); }
  .panel-section.shut { cursor: pointer; }
  .panel-body { display: flex; flex-direction: column; gap: .55rem; padding: .7rem .85rem .85rem; }
  .field { display: flex; min-width: 0; }
  .field.stack { flex-direction: column; gap: .25rem; }
  .field > span, .orientation > span { color: var(--ink-3); font-size: 10px; }
  select, input[type="number"], textarea { min-width: 0; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--raised); color: var(--ink); outline: none; }
  select:focus, input:focus, textarea:focus { border-color: var(--blue); box-shadow: 0 0 0 2px color-mix(in srgb, var(--blue) 18%, transparent); }
  select { width: 100%; height: 1.85rem; padding: 0 .45rem; font-size: 12px; }
  .font-row { display: grid; grid-template-columns: minmax(0, 1fr) 3.6rem; gap: .45rem; }
  .number input { width: 100%; height: 1.85rem; padding: 0 .35rem; text-align: center; }
  .format-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .3rem; }
  .format-grid button, .alignment button, .orientation button { min-width: 0; height: 1.85rem; border: 1px solid var(--rule-strong); background: var(--raised); color: var(--ink-2); cursor: pointer; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .format-grid button { border-radius: 5px; }
  .format-grid button.active, .alignment button.active, .orientation button.active { border-color: var(--blue); background: var(--blue-soft); color: var(--blue); }
  .format-grid .word { display: none; }
  .format-grid button.italic { font-style: italic; }
  .format-grid button.underline { text-decoration: underline; text-underline-offset: 2px; }
  .format-grid button.strike { text-decoration: line-through; }
  @container (min-width: 390px) {
    .format-grid .letter { display: none; }
    .format-grid .word { display: inline; }
  }
  .color-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .55rem; }
  .color-row > div { display: flex; align-items: center; gap: .35rem; min-width: 0; }
  .color-row > div > span { flex: none; color: var(--ink-3); font-size: 9px; font-weight: 700; }
  .color-row button { display: flex; min-width: 0; height: 1.85rem; flex: 1; align-items: center; gap: .35rem; padding: 0 .42rem; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--raised); cursor: pointer; }
  .color-row i { width: .85rem; height: .85rem; flex: none; border: 1px solid var(--rule); border-radius: 50%; }
  .color-row b { min-width: 0; overflow: hidden; color: var(--ink-3); font-size: 9.5px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
  .color-row em { margin-left: auto; color: var(--ink-3); font-style: normal; }
  .color-picker { border: 1px solid var(--rule-strong); border-radius: 8px; background: var(--raised); box-shadow: var(--token-shadow-overlay); overflow: hidden; }
  .picker-head { display: flex; justify-content: space-between; padding: .55rem .6rem; border-bottom: 1px solid var(--rule); }
  .picker-head b { font-size: 11px; }
  .picker-head span { color: var(--ink-3); font-size: 9px; }
  .swatch-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: .4rem; padding: .6rem; }
  .swatch-grid button { display: grid; aspect-ratio: 1; place-items: center; border: 1px solid transparent; border-radius: 6px; background: transparent; cursor: pointer; }
  .swatch-grid button.active { border-color: var(--blue); background: var(--blue-soft); }
  .swatch-grid i { width: 1.15rem; height: 1.15rem; border: 1px solid var(--rule-strong); border-radius: 50%; }
  .picker-action { display: flex; width: 100%; align-items: center; gap: .5rem; padding: .48rem .65rem; border: 0; border-top: 1px solid var(--rule); background: transparent; color: var(--ink-2); cursor: pointer; font-size: 11px; text-align: left; }
  .picker-action:hover { background: var(--panel); }
  .alignment { display: grid; grid-template-columns: repeat(4, 1fr); gap: .3rem; }
  .alignment button { border-radius: 5px; font-size: 16px; line-height: 1; }
  .alignment button:nth-child(2) { text-align: center; }
  .alignment button:nth-child(3) { text-align: right; }
  .alignment button:nth-child(4) { letter-spacing: 2px; }
  .value-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .45rem .55rem; }
  .value-grid label { display: flex; min-width: 0; flex-direction: column; gap: .22rem; }
  .value-grid label > span { color: var(--ink-3); font-size: 9.5px; }
  .value-grid label > div { display: flex; min-width: 0; height: 1.78rem; align-items: center; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--raised); overflow: hidden; }
  .value-grid input { width: 100%; height: 100%; padding: 0 .4rem; border: 0; border-radius: 0; background: transparent; font-family: "IBM Plex Mono", monospace; font-size: 11px; }
  .value-grid em { padding-right: .42rem; color: var(--ink-3); font-size: 9px; font-style: normal; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }

  .panel-actions { display: flex; flex-wrap: wrap; gap: .35rem; padding: 0 .85rem .75rem; }
  .panel-actions button, .reply-box button, .furniture-rows button { min-height: 1.65rem; padding: 0 .55rem; border: 1px solid var(--rule-strong); border-radius: 5px; background: var(--raised); cursor: pointer; font-size: 10px; }
  button.primary { border-color: var(--blue); background: var(--blue); color: white; }
  .thread-source { margin: 0 .85rem .8rem; padding: .7rem .75rem; border: 1px solid var(--token-color-attention-border); border-left: 3px solid var(--amber); border-radius: 0 7px 7px 0; background: var(--amber-soft); }
  .thread-source > span { display: block; margin-bottom: .3rem; color: var(--amber); font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .thread-source q { color: var(--ink-2); font-family: Georgia, serif; font-size: 12px; line-height: 1.5; }
  .thread-divider { display: flex; align-items: center; gap: .5rem; margin: .85rem; color: var(--ink-3); font-size: 9px; letter-spacing: .11em; text-transform: uppercase; }
  .thread-divider::before, .thread-divider::after { height: 1px; flex: 1; background: var(--rule); content: ""; }
  .comment-card { margin: 0 .85rem .65rem; padding: .7rem .75rem; border: 1px solid var(--rule); border-radius: 7px; background: var(--raised); }
  .comment-card.opener { border-left: 3px solid var(--blue); }
  .comment-card.reply { margin-left: 1.65rem; background: color-mix(in srgb, var(--panel) 42%, var(--raised)); }
  .comment-card > div { display: flex; gap: .5rem; align-items: center; }
  .avatar { display: grid; width: 1.7rem; height: 1.7rem; flex: none; place-items: center; border-radius: 50%; background: var(--blue); color: white; font-size: 8px; font-weight: 700; }
  .avatar.alt { background: var(--ink-2); }
  .comment-card div p { margin: 0; }
  .comment-card b { display: block; font-size: 11px; }
  .comment-card small { display: block; color: var(--ink-3); font-size: 9px; }
  .comment-card > p { margin: .55rem 0 0; color: var(--ink-2); font-size: 11.5px; line-height: 1.45; }
  .reply-box { display: flex; flex-direction: column; align-items: flex-start; gap: .45rem; margin: .85rem; }
  .reply-box textarea { width: 100%; min-height: 4.2rem; padding: .5rem; resize: vertical; font-size: 11px; }
  .detached-note { margin: 1rem .85rem; padding: .65rem .7rem; border: 1px dashed var(--rule-strong); border-radius: 7px; color: var(--ink-2); }
  .detached-note b { font-size: 10.5px; }
  .detached-note p { margin: .2rem 0 0; color: var(--ink-3); font-size: 10px; }

  .orientation { display: flex; flex-direction: column; gap: .25rem; }
  .orientation > div { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .35rem; }
  .orientation button { border-radius: 5px; font-size: 10px; }
  .margins { padding-top: .7rem; }
  .furniture-rows > div { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
  .furniture-rows > div > span { display: flex; align-items: center; gap: .45rem; }
  .furniture-rows b { font-size: 11px; }
  .switch { position: relative; display: inline-block; width: 1.6rem; height: .9rem; border-radius: 99px; background: var(--rule-strong); }
  .switch::after { position: absolute; top: 2px; left: 2px; width: .65rem; height: .65rem; border-radius: 50%; background: white; content: ""; }
  .switch.on { background: var(--blue); }
  .switch.on::after { left: calc(100% - .65rem - 2px); }
  .check-row, .first-number { display: flex; align-items: center; justify-content: space-between; gap: .6rem; color: var(--ink-2); font-size: 10.5px; }
  .check-row { justify-content: flex-start; }
  .check-row input { accent-color: var(--blue); }
  .first-number input { width: 4.2rem; height: 1.75rem; padding: 0 .4rem; }
  .inline-note { margin: 0; padding: .45rem .55rem; border-radius: 5px; background: var(--blue-soft); color: var(--blue); font-size: 10px; }

  .gestures { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .6rem; margin-top: 1.25rem; }
  .gestures div { display: flex; min-height: 4rem; align-items: center; gap: .4rem; padding: .75rem; border: 1px solid var(--rule); border-radius: 8px; background: var(--raised); }
  .gestures kbd { padding: .2rem .42rem; border: 1px solid var(--rule-strong); border-bottom-width: 2px; border-radius: 4px; background: var(--panel); font-size: 9px; white-space: nowrap; }
  .gestures b { color: var(--ink-3); font-size: 10px; }
  .gestures span { margin-left: auto; color: var(--ink-2); font-size: 11px; text-align: right; }

  .plan-intro { max-width: 60rem; }
  .phase-list { display: flex; flex-direction: column; gap: .7rem; margin-top: 2rem; }
  .phase-list article { display: grid; grid-template-columns: 3.5rem minmax(0, 1fr) 16rem; gap: 1.3rem; align-items: start; padding: 1.3rem; border: 1px solid var(--rule); border-radius: 10px; background: var(--raised); }
  .phase-number { color: var(--blue); font-size: 1.15rem; }
  .phase-list h3 { margin: 0 0 .3rem; font-size: 1.15rem; }
  .phase-list p { max-width: 65ch; margin: 0; color: var(--ink-2); font-size: 13px; }
  .phase-list aside { padding-left: 1rem; border-left: 1px solid var(--rule); }
  .phase-list aside span { display: block; margin-bottom: .25rem; color: var(--ink-3); font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .phase-list aside b { font-size: 11px; line-height: 1.35; }
  .merge-gate { display: grid; grid-template-columns: minmax(16rem, .7fr) minmax(22rem, 1fr); gap: 3rem; margin-top: 4rem; padding: 2rem; border-radius: 12px; background: var(--ink); color: var(--ground); }
  .merge-gate ul { display: grid; gap: .55rem; margin: 0; padding: 0; list-style: none; }
  .merge-gate li { display: grid; grid-template-columns: 1.3rem 1fr; color: var(--token-ink-on-fill); font-size: 13px; }
  .merge-gate li span { color: var(--token-color-success-on-fill); font-weight: 700; }

  @media (max-width: 72rem) {
    .mast { grid-template-columns: 1fr; gap: 2rem; }
    .decision { max-width: 26rem; }
    .summary-grid { grid-template-columns: repeat(3, 1fr); }
    .summary-grid div:nth-child(3) { border-right: 0; }
    .summary-grid div:nth-child(-n+3) { border-bottom: 1px solid var(--rule); }
    .captured { grid-template-columns: repeat(2, 1fr); }
    .mock-shell { grid-template-columns: 1fr; }
    .inspector-mock { width: min(100%, 500px) !important; justify-self: center; }
  }
  @media (max-width: 48rem) {
    .mast, .page { padding-right: 1.1rem; padding-left: 1.1rem; }
    .mast { padding-top: 2.5rem; }
    .intro-card, .target-intro, .merge-gate { grid-template-columns: 1fr; gap: 1.5rem; }
    .summary-grid { grid-template-columns: repeat(2, 1fr); }
    .summary-grid div { border-right: 1px solid var(--rule) !important; border-bottom: 1px solid var(--rule); }
    .summary-grid div:nth-child(even) { border-right: 0 !important; }
    .findings, .captured, .gestures { grid-template-columns: 1fr; }
    .section-head { align-items: start; flex-direction: column; gap: .6rem; }
    .section-head p { text-align: left; }
    .phase-list article { grid-template-columns: 2.5rem minmax(0, 1fr); }
    .phase-list aside { grid-column: 2; padding: .65rem 0 0; border-top: 1px solid var(--rule); border-left: 0; }
  }
</style>
