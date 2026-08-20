# Automations — one rule

| Workspace | What it is for | Regions |
| --- | --- | --- |
| Entered from Open | One rule, read as a sentence and edited as two halves | Screen header · The sentence · When · Do this · Last fired |

A rule is a sentence with two blanks in it. The screen states the sentence, then
gives one column per blank.

## Layout

| 1fr | 1fr |
| --- | --- |
| screen header | screen header |
| the sentence | the sentence |
| when | do this |
| when | do this |
| when | last fired |

## Screen header

**Shows** — **Back to list**, "Nightly filing digest", the on/off switch and its
label, `Saved`, **Run now**

The switch is in the header rather than in a panel, because it is the one control
that changes whether the rule exists in practice.

**Needs** — the `Automation` record and a manual dispatch that uses the saved
configuration.

## The sentence

The rule in words, as the page heading, with the two halves picked out in the
roles they belong to.

**Shows** — "When *the clock reaches 02:00 in New York*, *ask Filing Editor to do
something*." over "One trigger, one action. Two things to do means two
Automations."

Reading the rule should not require reading the two columns. The colouring maps
the sentence onto the columns underneath it.

**Needs** — one renderer from trigger plus action to a sentence — the same one the
list and the actor lens use.

## When

The trigger half: five choices as cards, the chosen one marked, then a detail box
for whichever is chosen.

**Shows** — *On a schedule* — A time and a timezone (chosen); *Something changes*;
*A connector syncs*; *A finding is accepted*; *Only when I say*. Then a box with
`At · 02:00 daily`, `Timezone · America/New_York`, `Next · Tomorrow, 02:00` and
"Next run comes from the scheduler, not from the browser."

Cards rather than a dropdown, because the five options are the vocabulary of the
whole feature and hiding them makes the feature look smaller than it is.

**Needs** — the trigger union, and a next-fire time from the scheduler.

## Do this

The action half, same shape: two choices, then a detail box.

**Shows** — *Ask an agent to do something* — A Persona and what to ask it
(chosen); *Re-run a generated block* — One prompt block in a document, deck or
spreadsheet. Then a box with `Agent · Filing Editor` and the instruction, verbatim.

**Needs** — the action union, a `Persona` reference, and the prompt string.

**Open** — the second option needs to name where a block lives, which is a reverse
query `DerivedOutput` cannot answer.

## Last fired

Under the action column, because the action is what fired.

**Shows** — `Last fired · Today, 02:00`, `Result · Couldn't start`, `Why · Filing
Editor may not use web.search`, `Fired about · 184 times`

**Needs** — last-fire time, outcome, reason and an approximate total.

**Open** — there is no run table, so this is the whole history. Nothing in this
region may imply a series, and the count stays labelled as approximate.
