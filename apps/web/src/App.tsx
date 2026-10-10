import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router";
import { ArrowRight, Moon, RotateCcw, Sun } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { tokens } from "@chega-de-briga/design-system/tokens.native";
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  EmptyState,
  IconButton,
  Select,
  StatusBadge,
  TextField,
} from "./components/ui";
import { MobileMenu, type MobileMenuItem } from "./components/MobileMenu";
import { ConsoleLoading } from "./components/ConsoleLoading";
import { SplashScreen } from "./components/SplashScreen";
import { useToast } from "./components/Toast";
import {
  readThemePreference,
  resolveTheme,
  type ThemePreference,
} from "./theme";
import styles from "./App.module.css";

const DevAdmin = import.meta.env.DEV
  ? lazy(() => import("./admin/AdminApp"))
  : null;
const DevAuth = import.meta.env.DEV
  ? lazy(() =>
      import("./auth/AuthApp").then(({ AuthApp }) => ({ default: AuthApp })),
    )
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
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh && !offlineReady) return null;

  return (
    <div className={styles.pwaStatus} role="status">
      <p>
        {needRefresh
          ? "Nova versão pronta para usar."
          : "Pronto para abrir sem conexão."}
      </p>
      {needRefresh && (
        <Button onClick={() => void updateServiceWorker(true)}>
          Atualizar
        </Button>
      )}
      <Button
        variant="quiet"
        onClick={() =>
          needRefresh ? setNeedRefresh(false) : setOfflineReady(false)
        }
      >
        {needRefresh ? "Depois" : "Entendi"}
      </Button>
    </div>
  );
}

function Home() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>
            CASA COMPARTILHADA, VIDA MAIS LEVE
          </span>
          <h1 id="home-title">
            A casa não é um <em>ringue.</em>
          </h1>
          <p>
            Uma casa funciona melhor quando o combinado é claro. Chega de Briga
            está tomando forma para dividir tarefas sem dividir as pessoas.
          </p>
          <Link className={styles.heroLink} to="/componentes">
            Ver componentes <ArrowRight aria-hidden="true" size={20} />
          </Link>
        </div>
        <div className={styles.heroArt} aria-hidden="true">
          <img className={styles.paths} src="/caminhos.svg" alt="" />
          <img className={styles.spark} src="/faisca.svg" alt="" />
          <div className={styles.sticker}>
            TÁ
            <br />
            COMBINADO.
          </div>
        </div>
        <div className={styles.heroFooter}>
          <span>CHEGA DE BRIGA / 01</span>
          <span>MENOS CLIMÃO, MAIS COMBINADO</span>
        </div>
      </section>
      <section className={styles.intro} aria-labelledby="intro-title">
        <span className={styles.eyebrow}>UM JEITO DE FAZER</span>
        <h2 id="intro-title">
          Clareza primeiro.
          <br />
          <em>Personalidade sempre.</em>
        </h2>
        <div className={styles.introGrid}>
          <p>
            As peças visuais já têm cores, palavras, formas e estados
            consistentes. A galeria mostra como elas se comportam antes de
            virarem telas.
          </p>
          <Link to="/componentes" className={styles.textLink}>
            Ver componentes <ArrowRight aria-hidden="true" size={20} />
          </Link>
        </div>
      </section>
    </>
  );
}

function Gallery() {
  const { showToast } = useToast();
  const [done, setDone] = useState(false);
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
          Exemplos isolados, com estados reais de interação. Eles orientam as
          telas que virão.
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
            <TextField
              id="task-date"
              label="Prazo"
              type="date"
              value={due}
              onChange={(event) => setDue(event.target.value)}
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
            <Checkbox
              label="Lavar a louça"
              detail={done ? "Concluída · Júlia" : "Hoje, até 19h · Júlia"}
              checked={done}
              onChange={(event) => {
                const checked = event.target.checked;
                setDone(checked);
                showToast(
                  checked ? "Tarefa concluída" : "Tarefa reaberta",
                  checked ? { action: { label: "Desfazer", onClick: () => setDone(false) } } : undefined,
                );
              }}
            />
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
            Marque a tarefa para ver o feedback breve; Desfazer reabre a tarefa.
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
        <EmptyState
          title="Por aqui, tudo em ordem."
          description="Milagre? Combinado. Quando surgir uma tarefa, ela aparece aqui."
        />
      </div>
    </section>
  );
}

function Access() {
  return (
    <section className={styles.access} aria-labelledby="access-title">
      <div>
        <span className={styles.eyebrow}>ACESSO / PRIMEIRA FASE</span>
        <h1 id="access-title">
          A porta abre
          <br />
          <em>com convite.</em>
        </h1>
        <p>
          O cadastro público ainda está fechado. Nesta fase, só entram pessoas
          convidadas ou com e-mail liberado pela equipe.
        </p>
        <p>
          Convites de moradores dão acesso à casa indicada. Quem recebeu uma
          liberação da equipe pode criar uma casa.
        </p>
        <div className={styles.accessLinks}>
          {import.meta.env.DEV && (
            <>
              <Link to="/entrar" className={styles.heroLink}>
                Entrar <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link to="/criar-conta" className={styles.accessTextLink}>
                Tenho convite ou e-mail liberado
              </Link>
            </>
          )}
          <Link to="/" className={styles.accessTextLink}>
            Voltar ao início
          </Link>
        </div>
      </div>
      <img src="/faisca.svg" alt="" />
    </section>
  );
}

type AuthScreen = "login" | "signup" | "recovery" | "reset" | "home" | "createHouse";

function AuthRoute({
  screen,
  themeControl,
}: {
  screen: AuthScreen;
  themeControl: ReactNode;
}) {
  if (!DevAuth) return <Access />;
  return (
    <Suspense fallback={<ConsoleLoading />}>
      <DevAuth screen={screen} themeControl={themeControl} />
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
  { to: "/componentes", label: "Componentes" },
  { to: "/acesso", label: "Acesso" },
  ...(import.meta.env.DEV ? [{ to: "/admin", label: "Admin demo" }] : []),
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
  const [showStartupSplash, setShowStartupSplash] = useState(
    () => !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
  );
  useEffect(() => {
    if (!showStartupSplash) return;
    const timer = window.setTimeout(() => setShowStartupSplash(false), 900);
    return () => window.clearTimeout(timer);
  }, [showStartupSplash]);
  const isAdmin = import.meta.env.DEV && location.pathname.startsWith("/admin");
  const authScreens: Record<string, AuthScreen> = {
    "/entrar": "login",
    "/criar-conta": "signup",
    "/esqueci-senha": "recovery",
    "/redefinir-senha": "reset",
    "/casa": "home",
    "/criar-casa": "createHouse",
  };
  const authScreen = import.meta.env.DEV
    ? authScreens[location.pathname]
    : undefined;
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
          <Route path="/" element={<Home />} />
          <Route path="/componentes" element={<Gallery />} />
          <Route path="/acesso" element={<Access />} />
          {DevAuth && (
            <>
              <Route path="/entrar" element={authPage("login")} />
              <Route path="/criar-conta" element={authPage("signup")} />
              <Route path="/esqueci-senha" element={authPage("recovery")} />
              <Route path="/redefinir-senha" element={authPage("reset")} />
              <Route path="/casa" element={authPage("home")} />
              <Route path="/criar-casa" element={authPage("createHouse")} />
            </>
          )}
          {DevAdmin && (
            <Route
              path="/admin/*"
              element={
                <Suspense fallback={<ConsoleLoading />}>
                  <DevAdmin
                    themeControl={
                      <ThemeActions
                        theme={theme}
                        preference={preference}
                        change={change}
                        compact
                      />
                    }
                  />
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
        </footer>
      )}
      <PwaStatus />
    </>
  );
}
