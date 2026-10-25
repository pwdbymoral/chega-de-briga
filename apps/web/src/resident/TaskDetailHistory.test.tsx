import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeHouseData } from "./ResidentModel";
import { TaskDetailScreen } from "./ResidentScreens";
import type { ResidentGateway, TaskHistoryEntry } from "../admin/contracts";

const data = () => makeHouseData("house", { id: "lia", name: "Lia", email: "lia@example.test" }, "responsavel");

function gatewayWith(entries: TaskHistoryEntry[]): ResidentGateway {
  return {
    fetchTaskHistory: vi.fn().mockResolvedValue({ entries, members: [{ id: "lia", name: "Lia" }] }),
  } as unknown as ResidentGateway;
}

describe("histórico da tarefa", () => {
  it("mostra entradas factuais sem agregados por pessoa", async () => {
    const house = data();
    const task = house.tasks[0];
    const entries: TaskHistoryEntry[] = [
      { kind: "occurrence", occurredAt: "2026-10-12T10:00:00Z", outcome: "concluida", assignedUserId: "lia", completedByUserId: "lia", scope: null, changedBy: null, eventType: "tarefa_concluida", note: null },
      { kind: "version", occurredAt: "2026-10-05T10:00:00Z", outcome: null, assignedUserId: null, completedByUserId: null, scope: "series", changedBy: "lia", eventType: "tarefa_renegociada", note: "trocamos o dia" },
    ];
    render(
      <TaskDetailScreen
        task={task}
        members={house.members}
        householdId="house"
        gateway={gatewayWith(entries)}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onComplete={vi.fn()}
        onAssume={vi.fn()}
        onSkip={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onEnd={vi.fn()}
        onRenegotiate={vi.fn()}
      />,
    );
    expect(await screen.findByText("O que aconteceu")).toBeInTheDocument();
    expect(await screen.findByText(/Concluída por Lia/)).toBeInTheDocument();
    expect(await screen.findByText(/Renegociada por Lia — trocamos o dia/)).toBeInTheDocument();
    expect(screen.queryByText(/\d+\s*tarefas/)).not.toBeInTheDocument();
  });

  it("não mostra o card de histórico quando não há entradas", async () => {
    const house = data();
    const task = house.tasks[0];
    render(
      <TaskDetailScreen
        task={task}
        members={house.members}
        householdId="house"
        gateway={gatewayWith([])}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onComplete={vi.fn()}
        onAssume={vi.fn()}
        onSkip={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onEnd={vi.fn()}
        onRenegotiate={vi.fn()}
      />,
    );
    await screen.findByText(task.title);
    expect(screen.queryByText("O que aconteceu")).not.toBeInTheDocument();
  });

  it("oferece renegociar em rotinas, chamando onRenegotiate", async () => {
    const user = userEvent.setup();
    const house = data();
    const task = house.tasks[0];
    const onRenegotiate = vi.fn();
    render(
      <TaskDetailScreen
        task={task}
        members={house.members}
        householdId="house"
        gateway={gatewayWith([])}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onComplete={vi.fn()}
        onAssume={vi.fn()}
        onSkip={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onEnd={vi.fn()}
        onRenegotiate={onRenegotiate}
      />,
    );
    await user.click(screen.getByRole("button", { name: new RegExp(`Mais ações: Rotina ${task.title}`) }));
    await user.click(screen.getByRole("button", { name: new RegExp(`Renegociar: Rotina ${task.title}`) }));
    expect(onRenegotiate).toHaveBeenCalled();
  });
});
