import type { UIMessage } from "ai";
import { generateText } from "ai";
import type { LanguageModel } from "ai";

/** Rough character budget for text + reasoning + tool inputs/outputs (proxy for token load). */
export function roughTranscriptChars(messages: UIMessage[]): number {
  let n = 0;
  for (const m of messages) {
    for (const p of m.parts) {
      if (!p || typeof p !== "object") continue;
      const o = p as Record<string, unknown>;
      const typ = o.type;
      if (typ === "text" && typeof o.text === "string") {
        n += o.text.length;
        continue;
      }
      if (typ === "reasoning" && typeof o.text === "string") {
        n += o.text.length;
        continue;
      }
      if (typeof typ === "string" && (typ.startsWith("tool-") || typ === "dynamic-tool")) {
        try {
          if (o.input !== undefined) n += JSON.stringify(o.input).length;
          if (o.output !== undefined) n += JSON.stringify(o.output).length;
          if (typeof o.errorText === "string") n += o.errorText.length;
        } catch {
          n += 50_000;
        }
      }
    }
  }
  return n;
}

const DEFAULT_MAX_ROUGH_CHARS = 120_000;
const DEFAULT_KEEP_LAST = 12;
const HEAD_FOR_SUMMARY_MAX = 24_000;
const TOOL_OUTPUT_MAX_CHARS = 8_000;
const MIN_MESSAGES_TO_KEEP = 2;

function truncateToolOutputsInMessages(
  messages: UIMessage[],
  maxOutputChars: number,
): UIMessage[] {
  return messages.map((m) => {
    if (m.role !== "assistant") return m;
    const parts = m.parts.map((part) => {
      if (!part || typeof part !== "object") return part;
      const o = part as Record<string, unknown>;
      const typ = o.type;
      if (typeof typ !== "string" || (!typ.startsWith("tool-") && typ !== "dynamic-tool")) {
        return part;
      }
      if (o.state !== "output-available" || o.output === undefined) return part;
      const out = o.output;
      let s: string;
      try {
        s = typeof out === "string" ? out : JSON.stringify(out);
      } catch {
        return part;
      }
      if (s.length <= maxOutputChars) return part;
      const truncated =
        typeof out === "string"
          ? `${s.slice(0, maxOutputChars)}…[truncated ${s.length - maxOutputChars} chars]`
          : `[truncated tool output, ${s.length} chars]`;
      return { ...part, output: truncated } as (typeof m.parts)[number];
    });
    return { ...m, parts };
  });
}

/** Drop oldest messages until rough size is under budget (after tool truncation). */
function shrinkMessagesToBudget(
  messages: UIMessage[],
  maxRoughChars: number,
): UIMessage[] {
  let m = truncateToolOutputsInMessages(messages, TOOL_OUTPUT_MAX_CHARS);
  let guard = 0;
  while (
    m.length > MIN_MESSAGES_TO_KEEP &&
    roughTranscriptChars(m) > maxRoughChars &&
    guard++ < 1_000
  ) {
    m = truncateToolOutputsInMessages(m.slice(1), TOOL_OUTPUT_MAX_CHARS);
  }
  return m;
}

/**
 * When the transcript is large, summarize older turns and keep recent messages.
 * Runs server-side (hook), not exposed as a user tool by default.
 */
export async function autoCompactMessages(
  messages: UIMessage[],
  model: LanguageModel,
  opts?: { maxChars?: number; keepLast?: number },
): Promise<{ messages: UIMessage[]; systemAddendum?: string }> {
  const maxChars = opts?.maxChars ?? DEFAULT_MAX_ROUGH_CHARS;
  const keepLast = opts?.keepLast ?? DEFAULT_KEEP_LAST;

  let working = truncateToolOutputsInMessages(messages, TOOL_OUTPUT_MAX_CHARS);
  let rough = roughTranscriptChars(working);

  // Short thread (≤ keepLast): only enforce budget via truncation + dropping oldest if needed.
  if (working.length <= keepLast) {
    if (rough <= maxChars) {
      return { messages: working };
    }
    return { messages: shrinkMessagesToBudget(working, maxChars) };
  }

  // Long thread: summarize older messages, keep the last `keepLast` in full (then cap size).
  const head = working.slice(0, -keepLast);
  let tail = truncateToolOutputsInMessages(working.slice(-keepLast), TOOL_OUTPUT_MAX_CHARS);

  const transcript = head
    .map((m) => {
      const text = m.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");
      return `${m.role}: ${text}`;
    })
    .join("\n\n");

  const { text: summary } = await generateText({
    model,
    system:
      "Summarize the conversation excerpt for future context. Preserve facts, decisions, and open tasks. Be concise.",
    prompt: transcript.slice(0, HEAD_FOR_SUMMARY_MAX),
  });

  const systemAddendum = `Earlier conversation (compressed):\n${summary}`;

  tail = shrinkMessagesToBudget(tail, maxChars);

  return { messages: tail, systemAddendum };
}
