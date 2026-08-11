# attachment_tools.go

`attachment_tools.go` binds `chat.attachments.list`: the tool that tells a turn
which files its conversation has, and whether each one can actually be read.

## Why `knowledge.list` did not already cover this

Once chat attachments are admitted to the knowledge lattice, `knowledge.list`
filtered to `sourceType: "attachment"` reports them, and for most purposes that
is the right instrument — it is the same listing that covers documents and
connector files, with no special case.

It has one blind spot, and it is the one that matters to a person. A listing of
admitted sources reports what was **indexed**. An attachment whose content could
not be indexed — a PDF, an image, a file past the size bound — is absent from it
entirely. A model asked about "the file I attached" would then search, find
nothing, and correctly report that no such source exists.

To the user, who can see their upload in the interface, that reads as the system
losing their file. The truthful answer is "your spreadsheet is attached, but I
cannot read its contents", and nothing in the admitted-source listing can express
it, because the fact to report is precisely the one the lattice does not hold.

So this port lists **every** attachment and marks which are readable. The failure
mode it removes is not a missing capability but a confidently wrong denial.

## Scoping

The tool is bound to one conversation, and both identities are closed over:

```go
func attachmentListTool(attachments Attachments, projectID, chatID string) intelligence.ToolBinding
```

Neither is a tool argument, so a model cannot enumerate another conversation's
uploads by naming it. The chat id reaches this point through `agent.Scope`, which
is documented as trusted precisely because the caller resolved it from the request
path rather than from model output — the same guarantee that keeps retrieval
inside one Project.

Ask binds the tool only when both an `Attachments` implementation and a chat id
are present. A turn outside a chat has no conversation to enumerate, so the tool
is omitted rather than offered in a form that could only return nothing: an
offered tool that always returns an empty list teaches the model that there are
never any attachments.

## Code breakdown

### The port

```go
type Attachments interface {
	ChatAttachments(projectID, chatID string) ([]AttachmentRef, error)
}
```

A narrow port, kept here rather than importing the chat capability, so the agent
capability continues to depend on neither chat nor knowledge. The composition
layer supplies the implementation that joins the two.

### `AttachmentRef`

```go
type AttachmentRef struct {
	Name         string
	RelativePath string
	SourceID     string
}
```

`SourceID` carries the readability answer by being empty or not. Modeling it this
way rather than as a separate boolean means the two facts cannot disagree: there
is no state where an attachment claims to be readable but offers no locator to
read it with.

`RelativePath` is set only for a file uploaded as part of a directory, and it is
preferred over `Name` when present — it is what the user sees, and it is what
distinguishes `src/a.txt` from `test/a.txt`.

### The output shape

```go
type listedAttachment struct {
	Name       string `json:"name"`
	SourceType string `json:"sourceType,omitempty"`
	SourceID   string `json:"sourceId,omitempty"`
	Readable   bool   `json:"readable"`
}
```

`SourceType` and `SourceID` are exactly what `knowledge.read` needs, so the model
can go from "which files are attached" to reading one without constructing an
identifier itself. They are omitted for an unreadable attachment, so there is no
locator to be tempted into passing to a read that would fail.

`Readable` is stated explicitly even though it is derivable from whether the
locator is present. Requiring the model to infer a fact from a missing JSON field
is exactly the kind of inference models get wrong, and the cost of saying it
outright is one boolean.

### The handler

```go
		refs, err := attachments.ChatAttachments(projectID, chatID)
		if err != nil {
			return nil, err
		}
```

A store failure is returned as an error rather than reported as an empty list.
The distinction matters: an empty list is a claim that the conversation has no
attachments, and making that claim when the truth is unknown is how a model ends
up telling a user their upload is not there.

### `attachmentSourceType`

```go
const attachmentSourceType = "attachment"
```

Restated rather than imported from the knowledge capability, for the same reason
the port exists — this package does not depend on knowledge. Keeping the literal
here also puts it next to the field it fills, which is the string the model must
hand back to `knowledge.read`.
