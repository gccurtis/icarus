export type ConnectorProvider = "microsoftGraph" | "googleDrive" | "dropbox" | "notion" | "s3";

export type ConnectorCredential = {
  secret: string;
  keyVersion: number;
  expiresAt?: number;
  scopes: string[];
};

export type ConnectorConfiguration =
  | {
      kind: "api";
      request: {
        url: string;
        method: "GET" | "POST";
        headers?: Record<string, string>;
        body?: string;
      };
      output: {
        name: string;
        mediaType: string;
      };
    }
  | {
      kind: "provider";
      provider: ConnectorProvider;
      selection: string;
    };
