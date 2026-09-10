import { describe, expect, it } from "vitest";
import { isStoredConnector } from "$representation/data/behavior/external/stored-connector";

const connector = () => ({
  _id: "connectors:1",
  _creationTime: 1,
  projectId: "default",
  name: "Drive",
  configuration: { kind: "provider", provider: "googleDrive", selection: "folder-1" },
  credential: { secret: "ciphertext", keyVersion: 1, scopes: ["read"] },
  refreshIntervalMs: 60_000,
  createdBy: { kind: "user", userId: "users:1" },
  updatedAt: 2
});

describe("current connector storage", () => {
  it("admits an exact provider connector", () => {
    expect(isStoredConnector(connector())).toBe(true);
  });

  it("rejects partial, unknown, and coerced nested variants", () => {
    expect(isStoredConnector({
      ...connector(),
      configuration: { kind: "provider", provider: "googleDrive" }
    })).toBe(false);
    expect(isStoredConnector({
      ...connector(),
      credential: { ...connector().credential, token: "plain" }
    })).toBe(false);
    expect(isStoredConnector({
      ...connector(),
      configuration: {
        ...connector().configuration,
        provider: { toString: () => "googleDrive" }
      }
    })).toBe(false);
  });
});
