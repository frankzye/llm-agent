"use client";

import { useAui, useAuiState } from "@assistant-ui/react";
import { useCallback, useEffect, useState } from "react";

import { resolveMainAgentRemoteId } from "@/src/lib/main-agent-id";

/** Stable agent id for the main thread (persists API calls when remoteId is set). */
export function useMainAgentRemoteId(): string | null {
  const aui = useAui();
  const mainThreadId = useAuiState((s) => s.threads.mainThreadId);
  const threadIdsKey = useAuiState((s) => s.threads.threadIds.join("|"));
  const [id, setId] = useState<string | null>(null);

  const sync = useCallback(() => {
    const runtime = aui.threads().__internal_getAssistantRuntime?.();
    if (!runtime) return;
    setId(resolveMainAgentRemoteId(runtime));
  }, [aui]);

  useEffect(() => {
    sync();
  }, [sync, mainThreadId, threadIdsKey]);

  return id;
}
