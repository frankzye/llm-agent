import {
  parseJsonEventStream,
  readUIMessageStream,
  uiMessageChunkSchema,
  type UIMessage,
  type UIMessageChunk,
} from "ai";

function parseResultToChunkStream(
  stream: ReadableStream<Uint8Array>,
): ReadableStream<UIMessageChunk> {
  return parseJsonEventStream({
    stream,
    schema: uiMessageChunkSchema,
  }).pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        if (!chunk.success) {
          throw chunk.error;
        }
        controller.enqueue(chunk.value);
      },
    }),
  );
}

/** Collect final assistant text from a `/api/chat` UIMessage stream response body. */
export async function consumeChatResponseToText(
  body: ReadableStream<Uint8Array> | null,
): Promise<string> {
  if (!body) return "";
  const chunkStream = parseResultToChunkStream(body);
  let last: UIMessage | undefined;
  try {
    for await (const msg of readUIMessageStream({ stream: chunkStream })) {
      last = msg;
    }
  } catch {
    return "";
  }
  if (!last?.parts?.length) return "";

  const text = last.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
  if (text.trim()) return text;

  const reasoning = last.parts
    .filter((p): p is { type: "reasoning"; text: string } => p.type === "reasoning")
    .map((p) => p.text)
    .join("");
  return reasoning;
}
