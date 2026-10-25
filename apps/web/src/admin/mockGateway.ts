import { calculateAnalytics } from "./analytics";
import type {
  AccessSource,
  AdminGateway,
  AllowEntry,
  AuthGateway,
  AuthSession,
  DataSet,
  HouseholdRole,
  Invitation,
  InvitationPreview,
  WaitlistAnalytics,
  WaitlistEntry,
  UserStatus,
  TaskHistoryEntry,
  WeeklyReviewAnswers,
  WeeklyReviewEntry,
} from "./contracts";
import { makeHouseData, type HouseData } from "../resident/ResidentModel";

const DAY = 86_400_000;
const stamp = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * DAY).toISOString();
const emailKey = (email: string) => email.trim().toLocaleLowerCase("pt-BR");
const names = [
  "Júlia",
  "Caio",
  "Lia",
  "Rafa",
  "Bia",
  "Noah",
  "Nina",
  "Davi",
  "Iara",
  "Léo",
  "Tina",
  "Theo",
];
const places = [
  "Girassol",
  "Pitangueira",
  "Azul",
  "Festa",
  "Sol",
  "Maré",
  "Quintal",
  "Sossego",
];
let nextId = 1;
const id = (prefix: string) => `${prefix}-${nextId++}`;

export class DemoError extends Error {
  constructor(
    public code:
      | "credenciais"
      | "duplicado"
      | "ultimo_responsavel"
      | "nao_encontrado"
      | "estado_invalido",
    message: string,
  ) {
    super(message);
  }
}

export function createDemoData(): DataSet {
  nextId = 1;
  const data: DataSet = {
    users: [],
    households: [],
    memberships: [],
    allowlist: [],
    invitations: [],
    tasks: [],
    activity: [],
    audit: [],
  };
  for (let index = 0; index < 24; index++) {
    const age = 3 + index * 3;
    const houseId = `casa-${index + 1}`;
    data.households.push({
      id: houseId,
      name: `Casa ${places[index % places.length]} ${Math.floor(index / places.length) || ""}`.trim(),
      createdAt: stamp(age),
      firstValueAt: index % 4 ? stamp(age - 1) : undefined,
    });
    const count = index % 5 === 0 ? 1 : index % 3 === 0 ? 3 : 2;
    for (let person = 0; person < count; person++) {
      const userId = `pessoa-${index + 1}-${person + 1}`;
      const email = `morador${index + 1}-${person + 1}@example.test`;
      const source =
        person === 0
          ? "lista"
          : person === 1
            ? "convite_morador"
            : "convite_admin";
      const accessId = id(source === "lista" ? "lista" : "convite");
      const createdAt = stamp(age - 0.5 - person * 0.2);
      data.users.push({
        id: userId,
        name: `${names[(index + person) % names.length]} ${places[index % places.length]}`,
        email,
        status: index === 14 && person === 1 ? "suspenso" : "ativo",
        source,
        accessId,
        createdAt,
        lastSeenAt: stamp(Math.max(0.25, age % 11)),
      });
      data.memberships.push({
        userId,
        householdId: houseId,
        role: person === 0 ? "responsavel" : "morador",
        joinedAt: createdAt,
      });
      if (source === "lista")
        data.allowlist.push({ id: accessId, email, addedAt: stamp(age + 1) });
      else
        data.invitations.push({
          id: accessId,
          email,
          source,
          householdId: houseId,
          inviterId:
            source === "convite_morador" ? `pessoa-${index + 1}-1` : undefined,
          status: "aceito",
          createdAt: stamp(age + 1),
          expiresAt: stamp(age - 6),
          acceptedAt: createdAt,
        });
      data.activity.push({
        id: id("evento"),
        userId,
        type: "conta_criada",
        at: createdAt,
      });
      data.activity.push({
        id: id("evento"),
        userId,
        householdId: houseId,
        type: "entrada_casa",
        at: createdAt,
      });
      if (person === 0)
        data.activity.push({
          id: id("evento"),
          userId,
          householdId: houseId,
          type: "acesso",
          at: stamp(Math.max(0.25, age % 11)),
        });
    }
    if (index % 4 !== 0) {
      const createdAt = stamp(age - 1);
      const completedAt = index % 3 !== 1 ? stamp(age - 2) : undefined;
      data.tasks.push({
        id: id("tarefa"),
        householdId: houseId,
        createdAt,
        dueAt: stamp(age - 4),
        completedAt,
      });
      data.activity.push({
        id: id("evento"),
        householdId: houseId,
        type: "tarefa_criada",
        at: createdAt,
      });
      if (completedAt)
        data.activity.push({
          id: id("evento"),
          householdId: houseId,
          type: "tarefa_concluida",
          at: completedAt,
        });
      if (age > 14 && index % 2 === 0) {
        const at = stamp(age - 9);
        data.tasks.push({
          id: id("tarefa"),
          householdId: houseId,
          createdAt: at,
          dueAt: stamp(age - 7),
        });
        data.activity.push({
          id: id("evento"),
          householdId: houseId,
          type: "tarefa_criada",
          at,
        });
      }
      if (age > 35 && index % 3 === 0) {
        const at = stamp(age - 30);
        data.tasks.push({
          id: id("tarefa"),
          householdId: houseId,
          createdAt: stamp(age - 31),
          dueAt: stamp(age - 29),
          completedAt: at,
        });
        data.activity.push({
          id: id("evento"),
          householdId: houseId,
          type: "tarefa_criada",
          at: stamp(age - 31),
        });
        data.activity.push({
          id: id("evento"),
          householdId: houseId,
          type: "tarefa_concluida",
          at,
        });
      }
    }
    if (index % 6 === 0) {
      data.tasks.push({
        id: id("tarefa"),
        householdId: houseId,
        createdAt: stamp(1),
        dueAt: stamp(-3),
      });
      data.activity.push({
        id: id("evento"),
        householdId: houseId,
        type: "tarefa_criada",
        at: stamp(1),
      });
    }
  }
  data.allowlist.push({
    id: id("lista"),
    email: "aguardando.lista@example.test",
    addedAt: stamp(2),
  });
  data.invitations.push({
    id: id("convite"),
    email: "novo.morador@example.test",
    source: "convite_morador",
    householdId: "casa-1",
    inviterId: "pessoa-1-1",
    status: "pendente",
    createdAt: stamp(2),
    expiresAt: stamp(-5),
  });
  data.invitations.push({
    id: id("convite"),
    email: "novo.admin@example.test",
    source: "convite_admin",
    status: "pendente",
    createdAt: stamp(1),
    expiresAt: stamp(-6),
  });
  data.invitations.push({
    id: id("convite"),
    email: "convite.vencido@example.test",
    source: "convite_admin",
    status: "expirado",
    createdAt: stamp(12),
    expiresAt: stamp(5),
  });
  return data;
}

export function createDemoGateway(data = createDemoData()): AdminGateway {
  const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 90));
  const demoWaitlist: WaitlistEntry[] = [
    { id: "lead-demo-1", channel: "email", contact: "julia@example.test", createdAt: stamp(1), utmSource: "instagram", utmCampaign: "casa-compartilhada" },
    { id: "lead-demo-2", channel: "whatsapp", contact: "+5511999990001", createdAt: stamp(2), utmSource: "instagram", utmCampaign: "casa-compartilhada" },
    { id: "lead-demo-3", channel: "email", contact: "caio@example.test", createdAt: stamp(4), utmSource: "newsletter", utmCampaign: "rotina-leve" },
  ];
  const findUser = (userId: string) => {
    const user = data.users.find(
      (item) => item.id === userId && item.status !== "excluido",
    );
    if (!user) throw new DemoError("nao_encontrado", "Pessoa não encontrada.");
    return user;
  };
  const findInvite = (inviteId: string) => {
    const invite = data.invitations.find((item) => item.id === inviteId);
    if (!invite)
      throw new DemoError("nao_encontrado", "Convite não encontrado.");
    return invite;
  };
  const audit = (action: string, targetId: string) =>
    data.audit.unshift({
      id: id("auditoria"),
      action,
      targetId,
      at: new Date().toISOString(),
    });
  const canRemoveOwner = (userId: string) => {
    for (const membership of data.memberships.filter(
      (item) => item.userId === userId && item.role === "responsavel",
    )) {
      if (
        !data.memberships.some(
          (item) =>
            item.householdId === membership.householdId &&
            item.userId !== userId &&
            item.role === "responsavel" &&
            data.users.some(
              (user) => user.id === item.userId && user.status === "ativo",
            ),
        )
      ) {
        throw new DemoError(
          "ultimo_responsavel",
          "Esta casa precisa de outra pessoa responsável antes desta mudança.",
        );
      }
    }
  };
  return {
    async login(email, password) {
      await pause();
      if (
        emailKey(email) !== "admin@exemplo.test" ||
        password !== "demonstracao"
      )
        throw new DemoError(
          "credenciais",
          "E-mail ou senha da demonstração incorretos.",
        );
      sessionStorage.setItem("cdb-admin-demo", "1");
      return "authenticated";
    },
    async verifyTotp() { throw new Error("A demonstração não usa código autenticador."); },
    async session() {
      await pause();
      return sessionStorage.getItem("cdb-admin-demo") === "1";
    },
    async logout() {
      await pause();
      sessionStorage.removeItem("cdb-admin-demo");
    },
    async users({ search, status, page }) {
      await pause();
      const term = search.trim().toLocaleLowerCase("pt-BR");
      const items = data.users
        .filter(
          (user) =>
            user.status !== "excluido" &&
            (status === "todos" || user.status === status) &&
            (!term ||
              `${user.name} ${user.email}`
                .toLocaleLowerCase("pt-BR")
                .includes(term)),
        )
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      const pages = Math.max(1, Math.ceil(items.length / 8));
      return {
        items: items.slice(
          (Math.min(page, pages) - 1) * 8,
          Math.min(page, pages) * 8,
        ),
        total: items.length,
        page: Math.min(page, pages),
        pages,
      };
    },
    async user(userId) {
      await pause();
      const user = findUser(userId);
      return {
        user: { ...user },
        memberships: data.memberships
          .filter((item) => item.userId === userId)
          .map((item) => ({ ...item })),
        activity: data.activity
          .filter((item) => item.userId === userId)
          .map((item) => ({ ...item }))
          .sort((a, b) => b.at.localeCompare(a.at)),
        audit: data.audit
          .filter((item) => item.targetId === userId)
          .map((item) => ({ ...item })),
      };
    },
    async updateUser(userId, patch) {
      await pause();
      const user = findUser(userId);
      const email = emailKey(patch.email);
      if (!patch.name.trim() || !/^\S+@\S+\.\S+$/.test(email))
        throw new DemoError(
          "estado_invalido",
          "Informe nome e e-mail válidos.",
        );
      if (
        data.users.some(
          (item) =>
            item.id !== userId &&
            item.status !== "excluido" &&
            item.email === email,
        )
      )
        throw new DemoError(
          "duplicado",
          "Já existe uma conta com este e-mail.",
        );
      user.name = patch.name.trim();
      user.email = email;
      audit("perfil atualizado", userId);
    },
    async setUserStatus(userId, status: UserStatus) {
      await pause();
      const user = findUser(userId);
      if (status !== "ativo") canRemoveOwner(userId);
      if (status === "excluido") {
        user.name = "Pessoa excluída";
        user.email = `excluido-${user.id}@example.invalid`;
        user.lastSeenAt = undefined;
      }
      user.status = status;
      audit(
        status === "excluido"
          ? "conta excluída na demo"
          : status === "suspenso"
            ? "conta suspensa"
            : "conta reativada",
        userId,
      );
    },
    async setMembershipRole(userId, householdId, role: HouseholdRole) {
      await pause();
      const user = findUser(userId);
      const member = data.memberships.find(
        (item) => item.userId === userId && item.householdId === householdId,
      );
      if (!member)
        throw new DemoError("nao_encontrado", "Vínculo não encontrado.");
      if (role === "responsavel" && user.status !== "ativo")
        throw new DemoError(
          "estado_invalido",
          "Reative a conta antes de atribuir o papel de responsável.",
        );
      if (member.role === "responsavel" && role !== "responsavel")
        canRemoveOwner(userId);
      member.role = role;
      audit("papel na casa alterado", userId);
    },
    async access() {
      await pause();
      const rank = { pendente: 0, expirado: 1, aceito: 2, revogado: 3 };
      return {
        allowlist: data.allowlist
          .map((item) => ({ ...item }))
          .sort(
            (a, b) =>
              Number(Boolean(a.revokedAt)) - Number(Boolean(b.revokedAt)) ||
              b.addedAt.localeCompare(a.addedAt),
          ),
        invitations: data.invitations
          .map((item) => ({
            ...item,
            status:
              item.status === "pendente" &&
              Date.parse(item.expiresAt) < Date.now()
                ? ("expirado" as const)
                : item.status,
          }))
          .sort(
            (a, b) =>
              rank[a.status] - rank[b.status] ||
              b.createdAt.localeCompare(a.createdAt),
          ),
      };
    },
    async addAllowed(emailValue) {
      await pause();
      const email = emailKey(emailValue);
      if (!/^\S+@\S+\.\S+$/.test(email))
        throw new DemoError("estado_invalido", "Informe um e-mail válido.");
      if (
        data.allowlist.some((item) => item.email === email && !item.revokedAt)
      )
        throw new DemoError("duplicado", "Este e-mail já está autorizado.");
      const entry: AllowEntry = {
        id: id("lista"),
        email,
        addedAt: new Date().toISOString(),
      };
      data.allowlist.unshift(entry);
      audit("autorização criada", entry.id);
    },
    async revokeAllowed(entryId) {
      await pause();
      const entry = data.allowlist.find((item) => item.id === entryId);
      if (!entry)
        throw new DemoError("nao_encontrado", "Autorização não encontrada.");
      if (entry.revokedAt)
        throw new DemoError(
          "estado_invalido",
          "Esta autorização já foi revogada.",
        );
      entry.revokedAt = new Date().toISOString();
      audit("autorização revogada", entryId);
    },
    async invite(emailValue, householdId) {
      await pause();
      const email = emailKey(emailValue);
      if (!/^\S+@\S+\.\S+$/.test(email))
        throw new DemoError("estado_invalido", "Informe um e-mail válido.");
      if (
        householdId &&
        !data.households.some((house) => house.id === householdId)
      )
        throw new DemoError("nao_encontrado", "Casa não encontrada.");
      if (
        data.invitations.some(
          (item) =>
            item.email === email &&
            item.householdId === householdId &&
            item.status === "pendente" &&
            Date.parse(item.expiresAt) > Date.now(),
        )
      )
        throw new DemoError(
          "duplicado",
          "Já há um convite válido para este e-mail e esta casa.",
        );
      const invitation: Invitation = {
        id: id("convite"),
        email,
        source: "convite_admin",
        householdId,
        status: "pendente",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * DAY).toISOString(),
      };
      data.invitations.unshift(invitation);
      audit("convite criado", invitation.id);
    },
    async revokeInvite(inviteId) {
      await pause();
      const invite = findInvite(inviteId);
      if (
        invite.status !== "pendente" ||
        Date.parse(invite.expiresAt) < Date.now()
      )
        throw new DemoError(
          "estado_invalido",
          "Só convites pendentes podem ser revogados.",
        );
      invite.status = "revogado";
      audit("convite revogado", inviteId);
    },
    async resendInvite(inviteId) {
      await pause();
      const invite = findInvite(inviteId);
      if (invite.status === "aceito")
        throw new DemoError("estado_invalido", "Este convite já foi aceito.");
      invite.status = "revogado";
      const replacement: Invitation = {
        ...invite,
        id: id("convite"),
        status: "pendente",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * DAY).toISOString(),
        acceptedAt: undefined,
      };
      data.invitations.unshift(replacement);
      audit("convite reenviado", replacement.id);
    },
    async households() {
      await pause();
      return data.households
        .map((item) => ({ ...item }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async household(houseId) {
      await pause();
      const household = data.households.find((item) => item.id === houseId);
      if (!household)
        throw new DemoError("nao_encontrado", "Casa não encontrada.");
      const memberships = data.memberships.filter(
        (item) =>
          item.householdId === houseId &&
          data.users.some(
            (user) => user.id === item.userId && user.status !== "excluido",
          ),
      );
      return {
        household: { ...household },
        memberships: memberships.map((item) => ({ ...item })),
        members: data.users
          .filter((user) => memberships.some((item) => item.userId === user.id))
          .map((item) => ({ ...item })),
        tasks: data.tasks
          .filter((task) => task.householdId === houseId)
          .map((task) => ({ ...task })),
        activity: data.activity
          .filter((event) => event.householdId === houseId)
          .map((item) => ({ ...item }))
          .sort((a, b) => b.at.localeCompare(a.at)),
      };
    },
    async analytics(filter) {
      await pause();
      return calculateAnalytics(data, filter);
    },
    async waitlistAnalytics(period): Promise<WaitlistAnalytics> {
      await pause();
      const days = Array.from({ length: period + 1 }, (_, index) => ({
        date: new Date(Date.now() - (period - index) * DAY).toISOString().slice(0, 10),
        pageLoads: index === period - 1 ? 22 : index === period ? 18 : 4,
        formStarts: index === period - 1 ? 9 : index === period ? 7 : 1,
        signups: index === period - 1 ? 3 : index === period ? 2 : 0,
      }));
      return {
        period,
        signupEnabled: false,
        from: stamp(period),
        to: new Date().toISOString(),
        pageLoads: 212,
        formStarts: 76,
        signups: 24,
        conversion: 24 / 212,
        bySource: [
          { source: "google", pageLoads: 110, guideViews: 80, formStarts: 40, signups: 14, conversion: 14 / 110 },
          { source: "chatgpt", pageLoads: 60, guideViews: 30, formStarts: 24, signups: 7, conversion: 7 / 60 },
          { source: "direct_unknown", pageLoads: 42, guideViews: 10, formStarts: 12, signups: 3, conversion: 3 / 42 },
        ],
        byGuide: [{ page: "tasks_guide", views: 75 }, { page: "shopping_guide", views: 45 }],
        byChannel: [{ channel: "email", count: 16 }, { channel: "whatsapp", count: 8 }],
        byCampaign: [
          { campaign: "casa-compartilhada", pageLoads: 106, formStarts: 43, signups: 15 },
          { campaign: "rotina-leve", pageLoads: 64, formStarts: 21, signups: 6 },
          { campaign: "Sem campanha", pageLoads: 42, formStarts: 12, signups: 3 },
        ],
        daily: days,
        publicFunnel: [],
      };
    },
    async waitlist({ search, channel, campaign, page }) {
      await pause();
      const term = search.trim().toLocaleLowerCase("pt-BR");
      const filtered = demoWaitlist.filter((entry) =>
        (channel === "todos" || entry.channel === channel) &&
        (!campaign || entry.utmCampaign === campaign) &&
        (!term || [entry.contact, entry.utmSource, entry.utmMedium, entry.utmCampaign].some((value) => value?.toLocaleLowerCase("pt-BR").includes(term))),
      );
      const pageSize = 10;
      return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pages: Math.max(1, Math.ceil(filtered.length / pageSize)) };
    },
    async deleteWaitlistEntry(entryId) {
      await pause();
      const index = demoWaitlist.findIndex((entry) => entry.id === entryId);
      if (index < 0) throw new DemoError("nao_encontrado", "Contato não encontrado.");
      demoWaitlist.splice(index, 1);
    },
  };
}

export function createDemoAuthGateway(data: DataSet): AuthGateway {
  const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 90));
  const passwords = new Map<string, string>();
  const createHousePermissions = new Map<string, boolean>();
  const resetTokens = new Map<string, { userId: string; expiresAt: number }>();
  const houseStates = new Map<string, { version: number; data: HouseData }>();
  const firstValueAtByHouse = new Map<string, string>();
  const taskHistories = new Map<string, Map<string, TaskHistoryEntry[]>>();
  const weeklyReviews = new Map<string, WeeklyReviewEntry[]>();
  const historyFor = (householdId: string, taskId: string) => {
    let house = taskHistories.get(householdId);
    if (!house) { house = new Map(); taskHistories.set(householdId, house); }
    let list = house.get(taskId);
    if (!list) { list = []; house.set(taskId, list); }
    return list;
  };
  let currentUserId: string | undefined;
  const activeInvite = (invite: Invitation) =>
    invite.status === "pendente" && Date.parse(invite.expiresAt) > Date.now();
  const sessionFor = (userId: string): AuthSession => {
    const user = data.users.find((item) => item.id === userId);
    if (!user || user.status !== "ativo")
      throw new DemoError("credenciais", "E-mail ou senha incorretos.");
    return {
      user: { id: user.id, name: user.name, email: user.email },
      memberships: data.memberships
        .filter((item) => item.userId === userId)
        .map((item) => ({
          householdId: item.householdId,
          householdName:
            data.households.find((house) => house.id === item.householdId)
              ?.name ?? "Casa",
          role: item.role,
        })),
      canCreateHouse: createHousePermissions.get(userId) ?? false,
    };
  };
  const lookupInvitation = (inviteId: string): Invitation => {
    const invite = data.invitations.find((item) => item.id === inviteId);
    if (!invite)
      throw new DemoError("nao_encontrado", "Convite não encontrado.");
    return invite;
  };
  const validInvitation = (invite: Invitation) => {
    if (invite.status !== "pendente" || Date.parse(invite.expiresAt) <= Date.now())
      throw new DemoError(
        "estado_invalido",
        "Este convite não está mais válido. Peça um novo acesso.",
      );
  };

  return {
    residents: {
      async loadHousehold(householdId) {
        await pause();
        let snapshot = houseStates.get(householdId);
        if (!snapshot) {
          const membership = data.memberships.find((item) => item.householdId === householdId);
          const user = membership ? sessionFor(membership.userId).user : { id: "demo", name: "Morador", email: "demo@example.test" };
          snapshot = { version: 1, data: makeHouseData(householdId, user, membership?.role ?? "responsavel") };
          houseStates.set(householdId, snapshot);
        }
        return snapshot;
      },
      async saveHousehold(householdId, version, next, events = []) {
        await pause();
        const current = houseStates.get(householdId);
        if (current && current.version !== version) throw new DemoError("estado_invalido", "Os dados mudaram em outro dispositivo.");
        houseStates.set(householdId, { version: version + 1, data: next });
        const actorId = currentUserId ?? "demo";
        const occurredAt = new Date().toISOString();
        if (!firstValueAtByHouse.has(householdId) && events.some((event) => event.type === "tarefa_criada" || event.type === "item_compra_adicionado")) {
          firstValueAtByHouse.set(householdId, occurredAt);
        }
        for (const event of events) {
          if (event.type === "item_compra_adicionado") continue;
          const task = next.tasks.find((item) => item.id === event.taskId);
          const list = historyFor(householdId, event.taskId);
          if (event.type === "tarefa_concluida" || event.type === "tarefa_pulada") {
            const owner = task?.ownerMode === "rotation" && task.rotation.length
              ? task.rotation[Number(task.rotationIndex ?? 0) % task.rotation.length]
              : task?.ownerMode === "fixed" ? task.assigneeId : undefined;
            list.unshift({ kind: "occurrence", occurredAt, outcome: event.type === "tarefa_concluida" ? "concluida" : "pulada", assignedUserId: owner ?? null, completedByUserId: actorId, scope: null, changedBy: null, eventType: event.type, note: null });
          } else {
            list.unshift({ kind: "version", occurredAt, outcome: null, assignedUserId: null, completedByUserId: null, scope: event.scope ?? "series", changedBy: actorId, eventType: event.type, note: event.note ?? null });
          }
        }
        return { version: version + 1 };
      },
      async fetchTaskHistory(householdId, taskId) {
        await pause();
        const members = data.memberships
          .filter((membership) => membership.householdId === householdId)
          .map((membership) => ({ id: membership.userId, name: data.users.find((user) => user.id === membership.userId)?.name ?? "Morador" }));
        return { entries: historyFor(householdId, taskId).slice(0, 50), members };
      },
      async submitWeeklyReview(householdId, answers: WeeklyReviewAnswers) {
        await pause();
        const list = weeklyReviews.get(householdId) ?? [];
        list.unshift({ ...answers, reviewedAt: new Date().toISOString() });
        weeklyReviews.set(householdId, list);
      },
      async fetchWeeklyReviews(householdId) {
        await pause();
        return (weeklyReviews.get(householdId) ?? []).slice(0, 20);
      },
      async updateProfileName(name) {
        await pause();
        const user = data.users.find((item) => item.id === currentUserId);
        if (user) user.name = name;
      },
      async exportAccount() { await pause(); return { demo: true }; },
      async deleteAccount() { await pause(); currentUserId = undefined; },
      async reminder() { await pause(); return { enabled: false, time: "08:00" }; },
      async saveReminder() { await pause(); },
      async reviewReminder() { await pause(); return { enabled: false }; },
      async saveReviewReminder() { await pause(); },
      async vapidPublicKey() { await pause(); return ""; },
      async savePushSubscription() { await pause(); },
      async removePushSubscription() { await pause(); },
      async renameHousehold(householdId, name) {
        await pause();
        const house = data.households.find((item) => item.id === householdId);
        if (house) house.name = name;
      },
      async inviteResident(householdId, emailValue) {
        await pause();
        const email = emailKey(emailValue);
        data.invitations.unshift({ id: id("convite"), email, source: "convite_morador", householdId, inviterId: currentUserId, status: "pendente", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * DAY).toISOString() });
      },
      async revokeInvitation(householdId, invitationId) {
        await pause();
        const invitation = data.invitations.find((item) => item.id === invitationId && item.householdId === householdId);
        if (invitation) invitation.status = "revogado";
      },
      async leaveHousehold(householdId) {
        await pause();
        if (currentUserId) data.memberships = data.memberships.filter((item) => !(item.userId === currentUserId && item.householdId === householdId));
        if (!currentUserId) throw new DemoError("credenciais", "Entre novamente.");
        return sessionFor(currentUserId);
      },
      async deleteHousehold(householdId) {
        await pause();
        data.households = data.households.filter((item) => item.id !== householdId);
        data.memberships = data.memberships.filter((item) => item.householdId !== householdId);
        houseStates.delete(householdId);
      },
      async removeMember(householdId, userId) {
        await pause();
        data.memberships = data.memberships.filter((item) => !(item.householdId === householdId && item.userId === userId));
      },
      async transferResponsibility(householdId, userId) {
        await pause();
        data.memberships = data.memberships.map((item) => item.householdId === householdId ? { ...item, role: item.userId === userId ? "responsavel" : item.userId === currentUserId ? "morador" : item.role } : item);
        if (!currentUserId) throw new DemoError("credenciais", "Entre novamente.");
        return sessionFor(currentUserId);
      },
    },
    async invitation(inviteId): Promise<InvitationPreview> {
      await pause();
      const invite = lookupInvitation(inviteId);
      const status =
        invite.status === "pendente" && Date.parse(invite.expiresAt) <= Date.now()
          ? "expirado"
          : invite.status;
      return {
        id: invite.id,
        email: invite.email,
        source: invite.source,
        householdName: data.households.find(
          (house) => house.id === invite.householdId,
        )?.name,
        status,
        expiresAt: invite.expiresAt,
      };
    },
    async register({
      name: nameValue,
      email: emailValue,
      password,
      invitationId,
    }) {
      await pause();
      const name = nameValue.trim();
      const email = emailKey(emailValue);
      if (!name || name.length > 100 || !/^\S+@\S+\.\S+$/.test(email))
        throw new DemoError("estado_invalido", "Confira seu nome e e-mail.");
      if (password.length < 8 || password.length > 128)
        throw new DemoError(
          "estado_invalido",
          "Use uma senha com pelo menos 8 caracteres.",
        );
      if (
        data.users.some(
          (user) =>
            user.status !== "excluido" && emailKey(user.email) === email,
        )
      )
        throw new DemoError("duplicado", "Já existe uma conta com este e-mail.");

      const invitation = invitationId
        ? lookupInvitation(invitationId)
        : data.invitations.find(
            (item) =>
              item.source === "convite_admin" &&
              emailKey(item.email) === email &&
              activeInvite(item),
          );
      if (invitation) {
        validInvitation(invitation);
        if (emailKey(invitation.email) !== email)
          throw new DemoError(
            "estado_invalido",
            "Este convite foi enviado para outro e-mail.",
          );
        if (invitation.source === "convite_morador" && !invitation.householdId)
          throw new DemoError(
            "estado_invalido",
            "Este convite não informa a casa. Peça um novo convite ao morador.",
          );
        if (
          invitation.householdId &&
          !data.households.some((house) => house.id === invitation.householdId)
        )
          throw new DemoError("nao_encontrado", "A casa do convite não existe.");
      }
      const allowed = data.allowlist.find(
        (entry) => emailKey(entry.email) === email && !entry.revokedAt,
      );
      const adminInvitation = data.invitations.find(
        (item) =>
          item.source === "convite_admin" &&
          emailKey(item.email) === email &&
          activeInvite(item),
      );
      const canCreateHouse = Boolean(allowed || adminInvitation);
      if (!invitation && !allowed)
        throw new DemoError(
          "estado_invalido",
          "Este e-mail ainda não tem acesso. Peça um convite ou liberação à equipe.",
        );
      const accessSource: AccessSource =
        invitation?.source ?? (adminInvitation ? "convite_admin" : "lista");
      const accessId = invitation?.id ?? adminInvitation?.id ?? allowed!.id;
      const userId = id("pessoa");
      const now = new Date().toISOString();
      const user = {
        id: userId,
        name,
        email,
        status: "ativo" as const,
        source: accessSource,
        accessId,
        createdAt: now,
        lastSeenAt: now,
      };
      data.users.unshift(user);
      data.activity.unshift({ id: id("evento"), userId, type: "conta_criada", at: now });
      if (invitation?.householdId) {
        data.memberships.push({
          userId,
          householdId: invitation.householdId,
          role: "morador",
          joinedAt: now,
        });
        data.activity.unshift({
          id: id("evento"),
          userId,
          householdId: invitation.householdId,
          type: "entrada_casa",
          at: now,
        });
      }
      if (invitation) {
        invitation.status = "aceito";
        invitation.acceptedAt = now;
      }
      passwords.set(userId, password);
      createHousePermissions.set(userId, canCreateHouse);
      currentUserId = userId;
      return sessionFor(userId);
    },
    async login(emailValue, password) {
      await pause();
      const email = emailKey(emailValue);
      const user = data.users.find(
        (item) => item.status !== "excluido" && emailKey(item.email) === email,
      );
      if (
        !user ||
        user.status !== "ativo" ||
        passwords.get(user.id) !== password
      )
        throw new DemoError("credenciais", "E-mail ou senha incorretos.");
      currentUserId = user.id;
      user.lastSeenAt = new Date().toISOString();
      data.activity.unshift({
        id: id("evento"),
        userId: user.id,
        type: "acesso",
        at: user.lastSeenAt,
      });
      return sessionFor(user.id);
    },
    async verifyEmail() {
      await pause();
      if (!currentUserId) throw new DemoError("credenciais", "Este link não é mais válido.");
      return sessionFor(currentUserId);
    },
    async session() {
      await pause();
      if (!currentUserId) return null;
      const user = data.users.find((item) => item.id === currentUserId);
      if (!user || user.status !== "ativo") {
        currentUserId = undefined;
        return null;
      }
      return sessionFor(user.id);
    },
    async logout() {
      await pause();
      currentUserId = undefined;
    },
    async requestPasswordReset(emailValue) {
      await pause();
      const email = emailKey(emailValue);
      const user = data.users.find(
        (item) =>
          item.status === "ativo" &&
          emailKey(item.email) === email &&
          passwords.has(item.id),
      );
      if (!user) return undefined;
      const token = id("redefinir");
      resetTokens.set(token, {
        userId: user.id,
        expiresAt: Date.now() + 30 * 60_000,
      });
      return `/redefinir-senha?token=${encodeURIComponent(token)}`;
    },
    async resetPassword(token, password) {
      await pause();
      const reset = resetTokens.get(token);
      if (!reset || reset.expiresAt <= Date.now())
        throw new DemoError(
          "estado_invalido",
          "Este link expirou ou já foi usado. Peça outro link de recuperação.",
        );
      if (password.length < 8 || password.length > 128)
        throw new DemoError(
          "estado_invalido",
          "Use uma senha com pelo menos 8 caracteres.",
        );
      passwords.set(reset.userId, password);
      resetTokens.delete(token);
    },
    async createHouse(nameValue) {
      await pause();
      const userId = currentUserId;
      if (!userId || !createHousePermissions.get(userId))
        throw new DemoError(
          "estado_invalido",
          "Só uma conta liberada pela equipe pode criar uma casa.",
        );
      const name = nameValue.trim();
      if (!name || name.length > 60)
        throw new DemoError(
          "estado_invalido",
          "Dê um nome de até 60 caracteres para a casa.",
        );
      const houseId = id("casa");
      const now = new Date().toISOString();
      data.households.unshift({ id: houseId, name, createdAt: now });
      const owner = data.users.find((user) => user.id === userId)!;
      houseStates.set(houseId, {
        version: 1,
        data: { members: [{ id: owner.id, name: owner.name, email: owner.email, role: "responsavel" }], tasks: [], items: [], invites: [] },
      });
      data.memberships.push({
        userId,
        householdId: houseId,
        role: "responsavel",
        joinedAt: now,
      });
      data.activity.unshift({
        id: id("evento"),
        userId,
        householdId: houseId,
        type: "entrada_casa",
        at: now,
      });
      data.audit.unshift({
        id: id("auditoria"),
        action: "casa criada",
        targetId: houseId,
        at: now,
      });
      return sessionFor(userId);
    },
  };
}

const sharedDemoData = createDemoData();
export const demoGateway = createDemoGateway(sharedDemoData);
export const demoAuthGateway = createDemoAuthGateway(sharedDemoData);
