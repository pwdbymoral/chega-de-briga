import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { makeHouseData } from "./ResidentModel";
import { HomeScreen, WeeklyReviewScreen } from "./ResidentScreens";
import type { ResidentGateway } from "../admin/contracts";

const data = () => makeHouseData("house", { id: "lia", name: "Lia", email: "lia@example.test" }, "responsavel");

describe("cartão de revisão semanal", () => {
  it("aparece só quando sinalizado e some ao dispensar, sem persistir nada", async () => {
    const user = userEvent.setup();
    const house = data();
    render(<MemoryRouter><HomeScreen name="Lia" tasks={house.tasks} items={house.items} members={house.members} showWeeklyReview onComplete={vi.fn()} onAssume={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText(/dá pra dar uma olhada rápida/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Agora não/ }));
    expect(screen.queryByText(/dá pra dar uma olhada rápida/)).not.toBeInTheDocument();
  });

  it("não aparece quando showWeeklyReview é falso", () => {
    const house = data();
    render(<MemoryRouter><HomeScreen name="Lia" tasks={house.tasks} items={house.items} members={house.members} onComplete={vi.fn()} onAssume={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByText(/dá pra dar uma olhada rápida/)).not.toBeInTheDocument();
  });
});

describe("tela de revisão semanal", () => {
  it("envia só as respostas da revisão, sem chamar outros métodos do gateway", async () => {
    const user = userEvent.setup();
    const submitWeeklyReview = vi.fn().mockResolvedValue(undefined);
    const saveHousehold = vi.fn();
    const gateway = { submitWeeklyReview, saveHousehold } as unknown as ResidentGateway;
    const onDone = vi.fn();
    render(<WeeklyReviewScreen householdId="house" gateway={gateway} onDone={onDone} />);
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Como foi essa semana?" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Pesou um pouco" }));
    await user.click(screen.getByRole("radio", { name: "Sim" }));
    await user.click(screen.getByRole("button", { name: "Concluir revisão" }));
    expect(screen.getByRole("radiogroup", { name: /pesou pra você/ })).toBeInTheDocument();
    expect(submitWeeklyReview).toHaveBeenCalledWith("house", { feltHeavy: "pouco", feltNoticed: "sim" });
    expect(saveHousehold).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });
});
