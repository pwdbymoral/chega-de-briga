import { SplashScreen } from "./SplashScreen";

export function ConsoleLoading() {
  return (
    <SplashScreen
      notice={
        import.meta.env.MODE === "demo" ? "DEMONSTRAÇÃO · DADOS FICTÍCIOS" : undefined
      }
      title="Arrumando a casa por aqui."
      detail="Carregando o console…"
    />
  );
}
