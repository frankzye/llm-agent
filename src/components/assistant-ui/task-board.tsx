"use client";

import {
  useAssistantInteractable,
  useInteractableState,
} from "@assistant-ui/react";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod/v4";

import { Button } from "@/src/components/ui/button";
import { useMainAgentRemoteId } from "@/src/lib/use-main-agent-remote-id";

const taskBoardZod = z.object({
  tasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      done: z.boolean(),
    }),
  ),
});

type TaskBoardState = z.infer<typeof taskBoardZod>;

const taskBoardSchema = z.toJSONSchema(taskBoardZod);

const taskBoardInitialState: TaskBoardState = { tasks: [] };

/**
 * Per-agent task board (persisted under `.data/agents/<id>/task-board.json`).
 * The model can update via `update_taskBoard_<id>` when multiple interactables exist.
 * @see https://www.assistant-ui.com/docs/guides/interactables
 */
export function TaskBoard() {
  const remoteAgentId = useMainAgentRemoteId();
  const interactableInstanceId = remoteAgentId ?? "draft";

  const id = useAssistantInteractable("taskBoard", {
    id: interactableInstanceId,
    description:
      "This agent's task board. Add, complete, or edit tasks when the user asks.",
    stateSchema: taskBoardSchema as any,
    initialState: taskBoardInitialState,
  });
  const [stateRaw, { setState }] = useInteractableState(
    id,
    taskBoardInitialState,
  );
  const state = stateRaw as TaskBoardState;

  const loadedKeyRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!remoteAgentId) {
      loadedKeyRef.current = null;
      return;
    }
    let cancelled = false;
    setLoadError(null);
    void (async () => {
      try {
        const r = await fetch(
          `/api/agents/${encodeURIComponent(remoteAgentId)}/task-board`,
        );
        if (!r.ok) throw new Error(`Load failed (${r.status})`);
        const data = (await r.json()) as TaskBoardState;
        if (cancelled) return;
        setState(() => ({
          tasks: Array.isArray(data.tasks) ? data.tasks : [],
        }));
        loadedKeyRef.current = remoteAgentId;
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [remoteAgentId, setState]);

  useEffect(() => {
    if (!remoteAgentId) return;
    if (loadedKeyRef.current !== remoteAgentId) return;
    const t = window.setTimeout(() => {
      void fetch(`/api/agents/${encodeURIComponent(remoteAgentId)}/task-board`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      }).catch((e) => {
        console.error("[task-board] save failed", e);
      });
    }, 450);
    return () => window.clearTimeout(t);
  }, [state, remoteAgentId]);

  const clearBoard = useCallback(() => {
    setState({ tasks: [] });
  }, [setState]);

  if (!remoteAgentId) {
    return (
      <div className="flex h-full min-h-0 flex-col border-l border-[#e8eaed] bg-[#fafafa] p-3 dark:border-[#3c4043] dark:bg-[#0c0c0c]">
        <p className="text-xs text-[#70757a] dark:text-[#9aa0a6]">
          Create or select a saved agent to use the task board.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-[#e8eaed] bg-[#fafafa] dark:border-[#3c4043] dark:bg-[#0c0c0c]">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[#e8eaed] px-3 py-2 dark:border-[#3c4043]">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#5f6368] dark:text-[#9aa0a6]">
            Task board
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-[#70757a] dark:text-[#80868b]">
            Saved for this agent. The assistant can update via tools.
          </p>
        </div>
        {state.tasks.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="shrink-0 text-[#5f6368] hover:text-[#1f1f1f] dark:text-[#9aa0a6] dark:hover:text-[#e3e3e3]"
            onClick={clearBoard}
          >
            Clear all
          </Button>
        ) : null}
      </div>
      {loadError ? (
        <p className="px-3 py-2 text-xs text-[#c5221f] dark:text-[#f28b82]">
          {loadError}
        </p>
      ) : null}
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {state.tasks.length === 0 ? (
          <li className="rounded-lg border border-dashed border-[#dadce0] px-3 py-6 text-center text-xs text-[#70757a] dark:border-[#3c4043] dark:text-[#9aa0a6]">
            No tasks yet. Ask the assistant to add one.
          </li>
        ) : (
          state.tasks.map((task) => {
            const done = task.done ?? false;
            return (
              <li
                key={task.id}
                className="mb-1.5 flex items-start gap-1 rounded-lg border border-[#e8eaed] bg-white px-2 py-2 text-sm dark:border-[#3c4043] dark:bg-[#131314]"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 rounded border-[#dadce0] dark:border-[#5f6368]"
                    checked={done}
                    onChange={() =>
                      setState((prev) => {
                        const p = prev as TaskBoardState;
                        return {
                          tasks: p.tasks.map((t) =>
                            t.id === task.id
                              ? { ...t, done: !(t.done ?? false) }
                              : t,
                          ),
                        };
                      })
                    }
                  />
                  <span
                    className={
                      done
                        ? "text-[#70757a] line-through dark:text-[#9aa0a6]"
                        : "text-[#1f1f1f] dark:text-[#e3e3e3]"
                    }
                  >
                    {task.title ?? ""}
                  </span>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-[#70757a] hover:text-[#c5221f] dark:text-[#9aa0a6] dark:hover:text-[#f28b82]"
                  aria-label="Delete task"
                  onClick={() =>
                    setState((prev) => {
                      const p = prev as TaskBoardState;
                      return {
                        tasks: p.tasks.filter((t) => t.id !== task.id),
                      };
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
