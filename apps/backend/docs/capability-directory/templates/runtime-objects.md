# {{Capability Name}} Runtime Objects

Lives at `runtime-objects/runtime-objects.md`.

Each object has one instance per backend runtime. Each gets a directory holding
exactly its document, `definition.ts` — the public interface plus the class
implementing it — and `constructor.ts`, the only place that performs startup
work.

## Objects

| Object | Directory | Exported | Responsibility |
| ------ | --------- | -------- | -------------- |
| `{{RuntimeObjectName}}` | [`{{object-name}}/`]({{object-name}}/{{object-name}}.md) | {{yes / internal}} | {{What it owns}} |

An **exported** object is re-exported from `index.ts`; `main.ts` and other
capabilities hold it, and every method on its interface has a `runtime-api`
directory. An **internal** object is constructed for injection inside this
capability and never leaves it; its methods are implementation detail.

## Relationships

{{How the objects relate — which is injected into which, and what each is
authoritative for. Omit this section when the capability has one object.}}

```text
{{ExportedObject}}
├── holds {{InternalObject}}
└── holds {{injected platform dependency}}
```

## Construction Order

{{The order main.ts must construct these in, and what each construction
requires to already exist.}}
