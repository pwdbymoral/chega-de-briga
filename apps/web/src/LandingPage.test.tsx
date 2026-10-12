import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { LandingPage } from "./LandingPage";

const ok = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("lista de espera da landing", () => {
  it.each([
    { channel: "E-mail", label: "Seu e-mail", contact: "julia@example.test" },
    { channel: "WhatsApp", label: "Seu WhatsApp", contact: "(11) 99999-0001" },
  ])("envia $channel só com autorização e tags de campanha", async ({ channel, label, contact }) => {
    window.history.replaceState({}, "", "/?utm_source=instagram&utm_campaign=abertura");
    let submittedBody = "";
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      if (String(input) === "/api/public/config") return ok({ signupEnabled: false });
      if (String(input) === "/api/waitlist") submittedBody = String(init?.body);
      return ok({});
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MemoryRouter><LandingPage /></MemoryRouter>);

    await user.click(screen.getByRole("radio", { name: channel }));
    await user.type(screen.getByLabelText(label), contact);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /entrar na lista de espera/i }));
    await screen.findByRole("status");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/waitlist", expect.any(Object)));
    expect(JSON.parse(submittedBody)).toMatchObject({
      channel: channel === "E-mail" ? "email" : "whatsapp",
      contact,
      consent: true,
      consentVersion: "lista-espera-2026-10",
      utm_source: "instagram",
      utm_campaign: "abertura",
    });
  });
});
