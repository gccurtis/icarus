# attachment_lattice.go

`attachment_lattice.go` is the composition seam that turns a chat attachment into
ordinary Knowledge, and that reports back which attachments made it.

## The problem it solves

An attachment's bytes live in the file capability. Its content belongs in the
knowledge lattice. The chat capability, which owns the attachment record, imports
neither — and should not, because a chat is a conversation, not a storage or
retrieval concern.

That is the same shape `connectorLatticeWriter` already solves for connectors, and
this file is deliberately its twin. The chat capability declares a narrow
`AttachmentIndexer` port; this adapter satisfies it by resolving the file id to
bytes and feeding the lattice.

## Why attachments are indexed at all

Before this, a chat's attachments were inlined into the turn's prompt as
`ContextItem`s. That put the content in front of the model, which looked
sufficient and was not: context items are not evidence, so nothing in them could
be cited. Ask rejects a grounded answer that carries no citation, so a question
answerable *only* from an attachment failed every time — the model gave the right
answer and the request returned a 500.

Admitting the content to Knowledge instead means an attachment is retrieved,
read, and cited through exactly the same paths as a document or a connector's
file. The special case disappears rather than being handled.

## Grouping, and why the source id is composite

An attachment's knowledge identity is `chat.Attachment.SourceID()` — a grouping id
joined to the member's path by a unit separator. Files uploaded together as a
directory share their `DirectoryUploadID`, so one upload of two hundred files is
one addressable group: `SourcesUnder(uploadID + separator)` lists exactly its
members and nothing else, which is what makes "remove the whole upload" a single
prefix query rather than a bookkeeping exercise.

This is the connector pattern applied unchanged — a connector's files are keyed
`connectorID<sep>path` — which is the point. A directory upload and a synced
folder are the same shape of thing, and giving them the same shape of identity
means the enumeration and pruning logic already written for one works for the
other.

## Code breakdown

### The size bound

```go
const maxAttachmentIndexBytes = 1 << 20 // 1 MiB
```

Not a storage limit — the bytes are already stored. It is the size beyond which a
single upload would dominate a Project's retrievable content rather than
contribute to it, crowding out the documents retrieval is meant to surface.

### `IndexAttachment`

```go
	if len(content) == 0 || len(content) > maxAttachmentIndexBytes || !utf8.Valid(content) {
		return nil
	}
```

The distinction this line draws is the important one. Content that *cannot* be
indexed as text is skipped and reported as success: a PDF or an image is a
perfectly legitimate attachment that this lattice has no way to index, and
refusing the upload over it would be wrong. Failing to index text that *should*
have been indexed is a real failure and returns an error, which the chat
capability turns into a failed upload.

The consequence of the skip path — an attachment that exists but is unreachable —
is what `chatAttachmentLister` below exists to make visible.

```go
	_, err = w.know.Add(context.Background(), projectID, knowledge.SourceTypeAttachment, sourceID,
		string(content), []knowledge.BlockSpan{{Start: 0, End: len(content)}}, 0)
```

One block spanning the whole file, exactly as a connector file is added: an
uploaded file has no internal row/block structure to map, so its one span is the
file itself. The revision is `0` because an attachment's content is immutable —
re-uploading produces a new file and a new attachment rather than a new revision
of this one.

### `RemoveAttachment`

Withdrawing a source that was never admitted is not an error: `Knowledge.Remove`
reports whether the source existed rather than failing when it did not. This
matters because the skip path above means a removal will routinely target content
that was never indexed, and treating that as a failure would make deleting a PDF
attachment error out.

### `chatAttachmentLister`

```go
		if l.know != nil {
			if origins, err := l.know.SourcesUnder(projectID, knowledge.SourceTypeAttachment, a.SourceID()); err == nil && len(origins) > 0 {
				ref.SourceID = a.SourceID()
			}
		}
```

Readability is decided by **asking the lattice whether it holds the source**,
not by re-applying the UTF-8 and size rules from `IndexAttachment`. Those rules
would then exist in two places and could disagree after any change to either —
and the answer the model needs is not "would this have been indexable" but "is it
there now".

```go
		if a.ProjectID != projectID {
			continue
		}
```

The chat store is queried by chat id; this filter is the belt to that braces. The
caller has already proven the chat belongs to the Project before the tool is
bound, so this should never drop anything — which is exactly why it is cheap to
keep.

### The label crosses the seam with the content

`IndexAttachment` takes the attachment's human name alongside its source id and
passes it to `knowledge.Add` as the source's label.

The chat capability composes both halves — an id that is safe to address and a
name that is safe to show — and this adapter is what carries the second one into
the lattice. Without it the source would be admitted under an id that says
nothing about which file it is, and a listing could not tell one member of an
upload from another.
