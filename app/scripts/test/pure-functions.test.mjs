import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import importClosure from "../lint/across/pure-island-import-closure.mjs";
import ambientAuthority from "../lint/across/pure-island-has-no-ambient-authority.mjs";
import closedExports from "../lint/across/pure-island-exports-are-closed.mjs";
import closedComponentProcedures from "../lint/across/component-procedures-are-closed.mjs";
import effectBoundaries from "../lint/across/effects-are-boundaries.mjs";
import contractGenerators from "../lint/across/pure-generators-produce-the-contract.mjs";
import localCapabilityContracts from "../lint/capabilities/capability-contract-is-local.mjs";
import freeModelOperations from "../lint/model/model-operations-are-free.mjs";
import modelPortLifecycle from "../lint/model/model-port-has-one-lifecycle.mjs";
import modelStateFields from "../lint/model/model-state-is-fields.mjs";
import exactCapabilityAdapters from "../lint/runtime/capability-adapter-is-exact.mjs";
import bijectiveCapabilityRegistry from "../lint/runtime/capability-registry-is-bijective.mjs";
import releasingGateway from "../lint/runtime/gateway-releases-every-acquisition.mjs";
import oneStagedOwner from "../lint/runtime/one-staged-commit-owner.mjs";
import onlyRemoteGateway from "../lint/runtime/remote-gateway-is-the-only-crossing.mjs";
import runtimeModelConstruction from "../lint/runtime/runtime-alone-builds-models.mjs";
import { MUTATIONS } from "./mutations/pure-functions.mjs";
import { breaking, discard, sandbox, treeIn } from "./sandbox.mjs";

const checks = new Map([
  [importClosure.name, importClosure],
  [ambientAuthority.name, ambientAuthority],
  [closedExports.name, closedExports],
  [modelStateFields.name, modelStateFields],
  [freeModelOperations.name, freeModelOperations],
  [modelPortLifecycle.name, modelPortLifecycle],
  [runtimeModelConstruction.name, runtimeModelConstruction],
  [localCapabilityContracts.name, localCapabilityContracts],
  [exactCapabilityAdapters.name, exactCapabilityAdapters],
  [bijectiveCapabilityRegistry.name, bijectiveCapabilityRegistry],
  [onlyRemoteGateway.name, onlyRemoteGateway],
  [releasingGateway.name, releasingGateway],
  [oneStagedOwner.name, oneStagedOwner],
  [closedComponentProcedures.name, closedComponentProcedures],
  [effectBoundaries.name, effectBoundaries],
  [contractGenerators.name, contractGenerators]
]);

const key = ({ subject, path, message }) => `${subject ?? ""}|${path}|${message}`;

let base;
let baseline;

before(async () => {
  base = sandbox();
  const tree = await treeIn(base);
  baseline = new Map();
  for (const [name, check] of checks) {
    baseline.set(name, new Set((await check.run(tree)).map(key)));
  }
});
after(() => discard(base));

describe("the pure-island checkers resist the contract's one-file bypasses", () => {
  for (const [name, check] of checks) {
    test(name, async () => {
      const attacks = MUTATIONS.filter(({ check: target }) => target === name);
      const changes = attacks.flatMap(({ changes: mutationChanges }) => mutationChanges);
      const found = await breaking(base, changes, (tree) => check.run(tree));
      const fresh = found.filter((finding) => !baseline.get(name).has(key(finding)));

      for (const attack of attacks) {
        assert.ok(
          fresh.some(
            (finding) =>
              finding.path.endsWith(attack.names) &&
              (!attack.subject || finding.subject === attack.subject)
          ),
          `${name} did not reject “${attack.says}” at ${attack.names} under ${attack.subject ?? "its checker"}`
        );
      }
    });
  }
});
