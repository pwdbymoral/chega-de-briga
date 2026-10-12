import { describe, expect, it } from "vitest";
import { mergeHouseData } from "./localCache";
import type { HouseData } from "./ResidentModel";

function sampleHouseData(): HouseData {
  return {
    members: [
      { id: "m-1", name: "Júlia", role: "responsavel" },
      { id: "m-2", name: "Caio", role: "morador" },
    ],
    tasks: [
      {
        id: "t-1",
        title: "Lavar a louça",
        dueDate: "2026-10-12",
        repeat: "daily",
        weeklyDays: [],
        anchorDay: 12,
        ownerMode: "fixed",
        assigneeId: "m-1",
        rotation: [],
        rotationIndex: 0,
        completionScope: "Louça do dia a dia",
        activeTime: "16–45 min",
        paused: false,
        ended: false,
        completed: false,
        skipped: false,
      },
    ],
    items: [
      { id: "i-1", name: "Detergente", quantity: "1 frasco", priority: "next" },
    ],
    invites: [],
  };
}

describe("localCache - mergeHouseData", () => {
  it("mescla alterações locais sem conflito quando shared não mudou", () => {
    const base = sampleHouseData();
    const shared = sampleHouseData();
    const local: HouseData = {
      ...base,
      tasks: [
        {
          ...base.tasks[0],
          title: "Lavar a louça do jantar",
        },
      ],
      items: [
        ...base.items,
        { id: "i-2", name: "Esponja", quantity: "2 unidades", priority: "next" },
      ],
    };

    const result = mergeHouseData(base, local, shared);
    expect(result.conflicts).toHaveLength(0);
    expect(result.data.tasks[0]?.title).toBe("Lavar a louça do jantar");
    expect(result.data.items).toHaveLength(2);
    expect(result.data.items.some((item) => item.name === "Esponja")).toBe(true);
  });

  it("mescla alterações do servidor (shared) quando local não mudou", () => {
    const base = sampleHouseData();
    const local = sampleHouseData();
    const shared: HouseData = {
      ...base,
      tasks: [
        {
          ...base.tasks[0],
          title: "Lavar toda a louça",
        },
      ],
      items: [
        { id: "i-1", name: "Detergente", quantity: "2 frascos", priority: "before" },
      ],
    };

    const result = mergeHouseData(base, local, shared);
    expect(result.conflicts).toHaveLength(0);
    expect(result.data.tasks[0]?.title).toBe("Lavar toda a louça");
    expect(result.data.items[0]?.quantity).toBe("2 frascos");
    expect(result.data.items[0]?.priority).toBe("before");
  });

  it("detecta conflito quando local e shared editam a mesma tarefa diferentemente", () => {
    const base = sampleHouseData();
    const local: HouseData = {
      ...base,
      tasks: [
        {
          ...base.tasks[0],
          title: "Louça — versão local",
        },
      ],
    };
    const shared: HouseData = {
      ...base,
      tasks: [
        {
          ...base.tasks[0],
          title: "Louça — versão compartilhada",
        },
      ],
    };

    const result = mergeHouseData(base, local, shared);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.key).toBe("task:t-1");
    // Por padrão (sem escolha explícita), mantém a versão compartilhada
    expect(result.data.tasks[0]?.title).toBe("Louça — versão compartilhada");
  });

  it("aplica a escolha do usuário para resolver conflito", () => {
    const base = sampleHouseData();
    const local: HouseData = {
      ...base,
      tasks: [{ ...base.tasks[0], title: "Louça — versão local" }],
    };
    const shared: HouseData = {
      ...base,
      tasks: [{ ...base.tasks[0], title: "Louça — versão compartilhada" }],
    };

    const resolvedLocal = mergeHouseData(base, local, shared, { "task:t-1": "local" });
    expect(resolvedLocal.data.tasks[0]?.title).toBe("Louça — versão local");

    const resolvedShared = mergeHouseData(base, local, shared, { "task:t-1": "shared" });
    expect(resolvedShared.data.tasks[0]?.title).toBe("Louça — versão compartilhada");
  });

  it("remove item localmente se apagado e não alterado no servidor", () => {
    const base = sampleHouseData();
    const shared = sampleHouseData();
    const local: HouseData = {
      ...base,
      items: [], // removeu o detergente
    };

    const result = mergeHouseData(base, local, shared);
    expect(result.conflicts).toHaveLength(0);
    expect(result.data.items).toHaveLength(0);
  });

  it("unifica itens de compras duplicados com nomes equivalentes (case-insensitive)", () => {
    const base = sampleHouseData();
    const local: HouseData = {
      ...base,
      items: [
        ...base.items,
        { id: "i-local-milk", name: "  Leite Integral ", quantity: "1L", priority: "next" },
      ],
    };
    const shared: HouseData = {
      ...base,
      items: [
        ...base.items,
        { id: "i-shared-milk", name: "leite integral", quantity: "", priority: "before" },
      ],
    };

    const result = mergeHouseData(base, local, shared);
    // Deve unificar os leites e herdar a prioridade mais alta (before) e a quantidade informada (1L)
    const milkItems = result.data.items.filter((item) => item.name.toLowerCase().includes("leite"));
    expect(milkItems).toHaveLength(1);
    expect(milkItems[0]?.priority).toBe("before");
    expect(milkItems[0]?.quantity).toBe("1L");
  });
});
