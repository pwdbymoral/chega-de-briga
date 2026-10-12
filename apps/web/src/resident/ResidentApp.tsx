import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronDown, House, ListChecks, Plus, ShoppingBasket } from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import type { AuthSession } from "../admin/contracts";
import type { ProductSyncEvent, ResidentGateway, TaskSyncEvent } from "../admin/contracts";
import { ApiError, errorMessage } from "../api/http";
import { Avatar, Button, Checkbox, DatePicker, EmptyState, TextField } from "../components/ui";
import { BottomSheet, ConfirmDialog } from "../components/ResidentOverlays";
import { useToast } from "../components/Toast";
import {
  dateKey,
  initials,
  newId,
  nextOccurrence,
  taskInput,
  type HouseData,
  type ResidentTask,
  type ShoppingItem,
  type TaskInput,
} from "./ResidentModel";
import {
  HomeScreen,
  DeleteAccountScreen,
  HouseScreen,
  MembersScreen,
  ProfileScreen,
  ShoppingScreen,
  TaskDetailScreen,
  TaskEditor,
  TaskListScreen,
} from "./ResidentScreens";
import styles from "./ResidentApp.module.css";
import { clearCachedHouses, mergeHouseData, readCachedHouse, removeCachedHouse, writeCachedHouse, type CachedHouse, type SyncConflict } from "./localCache";

type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function ResidentApp({
  session,
  onSession,
  gateway,
  themeControl,
  onLogout,
}: {
  session: AuthSession;
  onSession: (session: AuthSession | null) => void;
  gateway: ResidentGateway;
  themeControl: ReactNode;
  onLogout: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [activeHouseId, setActiveHouseId] = useState(session.memberships[0]?.householdId ?? "");
  const [houseNames, setHouseNames] = useState(() => Object.fromEntries(session.memberships.map((membership) => [membership.householdId, membership.householdName])));
  const [dataByHouse, setDataByHouse] = useState<Record<string, HouseData>>({});
  const [loadedHouses, setLoadedHouses] = useState<Record<string, boolean>>({});
  const versionRef = useRef<Record<string, number>>({});
  const cacheRef = useRef<Record<string, CachedHouse>>({});
  const syncingRef = useRef<Record<string, boolean>>({});
  const saveQueueRef = useRef(Promise.resolve());
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pendingHouses, setPendingHouses] = useState<Record<string, boolean>>({});
  const [syncConflict, setSyncConflict] = useState<{
    householdId: string;
    base: HouseData;
    local: HouseData;
    shared: HouseData;
    version: number;
    conflicts: SyncConflict[];
  }>();
  const [syncConflictOpen, setSyncConflictOpen] = useState(true);
  const [conflictChoices, setConflictChoices] = useState<Record<string, "local" | "shared">>({});
  const syncConflictRef = useRef(syncConflict);
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

  useEffect(() => {
    if (navigator.storage?.persist) void navigator.storage.persist().catch(() => false);
  }, []);

  const membership = session.memberships.find((item) => item.householdId === activeHouseId) ?? session.memberships[0];
  const householdId = membership?.householdId ?? "";
  const houseName = houseNames[householdId] ?? membership?.householdName ?? "Minha casa";
  const data = dataByHouse[householdId] ?? { members: [], tasks: [], items: [], invites: [] };
  const route = location.pathname.replace(/\/+$/, "") || "/casa";
  const returnTo = new URLSearchParams(location.search).get("retorno") ?? undefined;
  const taskListPath = `/casa/tarefas${taskSection === "today" ? "" : `?visao=${taskSection === "week" ? "semana" : "rotinas"}`}`;
  const editorBackPath = returnTo ?? taskListPath;
  const taskId = route.startsWith("/casa/tarefas/") ? route.slice("/casa/tarefas/".length).split("/")[0] : undefined;
  const currentTask = data.tasks.find((task) => task.id === taskId);
  const isEditor = route === "/casa/tarefas/nova" || route.endsWith("/editar");
  const isDetail = Boolean(taskId && taskId !== "nova" && !route.endsWith("/editar"));

  const cacheHouse = useCallback((id: string, value: CachedHouse) => {
    cacheRef.current[id] = value;
    setPendingHouses((current) => ({ ...current, [id]: value.pending }));
    void writeCachedHouse(id, value).catch(() => showToast("Não foi possível guardar os dados desta casa neste aparelho. Libere espaço de armazenamento e atualize a tela."));
  }, [showToast]);

  const syncCachedHouse = useCallback(async (id: string) => {
    if (!navigator.onLine || syncConflictRef.current?.householdId === id || syncingRef.current[id]) return;
    syncingRef.current[id] = true;
    try {
      const cached = cacheRef.current[id] ?? await readCachedHouse(id).catch(() => undefined);
      if (!cached?.pending) return;
      cacheRef.current[id] = cached;
      try {
        const saved = await gateway.saveHousehold(id, cached.version, cached.data, cached.events);
        versionRef.current[id] = saved.version;
        const latest = cacheRef.current[id];
        const stillPending = latest !== cached && latest.pending;
        const savedData = { ...(latest?.data ?? cached.data), firstValueAt: saved.firstValueAt };
        cacheHouse(id, {
          version: saved.version,
          data: savedData,
          baseData: cached.data,
          pending: stillPending,
          events: latest && latest !== cached ? latest.events.filter((event) => !cached.events.some((sent) => sent.id === event.id)) : [],
          savedAt: new Date().toISOString(),
        });
        if (!stillPending) setDataByHouse((current) => ({ ...current, [id]: savedData }));
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          const current = error.payload.current as { version?: number; data?: Partial<HouseData> } | undefined;
          if (typeof current?.version === "number" && current.data) {
            const shared = { ...cached.baseData, ...cached.data, ...current.data } as HouseData;
            const merged = mergeHouseData(cached.baseData, cached.data, shared);
            versionRef.current[id] = 0;
            if (merged.conflicts.length) {
              const value = { householdId: id, base: cached.baseData, local: cached.data, shared, version: current.version, conflicts: merged.conflicts };
              syncConflictRef.current = value;
              setSyncConflict(value);
              setSyncConflictOpen(true);
              setConflictChoices({});
              return;
            }
            const retry: CachedHouse = { ...cached, version: current.version, baseData: shared, data: merged.data, pending: true, savedAt: new Date().toISOString() };
            cacheHouse(id, retry);
            versionRef.current[id] = current.version;
            window.setTimeout(() => { void syncCachedHouse(id); }, 0);
            return;
          }
        }
        cacheHouse(id, { ...cached, pending: true });
        if (navigator.onLine) showToast(errorMessage(error, "Há alterações aguardando sincronização. Confira sua conexão e tente novamente."));
      }
    } finally {
      delete syncingRef.current[id];
    }
  }, [cacheHouse, gateway, showToast]);

  useEffect(() => {
    if (!activeHouseId) return;
    let current = true;
    void (async () => {
      const cached = await readCachedHouse(activeHouseId).catch(() => undefined);
      if (!current) return;
      if (cached) {
        cacheRef.current[activeHouseId] = cached;
        setDataByHouse((value) => ({ ...value, [activeHouseId]: cached.data }));
        setPendingHouses((value) => ({ ...value, [activeHouseId]: cached.pending }));
        if (!navigator.onLine) setLoadedHouses((value) => ({ ...value, [activeHouseId]: true }));
      }
      if (!navigator.onLine) {
        setLoadedHouses((value) => ({ ...value, [activeHouseId]: true }));
        return;
      }
      try {
        if (cached?.pending) {
          await syncCachedHouse(activeHouseId);
        } else {
          const snapshot = await gateway.loadHousehold(activeHouseId);
          if (!current) return;
          versionRef.current[activeHouseId] = snapshot.version;
          const next: CachedHouse = { version: snapshot.version, data: snapshot.data, baseData: snapshot.data, pending: false, events: [], savedAt: new Date().toISOString() };
          cacheHouse(activeHouseId, next);
          setDataByHouse((value) => ({ ...value, [activeHouseId]: snapshot.data }));
        }
        if (current) setLoadedHouses((value) => ({ ...value, [activeHouseId]: true }));
      } catch (error) {
        if (!current) return;
        setLoadedHouses((value) => ({ ...value, [activeHouseId]: true }));
        showToast(errorMessage(error, "Não foi possível abrir os dados da casa. Confira sua conexão e tente novamente."));
      }
    })();
    return () => { current = false; };
  }, [activeHouseId, cacheHouse, gateway, showToast, syncCachedHouse]);

  useEffect(() => {
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || !navigator.onLine || document.visibilityState !== "visible" || cacheRef.current[activeHouseId]?.pending || syncingRef.current[activeHouseId]) return;
      refreshing = true;
      try {
        const snapshot = await gateway.loadHousehold(activeHouseId);
        if (snapshot.version === versionRef.current[activeHouseId]) return;
        versionRef.current[activeHouseId] = snapshot.version;
        const next: CachedHouse = { version: snapshot.version, data: snapshot.data, baseData: snapshot.data, pending: false, events: [], savedAt: new Date().toISOString() };
        cacheHouse(activeHouseId, next);
        setDataByHouse((current) => ({ ...current, [activeHouseId]: snapshot.data }));
      } catch {
        // A later focus or interval retries the shared snapshot.
      } finally {
        refreshing = false;
      }
    };
    const interval = window.setInterval(() => { void refresh(); }, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [activeHouseId, cacheHouse, gateway]);

  useEffect(() => {
    const wentOnline = () => {
      setOnline(true);
      for (const id of Object.keys(cacheRef.current)) if (cacheRef.current[id]?.pending) void syncCachedHouse(id);
    };
    const wentOffline = () => setOnline(false);
    window.addEventListener("online", wentOnline);
    window.addEventListener("offline", wentOffline);
    return () => {
      window.removeEventListener("online", wentOnline);
      window.removeEventListener("offline", wentOffline);
    };
  }, [syncCachedHouse]);

  useEffect(() => { syncConflictRef.current = syncConflict; }, [syncConflict]);

  function patchData(update: (current: HouseData) => HouseData, kind: "task" | "shopping" = "task", event?: ProductSyncEvent) {
    if (!navigator.onLine && kind === "task") {
      showToast("Tarefas e rotinas ficam disponíveis somente para consulta sem conexão.");
      return false;
    }
    if (syncConflictRef.current?.householdId === householdId) {
      showToast("Resolva primeiro a sincronização pendente da lista.");
      return false;
    }
    if (!versionRef.current[householdId] && !cacheRef.current[householdId]) {
      showToast("Aguarde a casa carregar antes de alterar os dados.");
      return false;
    }
    const currentData = dataByHouse[householdId] ?? data;
    const updatedData = update(currentData);
    const nextData = event && (event.type === "tarefa_criada" || event.type === "item_compra_adicionado") && !currentData.firstValueAt
      ? { ...updatedData, firstValueAt: new Date().toISOString() }
      : updatedData;
    setDataByHouse((current) => ({
      ...current,
      [householdId]: nextData,
    }));
    const previous = cacheRef.current[householdId];
    const pending: CachedHouse = {
      version: previous?.version ?? versionRef.current[householdId] ?? 0,
      data: nextData,
      baseData: previous?.pending ? previous.baseData : currentData,
      pending: true,
      events: event ? [...(previous?.events ?? []), event] : previous?.events ?? [],
      savedAt: new Date().toISOString(),
    };
    cacheHouse(householdId, pending);
    if (navigator.onLine) {
      saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(() => syncCachedHouse(householdId));
    }
    return true;
  }

  async function reloadHousehold(id = householdId) {
    const snapshot = await gateway.loadHousehold(id);
    versionRef.current[id] = snapshot.version;
    setDataByHouse((current) => ({ ...current, [id]: snapshot.data }));
    setLoadedHouses((current) => ({ ...current, [id]: true }));
    cacheHouse(id, { version: snapshot.version, data: snapshot.data, baseData: snapshot.data, pending: false, events: [], savedAt: new Date().toISOString() });
  }

  function resolveSyncConflict() {
    const conflict = syncConflictRef.current;
    if (!conflict || conflict.conflicts.some((item) => !conflictChoices[item.key])) return;
    const merged = mergeHouseData(conflict.base, conflict.local, conflict.shared, conflictChoices);
    const previous = cacheRef.current[conflict.householdId];
    const next: CachedHouse = {
      version: conflict.version,
      data: merged.data,
      baseData: conflict.shared,
      pending: true,
      events: previous?.events ?? [],
      savedAt: new Date().toISOString(),
    };
    versionRef.current[conflict.householdId] = conflict.version;
    syncConflictRef.current = undefined;
    setSyncConflict(undefined);
    setConflictChoices({});
    cacheHouse(conflict.householdId, next);
    setDataByHouse((current) => ({ ...current, [conflict.householdId]: merged.data }));
    void syncCachedHouse(conflict.householdId);
  }

  function requestLogout() {
    const pending = Object.values(cacheRef.current).filter((item) => item.pending).length;
    if (!navigator.onLine) {
      showToast(pending ? "Conecte-se para sincronizar as mudanças antes de sair." : "Conecte-se para encerrar a sessão com segurança.");
      return;
    }
    if (pending) {
      setConfirmation({
        title: "Sincronizar antes de sair?",
        description: `${pending} casa(s) têm mudanças locais pendentes. Vamos tentar sincronizá-las antes de encerrar a sessão.`,
        confirmLabel: "Sincronizar e sair",
        onConfirm: () => {
          void (async () => {
            for (const id of Object.keys(cacheRef.current)) await syncCachedHouse(id);
            if (Object.values(cacheRef.current).some((item) => item.pending) || syncConflictRef.current) {
              showToast("Resolva as mudanças pendentes antes de sair.");
              return;
            }
            onLogout();
          })();
        },
      });
      return;
    }
    onLogout();
  }

  function restoreTask(task: ResidentTask, event?: TaskSyncEvent) {
    return patchData((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === task.id ? task : item) }), "task", event);
  }

  function completeTask(id: string) {
    const task = data.tasks.find((item) => item.id === id);
    if (!task) return;
    const series = task.seriesBase ?? taskInput(task);
    const schedule = { ...task, ...series, seriesBase: undefined, occurrenceKey: undefined };
    const occurrenceDate = task.occurrenceKey ?? task.dueDate;
    let updated: ResidentTask;
    if (task.repeat === "once" || task.ended) {
      updated = { ...schedule, paused: task.paused, ended: task.ended, completed: true, skipped: false, nextStartDate: undefined };
    } else if (task.paused) {
      updated = {
        ...schedule,
        paused: true,
        completed: true,
        skipped: false,
        nextStartDate: undefined,
        rotationIndex: schedule.ownerMode === "rotation" && schedule.rotation.length ? (schedule.rotationIndex + 1) % schedule.rotation.length : schedule.rotationIndex,
      };
    } else {
      updated = {
        ...schedule,
        dueDate: task.nextStartDate ?? nextOccurrence(schedule),
        nextStartDate: undefined,
        completed: false,
        skipped: false,
        paused: task.paused,
        ended: task.ended,
        assigneeId: schedule.ownerMode === "agree" ? undefined : schedule.assigneeId,
        rotationIndex: schedule.ownerMode === "rotation" && schedule.rotation.length ? (schedule.rotationIndex + 1) % schedule.rotation.length : schedule.rotationIndex,
      };
    }
    if (!restoreTask(updated, { id: newId("evento"), type: "tarefa_concluida", taskId: task.id, occurrenceDate })) return;
    showToast("Tarefa concluída.", { action: { label: "Desfazer", onClick: () => restoreTask(task) } });
  }

  function assumeTask(id: string) {
    const task = data.tasks.find((item) => item.id === id);
    if (!task) return;
    const updated = { ...task, assigneeId: session.user.id };
    if (!restoreTask(updated)) return;
    showToast("Você assumiu esta tarefa.", { action: { label: "Desfazer", onClick: () => restoreTask(task) } });
  }

  function skipTask(id: string) {
    const task = data.tasks.find((item) => item.id === id);
    if (!task) return;
    const series = task.seriesBase ?? taskInput(task);
    const schedule = { ...task, ...series, seriesBase: undefined, occurrenceKey: undefined };
    const occurrenceDate = task.occurrenceKey ?? task.dueDate;
    const updated = task.repeat === "once" || task.ended
      ? { ...schedule, paused: task.paused, ended: task.ended, completed: false, skipped: true, nextStartDate: undefined }
      : task.paused
        ? {
            ...schedule,
            paused: true,
            completed: false,
            skipped: true,
            nextStartDate: undefined,
            rotationIndex: schedule.ownerMode === "rotation" && schedule.rotation.length ? (schedule.rotationIndex + 1) % schedule.rotation.length : schedule.rotationIndex,
          }
      : {
          ...schedule,
          dueDate: nextOccurrence(schedule),
          assigneeId: schedule.ownerMode === "agree" ? undefined : schedule.assigneeId,
          rotationIndex: schedule.ownerMode === "rotation" && schedule.rotation.length ? (schedule.rotationIndex + 1) % schedule.rotation.length : schedule.rotationIndex,
        };
    if (!restoreTask(updated, { id: newId("evento"), type: "tarefa_pulada", taskId: task.id, occurrenceDate })) return;
    showToast("Ocorrência pulada.", { action: { label: "Desfazer", onClick: () => restoreTask(task) } });
  }

  function pauseTask(id: string) {
    const task = data.tasks.find((item) => item.id === id);
    if (!task) return;
    if (!restoreTask({ ...task, paused: true })) return;
    showToast("Rotina pausada.", { action: { label: "Desfazer", onClick: () => restoreTask(task) } });
  }

  function updateTask(value: TaskInput, scope?: "occurrence" | "series") {
    const task = currentTask;
    if (!navigator.onLine) {
      showToast("Tarefas e rotinas ficam disponíveis somente para consulta sem conexão.");
      return;
    }
    if (task) {
      const updated = scope === "occurrence"
        ? { ...task, ...value, occurrenceKey: task.occurrenceKey ?? task.dueDate, seriesBase: task.seriesBase ?? taskInput(task) }
        : { ...task, ...value, occurrenceKey: undefined, seriesBase: undefined };
      if (!restoreTask(updated, { id: newId("evento"), type: "tarefa_editada", taskId: task.id, occurrenceDate: task.occurrenceKey ?? task.dueDate, scope: scope ?? "series" })) return;
      showToast("Tarefa atualizada.");
    } else {
      const created: ResidentTask = { id: newId("tarefa"), ...value, completed: false, skipped: false, paused: false, ended: false };
      if (!patchData((current) => ({
        ...current,
        tasks: [created, ...current.tasks],
      }), "task", { id: newId("evento"), type: "tarefa_criada", taskId: created.id })) return;
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
      }), "shopping");
      showToast(`${duplicate.name} já estava na lista; o item foi atualizado.`);
      return;
    }
    const item = { id: newId("item"), name: cleaned, quantity: quantity.trim(), priority };
    patchData((current) => ({ ...current, items: [item, ...current.items] }), "shopping", { id: newId("evento"), type: "item_compra_adicionado", itemId: item.id });
    showToast("Item adicionado à lista.");
  }

  function markBought(id: string) {
    const item = data.items.find((entry) => entry.id === id);
    if (!item) return;
    patchData((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== id) }), "shopping");
    showToast(`${item.name} marcado como comprado.`, {
      action: {
        label: "Desfazer",
        onClick: () => patchData((current) => ({ ...current, items: current.items.some((entry) => entry.id === id) ? current.items : [item, ...current.items] }), "shopping"),
      },
    });
  }

  function saveShoppingEdit() {
    if (!editingItem) return;
    patchData((current) => ({ ...current, items: current.items.map((item) => item.id === editingItem.id ? { ...item, quantity: itemQuantity.trim(), priority: itemPriority } : item) }), "shopping");
    setEditingItem(undefined);
    showToast("Item atualizado.");
  }

  function inviteResident(email: string) {
    if (!email.trim()) return;
    void gateway.inviteResident(householdId, email).then(() => reloadHousehold()).then(() => showToast("Convite enviado por e-mail."))
      .catch((error: unknown) => showToast(errorMessage(error, "Não foi possível enviar o convite. Confira o e-mail e tente novamente.")));
  }

  function revokeInvite(id: string) {
    const invite = data.invites.find((item) => item.id === id);
    if (!invite) return;
    setConfirmation({
      title: "Revogar convite?",
      description: `O link enviado para ${invite.email} deixará de funcionar.`,
      confirmLabel: "Revogar convite",
      onConfirm: () => {
        void gateway.revokeInvitation(householdId, id).then(() => reloadHousehold()).then(() => showToast("Convite revogado."))
          .catch((error: unknown) => showToast(errorMessage(error, "Não foi possível revogar o convite. Atualize a tela e tente novamente.")));
      },
    });
  }

  function removeMember(id: string) {
    const person = data.members.find((member) => member.id === id);
    if (!person) return;
    setConfirmation({
      title: `Remover ${person.name}?`,
      description: "As tarefas e rotinas atribuídas a esta pessoa passarão para A combinar.",
      confirmLabel: "Remover morador",
      onConfirm: () => {
        void gateway.removeMember(householdId, id).then(() => reloadHousehold()).then(() => showToast("Morador removido da casa."))
          .catch((error: unknown) => showToast(errorMessage(error, "Não foi possível remover o morador. Atualize a tela e tente novamente.")));
      },
    });
  }

  function transferResponsibility(id: string) {
    const next = data.members.find((member) => member.id === id);
    if (!next) return;
    void gateway.transferResponsibility(householdId, id).then((nextSession) => {
      onSession(nextSession);
      return reloadHousehold();
    }).then(() => showToast(`${next.name} agora é responsável.`))
      .catch((error: unknown) => showToast(errorMessage(error, "Não foi possível transferir a responsabilidade. Confira os dados e tente novamente.")));
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
        ? "A casa e os dados compartilhados serão removidos para todos os moradores."
        : "Sua participação será removida desta casa. Os demais moradores e os dados compartilhados permanecem.",
      confirmLabel: remove ? "Excluir casa" : "Sair da casa",
      onConfirm: () => {
        const memberships = session.memberships.filter((item) => item.householdId !== householdId);
        const action = remove ? gateway.deleteHousehold(householdId).then(() => ({ ...session, memberships })) : gateway.leaveHousehold(householdId);
        void action.then((nextSession) => {
          onSession(nextSession);
          setActiveHouseId(nextSession.memberships[0]?.householdId ?? "");
          cacheRef.current = Object.fromEntries(Object.entries(cacheRef.current).filter(([id]) => id !== householdId));
          setPendingHouses((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== householdId)));
          void removeCachedHouse(householdId);
          if (remove) setDataByHouse((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== householdId)));
          if (nextSession.memberships.length) navigate("/casa");
          else navigate(nextSession.canCreateHouse ? "/criar-casa" : "/entrar");
        }).catch((error: unknown) => showToast(errorMessage(error, "Não foi possível concluir a ação. Atualize a tela e tente novamente.")));
      },
    });
  }

  const pageTitle = route === "/casa/perfil" ? "Perfil"
    : route === "/casa/perfil/excluir" ? "Excluir conta"
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
          {import.meta.env.DEV && <span className={styles.demoBadge}>DEMO LOCAL</span>}
          {themeControl}
          <Link className={styles.avatarLink} to="/casa/perfil" aria-label="Abrir perfil">
            <Avatar name={session.user.name} initials={initials(session.user.name)} tone="lilac" />
          </Link>
        </div>
      </header>

      <main className={styles.main} id="resident-content">
        {!loadedHouses[householdId] ? <p role="status">Carregando dados da casa…</p> : null}
        <div className={styles.pageHeading}>
          {isDetail || isEditor ? <h1 className={styles.visuallyHidden}>{pageTitle}</h1> : <><span className={styles.eyebrow}>CHEGA DE BRIGA · {houseName.toLocaleUpperCase("pt-BR")}</span><h1>{pageTitle}</h1></>}
        </div>
        {!online && <p className={styles.syncNotice} role="status">Sem conexão. Tarefas e rotinas estão disponíveis para consulta; a lista de compras pode ser alterada e sincroniza quando a conexão voltar.</p>}
        {online && pendingHouses[householdId] && <div className={styles.syncNotice} role="status"><span>Há mudanças neste aparelho aguardando sincronização.</span><Button variant="quiet" onClick={() => void syncCachedHouse(householdId)}>Tentar sincronizar</Button></div>}
        {syncConflict && !syncConflictOpen && <Button variant="secondary" onClick={() => setSyncConflictOpen(true)}>Resolver mudanças em conflito</Button>}
        {!online && !cacheRef.current[householdId] ? <EmptyState title="Conecte-se para carregar esta casa." description="Depois de carregar uma vez, você poderá consultar tarefas e atualizar a lista de compras sem conexão." /> : route === "/casa" || route === "/casa/inicio" ? (
          <HomeScreen name={session.user.name} tasks={data.tasks} items={data.items} members={data.members} showFirstUse={!data.firstValueAt && data.tasks.length === 0 && data.items.length === 0} onComplete={completeTask} onAssume={assumeTask} />
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
          <ProfileScreen session={session} gateway={gateway} onSave={(name) => {
            void gateway.updateProfileName(name).then(() => onSession({ ...session, user: { ...session.user, name } })).catch((error: unknown) => showToast(errorMessage(error, "Não foi possível atualizar o perfil. Revise o nome e tente novamente.")));
          }} onLogout={requestLogout} />
        ) : route === "/casa/perfil/excluir" ? (
          <DeleteAccountScreen onCancel={() => navigate("/casa/perfil")} onDelete={async () => {
            await gateway.deleteAccount();
            await clearCachedHouses();
            onSession(null);
            navigate("/entrar", { replace: true });
          }} />
        ) : route === "/casa/gestao" ? (
          <HouseScreen
            name={houseName}
            role={membership?.role ?? "morador"}
            canCreate={session.canCreateHouse}
            canLeave={membership?.role !== "responsavel" || data.members.filter((member) => member.role === "responsavel").length > 1}
            responsibleCount={data.members.filter((member) => member.role === "responsavel").length}
            onRename={(next) => {
              void gateway.renameHousehold(householdId, next).then(() => {
                setHouseNames((current) => ({ ...current, [householdId]: next }));
                showToast("Nome da casa atualizado.");
              }).catch((error: unknown) => showToast(errorMessage(error, "Não foi possível atualizar a casa. Revise os dados e tente novamente.")));
            }}
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
        {import.meta.env.DEV && <p className={styles.localNote}>Demonstração local: alterações se perdem ao atualizar ou fechar esta aba e não sincronizam com outras pessoas.</p>}
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
        <DatePicker id="resume-date" label="Próxima ocorrência" required value={resumeDate} onChange={setResumeDate} />
      </BottomSheet>

      <BottomSheet open={Boolean(editingItem)} onClose={() => setEditingItem(undefined)} title={`Editar ${editingItem?.name ?? "item"}`} footer={<><Button variant="secondary" onClick={() => setEditingItem(undefined)}>Cancelar</Button><Button onClick={saveShoppingEdit}>Salvar item</Button></>}>
        <div className={styles.formStack}>
          <TextField id="edit-item-quantity" label="Quantidade (opcional)" placeholder="Ex.: 1 kg" maxLength={50} value={itemQuantity} onChange={(event) => setItemQuantity(event.target.value)} />
          <Checkbox label="Comprar antes" detail="Acabou antes da próxima compra maior" checked={itemPriority === "before"} onChange={(event) => setItemPriority(event.target.checked ? "before" : "next")} />
        </div>
      </BottomSheet>

      <BottomSheet open={Boolean(syncConflict && syncConflictOpen)} onClose={() => setSyncConflictOpen(false)} title="Mudanças em outro aparelho" footer={<Button disabled={Boolean(syncConflict?.conflicts.some((item) => !conflictChoices[item.key]))} onClick={resolveSyncConflict}>Aplicar escolhas</Button>}>
        <p className={styles.sheetLead}>Algumas linhas mudaram nos dois aparelhos. Escolha qual versão vale para cada uma; as outras mudanças serão mescladas.</p>
        <div className={styles.conflictList}>
          {syncConflict?.conflicts.map((item) => {
            const localValue = item.local && "name" in item.local ? `${item.local.name}${item.local.quantity ? ` · ${item.local.quantity}` : ""}` : item.local && "title" in item.local ? item.local.title : "Removido neste aparelho";
            const sharedValue = item.shared && "name" in item.shared ? `${item.shared.name}${item.shared.quantity ? ` · ${item.shared.quantity}` : ""}` : item.shared && "title" in item.shared ? item.shared.title : "Removido em outro aparelho";
            return <section className={styles.conflictItem} key={item.key}>
              <strong>{item.label}</strong>
              <p>Seu aparelho: {localValue}</p>
              <p>Compartilhado: {sharedValue}</p>
              <div className={styles.conflictChoices}>
                <Button variant={conflictChoices[item.key] === "shared" ? "primary" : "secondary"} onClick={() => setConflictChoices((value) => ({ ...value, [item.key]: "shared" }))}>Usar compartilhada</Button>
                <Button variant={conflictChoices[item.key] === "local" ? "primary" : "secondary"} onClick={() => setConflictChoices((value) => ({ ...value, [item.key]: "local" }))}>Manter deste aparelho</Button>
              </div>
            </section>;
          })}
        </div>
      </BottomSheet>

      <ConfirmDialog open={Boolean(confirmation)} onClose={() => setConfirmation(undefined)} title={confirmation?.title ?? "Confirmar ação"} description={confirmation?.description ?? ""} confirmLabel={confirmation?.confirmLabel ?? "Confirmar"} onConfirm={() => confirmation?.onConfirm()} />
    </div>
  );
}
