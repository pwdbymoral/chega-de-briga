import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { makeHouseData } from "./ResidentModel";
import { MembersScreen, ShoppingScreen, TaskRow } from "./ResidentScreens";

const data = () => makeHouseData("house", { id: "lia", name: "Lia", email: "lia@example.test" }, "responsavel");

describe("ações residenciais", () => {
  it("mantém concluir e oferece assumir apenas quando falta responsável", async () => {
    const house = data();
    const onComplete = vi.fn();
    const onAssume = vi.fn();
    const user = userEvent.setup();
    const row = (task = house.tasks[3]) => <MemoryRouter><TaskRow task={task} members={house.members} returnTo="/casa" onComplete={onComplete} onAssume={onAssume} /></MemoryRouter>;
    const view = render(row());
    await user.click(screen.getByRole("button", { name: /Assumir:/ }));
    expect(onAssume).toHaveBeenCalledWith(house.tasks[3].id);
    await user.click(screen.getByRole("button", { name: /Concluir:/ }));
    expect(onComplete).toHaveBeenCalledWith(house.tasks[3].id);
    expect(screen.getByRole("link")).toHaveAttribute("href", `/casa/tarefas/${house.tasks[3].id}?retorno=%2Fcasa`);
    view.rerender(row(house.tasks[0]));
    expect(screen.queryByRole("button", { name: /Assumir:/ })).not.toBeInTheDocument();
  });

  it("mantém comprado e editar associados ao item correto", async () => {
    const house = data();
    const onBought = vi.fn();
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<ShoppingScreen items={house.items} onAdd={vi.fn()} onBought={onBought} onEdit={onEdit} />);
    const actions = within(screen.getByRole("group", { name: "Ações: Leite" }));
    await user.click(actions.getByRole("button", { name: "Editar: Leite" }));
    expect(onEdit).toHaveBeenCalledWith(house.items[0]);
    await user.click(actions.getByRole("button", { name: "Comprado: Leite" }));
    expect(onBought).toHaveBeenCalledWith(house.items[0].id);
  });

  it("respeita os papéis de moradores e a revogação isolada de convites", async () => {
    const house = data();
    house.members[2].role = "responsavel";
    house.invites = [{ id: "invite", email: "novo@example.test" }];
    const onTransfer = vi.fn();
    const onRevoke = vi.fn();
    const user = userEvent.setup();
    const view = (role: "responsavel" | "morador") => <MembersScreen data={house} role={role} userId="lia" onInvite={vi.fn()} onRemove={vi.fn()} onTransfer={onTransfer} onRevoke={onRevoke} />;
    const mounted = render(view("responsavel"));
    expect(screen.queryByRole("group", { name: "Ações: Lia" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover: Caio Mendes" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mais ações: Júlia Costa" }));
    await user.click(screen.getByRole("button", { name: "Tornar responsável: Júlia Costa" }));
    expect(onTransfer).toHaveBeenCalledWith(house.members[1].id);
    await user.click(screen.getByRole("button", { name: "Revogar: novo@example.test" }));
    expect(onRevoke).toHaveBeenCalledWith("invite");
    mounted.rerender(view("morador"));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
