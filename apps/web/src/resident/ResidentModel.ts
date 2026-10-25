import type { AuthSession, HouseholdRole } from "../admin/contracts";

export type Repeat = "once" | "daily" | "weekly" | "fortnightly" | "monthly";
export type OwnerMode = "fixed" | "rotation" | "agree";
export type TaskInput = {
  title: string;
  dueDate?: string;
  repeat: Repeat;
  weeklyDays: number[];
  anchorDay: number;
  ownerMode: OwnerMode;
  assigneeId?: string;
  rotation: string[];
  rotationIndex: number;
  completionScope: string;
  activeTime: string;
};
export type ResidentTask = TaskInput & {
  id: string;
  paused: boolean;
  ended: boolean;
  completed: boolean;
  skipped: boolean;
  nextStartDate?: string;
  occurrenceKey?: string;
  seriesBase?: TaskInput;
};
export type ResidentMember = { id: string; name: string; email?: string; role: HouseholdRole };
export type ShoppingItem = { id: string; name: string; quantity: string; priority: "next" | "before" };
export type HouseInvite = { id: string; email: string };
export type HouseData = {
  members: ResidentMember[];
  tasks: ResidentTask[];
  items: ShoppingItem[];
  invites: HouseInvite[];
  firstValueAt?: string;
  lastReviewedAt?: string;
};
export const weekDays = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];
export const repeatOptions = [
  { value: "once", label: "Uma vez" },
  { value: "daily", label: "Diária" },
  { value: "weekly", label: "Dias da semana" },
  { value: "fortnightly", label: "Quinzenal · a cada 14 dias" },
  { value: "monthly", label: "Mensal" },
] as const;
export const ownerOptions = [
  { value: "agree", label: "A combinar" },
  { value: "fixed", label: "Pessoa fixa" },
  { value: "rotation", label: "Revezamento" },
] as const;
export const timeOptions = [
  { value: "", label: "Não informar" },
  { value: "Até 15 min", label: "Até 15 min" },
  { value: "16–45 min", label: "16–45 min" },
  { value: "Mais de 45 min", label: "Mais de 45 min" },
];

export function dateKey(offset = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function fromDateKey(value: string) {
  return new Date(`${value}T12:00:00`);
}

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDays(value: string, amount: number) {
  const date = fromDateKey(value);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

export function formatDate(value?: string) {
  if (!value) return "Sem data";
  const date = fromDateKey(value);
  const offset = Math.round((date.getTime() - fromDateKey(dateKey()).getTime()) / 86_400_000);
  if (offset === 0) return "Hoje";
  if (offset === -1) return "Ontem";
  if (offset === 1) return "Amanhã";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function fullDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(fromDateKey(value));
}

export function repeatLabel(repeat: Repeat, days: number[]) {
  if (repeat === "once") return "Tarefa única";
  if (repeat === "daily") return "Todos os dias";
  if (repeat === "fortnightly") return "A cada 14 dias";
  if (repeat === "monthly") return "Todo mês";
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((day) => weekDays.find((item) => item.value === day)?.label)
    .filter(Boolean)
    .join(" · ");
}

export function nextOccurrence(task: ResidentTask) {
  const today = dateKey();
  const after = task.dueDate && task.dueDate > today ? task.dueDate : today;
  if (task.repeat === "daily") return addDays(after, 1);
  if (task.repeat === "weekly") {
    const days = task.weeklyDays.length ? task.weeklyDays : [fromDateKey(after).getDay()];
    for (let offset = 1; offset <= 7; offset += 1) {
      const candidate = addDays(after, offset);
      if (days.includes(fromDateKey(candidate).getDay())) return candidate;
    }
  }
  if (task.repeat === "fortnightly") {
    let candidate = task.dueDate ?? today;
    do candidate = addDays(candidate, 14); while (candidate <= today);
    return candidate;
  }
  if (task.repeat === "monthly") {
    const base = fromDateKey(after);
    const anchor = task.anchorDay || (task.dueDate ? fromDateKey(task.dueDate).getDate() : base.getDate());
    for (let month = 0; month <= 12; month += 1) {
      const candidateMonth = new Date(base.getFullYear(), base.getMonth() + month, 1, 12);
      const lastDay = new Date(candidateMonth.getFullYear(), candidateMonth.getMonth() + 1, 0, 12).getDate();
      candidateMonth.setDate(Math.min(anchor, lastDay));
      const candidate = toDateKey(candidateMonth);
      if (candidate > after) return candidate;
    }
  }
  return addDays(today, 1);
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("pt-BR"))
    .join("");
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function makeHouseData(householdId: string, user: AuthSession["user"], role: HouseholdRole): HouseData {
  const secondId = `${householdId}-julia`;
  const thirdId = `${householdId}-caio`;
  const today = dateKey();
  const weekDay = fromDateKey(addDays(today, 2)).getDay();
  return {
    members: [
      { id: user.id, name: user.name, email: user.email, role },
      { id: secondId, name: "Júlia Costa", role: "morador" },
      { id: thirdId, name: "Caio Mendes", role: "morador" },
    ],
    tasks: [
      {
        id: `${householdId}-task-dishes`,
        title: "Lavar a louça do jantar",
        dueDate: today,
        repeat: "daily",
        weeklyDays: [],
        anchorDay: fromDateKey(today).getDate(),
        ownerMode: "rotation",
        rotation: [user.id, secondId],
        rotationIndex: 0,
        completionScope: "Louça das refeições comuns do dia a dia.",
        activeTime: "16–45 min",
        paused: false,
        ended: false,
        completed: false,
        skipped: false,
      },
      {
        id: `${householdId}-task-trash`,
        title: "Levar o lixo para fora",
        dueDate: addDays(today, -1),
        repeat: "once",
        weeklyDays: [],
        anchorDay: fromDateKey(today).getDate(),
        ownerMode: "fixed",
        assigneeId: secondId,
        rotation: [],
        rotationIndex: 0,
        completionScope: "Sacos da cozinha e do banheiro.",
        activeTime: "Até 15 min",
        paused: false,
        ended: false,
        completed: false,
        skipped: false,
      },
      {
        id: `${householdId}-task-bathroom`,
        title: "Limpar o banheiro",
        dueDate: addDays(today, 2),
        repeat: "weekly",
        weeklyDays: [weekDay],
        anchorDay: fromDateKey(addDays(today, 2)).getDate(),
        ownerMode: "fixed",
        assigneeId: thirdId,
        rotation: [],
        rotationIndex: 0,
        completionScope: "Vaso, pia e box.",
        activeTime: "Mais de 45 min",
        paused: false,
        ended: false,
        completed: false,
        skipped: false,
      },
      {
        id: `${householdId}-task-mail`,
        title: "Separar correspondências",
        repeat: "once",
        weeklyDays: [],
        anchorDay: fromDateKey(today).getDate(),
        ownerMode: "agree",
        rotation: [],
        rotationIndex: 0,
        completionScope: "",
        activeTime: "",
        paused: false,
        ended: false,
        completed: false,
        skipped: false,
      },
    ],
    items: [
      { id: `${householdId}-item-milk`, name: "Leite", quantity: "2 caixas", priority: "before" },
      { id: `${householdId}-item-coffee`, name: "Café", quantity: "", priority: "next" },
      { id: `${householdId}-item-soap`, name: "Detergente", quantity: "1 frasco", priority: "next" },
    ],
    invites: [],
  };
}

export function memberName(members: ResidentMember[], id?: string) {
  return members.find((member) => member.id === id)?.name;
}

export function taskAssignee(task: ResidentTask) {
  if (task.ownerMode === "rotation") return task.rotation[task.rotationIndex % Math.max(task.rotation.length, 1)];
  return task.assigneeId;
}

export function taskAssigneeLabel(task: ResidentTask, members: ResidentMember[]) {
  const id = taskAssignee(task);
  if (!id) return "A combinar";
  const name = memberName(members, id) ?? "Morador";
  return task.ownerMode === "rotation" ? `Revezamento · ${name}` : name;
}

export function taskInput(task: ResidentTask): TaskInput {
  return {
    title: task.title,
    dueDate: task.dueDate,
    repeat: task.repeat,
    weeklyDays: task.weeklyDays,
    anchorDay: task.anchorDay,
    ownerMode: task.ownerMode,
    assigneeId: task.assigneeId,
    rotation: task.rotation,
    rotationIndex: task.rotationIndex,
    completionScope: task.completionScope,
    activeTime: task.activeTime,
  };
}
