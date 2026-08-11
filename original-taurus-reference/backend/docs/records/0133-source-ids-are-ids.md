# 0133 — Source ids are ids

A composite source id used to be a group id, an ASCII unit separator, and the
member's **name**: `<connectorID>\x1f<relpath>`, `<uploadID>\x1f<filename>`. Both
halves of that were wrong, and one of them was breaking a shipped feature.

Now it is a group id, a slash, and the member's **id** — and the name lives
beside it as the source's label.

## What broke

`gpt-5.1` failed the `chat-attachments` suite. The turn 500'd and the answer was
discarded:

```text
agent ask: answer cited evidence that was not retrieved:
attachment / 75fb…c4967␟codename.txt / 0 / 49
```

The first reading was that the model had adjusted a locator, which the Ask prompt
forbids. It had not. Probing the same fixture showed retrieval returning that
attachment at exactly `start=0 end=49` — the span the model cited. Hex-dumping
both sides found a one-byte difference:

```text
cited: …64346537 ef bf bd 636f64656e616d652e747874
avail: …64346537       1f 636f64656e616d652e747874
```

`EF BF BD` is U+FFFD, the Unicode replacement character. The model was handed a
source id containing a raw `0x1F`, and gave back the only thing it could: the
replacement character that stands in for a byte that cannot be represented.
Everything else matched. It cited correctly and was refused.

Reproduced 4/4 runs before the change, 4/4 clean after.

## Two mistakes, one visible

**The separator.** `0x1F` was chosen because a control byte cannot occur in a
filename, which makes a prefix query for "every member of this group"
unambiguous. That reasoning is sound for storage and wrong at the model boundary.
A source id is handed to a model as evidence and has to come back byte-exact in a
citation; a byte that cannot appear in text is a byte that will not survive
tokenization. The penalty was a 500 and a discarded correct answer.

**The packing.** The deeper mistake, and the one that made the first one
necessary: two fields were packed into one string to avoid adding a column. Once
a *name* is inside an identifier, the separator has to be exotic, because names
can contain anything a user can type — spaces, quotes, brackets, path separators.
Take the name out and the separator problem disappears with it. Both halves are
hex ids now, so a plain `/` separates them unambiguously.

## The registry is the lattice

An id is only useful if something can map it back to the name a person knows. The
mapping lives on the source itself: `knowledge.Source` gained a `Label`, and
`SourcesUnder` returns it with each origin.

That placement is the point. `knowledge_sources` already had to store both halves
— it holds the source, and it holds what the source is — so a separate registry
table would be a second copy of the same fact, kept in step by hand. Nothing
tracks the mapping; the thing being mapped carries it.

**Attachments needed no new storage at all.** Every attachment row already has an
id and the name it was uploaded under, so `SourceID()` became
`group + "/" + attachment.ID` and `SourceLabel()` returns the path or filename.
The registry was already there.

**Connectors needed the label to be readable back.** A connector knows its files
only by path — ids are minted at sync time, not derived from anything the watcher
reports — so `applySync` now reads the lattice *before* it writes, matches each
snapshot file against the stored labels, and reuses the id already minted for
that path.

The read-before-write order is the correctness argument, not a style choice.
Minting a fresh id for an unchanged file would break two things at once: the
smart-update path compares a source against the previous snapshot of the *same*
source, so a new id re-embeds every window and turns a free re-sync into a full
one; and anything already pointing at the old id — a resolved prompt block, a
context scoped to one file — would address a source that no longer exists. There
is a test for exactly this: a file present across two syncs must keep its id.

## What a listing shows

Composing ids out of ids costs readability, and `knowledge.list` is where that
would have hurt: a model choosing what to read would be picking from a column of
hex. Each entry now carries a `name` beside its `sourceId`, and the tool
description says to match on the name and pass the id.

## Verification

The failing probe, four runs before and four after: `500` every time, then `200`
with the right answer every time.

Full intelligence group, both models, all 15 suites green:

| Config | Result | Cost (USD) |
| --- | --- | --- |
| shipped (`gpt-4.1-mini`) | 15/15 | 0.016306 |
| `gpt-5.1` | 15/15 | 0.018866 |

`gpt-5.1` passing `chat-attachments` is the specific confirmation — that is the
suite and the model that exposed the defect.

`go build ./...`, `go test ./...`, `check-companions.sh` and `check-format.sh`
all clean. Two new unit tests guard the properties directly: a source id holds
nothing unprintable and embeds no name, and a connector file keeps its id across
a re-sync.

## Who translates, and where

A file now has two names: the key its provider knows it by, and the lattice id
that addresses it. Something has to map between them, and the choice of *where*
is the part worth being deliberate about.

**The connector translates.** `Connectors.Files` pairs each provider key with the
lattice id minted for it, behind `GET /connectors/:connectorID/files`. The
connector minted those ids, and it is the only thing that knows what its provider
calls a member — a path relative to the root for `local-folder`, an item id for a
cloud subkind that is not a path at all.

**Knowledge stores the pair and nothing more.** It has to: a scope exclusion
resolves against lattice sources, so the mapping cannot live only inside the
connector. But it holds the key as an opaque label. Teaching knowledge that one
subkind's key is a path and another's is an item id would push connector
knowledge into a capability that has no business with it.

An earlier attempt put this listing on `/dev/knowledge/sources`. That was the
wrong home for exactly this reason, and it is gone. Internal callers never needed
it anyway — the connector and contexts capabilities call `SourcesUnder` directly,
in-process; nothing sends HTTP to itself. The endpoint exists for external
clients, and "use this connector but not this one file" is a real client surface
rather than dev tooling.

## Path, not name

The registry keys on the provider's **full key**. For a local folder that is the
relative path, and the distinction is load-bearing: `src/a.txt` and `docs/a.txt`
share a base name and are two different files. Keying on a name would merge them
into one source, silently — one file's content serving under the other's id, and
excluding one excluding both.

Same key means same file. Same name means nothing. Two tests hold the line from
both sides: the same path in two connectors stays two sources, and the same base
name at two paths in one connector stays two sources — both keeping their ids
across a re-sync.
