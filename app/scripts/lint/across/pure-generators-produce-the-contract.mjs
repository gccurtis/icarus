import { join } from "node:path";

import { check } from "../shared/check.mjs";

const generation = (tree, ...parts) => join(tree.base, "scripts", "generation", ...parts);

const contracts = [
  {
    file: ["capabilities", "new-capability.mjs"],
    required: [
      ["types/context.ts", /types["'],\s*["']context\.ts/],
      ["types/ports.ts", /types["'],\s*["']ports\.ts/],
      ["runtime adapter", /runtime[\s\S]*capabilities[\s\S]*adapters/],
      ["static registry edit", /registry\.server\.ts/]
    ],
    forbidden: [["capability-local remote file", /index\.remote\.ts/]]
  },
  {
    file: ["capabilities", "new-procedure.mjs"],
    required: [
      ["three-category entry", /context[\s\S]*ports[\s\S]*input/],
      ["local admission", /admit-/],
      ["runtime transformer", /capabilities[\s\S]*adapters/],
      ["registry entry", /registry\.server\.ts/],
      ["central remote generation", /capabilities\.remote\.ts/]
    ],
    forbidden: [
      ["legacy validator", /validate-/],
      ["capability-local remote edit", /index\.remote\.ts/]
    ]
  },
  {
    file: ["model", "new-model-object.mjs"],
    required: [
      ["state.ts", /["']state\.ts["']/],
      ["port.ts", /["']port\.ts["']/],
      ["binding", /bind[A-Z]/],
      ["acquire", /\bacquire\b/],
      ["commit", /\bcommit\b/],
      ["release", /\brelease\b/],
      ["commit mode", /commitMode/],
      ["runtime model builder", /models[\s\S]*build(?:\.server)?\.ts/]
    ],
    forbidden: [
      ["legacy definition", /definition(?:\.svelte)?\.ts/],
      ["separate legacy constructor", /["']constructor\.ts["']/]
    ]
  },
  {
    file: ["model", "new-method.mjs"],
    required: [
      ["state contract", /State/],
      ["state-first operation", /\(state:\s*[^,)]+State/]
    ],
    forbidden: [["attached model method input", /\(model:\s*[^,)]+Model/]]
  },
  {
    file: ["views", "new-concern-entry.mjs"],
    required: [
      ["procedure template", /procedures:\s*`/],
      ["effect template", /effects:\s*`/],
      ["owner effect directory", /join\(root,\s*concern/]
    ],
    forbidden: [["nested procedure effects", /procedures["'],\s*["']effects/]]
  },
  {
    file: ["views", "new-adapter.mjs"],
    required: [
      ["frozen exact adapter", /Object\.freeze/],
      ["client invocation runner", /runtime[\s\S]*procedures[\s\S]*invoke/]
    ],
    forbidden: []
  }
];

const productionCapabilityTemplates = (text) => {
  const beforeTests = text.split(/plan\.create\(\s*join\(root,\s*["']test["']/)[0] ?? text;
  return beforeTests;
};

export default check({
  name: "pure-generators-produce-the-contract",
  baseline: false,
  says: "Generators create the pure-island layout, lifecycle surfaces, registry wiring, and exact adapters by default.",
  subjects: {
    missing: "every contract generator and required target artifact exists",
    template: "generator templates contain every required boundary surface",
    legacy: "generators create no old remote, definition, constructor, or attached-method architecture",
    closure: "generated capability production templates contain no outside dependency",
    verification: "generator output is exercised against the architecture suite"
  },
  run(tree) {
    const found = [];
    for (const contract of contracts) {
      const path = generation(tree, ...contract.file);
      if (!tree.isFile(path)) {
        found.push({
          subject: "missing",
          path,
          line: 1,
          fingerprint: `missing:${contract.file.join("/")}`,
          message: `missing contract generator ${contract.file.join("/")}`
        });
        continue;
      }
      const text = tree.read(path);
      for (const [label, pattern] of contract.required) {
        if (pattern.test(text)) continue;
        found.push({
          subject: "template",
          path,
          line: 1,
          fingerprint: `${contract.file.join("/")}:missing:${label}`,
          message: `${contract.file.at(-1)} does not generate ${label}`
        });
      }
      for (const [label, pattern] of contract.forbidden) {
        const match = pattern.exec(text);
        if (!match) continue;
        found.push({
          subject: "legacy",
          path,
          line: text.slice(0, match.index).split("\n").length,
          fingerprint: `${contract.file.join("/")}:legacy:${label}`,
          message: `${contract.file.at(-1)} still generates ${label}`
        });
      }

      if (contract.file.join("/") === "capabilities/new-procedure.mjs") {
        const production = productionCapabilityTemplates(text);
        for (const match of production.matchAll(/(?:from\s+|import\s*\()["'](\$(?:runtime|model|representation|app)(?:\/[^"']*)?)["']/g)) {
          found.push({
            subject: "closure",
            path,
            line: production.slice(0, match.index).split("\n").length,
            fingerprint: `new-procedure:outside:${match[1]}`,
            message: `new-procedure generates capability production dependency ${match[1]}`
          });
        }
      }
    }

    const generationTest = join(tree.base, "scripts", "test", "generation.test.mjs");
    const verification = tree.read(generationTest);
    for (const name of ["new-capability", "new-procedure", "new-model-object", "new-method", "new-concern-entry", "new-adapter"]) {
      if (verification.includes(name)) continue;
      found.push({
        subject: "verification",
        path: generationTest,
        line: 1,
        fingerprint: `unverified:${name}`,
        message: `${name} is absent from pristine-output architecture verification`
      });
    }
    return found;
  }
});
