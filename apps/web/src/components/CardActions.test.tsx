import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Check, Pencil, Trash2 } from "lucide-react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { CardActions, type CardAction } from "./CardActions";

describe("ações dos cards", () => {
  const primary: CardAction = { label: "Concluir", icon: Check, onClick: vi.fn() };
  const edit: CardAction = { label: "Editar", icon: Pencil, onClick: vi.fn() };
  const remove: CardAction = { label: "Excluir", icon: Trash2, destructive: true, onClick: vi.fn() };

  it.each([
    [undefined, [], []],
    [primary, [], ["Concluir: Louça"]],
    [primary, [edit], ["Concluir: Louça", "Editar: Louça"]],
    [primary, [edit, remove], ["Concluir: Louça", "Mais ações: Louça"]],
    [undefined, [edit], ["Editar: Louça"]],
    [undefined, [edit, remove], ["Mais ações: Louça"]],
  ] as const)("expõe apenas as ações previstas para cada grupo (%#)", (main, secondary, names) => {
    render(<CardActions context="Louça" primary={main} secondary={[...secondary]}><strong>Louça</strong></CardActions>);
    expect(screen.queryAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(names);
  });

  it("preserva links, callbacks e indisponibilidade", async () => {
    const click = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<MemoryRouter><CardActions context="Casa" primary={{ label: "Abrir", icon: Check, to: "/casa" }} secondary={[{ label: "Editar", icon: Pencil, disabled: true, onClick: click }]} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Abrir: Casa" })).toHaveAttribute("href", "/casa");
    await user.click(screen.getByRole("button", { name: "Editar: Casa" }));
    expect(click).not.toHaveBeenCalled();
    rerender(<MemoryRouter><CardActions context="Casa" secondary={[{ label: "Editar", icon: Pencil, onClick: click }]} /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "Editar: Casa" }));
    expect(click).toHaveBeenCalledOnce();
  });

  it("ordena destrutivas por último e fecha por seleção, Escape e clique externo", async () => {
    const click = vi.fn();
    const user = userEvent.setup();
    render(<><button>Fora</button><CardActions context="Casa" secondary={[remove, { ...edit, onClick: click }]} /></>);
    const trigger = screen.getByRole("button", { name: "Mais ações: Casa" });
    await user.click(trigger);
    const menu = screen.getByRole("group", { name: "Mais ações: Casa" });
    expect(within(menu).getAllByRole("button").map((button) => button.textContent)).toEqual(["Editar", "Excluir"]);
    expect(screen.getByRole("button", { name: "Editar: Casa" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Editar: Casa" }));
    expect(click).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("group", { name: "Mais ações: Casa" })).not.toBeInTheDocument();
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Fora" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Fora" })).toHaveFocus();
  });

  it("sai do menu com Tab sem prender ou perder o foco", async () => {
    const user = userEvent.setup();
    render(<><CardActions context="Casa" secondary={[edit, remove]} /><button>Próximo</button></>);
    const trigger = screen.getByRole("button", { name: "Mais ações: Casa" });
    await user.click(trigger);
    await user.tab({ shift: true });
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.tab();
    expect(screen.getByRole("button", { name: "Excluir: Casa" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Próximo" })).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("mantém o menu dentro da janela mesmo se o gatilho sair da área visível", async () => {
    const measure = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.getAttribute("role") === "group"
        ? new DOMRect(0, 0, 250, 166)
        : new DOMRect(window.innerWidth - 40, window.innerHeight + 100, 48, 48);
    });
    try {
      render(<CardActions context="Casa" secondary={[edit, remove]} />);
      await userEvent.setup().click(screen.getByRole("button", { name: "Mais ações: Casa" }));
      expect(screen.getByRole("group", { name: "Mais ações: Casa" })).toHaveStyle({
        left: `${window.innerWidth - 258}px`, top: `${window.innerHeight - 174}px`,
      });
    } finally {
      measure.mockRestore();
    }
  });
});
