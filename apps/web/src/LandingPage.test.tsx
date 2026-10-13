import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LandingPage } from "./LandingPage";
import { StrictMode, act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";

const ok = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
  sessionStorage.clear();
});

describe("lista de espera da landing", () => {
  it.each([
    { channel: "E-mail", label: "Seu e-mail", contact: "julia@example.test" },
    { channel: "WhatsApp", label: "Seu WhatsApp", contact: "(11) 99999-0001" },
  ])("envia $channel só com autorização e tags de campanha", async ({ channel, label, contact }) => {
    window.history.replaceState({}, "", "/?utm_source=instagram&utm_campaign=abertura");
    let submittedBody = "";
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input), window.location.origin);
      if (url.pathname === "/api/public/config") return ok({ signupEnabled: false });
      if (url.pathname === "/api/waitlist") submittedBody = String(init?.body);
      return ok({});
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<LandingPage />);

    await user.click(await screen.findByRole("radio", { name: channel }));
    await user.type(screen.getByLabelText(label), contact);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /entrar na lista de espera/i }));
    await screen.findByRole("status");

    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => new URL(String(input), window.location.origin).pathname === "/api/waitlist")).toBe(true));
    const request = fetchMock.mock.calls.find(([input]) => new URL(String(input), window.location.origin).pathname === "/api/waitlist");
    expect(request?.[0]).toBe(`${window.location.origin}/api/waitlist`);
    expect(request?.[1]).toMatchObject({ credentials: "omit" });
    expect(JSON.parse(submittedBody)).toMatchObject({
      channel: channel === "E-mail" ? "email" : "whatsapp",
      contact,
      consent: true,
      consentVersion: "lista-espera-2026-10",
      utm_source: "instagram",
      utm_campaign: "abertura",
      source: "other_campaign",
    });
  });

  it("renders readable HTML without requests and hydrates without mismatches", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ok({ signupEnabled: false }));
    vi.stubGlobal("fetch", fetchMock);
    const html = renderToString(<LandingPage />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(html).toContain("Ver disponibilidade");
    expect(html).toContain("/guias/dividir-tarefas-domesticas/");
    const container = document.createElement("div");
    document.body.append(container);
    container.innerHTML = html;
    const recoverable = vi.fn();
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => { root = hydrateRoot(container, <StrictMode><LandingPage /></StrictMode>, { onRecoverableError: recoverable }); });
    expect(recoverable).not.toHaveBeenCalled();
    expect(container.querySelector('input[type="email"]')).not.toBeNull();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.body && JSON.parse(String(init.body)).event === "view")).toHaveLength(1);
    await act(async () => root!.unmount());
    container.remove();
  });

  it("uses the runtime signup flag without showing a waitlist form", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok({ signupEnabled: true })));
    render(<LandingPage />);
    const links = await screen.findAllByRole("link", { name: "Criar minha conta" });
    expect(links[0]).toHaveAttribute("href", `${window.location.origin}/criar-conta`);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("offers retry when the availability request never completes", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    const view = render(<LandingPage />);
    await act(async () => { vi.advanceTimersByTime(10_000); });
    expect(screen.getByRole("alert")).toHaveTextContent("Não conseguimos verificar");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeEnabled();
    view.unmount();
  });

  it("allows retry after availability fails and after a submission error", async () => {
    let configAttempts = 0;
    let submits = 0;
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/api/public/config") {
        if (++configAttempts === 1) throw new Error("offline");
        return ok({ signupEnabled: false });
      }
      if (path === "/api/waitlist" && ++submits === 1) return { ok: false, json: async () => ({ message: "Tente mais uma vez." }) } as Response;
      return ok({});
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<LandingPage />);
    await user.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    await user.type(await screen.findByLabelText("Seu e-mail"), "ana@example.test");
    await user.click(screen.getByRole("button", { name: /entrar na lista de espera/i }));
    expect(submits).toBe(0);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /entrar na lista de espera/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tente mais uma vez.");
    await user.click(screen.getByRole("button", { name: /entrar na lista de espera/i }));
    expect(await screen.findByRole("status")).toHaveTextContent("Pronto, anotamos");
    expect(fetchMock.mock.calls.filter(([, init]) => init?.body && JSON.parse(String(init.body)).event === "form_start")).toHaveLength(1);
  });
});
