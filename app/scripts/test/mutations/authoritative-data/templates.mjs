export const TEMPLATES_MUTATIONS = [
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a current discriminator cannot become an absence-based compatibility branch",
    names: "representation/data/types/templates/template.ts",
    changes: [{
      path: "src/lib/representation/data/types/templates/template.ts",
      edit: (before) => before.replace(
        "kind: TemplateSlotKind;",
        "kind?: TemplateSlotKind;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a private template scope cannot conditionally invent a revision",
    names: "templates/api/shared/scopes.ts",
    changes: [{
      path: "src/lib/capabilities/templates/api/shared/scopes.ts",
      edit: (before) => before.replace(
        "const revision = Number(row.revision);",
        'const revision = typeof row.revision === "number" ? row.revision : 1;'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a detached template prompt cannot fall back to display text",
    names: "templates/api/shared/prompts.ts",
    changes: [{
      path: "src/lib/capabilities/templates/api/shared/prompts.ts",
      edit: (before) => before.replace(
        "const asked = value.prompt.trim();",
        "const asked = (value.prompt ?? value.display).trim();"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "template placement cannot leave prompt and scope ownership on a linked block",
    names: "templates/api/shared/prompts.ts",
    changes: [{
      path: "src/lib/capabilities/templates/api/shared/prompts.ts",
      edit: (before) => before.replace(
        "const { prompt: _prompt, scope: _scope, ...linked } = next;",
        "const linked = next;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "template admission cannot accept a project-bound Derived Output link",
    names: "templates/api/shared/body-validation/portable.ts",
    changes: [{
      path: "src/lib/capabilities/templates/api/shared/body-validation/portable.ts",
      edit: (before) => before.replace(
        'if (step.type === "prompt" && "derivedOutputId" in step) return "derivedOutputId";',
        "if (false) return \"derivedOutputId\";"
      )
    }]
  }
];
