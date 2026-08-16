# Persona

A reusable configuration for how an agent behaves — its instructions, its model,
and what it is allowed to touch.

```ts
interface Persona {
  projectId?: Id<"projects">;  // absent = available to every project
  name: string;
  description?: string;
  definition: PersonaDefinition;
  scope?: SetExpression;       // retrievable material it brings with it
  modelBinding?: string;       // named binding, resolved from configuration
  tools: string[];             // tool names this persona may call
  avatar?: { emoji?: string; fileId?: Id<"externalFiles"> };
  createdBy: Actor;
  revision: number;
  updatedAt: number;
}

interface PersonaDefinition {
  focus: string;               // what to concentrate on, and what to leave alone
  background: string;          // standing facts to assume without being told
  approach: string;            // how to work: method, rigour, standards, boundaries
  outputPreferences: string;   // what the result looks like: shape, length, tone
  verification: string;        // what to check before calling it finished
}
```

## Five sections, five questions

The definition is not one instructions box. It is five, each answering exactly
one question and no two answering the same one:

| Section | Question it answers |
| --- | --- |
| `focus` | What is this about? |
| `background` | What do you already know? |
| `approach` | How should you work? |
| `outputPreferences` | What comes out? |
| `verification` | When are you done? |

The names are meant to be typed into a form by a person, not assembled by a
program. `approach` rather than "guidance", which is vague about guidance
*toward what*. `background` split out from behaviour, because standing facts and
working method are different things and authors conflate them the moment they are
given one box.

An empty section is omitted entirely, heading included. A definition must carry
something — at least one non-empty section, or a `scope` — since five empty
sections with no material means nothing and renders to nothing.

## Background is not scope

The distinction is easy to lose and worth stating wherever it is authored:

- **`background`** is short inline knowledge that is *always in the prompt*. It
  costs tokens on every call and is never retrieved. Durable facts: who we are,
  what the domain is, what conventions hold.
- **`scope`** is a [resource set](../special-resources/resource-set.md) of
  retrievable material. It is never rendered into the prompt. It widens what the
  work can find, and costs nothing until something retrieves it.

A persona that pastes a document into `background` is misusing it. A persona that
puts a one-line standing fact behind a retrieval hop is also misusing it.

A definition with five empty sections *and* a scope is legal — a pure scope
persona renders to an empty string, and "work against this material" is a real
persona with no behavioural text. Consumers must tolerate an empty rendered
prompt and omit the message rather than sending a blank system turn.

## Sections are plain text

Not content blocks. Each section goes to a model as part of a system prompt, so
text is the destination format — blocks would mean serializing back to text on
every use, and the serialization would be what actually determined behaviour
while the blocks pretended to.

There is also nothing to gain. Bold text in a system prompt is either meaningless
or is markdown the model reads as markdown, and an author can type markdown
directly.

## Tools are names

A flat list of tool names the persona may call. Not grants with scopes,
conditions, and expiry — a permission model elaborate enough to be interesting
is elaborate enough to be got wrong, and the enforcement point is the tool
implementation regardless.

The absence of a tool from the list is the whole restriction. An empty list is a
persona that can only read and write.

## Model binding is indirect

`modelBinding` names a binding defined in
[configuration](../../processes/intelligence.md) — `"agent"`, `"fast"` — rather than naming a
model directly. Model identifiers change often, and a persona should not have to
be edited because a provider deprecated a version.

It is optional; a persona without one uses the deployment default for agent work.

## Snapshots

A [task](agent-task.md) references a persona by id and does not copy it. When a
persona is edited, past tasks show the current one.

This is the opposite of the choice made for
[templates](../special-resources/template.md#instantiation-is-a-copy), and the
difference is what the reference means. A template is a starting point that a
resource is meant to grow away from. A persona is an identity — someone looking
at last week's task wants to know who did it, and a frozen copy of an outdated
configuration answers a question nobody asked.

## Scope

No `projectId` means available everywhere. Personas are configuration rather
than content, and a good one is worth reusing.

## Related

[agent task](agent-task.md) ·
[intelligence](../../processes/intelligence.md)
