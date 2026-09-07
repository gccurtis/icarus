<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Braces from "@lucide/svelte/icons/braces";
  import Check from "@lucide/svelte/icons/check";
  import Database from "@lucide/svelte/icons/database";
  import FileText from "@lucide/svelte/icons/file-text";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import Play from "@lucide/svelte/icons/play";
  import Search from "@lucide/svelte/icons/search";
  import Sparkles from "@lucide/svelte/icons/sparkles";

  import { createProjectResource } from "$capabilities/project-resources/index.remote";
  import { submitDocumentChanges } from "$capabilities/document/index.remote";
  import {
    createDerivedOutput,
    createTemplatedDerivedOutput,
    readDerivedOutputValue,
    refreshDerivedOutput,
    type ReadDerivedOutputValueResult
  } from "$capabilities/derived-output/index.remote";
  import { processSemanticSyncQueue } from "$capabilities/semantic-overlay/index.remote";

  type Mode = "prompt" | "template";
  type StepState = "waiting" | "running" | "complete";
  type Step = { label: string; detail: string; state: StepState };

  const INITIAL_STEPS: Step[] = [
    { label: "Authoritative resource", detail: "create + submitDocumentChanges", state: "waiting" },
    { label: "Semantic publication", detail: "queue → projection → embeddings → index", state: "waiting" },
    { label: "Grounded synthesis", detail: "create → retrieve → refresh", state: "waiting" },
    { label: "Value API", detail: "readDerivedOutputValue", state: "waiting" }
  ];

  let mode = $state<Mode>("prompt");
  let sourceText = $state("Synthetic test fact: the fictional Atlas beacon emits at 37 kilohertz.");
  let question = $state("At what frequency does the fictional Atlas beacon emit?");
  let outputTemplate = $state("{{beacon}} emits at {{frequency}} kilohertz.");
  let exampleResponse = $state("Orion emits at 42 kilohertz.");
  let running = $state(false);
  let steps = $state<Step[]>(INITIAL_STEPS.map((step) => ({ ...step })));
  let result = $state<ReadDerivedOutputValueResult>(null);
  let resourceId = $state<string | null>(null);
  let error = $state<string | null>(null);

  const setStep = (index: number, state: StepState) => {
    steps = steps.map((step, at) => (at === index ? { ...step, state } : step));
  };

  const reset = () => {
    steps = INITIAL_STEPS.map((step) => ({ ...step }));
    result = null;
    resourceId = null;
    error = null;
  };

  const run = async () => {
    if (running || !sourceText.trim()) return;
    running = true;
    reset();
    try {
      setStep(0, "running");
      const resource = await createProjectResource({
        target: "document",
        title: `Derived Output proof · ${new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit"
        })}`
      });
      resourceId = resource.resourceId;
      const rowId = `row:${crypto.randomUUID()}`;
      const blockId = `block:${crypto.randomUUID()}`;
      const atomId = `atom:${crypto.randomUUID()}`;
      const row = {
        id: rowId,
        kind: "blocks" as const,
        blocks: [
          {
            id: blockId,
            type: "text" as const,
            variant: "paragraph" as const,
            atoms: [{ id: atomId, kind: "literal" as const, text: sourceText.trim() }],
            display: sourceText.trim(),
            marks: []
          }
        ]
      };
      const submitted = await submitDocumentChanges({
        changeSet: {
          resourceId: resource.resourceId,
          baseRevision: 0,
          ops: [
            {
              op: "insert",
              target: "row",
              path: "rows",
              ids: [rowId],
              after: null,
              values: [row]
            }
          ],
          touched: ["rows"]
        }
      });
      if (!submitted.accepted) throw new Error(submitted.detail);
      setStep(0, "complete");

      setStep(1, "running");
      const synced = await processSemanticSyncQueue({
        limit: 1,
        ref: { kind: "document", id: resource.resourceId }
      });
      const publication = synced.processed[0];
      if (publication?.error !== undefined) throw new Error(publication.error);
      if (publication?.result?.outcome !== "published") {
        throw new Error(`Semantic publication ended as ${publication?.result?.outcome ?? "missing"}`);
      }
      setStep(1, "complete");

      setStep(2, "running");
      const scope = {
        include: [
          {
            select: "resources" as const,
            refs: [{ kind: "document", id: resource.resourceId }]
          }
        ],
        exclude: []
      };
      const output =
        mode === "prompt"
          ? await createDerivedOutput({ prompt: question.trim(), scope })
          : await createTemplatedDerivedOutput({
              template: {
                variables: [
                  { name: "beacon", prompt: "Find the fictional beacon's name." },
                  { name: "frequency", prompt: "Find its frequency as a number." }
                ],
                output: outputTemplate.trim(),
                ...(exampleResponse.trim()
                  ? { exampleResponse: exampleResponse.trim() }
                  : {})
              },
              scope
            });
      const refreshed = await refreshDerivedOutput({ derivedOutputId: output._id });
      if (refreshed === null) throw new Error("The Derived Output disappeared during refresh");
      if (refreshed.outcome !== "published") {
        throw new Error(refreshed.output.error ?? `Refresh ended as ${refreshed.outcome}`);
      }
      setStep(2, "complete");

      setStep(3, "running");
      result = await readDerivedOutputValue({ derivedOutputId: output._id });
      if (result === null) throw new Error("The published Derived Output could not be read");
      setStep(3, "complete");
    } catch (reason) {
      error = reason instanceof Error ? reason.message : String(reason);
    } finally {
      running = false;
    }
  };
</script>

<svelte:head>
  <title>Executable Derived Output proof · Icarus</title>
  <meta
    name="description"
    content="Run the real resource-to-overlay-to-grounded-Derived-Output path."
  />
</svelte:head>

<main class="proof-shell">
  <header class="masthead">
    <a href="/demo/semantic-overlay/derived-output-flow"><ArrowLeft size={16} /> Architecture</a>
    <div class="live-mark"><span></span> EXECUTABLE DEVELOPMENT SURFACE</div>
  </header>

  <section class="intro">
    <div>
      <p class="eyebrow">REAL STORE · REAL PROVIDERS · REAL EVIDENCE</p>
      <h1>Put a fact in one resource.<br /><em>Derive it somewhere else.</em></h1>
    </div>
    <p class="lede">
      This is not a diagram. Running the bench creates a document, lands an edit, drains its
      semantic job, builds the recursive index, asks the grounded agent, stores the result, and
      reads it through the presentation-facing value API.
    </p>
  </section>

  <div class="mode-switch" aria-label="Derived Output kind">
    <button class:active={mode === "prompt"} onclick={() => (mode = "prompt")}>
      <Sparkles size={15} /> Direct prompt
    </button>
    <button class:active={mode === "template"} onclick={() => (mode = "template")}>
      <Braces size={15} /> Named variables
    </button>
  </div>

  <section class="bench">
    <article class="input-card source-card">
      <div class="card-heading">
        <span class="number">01</span>
        <div><small>SOURCE RESOURCE</small><h2>Document text</h2></div>
        <FileText size={21} />
      </div>
      <textarea bind:value={sourceText} maxlength="5000" aria-label="Source document text"></textarea>
      <p>The title and authoritative text are projected; generated prompt blocks are excluded.</p>
    </article>

    <div class="transfer" aria-hidden="true"><span></span><Database size={18} /><span></span></div>

    <article class="input-card request-card">
      <div class="card-heading">
        <span class="number">02</span>
        <div><small>DERIVED DEFINITION</small><h2>{mode === "prompt" ? "Prompt" : "Variable template"}</h2></div>
        {#if mode === "prompt"}<Search size={21} />{:else}<Braces size={21} />{/if}
      </div>
      {#if mode === "prompt"}
        <textarea bind:value={question} maxlength="2000" aria-label="Derived Output prompt"></textarea>
      {:else}
        <div class="variables">
          <div><code>beacon</code><span>Find the fictional beacon's name.</span></div>
          <div><code>frequency</code><span>Find its frequency as a number.</span></div>
        </div>
        <label>Output template<input bind:value={outputTemplate} maxlength="20000" /></label>
        <label>Optional example<input bind:value={exampleResponse} maxlength="20000" /></label>
      {/if}
      <p>{mode === "prompt" ? "The agent writes one grounded response." : "The agent resolves values; application code renders the braces."}</p>
    </article>
  </section>

  <button class="run" onclick={run} disabled={running || !sourceText.trim()}>
    {#if running}<LoaderCircle class="spin" size={18} /> Running real pipeline…{:else}<Play size={18} fill="currentColor" /> Run grounded generation{/if}
  </button>

  <section class="execution">
    <div class="rail" aria-label="Execution steps">
      {#each steps as step, index}
        <div class:complete={step.state === "complete"} class:running={step.state === "running"} class="step">
          <span class="node">{#if step.state === "complete"}<Check size={13} />{:else}{index + 1}{/if}</span>
          <div><strong>{step.label}</strong><small>{step.detail}</small></div>
        </div>
      {/each}
    </div>

    <article class:has-result={result !== null} class="result-card">
      <div class="result-top"><span>04 / STORED VALUE</span>{#if result}<code>{result.state}</code>{/if}</div>
      {#if error}
        <div class="error"><strong>Pipeline stopped</strong><p>{error}</p></div>
      {:else if result}
        <blockquote>{result.value}</blockquote>
        {#if result.variables.length > 0}
          <div class="resolved">
            {#each result.variables as variable}
              <div><code>{`{{${variable.name}}}`}</code><strong>{variable.value}</strong><span>{variable.evidence.map((entry) => entry.evidenceId).join(", ")}</span></div>
            {/each}
          </div>
        {/if}
        <div class="evidence">
          <h3>Evidence copied by value</h3>
          {#each result.evidence as citation}
            <div>
              <span>{citation.source.ref.kind} · rev {citation.source.revision}{citation.locators?.length ? ` · ${citation.locators.map((entry) => entry.locator.kind).join(" + ")}` : ""}</span>
              <p>{citation.span.text}</p>
              <small>{citation.selections.map((selection) => `${selection.evidenceId} — ${selection.use}`).join(" · ")}</small>
            </div>
          {/each}
        </div>
        <footer><span>Derived Output ID</span><code>{result.derivedOutputId}</code><span>Source ID</span><code>{resourceId}</code></footer>
      {:else}
        <div class="empty-result"><Sparkles size={26} /><p>The grounded response, named values, and exact evidence will land here.</p></div>
      {/if}
    </article>
  </section>
</main>

<style>
  :global(body) { margin: 0; background: #f3f0e9; color: #18201e; font-family: "IBM Plex Sans", sans-serif; }
  :global(*) { box-sizing: border-box; }
  .proof-shell { min-height: 100vh; padding: 26px clamp(20px, 4vw, 68px) 80px; background-image: linear-gradient(rgba(22,55,48,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(22,55,48,.045) 1px, transparent 1px); background-size: 24px 24px; }
  .masthead { display: flex; justify-content: space-between; align-items: center; padding-bottom: 18px; border-bottom: 1px solid #b8b8ad; }
  .masthead a { color: #33433f; display: flex; gap: 7px; align-items: center; text-decoration: none; font: 600 12px "IBM Plex Mono", monospace; }
  .live-mark { display: flex; gap: 8px; align-items: center; color: #416b5e; font: 600 10px "IBM Plex Mono", monospace; letter-spacing: .12em; }
  .live-mark span { width: 7px; height: 7px; border-radius: 50%; background: #1a9b70; box-shadow: 0 0 0 4px rgba(26,155,112,.14); }
  .intro { max-width: 1180px; margin: 58px auto 32px; display: grid; grid-template-columns: 1.35fr .65fr; gap: 60px; align-items: end; }
  .eyebrow { color: #976223; font: 600 10px "IBM Plex Mono", monospace; letter-spacing: .16em; }
  h1 { font: 500 clamp(34px, 5.4vw, 72px)/.98 "IBM Plex Serif", serif; letter-spacing: -.045em; margin: 13px 0 0; }
  h1 em { color: #28765f; font-weight: 400; }
  .lede { color: #59615d; line-height: 1.65; font-size: 14px; margin: 0 0 5px; }
  .mode-switch { width: max-content; margin: 0 auto 22px; padding: 4px; border: 1px solid #c7c5b9; border-radius: 9px; background: rgba(255,255,255,.55); display: flex; }
  .mode-switch button { border: 0; background: transparent; color: #66706c; padding: 9px 14px; border-radius: 6px; display: flex; gap: 7px; align-items: center; font: 600 11px "IBM Plex Mono", monospace; cursor: pointer; }
  .mode-switch button.active { color: #fff; background: #274f44; box-shadow: 0 3px 10px rgba(23,50,42,.18); }
  .bench { max-width: 1180px; margin: auto; display: grid; grid-template-columns: 1fr 72px 1fr; align-items: stretch; }
  .input-card { background: rgba(255,255,255,.83); border: 1px solid #cbc9bd; border-radius: 12px; padding: 22px; box-shadow: 0 10px 35px rgba(42,48,45,.06); }
  .source-card { border-top: 4px solid #ca8135; } .request-card { border-top: 4px solid #28765f; }
  .card-heading { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; margin-bottom: 18px; }
  .number { color: #8d948e; font: 500 10px "IBM Plex Mono", monospace; border: 1px solid #d4d2c8; padding: 5px; border-radius: 4px; }
  .card-heading small, .result-top span { display: block; color: #777f7a; font: 600 9px "IBM Plex Mono", monospace; letter-spacing: .12em; }
  h2 { font: 500 20px "IBM Plex Serif", serif; margin: 3px 0 0; }
  textarea, input { width: 100%; border: 1px solid #cccac0; border-radius: 7px; background: #fbfaf6; color: #1b2925; font: 13px/1.55 "IBM Plex Mono", monospace; padding: 13px; outline: none; }
  textarea { min-height: 132px; resize: vertical; }
  textarea:focus, input:focus { border-color: #39866f; box-shadow: 0 0 0 3px rgba(57,134,111,.1); }
  .input-card > p { margin: 12px 2px 0; color: #7a817d; font-size: 11px; line-height: 1.5; }
  .transfer { display: flex; align-items: center; color: #7d8f89; }
  .transfer span { height: 1px; flex: 1; background: #9eaaa6; }
  .transfer :global(svg) { margin: 0 5px; }
  .variables { display: grid; gap: 6px; margin-bottom: 12px; }
  .variables div { display: grid; grid-template-columns: 78px 1fr; background: #edf3ef; border-radius: 6px; padding: 9px 11px; font-size: 11px; }
  code { font-family: "IBM Plex Mono", monospace; }
  label { display: block; color: #66706c; font: 600 9px "IBM Plex Mono", monospace; letter-spacing: .08em; margin-top: 9px; }
  label input { margin-top: 5px; }
  .run { margin: 24px auto 42px; border: 0; border-radius: 8px; color: white; background: #1f5748; padding: 13px 21px; display: flex; align-items: center; gap: 9px; font: 600 12px "IBM Plex Mono", monospace; cursor: pointer; box-shadow: 0 8px 20px rgba(31,87,72,.22); }
  .run:disabled { opacity: .58; cursor: wait; }
  :global(.spin) { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
  .execution { max-width: 1180px; margin: auto; display: grid; grid-template-columns: 300px 1fr; gap: 34px; }
  .rail { padding: 8px 0; }
  .step { position: relative; display: grid; grid-template-columns: 30px 1fr; gap: 12px; min-height: 67px; color: #818783; }
  .step:not(:last-child)::after { content: ""; position: absolute; left: 14px; top: 28px; bottom: 0; width: 1px; background: #c4c7c1; }
  .node { z-index: 1; width: 29px; height: 29px; display: grid; place-items: center; border-radius: 50%; border: 1px solid #bdc2bd; background: #f3f0e9; font: 600 10px "IBM Plex Mono", monospace; }
  .step strong { display: block; color: #5e6763; font-size: 12px; margin-top: 3px; } .step small { font: 10px/1.5 "IBM Plex Mono", monospace; }
  .step.running .node { color: #28765f; border-color: #28765f; box-shadow: 0 0 0 4px rgba(40,118,95,.12); }
  .step.running strong, .step.complete strong { color: #1d493d; } .step.complete .node { background: #28765f; border-color: #28765f; color: white; }
  .result-card { min-height: 310px; border: 1px dashed #b8bdb7; border-radius: 12px; background: rgba(238,238,231,.72); padding: 24px; }
  .result-card.has-result { border-style: solid; border-color: #9db7ae; background: #fcfbf7; box-shadow: 0 14px 45px rgba(35,65,56,.09); }
  .result-top { display: flex; justify-content: space-between; align-items: center; }
  .result-top code { color: #1a7f60; background: #e1f1e9; border-radius: 99px; padding: 4px 9px; font-size: 9px; text-transform: uppercase; }
  blockquote { margin: 28px 0; font: 500 clamp(24px,3vw,42px)/1.2 "IBM Plex Serif", serif; color: #173c32; }
  .empty-result { min-height: 240px; display: grid; place-content: center; justify-items: center; text-align: center; color: #909690; }
  .empty-result p { max-width: 310px; font: 12px/1.6 "IBM Plex Mono", monospace; }
  .resolved { display: grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap: 8px; margin-bottom: 22px; }
  .resolved div { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; background: #edf4f0; padding: 11px; border-radius: 7px; }
  .resolved code { color: #28765f; font-size: 10px; }.resolved strong { font-size: 12px; }.resolved span { grid-column: 2; color: #78817d; font: 9px "IBM Plex Mono", monospace; }
  .evidence { border-top: 1px solid #deded6; padding-top: 17px; }.evidence h3 { color: #6f7773; font: 600 9px "IBM Plex Mono", monospace; letter-spacing: .12em; text-transform: uppercase; }
  .evidence > div { border-left: 3px solid #ca8135; background: #faf5eb; padding: 10px 13px; margin-top: 8px; }.evidence span,.evidence small { color: #7e694c; font: 9px "IBM Plex Mono", monospace; }.evidence p { margin: 5px 0; font-size: 12px; }
  footer { margin-top: 22px; padding-top: 12px; border-top: 1px solid #deded6; display: grid; grid-template-columns: auto 1fr; gap: 5px 12px; color: #858b87; font-size: 9px; } footer code { overflow-wrap: anywhere; color: #59635f; }
  .error { margin-top: 28px; border-left: 4px solid #b85043; background: #faece9; padding: 15px; color: #7f2f28; }.error p { margin-bottom: 0; font: 11px/1.5 "IBM Plex Mono", monospace; }

  :global(html[data-appearance="selene"]) .proof-shell {
    background-color: #08111c;
    background-image: linear-gradient(rgba(145,165,180,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(145,165,180,.07) 1px, transparent 1px);
    color: #eef7f3;
  }
  :global(html[data-appearance="selene"]) .masthead { border-bottom-color: #29445b; }
  :global(html[data-appearance="selene"]) .masthead a { color: #d7e8e2; }
  :global(html[data-appearance="selene"]) .live-mark { color: #8ed9c2; }
  :global(html[data-appearance="selene"]) .eyebrow { color: #ecad70; }
  :global(html[data-appearance="selene"]) h1 em { color: #4ed9b1; }
  :global(html[data-appearance="selene"]) .lede,
  :global(html[data-appearance="selene"]) .input-card > p,
  :global(html[data-appearance="selene"]) label,
  :global(html[data-appearance="selene"]) .step,
  :global(html[data-appearance="selene"]) .resolved span,
  :global(html[data-appearance="selene"]) footer { color: #91a5b4; }
  :global(html[data-appearance="selene"]) .mode-switch { border-color: #29445b; background: rgba(15,28,43,.8); }
  :global(html[data-appearance="selene"]) .mode-switch button { color: #91a5b4; }
  :global(html[data-appearance="selene"]) .mode-switch button.active { background: #347f78; color: #fff; }
  :global(html[data-appearance="selene"]) .input-card,
  :global(html[data-appearance="selene"]) .result-card.has-result { border-color: #29445b; background: rgba(15,28,43,.94); box-shadow: 0 12px 38px rgba(0,0,0,.22); }
  :global(html[data-appearance="selene"]) textarea,
  :global(html[data-appearance="selene"]) input { border-color: #31516b; background: #0b1724; color: #eef7f3; }
  :global(html[data-appearance="selene"]) .number { border-color: #31516b; color: #91a5b4; }
  :global(html[data-appearance="selene"]) .card-heading small,
  :global(html[data-appearance="selene"]) .result-top span,
  :global(html[data-appearance="selene"]) .evidence h3 { color: #91a5b4; }
  :global(html[data-appearance="selene"]) .variables div,
  :global(html[data-appearance="selene"]) .resolved div { background: #142538; }
  :global(html[data-appearance="selene"]) .transfer { color: #60798a; }
  :global(html[data-appearance="selene"]) .transfer span,
  :global(html[data-appearance="selene"]) .step:not(:last-child)::after { background: #29445b; }
  :global(html[data-appearance="selene"]) .node { border-color: #31516b; background: #08111c; }
  :global(html[data-appearance="selene"]) .step strong { color: #aebfc8; }
  :global(html[data-appearance="selene"]) .step.running strong,
  :global(html[data-appearance="selene"]) .step.complete strong { color: #8ed9c2; }
  :global(html[data-appearance="selene"]) .result-card { border-color: #31516b; background: rgba(15,28,43,.64); }
  :global(html[data-appearance="selene"]) blockquote { color: #dff8ef; }
  :global(html[data-appearance="selene"]) .empty-result { color: #718798; }
  :global(html[data-appearance="selene"]) .evidence,
  :global(html[data-appearance="selene"]) footer { border-color: #29445b; }
  :global(html[data-appearance="selene"]) .evidence > div { background: #211d1a; }
  :global(html[data-appearance="selene"]) .evidence span,
  :global(html[data-appearance="selene"]) .evidence small { color: #d4ae7b; }
  :global(html[data-appearance="selene"]) footer code { color: #b8c5cd; }
  :global(html[data-appearance="selene"]) .error { background: #321d21; color: #ffb4aa; }
  @media (max-width: 800px) { .intro,.execution { grid-template-columns: 1fr; gap: 24px; }.bench { grid-template-columns: 1fr; gap: 14px; }.transfer { height: 32px; transform: rotate(90deg); width: 70px; margin: auto; }.intro { margin-top: 35px; }.lede { max-width: 600px; }.rail { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; }.step { min-height: 55px; }.step::after { display:none; } }
  @media (max-width: 480px) { .proof-shell { padding-inline: 14px; }.masthead { align-items: flex-start; gap: 12px; }.live-mark { text-align: right; }.rail { grid-template-columns: 1fr; }.intro { margin-top: 28px; }.input-card,.result-card { padding: 17px; } }
</style>
