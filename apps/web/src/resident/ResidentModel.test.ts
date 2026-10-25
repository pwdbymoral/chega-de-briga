import { describe, expect, it } from "vitest";
import {
  addDays,
  dateKey,
  formatDate,
  fromDateKey,
  fullDate,
  initials,
  nextOccurrence,
  repeatLabel,
  reviewDue,
  taskAssignee,
  taskAssigneeLabel,
  taskInput,
  toDateKey,
  type ResidentMember,
  type ResidentTask,
} from "./ResidentModel";

describe("ResidentModel", () => {
  describe("manipulação e formatação de datas", () => {
    it("converte entre data e chave YYYY-MM-DD", () => {
      const date = new Date(2026, 9, 12, 12, 0, 0); // 12 de outubro de 2026
      expect(toDateKey(date)).toBe("2026-10-12");
      const parsed = fromDateKey("2026-10-12");
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(9);
      expect(parsed.getDate()).toBe(12);
    });

    it("adiciona e subtrai dias corretamente", () => {
      expect(addDays("2026-10-12", 1)).toBe("2026-10-13");
      expect(addDays("2026-10-12", -1)).toBe("2026-10-11");
      expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
      expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    });

    it("formata datas relativas (Hoje, Ontem, Amanhã)", () => {
      const today = dateKey();
      expect(formatDate(today)).toBe("Hoje");
      expect(formatDate(addDays(today, -1))).toBe("Ontem");
      expect(formatDate(addDays(today, 1))).toBe("Amanhã");
      expect(formatDate(undefined)).toBe("Sem data");
    });

    it("formata data completa em português", () => {
      const formatted = fullDate("2026-10-12");
      expect(formatted).toContain("outubro");
      expect(formatted).toContain("12");
    });
  });

  describe("rótulos e pessoas", () => {
    it("extrai iniciais de até duas palavras", () => {
      expect(initials("Júlia Costa")).toBe("JC");
      expect(initials("Caio")).toBe("C");
      expect(initials("Vinícius Moraes Valença")).toBe("VM");
    });

    it("formata rótulos de frequência", () => {
      expect(repeatLabel("once", [])).toBe("Tarefa única");
      expect(repeatLabel("daily", [])).toBe("Todos os dias");
      expect(repeatLabel("fortnightly", [])).toBe("A cada 14 dias");
      expect(repeatLabel("monthly", [])).toBe("Todo mês");
      expect(repeatLabel("weekly", [1, 3, 5])).toBe("Seg · Qua · Sex");
    });

    it("determina a pessoa da vez por atribuição fixa ou revezamento", () => {
      const members: ResidentMember[] = [
        { id: "m-1", name: "Júlia", role: "responsavel" },
        { id: "m-2", name: "Caio", role: "morador" },
      ];

      const fixedTask: ResidentTask = {
        id: "t-1",
        title: "Lavar a louça",
        repeat: "daily",
        weeklyDays: [],
        anchorDay: 1,
        ownerMode: "fixed",
        assigneeId: "m-1",
        rotation: [],
        rotationIndex: 0,
        completionScope: "",
        activeTime: "",
        paused: false,
        ended: false,
        completed: false,
        skipped: false,
      };
      expect(taskAssignee(fixedTask)).toBe("m-1");
      expect(taskAssigneeLabel(fixedTask, members)).toBe("Júlia");

      const rotationTask: ResidentTask = {
        ...fixedTask,
        ownerMode: "rotation",
        rotation: ["m-1", "m-2"],
        rotationIndex: 1,
      };
      expect(taskAssignee(rotationTask)).toBe("m-2");
      expect(taskAssigneeLabel(rotationTask, members)).toBe("Revezamento · Caio");

      const unassignedTask: ResidentTask = {
        ...fixedTask,
        ownerMode: "agree",
        assigneeId: undefined,
      };
      expect(taskAssignee(unassignedTask)).toBeUndefined();
      expect(taskAssigneeLabel(unassignedTask, members)).toBe("A combinar");
    });

    it("extrai os campos de entrada corretos com taskInput", () => {
      const task: ResidentTask = {
        id: "t-1",
        title: "Tirar o lixo",
        dueDate: "2026-10-15",
        repeat: "weekly",
        weeklyDays: [2, 4],
        anchorDay: 15,
        ownerMode: "fixed",
        assigneeId: "m-1",
        rotation: [],
        rotationIndex: 0,
        completionScope: "Tirar antes das 19h",
        activeTime: "Até 15 min",
        paused: false,
        ended: false,
        completed: false,
        skipped: false,
      };
      const input = taskInput(task);
      expect(input).toEqual({
        title: "Tirar o lixo",
        dueDate: "2026-10-15",
        repeat: "weekly",
        weeklyDays: [2, 4],
        anchorDay: 15,
        ownerMode: "fixed",
        assigneeId: "m-1",
        rotation: [],
        rotationIndex: 0,
        completionScope: "Tirar antes das 19h",
        activeTime: "Até 15 min",
      });
    });
  });

  describe("cálculo de próxima ocorrência (nextOccurrence)", () => {
    it("calcula próxima ocorrência diária a partir de hoje", () => {
      const today = dateKey();
      const task: ResidentTask = {
        id: "t-1",
        title: "Diária",
        dueDate: today,
        repeat: "daily",
        weeklyDays: [],
        anchorDay: 1,
        ownerMode: "agree",
        rotation: [],
        rotationIndex: 0,
        completionScope: "",
        activeTime: "",
        paused: false,
        ended: false,
        completed: false,
        skipped: false,
      };
      expect(nextOccurrence(task)).toBe(addDays(today, 1));
    });

    it("calcula próxima ocorrência semanal no próximo dia agendado", () => {
      const today = dateKey();
      const todayDayOfWeek = fromDateKey(today).getDay();
      const nextDayOfWeek = (todayDayOfWeek + 2) % 7;

      const task: ResidentTask = {
        id: "t-2",
        title: "Semanal",
        dueDate: today,
        repeat: "weekly",
        weeklyDays: [nextDayOfWeek],
        anchorDay: 1,
        ownerMode: "agree",
        rotation: [],
        rotationIndex: 0,
        completionScope: "",
        activeTime: "",
        paused: false,
        ended: false,
        completed: false,
        skipped: false,
      };
      const next = nextOccurrence(task);
      expect(fromDateKey(next).getDay()).toBe(nextDayOfWeek);
      expect(next > today).toBe(true);
    });

    it("calcula próxima ocorrência quinzenal avançando até data futura", () => {
      const today = dateKey();
      const task: ResidentTask = {
        id: "t-3",
        title: "Quinzenal",
        dueDate: addDays(today, -28), // 28 dias atrás
        repeat: "fortnightly",
        weeklyDays: [],
        anchorDay: 1,
        ownerMode: "agree",
        rotation: [],
        rotationIndex: 0,
        completionScope: "",
        activeTime: "",
        paused: false,
        ended: false,
        completed: false,
        skipped: false,
      };
      const next = nextOccurrence(task);
      expect(next > today).toBe(true);
    });

    it("calcula próxima ocorrência mensal respeitando ancoragem de dia e datas passadas", () => {
      const today = dateKey();
      const task: ResidentTask = {
        id: "t-4",
        title: "Mensal",
        dueDate: "2023-01-15", // data antiga de 3 anos atrás
        repeat: "monthly",
        weeklyDays: [],
        anchorDay: 15,
        ownerMode: "agree",
        rotation: [],
        rotationIndex: 0,
        completionScope: "",
        activeTime: "",
        paused: false,
        ended: false,
        completed: false,
        skipped: false,
      };
      const next = nextOccurrence(task);
      expect(next > today).toBe(true);
      // Deve ter dia ancorado como 15 (ou último dia do mês se mês curto)
      const nextDate = fromDateKey(next);
      expect(nextDate.getDate()).toBe(15);
    });
  });
});

describe("reviewDue", () => {
  const now = Date.parse("2026-10-25T12:00:00Z");
  it("só convida depois de 7 dias da última revisão ou do primeiro uso", () => {
    expect(reviewDue(undefined, now)).toBe(false);
    expect(reviewDue("2026-10-25T10:00:00Z", now)).toBe(false);
    expect(reviewDue("2026-10-19T12:00:00Z", now)).toBe(false);
    expect(reviewDue("2026-10-18T12:00:00Z", now)).toBe(true);
  });
});
