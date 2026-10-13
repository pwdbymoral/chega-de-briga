import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("virtual:pwa-register/react", () => ({ useRegisterSW: () => ({ needRefresh: [false, vi.fn()], updateServiceWorker: vi.fn() }) }));
afterEach(() => { localStorage.removeItem("cdb-theme"); vi.unstubAllGlobals(); });

it("seleciona, persiste e sincroniza o tema com um único controle", async () => {
  const media = new EventTarget() as MediaQueryList;
  Object.defineProperty(media, "matches", { configurable: true, value: true });
  vi.stubGlobal("matchMedia", (query: string) => query.includes("color-scheme") ? media : { matches: true, addEventListener() {}, removeEventListener() {} });
  const user = userEvent.setup();
  const view = () => <MemoryRouter initialEntries={["/privacidade"]}><App /></MemoryRouter>;
  const mounted = render(view());
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(screen.queryByRole("button", { name: /Ativar modo/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Tema: Sistema" }));
  await user.click(screen.getByRole("option", { name: "Claro" }));
  expect(localStorage.getItem("cdb-theme")).toBe("light");
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(screen.getByRole("button", { name: "Tema: Claro" })).toHaveFocus();
  mounted.unmount();
  render(view());
  expect(screen.getByRole("button", { name: "Tema: Claro" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Tema: Claro" }));
  await user.keyboard("{End}{Enter}");
  expect(localStorage.getItem("cdb-theme")).toBe("dark");
  await user.click(screen.getByRole("button", { name: "Tema: Escuro" }));
  await user.click(screen.getByRole("option", { name: "Sistema" }));
  expect(localStorage.getItem("cdb-theme")).toBeNull();
  act(() => {
    Object.defineProperty(media, "matches", { value: false });
    media.dispatchEvent(new Event("change"));
  });
  expect(document.documentElement.dataset.theme).toBe("light");
  act(() => {
    localStorage.setItem("cdb-theme", "dark");
    window.dispatchEvent(new StorageEvent("storage", { key: "cdb-theme" }));
  });
  expect(screen.getByRole("button", { name: "Tema: Escuro" })).toBeInTheDocument();
  expect(document.documentElement.dataset.theme).toBe("dark");
});
