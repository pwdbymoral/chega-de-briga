import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RotateCcw } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { Button, Checkbox, IconButton, StatusBadge, TextField } from "./ui";

describe("componentes de interface", () => {
  it("mantém rótulos, descrições e erros ligados aos campos", () => {
    render(<>
      <TextField id="task" label="Nome da tarefa" hint="Use um nome curto." />
      <TextField id="due" label="Prazo" error="Informe uma data válida." />
    </>);
    expect(screen.getByRole("textbox", { name: "Nome da tarefa" })).toHaveAccessibleDescription("Use um nome curto.");
    expect(screen.getByRole("textbox", { name: "Prazo" })).toHaveAccessibleDescription("Informe uma data válida.");
    expect(screen.getByRole("textbox", { name: "Prazo" })).toHaveAttribute("aria-invalid", "true");
  });

  it("oferece ações e estados pelo nome, sem depender de ícone ou cor", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<>
      <Button disabled>Indisponível</Button>
      <IconButton label="Recomeçar exemplo" icon={<RotateCcw />} onClick={reset} />
      <Checkbox label="Lavar a louça" detail="Hoje, até 19h" />
      <StatusBadge tone="warning">Vence hoje</StatusBadge>
    </>);
    expect(screen.getByRole("button", { name: "Indisponível" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Recomeçar exemplo" }));
    expect(reset).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("checkbox", { name: /Lavar a louça/ }));
    expect(screen.getByRole("checkbox", { name: /Lavar a louça/ })).toBeChecked();
    expect(screen.getByText("Vence hoje")).toBeVisible();
  });
});
