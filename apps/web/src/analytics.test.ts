import { describe, expect, it } from "vitest";
import { calculateAnalytics, type AnalyticsDataSet } from "../../domain/src/analytics";

describe("product activation analytics", () => {
  it("keeps first value separate from the collaboration funnel and counts shopping activity", () => {
    const now = new Date("2026-10-12T12:00:00.000Z");
    const data: AnalyticsDataSet = {
      users: [
        { id: "u1", email: "one@example.test", status: "ativo", source: "lista", accessId: "g1", createdAt: "2026-09-20T00:00:00.000Z" },
        { id: "u2", email: "two@example.test", status: "ativo", source: "convite_morador", accessId: "g2", createdAt: "2026-09-20T00:00:00.000Z" },
      ],
      households: [
        { id: "h1", name: "Casa 1", createdAt: "2026-09-20T00:00:00.000Z", firstValueAt: "2026-09-21T00:00:00.000Z" },
        { id: "h2", name: "Casa 2", createdAt: "2026-09-21T00:00:00.000Z", firstValueAt: "2026-10-01T00:00:00.000Z" },
        { id: "h3", name: "Casa nova", createdAt: "2026-10-08T00:00:00.000Z", firstValueAt: "2026-10-09T00:00:00.000Z" },
      ],
      memberships: [
        { userId: "u1", householdId: "h1", joinedAt: "2026-09-20T00:00:00.000Z" },
        { userId: "u2", householdId: "h1", joinedAt: "2026-09-21T00:00:00.000Z" },
      ],
      allowlist: [],
      invitations: [],
      tasks: [],
      activity: [{ id: "e1", householdId: "h1", type: "item_compra_adicionado", at: "2026-10-10T00:00:00.000Z" }],
    };
    const result = calculateAnalytics(data, { period: 30, source: "todos", size: "todos" }, now);

    expect(result.sampleHouses).toBe(2);
    expect(result.firstValue).toEqual([
      { label: "Casa com 7 dias completos", count: 2, denominator: 2 },
      { label: "Tarefa, rotina ou compra em até 7 dias", count: 1, denominator: 2 },
    ]);
    expect(result.activation.map((step) => step.count)).toEqual([2, 1, 0, 0]);
    expect(result.weeklyActive.reduce((sum, week) => sum + week.houses, 0)).toBeGreaterThan(0);
  });
});
