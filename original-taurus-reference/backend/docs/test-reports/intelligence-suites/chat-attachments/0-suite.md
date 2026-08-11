# chat-attachments — what the suite does

Source: [dev-test/chat-attachments/run.sh](../../../../dev-test/chat-attachments/run.sh)

Uploading files to a chat, and then actually using them. The upload, list and
delete flow is deterministic and runs with or without a provider key; the final
section asks a question that can only be answered from an uploaded file, and that
part needs a real model.

Unlike the other suites here, this one does **not** skip wholesale without a key —
the deterministic half still runs and still asserts. Only the last section is
gated.

## Setup

Register `dev@taurus.local`, log in, create a project named "Attachments Test",
and select it into the session. When a key is present, the job runner is pinned
to one worker, 100ms poll, `max_attempts: 1`.

An ask-mode chat titled "Files" is opened to hold the uploads.

## Step 1 — a single file

`POST /agent/chats/<id>/attachments` with a base64 body of:

> The launch code is orange-swan-42.

- Asserts 201
- Asserts the chat's attachment list has exactly 1 entry

**Model calls:** one embedding — the attachment's content is admitted to the
knowledge lattice on upload, under the `attachment` source type.

## Step 2 — a directory manifest

One request uploads two files with relative paths, `src/a.txt` ("alpha file
body") and `src/b.txt` ("beta file body").

- Asserts 201 with 2 attachments in the response
- Asserts both share a single `directoryUploadId`
- Asserts their relative paths survive as `src/a.txt` and `src/b.txt`

The shared upload id is what makes a directory one addressable thing. Each file
becomes its own lattice source keyed by `directoryUploadId` + a unit separator +
its relative path, so listing or withdrawing the whole upload is a prefix query
rather than bookkeeping over individual files.

**Model calls:** one embedding per file.

## Step 3 — the list reflects everything

`GET /agent/chats/<id>/attachments`.

- Asserts 3 attachments total

## Step 4 — delete removes exactly one

`DELETE` the single-file attachment from step 1.

- Asserts 204
- Asserts 2 attachments remain

The directory pair must survive. A delete that took the whole upload with it, or
that took nothing, both show up here.

## Step 5 — an Ask turn answers from an uploaded file

Gated on the provider key. A third file is attached:

> The internal project codename is Bluefin Cascade.

Then a turn is posted:

> What is the internal project codename mentioned in the attached files? Answer
> with just the codename.

- Asserts 200
- Asserts the answer contains "Bluefin" (case-insensitive)

**Model calls:** an embedding for the new attachment, a triage call, an embedding
per retrieval query, then one `reason.tools` call under the Ask contract.

## The three defects this step has caught

Step 5 is the reason attachments work at all, and it has failed for three
different reasons — each of them ours, none of them the model's.

**Attachments were not evidence.** They used to be inlined into the turn's prompt
as context items. A context item carries no locator, so nothing in it can be
cited — and a grounded answer with no citations is rejected. The model answered
"Bluefin Cascade" correctly and the platform threw the answer away with a 500. An
attachment is now admitted to the lattice like any other source, so it is
retrieved, read and cited through the same path as a document or a connector
file.

**The prompt never said to cite.** With the lattice plumbing fixed, the turn
still failed. Every citation rule constrained which locators were legitimate;
none said a citation was required. And "answer with just the codename" reads
naturally as licence to omit everything else. The Ask prompt now leads with the
obligation and states that brevity instructions constrain the answer text, never
the citations.

**The source id could not survive being cited.** `gpt-5.1` failed this step while
three other models passed it. It had cited the attachment correctly — right
source type, right id, right span — and been refused. An attachment's source id
joined its group id to its filename with a raw `0x1F` byte, and the model gave
back U+FFFD where that byte had been, because that is what a decoder produces for
a byte it cannot represent. Every other byte matched.

A source id is handed to a model as evidence and has to come back byte-exact, so
nothing in one may be unprintable — and, since a filename can hold anything a
user can type, nothing in one may be a name either. Both halves are ids now,
joined by a slash, with the filename kept beside it as the source's label.
Recorded in [0133](../../../records/0133-source-ids-are-ids.md).

The pattern across all three is worth naming: every time this step failed, the
first reading was "the model got it wrong", and every time the model was doing
what it had been told with what it had been given.

## The prompts this suite exercises

| Prompt | Where it runs |
| --- | --- |
| Retrieval plan | step 5, as the triage decision |
| Ask | step 5, as the turn's system prompt |

Steps 1 through 4 use no prompt at all.

## How to read a failure

- Steps 1 to 4 failing is storage or handler behaviour, with no model involved —
  these run even without a key.
- Step 5 failing with a 500 is the citation contract; the request log names the
  cause, and the error carries how many evidence spans were available. Zero spans
  means retrieval found nothing; several spans means the model had evidence and
  did not cite it. Those need opposite fixes.
- Step 5 answering without "Bluefin" means the attachment was not in scope.
