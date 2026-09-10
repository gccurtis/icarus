export const TEMPLATES_GATES = [
  {
    path: ["capabilities", "templates", "api", "shared", "prompts.ts"],
    name: "placed-prompt-owner-transfer",
    required: /const \{ prompt: _prompt, scope: _scope, \.\.\.linked \} = next;[\s\S]*?return \{ \.\.\.linked, derivedOutputId: id \};/,
    message: "template placement can retain inline prompt or scope ownership after linking a Derived Output"
  },
  {
    path: ["capabilities", "templates", "api", "shared", "body-validation", "portable.ts"],
    name: "portable-prompt-has-no-output-link",
    required: /if \(step\.type === "prompt" && "derivedOutputId" in step\) return "derivedOutputId";/,
    message: "template admission permits a prompt to retain a project-bound Derived Output link"
  }
];
