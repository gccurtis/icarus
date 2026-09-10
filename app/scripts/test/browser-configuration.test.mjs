import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import {
  browserConfigurationSections,
  copyBrowserConfiguration
} from "../browser-configuration.mjs";

const directories = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the browser fixture copies only admitted sections and never local credentials", () => {
  const root = mkdtempSync(join(tmpdir(), "icarus-browser-configuration-test-"));
  directories.push(root);
  const source = join(root, "source");
  const destination = join(root, "destination");
  mkdirSync(join(source, "overlays"), { recursive: true });
  writeFileSync(join(source, "base.yaml"), "base: true\n");
  writeFileSync(join(source, "local.yaml"), "apiKey: real-secret\n");
  writeFileSync(join(source, "untracked.yaml"), "apiKey: another-secret\n");
  writeFileSync(join(source, "overlays", "unrelated.yaml"), "unrelated: true\n");
  writeFileSync(
    join(source, "overlays", "browser-providers.yaml"),
    "endpoint: __ICARUS_BROWSER_PROVIDER_ORIGIN__/v1\n"
  );

  copyBrowserConfiguration({
    sourceDirectory: source,
    destinationDirectory: destination,
    trackedSections: ["base.yaml"],
    overlay: "overlays/browser-providers.yaml",
    providerOrigin: "http://127.0.0.1:23456"
  });

  assert.equal(readFileSync(join(destination, "base.yaml"), "utf8"), "base: true\n");
  assert.equal(existsSync(join(destination, "local.yaml")), false);
  assert.equal(existsSync(join(destination, "untracked.yaml")), false);
  assert.equal(existsSync(join(destination, "overlays", "unrelated.yaml")), false);
  assert.equal(
    readFileSync(join(destination, "overlays", "browser-providers.yaml"), "utf8"),
    "endpoint: http://127.0.0.1:23456/v1\n"
  );
});

test("the browser fixture refuses local and nested base sections", () => {
  const root = mkdtempSync(join(tmpdir(), "icarus-browser-configuration-test-"));
  directories.push(root);
  mkdirSync(join(root, "source", "overlays"), { recursive: true });
  writeFileSync(join(root, "source", "local.yaml"), "apiKey: secret\n");
  writeFileSync(
    join(root, "source", "overlays", "browser-providers.yaml"),
    "endpoint: __ICARUS_BROWSER_PROVIDER_ORIGIN__\n"
  );

  assert.throws(
    () =>
      copyBrowserConfiguration({
        sourceDirectory: join(root, "source"),
        destinationDirectory: join(root, "destination"),
        trackedSections: ["local.yaml"],
        overlay: "overlays/browser-providers.yaml",
        providerOrigin: "http://127.0.0.1:23456"
      }),
    /refused configuration section/
  );
});

test("tracked fixture overlays are never discovered as base sections", () => {
  assert.deepEqual(
    browserConfigurationSections([
      "configuration/base.yaml",
      "configuration/workspace.yaml",
      "configuration/local.yaml",
      "configuration/overlays/browser-providers.yaml",
      "configuration/readme.txt",
      "configuration.yaml"
    ]),
    ["base.yaml", "workspace.yaml"]
  );
});
