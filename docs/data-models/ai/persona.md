# Persona

A reusable configuration for how an agent behaves — its instructions, its model,
and what it is allowed to touch.

```ts
interface Persona {
  projectId?: Id<"projects">;  // absent = available to every project
  name: string;
  description?: string;
  instructions: string;
  modelBinding?: string;       // named binding from intelligence
  tools: string[];             // tool names this persona may call
  avatar?: { emoji?: string; fileId?: Id<"externalFiles"> };
  createdBy: Actor;
  updatedAt: number;
}
```

## Instructions are plain text

Not content blocks. Instructions go to a model as a system prompt, so text is
the destination format — storing them as blocks would mean serializing back to
text on every use, and the serialization would be the thing that actually
determined behaviour while the blocks pretended to.

There is also nothing to gain. Bold text in a system prompt is either
meaningless or is markdown the model reads as markdown, and a person writing
instructions can type markdown directly.

## Tools are names

A flat list of tool names the persona may call. Not grants with scopes,
conditions, and expiry — a permission model elaborate enough to be interesting
is elaborate enough to be got wrong, and the enforcement point is the tool
implementation regardless.

The absence of a tool from the list is the whole restriction. An empty list is a
persona that can only read and write.

## Model binding is indirect

`modelBinding` names a binding defined in [intelligence](intelligence.md) rather
than naming a model directly. Model identifiers change often, and a persona
should not have to be edited because a provider deprecated a version.

It is optional; a persona without one uses the project's default binding for
agent work.

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

[agent task](agent-task.md) · [intelligence](intelligence.md)
