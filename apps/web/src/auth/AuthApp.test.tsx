import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { AuthApp } from "./AuthApp";
import { ToastProvider } from "../components/Toast";
import { createDemoAuthGateway, createDemoData, createDemoGateway } from "../admin/mockGateway";
import type { AuthGateway } from "../admin/contracts";

function RoutedAuth({ gateway }: { gateway: AuthGateway }) {
  const location = useLocation();
  const screenByPath: Record<string, "login" | "signup" | "recovery" | "reset" | "home" | "createHouse"> = {
    "/entrar": "login",
    "/criar-conta": "signup",
    "/esqueci-senha": "recovery",
    "/redefinir-senha": "reset",
    "/casa": "home",
    "/criar-casa": "createHouse",
  };
  const screen = screenByPath[location.pathname] ?? (location.pathname.startsWith("/casa/") ? "home" : "signup");
  return <AuthApp screen={screen} themeControl={null} gateway={gateway} />;
}

describe("telas de autenticação", () => {
  it("percorre cadastro autorizado, criação de casa, área provisória e logout", async () => {
    const data = createDemoData();
    const admin = createDemoGateway(data);
    const gateway = createDemoAuthGateway(data);
    await admin.addAllowed("ana@example.test");
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/criar-conta?email=ana%40example.test"]}>
          <RoutedAuth gateway={gateway} />
        </MemoryRouter>
      </ToastProvider>,
    );

    await screen.findByRole("heading", { name: "Criar conta" });
    await user.type(screen.getByLabelText("Como podemos chamar você?"), "Ana");
    await user.type(screen.getByLabelText("Crie uma senha"), "casa tranquila");
    await user.type(screen.getByLabelText("Repita a senha"), "casa tranquila");
    await user.click(screen.getByRole("button", { name: /criar conta/i }));

    await screen.findByRole("heading", { name: "Sua casa começa com um nome." });
    const houseName = screen.getByLabelText("Nome da casa");
    await user.type(houseName, "Apê da Ana");
    expect(houseName).toHaveValue("Apê da Ana");
    await user.click(screen.getByRole("button", { name: /criar casa/i }));
    await screen.findByRole("heading", { name: "Início" });
    await screen.findByRole("button", { name: "Apê da Ana" });

    await user.click(screen.getByRole("link", { name: "Abrir perfil" }));
    await screen.findByRole("heading", { name: "Perfil" });
    await user.click(screen.getByRole("button", { name: /sair da conta/i }));
    await screen.findByRole("heading", { name: "Entrar" });
    expect(await gateway.session()).toBeNull();
  });
});
