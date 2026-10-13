import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, CircleHelp, ListChecks, ShoppingBasket, UsersRound } from "lucide-react";
import styles from "./LandingPage.module.css";
import { appOrigin as getAppOrigin, track, usePageView } from "./landing/metrics";
import { GuideLinks } from "./landing/Guides";

type ContactChannel = "email" | "whatsapp";
type PublicConfig = { signupEnabled: boolean };
const consentVersion = "lista-espera-2026-10";

export function LandingPage() {
  const appOrigin = getAppOrigin();
  const currentAcquisition = usePageView("landing");
  const startSent = useRef(false);
  const [config, setConfig] = useState<PublicConfig>();
  const [configError, setConfigError] = useState(false);
  const [configAttempt, setConfigAttempt] = useState(0);
  const [channel, setChannel] = useState<ContactChannel>("email");
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => { setConfigError(true); controller.abort(); }, 10_000);
    setConfigError(false);
    void fetch(`${appOrigin}/api/public/config`, { credentials: "omit", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("config");
        const value = await response.json() as PublicConfig;
        if (typeof value.signupEnabled !== "boolean") throw new Error("config");
        if (!controller.signal.aborted) setConfig(value);
      })
      .catch(() => { if (!controller.signal.aborted) setConfigError(true); })
      .finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [appOrigin, configAttempt]);

  function startForm() {
    if (startSent.current) return;
    startSent.current = true;
    void track("form_start", "landing", currentAcquisition(), channel);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${appOrigin}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({
          channel,
          contact,
          consent,
          consentVersion,
          companyWebsite: (event.currentTarget.elements.namedItem("companyWebsite") as HTMLInputElement).value,
          ...currentAcquisition(),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => undefined) as { message?: string } | undefined;
        throw new Error(body?.message ?? "Não foi possível concluir agora. Tente novamente em instantes.");
      }
      setSubmitted(true);
      setContact("");
      setConsent(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível concluir agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>CASA COMPARTILHADA, VIDA MAIS LEVE</span>
          <h1 id="landing-title">Tarefas e compras da casa, <em>com os combinados à vista.</em></h1>
          <p>Um app para organizar tarefas domésticas, rotinas e compras compartilhadas. Menos cobrança; mais clareza pra quem divide a casa.</p>
          {config?.signupEnabled ? (
            <a className={styles.primaryCta} href={`${appOrigin}/criar-conta`}>Criar minha conta <ArrowRight size={19} aria-hidden="true" /></a>
          ) : (
            <a className={styles.primaryCta} href="#lista-de-espera">{config ? "Entrar na lista de espera" : "Ver disponibilidade"} <ArrowRight size={19} aria-hidden="true" /></a>
          )}
          <a className={styles.loginLink} href={`${appOrigin}/entrar`}>Já tem acesso? Entrar</a>
          <span className={styles.signature}>A casa não é um ringue.</span>
        </div>
        <div className={styles.heroVisual} aria-label="Prévia do app Chega de Briga">
          <img src="/prints/inicio.jpg?v=actions-20261013" width="380" height="682" fetchPriority="high" alt="Início do app com tarefas atribuídas a moradores e um resumo de três itens de compras, incluindo um urgente." />
          <span className={styles.sticker}>TÁ<br />COMBINADO.</span>
          <img className={styles.spark} src="/faisca.svg" alt="" />
        </div>
      </section>

      <section className={styles.product} aria-labelledby="product-title">
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>A ROTINA EM UM SÓ LUGAR</span>
          <h2 id="product-title">Cada combinado <em>mais fácil de encontrar.</em></h2>
          <p>Veja o que precisa ser feito e o que está faltando, sem depender de uma conversa perdida no grupo.</p>
        </div>
        <div className={styles.showcase}>
          <article className={styles.showcaseCard} id="rotinas">
            <div className={styles.showcaseCopy}>
              <span className={styles.showcaseIcon}><ListChecks size={22} aria-hidden="true" /></span>
              <span className={styles.eyebrow}>TAREFAS E ROTINAS</span>
              <h3>Quem faz, quando faz. Tudo combinado.</h3>
              <p>Organize tarefas únicas e recorrentes e deixe a responsabilidade clara para todo mundo.</p>
            </div>
            <img className={styles.taskScreenshot} src="/prints/tarefas.jpg?v=actions-20261013" width="380" height="877" alt="Visão semanal com o lixo atrasado atribuído a Júlia, a louça diária em revezamento e o banheiro atribuído a Caio." loading="lazy" />
          </article>
          <article className={`${styles.showcaseCard} ${styles.shoppingCard}`} id="compras">
            <div className={styles.showcaseCopy}>
              <span className={styles.showcaseIcon}><ShoppingBasket size={22} aria-hidden="true" /></span>
              <span className={styles.eyebrow}>LISTA DE COMPRAS</span>
              <h3>O que falta já fica anotado.</h3>
              <p>Adicione itens e quantidades para a próxima compra, visíveis para quem divide a casa.</p>
            </div>
            <img src="/prints/compras.jpg?v=actions-20261013" width="380" height="682" alt="Lista de compras com Leite e duas caixas para comprar antes, além de Café e Detergente na próxima compra." loading="lazy" />
          </article>
        </div>
        <p className={styles.previewNote}>Prévia ilustrativa com dados fictícios.</p>
      </section>

      <section className={styles.steps} aria-labelledby="steps-title">
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>SEM CERIMÔNIA</span>
          <h2 id="steps-title">Comece pelo que <em>já precisa acontecer.</em></h2>
        </div>
        <ol className={styles.stepList}>
          <li><span>01</span><UsersRound aria-hidden="true" /><h3>Reúna a casa</h3><p>Crie o espaço compartilhado e convide quem mora com você.</p></li>
          <li><span>02</span><ListChecks aria-hidden="true" /><h3>Registre um combinado</h3><p>Adicione uma tarefa, uma rotina ou algo que está faltando.</p></li>
          <li><span>03</span><Check aria-hidden="true" /><h3>Consulte e ajustem juntos</h3><p>Todo mundo acompanha a mesma lista e pode atualizar o combinado.</p></li>
        </ol>
      </section>

      <section className={styles.faq} aria-labelledby="faq-title">
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>PERGUNTAS DIRETAS</span>
          <h2 id="faq-title">Antes de abrir a porta.</h2>
        </div>
        <div className={styles.faqList}>
          <details><summary><CircleHelp size={19} aria-hidden="true" /> O que é o Chega de Briga?</summary><p>Um app para organizar tarefas, rotinas e compras de quem divide uma casa, com os combinados visíveis para os moradores.</p></details>
          <details><summary><CircleHelp size={19} aria-hidden="true" /> Para quem é o app?</summary><p>Para pessoas que dividem uma casa: casais, famílias, amigos e moradores de repúblicas. Cada casa reúne seus moradores, tarefas e lista de compras.</p></details>
          <details><summary><CircleHelp size={19} aria-hidden="true" /> Preciso instalar para usar?</summary><p>Você pode usar pelo navegador. Em navegadores compatíveis, também pode instalar a PWA para abrir o app pela tela inicial.</p></details>
          <details><summary><CircleHelp size={19} aria-hidden="true" /> Dá para repetir tarefas e revezar responsáveis?</summary><p>Sim. Há tarefas únicas e rotinas recorrentes, com pessoa fixa, revezamento entre moradores ou responsabilidade a combinar.</p></details>
          <details><summary><CircleHelp size={19} aria-hidden="true" /> Como funciona a lista de compras?</summary><p>Os moradores compartilham itens, quantidades opcionais e observações. Você pode destacar o que precisa comprar antes e marcar o que já foi comprado. O app não calcula estoque nem sugere quantidades automaticamente.</p></details>
          <details><summary><CircleHelp size={19} aria-hidden="true" /> Já posso criar uma conta?</summary><p>{!config ? "Consulte a disponibilidade de acesso na seção abaixo. Quando o cadastro estiver fechado, você poderá entrar na lista de espera." : config.signupEnabled ? "Sim. O cadastro público está aberto." : "Ainda não. Nesta fase, o cadastro é por convite. Entre na lista de espera e avisaremos quando houver novidades."}</p></details>
          <details><summary><CircleHelp size={19} aria-hidden="true" /> Como vou receber o aviso?</summary><p>Você escolhe e-mail ou WhatsApp no formulário. O contato só será usado para avisar sobre a abertura, com sua autorização.</p></details>
        </div>
      </section>

      <GuideLinks />

      <section className={styles.waitlist} id="lista-de-espera" aria-labelledby="waitlist-title">
        <div className={styles.waitlistCopy}>
          <span className={styles.eyebrow}>{!config ? "VAMOS COMBINAR?" : config.signupEnabled ? "ACESSO ABERTO" : "PRIMEIRO AVISO, SEM SPAM"}</span>
          <h2 id="waitlist-title">{!config ? "Consulte o acesso ao app." : config.signupEnabled ? "Sua casa pode começar por aqui." : "Quer saber quando abrir?"}</h2>
          <p>{!config ? "Veja a disponibilidade de cadastro ou receba um aviso quando houver novidades." : config.signupEnabled ? "Crie uma conta e organize os combinados da sua casa." : "Deixe um contato e escolha por onde prefere receber o aviso."}</p>
        </div>
        {!config ? (
          <div>
            {configError ? <><p role="alert">Não conseguimos verificar a disponibilidade agora.</p><button className={styles.submit} onClick={() => setConfigAttempt((value) => value + 1)}>Tentar novamente</button></> : <p role="status">Consultando disponibilidade…</p>}
            <noscript>Ative o JavaScript para consultar a disponibilidade e se inscrever. Os guias e a apresentação do app continuam disponíveis.</noscript>
          </div>
        ) : config.signupEnabled ? (
          <a className={styles.primaryCta} href={`${appOrigin}/criar-conta`}>Criar minha conta <ArrowRight size={19} aria-hidden="true" /></a>
        ) : submitted ? (
          <div className={styles.success} role="status"><Check size={22} aria-hidden="true" /><div><strong>Pronto, anotamos seu contato.</strong><p>Vamos avisar sobre a abertura pelo canal escolhido.</p></div></div>
        ) : (
          <form className={styles.form} onSubmit={(event) => void submit(event)} onFocus={startForm}>
            <fieldset className={styles.channelChoice}>
              <legend>Como prefere receber o aviso?</legend>
              <label><input type="radio" name="channel" value="email" checked={channel === "email"} onChange={() => { setChannel("email"); setContact(""); }} /> E-mail</label>
              <label><input type="radio" name="channel" value="whatsapp" checked={channel === "whatsapp"} onChange={() => { setChannel("whatsapp"); setContact(""); }} /> WhatsApp</label>
            </fieldset>
            <label className={styles.contactLabel} htmlFor="waitlist-contact">{channel === "email" ? "Seu e-mail" : "Seu WhatsApp"}</label>
            <input
              id="waitlist-contact"
              name="contact"
              type={channel === "email" ? "email" : "tel"}
              inputMode={channel === "email" ? "email" : "tel"}
              autoComplete={channel === "email" ? "email" : "tel"}
              placeholder={channel === "email" ? "voce@exemplo.com" : "(11) 99999-9999"}
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              maxLength={channel === "email" ? 254 : 25}
              required
            />
            <label className={styles.consent}>
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
              <span>Autorizo o uso deste contato para receber aviso sobre a abertura pelo canal que escolhi. <a href={`${appOrigin}/privacidade`}>Aviso de privacidade</a>.</span>
            </label>
            <div className={styles.honeypot} aria-hidden="true"><label htmlFor="company-website">Site da empresa</label><input id="company-website" name="companyWebsite" tabIndex={-1} autoComplete="off" /></div>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button className={styles.submit} type="submit" disabled={busy}>{busy ? "Enviando…" : "Entrar na lista de espera"} <ArrowRight size={19} aria-hidden="true" /></button>
            <p className={styles.formNote}>Sem mensagens automáticas nesta fase. Você pode pedir a remoção do contato a qualquer momento.</p>
          </form>
        )}
      </section>
    </div>
  );
}
