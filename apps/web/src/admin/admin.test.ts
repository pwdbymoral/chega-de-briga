import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateAnalytics } from "./analytics";
import { createDemoData, createDemoGateway, DemoError } from "./mockGateway";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-09T12:00:00Z"));
  sessionStorage.clear();
});
afterEach(() => vi.useRealTimers());
const settle = async <T>(promise: Promise<T>) => {
  const handled = promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await vi.runAllTimersAsync();
  const result = await handled;
  if ("error" in result) throw result.error;
  return result.value;
};

describe("contrato da demonstração", () => {
  it("guarda somente o indicador de sessão", async () => {
    const gateway = createDemoGateway();
    await settle(gateway.login("admin@exemplo.test", "demonstracao"));
    expect(sessionStorage.getItem("cdb-admin-demo")).toBe("1");
    expect(JSON.stringify(sessionStorage)).not.toContain("demonstracao");
    expect(await settle(gateway.session())).toBe(true);
    await settle(gateway.logout());
    expect(await settle(gateway.session())).toBe(false);
  });

  it("impede duplicação de e-mail e perda do último responsável", async () => {
    const gateway = createDemoGateway();
    await expect(
      settle(
        gateway.updateUser("pessoa-1-1", {
          name: "Júlia",
          email: "morador2-1@example.test",
        }),
      ),
    ).rejects.toMatchObject({ code: "duplicado" } satisfies Partial<DemoError>);
    await expect(
      settle(gateway.setMembershipRole("pessoa-2-1", "casa-2", "morador")),
    ).rejects.toMatchObject({
      code: "ultimo_responsavel",
    } satisfies Partial<DemoError>);
    await expect(
      settle(gateway.setUserStatus("pessoa-2-1", "suspenso")),
    ).rejects.toMatchObject({
      code: "ultimo_responsavel",
    } satisfies Partial<DemoError>);
    await settle(
      gateway.setMembershipRole("pessoa-2-2", "casa-2", "responsavel"),
    );
    await settle(gateway.setMembershipRole("pessoa-2-1", "casa-2", "morador"));
    expect((await settle(gateway.user("pessoa-2-1"))).memberships[0].role).toBe(
      "morador",
    );
  });

  it("mantém contas criadas após revogar autorização e renova convite por sete dias", async () => {
    const gateway = createDemoGateway();
    const before = await settle(gateway.access());
    const entry = before.allowlist.find(
      (item) => item.email === "morador1-1@example.test",
    )!;
    await settle(gateway.revokeAllowed(entry.id));
    expect((await settle(gateway.user("pessoa-1-1"))).user.status).toBe(
      "ativo",
    );
    const oldInvite = before.invitations.find(
      (item) => item.email === "novo.morador@example.test",
    )!;
    await settle(gateway.resendInvite(oldInvite.id));
    const after = await settle(gateway.access());
    const replacement = after.invitations.find(
      (item) => item.email === oldInvite.email && item.status === "pendente",
    )!;
    expect(replacement.source).toBe("convite_morador");
    expect(replacement.householdId).toBe("casa-1");
    expect(
      Date.parse(replacement.expiresAt) - Date.parse(replacement.createdAt),
    ).toBe(7 * 86_400_000);
  });

  it("preserva a coorte de acesso quando uma pessoa muda de e-mail", async () => {
    const data = createDemoData();
    const gateway = createDemoGateway(data);
    const filter = {
      period: 30 as const,
      source: "lista" as const,
      size: "todos" as const,
    };
    const before = calculateAnalytics(data, filter, new Date()).people[1].count;
    await settle(
      gateway.updateUser("pessoa-1-1", {
        name: "Júlia",
        email: "novo.endereco@example.test",
      }),
    );
    expect(calculateAnalytics(data, filter, new Date()).people[1].count).toBe(
      before,
    );
  });

  it("retira a conta excluída da lista e anonimiza o perfil fictício", async () => {
    const data = createDemoData();
    const gateway = createDemoGateway(data);
    const before = (await settle(gateway.users({ search: "", status: "todos", page: 1 }))).total;
    await settle(gateway.setUserStatus("pessoa-2-2", "excluido"));
    expect((await settle(gateway.users({ search: "", status: "todos", page: 1 }))).total).toBe(before - 1);
    expect(data.users.find((user) => user.id === "pessoa-2-2")).toMatchObject({ name: "Pessoa excluída", status: "excluido" });
  });
});

describe("métricas agregadas", () => {
  it("usa funis separados e só calcula retenção de coortes maduras", () => {
    const data = createDemoData();
    const metrics = calculateAnalytics(
      data,
      { period: 90, source: "todos", size: "todos" },
      new Date(),
    );
    expect(metrics.people[0].denominator).toBe(metrics.people[0].count);
    expect(metrics.people[1].denominator).toBe(metrics.people[0].count);
    expect(metrics.activation[1].denominator).toBe(metrics.activation[0].count);
    expect(metrics.activation[0].count).toBeGreaterThan(0);
    expect(
      metrics.cohorts.some(
        (row) => row.week4Denominator === 0 && row.week4 === undefined,
      ),
    ).toBe(true);
    expect(
      metrics.weeklyActive.every((row) => row.houses <= row.denominator),
    ).toBe(true);
  });

  it("não deixa conteúdo de tarefas nem identificadores pessoais no agregado", () => {
    const metrics = calculateAnalytics(
      createDemoData(),
      { period: 30, source: "convite_morador", size: "2" },
      new Date(),
    );
    const serialized = JSON.stringify(metrics);
    expect(serialized).not.toContain("@example.test");
    expect(serialized).not.toContain("pessoa-");
    expect(metrics.overdueOpen).toBeLessThanOrEqual(metrics.tasksOpen);
  });
});
