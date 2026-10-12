import { SplashScreen } from "./SplashScreen";

export function ConsoleLoading() {
  return (
    <SplashScreen
      notice={
        import.meta.env.DEV ? "DEMONSTRAÇÃO · DADOS FICTÍCIOS" : undefined
      }
      title="Arrumando a casa por aqui."
      detail="Carregando o console…"
    />
  );
}
