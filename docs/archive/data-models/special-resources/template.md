# Template

A starting point for a resource. A template holds a body in the shape of the
thing it makes, with named slots for the parts that get filled in.

```ts
interface Template {
  projectId?: Id<"projects">;  // absent = available to every project
  name: string;
  description?: string;
  tags: string[];               // flat labels; an empty list means untagged
  target: "document" | "slides" | "spreadsheet";
  body: TemplateBody;
  slots: TemplateSlot[];
  createdBy: Actor;
  revision: number;
  updatedAt: number;
}

type TemplateBody =
  | ({ target: "document" } & DocumentBody)
  | ({ target: "slides" } & SlideDeckBody & { aspectRatio: "16:9" | "4:3" })
  | ({ target: "spreadsheet" } & SpreadsheetBody);

interface TemplateSlot {
  key: string;                 // "client_name"
  label: string;               // "Client name"
  kind: "text" | "image" | "data" | "derived";
  required?: boolean;
  default?: string;
  prompt?: string;             // for kind: "derived"
}
```

## The body is a real resource body

A document template's body is `ContentBlock[]` — the same type a
[document](../general-resources/document.md) holds. A slides template holds real
slides.

This means creating from a template is a copy, and it means a template can be
authored in the ordinary editor rather than in a separate template-authoring
mode. A generic template representation that every resource type had to be
projected into would need a converter per type, and would drift from what the
resources actually store.

`target` appears twice — on the template and as the union discriminant on the
body — so a reader can filter templates without loading bodies, and so the body
cannot disagree with the label.

## Slots

A slot is a named hole. In the body it appears as ordinary content carrying the
slot's key, so a template renders sensibly even before anything is filled in —
placeholder text reads as placeholder text, and a template with no values
supplied is still a usable starting document.

`kind` says what fills the hole. `text` and `image` are supplied by a person.
`data` is bound to a source. `derived` carries a `prompt` and becomes a [prompt
block](../content/content-block.md#prompt-blocks) in the created resource,
generated on first open — which is how a template can say "summarize the
project's findings here" without knowing what they are.

## Instantiation is a copy

A resource created from a template is complete and independent from that moment.
It records `templateId` as provenance and nothing more.

Editing a template does not change resources already created from it. The
alternative — resources holding a diff against a live template — means someone's
edit can be silently undone by a change to a template they have never seen, and
means no resource can be read without also reading its template.

## Scope

A template with no `projectId` is available everywhere; with one, it belongs to
that project. There is no sharing mechanism between the two — a project template
that should be global is copied, which keeps "who can edit this" answerable from
the document alone.

## Related

[document](../general-resources/document.md) ·
[slides](../general-resources/slides.md) ·
[spreadsheet](../general-resources/spreadsheet.md) ·
[content block](../content/content-block.md)
