export type AccessSource = "lista" | "convite_admin" | "convite_morador";
export type AnalyticsFilter = {
  period: 7 | 30 | 90;
  source: AccessSource | "todos";
  size: "todos" | "1" | "2" | "3+";
};
export type FunnelStep = { label: string; count: number; denominator: number };
export type AnalyticsResult = {
  filter: AnalyticsFilter;
  from: string;
  to: string;
  sampleHouses: number;
  people: FunnelStep[];
  activation: FunnelStep[];
  weeklyActive: { week: string; houses: number; denominator: number }[];
  cohorts: { week: string; houses: number; week1?: number; week1Denominator: number; week4?: number; week4Denominator: number }[];
  overdueOpen: number;
  tasksOpen: number;
  insights: string[];
};
export type AnalyticsDataSet = {
  users: { id: string; email: string; status: string; source: AccessSource; accessId: string; createdAt: string }[];
  households: { id: string; name: string; createdAt: string }[];
  memberships: { userId: string; householdId: string; joinedAt: string }[];
  allowlist: { id: string; email: string; addedAt: string }[];
  invitations: { id: string; email: string; source: Exclude<AccessSource, "lista">; createdAt: string }[];
  tasks: { id: string; householdId: string; createdAt: string; dueAt: string; completedAt?: string; isOpen?: boolean }[];
  activity: { id: string; householdId?: string; type: string; at: string }[];
};

type Household = AnalyticsDataSet["households"][number];

const day = 86_400_000;
const time = (value: string) => new Date(value).getTime();
const inRange = (value: string, from: number, to: number) =>
  time(value) >= from && time(value) <= to;
const weekLabel = (value: number) =>
  new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });

export function calculateAnalytics(
  data: AnalyticsDataSet,
  filter: AnalyticsFilter,
  now = new Date(),
): AnalyticsResult {
  const to = now.getTime();
  const from = to - filter.period * day;
  const members = (houseId: string) =>
    data.memberships.filter(
      (item) =>
        item.householdId === houseId &&
        data.users.some(
          (user) => user.id === item.userId && user.status !== "excluido",
        ),
    );
  const sizeMatches = (house: Household) => {
    const size = members(house.id).length;
    return (
      filter.size === "todos" ||
      (filter.size === "3+" ? size >= 3 : size === Number(filter.size))
    );
  };
  const sourceMatches = (house: Household) =>
    filter.source === "todos" ||
    members(house.id).some(
      (member) =>
        data.users.find((user) => user.id === member.userId)?.source ===
        filter.source,
    );
  const houses = data.households.filter(
    (house) => sizeMatches(house) && sourceMatches(house),
  );
  const houseIds = new Set(houses.map((house) => house.id));
  const eligible = [
    ...data.allowlist
      .filter((entry) => inRange(entry.addedAt, from, to))
      .map((entry) => ({
        id: entry.id,
        email: entry.email,
        source: "lista" as AccessSource,
      })),
    ...data.invitations
      .filter((invite) => inRange(invite.createdAt, from, to))
      .map((invite) => ({
        id: invite.id,
        email: invite.email,
        source: invite.source,
      })),
  ]
    .filter(
      (entry) => filter.source === "todos" || entry.source === filter.source,
    )
    .filter(
      (entry) =>
        filter.size === "todos" ||
        (() => {
          const user = data.users.find(
            (person) => person.accessId === entry.id,
          );
          return user
            ? data.memberships.some(
                (member) =>
                  member.userId === user.id && houseIds.has(member.householdId),
              )
            : false;
        })(),
    );
  const eligibleEmails = new Set(eligible.map((entry) => entry.email));
  const eligibleIds = new Set(eligible.map((entry) => entry.id));
  const accounts = data.users.filter(
    (user) =>
      eligibleIds.has(user.accessId) &&
      user.status !== "excluido" &&
      inRange(user.createdAt, from, to) &&
      (filter.source === "todos" || user.source === filter.source),
  );
  const joined = accounts.filter((user) =>
    data.memberships.some(
      (member) =>
        member.userId === user.id &&
        (filter.size === "todos" || houseIds.has(member.householdId)),
    ),
  );
  const step = (
    label: string,
    count: number,
    denominator: number,
  ): FunnelStep => ({ label, count, denominator });
  const people = [
    step("Acesso liberado", eligibleEmails.size, eligibleEmails.size),
    step("Conta criada", accounts.length, eligibleEmails.size),
    step("Entrou em uma casa", joined.length, accounts.length),
  ];

  const created = houses.filter(
    (house) =>
      inRange(house.createdAt, from, to) &&
      to - time(house.createdAt) >= 7 * day,
  );
  const twoPeople = created.filter(
    (house) =>
      members(house.id).filter(
        (member) => time(member.joinedAt) <= time(house.createdAt) + 7 * day,
      ).length >= 2,
  );
  const firstTask = twoPeople.filter((house) =>
    data.tasks.some(
      (task) =>
        task.householdId === house.id &&
        time(task.createdAt) <= time(house.createdAt) + 7 * day,
    ),
  );
  const completed = firstTask.filter((house) =>
    data.tasks.some(
      (task) =>
        task.householdId === house.id &&
        task.completedAt &&
        time(task.completedAt) <= time(house.createdAt) + 7 * day,
    ),
  );
  const activation = [
    step("Casa criada", created.length, created.length),
    step("Duas pessoas", twoPeople.length, created.length),
    step("Primeira tarefa", firstTask.length, twoPeople.length),
    step("Primeira conclusão", completed.length, firstTask.length),
  ];

  const active = (houseId: string, start: number, end: number) =>
    data.activity.some(
      (event) =>
        event.householdId === houseId &&
        (event.type === "tarefa_criada" || event.type === "tarefa_concluida") &&
        inRange(event.at, start, end),
    );
  const weeklyActive = Array.from(
    { length: Math.ceil(filter.period / 7) },
    (_, index) => {
      const start = from + index * 7 * day;
      const end = Math.min(start + 7 * day - 1, to);
      return {
        week: weekLabel(start),
        houses: houses.filter(
          (house) =>
            time(house.createdAt) <= end && active(house.id, start, end),
        ).length,
        denominator: houses.filter((house) => time(house.createdAt) <= end)
          .length,
      };
    },
  );
  const periodHouses = houses.filter((house) =>
    inRange(house.createdAt, from, to),
  );
  const cohorts = Array.from(
    new Set(
      periodHouses.map((house) => {
        const start = time(house.createdAt);
        return new Date(start - ((new Date(start).getUTCDay() + 6) % 7) * day)
          .toISOString()
          .slice(0, 10);
      }),
    ),
  )
    .sort()
    .reverse()
    .slice(0, 10)
    .map((week) => {
      const start = time(week);
      const group = periodHouses.filter(
        (house) =>
          time(house.createdAt) >= start &&
          time(house.createdAt) < start + 7 * day,
      );
      const mature1 = group.filter(
        (house) => to - time(house.createdAt) >= 14 * day,
      );
      const mature4 = group.filter(
        (house) => to - time(house.createdAt) >= 35 * day,
      );
      return {
        week: weekLabel(start),
        houses: group.length,
        week1: mature1.length
          ? mature1.filter((house) =>
              active(
                house.id,
                time(house.createdAt) + 7 * day,
                time(house.createdAt) + 14 * day - 1,
              ),
            ).length
          : undefined,
        week1Denominator: mature1.length,
        week4: mature4.length
          ? mature4.filter((house) =>
              active(
                house.id,
                time(house.createdAt) + 28 * day,
                time(house.createdAt) + 35 * day - 1,
              ),
            ).length
          : undefined,
        week4Denominator: mature4.length,
      };
    });
  const open = data.tasks.filter(
    (task) => houseIds.has(task.householdId) && (task.isOpen ?? !task.completedAt),
  );
  const overdueOpen = open.filter((task) => time(task.dueAt) < to).length;
  const drop = (steps: FunnelStep[]) =>
    steps
      .slice(1)
      .map((current, index) => ({
        label: `${steps[index].label} → ${current.label}`,
        loss: steps[index].count - current.count,
      }))
      .sort((a, b) => b.loss - a.loss)[0];
  const biggest = [drop(people), drop(activation)].sort(
    (a, b) => b.loss - a.loss,
  )[0];
  const mature4 = periodHouses.filter(
    (house) => to - time(house.createdAt) >= 35 * day,
  );
  const retained1 = mature4.filter((house) =>
    active(
      house.id,
      time(house.createdAt) + 7 * day,
      time(house.createdAt) + 14 * day - 1,
    ),
  ).length;
  const retained4 = mature4.filter((house) =>
    active(
      house.id,
      time(house.createdAt) + 28 * day,
      time(house.createdAt) + 35 * day - 1,
    ),
  ).length;
  const insights = [
    biggest?.loss
      ? `Maior perda observada: ${biggest.label} (${biggest.loss} ${biggest.loss === 1 ? "caso" : "casos"}). Investigue esse trecho antes de mudar a experiência.`
      : "Não houve perda entre as etapas medidas nesta amostra.",
    mature4.length
      ? `Nas mesmas ${mature4.length} casas maduras, ${retained1} tiveram atividade na semana 1 e ${retained4} na semana 4. A diferença é descritiva; investigue o motivo.`
      : "Ainda não há casas com 35 dias completos para comparar as semanas 1 e 4 no mesmo grupo.",
    overdueOpen
      ? `${overdueOpen} de ${open.length} tarefas em aberto estão vencidas agora. Vale investigar se o combinado está viável.`
      : "Não há tarefas vencidas em aberto neste recorte.",
    "Hipótese de precificação: compare o uso recorrente por tamanho de casa antes de propor planos. Estes dados não medem disposição a pagar.",
  ];
  if (created.length < 10)
    insights.unshift(
      "Amostra pequena: menos de 10 casas maduras no funil de ativação. Leia contagens, não tendências como certezas.",
    );
  return {
    filter,
    from: new Date(from).toISOString(),
    to: now.toISOString(),
    sampleHouses: created.length,
    people,
    activation,
    weeklyActive,
    cohorts,
    overdueOpen,
    tasksOpen: open.length,
    insights,
  };
}
