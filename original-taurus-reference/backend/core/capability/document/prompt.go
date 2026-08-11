package document

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"text/template"
	"time"
)

// Prompt-block resolution. A prompt block's display text is generated: a prompt
// is planned into retrieval queries, those queries pull grounded evidence from
// the knowledge lattice, and a structured model call synthesizes the answer (or
// a stable "insufficient" / "contradiction"). The result is incorporated back
// into the block as ordinary editable atoms, with its evidence and status.
//
// The two inference-bearing steps go through the PromptModel port and the
// Retriever port; document imports neither the intelligence nor the knowledge
// package. The composition root supplies the adapters and the casts.

// systemAuthor is the change-set author id for a resolution — a generated edit,
// not a user's.
const systemAuthor = "system"

// ResolveMode selects how a resolution runs. Reload always re-resolves; Refresh
// re-resolves only if something changed (the refresh gate); the empty mode is
// "auto" — a reload when the block has no text yet, else a refresh.
type ResolveMode string

const (
	ResolveReload  ResolveMode = "reload"
	ResolveRefresh ResolveMode = "refresh"
	ResolveAuto    ResolveMode = ""
)

// Usage reports the token consumption a resolution incurred, so its provider
// cost can be surfaced.
type Usage struct {
	PromptTokens int `json:"promptTokens"`
	TotalTokens  int `json:"totalTokens"`
}

func (u *Usage) add(o Usage) {
	u.PromptTokens += o.PromptTokens
	u.TotalTokens += o.TotalTokens
}

// PromptMessage is one message in a structured model call — a role and its
// content. It keeps document free of any provider or intelligence type.
type PromptMessage struct {
	Role    string
	Content string
}

// Attributor tags a context with the unit of work that provider calls made under
// it belong to. The composition root supplies one over the intelligence
// capability's attribution helper; a nil Attributor leaves calls unattributed,
// which costs only the ability to sum one block's spend.
//
// It exists as a port for the same reason PromptModel does: a resolution's model
// calls are made through adapters, and this capability must not learn what a
// provider or a telemetry sink is in order to say which block it is resolving.
type Attributor func(ctx context.Context, subject string) context.Context

// attribute tags ctx with this resolution's subject when an Attributor is
// configured, and returns ctx unchanged otherwise, so call sites need no guard.
func (d *Documents) attribute(ctx context.Context, subject string) context.Context {
	if d.attributor == nil {
		return ctx
	}
	return d.attributor(ctx, subject)
}

// PromptModel is the structured-reasoning port a resolution uses. Plan turns a
// prompt into retrieval queries; Synthesize turns a prompt plus evidence into
// the answer. Each is a JSON-schema-constrained call; the two methods let the
// composition root dispatch each under its own configured cast.
type PromptModel interface {
	Plan(ctx context.Context, messages []PromptMessage, schema json.RawMessage) (json.RawMessage, Usage, error)
	Synthesize(ctx context.Context, messages []PromptMessage, schema json.RawMessage) (json.RawMessage, Usage, error)
}

// Retriever is the knowledge port a resolution uses: Retrieve pulls grounded
// evidence spans for a set of queries — pooled and consolidated into one
// non-overlapping set by the knowledge layer — and ChangedSince reports whether
// the project's knowledge has changed since a time, the cheap signal that gates a
// refresh. Both are satisfied over the knowledge service at composition.
type Retriever interface {
	Retrieve(ctx context.Context, projectID string, queries []string, topK int) ([]EvidenceSpan, Usage, error)
	// RetrieveScoped is Retrieve restricted to an allow-set of source origins — the
	// resolved includes − excludes of a block's context selection. An empty allow
	// yields no evidence; callers use Retrieve for whole-project retrieval instead.
	RetrieveScoped(ctx context.Context, projectID string, queries []string, topK int, allow []ScopeOrigin) ([]EvidenceSpan, Usage, error)
	ChangedSince(ctx context.Context, projectID string, since time.Time) (bool, error)
}

// PersonaResolver turns a prompt block's persona selection into instruction text
// to overlay the resolution's system messages — the same persona a chat turn or
// agent ask applies, resolved here through a port so the document capability
// imports no persona types. It is satisfied over the persona service at
// composition; when nil, a block's persona is ignored.
type PersonaResolver interface {
	PersonaInstructions(projectID string, ref PersonaRef) (string, error)
}

// ScopeResolver expands a block's context selection to concrete leaf origins. It
// receives the block's included and excluded origins (an anonymous context
// definition) and returns the flattened, leaf-level includes − excludes:
// context-kind origins are expanded (nested contexts, whole-project) and
// non-context origins pass through. Satisfied over the contexts capability at
// composition; when nil, the document falls back to origin-level subtraction.
type ScopeResolver interface {
	ExpandScope(ctx context.Context, projectID string, include, exclude []ScopeOrigin) ([]ScopeOrigin, error)
}

// ResolveResult summarizes a resolution: its outcome status, how many evidence
// spans grounded it, whether a refresh skipped as up-to-date, and the usage it
// cost.
type ResolveResult struct {
	Status   string `json:"status"`
	Evidence int    `json:"evidence"`
	Skipped  bool   `json:"skipped"`
	Usage    Usage  `json:"usage"`
}

// JobTypeResolve is the job type for resolving a prompt block off the request
// path — the model calls make it too slow to run inline.
const JobTypeResolve = "document.resolve"

// resolvePayload is the JSON payload of a JobTypeResolve job.
type resolvePayload struct {
	ProjectID  string      `json:"projectId"`
	DocumentID string      `json:"documentId"`
	BlockID    string      `json:"blockId"`
	Mode       ResolveMode `json:"mode"`
}

// ResolveJob is the job.Handler for JobTypeResolve: it decodes the payload and
// resolves the named prompt block. Registered with the job registry at startup.
func (d *Documents) ResolveJob(ctx context.Context, payload json.RawMessage) error {
	var p resolvePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return err
	}
	_, err := d.ResolveBlock(ctx, p.ProjectID, p.DocumentID, p.BlockID, p.Mode)
	return err
}

// planSchema constrains the plan step's output: a list of retrieval queries.
// additionalProperties is false and every property is required, as strict
// structured-output modes demand.
var planSchema = json.RawMessage(`{
  "type": "object",
  "properties": { "queries": { "type": "array", "items": { "type": "string" } } },
  "required": ["queries"],
  "additionalProperties": false
}`)

// synthSchema constrains the synthesis step's output: a status and the response.
var synthSchema = json.RawMessage(`{
  "type": "object",
  "properties": {
    "status": { "type": "string", "enum": ["ok", "insufficient", "contradiction"] },
    "response": { "type": "string" }
  },
  "required": ["status", "response"],
  "additionalProperties": false
}`)

// ResolveBlock resolves a prompt block: plan → retrieve → synthesize →
// incorporate. It loads the current resolved document, plans the instruction
// into queries, retrieves grounded evidence, synthesizes the display text (or a
// stable insufficient/contradiction), and folds the result back into the block
// as a resolve_block change set. Reload always runs; refresh returns the prior
// result when neither the prompt nor Project knowledge changed.
func (d *Documents) ResolveBlock(ctx context.Context, projectID, documentID, blockID string, mode ResolveMode) (ResolveResult, error) {
	if d.promptModel == nil || d.retriever == nil {
		return ResolveResult{}, fmt.Errorf("document: prompt resolution is not configured")
	}
	// Both model calls a resolution makes — plan and synthesis — are charged to
	// this block, so their separate latencies and costs can be read per block
	// rather than as one blended figure per run.
	ctx = d.attribute(ctx, "document:"+documentID+"#"+blockID)
	doc, err := d.Get(projectID, documentID)
	if err != nil {
		return ResolveResult{}, err
	}
	ri, bi, ok := blockLoc(doc.Base.Rows, blockID)
	if !ok {
		return ResolveResult{}, ErrNotFound
	}
	blk := doc.Base.Rows[ri].Blocks[bi]
	if blk.Kind != BlockKindPrompt {
		return ResolveResult{}, ErrConflict // only a prompt block resolves
	}
	pd, _ := blk.Data.(PromptData)
	priorText := blk.DisplayText()

	// Auto resolves as a reload the first time (no text yet), a refresh after.
	if mode == ResolveAuto {
		if strings.TrimSpace(priorText) == "" {
			mode = ResolveReload
		} else {
			mode = ResolveRefresh
		}
	}
	// The refresh gate: skip re-resolution when nothing has changed. A prompt
	// edit clears ResolvedAt (see the set_prompt op), so a zero ResolvedAt always
	// re-resolves; otherwise check whether any source the prompt was built from
	// has a newer revision than what was stored at resolution time. When no
	// sources carry revision data, fall back to the project-level change signal.
	// Reload skips the gate and always runs.
	if mode == ResolveRefresh && !pd.ResolvedAt.IsZero() {
		changed, err := d.sourcesChanged(projectID, pd.Sources, pd.ResolvedAt)
		if err != nil {
			return ResolveResult{}, err
		}
		if !changed {
			return ResolveResult{Status: pd.Status, Evidence: len(pd.Evidence), Skipped: true}, nil
		}
	}

	var usage Usage

	// Persona: when the block selects one (and a resolver is configured), turn it
	// into instruction text overlaid on the plan and synthesis system messages —
	// the same persona overlay a chat turn or agent ask applies.
	var personaText string
	if pd.Persona != nil && d.personaResolver != nil {
		personaText, err = d.personaResolver.PersonaInstructions(projectID, *pd.Persona)
		if err != nil {
			return ResolveResult{}, err
		}
	}

	// Plan: the instruction becomes retrieval queries.
	planOut, u, err := d.promptModel.Plan(ctx, withPersonaSystem(d.planMessages(pd.Instruction), personaText), planSchema)
	if err != nil {
		return ResolveResult{}, err
	}
	usage.add(u)
	queries := parseQueries(planOut, d.promptMaxQueries)

	// Retrieve: one grounded, consolidated evidence set across all the queries.
	// The knowledge layer pools the queries and merges overlapping spans into a
	// single non-overlapping set (each carrying its best relevance), so the
	// document layer does no pooling of its own. When the block declares a context
	// selection that resolves to a non-empty scope, retrieval is restricted to
	// exactly those sources (includes − excludes); otherwise it spans the project.
	var evidence []EvidenceSpan
	inc, exc := resolveBlockScopeSelection(doc.Base.Template, blk.Context)
	allow := subtractOrigins(inc, exc)
	if d.scopeResolver != nil && (len(inc) > 0 || len(exc) > 0) {
		allow, err = d.scopeResolver.ExpandScope(ctx, projectID, inc, exc)
		if err != nil {
			return ResolveResult{}, err
		}
	}
	if len(allow) > 0 {
		evidence, u, err = d.retriever.RetrieveScoped(ctx, projectID, queries, d.promptTopK, allow)
	} else {
		evidence, u, err = d.retriever.Retrieve(ctx, projectID, queries, d.promptTopK)
	}
	if err != nil {
		return ResolveResult{}, err
	}
	usage.add(u)

	// Synthesize: the grounded answer, or a stable non-answer. The previous
	// prompt and response are passed as a formatting reference only. The document's
	// bound template context variables (if any) are supplied as extra reference
	// material, so a prompt that names a variable resolves with its bound context.
	synthMsgs := withPersonaSystem(appendBoundContext(d.synthMessages(pd.Instruction, pd.LastInstruction, pd.LastOutput, evidence), doc.Base.Template), personaText)
	synthOut, u, err := d.promptModel.Synthesize(ctx, synthMsgs, synthSchema)
	if err != nil {
		return ResolveResult{}, err
	}
	usage.add(u)
	status, response := parseSynthesis(synthOut)

	// Incorporate: replace the block's text and record the resolution. The
	// instruction just resolved is kept as LastInstruction so the next refresh can
	// tell whether the prompt's formatting intent changed.
	resolved := Block{
		ID: blockID, Kind: BlockKindPrompt, Inferred: true,
		Atoms: []Atom{{ID: newID(), Kind: AtomKindText, Text: response}},
		Data: PromptData{
			Instruction:     pd.Instruction,
			Status:          status,
			Evidence:        evidence,
			Sources:         distinctOrigins(evidence),
			LastInstruction: pd.Instruction,
			LastOutput:      response,
			Usage:           usage,
			ResolvedAt:      d.now().UTC(),
		},
	}
	if _, err := d.SubmitChanges(projectID, documentID, systemAuthor, ChangeSubmission{
		SubmissionID:     newID(),
		ExpectedRevision: doc.Revision,
		Operations: []ChangeOp{
			{Op: OpResolveBlock, BlockID: blockID, Block: &resolved},
		},
	}); err != nil {
		return ResolveResult{}, err
	}
	return ResolveResult{Status: status, Evidence: len(evidence), Usage: usage}, nil
}

// PromptTemplates are the overridable prompt strings for the plan and synthesis
// steps. Each is a Go text/template; an empty field falls back to the built-in
// default below. The composition root fills these from configuration, so the
// prompts can be tuned without a code change. The placeholders each template
// receives are documented in docs/architecture/workflows/prompt-resolution.md.
type PromptTemplates struct {
	PlanSystem      string
	PlanUser        string
	SynthesisSystem string
	SynthesisUser   string
}

// Default prompt templates. The plan step turns the instruction into retrieval
// queries; the synthesis step answers from the evidence, using the previous
// response only to keep formatting stable — never as a fact source, so a changed
// source propagates instead of reading as a contradiction.
const (
	defaultPlanSystem = `You plan retrieval to ground an answer to the user's prompt against a knowledge base.
Produce between 1 and {{.MaxQueries}} concise, keyword-rich search queries whose results will provide the evidence needed to answer.
Prefer distinct angles over near-duplicates. Respond only with JSON matching the schema.`

	defaultPlanUser = `Prompt:
{{.Instruction}}`

	defaultSynthesisSystem = `You write the answer to CURRENT PROMPT using ONLY the EVIDENCE items. Follow every rule below.

FACTS
- Every fact in your answer must come from the EVIDENCE. Never use outside knowledge and never invent anything.

ANSWER EXACTLY WHAT WAS ASKED
- Obey every constraint in CURRENT PROMPT literally. If it asks for a name, give the name; if it asks for the exact wording the EVIDENCE uses, reproduce that wording rather than paraphrasing or describing.
- Prefer the specific over the general. When the EVIDENCE names a thing and also describes its category, a prompt asking which thing wants the NAME, not the category. Given "Kestrel is a database engine", the answer to "name the engine" is "Kestrel" — "a database engine" restates the category and answers nothing.
- Do not broaden, soften, or generalize an answer the EVIDENCE states precisely.

STATUS — choose exactly one, judged from the EVIDENCE ALONE (decide as if no PRIOR ANSWER were present):
- "ok": the EVIDENCE supports an answer to the prompt.
- "insufficient": the EVIDENCE does not address the prompt.
- "contradiction": two or more distinct EVIDENCE items disagree with each other on the exact point asked.
A contradiction can ONLY ever be a disagreement between EVIDENCE items. Nothing outside the EVIDENCE can create one. With only one EVIDENCE item on the point, "contradiction" is impossible — use "ok".

PRIOR ANSWER and PRIOR PROMPT (provided only for wording/format consistency):
- They are NOT evidence. Their facts are stale — ignore every fact in them.
- Treat the PRIOR ANSWER as an earlier draft: when the status is "ok", keep its wording and format and change ONLY the facts the EVIDENCE now states differently. If the PRIOR ANSWER differs from the EVIDENCE, the EVIDENCE wins — this is NOT a contradiction, the source simply changed.
- Reuse the PRIOR ANSWER's format only when CURRENT PROMPT asks for the same kind of output as PRIOR PROMPT; otherwise follow CURRENT PROMPT.
- Write your answer as if for the first time. NEVER mention the PRIOR ANSWER, never say a value "changed", "was previously", "used to be", or "now", and never compare the PRIOR ANSWER to the EVIDENCE in your response.

EXAMPLE of the most important rule:
- EVIDENCE: "The tower is 450 meters tall." PRIOR ANSWER: "The tower is 300 meters tall."
- Correct -> status "ok"; response states 450 meters (the EVIDENCE value), with no mention of 300 and no mention of any change.
- Wrong -> status "contradiction"; the PRIOR ANSWER is not EVIDENCE, so it can never create one.

When status is "insufficient" or "contradiction", still write a short response explaining why, referring only to the EVIDENCE. Respond only with JSON matching the schema.`

	defaultSynthesisUser = `CURRENT PROMPT:
{{.Instruction}}

PRIOR PROMPT (wording/format sample only — not evidence):
{{.PreviousPrompt}}

PRIOR ANSWER (wording/format sample only — not evidence, facts may be stale):
{{.PreviousResponse}}

EVIDENCE:
{{range .Evidence}}- {{.Text}}
{{else}}(none)
{{end}}`
)

// promptTemplates holds the parsed templates a Documents service resolves with.
type promptTemplates struct {
	planSystem, planUser, synthSystem, synthUser *template.Template
}

// parsePromptTemplates parses the configured templates, falling back to the
// built-in default for any that is blank or fails to parse (so a bad override
// degrades to the known-good prompt rather than breaking resolution).
func parsePromptTemplates(t PromptTemplates) promptTemplates {
	return promptTemplates{
		planSystem:  parseTemplateOr(t.PlanSystem, defaultPlanSystem),
		planUser:    parseTemplateOr(t.PlanUser, defaultPlanUser),
		synthSystem: parseTemplateOr(t.SynthesisSystem, defaultSynthesisSystem),
		synthUser:   parseTemplateOr(t.SynthesisUser, defaultSynthesisUser),
	}
}

func parseTemplateOr(override, def string) *template.Template {
	src := override
	if strings.TrimSpace(src) == "" {
		src = def
	}
	if t, err := template.New("prompt").Parse(src); err == nil {
		return t
	}
	return template.Must(template.New("prompt").Parse(def))
}

func renderTemplate(t *template.Template, data any) string {
	var b strings.Builder
	// Templates are validated at construction, so Execute does not fail here.
	_ = t.Execute(&b, data)
	return b.String()
}

// planMessages renders the plan-step prompt from the configured templates.
func (d *Documents) planMessages(instruction string) []PromptMessage {
	data := struct {
		Instruction string
		MaxQueries  int
	}{instruction, d.promptMaxQueries}
	return []PromptMessage{
		{Role: "system", Content: renderTemplate(d.prompts.planSystem, data)},
		{Role: "user", Content: renderTemplate(d.prompts.planUser, data)},
	}
}

// synthMessages renders the synthesis-step prompt: the current instruction, the
// previous prompt and response (formatting reference only), and the evidence.
func (d *Documents) synthMessages(instruction, prevPrompt, prevResponse string, evidence []EvidenceSpan) []PromptMessage {
	if strings.TrimSpace(prevPrompt) == "" {
		prevPrompt = "(none)"
	}
	if strings.TrimSpace(prevResponse) == "" {
		prevResponse = "(none)"
	}
	data := struct {
		Instruction      string
		PreviousPrompt   string
		PreviousResponse string
		Evidence         []EvidenceSpan
	}{instruction, prevPrompt, prevResponse, evidence}
	return []PromptMessage{
		{Role: "system", Content: renderTemplate(d.prompts.synthSystem, data)},
		{Role: "user", Content: renderTemplate(d.prompts.synthUser, data)},
	}
}

// withPersonaSystem overlays persona instruction text onto a message list's
// system message, so a block's persona shapes the step the same way a chat turn
// or agent ask applies its persona (persona first, then the step's own system
// prompt). Empty text leaves the messages unchanged; a list with no system
// message gains one.
func withPersonaSystem(messages []PromptMessage, instructions string) []PromptMessage {
	if strings.TrimSpace(instructions) == "" {
		return messages
	}
	out := append([]PromptMessage(nil), messages...)
	for i := range out {
		if out[i].Role == "system" {
			out[i].Content = instructions + "\n\n" + out[i].Content
			return out
		}
	}
	return append([]PromptMessage{{Role: "system", Content: instructions}}, out...)
}

// distinctOrigins reduces the evidence to the distinct sources that grounded it —
// provenance of which sources were drawn on, including the revision at the time
// of retrieval so the refresh gate can detect per-source staleness.
func distinctOrigins(evidence []EvidenceSpan) []SourceVersion {
	seen := map[string]bool{}
	var out []SourceVersion
	for _, e := range evidence {
		key := e.SourceType + "|" + e.SourceID
		if !seen[key] {
			seen[key] = true
			out = append(out, SourceVersion{SourceType: e.SourceType, SourceID: e.SourceID, Revision: e.Revision})
		}
	}
	return out
}

// sourcesChanged reports whether any source the prompt was built from has a
// newer revision than what was stored at resolution time. For document-type
// sources, it compares the stored revision against the current document head.
// When no sources carry revision data, it falls back to the project-level
// ChangedSince signal.
func (d *Documents) sourcesChanged(projectID string, sources []SourceVersion, resolvedAt time.Time) (bool, error) {
	hasRevision := false
	for _, sv := range sources {
		if sv.Revision == 0 {
			continue
		}
		hasRevision = true
		doc, err := d.store.DocumentByID(projectID, sv.SourceID)
		if errors.Is(err, ErrNotFound) {
			continue
		}
		if err != nil {
			return false, err
		}
		if doc.Revision != sv.Revision {
			return true, nil
		}
	}
	if hasRevision {
		return false, nil
	}
	// No sources with revision data — fall back to project-level signal.
	changed, err := d.retriever.ChangedSince(context.TODO(), projectID, resolvedAt)
	if err != nil {
		return false, err
	}
	return changed, nil
}

// parseQueries reads the plan output, trims blanks, and caps the count.
func parseQueries(out json.RawMessage, max int) []string {
	var parsed struct {
		Queries []string `json:"queries"`
	}
	_ = json.Unmarshal(out, &parsed)
	var queries []string
	for _, q := range parsed.Queries {
		if q = strings.TrimSpace(q); q != "" {
			queries = append(queries, q)
		}
		if len(queries) >= max {
			break
		}
	}
	return queries
}

// parseSynthesis reads the synthesis output, normalizing an unknown or missing
// status to "insufficient" (fail closed — never present an ungrounded answer as
// ok).
func parseSynthesis(out json.RawMessage) (status, response string) {
	var parsed struct {
		Status   string `json:"status"`
		Response string `json:"response"`
	}
	_ = json.Unmarshal(out, &parsed)
	switch parsed.Status {
	case PromptStatusOK, PromptStatusInsufficient, PromptStatusContradiction:
		status = parsed.Status
	default:
		status = PromptStatusInsufficient
	}
	return status, parsed.Response
}
