import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DatePicker, formatFriendlyDate, getTodayString } from "./DatePicker";

describe("DatePicker", () => {
  it("renderiza com rótulo, valor e acessibilidade vinculados", () => {
    render(
      <DatePicker
        id="prazo"
        label="Prazo da tarefa"
        value="2026-10-15"
        onChange={vi.fn()}
        hint="Escolha quando deve ser feito."
      />
    );

    const trigger = screen.getByRole("button", { name: /^Prazo da tarefa/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.getByText("Escolha quando deve ser feito.")).toBeVisible();
    expect(screen.getByText(/15 de out/i)).toBeVisible();
  });

  it("abre o popover e permite selecionar um dia", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <DatePicker
        id="prazo"
        label="Prazo"
        value="2026-10-15"
        onChange={handleChange}
      />
    );

    const trigger = screen.getByRole("button", { name: /^Prazo/ });
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: /Escolher data: Prazo/ })).toBeVisible();

    // Clica no dia 20
    const day20 = screen.getByRole("gridcell", { name: "20" });
    await user.click(day20);

    expect(handleChange).toHaveBeenCalledWith("2026-10-20");
    // Popover deve fechar após seleção
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("permite usar atalhos rápidos como 'Hoje'", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <DatePicker
        id="prazo"
        label="Prazo"
        value=""
        onChange={handleChange}
      />
    );

    await user.click(screen.getByRole("button", { name: /Prazo/ }));
    const todayBtn = screen.getByRole("button", { name: "Hoje" });
    await user.click(todayBtn);

    expect(handleChange).toHaveBeenCalledWith(getTodayString());
  });

  it("permite limpar a data selecionada", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <DatePicker
        id="prazo"
        label="Prazo"
        value="2026-10-15"
        onChange={handleChange}
        clearable
      />
    );

    const clearButton = screen.getByRole("button", { name: "Limpar data de Prazo" });
    await user.click(clearButton);

    expect(handleChange).toHaveBeenCalledWith("");
  });

  it("fecha o popover com Escape", async () => {
    const user = userEvent.setup();

    render(
      <DatePicker
        id="prazo"
        label="Prazo"
        value="2026-10-15"
        onChange={vi.fn()}
      />
    );

    const trigger = screen.getByRole("button", { name: /^Prazo/ });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("formata datas relativas no gatilho", () => {
    const today = getTodayString();
    expect(formatFriendlyDate(today)).toContain("Hoje");
  });
});
