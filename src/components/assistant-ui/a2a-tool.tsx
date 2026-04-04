"use client";

import {
  makeAssistantToolUI,
  MessagePartPrimitive,
  MessagePrimitive,
  type ToolCallMessagePartComponent,
} from "@assistant-ui/react";
import { Loader2, Send, TriangleAlert } from "lucide-react";
import { useMemo } from "react";

import {
  AssistantMessageMarkdown,
  UserMessageMarkdown,
} from "@/src/components/assistant-ui/chat-markdown";

function parseArgs(argsText: string, args: unknown): Record<string, unknown> {
  if (args && typeof args === "object" && args !== null) {
    return args as Record<string, unknown>;
  }
  try {
    return JSON.parse(argsText) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function truncate(s: string, n: number): string {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

type A2AResult =
  | {
      delivered: true;
      targetName?: string;
      assistantReply?: string;
      inboxMessageId?: string;
      messageId?: string;
      note?: string;
    }
  | { delivered?: false; error?: string }
  | { error?: string };

/** Avoid importing DefaultToolCard here (circular import with default-tool). */
const A2AToolNestedFallback: ToolCallMessagePartComponent = ({
  toolName,
  result,
}) => {
  const loading = result === undefined;
  return (
    <div className="mt-1 rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-2 py-1.5 text-xs text-[#444746] dark:border-[#3c4043] dark:bg-[#131314] dark:text-[#bdc1c6]">
      {loading ? `${toolName}…` : `${toolName} ✓`}
    </div>
  );
};

const A2ASendToolRender: ToolCallMessagePartComponent<
  { targetAgentId?: string; message?: string; correlationId?: string },
  A2AResult
> = ({ args, argsText, result, status }) => {
  const a = useMemo(() => parseArgs(argsText, args), [argsText, args]);
  const target =
    typeof a.targetAgentId === "string" ? a.targetAgentId : "";
  const msg = typeof a.message === "string" ? a.message : "";

  const loading = result === undefined;
  const isError =
    !!result &&
    typeof result === "object" &&
    result !== null &&
    (("error" in result && typeof (result as { error?: unknown }).error === "string") ||
      ("delivered" in result && (result as { delivered?: unknown }).delivered === false));

  const delivered =
    !!result &&
    typeof result === "object" &&
    result !== null &&
    "delivered" in result &&
    (result as { delivered?: unknown }).delivered === true;

  const running = status.type === "running";

  const label = loading
    ? "Calling target agent…"
    : delivered
      ? "A2A reply"
      : "A2A send failed";

  const subtitle = loading
    ? target
      ? `to: ${target}`
      : undefined
    : delivered
      ? target
        ? (() => {
            const r = result as {
              targetName?: string;
            };
            const nm = r.targetName?.trim();
            return nm ? `to: ${nm} (${target})` : `to: ${target}`;
          })()
        : "Delivered"
      : result && typeof result === "object" && result !== null && "error" in result
        ? truncate(String((result as { error?: string }).error ?? "Error"), 140)
        : "Error";

  const replyPreview =
    !loading &&
    delivered &&
    result &&
    typeof result === "object" &&
    result !== null &&
    "assistantReply" in result &&
    typeof (result as { assistantReply?: string }).assistantReply === "string"
      ? truncate((result as { assistantReply: string }).assistantReply, 400)
      : null;

  const detail = !loading && msg ? truncate(msg, 200) : null;

  return (
    <div className="my-2 rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/80 to-white px-3 py-3 shadow-sm dark:border-indigo-500/25 dark:from-indigo-950/35 dark:to-[#1a1b1e]">
      <div className="mb-2 flex items-center gap-3">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300"
          aria-hidden
        >
          {loading || running ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          ) : isError ? (
            <TriangleAlert className="size-4" strokeWidth={2.25} />
          ) : (
            <Send className="size-4" strokeWidth={2.25} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold tracking-tight text-[#1f1f1f] dark:text-[#e8eaed]">
            {label}
            {(loading || running) && (
              <span className="ml-1.5 font-normal text-[#5f6368] dark:text-[#9aa0a6]">
                (working…)
              </span>
            )}
          </p>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-[#5f6368] dark:text-[#9aa0a6]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {!loading && detail ? (
        <p className="mb-1 truncate text-[11px] text-[#70757a] dark:text-[#9aa0a6]">
          {detail}
        </p>
      ) : null}
      {!loading && replyPreview ? (
        <p className="line-clamp-6 text-[11px] text-[#3c4043] dark:text-[#bdc1c6]">
          {replyPreview}
        </p>
      ) : null}
    </div>
  );
};

/**
 * Mount once under `AssistantRuntimeProvider` to register the tool UI.
 * Renders null; registration is via `useAssistantToolUI` side effect.
 */
export const A2ASendTool = makeAssistantToolUI({
  toolName: "a2a_send",
  render: A2ASendToolRender,
});
