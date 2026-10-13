import type { PublicPage } from "@chega-de-briga/domain";
import { LandingPage } from "../LandingPage";
import { Guide } from "./Guides";
import { appOrigin } from "./metrics";
import styles from "./PublicSite.module.css";

export function PublicSite({ page }: { page: PublicPage | "not_found" }) {
  return <>
    <a className={styles.skip} href="#conteudo">Pular para o conteúdo</a>
    <header className={styles.header}>
      <a className={styles.brand} href="/"><img src="/simbolo.svg" width="40" height="40" alt="" />Chega de Briga</a>
      <nav aria-label="Navegação principal"><a href="/#rotinas">Tarefas</a><a href="/#compras">Compras</a><a href="/#guias">Guias</a><a href={`${appOrigin()}/entrar`}>Entrar</a></nav>
    </header>
    <main id="conteudo">{page === "landing" ? <LandingPage /> : page === "not_found"
      ? <section className={styles.article}><h1>Esta página não foi encontrada.</h1><p>O endereço pode ter mudado. <a href="/">Voltar ao início</a>.</p></section>
      : <Guide page={page} />}</main>
    <footer className={styles.footer}><p><strong>Chega de Briga · ForjaCorp</strong><br />Casa compartilhada. Responsabilidade também.</p><a href={`${appOrigin()}/privacidade`}>Aviso de privacidade e responsável</a></footer>
  </>;
}
