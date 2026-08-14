/**
 * The one shape every error this transport produces takes.
 *
 * It matches the shape capabilities use for their own expected failures, so a
 * caller parses one error format whether the fault was refused at the transport
 * or reported by an endpoint job.
 */
export interface TransportErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly requestId?: string;
  };
}

/** A stable code and a message that is safe to return, per framework fault. */
const CLIENT_FAULTS: Record<string, { code: string; message: string }> = {
  FST_ERR_CTP_INVALID_JSON_BODY: {
    code: "malformed-body",
    message: "Request body is not valid JSON."
  },
  FST_ERR_CTP_EMPTY_JSON_BODY: {
    code: "malformed-body",
    message: "Request body is empty."
  },
  FST_ERR_CTP_INVALID_MEDIA_TYPE: {
    code: "unsupported-media-type",
    message: "Request body must be application/json."
  },
  FST_ERR_CTP_BODY_TOO_LARGE: {
    code: "body-too-large",
    message: "Request body exceeds the configured limit."
  }
};

const UNKNOWN_CLIENT_FAULT = {
  code: "bad-request",
  message: "The request could not be processed."
};

const statusOf = (error: unknown): number => {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof status === "number" && status >= 400 && status <= 599 ? status : 500;
};

const codeOf = (error: unknown): string | undefined => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
};

/** The 404 an unmatched endpoint answers with. */
export const endpointNotFoundBody = (method: string, path: string): TransportErrorBody => ({
  error: {
    code: "endpoint-not-found",
    message: `No endpoint is registered for '${method} ${path}'.`
  }
});

/**
 * Turns anything thrown into the status and body to answer with.
 *
 * **No message from the thrown value ever reaches the response.** A server fault
 * answers with a fixed message and the request id, so an operator can join the
 * response to the log record that does carry the detail; the detail itself —
 * which for a database fault is the statement, and sometimes its parameters —
 * stays in the log. A client fault is translated through the table above rather
 * than forwarded, because a framework message is written for a developer reading
 * a stack trace, not for a caller reading an API.
 */
export const errorResponse = (
  error: unknown,
  requestId: string
): { statusCode: number; body: TransportErrorBody } => {
  const statusCode = statusOf(error);

  if (statusCode >= 500) {
    return {
      statusCode,
      body: {
        error: {
          code: "internal",
          message: "The request could not be completed.",
          requestId
        }
      }
    };
  }

  const fault = CLIENT_FAULTS[codeOf(error) ?? ""] ?? UNKNOWN_CLIENT_FAULT;
  return { statusCode, body: { error: { code: fault.code, message: fault.message } } };
};
