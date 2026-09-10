/** Pure admission of the local provider fixture's conversation envelopes. */
export const toolNames = (body) =>
  (Array.isArray(body.tools) ? body.tools : [])
    .map((tool) => tool?.function?.name)
    .filter((name) => typeof name === "string");

export const toolResult = (body) => {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const message = [...messages].reverse().find((entry) => entry?.role === "tool");
  if (message === undefined) return undefined;
  if (typeof message.content !== "string") throw new Error("fixture tool result must be JSON text");
  const parsed = JSON.parse(message.content);
  if (parsed?.ok !== true || !("value" in parsed)) {
    // A refused tool is not the first turn. Repeating the first tool here can
    // otherwise spin until the application's deadline without testing a workflow.
    throw new Error(`fixture tool failed: ${String(parsed?.error ?? "invalid result envelope")}`);
  }
  return parsed.value;
};

export const latestQuestion = (body) => {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const message = [...messages].reverse().find((entry) => entry?.role === "user");
  if (typeof message?.content === "string") return message.content;
  if (!Array.isArray(message?.content)) return "";
  return message.content
    .map((part) => (part?.type === "text" && typeof part.text === "string" ? part.text : ""))
    .join(" ");
};
