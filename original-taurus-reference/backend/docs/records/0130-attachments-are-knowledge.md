# 0130 — Attachments are Knowledge, and errors say why

Running the full suite on the newly shipped `gpt-5.6-luna` failed two suites.
Neither failure said anything about itself: the chat one answered
`500 {"error":"chat operation failed"}` and nothing more. Making the cause
visible took one small change and immediately exposed a design defect that had
made chat attachments unusable since they shipped.

## BUG-LOG-1 — every internal error was discarded (fixed)

**What it was.** `chatErr` mapped any unrecognized error to a fixed string and
dropped the original. That pattern is repeated across the handlers: 83 sites
return an internal error, and not one of them recorded what it was. A 500 in the
log said that a request failed and nothing whatsoever about why.

**Why it mattered.** The opacity is correct for the *client* — database errors,
provider messages and internal identifiers must not cross the API boundary. It is
wrong for the operator, and because the opaque message was the only record, the
detail was lost rather than withheld.

**The fix.** `endpoint.Response` gained an `Err` field that is never serialized.
`writeResponse` — the single choke point every response passes through — hands it
to `requestlog.AttachError`, and the middleware records it as an `error` field on
the request record. The client's answer is unchanged; the server now says why.

This is what turned the next two sections from guesswork into reading a log line.

## BUG-ATT-1 — a chat attachment could never be cited (fixed)

**What it was.** Attachments were inlined into each turn's prompt as
`agent.ContextItem`s. Context items are not evidence: they carry no locator, so
nothing in them can be cited. `validateCitations` rejects a grounded answer with
no citations. So a question answerable *only* from an attachment produced the
correct answer and then threw it away.

With cause logging in place the failure read:

```text
"error":"agent ask: grounded answer is missing a citation"
```

**Why it mattered.** This was not an edge case — it was the whole feature. Any
question whose answer lived only in an uploaded file failed with a 500, and the
`chat-attachments` suite could not have passed under any model.

**The fix.** An attachment's content is admitted to the knowledge lattice when it
is uploaded, under a new `SourceTypeAttachment`. A turn now retrieves, reads and
cites an uploaded file through exactly the same path as a document or a
connector's file. The special case disappeared rather than being handled.

The source id is composite — a grouping id, a unit separator, then the member's
path — which is the shape connectors already use for their files. Files uploaded
together as a directory share their `DirectoryUploadID`, so one upload of any size
is a single addressable group: `SourcesUnder(uploadID + separator)` lists exactly
its members, which is what makes "remove the whole upload" a prefix query rather
than bookkeeping.

Ordering is chosen so failure leaves the safer state: index before storing, so a
failed index leaves nothing behind rather than an attachment that looks present
and breaks every answer resting on it; withdraw after deleting, so a failure
cannot leave content retrievable that the user believes they deleted.

## BUG-ATT-2 — the citation rules never said to cite (fixed)

**What it was.** With the lattice plumbing working, the suite still failed. The
enriched error said how much evidence the answer had:

```text
"agent ask: grounded answer is missing a citation: 1 evidence span(s) were available"
```

The attachment *was* retrieved and handed to the model, which answered
`Bluefin Cascade` correctly with `citations: []`.

**Why it mattered.** Reading the prompt back, the model was not misbehaving.
Every citation rule constrained which locators are legitimate and which shapes are
forbidden; none said a citation was required. And the user's own instruction —
"answer with just the codename" — reads naturally as licence to omit everything
else.

**The fix.** The Ask prompt now leads with the obligation, states that brevity
instructions constrain the answer text and never the citations, and closes the
escape hatch: the only way to answer without citing is to assert
`insufficientEvidence`, which is a claim about the evidence, not a convenience.

The error message keeps the evidence count permanently. The two failures that
produce this error need opposite fixes — a model ignoring the contract despite
ample evidence, versus retrieval finding nothing — and the bare error could not
tell them apart.

## BUG-PROMPT-1 — a prompt block answered the category, not the question (fixed)

**What it was.** `context-scope` resolves a block whose instruction reads "Name
the power-generation technology described in the sources, using the exact name the
sources use for it." Given `The Borealis turbine generates electricity from steady
wind. Borealis is a wind technology.`, the model answered **"wind technology"**.

**Why it mattered.** Against the synthesis prompt's rules the answer is
impeccable: verbatim from the evidence, nothing invented, no outside knowledge. It
just does not answer the question. Every rule in that prompt governed where facts
may come from; none governed whether the answer addressed what was asked.

**The fix.** An `ANSWER EXACTLY WHAT WAS ASKED` section: obey the instruction's
constraints literally, prefer the specific over the general, do not generalize
what the evidence states precisely. The worked example uses an invented pair
("Kestrel is a database engine") rather than the suite's fixture — a shipped
prompt that names the values its test asserts on is an answer key, not a prompt.

Measured live, the affected checks went from failing every time to passing three
of four. The residue is model variance, and it should be read as reduced, not
eliminated.

## Three new tools: list, read, and what is attached

Search answers one question well — *what text is relevant to this query* — and is
the wrong instrument for two others that come up constantly.

**`knowledge.list`** reports what exists. There is no query for "what do I have
access to"; a model could only guess at phrasings and read failure as absence.

**`knowledge.read`** returns one source exactly, optionally by line range. Search
returns the fragments that scored best, which is precisely wrong for "summarize
the attached notes", where the point is that nothing should be filtered out.

The design decision worth recording: **`knowledge.read` returns its text in the
same `regions` shape `knowledge.search` returns**, and `evidenceFromToolResults`
admits both. A read tool returning bare text would put content in front of the
model that no citation could refer to — recreating BUG-ATT-1 exactly. Framed
correctly a read *is* a retrieval; it differs from search only in choosing its
span by address rather than by similarity. Sharing the region type makes that
structural instead of a convention someone must remember.

`evidenceProducingTools` is now the enforcement point for a rule that was
previously implicit: any tool handing the model text must either produce citable
regions or be understood to produce uncitable context. The live-web tool is
deliberately excluded — its snippets inform an answer but are never Project
evidence.

**`chat.attachments.list`** covers the one thing a lattice listing cannot. An
admitted-source listing reports what was *indexed*; an attachment that could not
be indexed — a PDF, an image, something oversized — is absent from it entirely, so
a model would search, find nothing, and correctly report that no such source
exists. To a user looking at their upload on screen, that reads as the system
losing their file. This tool lists every attachment and marks which are readable,
so the answer becomes "it is attached, but I cannot read it".

The chat id reaches the tool through `agent.Scope`, which is trusted because the
caller resolved it from the request path — the same guarantee that keeps retrieval
inside one Project. The tool is omitted entirely outside a chat, rather than
offered in a form that could only ever return nothing.

## Verification

Full suite on the shipped `etc/config.yaml` (`gpt-5.6-luna`): **40 suites, all
green**, `0.017905 USD`. The failing run that started this record was `0.018797 USD`
with two suites down.

`chat-attachments` and `context-scope` were each re-run individually against real
providers before and after every fix, which is how the two attachment defects were
separated — the first run proved the lattice held the content (a direct
`/dev/knowledge/retrieve` probe returned the attachment at relevance 0.66 with a
valid span), so the remaining failure had to be the prompt.

## Known gap

A chat turn logs no telemetry at all — no tool calls, no retrieval counts, no
per-phase timing. Diagnosing BUG-ATT-2 required temporarily enriching an error
message and writing a throwaway probe suite, because nothing in the running system
would say what the turn had done. This is the WS-6 work, and it is now the main
thing standing between a failing run and an explanation of it.
