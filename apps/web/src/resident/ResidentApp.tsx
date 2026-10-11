import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronDown, House, ListChecks, Plus, ShoppingBasket } from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import type { AuthSession } from "../admin/contracts";
import { Avatar, Button, Checkbox, EmptyState, TextField } from "../components/ui";
import { BottomSheet, ConfirmDialog } from "../components/ResidentOverlays";
import { useToast } from "../components/Toast";
import {
  dateKey,
  initials,
  makeHouseData,
  newId,
  nextOccurrence,
  type HouseData,
  type ResidentTask,
  type ShoppingItem,
  type TaskInput,
} from "./ResidentModel";
import {
  HomeScreen,
  HouseScreen,
  MembersScreen,
  ProfileScreen,
  ShoppingScreen,
  TaskDetailScreen,
  TaskEditor,
  TaskListScreen,
} from "./ResidentScreens";
import styles from "./ResidentApp.module.css";

type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function ResidentApp({
  session,
  onSession,
  themeControl,
  onLogout,
}: {
  session: AuthSession;
  onSession: (session: AuthSession | null) => void;
  themeControl: ReactNode;
  onLogout: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [activeHouseId, setActiveHouseId] = useState(session.memberships[0]?.householdId ?? "");
  const [houseNames, setHouseNames] = useState(() => Object.fromEntries(session.memberships.map((membership) => [membership.householdId, membership.householdName])));
  const [dataByHouse, setDataByHouse] = useState<Record<string, HouseData>>(() => Object.fromEntries(session.memberships.map((membership) => [membership.householdId, makeHouseData(membership.householdId, session.user, membership.role)])));
  const [taskSection, setTaskSection] = useState<"today" | "week" | "routines">(() => {
    const view = new URLSearchParams(location.search).get("visao");
    return view === "semana" ? "week" : view === "rotinas" ? "routines" : "today";
  });
  const [memberFilter, setMemberFilter] = useState("todos");
  const [houseSheetOpen, setHouseSheetOpen] = useState(false);
  const [editScopeTaskId, setEditScopeTaskId] = useState<string>();
  const [resumeTaskId, setResumeTaskId] = useState<string>();
  const [resumeDate, setResumeDate] = useState(dateKey(1));
  const [editingItem, setEditingItem] = useState<ShoppingItem>();
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemPriority, setItemPriority] = useState<ShoppingItem["priority"]>("next");
  const [confirmation, setConfirmation] = useState<Confirmation>();

  useEffect(() => {
    const view = new URLSearchParams(location.search).get("visao");
    if (view === "semana") setTaskSection("week");
    else if (view === "rotinas") setTaskSection("routines");
    else if (location.pathname === "/casa/tarefas") setTaskSection("today");
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.body.dataset.residentApp = "true";
    return () => { delete document.body.dataset.residentApp; };
  }, []);

  const membership = session.memberships.find((item) => item.householdId === activeHouseId) ?? session.memberships[0];
  const householdId = membership?.householdId ?? "";
  const houseName = houseNames[householdId] ?? membership?.householdName ?? "Minha casa";
  const data = dataByHouse[householdId] ?? makeHouseData(householdId, session.user, membership?.role ?? "morador");
  const route = location.pathname.replace(/\/+$/, "") || "/casa";
  const returnTo = new URLSearchParams(location.search).get("retorno") ?? undefined;
  const taskListPath = `/casa/tarefas${taskSection === "today" ? "" : `?visao=${taskSection === "week" ? "semana" : "rotinas"}`}`;
  const editorBackPath = returnTo ?? taskListPath;
  const taskId = route.startsWith("/casa/tarefas/") ? route.slice("/casa/tarefas/".length).split("/")[0] : undefined;
  const currentTask = data.tasks.find((task) => task.id === taskId);
  const isEditor = route === "/casa/tarefas/nova" || route.endsWith("/editar");
  const isDetail = Boolean(taskId && taskId !== "nova" && !route.endsWith("/editar"));

  function patchData(update: (current: HouseData) => HouseData) {
    setDataByHouse((current) => ({
      ...current,
      [householdId]: update(current[householdId] ?? data),
    }));
  }

  function restoreTask(task: ResidentTask) {
    patchData((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === task.id ? task : item) }));
  }

  function completeTask(id: string) {
    const task = data.tasks.find((item) => item.id === id);
    if (!task) return;
    let updated: ResidentTask;
    if (task.repeat === "once" || task.ended || task.paused) {
      updated = { ...task, completed: true };
    } else {
      updated = {
        ...task,
        dueDate: task.nextStartDate ?? nextOccurrence(task),
        nextStartDate: undefined,
        completed: false,
        skipped: false,
        assigneeId: task.ownerMode === "agree" ? undefined : task.assigneeId,
        rotationIndex: task.ownerMode === "rotation" && task.rotation.length ? (task.rotationIndex + 1) % task.rotation.length : task.rotationIndex,
      };
    }
    restoreTask(updated);
    showToast("Tarefa concluída.", { action: { label: "Desfazer", onClick: () => restoreTask(task) } });
  }

  function assumeTask(id: string) {
    const task = data.tasks.find((item) => item.id === id);
    if (!task) return;
    const updated = { ...task, assigneeId: session.user.id };
    restoreTask(updated);
    showToast("Você assumiu esta tarefa.", { action: { label: "Desfazer", onClick: () => restoreTask(task) } });
  }

  function skipTask(id: string) {
    const task = data.tasks.find((item) => item.id === id);
    if (!task) return;
    const updated = task.repeat === "once" || task.ended || task.paused
      ? { ...task, skipped: true }
      : {
          ...task,
          dueDate: nextOccurrence(task),
          assigneeId: task.ownerMode === "agree" ? undefined : task.assigneeId,
          rotationIndex: task.ownerMode === "rotation" && task.rotation.length ? (task.rotationIndex + 1) % task.rotation.length : task.rotationIndex,
        };
    restoreTask(updated);
    showToast("Ocorrência pulada.", { action: { label: "Desfazer", onClick: () => restoreTask(task) } });
  }

  function pauseTask(id: string) {
    const task = data.tasks.find((item) => item.id === id);
    if (!task) return;
    restoreTask({ ...task, paused: true });
    showToast("Rotina pausada.", { action: { label: "Desfazer", onClick: () => restoreTask(task) } });
  }

  function updateTask(value: TaskInput) {
    const task = currentTask;
    if (task) {
      restoreTask({ ...task, ...value });
      showToast("Tarefa atualizada nesta demonstração.");
    } else {
      patchData((current) => ({
        ...current,
        tasks: [{ id: newId("tarefa"), ...value, completed: false, skipped: false, paused: false, ended: false }, ...current.tasks],
      }));
      showToast("Tarefa adicionada.");
    }
    navigate(task ? `/casa/tarefas/${task.id}?retorno=${encodeURIComponent(editorBackPath)}` : taskListPath);
  }

  function addShoppingItem(name: string, quantity: string, priority: ShoppingItem["priority"]) {
    const cleaned = name.trim();
    if (!cleaned) return;
    const duplicate = data.items.find((item) => item.name.trim().toLocaleLowerCase("pt-BR") === cleaned.toLocaleLowerCase("pt-BR"));
    if (duplicate) {
      patchData((current) => ({
        ...current,
        items: current.items.map((item) => item.id === duplicate.id ? { ...item, quantity: quantity.trim() || item.quantity, priority } : item),
      }));
      showToast(`${duplicate.name} já estava na lista; o item foi atualizado.`);
      return;
    }
    patchData((current) => ({ ...current, items: [{ id: newId("item"), name: cleaned, quantity: quantity.trim(), priority }, ...current.items] }));
    showToast("Item adicionado à lista.");
  }

  function markBought(id: string) {
    const item = data.items.find((entry) => entry.id === id);
    if (!item) return;
    patchData((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== id) }));
    showToast(`${item.name} marcado como comprado.`, {
      action: {
        label: "Desfazer",
        onClick: () => patchData((current) => ({ ...current, items: current.items.some((entry) => entry.id === id) ? current.items : [item, ...current.items] })),
      },
    });
  }

  function saveShoppingEdit() {
    if (!editingItem) return;
    patchData((current) => ({ ...current, items: current.items.map((item) => item.id === editingItem.id ? { ...item, quantity: itemQuantity.trim(), priority: itemPriority } : item) }));
    setEditingItem(undefined);
    showToast("Item atualizado.");
  }

  function inviteResident(email: string) {
    if (!email.trim()) return;
    patchData((current) => ({ ...current, invites: [{ id: newId("convite-local"), email }, ...current.invites] }));
    showToast("Convite de demonstração criado. Nenhum e-mail foi enviado.");
  }

  function revokeInvite(id: string) {
    const invite = data.invites.find((item) => item.id === id);
    if (!invite) return;
    setConfirmation({
      title: "Revogar convite?",
      description: `O convite para ${invite.email} será removido desta demonstração local.`,
      confirmLabel: "Revogar convite",
      onConfirm: () => {
        patchData((current) => ({ ...current, invites: current.invites.filter((item) => item.id !== id) }));
        showToast("Convite removido da demonstração.");
      },
    });
  }

  function removeMember(id: string) {
    const person = data.members.find((member) => member.id === id);
    if (!person) return;
    setConfirmation({
      title: `Remover ${person.name}?`,
      description: "As tarefas atribuídas a esta pessoa passarão para A combinar nesta demonstração.",
      confirmLabel: "Remover morador",
      onConfirm: () => {
        patchData((current) => ({
          ...current,
          members: current.members.filter((member) => member.id !== id),
          tasks: current.tasks.map((task) => {
            const rotation = task.rotation.filter((memberId) => memberId !== id);
            const assigned = task.assigneeId === id || task.ownerMode === "rotation" && task.rotation[task.rotationIndex % Math.max(task.rotation.length, 1)] === id;
            if (task.ownerMode === "rotation" && rotation.length) return { ...task, rotation, rotationIndex: task.rotationIndex % rotation.length, assigneeId: undefined };
            if (assigned || task.ownerMode === "rotation") return { ...task, ownerMode: "agree", rotation: [], rotationIndex: 0, assigneeId: undefined };
            return { ...task, rotation, assigneeId: task.assigneeId === id ? undefined : task.assigneeId };
          }),
        }));
        showToast("Morador removido da demonstração.");
      },
    });
  }

  function transferResponsibility(id: string) {
    const next = data.members.find((member) => member.id === id);
    if (!next) return;
    patchData((current) => ({ ...current, members: current.members.map((member) => ({ ...member, role: member.id === id ? "responsavel" : member.id === session.user.id ? "morador" : member.role })) }));
    onSession({
      ...session,
      memberships: session.memberships.map((item) => item.householdId === householdId ? { ...item, role: "morador" } : item),
    });
    showToast(`${next.name} agora é responsável nesta demonstração.`);
  }

  function openTaskEditor() {
    if (!currentTask) return;
    if (currentTask.repeat === "once") {
      const params = new URLSearchParams({ retorno: editorBackPath });
      navigate(`/casa/tarefas/${currentTask.id}/editar?${params}`);
      return;
    }
    setEditScopeTaskId(currentTask.id);
  }

  function taskScreenSection(section: "today" | "week" | "routines") {
    setTaskSection(section);
    navigate(`/casa/tarefas${section === "today" ? "" : `?visao=${section === "week" ? "semana" : "rotinas"}`}`);
  }

  function leaveHouse(remove: boolean) {
    const label = remove ? "Excluir esta casa?" : "Sair desta casa?";
    setConfirmation({
      title: label,
      description: remove
        ? "A casa e os dados compartilhados serão removidos desta demonstração local."
        : "Sua participação nesta casa será removida desta demonstração local.",
      confirmLabel: remove ? "Excluir casa" : "Sair da casa",
      onConfirm: () => {
        const memberships = session.memberships.filter((item) => item.householdId !== householdId);
        onSession({ ...session, memberships });
        setActiveHouseId(memberships[0]?.householdId ?? "");
        if (remove) setDataByHouse((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== householdId)));
        if (memberships.length) navigate("/casa");
        else navigate(session.canCreateHouse ? "/criar-casa" : "/acesso");
      },
    });
  }

  const pageTitle = route === "/casa/perfil" ? "Perfil"
    : route === "/casa/gestao" ? "Gerenciar casa"
      : route === "/casa/moradores" ? "Moradores e convites"
        : route === "/casa/tarefas" ? "Tarefas"
          : route === "/casa/compras" ? "Compras"
            : route === "/casa" || route === "/casa/inicio" ? "Início"
              : isEditor ? currentTask ? "Editar tarefa" : "Nova tarefa"
                : currentTask?.title ?? "Detalhe da tarefa";

  return (
    <div className={styles.app} data-resident-app="true">
      <header className={styles.header}>
        <button className={styles.housePicker} type="button" aria-haspopup="dialog" onClick={() => setHouseSheetOpen(true)}>
          <span className={styles.houseIcon}><House size={19} aria-hidden="true" /></span>
          <span className={styles.houseName}>{houseName}</span>
          <ChevronDown size={17} aria-hidden="true" />
        </button>
        <div className={styles.headerActions}>
          <span className={styles.demoBadge}>DEMO LOCAL</span>
          {themeControl}
          <Link className={styles.avatarLink} to="/casa/perfil" aria-label="Abrir perfil">
            <Avatar name={session.user.name} initials={initials(session.user.name)} tone="lilac" />
          </Link>
        </div>
      </header>

      <main className={styles.main} id="resident-content">
        <div className={styles.pageHeading}>
          {isDetail || isEditor ? <h1 className={styles.visuallyHidden}>{pageTitle}</h1> : <><span className={styles.eyebrow}>CHEGA DE BRIGA · {houseName.toLocaleUpperCase("pt-BR")}</span><h1>{pageTitle}</h1></>}
        </div>
        {route === "/casa" || route === "/casa/inicio" ? (
          <HomeScreen name={session.user.name} tasks={data.tasks} items={data.items} members={data.members} onComplete={completeTask} onAssume={assumeTask} />
        ) : route === "/casa/tarefas" ? (
          <>
            <div className={styles.primaryAction}><Button onClick={() => navigate("/casa/tarefas/nova")}><Plus size={18} aria-hidden="true" /> Nova tarefa</Button></div>
            <TaskListScreen tasks={data.tasks} members={data.members} section={taskSection} onSectionChange={taskScreenSection} filter={memberFilter} onFilterChange={setMemberFilter} onComplete={completeTask} onAssume={assumeTask} />
          </>
        ) : route === "/casa/compras" ? (
          <ShoppingScreen items={data.items} onAdd={addShoppingItem} onBought={markBought} onEdit={(item) => { setEditingItem(item); setItemQuantity(item.quantity); setItemPriority(item.priority); }} />
        ) : isEditor ? (
          <div className={styles.screenStack}>
            <button className={styles.backButton} type="button" onClick={() => navigate(currentTask ? `/casa/tarefas/${currentTask.id}?retorno=${encodeURIComponent(editorBackPath)}` : taskListPath)}><ArrowLeft size={18} aria-hidden="true" /> Voltar</button>
            <TaskEditor key={currentTask?.id ?? "nova"} task={currentTask} members={data.members} scope={new URLSearchParams(location.search).get("escopo") ?? undefined} onCancel={() => navigate(currentTask ? `/casa/tarefas/${currentTask.id}?retorno=${encodeURIComponent(editorBackPath)}` : taskListPath)} onSave={updateTask} />
          </div>
        ) : isDetail ? (
          <TaskDetailScreen
            task={currentTask}
            members={data.members}
            onBack={() => navigate(returnTo ?? taskListPath)}
            onEdit={openTaskEditor}
            onComplete={() => completeTask(currentTask?.id ?? "")}
            onAssume={() => assumeTask(currentTask?.id ?? "")}
            onSkip={() => skipTask(currentTask?.id ?? "")}
            onPause={() => pauseTask(currentTask?.id ?? "")}
            onResume={() => { setResumeTaskId(currentTask?.id); setResumeDate(dateKey(1)); }}
            onEnd={() => {
              if (!currentTask) return;
              setConfirmation({ title: "Encerrar esta rotina?", description: "Novas ocorrências deixarão de ser criadas. A ocorrência que já está aberta continua disponível para concluir ou pular.", confirmLabel: "Encerrar rotina", onConfirm: () => { restoreTask({ ...currentTask, ended: true }); showToast("Rotina encerrada."); } });
            }}
          />
        ) : route === "/casa/perfil" ? (
          <ProfileScreen session={session} onSave={(name) => onSession({ ...session, user: { ...session.user, name } })} onLogout={onLogout} />
        ) : route === "/casa/gestao" ? (
          <HouseScreen
            name={houseName}
            role={membership?.role ?? "morador"}
            canCreate={session.canCreateHouse}
            canLeave={membership?.role !== "responsavel" || data.members.filter((member) => member.role === "responsavel").length > 1}
            responsibleCount={data.members.filter((member) => member.role === "responsavel").length}
            onRename={(next) => setHouseNames((current) => ({ ...current, [householdId]: next }))}
            onMembers={() => navigate("/casa/moradores")}
            onLeave={() => leaveHouse(false)}
            onDelete={() => leaveHouse(true)}
            onCreateHouse={() => navigate("/criar-casa")}
          />
        ) : route === "/casa/moradores" ? (
          <>
            <button className={styles.backButton} type="button" onClick={() => navigate("/casa/gestao")}><ArrowLeft size={18} aria-hidden="true" /> Gerenciar casa</button>
            <MembersScreen data={data} userId={session.user.id} role={membership?.role ?? "morador"} onInvite={inviteResident} onRemove={removeMember} onRevoke={revokeInvite} onTransfer={transferResponsibility} />
          </>
        ) : <EmptyState title="Tela não encontrada." description="Volte para Início e escolha um destino da casa." />}
        <p className={styles.localNote}>Demonstração local: alterações se perdem ao atualizar ou fechar esta aba e não sincronizam com outras pessoas.</p>
      </main>

      <nav className={styles.bottomNav} aria-label="Navegação da casa">
        <NavLink to="/casa" end className={({ isActive }) => isActive ? styles.navActive : ""}><House size={21} aria-hidden="true" /><span>Início</span></NavLink>
        <NavLink to="/casa/tarefas" className={({ isActive }) => isActive ? styles.navActive : ""}><ListChecks size={21} aria-hidden="true" /><span>Tarefas</span></NavLink>
        <NavLink to="/casa/compras" className={({ isActive }) => isActive ? styles.navActive : ""}><ShoppingBasket size={21} aria-hidden="true" /><span>Compras</span></NavLink>
      </nav>

      <BottomSheet open={houseSheetOpen} onClose={() => setHouseSheetOpen(false)} title="Trocar de casa" footer={<><Button variant="secondary" onClick={() => { setHouseSheetOpen(false); navigate("/casa/gestao"); }}>Gerenciar casa</Button>{session.canCreateHouse && <Button onClick={() => { setHouseSheetOpen(false); navigate("/criar-casa"); }}><Plus size={17} aria-hidden="true" /> Criar outra casa</Button>}</>}>
        <div className={styles.houseOptions}>
          {session.memberships.map((item) => (
            <button key={item.householdId} type="button" className={householdId === item.householdId ? styles.houseOptionActive : styles.houseOption} onClick={() => { setActiveHouseId(item.householdId); setHouseSheetOpen(false); }}>
              <House size={19} aria-hidden="true" /><span><strong>{houseNames[item.householdId] ?? item.householdName}</strong><small>{item.role === "responsavel" ? "Responsável" : "Morador"}</small></span>{householdId === item.householdId && <Check size={19} aria-label="Casa ativa" />}
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={Boolean(editScopeTaskId)} onClose={() => setEditScopeTaskId(undefined)} title="O que você quer editar?">
        <p className={styles.sheetLead}>Escolha a partir de qual ponto a mudança vale.</p>
        <div className={styles.choiceList}>
          <Button variant="secondary" onClick={() => { const id = editScopeTaskId; setEditScopeTaskId(undefined); if (id) { const params = new URLSearchParams({ escopo: "occurrence", retorno: editorBackPath }); navigate(`/casa/tarefas/${id}/editar?${params}`); } }}>Só esta ocorrência</Button>
          <Button onClick={() => { const id = editScopeTaskId; setEditScopeTaskId(undefined); if (id) { const params = new URLSearchParams({ escopo: "series", retorno: editorBackPath }); navigate(`/casa/tarefas/${id}/editar?${params}`); } }}>Esta e as próximas</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={Boolean(resumeTaskId)} onClose={() => setResumeTaskId(undefined)} title="Retomar rotina" footer={<><Button variant="secondary" onClick={() => setResumeTaskId(undefined)}>Cancelar</Button><Button onClick={() => {
        const task = data.tasks.find((item) => item.id === resumeTaskId);
        if (task) {
          restoreTask({ ...task, dueDate: resumeDate, completed: false, skipped: false, paused: false, nextStartDate: undefined });
          showToast("Rotina retomada.");
        }
        setResumeTaskId(undefined);
      }}>Retomar</Button></>}>
        <p className={styles.sheetLead}>As datas durante a pausa não serão recriadas. Escolha a próxima data da rotina.</p>
        <TextField id="resume-date" label="Próxima ocorrência" type="date" required value={resumeDate} onChange={(event) => setResumeDate(event.target.value)} />
      </BottomSheet>

      <BottomSheet open={Boolean(editingItem)} onClose={() => setEditingItem(undefined)} title={`Editar ${editingItem?.name ?? "item"}`} footer={<><Button variant="secondary" onClick={() => setEditingItem(undefined)}>Cancelar</Button><Button onClick={saveShoppingEdit}>Salvar item</Button></>}>
        <div className={styles.formStack}>
          <TextField id="edit-item-quantity" label="Quantidade (opcional)" placeholder="Ex.: 1 kg" maxLength={50} value={itemQuantity} onChange={(event) => setItemQuantity(event.target.value)} />
          <Checkbox label="Comprar antes" detail="Acabou antes da próxima compra maior" checked={itemPriority === "before"} onChange={(event) => setItemPriority(event.target.checked ? "before" : "next")} />
        </div>
      </BottomSheet>

      <ConfirmDialog open={Boolean(confirmation)} onClose={() => setConfirmation(undefined)} title={confirmation?.title ?? "Confirmar ação"} description={confirmation?.description ?? ""} confirmLabel={confirmation?.confirmLabel ?? "Confirmar"} onConfirm={() => confirmation?.onConfirm()} />
    </div>
  );
}
