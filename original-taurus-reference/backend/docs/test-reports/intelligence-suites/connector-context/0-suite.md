# connector-context — what the suite does

Source: [dev-test/connector-context/run.sh](../../../../dev-test/connector-context/run.sh)

Connectors as context, all the way through. A folder becomes a connector, the
connector becomes a context, the context is bound to a document variable, a prompt
block is scoped to it — and then a file changes on disk and the answer in the
document updates itself, through every one of those layers, with no API call.

Skips entirely when `etc/config.local.yaml` carries no OpenRouter key.

## Setup

Register `dev@taurus.local`, log in, create a project named "Connector Context
Project", and select it into the session. Window geometry is narrowed to 200
runes with 40 of overlap so the short fixtures still form real windows.

Three invented facts do the work, chosen so an answer can only contain one if the
matching **file** was in scope:

| Fixture | Text |
| --- | --- |
| tower.md | The Meridian tower is 512 meters tall. |
| tower.md, after the edit | The Meridian tower is 777 meters tall. |
| bridge.md | The Solace bridge spans 1400 meters. |

The instruction throughout is:

> How tall is the Meridian tower? Answer only from the sources, with the number
> of meters.

## Beat 1 — one folder, two files, one connector

A temp directory holds both files. A watcher is started over it, a connector named
"Facts" is created, pointed at the watcher, and synced.

**Model calls:** one embedding per window across both files.

## Beat 2 — a context over the connector resolves to file origins

`POST /contexts` including the **bare connector**, then
`GET /contexts/<id>/resolved`.

- Asserts exactly 2 origins
- Asserts both origin ids are connector-file ids — the connector id, a unit
  separator, then the relative path
- Asserts the bare connector id never appears as an origin

This happens before any model call, which is what makes it a clean assertion:
context resolution is structural, and if it were wrong every later result would be
wrong for a reason that had nothing to do with retrieval or the model.

**Model calls:** none. This is the point of the beat.

## Beat 3 — a document wired to the context, with one file excluded

A document "Tower Report" is created with a single prompt block `pb`. Four
change-set operations configure it:

1. `set_template` — variables `src` and `noBridge`
2. `set_context_variable` — binds `src` to the **context**
3. `set_context_variable` — binds `noBridge` directly to bridge.md's composite id
4. `set_block_context` — scopes `pb` to `{include: ["src"], exclude: ["noBridge"]}`

The shape being tested is a leaf exclusion inside a group: `src` pulls in the
whole connector, and `noBridge` subtracts one file out of it by exact id.

**Model calls:** none. Pure document mutation.

## Beat 4 — the answer is grounded in the included file only

`pb` is resolved in `reload` mode.

- Asserts the block text contains `512`
- Asserts it does **not** contain `1400`

Both files are in the same connector, both were synced, and both are in the
lattice. The only thing keeping bridge.md out of the answer is the exclusion.

**Model calls:** the prompt-block pair — a plan call turning the instruction into
retrieval queries, then a synthesis call writing the answer from the retrieved
evidence — plus an embedding per query.

## Beat 5 — the deep cascade

tower.md is overwritten on disk with the 777 fact. No API call of any kind is
made. The suite polls the block for up to 45 seconds waiting for its text to
contain `777`.

- Asserts the block auto-refreshed to 777
- Asserts it still does not contain `1400`

Every layer has to fire in order for this to pass: the detector notices the file
changed, the connector re-syncs, the lattice source is replaced, the context still
resolves to the same file origins, the reference cascade finds the block that
depends on them **through** the context, and the block re-resolves. The suite never
touches the block itself.

**Model calls:** embeddings for the re-sync, then another plan and synthesis pair
for the cascade-triggered resolution.

## The prompts this suite exercises

| Prompt | Where it runs |
| --- | --- |
| Block plan | beats 4 and 5 |
| Block synthesis | the same beats, immediately after each plan |

No agent prompt runs here — a prompt block resolves through the document
capability's own two-step path, not through the Quarterback.

## How to read a failure

- Beat 2 failing is structural and cheap to diagnose: context resolution is
  producing the wrong ids, and nothing downstream can be right.
- Beat 4's `512` assertion failing means retrieval or synthesis; the `1400`
  assertion failing means the exclusion did not subtract.
- Beat 5 timing out means the cascade did not reach the block. Check in order:
  did `syncSeq` advance, did the lattice source change, does the context still
  resolve. The first of those that did not happen is the defect.
