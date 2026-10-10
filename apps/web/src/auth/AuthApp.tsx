import {
  createContext,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { ArrowRight, Eye, EyeOff, House, LogOut, ShieldCheck } from "lucide-react";
import { Button, Card, TextField } from "../components/ui";
import { demoAuthGateway } from "../admin/mockGateway";
import type { AuthGateway, AuthSession, InvitationPreview } from "../admin/contracts";
import styles from "./AuthApp.module.css";

type Screen = "login" | "signup" | "recovery" | "reset" | "home" | "createHouse";
const AuthGatewayContext = createContext<AuthGateway>(demoAuthGateway);
const useAuthGateway = () => useContext(AuthGatewayContext);

export function AuthApp({
  screen,
  themeControl,
  gateway = demoAuthGateway,
}: {
  screen: Screen;
  themeControl: ReactNode;
  gateway?: AuthGateway;
}) {
  return (
    <AuthGatewayContext.Provider value={gateway}>
      <AuthFlow screen={screen} themeControl={themeControl} />
    </AuthGatewayContext.Provider>
  );
}

function AuthFlow({ screen, themeControl }: { screen: Screen; themeControl: ReactNode }) {
  const gateway = useAuthGateway();
  const [session, setSession] = useState<AuthSession | null>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;
    void gateway.session().then((value) => {
      if (!current) return;
      setSession(value);
      setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [gateway]);

  function updateSession(value: AuthSession | null) {
    setSession(value);
    setLoading(false);
  }

  const shell = (content: ReactNode) => (
    <AuthLayout themeControl={themeControl}>{content}</AuthLayout>
  );

  if (screen === "home") {
    if (loading) return shell(<Loading />);
    if (!session) return <Navigate to="/entrar" replace />;
    if (!session.memberships.length && session.canCreateHouse)
      return <Navigate to="/criar-casa" replace />;
    return shell(<ResidentHome session={session} onSession={updateSession} />);
  }
  if (screen === "createHouse") {
    if (loading) return shell(<Loading />);
    if (!session) return <Navigate to="/entrar" replace />;
    if (!session.canCreateHouse) return <Navigate to="/casa" replace />;
    return shell(<CreateHouse onSession={updateSession} />);
  }
  if (loading) return shell(<Loading />);
  if (session) return <Navigate to="/casa" replace />;

  switch (screen) {
    case "login":
      return shell(<Login onSession={updateSession} />);
    case "signup":
      return shell(<Signup onSession={updateSession} />);
    case "recovery":
      return shell(<Recovery />);
    case "reset":
      return shell(<ResetPassword />);
  }
}

function AuthLayout({
  children,
  themeControl,
}: {
  children: ReactNode;
  themeControl: ReactNode;
}) {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand} aria-label="Chega de Briga, início">
          <img src="/simbolo.svg" alt="" width="42" height="42" />
          <span>
            chega de <strong>BRIGA</strong>
          </span>
        </Link>
        <div className={styles.headerActions}>
          <span className={styles.demoTag}>DEMO LOCAL</span>
          {themeControl}
        </div>
      </header>
      <div className={styles.layout}>
        <section className={styles.panel}>{children}</section>
        <aside className={styles.art} aria-label="Sobre o Chega de Briga">
          <span className={styles.eyebrow}>CASA COMPARTILHADA, VIDA MAIS LEVE</span>
          <h2>
            A casa não é um <em>ringue.</em>
          </h2>
          <p>Combinados mais claros para dividir a rotina sem dividir as pessoas.</p>
          <img src="/caminhos.svg" alt="" />
          <img className={styles.spark} src="/faisca.svg" alt="" />
        </aside>
      </div>
    </div>
  );
}

function Login({ onSession }: { onSession: (session: AuthSession) => void }) {
  const gateway = useAuthGateway();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await gateway.login(email, password);
      onSession(session);
      navigate(
        session.memberships.length || !session.canCreateHouse
          ? "/casa"
          : "/criar-casa",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={styles.formCard}>
      <span className={styles.eyebrow}>SUA CASA, SEUS COMBINADOS</span>
      <h1>Entrar</h1>
      <p className={styles.lead}>Bom ter você de volta.</p>
      <form className={styles.form} onSubmit={submit}>
        <TextField
          id="resident-email"
          label="E-mail"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <PasswordField
          id="resident-password"
          label="Senha"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          show={showPassword}
          onToggle={() => setShowPassword((value) => !value)}
        />
        <div className={styles.formMeta}>
          <Link to="/esqueci-senha">Esqueci minha senha</Link>
        </div>
        {error && <Feedback tone="error">{error}</Feedback>}
        <Button type="submit" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"} <ArrowRight size={18} aria-hidden="true" />
        </Button>
      </form>
      <p className={styles.switchFlow}>
        Tem convite ou e-mail liberado? <Link to="/criar-conta">Criar conta</Link>
      </p>
      <DemoNote />
    </Card>
  );
}

function Signup({ onSession }: { onSession: (session: AuthSession) => void }) {
  const gateway = useAuthGateway();
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const invitationId = query.get("convite") ?? undefined;
  const [invitation, setInvitation] = useState<InvitationPreview>();
  const [invitationLoading, setInvitationLoading] = useState(Boolean(invitationId));
  const [invitationError, setInvitationError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(query.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!invitationId) {
      setInvitationLoading(false);
      return;
    }
    let current = true;
    setInvitationLoading(true);
    void gateway
      .invitation(invitationId)
      .then((value) => {
        if (!current) return;
        setInvitation(value);
        setEmail(value.email);
        if (value.status !== "pendente")
          setInvitationError("Este convite não está mais válido. Peça um novo acesso.");
        else setInvitationError("");
      })
      .catch((reason: unknown) => {
        if (!current) return;
        setInvitationError(
          reason instanceof Error ? reason.message : "Não foi possível abrir o convite.",
        );
      })
      .finally(() => current && setInvitationLoading(false));
    return () => {
      current = false;
    };
  }, [invitationId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (invitationId && (!invitation || invitation.status !== "pendente")) {
      setError(invitationError || "Este convite não está mais válido.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }
    setBusy(true);
    try {
      const session = await gateway.register({
        name,
        email,
        password,
        invitationId,
      });
      onSession(session);
      navigate(
        session.memberships.length || !session.canCreateHouse
          ? "/casa"
          : "/criar-casa",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar a conta.");
    } finally {
      setBusy(false);
    }
  }

  const invalidInvite = Boolean(invitationId && invitationError);
  return (
    <Card className={styles.formCard}>
      <span className={styles.eyebrow}>ACESSO POR CONVITE OU LIBERAÇÃO</span>
      <h1>Criar conta</h1>
      <p className={styles.lead}>Vamos começar pelo básico.</p>
      {invitationLoading ? (
        <Loading label="Conferindo convite…" />
      ) : (
        <>
          {invitation && invitation.status === "pendente" && (
            <Feedback tone="info">
              Convite válido
              {invitation.householdName ? ` para ${invitation.householdName}` : " da equipe"}. O e-mail já está definido.
            </Feedback>
          )}
          {invalidInvite && <Feedback tone="error">{invitationError}</Feedback>}
          <form className={styles.form} onSubmit={submit}>
            <TextField
              id="resident-name"
              label="Como podemos chamar você?"
              autoComplete="name"
              maxLength={100}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <TextField
              id="resident-signup-email"
              label="E-mail"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              readOnly={Boolean(invitationId)}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              hint={invitationId ? "O convite está vinculado a este e-mail." : "Use o e-mail autorizado pela equipe."}
            />
            <PasswordField
              id="resident-new-password"
              label="Crie uma senha"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              hint="Pelo menos 8 caracteres."
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              show={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
            />
            <PasswordField
              id="resident-confirm-password"
              label="Repita a senha"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              show={showConfirm}
              onToggle={() => setShowConfirm((value) => !value)}
            />
            {error && <Feedback tone="error">{error}</Feedback>}
            <Button type="submit" disabled={busy || invalidInvite}>
              {busy ? "Criando conta…" : "Criar conta"} <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </form>
          <p className={styles.switchFlow}>
            Já tem uma conta? <Link to="/entrar">Entrar</Link>
          </p>
          <DemoNote />
        </>
      )}
    </Card>
  );
}

function Recovery() {
  const gateway = useAuthGateway();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetLink, setResetLink] = useState<string>();
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setResetLink(await gateway.requestPasswordReset(email));
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível pedir a recuperação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={styles.formCard}>
      <span className={styles.eyebrow}>RECUPERAR ACESSO</span>
      <h1>Esqueceu a senha?</h1>
      {sent ? (
        <div className={styles.confirmation} role="status">
          <p>Se houver uma conta com esse e-mail, o link de redefinição estará disponível na demonstração.</p>
          {resetLink && (
            <Link className={styles.resetLink} to={resetLink}>
              Abrir link de redefinição <ArrowRight size={17} aria-hidden="true" />
            </Link>
          )}
          <p className={styles.finePrint}>Nenhum e-mail foi enviado. O link de teste expira em 30 minutos e só pode ser usado uma vez.</p>
        </div>
      ) : (
        <>
          <p className={styles.lead}>Informe o e-mail da sua conta.</p>
          <form className={styles.form} onSubmit={submit}>
            <TextField
              id="recovery-email"
              label="E-mail"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {error && <Feedback tone="error">{error}</Feedback>}
            <Button type="submit" disabled={busy}>
              {busy ? "Preparando link…" : "Continuar"} <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </form>
        </>
      )}
      <p className={styles.switchFlow}>
        <Link to="/entrar">Voltar para entrar</Link>
      </p>
      <DemoNote />
    </Card>
  );
}

function ResetPassword() {
  const gateway = useAuthGateway();
  const location = useLocation();
  const navigate = useNavigate();
  const token = new URLSearchParams(location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }
    setBusy(true);
    try {
      await gateway.resetPassword(token, password);
      setComplete(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível trocar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={styles.formCard}>
      <span className={styles.eyebrow}>NOVA SENHA</span>
      <h1>Crie outra senha</h1>
      {complete ? (
        <div className={styles.confirmation} role="status">
          <p>Senha alterada na demonstração. Entre com a nova senha para continuar.</p>
          <Button onClick={() => navigate("/entrar")}>Ir para entrar</Button>
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          <PasswordField
            id="reset-password"
            label="Nova senha"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            hint="Pelo menos 8 caracteres."
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            show={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
          />
          <PasswordField
            id="reset-confirm-password"
            label="Repita a senha"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            show={showConfirm}
            onToggle={() => setShowConfirm((value) => !value)}
          />
          {error && <Feedback tone="error">{error}</Feedback>}
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando…" : "Salvar nova senha"} <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </form>
      )}
      <p className={styles.switchFlow}>
        <Link to="/esqueci-senha">Pedir outro link</Link>
      </p>
      <DemoNote />
    </Card>
  );
}

function CreateHouse({
  onSession,
}: {
  onSession: (session: AuthSession) => void;
}) {
  const gateway = useAuthGateway();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSession(await gateway.createHouse(name));
      navigate("/casa");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar a casa.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={styles.formCard}>
      <span className={styles.eyebrow}>PRIMEIRO COMBINADO</span>
      <House size={28} aria-hidden="true" />
      <h1>Sua casa começa com um nome.</h1>
      <p className={styles.lead}>Você poderá convidar quem divide esse espaço com você.</p>
      <form className={styles.form} onSubmit={submit}>
        <TextField
          id="house-name"
          label="Nome da casa"
          placeholder="Ex.: Apê da Rua do Sol"
          autoComplete="off"
          maxLength={60}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {error && <Feedback tone="error">{error}</Feedback>}
        <Button type="submit" disabled={busy}>
          {busy ? "Criando…" : "Criar casa"} <ArrowRight size={18} aria-hidden="true" />
        </Button>
      </form>
      <DemoNote />
    </Card>
  );
}

function ResidentHome({
  session,
  onSession,
}: {
  session: AuthSession;
  onSession: (session: AuthSession | null) => void;
}) {
  const gateway = useAuthGateway();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    await gateway.logout();
    onSession(null);
    navigate("/entrar");
  }
  return (
    <Card className={styles.formCard}>
      <span className={styles.eyebrow}>ÁREA DA CASA · DEMONSTRAÇÃO</span>
      <h1>Oi, {session.user.name}.</h1>
      <p className={styles.lead}>Sua entrada deu certo. Os combinados da casa chegam na próxima etapa.</p>
      {session.memberships.map((membership) => (
        <div className={styles.house} key={membership.householdId}>
          <House size={20} aria-hidden="true" />
          <span>{membership.householdName}</span>
        </div>
      ))}
      {session.canCreateHouse && session.memberships.length > 0 && (
        <Button variant="secondary" onClick={() => navigate("/criar-casa")}>
          Criar outra casa
        </Button>
      )}
      <div className={styles.homeActions}>
        <Link to="/" className={styles.backLink}>Voltar ao início</Link>
        <Button variant="quiet" onClick={() => void logout()} disabled={busy}>
          <LogOut size={17} aria-hidden="true" /> Sair
        </Button>
      </div>
      <DemoNote />
    </Card>
  );
}

function PasswordField({
  id,
  label,
  show,
  onToggle,
  ...props
}: {
  id: string;
  label: string;
  show: boolean;
  onToggle: () => void;
} & Omit<React.ComponentProps<typeof TextField>, "id" | "label">) {
  return (
    <div className={styles.passwordField}>
      <TextField
        {...props}
        id={id}
        label={label}
        type={show ? "text" : "password"}
      />
      <button
        type="button"
        className={styles.passwordToggle}
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        data-tooltip={show ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={show}
        onClick={onToggle}
      >
        {show ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
      </button>
    </div>
  );
}

function Feedback({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "info" | "error";
}) {
  return (
    <p className={`${styles.feedback} ${styles[tone]}`} role={tone === "error" ? "alert" : "status"}>
      {tone === "info" && <ShieldCheck size={17} aria-hidden="true" />}
      {children}
    </p>
  );
}

function DemoNote() {
  return (
    <p className={styles.demoNote}>
      Demonstração local: nenhuma conta real é criada e nenhum e-mail é enviado.
    </p>
  );
}

function Loading({ label = "Abrindo sua área…" }: { label?: string }) {
  return <p className={styles.loading} role="status">{label}</p>;
}
