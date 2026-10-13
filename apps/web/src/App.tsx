import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router";
import { ArrowRight, Check, Moon, RotateCcw, Sun } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { tokens } from "@chega-de-briga/design-system/tokens.native";
import {
  Avatar,
  Button,
  Card,
  DatePicker,
  EmptyState,
  IconButton,
  Select,
  StatusBadge,
  TextField,
} from "./components/ui";
import { MobileMenu, type MobileMenuItem } from "./components/MobileMenu";
import { BottomSheet, ConfirmDialog } from "./components/ResidentOverlays";
import { ConsoleLoading } from "./components/ConsoleLoading";
import { SplashScreen } from "./components/SplashScreen";
import { useToast } from "./components/Toast";
import {
  readThemePreference,
  resolveTheme,
  type ThemePreference,
} from "./theme";
import styles from "./App.module.css";

const demoMode = import.meta.env.MODE === "demo";
const DevAdmin = demoMode
  ? lazy(() => import("./admin/DemoAdminApp"))
  : null;
const ProdAdmin = !demoMode
  ? lazy(() => import("./admin/ProductionAdminApp"))
  : null;
const DevAuth = demoMode
  ? lazy(() => import("./auth/DemoAuthApp"))
  : null;
const ProdAuth = !demoMode
  ? lazy(() => import("./auth/ProductionAuthApp"))
  : null;
const DevLanding = import.meta.env.DEV
  ? lazy(() => import("./LandingPage").then(({ LandingPage }) => ({ default: LandingPage })))
  : null;

const themeOptions = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
];
const assigneeOptions = [
  { value: "a-combinar", label: "A combinar" },
  { value: "julia", label: "Júlia" },
  { value: "caio", label: "Caio" },
  { value: "lia", label: "Lia" },
];
const landingOrigin = import.meta.env.DEV ? window.location.origin : "https://chegadebriga.forjacorp.com";

function useTheme() {
  const [preference, setPreference] =
    useState<ThemePreference>(readThemePreference);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const theme = resolveTheme(preference, media.matches);
      document.documentElement.dataset.theme = theme;
      setTheme(theme);
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", tokens.color[theme].bg);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "cdb-theme") setPreference(readThemePreference());
    };
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("storage", onStorage);
    };
  }, [preference]);

  function change(next: ThemePreference) {
    setPreference(next);
    try {
      if (next === "system") localStorage.removeItem("cdb-theme");
      else localStorage.setItem("cdb-theme", next);
    } catch {
      /* A escolha ainda vale nesta aba. */
    }
  }

  return { preference, theme, change };
}

function PwaStatus() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className={styles.pwaStatus} role="status">
      <p>Nova versão pronta para usar.</p>
      <Button onClick={() => void updateServiceWorker(true)}>Atualizar</Button>
      <Button
        variant="quiet"
        onClick={() => setNeedRefresh(false)}
      >
        Depois
      </Button>
    </div>
  );
}

function Home() {
  return DevLanding ? (
    <Suspense fallback={<SplashScreen title="Chega de Briga" detail="Combinados mais claros para quem divide a casa." />}>
      <DevLanding />
    </Suspense>
  ) : null;
}

function Gallery() {
  const { showToast } = useToast();
  const [done, setDone] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState("a-combinar");
  const [actionNote, setActionNote] = useState(
    "Os botões preenchem ou limpam o campo de nome no cartão seguinte.",
  );
  return (
    <section className={styles.gallery} aria-labelledby="gallery-title">
      <div className={styles.galleryHeading}>
        <span className={styles.eyebrow}>BIBLIOTECA DE INTERFACE / 01</span>
        <h1 id="gallery-title">
          Cada peça no <em>seu lugar.</em>
        </h1>
        <p>
          Exemplos interativos da biblioteca de interface. Consulte o guia de
          componentes para escolher o padrão adequado a cada intenção.
        </p>
      </div>
      <div className={styles.galleryGrid}>
        <Card className={styles.actionCard}>
          <span className={styles.panelTag}>AÇÕES</span>
          <h2>Botões com intenção</h2>
          <div className={styles.buttonRow}>
            <Button
              onClick={() => {
                setName("Tirar o lixo");
                setActionNote("Campo de nome preenchido no cartão seguinte.");
              }}
            >
              Usar exemplo <ArrowRight aria-hidden="true" size={18} />
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setName("");
                setActionNote("Campo de nome limpo no cartão seguinte.");
              }}
            >
              Limpar campo
            </Button>
            <Button
              variant="quiet"
              onClick={() =>
                setActionNote("Tudo bem. A galeria continua aqui.")
              }
            >
              Agora não
            </Button>
            <Button disabled>Indisponível</Button>
          </div>
          <p className={styles.note} aria-live="polite">
            {actionNote}
          </p>
        </Card>
        <Card className={styles.accentCard}>
          <span className={styles.panelTag}>CAMPOS</span>
          <h2>Perguntar sem enrolar</h2>
          <div className={styles.fieldStack}>
            <TextField
              id="task-name"
              label="Nome da tarefa"
              placeholder="Ex.: tirar o lixo"
              hint="Dê um nome que todo mundo entenda."
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <DatePicker
              id="task-date"
              label="Prazo"
              value={due}
              onChange={setDue}
              error={due ? undefined : "Escolha uma data para o prazo."}
            />
            <Select
              label="Responsável"
              value={assignee}
              options={assigneeOptions}
              onChange={setAssignee}
            />
            <div className={styles.compactSelectDemo}>
              <Select
                label="Responsável, versão compacta"
                variant="compact"
                value={assignee}
                options={assigneeOptions}
                onChange={setAssignee}
              />
              <span>O mesmo seletor, compacto.</span>
            </div>
          </div>
        </Card>
        <Card className={styles.taskCard}>
          <span className={styles.panelTag}>TAREFA / EXEMPLO</span>
          <h2>O essencial primeiro</h2>
          <div className={styles.taskRow}>
            <span className={styles.taskContent}>
              <strong>Lavar a louça</strong>
              <small>{done ? "Júlia" : "Hoje, até 19h · Júlia"}</small>
            </span>
            {done ? (
              <StatusBadge tone="success">Concluída</StatusBadge>
            ) : (
              <Button onClick={() => {
                setDone(true);
                showToast("Tarefa concluída", {
                  action: { label: "Desfazer", onClick: () => setDone(false) },
                });
              }}>
                <Check size={18} aria-hidden="true" /> Concluir
              </Button>
            )}
            <IconButton
              label="Recomeçar exemplo"
              icon={<RotateCcw aria-hidden="true" />}
              onClick={() => {
                setDone(false);
                showToast("Exemplo reiniciado");
              }}
            />
          </div>
          <p className={styles.note}>
            Conclua para ver o Toast; Desfazer restaura a tarefa. O ícone reinicia este exemplo.
          </p>
        </Card>
        <Card>
          <span className={styles.panelTag}>PESSOAS E ESTADOS</span>
          <h2>Sem placar de culpa</h2>
          <div
            className={styles.avatarRow}
            role="group"
            aria-label="Participantes: Júlia, Caio e Lia"
          >
            <Avatar name="Júlia" initials="JU" />
            <Avatar name="Caio" initials="CA" tone="lilac" />
            <Avatar name="Lia" initials="LI" tone="sun" />
          </div>
          <div className={styles.statusRow}>
            <StatusBadge tone="success">Em dia</StatusBadge>
            <StatusBadge tone="warning">Vence hoje</StatusBadge>
            <StatusBadge tone="danger">Passou do prazo</StatusBadge>
          </div>
        </Card>
        <Card className={styles.actionCard}>
          <span className={styles.panelTag}>ESCOLHAS / CONFIRMAÇÕES</span>
          <h2>Decisões no contexto certo</h2>
          <div className={styles.buttonRow}>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>Escolher uma opção</Button>
            <Button onClick={() => setConfirmOpen(true)}>Abrir confirmação</Button>
          </div>
          <p className={styles.note}>Escolha curta volta ao mesmo ponto; ação difícil de reverter explica o efeito antes de confirmar.</p>
          <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Trocar de casa">
            <p>Selecione uma opção e continue no mesmo fluxo.</p>
            <Button onClick={() => { setSheetOpen(false); showToast("Casa de exemplo selecionada."); }}>Casa de exemplo</Button>
          </BottomSheet>
          <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Remover este exemplo?" description="Esta ação serve apenas para demonstrar uma confirmação. Nenhum dado será apagado." confirmLabel="Confirmar remoção" onConfirm={() => showToast("Confirmação demonstrada.")} />
        </Card>
        <EmptyState
          title="Por aqui, tudo em ordem."
          description="Milagre? Combinado. Quando surgir uma tarefa, ela aparece aqui."
        />
      </div>
    </section>
  );
}

function Access() {
  const [signupEnabled, setSignupEnabled] = useState(false);
  useEffect(() => {
    void fetch("/api/public/config")
      .then((response) => response.ok ? response.json() as Promise<{ signupEnabled?: boolean }> : undefined)
      .then((value) => setSignupEnabled(value?.signupEnabled === true))
      .catch(() => undefined);
  }, []);
  return (
    <section className={styles.access} aria-labelledby="access-title">
      <div>
        <span className={styles.eyebrow}>ACESSO / PRIMEIRA FASE</span>
          <h1 id="access-title">{signupEnabled ? <>A porta está <em>aberta.</em></> : <>A porta abre<br /><em>com convite.</em></>}</h1>
        <p>{signupEnabled ? "O cadastro público está aberto. Crie sua conta para organizar os combinados da casa." : "O cadastro público ainda está fechado. Nesta fase, só entram pessoas convidadas ou com e-mail liberado pela equipe."}</p>
        {!signupEnabled && <p>Convites de moradores dão acesso à casa indicada. Quem recebeu uma liberação da equipe pode criar uma casa.</p>}
        <div className={styles.accessLinks}>
          {signupEnabled ? <Link to="/criar-conta" className={styles.heroLink}>Criar conta <ArrowRight size={18} aria-hidden="true" /></Link> : <>
            <Link to="/entrar" className={styles.heroLink}>Entrar <ArrowRight size={18} aria-hidden="true" /></Link>
            <Link to="/criar-conta" className={styles.accessTextLink}>Tenho convite ou e-mail liberado</Link>
          </>}
          <a href={landingOrigin} className={styles.accessTextLink}>
            Voltar ao início
          </a>
        </div>
      </div>
      <img src="/faisca.svg" alt="" />
    </section>
  );
}

function PrivacyNotice() {
  return (
    <section className={styles.privacyNotice} aria-labelledby="privacy-title">
      <Card className={styles.privacyCard}>
        <span className={styles.eyebrow}>PRIVACIDADE</span>
        <h1 id="privacy-title">Aviso de privacidade</h1>
        <p>Este aviso explica quais dados o Chega de Briga usa para oferecer a PWA, como eles são compartilhados e como pedir informações ou exercer seus direitos.</p>

        <h2>Quem é responsável</h2>
        <p><strong>65.086.651 VINICIUS MORAES VALENCA VARJAO</strong>, que atua sob a marca ForjaCorp. Contato: <a href="mailto:forjacorp@gmail.com">forjacorp@gmail.com</a>.</p>

        <h2>Dados usados</h2>
        <ul>
          <li><strong>Conta:</strong> nome, e-mail, senha protegida por hash, confirmação de e-mail e registros de sessão.</li>
          <li><strong>Casa:</strong> nome da casa, moradores e papéis, tarefas e recorrências, responsáveis, ocorrências, lista de compras e convites. Os moradores da casa veem os dados compartilhados nela.</li>
          <li><strong>Uso e segurança:</strong> eventos necessários para métricas, operação e auditoria administrativa, como horário de acesso e alterações identificadas por tipo e IDs; ações de autorização também podem registrar o e-mail afetado.</li>
          <li><strong>Lista de espera:</strong> se você optar por entrar, guardamos o e-mail ou WhatsApp escolhido, o canal autorizado, a data e a versão da autorização e as tags de campanha da página. Não pedimos nome, não enviamos mensagens nesta fase e não associamos seu contato a uma conta individualmente.</li>
          <li><strong>Lembretes:</strong> horário e preferência de notificação, além da assinatura técnica do dispositivo. Um push pode mostrar os títulos das tarefas atribuídas à pessoa.</li>
          <li><strong>Armazenamento no aparelho:</strong> a PWA mantém em IndexedDB uma sessão em cache e uma cópia local do estado da casa e de alterações pendentes de compras, para consulta e uso offline. Ao sair conectado, o app tenta limpar essa cópia; ela também pode ser apagada nas configurações do navegador.</li>
        </ul>

        <h2>Finalidades e compartilhamento</h2>
        <p>Usamos os dados para autenticar contas, permitir o uso compartilhado da casa, sincronizar tarefas e compras, enviar convites e e-mails de acesso, entregar lembretes escolhidos pela pessoa, proteger o serviço e produzir métricas administrativas sem títulos de tarefas ou itens de compras. Na lista de espera, o contato é usado somente para avisar sobre a abertura pelo canal escolhido. As métricas da landing contam carregamentos e inícios do formulário, sem identificador de visitante, cookie analítico, endereço IP como dado de produto ou gravação de sessão.</p>
        <p>O conteúdo doméstico é compartilhado com os membros da mesma casa. E-mails transacionais são enviados pelo Gmail. Notificações passam pelos serviços de push do navegador e do sistema operacional. O serviço usa PostgreSQL em um servidor configurado pela ForjaCorp.</p>

        <h2>Retenção e exclusão</h2>
        <p>Dados da conta e da casa permanecem enquanto a conta e os registros compartilhados existirem. Contatos da lista de espera são apagados 90 dias após a abertura pública; se o lançamento não ocorrer, permanecem até essa data ser definida e você pode pedir a remoção antes. Eventos de uso são removidos após 90 dias; auditorias administrativas, após 12 meses; cópias de backup, em até 30 dias. O histórico doméstico pode ser mantido de forma anonimizada quando outros moradores ainda dependem dele. Encerrar uma conta também remove suas sessões e assinaturas de push.</p>
        <p>O perfil permite baixar uma cópia dos dados e iniciar a exclusão da conta. Uma conta que também tenha acesso administrativo precisa ter esse papel removido antes da exclusão completa.</p>

        <h2>Seus direitos</h2>
        <p>Você pode pedir confirmação e acesso aos dados, correção, anonimização, bloqueio, portabilidade e eliminação quando aplicável, além de informações sobre compartilhamento. Também pode revogar consentimentos e se opor ao tratamento nos casos previstos em lei. Escreva para <a href="mailto:forjacorp@gmail.com">forjacorp@gmail.com</a>. Consulte as <a href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares" target="_blank" rel="noreferrer">informações da ANPD sobre direitos dos titulares</a>.</p>
      </Card>
    </section>
  );
}

type AuthScreen = "login" | "signup" | "recovery" | "reset" | "verify" | "home" | "createHouse";

function AuthRoute({
  screen,
  themeControl,
}: {
  screen: AuthScreen;
  themeControl: ReactNode;
}) {
  const Auth = DevAuth ?? ProdAuth;
  if (!Auth) return <Access />;
  return (
    <Suspense fallback={<ConsoleLoading />}>
      <Auth screen={screen} themeControl={themeControl} />
    </Suspense>
  );
}

function ThemeActions({
  theme,
  preference,
  change,
  compact = false,
}: {
  theme: "light" | "dark";
  preference: ThemePreference;
  change: (next: ThemePreference) => void;
  compact?: boolean;
}) {
  const next = theme === "dark" ? "light" : "dark";
  const label = `Ativar modo ${next === "dark" ? "escuro" : "claro"}`;
  return (
    <div className={`${styles.themeActions} ${compact ? styles.themeActionsCompact : ""}`}>
      <button
        type="button"
        className={styles.themeToggle}
        aria-label={label}
        data-tooltip={label}
        onClick={() => change(next)}
      >
        {theme === "dark" ? <Sun size={21} aria-hidden="true" /> : <Moon size={21} aria-hidden="true" />}
        <span>{label}</span>
      </button>
      <Select
        label="Tema"
        variant="compact"
        className={styles.themeChoice}
        value={preference}
        options={themeOptions}
        onChange={(value) => change(value as ThemePreference)}
      />
    </div>
  );
}

const publicMenuItems: MobileMenuItem[] = [
  { to: "/", label: "Início", end: true },
  { to: "/#rotinas", label: "Tarefas e rotinas" },
  { to: "/#compras", label: "Compras" },
  { to: "/#lista-de-espera", label: "Lista de espera" },
  ...(import.meta.env.DEV ? [{ to: "/componentes", label: "Componentes" }] : []),
  ...(import.meta.env.DEV ? [{ to: "/admin", label: demoMode ? "Admin demo" : "Admin" }] : []),
];

function PublicLinks() {
  return publicMenuItems.map(({ to, label, end }) => (
    <NavLink key={to} to={to} end={end}>
      {label}
    </NavLink>
  ));
}

export function App() {
  const { preference, theme, change } = useTheme();
  const location = useLocation();
  useEffect(() => {
    if (!location.hash) return;
    let targetId: string;
    try {
      targetId = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    if (!targetId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, location.pathname]);
  const [showStartupSplash, setShowStartupSplash] = useState(
    () => !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
  );
  useEffect(() => {
    if (!showStartupSplash) return;
    const timer = window.setTimeout(() => setShowStartupSplash(false), 900);
    return () => window.clearTimeout(timer);
  }, [showStartupSplash]);
  const isAdmin = location.pathname.startsWith("/admin");
  const authScreens: Record<string, AuthScreen> = {
    "/entrar": "login",
    "/criar-conta": "signup",
    "/esqueci-senha": "recovery",
    "/redefinir-senha": "reset",
    "/confirmar-email": "verify",
    "/casa": "home",
    "/criar-casa": "createHouse",
  };
  const authScreen = authScreens[location.pathname] ?? (location.pathname.startsWith("/casa/") ? "home" : undefined);
  const isStandalone = isAdmin || Boolean(authScreen);
  const authPage = (screen: AuthScreen) => (
    <AuthRoute
      screen={screen}
      themeControl={
        <ThemeActions
          theme={theme}
          preference={preference}
          change={change}
          compact
        />
      }
    />
  );

  if (showStartupSplash) {
    return (
      <SplashScreen
        title="A casa não é um ringue."
        detail="Combinados mais claros para quem divide a casa."
      />
    );
  }

  return (
    <>
      <a className={styles.skipLink} href="#conteudo">
        Pular para o conteúdo
      </a>
      {!isStandalone && (
        <header className={styles.header}>
          <Link
            className={styles.brand}
            to="/"
            aria-label="Chega de Briga, início"
          >
            <img src="/simbolo.svg" alt="" width="42" height="42" />
            <span>
              chega de <strong>BRIGA</strong>
            </span>
          </Link>
          <nav
            className={`${styles.nav} ${styles.desktopNav}`}
            aria-label="Navegação principal"
          >
            <PublicLinks />
          </nav>
          <ThemeActions
            key={`appearance-${location.pathname}`}
            theme={theme}
            preference={preference}
            change={change}
          />
          <MobileMenu
            title="Pra onde?"
            eyebrow="Chega de Briga"
            navLabel="Navegação principal"
            items={publicMenuItems}
            triggerClassName={styles.mobileMenuTrigger}
          />
        </header>
      )}
      <main id="conteudo">
        <Routes>
          <Route path="/" element={import.meta.env.DEV ? <Home /> : <Navigate to="/casa" replace />} />
          <Route path="/componentes" element={import.meta.env.DEV ? <Gallery /> : <Navigate to="/" replace />} />
          <Route path="/acesso" element={<Access />} />
          <Route path="/privacidade" element={<PrivacyNotice />} />
          {(DevAuth || ProdAuth) && (
            <>
              <Route path="/entrar" element={authPage("login")} />
              <Route path="/criar-conta" element={authPage("signup")} />
              <Route path="/esqueci-senha" element={authPage("recovery")} />
              <Route path="/redefinir-senha" element={authPage("reset")} />
              <Route path="/confirmar-email" element={authPage("verify")} />
              <Route path="/casa" element={authPage("home")} />
              <Route path="/casa/*" element={authPage("home")} />
              <Route path="/criar-casa" element={authPage("createHouse")} />
            </>
          )}
          {(DevAdmin || ProdAdmin) && (
            <Route
              path="/admin/*"
              element={
                <Suspense fallback={<ConsoleLoading />}>
                  {(() => {
                    const Admin = DevAdmin ?? ProdAdmin;
                    if (!Admin) return null;
                    return <Admin
                    themeControl={
                      <ThemeActions
                        theme={theme}
                        preference={preference}
                        change={change}
                        compact
                      />
                    }
                  />;
                  })()}
                </Suspense>
              }
            />
          )}
          <Route
            path="*"
            element={import.meta.env.DEV ? <Home /> : <Access />}
          />
        </Routes>
      </main>
      {!isStandalone && (
        <footer className={styles.footer}>
          <img src="/logo-invertido.svg" alt="Chega de Briga" />
          <p>Casa compartilhada. Responsabilidade também.</p>
          <Link to="/privacidade">Aviso de privacidade</Link>
        </footer>
      )}
      <PwaStatus />
    </>
  );
}
