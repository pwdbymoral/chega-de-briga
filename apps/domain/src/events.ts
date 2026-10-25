export const taskEventTypes = [
  "tarefa_criada", "tarefa_concluida", "tarefa_pulada", "tarefa_editada", "tarefa_renegociada",
] as const;
export type TaskEventType = typeof taskEventTypes[number];

export function isTaskEventType(value: unknown): value is TaskEventType {
  return typeof value === "string" && taskEventTypes.some((type) => type === value);
}

export type TaskSyncEvent = {
  id: string;
  type: TaskEventType;
  taskId: string;
  occurrenceDate?: string;
  scope?: "occurrence" | "series";
  note?: string;
};
export type ProductSyncEvent = TaskSyncEvent | {
  id: string;
  type: "item_compra_adicionado";
  itemId: string;
};
