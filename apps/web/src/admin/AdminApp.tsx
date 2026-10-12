import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  ArrowRight,
  ChartNoAxesCombined,
  Download,
  Ellipsis,
  House,
  KeyRound,
  LayoutDashboard,
  ListFilter,
  LogOut,
  MailPlus,
  Search,
  Settings2,
  UsersRound,
} from "lucide-react";
import { Avatar, Button, Card, EmptyState, Select, StatusBadge, TextField } from "../components/ui";
import { MobileMenu, type MobileMenuItem } from "../components/MobileMenu";
import { ConsoleLoading } from "../components/ConsoleLoading";
import { ConfirmDialog } from "../components/ResidentOverlays";
import { useToast } from "../components/Toast";
import { errorMessage } from "../api/http";
import type {
  AdminGateway,
  ActivityEvent,
  Analytics,
  AnalyticsFilter,
  AuditEvent,
  HouseholdRole,
  Invitation,
  Period,
  SizeFilter,
  SourceFilter,
  User,
  UserStatus,
} from "./contracts";
import styles from "./AdminApp.module.css";

const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});
const AdminGatewayContext = createContext<AdminGateway | null>(null);
const useAdminGateway = () => {
  const gateway = useContext(AdminGatewayContext);
  if (!gateway) throw new Error("AdminGateway is required");
  return gateway;
};
const date = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Ainda não";
const dateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
const errorText = (error: unknown) =>
  errorMessage(error, "Algo deu errado. Recarregue a tela e tente novamente.");
const sourceName: Record<SourceFilter, string> = {
  todos: "Todas as origens",
  lista: "Lista de autorização",
  convite_admin: "Convite da equipe",
  convite_morador: "Convite de morador",
};
const statusName: Record<UserStatus, string> = {
  ativo: "Ativo",
  suspenso: "Suspenso",
  excluido: "Excluído",
};

function Message({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "success";
}) {
  return (
    <p
      className={`${styles.message} ${styles[tone]}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
function Loading() {
  return (
    <div className={styles.loading} role="status">
      Carregando dados…
    </div>
  );
}
function QueryError({ error }: { error: unknown }) {
  return <Message tone="error">{errorText(error)}</Message>;
}
function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.pageHeading}>
      <div>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <Card className={styles.stat}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </Card>
  );
}

function AppearanceSettings({
  themeControl,
  logout,
}: {
  themeControl: ReactNode;
  logout: ReactNode;
}) {
  return (
    <details className={styles.settings}>
      <summary>
        <Settings2 size={18} aria-hidden="true" /> Mais opções
      </summary>
      {themeControl}
      {logout}
    </details>
  );
}

function Login({
  onLogin,
  themeControl,
  bootstrapEnabled,
}: {
  onLogin: () => void;
  themeControl: ReactNode;
  bootstrapEnabled: boolean;
}) {
  const gateway = useAdminGateway();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const mutation = useMutation({
    mutationFn: () => gateway.login(email, password, totp),
    onSuccess: onLogin,
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }
  return (
    <>
      <div className={styles.loginTop}>
        <Link to="/" className={styles.consoleBrand}>
          <img src="/simbolo.svg" alt="" width="38" height="38" />
          <span>
            CHEGA DE BRIGA<strong>Início</strong>
          </span>
        </Link>
        {themeControl}
      </div>
      <section className={styles.loginLayout}>
        <Card className={styles.loginCard}>
          <KeyRound size={34} aria-hidden="true" />
          <h1>{import.meta.env.DEV ? "Entrar na demo" : "Entrar na administração"}</h1>
          {import.meta.env.DEV && <><p>Use as credenciais fictícias abaixo para explorar o fluxo.</p><div className={styles.credentials}><span>E-mail <strong>admin@exemplo.test</strong></span><span>Senha <strong>demonstracao</strong></span></div></>}
          <form onSubmit={submit} className={styles.stack}>
            <TextField
              id="admin-email"
              type="email"
              label="E-mail"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {!import.meta.env.DEV && <TextField id="admin-totp" label="Código do autenticador ou de recuperação" inputMode="text" autoComplete="one-time-code" minLength={6} maxLength={18} required value={totp} onChange={(event) => setTotp(event.target.value)} />}
            <TextField
              id="admin-password"
              type="password"
              label="Senha"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {mutation.isError && <QueryError error={mutation.error} />}
            <Button type="submit" disabled={mutation.isPending}>
              {import.meta.env.DEV ? "Entrar na demo" : "Entrar"} <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </form>
          {bootstrapEnabled && <p className={styles.loginHelp}><Link to="/admin/setup">Configurar a primeira conta</Link></p>}
        </Card>
        <div className={styles.loginIntro}>
          <span className={styles.eyebrow}>ÁREA DA EQUIPE{import.meta.env.DEV ? " · DEMONSTRAÇÃO" : ""}</span>
          <h2>
            Os bastidores
            <br />
            <em>também contam.</em>
          </h2>
          <p>
            {import.meta.env.DEV ? "Este console usa dados fictícios e funciona somente no ambiente de desenvolvimento." : "Acesso restrito à equipe da plataforma."}
          </p>
          <img src="/caminhos.svg" alt="" />
        </div>
      </section>
    </>
  );
}

function BootstrapAdmin({ themeControl }: { themeControl: ReactNode }) {
  const gateway = useAdminGateway();
  const location = useLocation();
  const navigate = useNavigate();
  const token = new URLSearchParams(location.search).get("token") ?? new URLSearchParams(location.hash.replace(/^#/, "")).get("token") ?? "";
  useEffect(() => {
    if (token) window.history.replaceState(null, "", location.pathname);
  }, [location.pathname, token]);
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [sent, setSent] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>();
  const challenge = useQuery({
    queryKey: ["bootstrap-challenge", token],
    queryFn: () => gateway.bootstrapChallenge?.(token),
    enabled: Boolean(token && gateway.bootstrapChallenge),
    retry: false,
  });
  const send = useMutation({
    mutationFn: async () => {
      if (!gateway.requestBootstrap) throw new Error("A configuração inicial não está disponível neste ambiente. Volte à entrada ou procure o administrador.");
      await gateway.requestBootstrap();
    },
    onSuccess: () => setSent(true),
  });
  const complete = useMutation({
    mutationFn: async () => {
      if (!gateway.completeBootstrap) throw new Error("A configuração inicial não está disponível neste ambiente. Volte à entrada ou procure o administrador.");
      return gateway.completeBootstrap({ token, password, totp });
    },
    onSuccess: setRecoveryCodes,
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    complete.mutate();
  }
  return (
    <>
      <div className={styles.loginTop}><Link to="/" className={styles.consoleBrand}><img src="/simbolo.svg" alt="" width="38" height="38" /><span>CHEGA DE BRIGA<strong>Início</strong></span></Link>{themeControl}</div>
      <section className={styles.loginLayout}>
        <Card className={styles.loginCard}>
          <KeyRound size={34} aria-hidden="true" />
          <h1>Configurar administração</h1>
          {!token ? (
            <>
              <p>Enviaremos um link de configuração ao e-mail definido nos segredos do servidor.</p>
              {sent ? <Message tone="success">Pedido confirmado. O e-mail com o link entrou na fila de envio para o endereço administrativo. Confira sua caixa de entrada e a pasta de spam nos próximos minutos.</Message> : <Button disabled={send.isPending} onClick={() => send.mutate()}>{send.isPending ? "Enviando…" : "Enviar link de configuração"}</Button>}
              {send.isError && <QueryError error={send.error} />}
            </>
          ) : recoveryCodes ? (
            <div className={styles.stack}>
              <Message tone="success">A conta foi criada. Guarde estes códigos agora: cada um funciona uma única vez e não serão exibidos novamente.</Message>
              <pre className={styles.recoveryCodes}>{recoveryCodes.join("\n")}</pre>
              <Button onClick={() => navigate("/admin/entrar", { replace: true })}>Guardei os códigos e vou entrar</Button>
            </div>
          ) : challenge.isPending ? <Loading /> : challenge.error || !challenge.data ? <QueryError error={challenge.error ?? new Error("Este link expirou ou já foi usado. Solicite um novo link e tente novamente.")} /> : (
            <form className={styles.stack} onSubmit={submit}>
              <p>Conta inicial: <strong>{challenge.data.email}</strong></p>
              <p>Cadastre este segredo no aplicativo autenticador antes de continuar:</p>
              <code className={styles.credentials}>{challenge.data.totpSecret}</code>
              <p>Se este e-mail já tiver uma conta residencial, informe a senha atual. Os dois acessos usam a mesma senha.</p>
              <TextField id="bootstrap-password" type="password" label="Senha da conta" autoComplete="new-password" minLength={12} maxLength={200} required value={password} onChange={(event) => setPassword(event.target.value)} />
              <TextField id="bootstrap-totp" label="Código do autenticador" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={totp} onChange={(event) => setTotp(event.target.value)} />
              {complete.isError && <QueryError error={complete.error} />}
              <Button type="submit" disabled={complete.isPending}>{complete.isPending ? "Configurando…" : "Concluir configuração"}</Button>
            </form>
          )}
          <p className={styles.loginHelp}><Link to="/admin/entrar">Voltar para entrar</Link></p>
        </Card>
        <div className={styles.loginIntro}><span className={styles.eyebrow}>ACESSO DA EQUIPE</span><h2>Uma conta.<br /><em>Protegida.</em></h2><p>Use uma senha única e um autenticador de dois fatores.</p><img src="/caminhos.svg" alt="" /></div>
      </section>
    </>
  );
}

function Overview() {
  const gateway = useAdminGateway();
  const analytics = useQuery({
    queryKey: ["analytics", 30, "todos", "todos"],
    queryFn: () =>
      gateway.analytics({ period: 30, source: "todos", size: "todos" }),
  });
  const people = useQuery({
    queryKey: ["users", "", "todos", 1],
    queryFn: () => gateway.users({ search: "", status: "todos", page: 1 }),
  });
  const houses = useQuery({
    queryKey: ["houses"],
    queryFn: () => gateway.households(),
  });
  const access = useQuery({
    queryKey: ["access"],
    queryFn: () => gateway.access(),
  });
  if (
    analytics.isPending ||
    people.isPending ||
    houses.isPending ||
    access.isPending
  )
    return <Loading />;
  if (analytics.error || people.error || houses.error || access.error)
    return (
      <QueryError
        error={analytics.error || people.error || houses.error || access.error}
      />
    );
  const data = analytics.data;
  const pending = access.data.invitations.filter(
    (invite) => invite.status === "pendente",
  ).length;
  return (
    <>
      <PageHeading
        eyebrow="VISÃO GERAL / ÚLTIMOS 30 DIAS"
        title="A casa toda, de relance."
        description="Sinais de uso para encontrar atritos cedo. Cada número abre uma pergunta, não um julgamento."
        action={
          <Link className={styles.linkButton} to="/admin/analise">
            Explorar análise <ArrowRight size={18} aria-hidden="true" />
          </Link>
        }
      />
      <div className={styles.stats}>
        <Stat
          label="Pessoas com conta"
          value={people.data.total}
          detail="Total atual, excluídas fora da contagem"
        />
        <Stat
          label="Casas criadas"
          value={houses.data.length}
          detail="Total atual de casas"
        />
        <Stat
          label="Convites pendentes"
          value={pending}
          detail="Aguardando aceite, ainda válidos"
        />
        <Stat
          label="Tarefas vencidas"
          value={data.overdueOpen}
          detail="Abertas agora, nas casas do segmento"
        />
      </div>
      <div className={styles.twoColumns}>
        <Card className={styles.feature}>
          <span className={styles.eyebrow}>ONDE OLHAR</span>
          <h2>Pequenos sinais, boas conversas.</h2>
          <ul>
            {data.insights.slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Link to="/admin/analise" className={styles.textLink}>
            Ver definições e denominadores{" "}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </Card>
        <Card>
          <span className={styles.eyebrow}>ACESSO CONTROLADO</span>
          <h2>A porta tem combinado.</h2>
          <p>
            Lista de autorização e convites ajudam a acompanhar quem pode
            entrar. Revogar um acesso pendente não suspende uma conta existente.
          </p>
          <Link to="/admin/acessos" className={styles.textLink}>
            Gerenciar acessos <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </Card>
      </div>
    </>
  );
}

function UsersPage() {
  const gateway = useAdminGateway();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserStatus | "todos">("todos");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["users", search, status, page],
    queryFn: () => gateway.users({ search, status, page }),
  });
  return (
    <>
      <PageHeading
        eyebrow="PESSOAS / CONTAS"
        title="Quem está por aqui."
        description="Busque por nome ou e-mail, confira o estado da conta e abra o histórico de metadados."
      />
      <div className={styles.filters}>
        <label className={styles.searchField}>
          <Search size={19} aria-hidden="true" />
          <span className={styles.srOnly}>Buscar pessoas</span>
          <input
            type="search"
            placeholder="Buscar pessoa ou e-mail"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <details className={styles.filterDisclosure}>
          <summary>
            <ListFilter size={18} aria-hidden="true" /> Estado
            {status !== "todos" && (
              <span className={styles.filterCount}>1</span>
            )}
          </summary>
          <div className={styles.filterPanel}>
            <Select
              className={styles.selectField}
              label="Estado da conta"
              value={status}
              options={[
                { value: "todos", label: "Todos" },
                { value: "ativo", label: "Ativos" },
                { value: "suspenso", label: "Suspensos" },
              ]}
              onChange={(value) => {
                setStatus(value as UserStatus | "todos");
                setPage(1);
              }}
            />
          </div>
        </details>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <QueryError error={query.error} />
      ) : (
        <>
          {query.data.items.length ? (
            <div className={styles.list}>
              {query.data.items.map((user) => (
                <Link
                  to={`/admin/usuarios/${user.id}`}
                  className={styles.personRow}
                  key={user.id}
                >
                  <Avatar
                    name={user.name}
                    initials={user.name.slice(0, 2).toUpperCase()}
                    tone={user.status === "suspenso" ? "sun" : "lilac"}
                  />
                  <span className={styles.personMain}>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </span>
                  <span className={styles.personMeta}>
                    <StatusBadge tone={user.status === "ativo" ? "success" : "danger"}>
                      {statusName[user.status]}
                    </StatusBadge>
                    <small>{sourceName[user.source]}</small>
                  </span>
                  <ArrowRight size={19} aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhuma pessoa encontrada."
              description="Ajuste a busca ou os filtros para ver outras contas."
            />
          )}
          <div className={styles.pagination}>
            <span>
              {query.data.total} pessoas · página {query.data.page} de{" "}
              {query.data.pages}
            </span>
            <div>
              <Button
                variant="secondary"
                disabled={query.data.page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                disabled={query.data.page >= query.data.pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function UserEditor({
  user,
  memberships,
  activity,
  audit,
}: {
  user: User;
  memberships: { householdId: string; role: HouseholdRole; joinedAt: string }[];
  activity: ActivityEvent[];
  audit: AuditEvent[];
}) {
  const gateway = useAdminGateway();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const houses = useQuery({
    queryKey: ["houses"],
    queryFn: () => gateway.households(),
  });
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [confirm, setConfirm] = useState<"suspenso" | "excluido" | null>(null);
  const [showManagement, setShowManagement] = useState(false);
  const timeline = [
    ...activity.map((item) => ({
      id: item.id,
      label: item.type.replaceAll("_", " "),
      at: item.at,
    })),
    ...audit.map((item) => ({ id: item.id, label: item.action, at: item.at })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const mutation = useMutation({
    mutationFn: async (
      action:
        | { kind: "profile" }
        | { kind: "status"; status: UserStatus }
        | { kind: "role"; householdId: string; role: HouseholdRole },
    ) => {
      if (action.kind === "profile")
        return gateway.updateUser(user.id, { name, email });
      if (action.kind === "status")
        return gateway.setUserStatus(user.id, action.status);
      return gateway.setMembershipRole(
        user.id,
        action.householdId,
        action.role,
      );
    },
    onSuccess: async (_, action) => {
      if (action.kind === "status" && action.status === "excluido") {
        void queryClient.invalidateQueries();
        showToast("Conta excluída.");
        navigate("/admin/usuarios");
        return;
      }
      await queryClient.invalidateQueries();
      showToast(
        action.kind === "profile"
          ? "Perfil atualizado."
          : action.kind === "role"
            ? "Papel da casa atualizado."
            : action.status === "suspenso"
              ? "Conta suspensa."
              : "Conta reativada.",
      );
      setConfirm(null);
    },
  });
  async function submit(event: FormEvent) {
    event.preventDefault();
    await mutation.mutateAsync({ kind: "profile" }).catch(() => undefined);
  }
  return (
    <>
      <div className={styles.back}>
        <Link to="/admin/usuarios">
          <ArrowLeft size={18} aria-hidden="true" /> Pessoas
        </Link>
      </div>
      <PageHeading
        eyebrow="PESSOA / METADADOS"
        title={user.name}
        description={`${statusName[user.status]} · ${user.email} · Conta criada em ${date(user.createdAt)}. Último acesso: ${date(user.lastSeenAt)}.`}
        action={
          <Button
            variant="secondary"
            aria-expanded={showManagement}
            onClick={() => setShowManagement((value) => !value)}
          >
            <Settings2 size={18} aria-hidden="true" /> Gerenciar conta
          </Button>
        }
      />
      {mutation.isError && <QueryError error={mutation.error} />}
      {showManagement && (
        <div className={styles.twoColumns}>
          <Card>
            <span className={styles.eyebrow}>PERFIL</span>
            <h2>Dados da conta</h2>
            <form className={styles.stack} onSubmit={submit}>
              <TextField
                id="edit-name"
                label="Nome"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
              <TextField
                id="edit-email"
                label="E-mail"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <Button type="submit" disabled={mutation.isPending}>
                Salvar perfil
              </Button>
            </form>
          </Card>
          <Card>
            <span className={styles.eyebrow}>ESTADO</span>
            <StatusBadge tone={user.status === "ativo" ? "success" : "danger"}>
              {statusName[user.status]}
            </StatusBadge>
            <p>
              Suspender impede o acesso futuro à conta.
            </p>
            <div className={styles.actions}>
              {user.status === "suspenso" ? (
                <Button
                  variant="secondary"
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({ kind: "status", status: "ativo" })
                  }
                >
                  Reativar conta
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  disabled={mutation.isPending}
                  onClick={() => setConfirm("suspenso")}
                >
                  Suspender conta
                </Button>
              )}
              {import.meta.env.DEV && (
                <Button
                  variant="quiet"
                  disabled={mutation.isPending}
                  onClick={() => setConfirm("excluido")}
                >
                  Excluir na demo
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
      <div className={styles.twoColumns}>
        <Card>
          <span className={styles.eyebrow}>CASAS</span>
          <h2>Vínculos e papéis</h2>
          {memberships.length ? (
            <div className={styles.stack}>
              {memberships.map((member) => (
                <div className={styles.membership} key={member.householdId}>
                  <Link to={`/admin/casas/${member.householdId}`}>
                    {houses.data?.find(
                      (house) => house.id === member.householdId,
                    )?.name ?? member.householdId}
                  </Link>
                  {showManagement ? (
                    <Select
                      className={styles.roleSelect}
                      label="Papel"
                      value={member.role}
                      disabled={mutation.isPending}
                      options={[
                        { value: "responsavel", label: "Responsável", disabled: user.status !== "ativo" },
                        { value: "morador", label: "Morador" },
                      ]}
                      onChange={(value) =>
                        mutation.mutate({
                          kind: "role",
                          householdId: member.householdId,
                          role: value as HouseholdRole,
                        })
                      }
                    />
                  ) : (
                    <span className={styles.roleLabel}>
                      {member.role === "responsavel"
                        ? "Responsável"
                        : "Morador"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p>Sem casa vinculada.</p>
          )}
          {showManagement && (
            <p className={styles.finePrint}>
              A última pessoa responsável por uma casa só pode mudar de papel
              depois de outra assumir. Contas suspensas não podem assumir esse
              papel.
            </p>
          )}
        </Card>
        <Card>
          <span className={styles.eyebrow}>ATIVIDADE</span>
          <h2>Histórico sem intimidade</h2>
          <p className={styles.finePrint}>
            Somente tipo e horário. Conteúdo de tarefas não aparece aqui.
          </p>
          {timeline.length ? (
            <ol className={styles.timeline}>
              {timeline.slice(0, 12).map((event) => (
                <li key={event.id}>
                  <strong>{event.label}</strong>
                  <span>{dateTime(event.at)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p>Sem atividade registrada.</p>
          )}
        </Card>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "excluido" ? "Excluir esta conta?" : "Suspender esta conta?"}
        description={confirm === "excluido"
          ? "A conta sairá da lista e os dados de perfil serão anonimizados."
          : "A conta ficará marcada como suspensa e perderá acesso à plataforma."}
        confirmLabel={confirm === "excluido" ? "Excluir conta" : "Suspender conta"}
        onConfirm={() => {
          if (confirm) mutation.mutate({ kind: "status", status: confirm });
        }}
      />
    </>
  );
}
function UserDetail() {
  const gateway = useAdminGateway();
  const { id } = useParams();
  const query = useQuery({
    queryKey: ["user", id],
    queryFn: () => gateway.user(id!),
    enabled: Boolean(id),
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <QueryError error={query.error} />;
  return <UserEditor key={id} {...query.data} />;
}

function AccessActions({ children }: { children: ReactNode }) {
  return (
    <details
      className={styles.rowActions}
      onToggle={(event) => {
        if (event.currentTarget.open) {
          event.currentTarget
            .querySelector<HTMLElement>(".rowActionsMenu > :last-child")
            ?.scrollIntoView({ block: "nearest" });
        }
      }}
    >
      <summary aria-label="Ações">
        <Ellipsis size={18} aria-hidden="true" />
        <span className={styles.rowActionsLabel}>Ações</span>
      </summary>
      <div
        className={styles.rowActionsMenu}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("button")) {
            const details = event.currentTarget.closest("details");
            details?.removeAttribute("open");
            details?.querySelector("summary")?.focus();
          }
        }}
      >
        {children}
      </div>
    </details>
  );
}

function AccessPage() {
  const gateway = useAdminGateway();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const access = useQuery({
    queryKey: ["access"],
    queryFn: () => gateway.access(),
  });
  const houses = useQuery({
    queryKey: ["houses"],
    queryFn: () => gateway.households(),
  });
  const [allowedEmail, setAllowedEmail] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [houseId, setHouseId] = useState("");
  const [composer, setComposer] = useState<"invite" | "allow" | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    kind: "revokeAllow" | "revokeInvite";
    id: string;
    email: string;
  }>();
  const mutation = useMutation({
    mutationFn: async (
      action:
        | { kind: "allow" }
        | { kind: "revokeAllow" | "revokeInvite" | "resend"; id: string }
        | { kind: "invite" },
    ) => {
      switch (action.kind) {
        case "allow":
          return gateway.addAllowed(allowedEmail);
        case "invite":
          return gateway.invite(inviteEmail, houseId || undefined);
        case "revokeAllow":
          return gateway.revokeAllowed(action.id);
        case "revokeInvite":
          return gateway.revokeInvite(action.id);
        case "resend":
          return gateway.resendInvite(action.id);
      }
    },
    onSuccess: async (_, action) => {
      await queryClient.invalidateQueries();
      showToast(
        {
          allow: "Acesso liberado.",
          invite: import.meta.env.DEV ? "Convite criado na demo; nenhum e-mail foi enviado." : "Convite criado; o e-mail entrou na fila de envio.",
          revokeAllow: "Autorização revogada.",
          revokeInvite: "Convite revogado.",
          resend: import.meta.env.DEV ? "Convite atualizado na demo; nenhum e-mail foi enviado." : "Convite reenviado; o e-mail entrou na fila de envio.",
        }[action.kind],
      );
      if (action.kind === "allow") setAllowedEmail("");
      if (action.kind === "invite") setInviteEmail("");
      if (action.kind === "allow" || action.kind === "invite")
        setComposer(null);
    },
  });
  function toggleComposer(next: "invite" | "allow") {
    mutation.reset();
    setComposer((current) => (current === next ? null : next));
  }
  function submitAllowed(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({ kind: "allow" });
  }
  function submitInvite(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({ kind: "invite" });
  }
  return (
    <>
      <PageHeading
        eyebrow="PORTA DE ENTRADA"
        title="Acesso com convite."
        description="Gerencie a lista de autorização e acompanhe convites da equipe e de moradores. A validade é de sete dias."
      />
      <div className={styles.accessActions}>
        <Button
          aria-expanded={composer === "invite"}
          onClick={() => toggleComposer("invite")}
        >
          <MailPlus size={18} aria-hidden="true" /> Convidar alguém
        </Button>
        <Button
          variant="secondary"
          aria-expanded={composer === "allow"}
          onClick={() => toggleComposer("allow")}
        >
          Liberar e-mail
        </Button>
      </div>
      {mutation.isError && <QueryError error={mutation.error} />}
      {houses.error && <QueryError error={houses.error} />}
      {composer && (
        <Card className={styles.composer}>
          <span className={styles.eyebrow}>
            {composer === "invite" ? "NOVO CONVITE" : "LISTA DE AUTORIZAÇÃO"}
          </span>
          <h2>
            {composer === "invite" ? "Convidar alguém" : "Liberar e-mail"}
          </h2>
          <p>
            {composer === "invite"
              ? "Escolha uma casa para convidar a pessoa diretamente para ela."
              : "A pessoa poderá criar conta quando o cadastro existir."}
          </p>
          {composer === "invite" ? (
            <form className={styles.stack} onSubmit={submitInvite}>
              <TextField
                id="invite-email"
                label="E-mail"
                type="email"
                required
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
              <Select
                className={styles.selectField}
                label="Casa (opcional)"
                value={houseId}
                options={[
                  { value: "", label: "Sem casa definida" },
                  ...(houses.data?.map((house) => ({ value: house.id, label: house.name })) ?? []),
                ]}
                onChange={setHouseId}
              />
              <Button type="submit" disabled={mutation.isPending}>
                Criar convite
              </Button>
            </form>
          ) : (
            <form className={styles.stack} onSubmit={submitAllowed}>
              <TextField
                id="allow-email"
                label="E-mail"
                type="email"
                placeholder="pessoa@example.test"
                required
                value={allowedEmail}
                onChange={(event) => setAllowedEmail(event.target.value)}
              />
              <Button type="submit" disabled={mutation.isPending}>
                Adicionar à lista
              </Button>
            </form>
          )}
        </Card>
      )}
      {access.isPending ? (
        <Loading />
      ) : access.error ? (
        <QueryError error={access.error} />
      ) : (
        <div className={`${styles.twoColumns} ${styles.accessLists}`}>
          <Card>
            <span className={styles.eyebrow}>
              CONVITES / {access.data.invitations.length}
            </span>
            <h2>Convites emitidos</h2>
            <details className={styles.infoDisclosure}>
              <summary>Como funcionam os convites</summary>
              <p className={styles.finePrint}>
                Um convite válido de morador libera o cadastro e a entrada na
                casa indicada, sem aprovação manual. Revogar convites pendentes
                não suspende contas existentes.
              </p>
            </details>
            <div className={styles.entryList} id="invitation-list">
              {access.data.invitations
                .filter(
                  (invite) =>
                    showHistory ||
                    invite.status === "pendente" ||
                    invite.status === "expirado",
                )
                .map((invite: Invitation) => (
                  <div
                    className={`${styles.entry} ${styles.invitationEntry} ${invite.status === "pendente" ? styles.invitationWithActions : ""}`}
                    key={invite.id}
                  >
                    <div>
                      <strong>{invite.email}</strong>
                      <small>
                        {sourceName[invite.source]}
                        {invite.householdId
                          ? ` · ${houses.data?.find((house) => house.id === invite.householdId)?.name ?? invite.householdId}`
                          : ""}
                      </small>
                      <small>
                        {invite.status === "aceito"
                          ? `Aceito em ${date(invite.acceptedAt)}`
                          : invite.status === "pendente"
                            ? `Pendente · vence ${date(invite.expiresAt)}`
                            : invite.status === "expirado"
                              ? `Expirou em ${date(invite.expiresAt)}`
                              : "Revogado"}
                      </small>
                    </div>
                    <div className={styles.actions}>
                      {invite.status === "pendente" ? (
                        <AccessActions>
                          <Link
                            className={`${styles.rowActionItem} ${styles.demoAction}`}
                            to={`/criar-conta?convite=${encodeURIComponent(invite.id)}`}
                            aria-label={`Testar cadastro de ${invite.email}`}
                            data-tooltip="Testar cadastro"
                          >
                            Testar cadastro
                          </Link>
                          <Button
                            variant="quiet"
                            className={styles.rowActionItem}
                            aria-label={`Reenviar convite para ${invite.email}`}
                            disabled={mutation.isPending}
                            onClick={() =>
                              mutation.mutate({ kind: "resend", id: invite.id })
                            }
                          >
                            Reenviar convite
                          </Button>
                          <Button
                            variant="quiet"
                            className={`${styles.rowActionItem} ${styles.destructiveAction}`}
                            aria-label={`Revogar convite de ${invite.email}`}
                            disabled={mutation.isPending}
                            onClick={() => setConfirmation({
                              kind: "revokeInvite",
                              id: invite.id,
                              email: invite.email,
                            })}
                          >
                            Revogar convite
                          </Button>
                        </AccessActions>
                      ) : invite.status === "expirado" ? (
                        <Button
                          variant="quiet"
                          aria-label={`Reenviar convite para ${invite.email}`}
                          disabled={mutation.isPending}
                          onClick={() =>
                            mutation.mutate({ kind: "resend", id: invite.id })
                          }
                        >
                          Reenviar convite
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
            </div>
            <Button
              variant="quiet"
              aria-expanded={showHistory}
              aria-controls="invitation-list"
              onClick={() => setShowHistory((value) => !value)}
            >
              {showHistory
                ? "Ocultar histórico"
                : `Ver histórico (${access.data.invitations.filter((invite) => invite.status === "aceito" || invite.status === "revogado").length})`}
            </Button>
          </Card>
          <Card>
            <span className={styles.eyebrow}>
              LISTA / {access.data.allowlist.length}
            </span>
            <h2>E-mails autorizados</h2>
            <details className={styles.listDisclosure}>
              <summary>Ver lista de e-mails</summary>
              <div className={styles.entryList}>
                {access.data.allowlist.map((entry) => (
                  <div className={styles.entry} key={entry.id}>
                    <div>
                      <strong>{entry.email}</strong>
                      <small>
                        {entry.revokedAt
                          ? `Revogado em ${date(entry.revokedAt)}`
                          : `Desde ${date(entry.addedAt)}`}
                      </small>
                    </div>
                    {!entry.revokedAt && (
                      <div className={styles.actions}>
                        <AccessActions>
                          <Link
                            className={`${styles.rowActionItem} ${styles.demoAction}`}
                            to={`/criar-conta?email=${encodeURIComponent(entry.email)}`}
                            aria-label={`Testar cadastro de ${entry.email}`}
                            data-tooltip="Testar cadastro"
                          >
                            Testar cadastro
                          </Link>
                          <Button
                            variant="quiet"
                            className={`${styles.rowActionItem} ${styles.destructiveAction}`}
                            aria-label={`Revogar autorização de ${entry.email}`}
                            disabled={mutation.isPending}
                            onClick={() => setConfirmation({
                              kind: "revokeAllow",
                              id: entry.id,
                              email: entry.email,
                            })}
                          >
                            Revogar autorização
                          </Button>
                        </AccessActions>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </Card>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(confirmation)}
        onClose={() => setConfirmation(undefined)}
        title={confirmation?.kind === "revokeInvite" ? "Revogar convite?" : "Revogar autorização?"}
        description={confirmation?.kind === "revokeInvite"
          ? `O convite de ${confirmation.email} será revogado. Isso não altera contas existentes.`
          : `O e-mail ${confirmation?.email ?? ""} deixará de poder iniciar um cadastro pela lista de autorização. Contas existentes não serão alteradas.`}
        confirmLabel={confirmation?.kind === "revokeInvite" ? "Revogar convite" : "Revogar autorização"}
        onConfirm={() => {
          if (confirmation) mutation.mutate({ kind: confirmation.kind, id: confirmation.id });
        }}
      />
    </>
  );
}

function HousesPage() {
  const gateway = useAdminGateway();
  const query = useQuery({
    queryKey: ["houses"],
    queryFn: () => gateway.households(),
  });
  return (
    <>
      <PageHeading
        eyebrow="CASAS / CONSULTA"
        title="Cada casa tem seu ritmo."
        description="Indicadores e vínculos para investigar gargalos, sem ler títulos ou descrições de tarefas."
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <QueryError error={query.error} />
      ) : query.data.length ? (
        <div className={styles.houseGrid}>
          {query.data.map((house) => (
            <Link
              className={styles.houseCard}
              to={`/admin/casas/${house.id}`}
              key={house.id}
            >
              <House size={27} aria-hidden="true" />
              <strong>{house.name}</strong>
              <span>Criada em {date(house.createdAt)}</span>
              <ArrowRight size={19} aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Ainda não há casas."
          description="As casas criadas aparecerão aqui."
        />
      )}
    </>
  );
}
function HouseDetail() {
  const gateway = useAdminGateway();
  const { id } = useParams();
  const query = useQuery({
    queryKey: ["house", id],
    queryFn: () => gateway.household(id!),
    enabled: Boolean(id),
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <QueryError error={query.error} />;
  const { household, memberships, members, tasks, activity } = query.data;
  const overdue = tasks.filter(
    (task) => !task.completedAt && Date.parse(task.dueAt) < Date.now(),
  ).length;
  return (
    <>
      <div className={styles.back}>
        <Link to="/admin/casas">
          <ArrowLeft size={18} aria-hidden="true" /> Casas
        </Link>
      </div>
      <PageHeading
        eyebrow="CASA / CONSULTA"
        title={household.name}
        description={`Criada em ${date(household.createdAt)} · ${members.length} ${members.length === 1 ? "pessoa" : "pessoas"}.`}
      />
      <div className={styles.stats}>
        <Stat label="Pessoas" value={members.length} detail="Vínculos atuais" />
        <Stat
          label="Tarefas criadas"
          value={tasks.length}
          detail="Somente metadados"
        />
        <Stat
          label="Concluídas"
          value={tasks.filter((task) => task.completedAt).length}
          detail="Desde a criação"
        />
        <Stat
          label="Vencidas em aberto"
          value={overdue}
          detail="Situação agora"
        />
      </div>
      <div className={styles.twoColumns}>
        <Card>
          <span className={styles.eyebrow}>VÍNCULOS</span>
          <h2>Pessoas da casa</h2>
          <div className={styles.entryList}>
            {members.map((person) => (
              <Link
                className={styles.memberLink}
                to={`/admin/usuarios/${person.id}`}
                key={person.id}
              >
                <Avatar
                  name={person.name}
                  initials={person.name.slice(0, 2).toUpperCase()}
                />
                <span>
                  <strong>{person.name}</strong>
                  <small>
                    {memberships.find((item) => item.userId === person.id)
                      ?.role === "responsavel"
                      ? "Responsável"
                      : "Morador"}
                  </small>
                </span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <span className={styles.eyebrow}>EVENTOS</span>
          <h2>Atividade da casa</h2>
          <p className={styles.finePrint}>
            Tipo e data dos eventos. O conteúdo doméstico fica fora do console.
          </p>
          {activity.length ? (
            <ol className={styles.timeline}>
              {activity.slice(0, 12).map((event) => (
                <li key={event.id}>
                  <strong>{event.type.replaceAll("_", " ")}</strong>
                  <span>{dateTime(event.at)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p>Sem atividade registrada.</p>
          )}
        </Card>
      </div>
    </>
  );
}

function Funnel({
  title,
  steps,
  note,
}: {
  title: string;
  steps: Analytics["people"];
  note: string;
}) {
  return (
    <Card className={styles.funnel}>
      <h2>{title}</h2>
      <p className={styles.finePrint}>{note}</p>
      <div className={styles.funnelBars}>
        {steps.map((step, index) => (
          <div className={styles.funnelRow} key={step.label}>
            <span>
              {index + 1}. {step.label}
            </span>
            <div className={styles.track}>
              <span
                style={{
                  width: `${steps[0].count ? Math.max(3, (step.count / steps[0].count) * 100) : 0}%`,
                }}
              />
            </div>
            <strong>{step.count}</strong>
          </div>
        ))}
      </div>
      <div className={styles.tableWrap} role="region" aria-label="Etapas, contagens e denominadores" tabIndex={0}>
        <table>
          <caption>Etapas, contagens e denominadores</caption>
          <thead>
            <tr>
              <th>Etapa</th>
              <th>Casos</th>
              <th>Denominador</th>
              <th>Conversão</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.label}>
                <th scope="row">{step.label}</th>
                <td>{step.count}</td>
                <td>{step.denominator}</td>
                <td>
                  {step.denominator
                    ? `${Math.round((step.count / step.denominator) * 100)}%`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
function downloadCsv(data: Analytics) {
  const rows = [
    "tipo;item;valor;denominador",
    `filtro;inicio;${data.from};`,
    `filtro;fim;${data.to};`,
    `filtro;periodo_dias;${data.filter.period};`,
    `filtro;origem;${data.filter.source};`,
    `filtro;tamanho;${data.filter.size};`,
    ...data.people.map(
      (step) => `pessoa;${step.label};${step.count};${step.denominator}`,
    ),
    ...data.activation.map(
      (step) => `casa;${step.label};${step.count};${step.denominator}`,
    ),
    ...data.weeklyActive.map(
      (week) => `casas_ativas;${week.week};${week.houses};${week.denominator}`,
    ),
    ...data.cohorts.flatMap((row) => [
      `retencao_semana_1;${row.week};${row.week1 ?? ""};${row.week1Denominator}`,
      `retencao_semana_4;${row.week};${row.week4 ?? ""};${row.week4Denominator}`,
    ]),
    `tarefas_abertas;agora;${data.tasksOpen};`,
    `tarefas_vencidas;agora;${data.overdueOpen};${data.tasksOpen}`,
  ];
  const blob = new Blob(["\uFEFF", rows.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `chega-de-briga-agregado-${data.filter.period}d.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function AnalyticsPage() {
  const gateway = useAdminGateway();
  const [filter, setFilter] = useState<AnalyticsFilter>({
    period: 30,
    source: "todos",
    size: "todos",
  });
  const query = useQuery({
    queryKey: ["analytics", filter.period, filter.source, filter.size],
    queryFn: () => gateway.analytics(filter),
  });
  return (
    <>
      <PageHeading
        eyebrow="ANÁLISE / AGREGADOS"
        title="Onde o combinado emperra?"
        description="Funis de pessoas e casas têm denominadores próprios. Os dados descrevem uso observado, não intenção de compra."
      />
      <details
        className={`${styles.filterDisclosure} ${styles.analyticsFilters}`}
      >
        <summary>
          <ListFilter size={18} aria-hidden="true" /> Ajustar recorte{" "}
          <span className={styles.filterCount}>
            {filter.period} dias
            {filter.source !== "todos" || filter.size !== "todos"
              ? " · segmentado"
              : ""}
          </span>
        </summary>
        <div className={styles.filterPanel}>
          <Select
            className={styles.selectField}
            label="Período"
            value={String(filter.period)}
            options={[
              { value: "7", label: "7 dias" },
              { value: "30", label: "30 dias" },
              { value: "90", label: "90 dias" },
            ]}
            onChange={(value) =>
              setFilter({ ...filter, period: Number(value) as Period })
            }
          />
          <Select
            className={styles.selectField}
            label="Origem"
            value={filter.source}
            options={Object.entries(sourceName).map(([value, label]) => ({ value, label }))}
            onChange={(value) =>
              setFilter({ ...filter, source: value as SourceFilter })
            }
          />
          <Select
            className={styles.selectField}
            label="Tamanho da casa"
            value={filter.size}
            options={[
              { value: "todos", label: "Todos" },
              { value: "1", label: "1 pessoa" },
              { value: "2", label: "2 pessoas" },
              { value: "3+", label: "3 ou mais" },
            ]}
            onChange={(value) =>
              setFilter({ ...filter, size: value as SizeFilter })
            }
          />
          {query.data && (
            <Button variant="quiet" onClick={() => downloadCsv(query.data)}>
              <Download size={18} aria-hidden="true" /> Baixar CSV agregado
            </Button>
          )}
        </div>
      </details>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <QueryError error={query.error} />
      ) : (
        <AnalyticsContent data={query.data} />
      )}
    </>
  );
}
function AnalyticsContent({ data }: { data: Analytics }) {
  const range = `${date(data.from)} a ${date(data.to)}`;
  return (
    <>
      <Message>
        Período: {range}. Segmento: {sourceName[data.filter.source]}; tamanho:{" "}
        {data.filter.size === "todos"
          ? "todas as casas"
          : data.filter.size === "3+"
            ? "3 ou mais pessoas"
            : `${data.filter.size} pessoa(s)`}
        .{" "}
        {data.sampleHouses < 10 &&
          "Amostra pequena: compare contagens com cautela."}
      </Message>
      <div className={styles.stats}>
        <Stat
          label="Casas maduras no funil"
          value={data.sampleHouses}
          detail="Criadas no período há pelo menos 7 dias"
        />
        <Stat
          label="Tarefas abertas"
          value={data.tasksOpen}
          detail="No segmento, situação agora"
        />
        <Stat
          label="Vencidas em aberto"
          value={data.overdueOpen}
          detail={`De ${data.tasksOpen} abertas, situação agora`}
        />
      </div>
      <div className={styles.twoColumns}>
        <Funnel
          title="Acesso por pessoa"
          steps={data.people}
          note={`E-mails únicos com acesso liberado de ${range}; conta criada no período; vínculo em uma casa. Cada taxa usa a etapa anterior.`}
        />
        <Funnel
          title="Ativação por casa"
          steps={data.activation}
          note={`Casas criadas de ${range} com 7 dias completos de observação. Duas pessoas, primeira tarefa e primeira conclusão até o 7º dia. Cada taxa usa a etapa anterior.`}
        />
      </div>
      <div className={styles.twoColumns}>
        <Card>
          <span className={styles.eyebrow}>USO SEMANAL</span>
          <h2>Casas ativas</h2>
          <p className={styles.finePrint}>
            Casa ativa = criação ou conclusão de tarefa na semana. Só casas do
            segmento; semana parcial pode ter menos atividade.
          </p>
          <div
            className={styles.chart}
            role="group"
            aria-label="Gráfico de barras de casas ativas por semana. Valores detalhados na tabela seguinte."
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weeklyActive} accessibilityLayer>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis allowDecimals={false} width={30} />
                <Tooltip />
                <Bar
                  dataKey="houses"
                  name="Casas ativas"
                  fill="var(--color-primary)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.tableWrap} role="region" aria-label="Casas ativas por semana" tabIndex={0}>
            <table>
              <caption>Casas ativas por semana</caption>
              <thead>
                <tr>
                  <th>Semana iniciada</th>
                  <th>Casas ativas</th>
                  <th>Casas existentes</th>
                </tr>
              </thead>
              <tbody>
                {data.weeklyActive.map((row) => (
                  <tr key={row.week}>
                    <th scope="row">{row.week}</th>
                    <td>{row.houses}</td>
                    <td>{row.denominator}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <span className={styles.eyebrow}>RETENÇÃO</span>
          <h2>Voltaram a usar?</h2>
          <p className={styles.finePrint}>
            Casas criadas no período selecionado, agrupadas pela semana de
            criação. Semana 1 = dias 7–13; semana 4 = dias 28–34. “—” indica
            coorte sem tempo suficiente. Atividade é criação ou conclusão de
            tarefa.
          </p>
          <div className={styles.tableWrap} role="region" aria-label="Retenção de casas por coorte" tabIndex={0}>
            <table>
              <caption>Retenção de casas por coorte</caption>
              <thead>
                <tr>
                  <th>Coorte</th>
                  <th>Casas</th>
                  <th>Semana 1</th>
                  <th>Semana 4</th>
                </tr>
              </thead>
              <tbody>
                {data.cohorts.map((row) => (
                  <tr key={row.week}>
                    <th scope="row">{row.week}</th>
                    <td>{row.houses}</td>
                    <td>
                      {row.week1 === undefined
                        ? "—"
                        : `${row.week1}/${row.week1Denominator}`}
                    </td>
                    <td>
                      {row.week4 === undefined
                        ? "—"
                        : `${row.week4}/${row.week4Denominator}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <Card className={styles.insights}>
        <span className={styles.eyebrow}>LEITURAS EXPLICÁVEIS</span>
        <h2>O que investigar agora</h2>
        <ul>
          {data.insights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className={styles.finePrint}>
          Sinais, não causalidade. Nenhuma receita, preço ou disposição a pagar
          foi estimada.
        </p>
      </Card>
    </>
  );
}

const adminMenuItems: MobileMenuItem[] = [
  {
    to: "/admin",
    label: "Visão geral",
    end: true,
    icon: LayoutDashboard,
    description: "O pulso do app",
  },
  {
    to: "/admin/usuarios",
    label: "Pessoas",
    icon: UsersRound,
    description: "Contas e atividade",
  },
  {
    to: "/admin/acessos",
    label: "Acessos",
    icon: KeyRound,
    description: "Convites e permissões",
  },
  {
    to: "/admin/casas",
    label: "Casas",
    icon: House,
    description: "Grupos e vínculos",
  },
  {
    to: "/admin/analise",
    label: "Análise",
    icon: ChartNoAxesCombined,
    description: "Funis e retenção",
  },
];

function AdminInner({ themeControl }: { themeControl: ReactNode }) {
  const gateway = useAdminGateway();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ["admin-session"],
    queryFn: () => gateway.session(),
    staleTime: 0,
  });
  const bootstrap = useQuery({
    queryKey: ["bootstrap-status"],
    queryFn: () => gateway.bootstrapStatus?.() ?? Promise.resolve(false),
    enabled: !session.data,
  });
  const onLogin = () => {
    queryClient.setQueryData(["admin-session"], true);
    navigate("/admin");
  };
  const logout = useMutation({
    mutationFn: () => gateway.logout(),
    onSuccess: () => {
      queryClient.setQueryData(["admin-session"], false);
      navigate("/admin/entrar");
    },
  });
  if (session.isPending) return <ConsoleLoading />;
  if (session.error) return <QueryError error={session.error} />;
  if (!session.data)
    return (
      <Routes>
        <Route
          path="entrar"
          element={<Login onLogin={onLogin} themeControl={themeControl} bootstrapEnabled={bootstrap.data ?? false} />}
        />
        <Route path="setup" element={<BootstrapAdmin themeControl={themeControl} />} />
        <Route path="*" element={<Navigate to="/admin/entrar" replace />} />
      </Routes>
    );
  return (
    <section className={styles.console}>
      {import.meta.env.DEV && <div className={styles.demoBanner} role="status">
        <span>DEMONSTRAÇÃO · DADOS FICTÍCIOS</span>
        <span>Alterações se perdem ao atualizar ou fechar a aba. Nenhum e-mail é enviado.</span>
      </div>}
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <Link to="/admin" className={styles.consoleBrand}>
              <img src="/simbolo.svg" alt="" width="38" height="38" />
              <span>
                BASTIDORES<strong>Chega de Briga</strong>
              </span>
            </Link>
            <MobileMenu
              title="Bastidores"
              eyebrow="Chega de Briga"
              navLabel="Console administrativo"
              items={adminMenuItems}
              triggerClassName={styles.menuToggle}
              footer={
                <>
                  {themeControl}
                  <Button
                    className={styles.logout}
                    variant="quiet"
                    disabled={logout.isPending}
                    onClick={() => logout.mutate()}
                  >
                    <LogOut size={18} aria-hidden="true" /> Sair
                  </Button>
                </>
              }
            />
          </div>
          <div className={styles.sidebarPanel}>
            <nav aria-label="Console administrativo">
              {adminMenuItems.map(({ to, label, end, icon: Icon }) => (
                <NavLink key={to} end={end} to={to}>
                  {Icon && <Icon size={19} aria-hidden="true" />} {label}
                </NavLink>
              ))}
            </nav>
            <AppearanceSettings
              key={location.pathname}
              themeControl={themeControl}
              logout={
                <Button
                  className={styles.logout}
                  variant="quiet"
                  disabled={logout.isPending}
                  onClick={() => logout.mutate()}
                >
                  <LogOut size={18} aria-hidden="true" /> Sair
                </Button>
              }
            />
          </div>
        </aside>
        <div className={styles.content}>
          <Routes>
            <Route index element={<Overview />} />
            <Route path="entrar" element={<Navigate to="/admin" replace />} />
            <Route path="usuarios" element={<UsersPage />} />
            <Route path="usuarios/:id" element={<UserDetail />} />
            <Route path="acessos" element={<AccessPage />} />
            <Route path="casas" element={<HousesPage />} />
            <Route path="casas/:id" element={<HouseDetail />} />
            <Route path="analise" element={<AnalyticsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </div>
    </section>
  );
}

export default function AdminApp({
  themeControl,
  gateway,
}: {
  themeControl: ReactNode;
  gateway: AdminGateway;
}) {
  return (
    <QueryClientProvider client={client}>
      <AdminGatewayContext.Provider value={gateway}>
        <AdminInner themeControl={themeControl} />
      </AdminGatewayContext.Provider>
    </QueryClientProvider>
  );
}
