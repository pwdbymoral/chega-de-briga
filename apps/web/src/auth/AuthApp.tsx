import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { ArrowRight, Eye, EyeOff, House, ShieldCheck } from "lucide-react";
import { Button, Card, TextField } from "../components/ui";
import { useToast } from "../components/Toast";
import { errorMessage } from "../api/http";
import type { AuthGateway, AuthSession, InvitationPreview } from "../admin/contracts";
import { ResidentApp } from "../resident/ResidentApp";
import { clearCachedHouses, readCachedSession, writeCachedSession } from "../resident/localCache";
import styles from "./AuthApp.module.css";

export type AuthScreen = "login" | "signup" | "recovery" | "reset" | "verify" | "home" | "createHouse";
const AuthGatewayContext = createContext<AuthGateway | null>(null);
const useAuthGateway = () => {
  const gateway = useContext(AuthGatewayContext);
  if (!gateway) throw new Error("AuthGateway is required");
  return gateway;
};

export function AuthApp({
  screen,
  themeControl,
  gateway,
}: {
  screen: AuthScreen;
  themeControl: ReactNode;
  gateway: AuthGateway;
}) {
  return (
    <AuthGatewayContext.Provider value={gateway}>
      <AuthFlow screen={screen} themeControl={themeControl} />
    </AuthGatewayContext.Provider>
  );
}

function AuthFlow({ screen, themeControl }: { screen: AuthScreen; themeControl: ReactNode }) {
  const gateway = useAuthGateway();
  const { showToast } = useToast();
  const [session, setSession] = useState<AuthSession | null>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;
    void gateway.session().then((value) => {
      if (!current) return;
      setSession(value);
    }).catch((error: unknown) => {
      return readCachedSession().then((cached) => {
        if (!current) return;
        if (cached) setSession(cached);
        else {
          setSession(null);
          showToast(errorMessage(error, "Não foi possível verificar sua sessão. Confira sua conexão e tente novamente."));
        }
      }).catch(() => { if (current) setSession(null); });
    }).finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [gateway, showToast]);

  useEffect(() => {
    if (session === undefined) return;
    if (session) void writeCachedSession(session).catch(() => showToast("Não foi possível guardar a sessão neste aparelho. Confira o espaço disponível e tente novamente."));
    else if (navigator.onLine) void clearCachedHouses().catch(() => showToast("Não foi possível limpar a cópia local da sessão. Feche o app após sair e tente novamente."));
  }, [session, showToast]);

  useEffect(() => {
    const refreshSession = () => {
      void gateway.session().then((value) => setSession(value)).catch((error: unknown) => {
        showToast(errorMessage(error, "Não foi possível atualizar sua sessão. Confira sua conexão e tente novamente."));
      });
    };
    window.addEventListener("online", refreshSession);
    return () => window.removeEventListener("online", refreshSession);
  }, [gateway, showToast]);

  const updateSession = useCallback((value: AuthSession | null) => {
    setSession(value);
    setLoading(false);
  }, []);

  const shell = (content: ReactNode) => (
    <AuthLayout themeControl={themeControl}>{content}</AuthLayout>
  );

  if (screen === "home") {
    if (loading) return shell(<Loading />);
    if (!session) return <Navigate to="/entrar" replace />;
    if (!session.memberships.length && session.canCreateHouse)
      return <Navigate to="/criar-casa" replace />;
    return <ResidentHome session={session} onSession={updateSession} themeControl={themeControl} />;
  }
  if (screen === "createHouse") {
    if (loading) return shell(<Loading />);
    if (!session) return <Navigate to="/entrar" replace />;
    if (!session.canCreateHouse) return <Navigate to="/casa" replace />;
    return shell(<CreateHouse onSession={updateSession} />);
  }
  if (screen === "verify") {
    if (loading) return shell(<Loading />);
    if (session) return <Navigate to="/casa" replace />;
    return shell(<VerifyEmail onSession={updateSession} />);
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
          {import.meta.env.MODE === "demo" && <span className={styles.demoTag}>DEMO LOCAL</span>}
          {themeControl}
        </div>
      </header>
      <div className={styles.layout}>
        <section className={styles.panel}>
          {children}
          <p className={styles.switchFlow}><Link to="/privacidade">Aviso de privacidade</Link></p>
        </section>
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
      setError(errorMessage(reason, "Confira e-mail e senha. Primeiro acesso residencial? Peça liberação em Acessos ou um convite e escolha “Criar conta”."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={styles.formCard}>
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
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ""));
  const invitationId = query.get("convite") ?? fragment.get("convite") ?? undefined;
  const [invitation, setInvitation] = useState<InvitationPreview>();
  const [invitationLoading, setInvitationLoading] = useState(Boolean(invitationId));
  const [invitationError, setInvitationError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(query.get("email") ?? fragment.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [registrationNotice, setRegistrationNotice] = useState(false);

  useEffect(() => {
    if (invitationId) window.history.replaceState(null, "", location.pathname);
  }, [invitationId, location.pathname]);

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
          errorMessage(reason, "Não foi possível abrir este convite. Confira o link ou peça um novo acesso."),
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
      setError(invitationError || "Este convite não está mais válido. Peça a quem enviou para gerar um novo.");
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
      if (!session) {
        setRegistrationNotice(true);
        return;
      }
      onSession(session);
      navigate(
        session.memberships.length || !session.canCreateHouse
          ? "/casa"
          : "/criar-casa",
      );
    } catch (reason) {
      setError(errorMessage(reason, "Não foi possível criar a conta. Confira o convite ou peça ao admin para liberar o e-mail em Acessos."));
    } finally {
      setBusy(false);
    }
  }

  const invalidInvite = Boolean(invitationId && invitationError);
  return (
    <Card className={styles.formCard}>
      <span className={styles.eyebrow}>ACESSO POR CONVITE OU LIBERAÇÃO</span>
      <h1>Criar conta</h1>
      <p className={styles.lead}>
        Se este e-mail já acessa o painel admin, use a mesma senha. O acesso admin também pede TOTP.
      </p>
      {invitationLoading ? (
        <Loading label="Conferindo convite…" />
      ) : (
        <>
          {registrationNotice && <Feedback tone="info">Confira a caixa de entrada e o spam. Link de confirmação: use-o para liberar o acesso. Sem link: peça ao admin que verifique a liberação em Acessos ou ao responsável que revise o convite. Perfil já criado: use “Entrar”.</Feedback>}
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
              minLength={12}
              maxLength={200}
              hint="Pelo menos 12 caracteres."
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              show={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
            />
            <PasswordField
              id="resident-confirm-password"
              label="Repita a senha"
              autoComplete="new-password"
              minLength={12}
              maxLength={200}
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
      setError(errorMessage(reason, "Não foi possível pedir a recuperação. Confira o e-mail informado e tente novamente."));
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
          <p>{import.meta.env.MODE === "demo" ? "Se houver uma conta com esse e-mail, o link de redefinição estará disponível na demonstração." : "Se houver uma conta com esse e-mail, enviaremos instruções para redefinir a senha."}</p>
          {resetLink && (
            <Link className={styles.resetLink} to={resetLink}>
              Abrir link de redefinição <ArrowRight size={17} aria-hidden="true" />
            </Link>
          )}
          {import.meta.env.MODE === "demo" && <p className={styles.finePrint}>Nenhum e-mail foi enviado. O link de teste expira em 30 minutos e só pode ser usado uma vez.</p>}
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
  const token = new URLSearchParams(location.search).get("token") ?? new URLSearchParams(location.hash.replace(/^#/, "")).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (token) window.history.replaceState(null, "", location.pathname);
  }, [location.pathname, token]);

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
      setError(errorMessage(reason, "Não foi possível trocar a senha. Confira os dados e solicite um novo link se este expirou."));
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
          <p>Senha alterada. Entre com a nova senha para continuar.</p>
          <Button onClick={() => navigate("/entrar")}>Ir para entrar</Button>
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          <PasswordField
            id="reset-password"
            label="Nova senha"
            autoComplete="new-password"
            minLength={12}
            maxLength={200}
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
            minLength={12}
            maxLength={200}
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
      onSession(await gateway.createHouse(name, Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Fortaleza"));
      navigate("/casa");
    } catch (reason) {
      setError(errorMessage(reason, "Não foi possível criar a casa. Revise os dados e tente novamente."));
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

function VerifyEmail({ onSession }: { onSession: (session: AuthSession | null) => void }) {
  const gateway = useAuthGateway();
  const location = useLocation();
  const navigate = useNavigate();
  const token = new URLSearchParams(location.search).get("token") ?? new URLSearchParams(location.hash.replace(/^#/, "")).get("token") ?? "";
  const [message, setMessage] = useState("Confirmando seu e-mail…");
  useEffect(() => {
    if (token) window.history.replaceState(null, "", location.pathname);
  }, [location.pathname, token]);
  useEffect(() => {
    let current = true;
    void gateway.verifyEmail(token).then((session) => {
      if (!current) return;
      onSession(session);
      setMessage("E-mail confirmado. Abrindo sua casa…");
      navigate(session.memberships.length ? "/casa" : "/criar-casa", { replace: true });
    }).catch((error: unknown) => {
      if (current) setMessage(errorMessage(error, "Este link de confirmação não está mais disponível. Entre em contato com quem liberou seu acesso para revisar o cadastro."));
    });
    return () => { current = false; };
  }, [gateway, navigate, onSession, token]);
  return <Card className={styles.formCard}><span className={styles.eyebrow}>CONFIRMAÇÃO DE E-MAIL</span><h1>Quase lá</h1><p className={styles.lead} role="status">{message}</p><p className={styles.switchFlow}><Link to="/entrar">Ir para entrar</Link></p></Card>;
}

function ResidentHome({
  session,
  onSession,
  themeControl,
}: {
  session: AuthSession;
  onSession: (session: AuthSession | null) => void;
  themeControl: ReactNode;
}) {
  const gateway = useAuthGateway();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await gateway.logout();
      onSession(null);
      navigate("/entrar");
    } catch (error) {
      showToast(errorMessage(error, "Não foi possível encerrar a sessão. Confira sua conexão e tente novamente."));
    } finally {
      setBusy(false);
    }
  }
  return <ResidentApp session={session} onSession={onSession} gateway={gateway.residents} themeControl={themeControl} onLogout={() => { if (!busy) void logout(); }} />;
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
  tone: "info" | "error" | "success";
}) {
  return (
    <p className={`${styles.feedback} ${styles[tone]}`} role={tone === "error" ? "alert" : "status"}>
      {tone !== "error" && <ShieldCheck size={17} aria-hidden="true" />}
      {children}
    </p>
  );
}

function DemoNote() {
  if (import.meta.env.MODE !== "demo") return null;
  return (
    <p className={styles.demoNote}>
      Demonstração local: nenhuma conta real é criada e nenhum e-mail é enviado.
    </p>
  );
}

function Loading({ label = "Abrindo sua área…" }: { label?: string }) {
  return <p className={styles.loading} role="status">{label}</p>;
}
