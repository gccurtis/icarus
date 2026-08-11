package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
)

var documentGetInputSchema = json.RawMessage(`{
  "type":"object",
  "properties":{"documentId":{"type":"string","minLength":1}},
  "required":["documentId"],
  "additionalProperties":false
}`)

var documentGetOutputSchema = json.RawMessage(`{
  "type":"object",
  "properties":{
    "id":{"type":"string"},"name":{"type":"string"},
    "blocks":{"type":"array","items":{"type":"object","properties":{
      "id":{"type":"string"},"kind":{"type":"string"},"markdown":{"type":"string"},
      "instruction":{"type":"string"},
      "context":{"type":"object","properties":{
        "include":{"type":"array","items":{"type":"string"}},
        "exclude":{"type":"array","items":{"type":"string"}}
      }}
    },"required":["id","kind","markdown"]}}
  },
  "required":["id","name","blocks"]
}`)

var documentEditInputSchema = json.RawMessage(`{
  "type":"object",
  "properties":{
    "documentId":{"type":"string","minLength":1},
    "ops":{"type":"array","minItems":1,"items":{"oneOf":[
      {"type":"object","properties":{"op":{"const":"append"},"kind":{"type":"string"},"markdown":{"type":"string"}},"required":["op","kind","markdown"],"additionalProperties":false},
      {"type":"object","properties":{"op":{"const":"insert"},"afterBlockId":{"type":"string"},"kind":{"type":"string"},"markdown":{"type":"string"}},"required":["op","kind","markdown"],"additionalProperties":false},
      {"type":"object","properties":{"op":{"const":"replace"},"blockId":{"type":"string","minLength":1},"kind":{"type":"string"},"markdown":{"type":"string"}},"required":["op","blockId","markdown"],"additionalProperties":false},
      {"type":"object","properties":{"op":{"const":"delete"},"blockId":{"type":"string","minLength":1}},"required":["op","blockId"],"additionalProperties":false}
    ]}}
  },
  "required":["documentId","ops"],
  "additionalProperties":false
}`)

var documentEditOutputSchema = json.RawMessage(`{
  "type":"object",
  "properties":{"documentId":{"type":"string"},"changeSetId":{"type":"string"},"seq":{"type":"integer"}},
  "required":["documentId","changeSetId","seq"]
}`)

var documentPromptCreateInputSchema = json.RawMessage(`{
  "type":"object",
  "properties":{
    "documentId":{"type":"string","minLength":1},
    "afterBlockId":{"type":"string"},
    "instruction":{"type":"string","minLength":1},
    "include":{"type":"array","items":{"type":"string"}},
    "exclude":{"type":"array","items":{"type":"string"}}
  },
  "required":["documentId","instruction"],
  "additionalProperties":false
}`)

var documentPromptUpdateInputSchema = json.RawMessage(`{
  "type":"object",
  "properties":{
    "documentId":{"type":"string","minLength":1},
    "blockId":{"type":"string","minLength":1},
    "instruction":{"type":"string"},
    "include":{"type":"array","items":{"type":"string"}},
    "exclude":{"type":"array","items":{"type":"string"}}
  },
  "required":["documentId","blockId"],
  "additionalProperties":false
}`)

var documentPromptWriteOutputSchema = json.RawMessage(`{
  "type":"object",
  "properties":{"documentId":{"type":"string"},"blockId":{"type":"string"},"changeSetId":{"type":"string"},"seq":{"type":"integer"}},
  "required":["documentId","blockId","changeSetId","seq"]
}`)

var documentPromptResolveInputSchema = json.RawMessage(`{
  "type":"object",
  "properties":{
    "documentId":{"type":"string","minLength":1},
    "blockId":{"type":"string","minLength":1},
    "mode":{"type":"string","enum":["reload","refresh"]}
  },
  "required":["documentId","blockId"],
  "additionalProperties":false
}`)

var documentPromptResolveOutputSchema = json.RawMessage(`{
  "type":"object",
  "properties":{"documentId":{"type":"string"},"blockId":{"type":"string"},"status":{"type":"string"}},
  "required":["documentId","blockId","status"]
}`)

// blockView is the markdown projection of one block the model reads and writes.
// For a prompt block, Instruction and Context reveal it *as* a prompt — its
// generation instruction and per-block context selection — so the agent can
// author prompts, not just read their rendered output.
type blockView struct {
	ID          string       `json:"id"`
	Kind        string       `json:"kind"`
	Markdown    string       `json:"markdown"`
	Instruction string       `json:"instruction,omitempty"`
	Context     *contextView `json:"context,omitempty"`
}

// contextView is a prompt block's context selection over the document's context
// variables (Slice E), by variable name.
type contextView struct {
	Include []string `json:"include,omitempty"`
	Exclude []string `json:"exclude,omitempty"`
}

// promptView extracts the prompt-specific fields for a block's view: the
// instruction and the context selection. Non-prompt blocks contribute neither.
func promptView(b document.Block) (instruction string, ctx *contextView) {
	if b.Kind != document.BlockKindPrompt {
		return "", nil
	}
	if pd, ok := b.Data.(document.PromptData); ok {
		instruction = pd.Instruction
	}
	if b.Context != nil {
		ctx = &contextView{Include: b.Context.Include, Exclude: b.Context.Exclude}
	}
	return instruction, ctx
}

// markdownOp is one block-level edit the model expresses in markdown. It never
// carries a character or byte position — the handler resolves rows and computes
// mark offsets from the markdown.
type markdownOp struct {
	Op           string `json:"op"`
	BlockID      string `json:"blockId"`
	AfterBlockID string `json:"afterBlockId"`
	Kind         string `json:"kind"`
	Markdown     string `json:"markdown"`
}

// modelBlockKind maps the model-facing block vocabulary (paragraph,
// heading_1..heading_6, quote, code, callout) onto the stored block kind +
// sub-kind. Paragraph and quote both become body text — a quote is body text,
// not a distinct kind. An unrecognized name is rejected.
func modelBlockKind(kind string) (blockKind, subKind string, ok bool) {
	switch kind {
	case "", "paragraph", "quote", document.BlockKindText, document.SubKindBody:
		return document.BlockKindText, document.SubKindBody, true
	case document.SubKindHeading1, document.SubKindHeading2, document.SubKindHeading3,
		document.SubKindHeading4, document.SubKindHeading5, document.SubKindHeading6:
		return document.BlockKindText, kind, true
	case document.BlockKindCode:
		return document.BlockKindCode, "", true
	case document.BlockKindCallout:
		return document.BlockKindCallout, "", true
	default:
		return "", "", false
	}
}

// modelKindOf projects a stored block back to the model-facing vocabulary: a
// code block is "code", a callout is "callout", a heading sub-kind reports
// itself, and every other text block (body or a custom sub-kind) is "paragraph".
func modelKindOf(b document.Block) string {
	switch b.Kind {
	case document.BlockKindCode:
		return document.BlockKindCode
	case document.BlockKindCallout:
		return document.BlockKindCallout
	case document.BlockKindPrompt:
		return "prompt"
	case document.BlockKindText:
		if strings.HasPrefix(b.SubKind, "heading_") {
			return b.SubKind
		}
		return "paragraph"
	default:
		return "paragraph"
	}
}

func (w *Workflows) documentGetTool(scope Scope, task Task) intelligence.ToolBinding {
	return intelligence.ToolBinding{Definition: intelligence.ToolDefinition{
		Name: "document.get", Version: "v1",
		Description:  "Read a document in this task's Project as an ordered list of blocks, each with its id, kind (paragraph, heading_1..heading_6, code, callout, prompt), and content rendered as markdown (**bold**, _italic_, `code`, ~~strike~~, [text](href)). A prompt block also carries its instruction and its context selection ({include, exclude} of context-variable names). Call this before editing so block ids and content are current. An empty blocks array means the document exists and has no content yet — append to it as normal. A document that does not exist returns an error instead.",
		InputSchema:  documentGetInputSchema,
		OutputSchema: documentGetOutputSchema,
	}, Handler: func(_ context.Context, raw json.RawMessage) (json.RawMessage, error) {
		var input struct {
			DocumentID string `json:"documentId"`
		}
		if err := decodeStructured(raw, &input); err != nil || input.DocumentID == "" {
			return nil, &intelligence.ToolError{Code: "invalid_arguments", Message: "documentId is required"}
		}
		if err := w.authorizeDocument(task.RequesterID, scope.ProjectID, input.DocumentID); err != nil {
			return nil, err
		}
		doc, err := w.documents.Get(scope.ProjectID, input.DocumentID)
		if err != nil {
			return nil, err
		}
		blocks := []blockView{}
		for _, row := range doc.Base.Rows {
			for _, block := range row.Blocks {
				instruction, ctx := promptView(block)
				blocks = append(blocks, blockView{
					ID: block.ID, Kind: modelKindOf(block), Markdown: document.RenderBlockMarkdown(block),
					Instruction: instruction, Context: ctx,
				})
			}
		}
		return json.Marshal(struct {
			ID     string      `json:"id"`
			Name   string      `json:"name"`
			Blocks []blockView `json:"blocks"`
		}{doc.ID, doc.Name, blocks})
	}}
}

func (w *Workflows) documentEditTool(scope Scope, task Task) intelligence.ToolBinding {
	return intelligence.ToolBinding{Definition: intelligence.ToolDefinition{
		Name: "document.edit", Version: "v1",
		Description: "Edit a document in this task's Project with block-level operations whose content is markdown — you never compute a character or byte position. Ops: append {kind, markdown} adds a block at the end; insert {afterBlockId, kind, markdown} adds after a block (empty afterBlockId = at the start); replace {blockId, kind?, markdown} rewrites a block; delete {blockId} removes it. Kinds: paragraph, heading_1..heading_6, code, callout. Inline markdown: **bold**, _italic_, `code`, ~~strike~~, [text](href). Read the document first.",
		InputSchema: documentEditInputSchema, OutputSchema: documentEditOutputSchema,
	}, Handler: func(_ context.Context, raw json.RawMessage) (json.RawMessage, error) {
		var input struct {
			DocumentID string       `json:"documentId"`
			Ops        []markdownOp `json:"ops"`
		}
		if err := decodeStructured(raw, &input); err != nil || input.DocumentID == "" || len(input.Ops) == 0 {
			return nil, &intelligence.ToolError{Code: "invalid_arguments", Message: "documentId and ops are required"}
		}
		if err := w.authorizeDocument(task.RequesterID, scope.ProjectID, input.DocumentID); err != nil {
			return nil, err
		}
		doc, err := w.documents.Get(scope.ProjectID, input.DocumentID)
		if err != nil {
			return nil, err
		}
		ops, err := markdownOpsToChangeOps(doc, input.Ops)
		if err != nil {
			return nil, &intelligence.ToolError{Code: "invalid_arguments", Message: err.Error()}
		}
		submission := document.ChangeSubmission{SubmissionID: newTaskID(), ExpectedRevision: doc.Revision, Operations: ops}
		cs, err := w.documents.SubmitChanges(scope.ProjectID, input.DocumentID, task.RequesterID, submission)
		if err != nil {
			return nil, err
		}
		return json.Marshal(struct {
			DocumentID  string `json:"documentId"`
			ChangeSetID string `json:"changeSetId"`
			Seq         int64  `json:"seq"`
		}{input.DocumentID, cs.ID, cs.Seq})
	}}
}

// promptWriteResult is the common output of the create/update prompt tools.
func promptWriteResult(documentID, blockID, changeSetID string, seq int64) (json.RawMessage, error) {
	return json.Marshal(struct {
		DocumentID  string `json:"documentId"`
		BlockID     string `json:"blockId"`
		ChangeSetID string `json:"changeSetId"`
		Seq         int64  `json:"seq"`
	}{documentID, blockID, changeSetID, seq})
}

// documentPromptCreateTool lets an Action author a new prompt block: it inserts
// a prompt block (as its own row, like the other agent block tools), sets its
// instruction, and — when given — its context selection, all in one submission
// so the block, its prompt, and its context land atomically.
func (w *Workflows) documentPromptCreateTool(scope Scope, task Task) intelligence.ToolBinding {
	return intelligence.ToolBinding{Definition: intelligence.ToolDefinition{
		Name: "document.prompt.create", Version: "v1",
		Description:  "Create a prompt block in a document in this task's Project. A prompt block's text is generated from its instruction, grounded by its context selection (include/exclude of the document's context-variable names). Input: {documentId, afterBlockId? (empty = at the start), instruction, include?, exclude?}. Resolve it afterward with document.prompt.resolve to generate its content.",
		InputSchema:  documentPromptCreateInputSchema,
		OutputSchema: documentPromptWriteOutputSchema,
	}, Handler: func(_ context.Context, raw json.RawMessage) (json.RawMessage, error) {
		var input struct {
			DocumentID   string   `json:"documentId"`
			AfterBlockID string   `json:"afterBlockId"`
			Instruction  string   `json:"instruction"`
			Include      []string `json:"include"`
			Exclude      []string `json:"exclude"`
		}
		if err := decodeStructured(raw, &input); err != nil || input.DocumentID == "" || strings.TrimSpace(input.Instruction) == "" {
			return nil, &intelligence.ToolError{Code: "invalid_arguments", Message: "documentId and instruction are required"}
		}
		if err := w.authorizeDocument(task.RequesterID, scope.ProjectID, input.DocumentID); err != nil {
			return nil, err
		}
		doc, err := w.documents.Get(scope.ProjectID, input.DocumentID)
		if err != nil {
			return nil, err
		}
		afterRow := ""
		if input.AfterBlockID != "" {
			rowID, ok := rowOfBlock(doc, input.AfterBlockID)
			if !ok {
				return nil, &intelligence.ToolError{Code: "invalid_arguments", Message: "unknown afterBlockId"}
			}
			afterRow = rowID
		}
		blockID := newTaskID()
		row := document.Row{ID: newTaskID(), Blocks: []document.Block{{ID: blockID, Kind: document.BlockKindPrompt}}}
		instruction := input.Instruction
		ops := []document.ChangeOp{
			{Op: document.OpInsertRow, AfterRow: afterRow, Row: &row},
			{Op: document.OpSetPrompt, BlockID: blockID, SetText: &instruction},
		}
		if len(input.Include) > 0 || len(input.Exclude) > 0 {
			ops = append(ops, document.ChangeOp{Op: document.OpSetBlockContext, BlockID: blockID,
				BlockContext: &document.BlockContext{Include: input.Include, Exclude: input.Exclude}})
		}
		cs, err := w.documents.SubmitChanges(scope.ProjectID, input.DocumentID, task.RequesterID,
			document.ChangeSubmission{SubmissionID: newTaskID(), ExpectedRevision: doc.Revision, Operations: ops})
		if err != nil {
			return nil, err
		}
		return promptWriteResult(input.DocumentID, blockID, cs.ID, cs.Seq)
	}}
}

// documentPromptUpdateTool sets an existing prompt block's instruction and/or
// context selection. Changing either clears the block's resolved timestamp
// (Slice E), so a later resolve re-generates.
func (w *Workflows) documentPromptUpdateTool(scope Scope, task Task) intelligence.ToolBinding {
	return intelligence.ToolBinding{Definition: intelligence.ToolDefinition{
		Name: "document.prompt.update", Version: "v1",
		Description:  "Update a prompt block in a document in this task's Project: set its instruction and/or its context selection. Input: {documentId, blockId, instruction?, include?, exclude?}; at least one of instruction/include/exclude is required. The target must be a prompt block. Resolve afterward to regenerate.",
		InputSchema:  documentPromptUpdateInputSchema,
		OutputSchema: documentPromptWriteOutputSchema,
	}, Handler: func(_ context.Context, raw json.RawMessage) (json.RawMessage, error) {
		var input struct {
			DocumentID  string   `json:"documentId"`
			BlockID     string   `json:"blockId"`
			Instruction string   `json:"instruction"`
			Include     []string `json:"include"`
			Exclude     []string `json:"exclude"`
		}
		if err := decodeStructured(raw, &input); err != nil || input.DocumentID == "" || input.BlockID == "" {
			return nil, &intelligence.ToolError{Code: "invalid_arguments", Message: "documentId and blockId are required"}
		}
		setInstruction := strings.TrimSpace(input.Instruction) != ""
		setContext := len(input.Include) > 0 || len(input.Exclude) > 0
		if !setInstruction && !setContext {
			return nil, &intelligence.ToolError{Code: "invalid_arguments", Message: "provide an instruction and/or a context selection"}
		}
		if err := w.authorizeDocument(task.RequesterID, scope.ProjectID, input.DocumentID); err != nil {
			return nil, err
		}
		doc, err := w.documents.Get(scope.ProjectID, input.DocumentID)
		if err != nil {
			return nil, err
		}
		if _, kind, ok := rowAndKindOfBlock(doc, input.BlockID); !ok || kind != "prompt" {
			return nil, &intelligence.ToolError{Code: "invalid_arguments", Message: "blockId is not a prompt block"}
		}
		var ops []document.ChangeOp
		if setInstruction {
			instruction := input.Instruction
			ops = append(ops, document.ChangeOp{Op: document.OpSetPrompt, BlockID: input.BlockID, SetText: &instruction})
		}
		if setContext {
			ops = append(ops, document.ChangeOp{Op: document.OpSetBlockContext, BlockID: input.BlockID,
				BlockContext: &document.BlockContext{Include: input.Include, Exclude: input.Exclude}})
		}
		cs, err := w.documents.SubmitChanges(scope.ProjectID, input.DocumentID, task.RequesterID,
			document.ChangeSubmission{SubmissionID: newTaskID(), ExpectedRevision: doc.Revision, Operations: ops})
		if err != nil {
			return nil, err
		}
		return promptWriteResult(input.DocumentID, input.BlockID, cs.ID, cs.Seq)
	}}
}

// documentPromptResolveTool enqueues a resolve for a prompt block so its content
// generates off the request path (like the transport resolve route and the
// connector refresh cascade). Bound only when an enqueuer is configured.
func (w *Workflows) documentPromptResolveTool(scope Scope, task Task) intelligence.ToolBinding {
	return intelligence.ToolBinding{Definition: intelligence.ToolDefinition{
		Name: "document.prompt.resolve", Version: "v1",
		Description:  "Resolve a prompt block so its content is generated, grounded by its context. Input: {documentId, blockId, mode? (reload = regenerate now, the default; refresh = only if a source changed)}. Resolution runs as a background job; the block updates when it finishes.",
		InputSchema:  documentPromptResolveInputSchema,
		OutputSchema: documentPromptResolveOutputSchema,
	}, Handler: func(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
		var input struct {
			DocumentID string `json:"documentId"`
			BlockID    string `json:"blockId"`
			Mode       string `json:"mode"`
		}
		if err := decodeStructured(raw, &input); err != nil || input.DocumentID == "" || input.BlockID == "" {
			return nil, &intelligence.ToolError{Code: "invalid_arguments", Message: "documentId and blockId are required"}
		}
		if err := w.authorizeDocument(task.RequesterID, scope.ProjectID, input.DocumentID); err != nil {
			return nil, err
		}
		mode := input.Mode
		if mode == "" {
			mode = "reload"
		}
		if _, err := w.enqueuer.Enqueue(ctx, document.JobTypeResolve, map[string]string{
			"projectId": scope.ProjectID, "documentId": input.DocumentID, "blockId": input.BlockID, "mode": mode,
		}); err != nil {
			return nil, err
		}
		return json.Marshal(struct {
			DocumentID string `json:"documentId"`
			BlockID    string `json:"blockId"`
			Status     string `json:"status"`
		}{input.DocumentID, input.BlockID, "queued"})
	}}
}

// markdownOpsToChangeOps translates block-level markdown edits into the
// document's low-level change operations. Each agent block is a row of one
// block, so structural edits are row operations and content is parsed to
// atoms+marks server-side — the model never sees an offset.
func markdownOpsToChangeOps(doc document.Document, ops []markdownOp) ([]document.ChangeOp, error) {
	appendAfter := ""
	if n := len(doc.Base.Rows); n > 0 {
		appendAfter = doc.Base.Rows[n-1].ID
	}
	var changes []document.ChangeOp
	for _, op := range ops {
		switch op.Op {
		case "append":
			row, err := newTextRow(op.Kind, op.Markdown)
			if err != nil {
				return nil, err
			}
			changes = append(changes, document.ChangeOp{Op: document.OpInsertRow, AfterRow: appendAfter, Row: &row})
			appendAfter = row.ID
		case "insert":
			after := ""
			if op.AfterBlockID != "" {
				rowID, ok := rowOfBlock(doc, op.AfterBlockID)
				if !ok {
					return nil, fmt.Errorf("insert: unknown afterBlockId %q", op.AfterBlockID)
				}
				after = rowID
			}
			row, err := newTextRow(op.Kind, op.Markdown)
			if err != nil {
				return nil, err
			}
			changes = append(changes, document.ChangeOp{Op: document.OpInsertRow, AfterRow: after, Row: &row})
		case "replace":
			rowID, kind, ok := rowAndKindOfBlock(doc, op.BlockID)
			if !ok {
				return nil, fmt.Errorf("replace: unknown blockId %q", op.BlockID)
			}
			if op.Kind != "" {
				kind = op.Kind
			}
			row, err := newTextRow(kind, op.Markdown)
			if err != nil {
				return nil, err
			}
			changes = append(changes,
				document.ChangeOp{Op: document.OpInsertRow, AfterRow: rowID, Row: &row},
				document.ChangeOp{Op: document.OpDeleteRow, RowID: rowID},
			)
		case "delete":
			rowID, ok := rowOfBlock(doc, op.BlockID)
			if !ok {
				return nil, fmt.Errorf("delete: unknown blockId %q", op.BlockID)
			}
			changes = append(changes, document.ChangeOp{Op: document.OpDeleteRow, RowID: rowID})
		default:
			return nil, fmt.Errorf("unknown op %q", op.Op)
		}
	}
	return changes, nil
}

func newTextRow(kind, markdown string) (document.Row, error) {
	blockKind, subKind, ok := modelBlockKind(kind)
	if !ok {
		return document.Row{}, fmt.Errorf("unsupported block kind %q", kind)
	}
	atoms, marks := document.ParseBlockMarkdown(stripBlockMarker(kind, markdown), newTaskID)
	return document.Row{
		ID:     newTaskID(),
		Blocks: []document.Block{{ID: newTaskID(), Kind: blockKind, SubKind: subKind, Atoms: atoms, Marks: marks}},
	}, nil
}

// stripBlockMarker removes the leading block-level markdown marker when the
// declared kind already expresses it. A model writing markdown naturally writes
// both — kind "heading_1" and text "# Title" — and ParseBlockMarkdown only
// handles inline spans, so without this the marker survives into the atom and
// the heading reads "# Title": rendered once as structure and once as content.
//
// Only the marker matching the declared kind is stripped, so a paragraph about
// "#hashtags" keeps its text. The heading case accepts any depth of marker,
// because the kind, not the number of hashes, decides the level.
// It takes the MODEL-facing kind rather than the stored sub-kind, because the
// two are not interchangeable here: "quote" is stored as body text, so the
// stored sub-kind no longer says a quote marker was meant.
func stripBlockMarker(kind, markdown string) string {
	trimmed := strings.TrimLeft(markdown, " \t")
	switch {
	case strings.HasPrefix(kind, "heading_"):
		hashes := len(trimmed) - len(strings.TrimLeft(trimmed, "#"))
		if hashes == 0 || hashes > 6 {
			return markdown
		}
		rest := trimmed[hashes:]
		// A marker is only a marker when whitespace follows it; "#hashtag" is text.
		if rest == "" || (rest[0] != ' ' && rest[0] != '\t') {
			return markdown
		}
		return strings.TrimLeft(rest, " \t")
	case kind == "quote":
		rest, found := strings.CutPrefix(trimmed, ">")
		if !found {
			return markdown
		}
		return strings.TrimLeft(rest, " \t")
	}
	return markdown
}

func rowOfBlock(doc document.Document, blockID string) (string, bool) {
	for _, row := range doc.Base.Rows {
		for _, block := range row.Blocks {
			if block.ID == blockID {
				return row.ID, true
			}
		}
	}
	return "", false
}

func rowAndKindOfBlock(doc document.Document, blockID string) (rowID, kind string, ok bool) {
	for _, row := range doc.Base.Rows {
		for _, block := range row.Blocks {
			if block.ID == blockID {
				return row.ID, modelKindOf(block), true
			}
		}
	}
	return "", "", false
}
