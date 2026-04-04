"use client";

import {
  useAssistantInteractable,
  useInteractableState,
} from "@assistant-ui/react";
import { Trash2 } from "lucide-react";
import { z } from "zod/v4";

import { Button } from "@/src/components/ui/button";

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
 * Persistent task board the model can update via the auto-generated `update_taskBoard` tool.
 * @see https://www.assistant-ui.com/docs/guides/interactables
 */
export function TaskBoard() {
  const id = useAssistantInteractable("taskBoard", {
    description:
      "A task board showing the user's tasks. Add, complete, or edit tasks when the user asks.",
    stateSchema: taskBoardSchema as any,
    initialState: taskBoardInitialState,
  });
  const [stateRaw, { setState }] = useInteractableState(
    id,
    taskBoardInitialState,
  );
  const state = stateRaw as TaskBoardState;

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-[#e8eaed] bg-[#fafafa] dark:border-[#3c4043] dark:bg-[#0c0c0c]">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[#e8eaed] px-3 py-2 dark:border-[#3c4043]">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#5f6368] dark:text-[#9aa0a6]">
            Task board
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-[#70757a] dark:text-[#80868b]">
            The assistant can update this via tools while you chat.
          </p>
        </div>
        {state.tasks.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="shrink-0 text-[#5f6368] hover:text-[#1f1f1f] dark:text-[#9aa0a6] dark:hover:text-[#e3e3e3]"
            onClick={() => setState({ tasks: [] })}
          >
            Clear all
          </Button>
        ) : null}
      </div>
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
