import styles from "./SplashScreen.module.css";

type SplashScreenProps = {
  title: string;
  detail: string;
  notice?: string;
};

export function SplashScreen({ title, detail, notice }: SplashScreenProps) {
  return (
    <section className={styles.splash} role="status" aria-live="polite">
      <div className={styles.card}>
        {notice && <span className={styles.notice}>{notice}</span>}
        <picture className={styles.mark}>
          <source media="(prefers-reduced-motion: reduce)" srcSet="/simbolo.svg" />
          {/* shortcut: SVG SMIL não toca no Expo; exportar este vetor como dotLottie ao iniciar o app nativo. */}
          <img src="/splash-animado.svg" alt="" width="160" height="160" />
        </picture>
        <span className={styles.eyebrow}>CHEGA DE BRIGA</span>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
    </section>
  );
}
