import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDemoAuthGateway,
  createDemoData,
  createDemoGateway,
} from "./mockGateway";
import type { AuthSession } from "./contracts";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-09T12:00:00Z"));
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

function requiredSession(value: AuthSession | null): AuthSession {
  if (!value) throw new Error("A demonstração deve entrar após o cadastro.");
  return value;
}

function gateways() {
  const data = createDemoData();
  return {
    data,
    admin: createDemoGateway(data),
    auth: createDemoAuthGateway(data),
  };
}

describe("autenticação da demonstração", () => {
  it("libera uma conta da lista e deixa criar a primeira casa", async () => {
    const { admin, auth, data } = gateways();
    await settle(admin.addAllowed("ana@example.test"));
    const account = requiredSession(await settle(
      auth.register({
        name: "Ana",
        email: "ANA@example.test",
        password: "casa tranquila",
      }),
    ));
    expect(account).toMatchObject({
      user: { name: "Ana", email: "ana@example.test" },
      memberships: [],
      canCreateHouse: true,
    });
    const home = await settle(auth.createHouse("Apê da Ana"));
    expect(home.memberships).toMatchObject([
      { householdName: "Apê da Ana", role: "responsavel" },
    ]);
    expect(data.households[0].name).toBe("Apê da Ana");
    await settle(auth.logout());
    expect(await settle(auth.session())).toBeNull();
    expect((await settle(auth.login("ana@example.test", "casa tranquila"))).user.name).toBe("Ana");
    await expect(
      settle(
        auth.register({
          name: "Outra Ana",
          email: "ana@example.test",
          password: "casa tranquila",
        }),
      ),
    ).rejects.toMatchObject({ code: "duplicado" });
  });

  it("vincula convite de morador à casa indicada, sem permitir criar outra", async () => {
    const { admin, auth, data } = gateways();
    const invite = (await settle(admin.access())).invitations.find(
      (item) => item.email === "novo.morador@example.test",
    )!;
    const account = requiredSession(await settle(
      auth.register({
        name: "Nina",
        email: invite.email,
        password: "morar junto",
        invitationId: invite.id,
      }),
    ));
    expect(account).toMatchObject({
      memberships: [{ householdId: "casa-1", householdName: "Casa Girassol", role: "morador" }],
      canCreateHouse: false,
    });
    expect(data.invitations.find((item) => item.id === invite.id)?.status).toBe("aceito");
    await expect(settle(auth.createHouse("Outra casa"))).rejects.toMatchObject({
      code: "estado_invalido",
    });
  });

  it("soma autorização admin e convite de morador", async () => {
    const { admin, auth } = gateways();
    await settle(admin.addAllowed("novo.morador@example.test"));
    const invite = (await settle(admin.access())).invitations.find(
      (item) => item.email === "novo.morador@example.test",
    )!;
    const account = requiredSession(await settle(
      auth.register({
        name: "Lia",
        email: invite.email,
        password: "casa tranquila",
        invitationId: invite.id,
      }),
    ));
    expect(account.canCreateHouse).toBe(true);
    expect((await settle(auth.createHouse("Casa da Lia"))).memberships).toHaveLength(2);
  });

  it("usa convite da equipe para liberar cadastro e criação de casa", async () => {
    const { admin, auth, data } = gateways();
    const invite = (await settle(admin.access())).invitations.find(
      (item) => item.email === "novo.admin@example.test",
    )!;
    const account = requiredSession(await settle(
      auth.register({
        name: "Rafa",
        email: invite.email,
        password: "casa tranquila",
      }),
    ));
    expect(account.canCreateHouse).toBe(true);
    expect(data.invitations.find((item) => item.id === invite.id)?.status).toBe("aceito");
  });

  it("barra convite vencido, e-mail divergente e e-mail sem liberação", async () => {
    const { admin, auth } = gateways();
    const invites = (await settle(admin.access())).invitations;
    const residentInvite = invites.find(
      (item) => item.email === "novo.morador@example.test",
    )!;
    const expiredInvite = invites.find(
      (item) => item.email === "convite.vencido@example.test",
    )!;
    await expect(
      settle(
        auth.register({
          name: "Outra pessoa",
          email: "outra@example.test",
          password: "casa tranquila",
          invitationId: residentInvite.id,
        }),
      ),
    ).rejects.toThrow("enviado para outro e-mail");
    await expect(
      settle(
        auth.register({
          name: "Pessoa",
          email: expiredInvite.email,
          password: "casa tranquila",
          invitationId: expiredInvite.id,
        }),
      ),
    ).rejects.toThrow("não está mais válido");
    await expect(
      settle(
        auth.register({
          name: "Sem acesso",
          email: "sem.acesso@example.test",
          password: "casa tranquila",
        }),
      ),
    ).rejects.toThrow("ainda não tem acesso");
  });

  it("barra convite revogado", async () => {
    const { admin, auth } = gateways();
    const invite = (await settle(admin.access())).invitations.find(
      (item) => item.email === "novo.morador@example.test",
    )!;
    await settle(admin.revokeInvite(invite.id));
    await expect(
      settle(
        auth.register({
          name: "Nina",
          email: invite.email,
          password: "morar junto",
          invitationId: invite.id,
        }),
      ),
    ).rejects.toThrow("não está mais válido");
  });

  it("redefine senha por link temporário e de uso único", async () => {
    const { admin, auth } = gateways();
    await settle(admin.addAllowed("bia@example.test"));
    await settle(
      auth.register({
        name: "Bia",
        email: "bia@example.test",
        password: "senha antiga",
      }),
    );
    await settle(auth.logout());
    expect(await settle(auth.requestPasswordReset("desconhecida@example.test"))).toBeUndefined();
    const resetPath = await settle(auth.requestPasswordReset("BIA@example.test"));
    expect(resetPath).toMatch(/^\/redefinir-senha\?token=/);
    const token = new URLSearchParams(resetPath!.split("?")[1]).get("token")!;
    await settle(auth.resetPassword(token, "senha nova"));
    expect((await settle(auth.login("bia@example.test", "senha nova"))).user.name).toBe("Bia");
    await expect(settle(auth.resetPassword(token, "mais uma senha"))).rejects.toThrow(
      "expirou ou já foi usado",
    );
    await settle(auth.logout());
    const expiringPath = await settle(auth.requestPasswordReset("bia@example.test"));
    const expiringToken = new URLSearchParams(expiringPath!.split("?")[1]).get("token")!;
    vi.advanceTimersByTime(30 * 60_000 + 1);
    await expect(settle(auth.resetPassword(expiringToken, "senha nova"))).rejects.toThrow(
      "expirou ou já foi usado",
    );
  });
});
