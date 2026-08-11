# Live Agent document-authoring test

[`run.sh`](run.sh) is the executable acceptance test for the first real Action
mutation. It uses the gitignored OpenRouter credential, starts an isolated core,
creates an empty document, and asks the backend General Persona to write a
450–650 word story through the real reasoning/tool loop.

The request requires:

- one exact `heading_1` title;
- three exact `heading_2` sections;
- prose in paragraph blocks;
- at least two bold and two italic ranges; and
- a completed Task backed by a successful `document.append_changes` call.

The suite then reads the resolved Document rather than trusting the model's
completion report. `jq` counts the actual block kinds, marks, and paragraph
words. It prints the provider-token total and a conservative estimated cost.

Run from the repository root:

```bash
./dev-test/agents/run.sh
```

If `etc/config.local.yaml` contains no OpenRouter key, it prints a skip and exits
zero. This is intentional: formatting reliability is meaningful only against a
real provider, while deterministic unit tests continue to cover the exact tool
and Document plumbing without spending money.

---

## Chats (BR-AI-CHAT)

Persistent, project-scoped AI conversations over the same engine — they survive
reloads, and posting a turn runs the chat's mode (Ask answers inline; Plan/Action
spawn a durable task the client polls) and records the reply. Drive them from a
selected project (auth + project selection are in the
[backend guide](../../docs/backend-guide.md); `$B=https://127.0.0.1:8080`):

```bash
# Open a chat, optionally bound to the open document.
curl -k -b cookies.txt -X POST $B/agent/chats \
  -H 'Content-Type: application/json' \
  -d '{"mode":"ask","title":"Structure the findings","resourceId":"<DOC_ID>"}'
# 201 {"id":"<CHAT_ID>","mode":"ask","resourceId":"<DOC_ID>", ...}

# Post a turn — Ask answers inline; the agent turn carries the answer.
curl -k -b cookies.txt -X POST $B/agent/chats/<CHAT_ID>/turns \
  -H 'Content-Type: application/json' -d '{"message":"How do the sources explain X?"}'
# 200 {"userTurn":{...},"agentTurn":{"role":"agent","body":"...","taskId":""}}

# List the project's chats (optionally for one resource) and read the history.
curl -k -b cookies.txt "$B/agent/chats?resourceId=<DOC_ID>"
curl -k -b cookies.txt $B/agent/chats/<CHAT_ID>     # {chat, turns:[...]}
```

A live turn-quality assertion (a non-empty, cited answer with cost surfaced) is a
follow-up for `run.sh`; the deterministic unit/transport suites already prove the
chat store, project scoping, and route plumbing without spending money.
