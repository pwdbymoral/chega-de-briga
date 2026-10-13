import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Download,
  UserRoundPlus,
  ShieldCheck,
  Ban,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  House,
  LogOut,
  Mail,
  Pause,
  Pencil,
  Play,
  Plus,
  ShoppingBasket,
  SkipForward,
  Trash2,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router";
import type { AuthSession, HouseholdRole, ResidentGateway } from "../admin/contracts";
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  DatePicker,
  EmptyState,
  IconButton,
  Select,
  StatusBadge,
  TextField,
} from "../components/ui";
import { CardActions } from "../components/CardActions";
import { BottomSheet } from "../components/ResidentOverlays";
import { useToast } from "../components/Toast";
import { errorMessage } from "../api/http";
import {
  addDays,
  dateKey,
  formatDate,
  fullDate,
  fromDateKey,
  initials,
  memberName,
  repeatLabel,
  taskAssignee,
  taskAssigneeLabel,
  weekDays,
  repeatOptions,
  ownerOptions,
  timeOptions,
  type OwnerMode,
  type Repeat,
  type ResidentMember,
  type ResidentTask,
  type ShoppingItem,
  type HouseData,
  type TaskInput,
} from "./ResidentModel";
import styles from "./ResidentApp.module.css";

export function TaskRow({
  task,
  members,
  returnTo,
  onComplete,
  onAssume,
}: {
  task: ResidentTask;
  members: ResidentMember[];
  returnTo: string;
  onComplete: (id: string) => void;
  onAssume: (id: string) => void;
}) {
  const isOverdue = Boolean(task.dueDate && task.dueDate < dateKey());
  return (
    <article className={styles.taskRow}>
      <CardActions context={task.title}
        primary={{ label: "Concluir", icon: Check, onClick: () => onComplete(task.id) }}
        secondary={!taskAssignee(task) ? [{ label: "Assumir", icon: UserRoundPlus, onClick: () => onAssume(task.id) }] : []}>
      <div className={styles.taskCopy}>
        <Link className={styles.taskTitle} to={`/casa/tarefas/${task.id}?retorno=${encodeURIComponent(returnTo)}`}>{task.title}</Link>
        <div className={styles.taskMeta}>
          <span>{taskAssigneeLabel(task, members)}</span>
          <span aria-hidden="true">·</span>
          <span>{task.dueDate ? formatDate(task.dueDate) : "Sem data"}</span>
          {task.repeat !== "once" && <><span aria-hidden="true">·</span><span>{repeatLabel(task.repeat, task.weeklyDays)}</span></>}
        </div>
        {(task.paused || isOverdue) && (
          <div className={styles.taskBadges}>
            {task.paused && <StatusBadge tone="warning">Rotina pausada</StatusBadge>}
            {isOverdue && <StatusBadge tone="danger">Atrasada</StatusBadge>}
          </div>
        )}
      </div>
      </CardActions>
    </article>
  );
}

export function HomeScreen({
  name,
  tasks,
  items,
  members,
  showFirstUse = false,
  onComplete,
  onAssume,
}: {
  name: string;
  tasks: ResidentTask[];
  items: ShoppingItem[];
  members: ResidentMember[];
  showFirstUse?: boolean;
  onComplete: (id: string) => void;
  onAssume: (id: string) => void;
}) {
  const todayTasks = tasks
    .filter((task) => !task.completed && !task.skipped && task.dueDate && task.dueDate <= dateKey())
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const urgentItems = items.filter((item) => item.priority === "before").length;
  return (
    <div className={styles.screenStack}>
      <section className={styles.welcome}>
        <div className={styles.welcomeCopy}>
          <span className={styles.eyebrow}>BOM DIA, {name.split(" ")[0].toLocaleUpperCase("pt-BR")}</span>
          <h2>Vamos cuidar da casa em equipe.</h2>
          <p>O combinado de hoje, sem precisar adivinhar.</p>
        </div>
        <img src="/faisca.svg" alt="" aria-hidden="true" />
      </section>

      {showFirstUse && <Card className={styles.firstUseCard}>
        <CardActions context="Primeiro combinado" primary={{ label: "Criar tarefa", icon: Plus, to: "/casa/tarefas/nova" }} secondary={[{ label: "Adicionar item", icon: ShoppingBasket, to: "/casa/compras" }]}>
          <span className={styles.eyebrow}>PRIMEIRO COMBINADO</span>
          <h2>Comece pelo que já precisa acontecer.</h2>
        </CardActions>
        <p>Registre uma tarefa da casa ou anote algo que está faltando. O combinado fica visível para todo mundo.</p>
      </Card>}

      <section className={styles.contentSection} aria-labelledby="home-tasks-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>O QUE PEDE ATENÇÃO</span>
            <h2 id="home-tasks-title">Hoje em casa</h2>
          </div>
          <Link to="/casa/tarefas?visao=semana">Ver semana <CalendarDays size={17} aria-hidden="true" /></Link>
        </div>
        {todayTasks.length ? (
          <Card className={styles.listCard}>
            {todayTasks.slice(0, 4).map((task) => (
              <TaskRow key={task.id} task={task} members={members} returnTo="/casa" onComplete={onComplete} onAssume={onAssume} />
            ))}
          </Card>
        ) : (
          <div className={styles.emptyPanel}>
            <EmptyState title="Tudo em dia por aqui." description="Se surgir algo, adicionem em Tarefas e combinem quem cuida." />
            <Link className={styles.inlineLink} to="/casa/tarefas/nova"><Plus size={17} aria-hidden="true" /> Criar tarefa</Link>
          </div>
        )}
        {todayTasks.length > 4 && <Link className={styles.inlineLink} to="/casa/tarefas">Ver todas as tarefas de hoje <span aria-hidden="true">→</span></Link>}
      </section>

      <section className={styles.shoppingSummary} aria-labelledby="home-shopping-title">
        <CardActions context="Lista de compras" primary={{ label: "Abrir lista", icon: ShoppingBasket, to: "/casa/compras" }}>
          <div className={styles.summaryCopy}>
            <span className={styles.eyebrow}>REPOSIÇÃO DA CASA</span>
            <h2 id="home-shopping-title">{items.length} {items.length === 1 ? "item na lista" : "itens na lista"}</h2>
            <p>{urgentItems ? `${urgentItems} para comprar antes da próxima ida maior` : "Nenhum item marcado como urgente"}</p>
          </div>
        </CardActions>
      </section>

      <section className={styles.quickActions} aria-label="Ações rápidas">
        <Link to="/casa/tarefas/nova"><Plus size={19} aria-hidden="true" /> Nova tarefa</Link>
        <Link to="/casa/compras"><ShoppingBasket size={19} aria-hidden="true" /> Adicionar item</Link>
      </section>
    </div>
  );
}

export function TaskListScreen({
  tasks,
  members,
  section,
  onSectionChange,
  filter,
  onFilterChange,
  onComplete,
  onAssume,
}: {
  tasks: ResidentTask[];
  members: ResidentMember[];
  section: "today" | "week" | "routines";
  onSectionChange: (section: "today" | "week" | "routines") => void;
  filter: string;
  onFilterChange: (value: string) => void;
  onComplete: (id: string) => void;
  onAssume: (id: string) => void;
}) {
  const openTasks = tasks.filter((task) => !task.completed && !task.skipped);
  const filtered = openTasks.filter((task) => {
    if (filter === "todos") return true;
    if (filter === "a-combinar") return !taskAssignee(task);
    return taskAssignee(task) === filter;
  });
  const today = dateKey();
  const sections = section === "routines"
    ? [
        { title: "Ativas", tasks: filtered.filter((task) => task.repeat !== "once" && !task.paused && !task.ended) },
        { title: "Pausadas", tasks: filtered.filter((task) => task.repeat !== "once" && task.paused && !task.ended) },
      ]
    : section === "today"
      ? [
          { title: "Atrasadas", tasks: filtered.filter((task) => task.dueDate && task.dueDate < today) },
          { title: "Para hoje", tasks: filtered.filter((task) => task.dueDate === today) },
          { title: "Sem data", tasks: filtered.filter((task) => !task.dueDate && task.repeat === "once") },
        ]
      : [
          { title: "Atrasadas", tasks: filtered.filter((task) => task.dueDate && task.dueDate < today) },
          ...Array.from({ length: 7 }, (_, index) => {
            const date = dateKey(index);
            return { title: index === 0 ? "Hoje" : fullDate(date), tasks: filtered.filter((task) => task.dueDate === date) };
          }).filter((group) => group.tasks.length),
        ];
  const hasTasks = sections.some((group) => group.tasks.length);
  const visibleCount = sections.reduce((total, group) => total + group.tasks.length, 0);
  return (
    <div className={styles.screenStack}>
      <div className={styles.segmented} role="group" aria-label="Visão das tarefas">
        {([
          ["today", "Hoje"], ["week", "Semana"], ["routines", "Rotinas"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={section === value}
            className={section === value ? styles.segmentActive : ""}
            onClick={() => onSectionChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.filters}>
        <Select
          label="Filtrar por morador"
          value={filter}
          variant="field"
          options={[
            { value: "todos", label: "Todos" },
            ...members.map((member) => ({ value: member.id, label: member.name })),
            { value: "a-combinar", label: "A combinar" },
          ]}
          onChange={onFilterChange}
        />
        <p>{visibleCount} {visibleCount === 1 ? "tarefa aberta" : "tarefas abertas"}</p>
      </div>

      {hasTasks ? sections.map((group) => group.tasks.length ? (
        <section className={styles.contentSection} key={group.title} aria-labelledby={`task-group-${group.title}`}>
          <div className={styles.sectionHeadingCompact}>
            <h2 id={`task-group-${group.title}`}>{group.title}</h2>
          </div>
          <Card className={styles.listCard}>
            {group.tasks.map((task) => <TaskRow key={task.id} task={task} members={members} returnTo={`/casa/tarefas${section === "today" ? "" : `?visao=${section === "week" ? "semana" : "rotinas"}`}`} onComplete={onComplete} onAssume={onAssume} />)}
          </Card>
        </section>
      ) : null) : (
        <div className={styles.emptyPanel}>
          <EmptyState
            title={section === "routines" ? "Nenhuma rotina ativa ainda." : "Nada pendente por aqui."}
            description={section === "routines" ? "Cadastre as tarefas recorrentes da casa para não precisar recriá-las." : "Quando surgir algo para fazer, registrem aqui e combinem a responsabilidade."}
          />
          <Link className={styles.inlineLink} to="/casa/tarefas/nova"><Plus size={17} aria-hidden="true" /> Criar tarefa ou rotina</Link>
        </div>
      )}
      {section === "week" && !hasTasks && <p className={styles.helper}>A semana mostra o combinado da casa; não é uma nota de equilíbrio.</p>}
    </div>
  );
}

export function TaskDetailScreen({
  task,
  members,
  onBack,
  onEdit,
  onComplete,
  onAssume,
  onSkip,
  onPause,
  onResume,
  onEnd,
}: {
  task?: ResidentTask;
  members: ResidentMember[];
  onBack: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onAssume: () => void;
  onSkip: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}) {
  if (!task) return <EmptyState title="Esta tarefa não está disponível." description="Ela pode ter sido removida ou não estar mais disponível." />;
  return (
    <div className={styles.screenStack}>
      <button className={styles.backButton} type="button" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" /> Voltar às tarefas</button>
      <Card className={styles.detailCard}>
        <CardActions context={task.title}
          primary={!task.completed && !task.skipped ? { label: "Concluir", icon: Check, onClick: onComplete } : undefined}
          secondary={[
            ...(!task.completed && !task.skipped && !taskAssignee(task) ? [{ label: "Assumir", icon: UserRoundPlus, onClick: onAssume }] : []),
            { label: "Editar", icon: Pencil, onClick: onEdit },
          ]}>
        <div className={styles.detailHeading}>
          <span className={styles.eyebrow}>{task.repeat === "once" ? "TAREFA" : "ROTINA"}</span>
          <h2>{task.title}</h2>
          {task.completed && <StatusBadge tone="success">Concluída</StatusBadge>}
          {task.skipped && <StatusBadge tone="warning">Ocorrência pulada</StatusBadge>}
          {task.ended && <StatusBadge tone="warning">Rotina encerrada</StatusBadge>}
          <p>{task.completionScope || "Sem instruções adicionais."}</p>
        </div>
        </CardActions>
        <dl className={styles.detailFacts}>
          <div><dt>Próxima ocorrência</dt><dd>{task.dueDate ? fullDate(task.dueDate) : "Sem data"}</dd></div>
          <div><dt>Responsabilidade</dt><dd>{taskAssigneeLabel(task, members)}</dd></div>
          {task.repeat !== "once" && <div><dt>Frequência</dt><dd>{repeatLabel(task.repeat, task.weeklyDays)}</dd></div>}
          {task.activeTime && <div><dt>Tempo ativo típico</dt><dd>{task.activeTime}</dd></div>}
          {task.paused && <div><dt>Estado da rotina</dt><dd><StatusBadge tone="warning">Pausada</StatusBadge></dd></div>}
        </dl>

      </Card>
      {task.repeat !== "once" && !task.ended && (
        <section className={styles.contentSection} aria-labelledby="routine-actions-title">
          <Card className={styles.actionList}>
            <CardActions context={`Rotina ${task.title}`} secondary={[
              { label: "Pular esta ocorrência", icon: SkipForward, onClick: onSkip },
              task.paused ? { label: "Retomar rotina", icon: Play, onClick: onResume } : { label: "Pausar rotina", icon: Pause, onClick: onPause },
              { label: "Encerrar rotina", icon: Trash2, destructive: true, onClick: onEnd },
            ]}>
              <h2 id="routine-actions-title">Esta rotina</h2>
              <p className={styles.helper}>Pular resolve só este ciclo; a próxima data segue a frequência programada.</p>
            </CardActions>
          </Card>
        </section>
      )}
    </div>
  );
}

export function TaskEditor({
  task,
  members,
  scope,
  onCancel,
  onSave,
}: {
  task?: ResidentTask;
  members: ResidentMember[];
  scope?: string;
  onCancel: () => void;
  onSave: (value: TaskInput, scope?: "occurrence" | "series") => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [repeat, setRepeat] = useState<Repeat>(task?.repeat ?? "once");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? dateKey());
  const [ownerMode, setOwnerMode] = useState<OwnerMode>(task?.ownerMode ?? "agree");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? members[0]?.id ?? "");
  const [rotation, setRotation] = useState(task?.rotation.length ? task.rotation : members.map((member) => member.id));
  const [weeklyDays, setWeeklyDays] = useState(task?.weeklyDays.length ? task.weeklyDays : [fromDateKey(task?.dueDate ?? dateKey()).getDay()]);
  const [completionScope, setCompletionScope] = useState(task?.completionScope ?? "");
  const [activeTime, setActiveTime] = useState(task?.activeTime ?? "");
  const [error, setError] = useState("");
  const isOccurrenceEdit = scope === "occurrence";

  function moveRotation(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    setRotation((current) => {
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = current.slice();
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (repeat === "weekly" && weeklyDays.length === 0) {
      setError("Escolha ao menos um dia da semana.");
      return;
    }
    if (ownerMode === "rotation" && rotation.length === 0) {
      setError("Escolha ao menos uma pessoa para o revezamento.");
      return;
    }
    let firstDate = repeat === "once" ? dueDate || undefined : dueDate;
    if (repeat === "weekly" && firstDate) {
      let candidate = firstDate;
      for (let offset = 0; offset < 7; offset += 1) {
        if (weeklyDays.includes(fromDateKey(candidate).getDay())) break;
        candidate = addDays(candidate, 1);
      }
      firstDate = candidate;
    }
    onSave({
      title: title.trim(),
      dueDate: firstDate,
      repeat,
      weeklyDays: repeat === "weekly" ? weeklyDays.slice().sort((a, b) => a - b) : [],
      anchorDay: firstDate ? fromDateKey(firstDate).getDate() : fromDateKey(dateKey()).getDate(),
      ownerMode,
      assigneeId: ownerMode === "fixed" ? assigneeId : undefined,
      rotation: ownerMode === "rotation" ? rotation : [],
      rotationIndex: task?.rotationIndex ?? 0,
      completionScope: completionScope.trim(),
      activeTime,
    }, task ? (isOccurrenceEdit ? "occurrence" : "series") : undefined);
  }

  return (
    <form className={styles.formStack} onSubmit={submit}>
      {scope && <p className={styles.infoNote}>{isOccurrenceEdit ? "As alterações serão aplicadas só a esta ocorrência." : "As alterações serão aplicadas a esta e às próximas ocorrências."}</p>}
      <TextField id="task-title" label="Nome da tarefa" placeholder="Ex.: Lavar o banheiro" maxLength={100} required value={title} onChange={(event) => setTitle(event.target.value)} />
      <Select
        label="Repetição"
        value={repeat}
        options={repeatOptions.map((option) => ({ ...option, disabled: isOccurrenceEdit && option.value !== task?.repeat }))}
        onChange={(value) => setRepeat(value as Repeat)}
      />
      <DatePicker
        id="task-date"
        label={repeat === "once" ? "Data (opcional)" : "Primeira ocorrência"}
        required={repeat !== "once"}
        value={dueDate}
        onChange={setDueDate}
      />
      {repeat === "weekly" && (
        <fieldset className={styles.weekdays}>
          <legend>Repete em</legend>
          <div>{weekDays.map((day) => <Checkbox key={day.value} label={day.label} disabled={isOccurrenceEdit} checked={weeklyDays.includes(day.value)} onChange={() => setWeeklyDays((current) => current.includes(day.value) ? current.filter((item) => item !== day.value) : [...current, day.value])} />)}</div>
        </fieldset>
      )}
      <Select label="Responsável" value={ownerMode} options={ownerOptions} onChange={(value) => setOwnerMode(value as OwnerMode)} />
      {ownerMode === "fixed" && <Select label="Pessoa responsável" value={assigneeId} options={members.map((member) => ({ value: member.id, label: member.name }))} onChange={setAssigneeId} />}
      {ownerMode === "rotation" && (
        <fieldset className={styles.rotationField}>
          <legend>Ordem do revezamento</legend>
          <p>Marque as pessoas e use as setas para ordenar os turnos.</p>
          <ol>{rotation.map((id, index) => {
            const member = members.find((item) => item.id === id);
            if (!member) return null;
            return <li key={id}><span>{index + 1}</span><strong>{member.name}</strong><IconButton label={`Mover ${member.name} para cima`} icon={<ChevronUp size={18} aria-hidden="true" />} disabled={index === 0} onClick={() => moveRotation(index, -1)} /><IconButton label={`Mover ${member.name} para baixo`} icon={<ChevronDown size={18} aria-hidden="true" />} disabled={index === rotation.length - 1} onClick={() => moveRotation(index, 1)} /><IconButton label={`Remover ${member.name} do revezamento`} icon={<Trash2 size={17} aria-hidden="true" />} onClick={() => setRotation((current) => current.filter((item) => item !== id))} /></li>;
          })}</ol>
          <Select label="Adicionar pessoa" value="" options={[{ value: "", label: "Selecione uma pessoa", disabled: true }, ...members.filter((member) => !rotation.includes(member.id)).map((member) => ({ value: member.id, label: member.name }))]} onChange={(id) => setRotation((current) => [...current, id])} />
          <span className={styles.helper}>Começa por {memberName(members, rotation[0]) ?? "ninguém selecionado"}.</span>
        </fieldset>
      )}
      <TextField id="task-scope" label="O que conta como concluído? (opcional)" placeholder="Ex.: louça do jantar do dia a dia" maxLength={180} value={completionScope} onChange={(event) => setCompletionScope(event.target.value)} hint="Deixe em branco quando o nome da tarefa já explicar o suficiente." />
      <Select label="Tempo ativo típico (opcional)" value={activeTime} options={timeOptions} onChange={setActiveTime} />
      {error && <p className={styles.formError} role="alert">{error}</p>}
      <div className={styles.formActions}>
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">{task ? "Salvar alterações" : "Criar tarefa"}</Button>
      </div>
    </form>
  );
}

export function ShoppingScreen({
  items,
  onAdd,
  onBought,
  onEdit,
}: {
  items: ShoppingItem[];
  onAdd: (name: string, quantity: string, priority: ShoppingItem["priority"]) => void;
  onBought: (id: string) => void;
  onEdit: (item: ShoppingItem) => void;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [priority, setPriority] = useState<ShoppingItem["priority"]>("next");
  const before = items.filter((item) => item.priority === "before");
  const next = items.filter((item) => item.priority === "next");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAdd(name, quantity, priority);
    setName("");
    setQuantity("");
    setPriority("next");
  }
  return (
    <div className={styles.screenStack}>
      <p className={styles.pageLead}>Uma lista contínua para a casa.</p>
      <Card className={styles.addItemCard}>
        <form className={styles.addItemForm} onSubmit={submit}>
          <TextField id="shopping-name" label="Adicionar à lista" placeholder="Ex.: arroz" maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} />
          <TextField id="shopping-quantity" label="Quantidade (opcional)" placeholder="Ex.: 1 kg" maxLength={50} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          <Checkbox label="Comprar antes" detail="Acabou antes da próxima compra maior" checked={priority === "before"} onChange={(event) => setPriority(event.target.checked ? "before" : "next")} />
          <Button type="submit"><Plus size={18} aria-hidden="true" /> Adicionar item</Button>
        </form>
      </Card>
      {items.length ? (
        <div className={styles.screenStack}>
          {[{ title: "Comprar antes", data: before }, { title: "Na próxima compra", data: next }].map((group) => group.data.length ? (
            <section className={styles.contentSection} key={group.title} aria-labelledby={`shopping-${group.title}`}>
              <div className={styles.sectionHeadingCompact}><h2 id={`shopping-${group.title}`}>{group.title}</h2><span>{group.data.length}</span></div>
              <Card className={styles.listCard}>
                {group.data.map((item) => (
                  <article className={styles.shoppingRow} key={item.id}>
                    <CardActions context={item.name} primary={{ label: "Comprado", icon: Check, onClick: () => onBought(item.id) }} secondary={[{ label: "Editar", icon: Pencil, onClick: () => onEdit(item) }]}>
                    <button className={styles.shoppingItemName} type="button" onClick={() => onEdit(item)}>
                      <strong>{item.name}</strong>
                      <span>{item.quantity || "Quantidade não informada"}</span>
                    </button>
                    </CardActions>
                  </article>
                ))}
              </Card>
            </section>
          ) : null)}
        </div>
      ) : (
        <EmptyState title="A lista está vazia." description="Anote o que precisa repor para todo mundo consultar antes de sair para comprar." />
      )}
    </div>
  );
}

export function ProfileScreen({
  session,
  gateway,
  onSave,
  onLogout,
}: {
  session: AuthSession;
  gateway: ResidentGateway;
  onSave: (name: string) => void;
  onLogout: () => void;
}) {
  const [name, setName] = useState(session.user.name);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("08:00");
  const [savingReminder, setSavingReminder] = useState(false);
  const { showToast } = useToast();
  useEffect(() => {
    let current = true;
    void gateway.reminder().then((value) => {
      if (!current) return;
      setReminderEnabled(value.enabled);
      setReminderTime(value.time);
    }).catch(() => undefined);
    return () => { current = false; };
  }, [gateway]);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim());
    showToast("Nome atualizado.");
  }
  async function toggleReminder() {
    setSavingReminder(true);
    try {
      if (import.meta.env.MODE === "demo") {
        showToast("Notificações ficam disponíveis no ambiente de produção.");
        return;
      }
      if (reminderEnabled) {
        await gateway.saveReminder(false, reminderTime);
        setReminderEnabled(false);
        showToast("Lembretes desativados.");
        return;
      }
      if (!("Notification" in window) || !("serviceWorker" in navigator)) throw new Error("Este navegador não oferece notificações. Abra o app em um navegador compatível para ativar os lembretes.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Permita notificações no navegador para ativar os lembretes.");
      const key = await gateway.vapidPublicKey();
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidKey(key) });
      const value = subscription.toJSON();
      if (!value.endpoint || !value.keys?.p256dh || !value.keys.auth) throw new Error("Não foi possível registrar este aparelho. Confira a permissão de notificações do navegador e tente novamente.");
      await gateway.savePushSubscription({ endpoint: value.endpoint, keys: { p256dh: value.keys.p256dh, auth: value.keys.auth } });
      await gateway.saveReminder(true, reminderTime);
      setReminderEnabled(true);
      showToast("Lembretes diários ativados.");
    } catch (error) {
      showToast(errorMessage(error, "Não foi possível atualizar as notificações. Confira a permissão do navegador e tente novamente."));
    } finally {
      setSavingReminder(false);
    }
  }
  async function saveReminderTime() {
    setSavingReminder(true);
    try {
      await gateway.saveReminder(reminderEnabled, reminderTime);
      showToast("Horário do lembrete atualizado.");
    } catch (error) {
      showToast(errorMessage(error, "Não foi possível salvar o horário. Confira sua conexão e tente novamente."));
    } finally {
      setSavingReminder(false);
    }
  }
  async function exportData() {
    try {
      const data = await gateway.exportAccount();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "chega-de-briga-dados.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(errorMessage(error, "Não foi possível exportar os dados. Tente novamente; se continuar, fale com o suporte."));
    }
  }
  return (
    <div className={styles.screenStack}>
      <Card className={styles.profileCard}>
        <Avatar name={session.user.name} initials={initials(session.user.name)} tone="lilac" />
        <form className={styles.formStack} onSubmit={save}>
          <TextField id="profile-name" label="Seu nome" maxLength={100} required value={name} onChange={(event) => setName(event.target.value)} />
          <TextField id="profile-email" label="E-mail" type="email" value={session.user.email} readOnly hint="E-mail confirmado da conta." />
          <Button type="submit">Salvar nome</Button>
        </form>
      </Card>
      <Card className={styles.preferenceCard}>
        <div className={styles.preferenceIntro}><Bell size={21} aria-hidden="true" /><div><h2>Lembrete diário</h2><p>Receba as tarefas atribuídas a você, vencidas ou previstas para o dia.</p></div></div>
        <TextField id="reminder-time" label="Horário" type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} />
        <div className={styles.preferenceActions}><Button variant="secondary" disabled={savingReminder} onClick={() => void saveReminderTime()}>Salvar horário</Button><Button disabled={savingReminder} onClick={() => void toggleReminder()}>{savingReminder ? "Salvando…" : reminderEnabled ? "Desativar notificações" : "Ativar notificações"}</Button></div>
      </Card>
      <Card className={styles.preferenceCard}>
        <CardActions context="Seus dados" primary={{ label: "Baixar dados", icon: Download, onClick: () => void exportData() }} secondary={[{ label: "Excluir conta", icon: Trash2, destructive: true, to: "/casa/perfil/excluir" }]}>
          <h2>Seus dados</h2>
        </CardActions>
        <p>Baixe uma cópia dos dados da sua conta e das casas em que participa.</p>
        <p><Link to="/privacidade">Aviso de privacidade</Link></p>
      </Card>
      <Button variant="secondary" className={styles.logoutButton} onClick={onLogout}><LogOut size={20} aria-hidden="true" /> Sair da conta</Button>
      {import.meta.env.MODE === "demo" && <p className={styles.helper}>A sessão e estas alterações são locais. Nenhum dado de conta é enviado.</p>}
    </div>
  );
}

function decodeVapidKey(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function DeleteAccountScreen({ onDelete, onCancel }: { onDelete: () => Promise<void>; onCancel: () => void }) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try { await onDelete(); } catch (reason) { setError(errorMessage(reason, "Não foi possível excluir a conta. Transfira a responsabilidade da casa, se aplicável, e tente novamente.")); } finally { setBusy(false); }
  }
  return <div className={styles.screenStack}><Card className={styles.houseCard}><span className={styles.eyebrow}>AÇÃO PERMANENTE</span><h1>Excluir sua conta?</h1><p>Seu perfil será anonimizado. O histórico compartilhado continuará sem identificar você. Se esta for a única pessoa da casa, a casa e seus dados serão apagados. Se você for o último responsável de uma casa com outras pessoas, transfira a responsabilidade antes.</p><form className={styles.formStack} onSubmit={submit}><TextField id="delete-account-confirm" label="Digite EXCLUIR para confirmar" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /><div className={styles.preferenceActions}><Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={busy || confirmation !== "EXCLUIR"}>{busy ? "Excluindo…" : "Excluir conta"}</Button></div>{error && <p role="alert">{error}</p>}</form></Card></div>;
}

export function HouseScreen({
  name,
  role,
  canCreate,
  canLeave,
  responsibleCount,
  onRename,
  onLeave,
  onDelete,
}: {
  name: string;
  role: HouseholdRole;
  canCreate: boolean;
  canLeave: boolean;
  responsibleCount: number;
  onRename: (name: string) => void;
  onLeave: () => void;
  onDelete: () => void;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  return (
    <div className={styles.screenStack}>
      <Card className={styles.houseCard}>
        <CardActions context={name} secondary={[
          { label: "Moradores e convites", icon: UsersRound, to: "/casa/moradores" },
          { label: "Editar nome", icon: Pencil, onClick: () => { setDraft(name); setRenameOpen(true); } },
        ]}>
          <span className={styles.eyebrow}>CASA COMPARTILHADA</span>
          <h2>{name}</h2>
          <p>Seu papel: {role === "responsavel" ? "Responsável" : "Morador"}</p>
        </CardActions>
      </Card>
      {canCreate && <Card className={styles.houseCard}>
        <CardActions context="Outra casa" secondary={[{ label: "Criar casa", icon: House, to: "/criar-casa" }]}><h2>Outra casa?</h2></CardActions>
        <p>Você pode criar uma segunda casa usando a mesma conta.</p>
      </Card>}
      <section className={styles.dangerZone} aria-labelledby="house-exit-title">
        <CardActions context={name} secondary={[
          { label: "Sair da casa", icon: LogOut, disabled: !canLeave, onClick: onLeave },
          ...(role === "responsavel" ? [{ label: "Excluir casa", icon: Trash2, destructive: true, onClick: onDelete }] : []),
        ]}>
          <h2 id="house-exit-title">Ações da casa</h2>
          {!canLeave && <p>Antes de sair, transfira a responsabilidade para outro morador.</p>}
          {role === "responsavel" && responsibleCount < 2 && <small>Excluir a casa remove permanentemente os dados compartilhados.</small>}
        </CardActions>
      </section>
      <BottomSheet open={renameOpen} onClose={() => setRenameOpen(false)} title="Nome da casa" footer={<><Button variant="secondary" onClick={() => setRenameOpen(false)}>Cancelar</Button><Button onClick={() => { if (draft.trim()) { onRename(draft.trim()); setRenameOpen(false); } }}>Salvar nome</Button></>}>
        <TextField id="house-name-edit" label="Nome da casa" maxLength={60} required value={draft} onChange={(event) => setDraft(event.target.value)} />
      </BottomSheet>
    </div>
  );
}

export function MembersScreen({
  data,
  userId,
  role,
  onInvite,
  onRemove,
  onRevoke,
  onTransfer,
}: {
  data: HouseData;
  userId: string;
  role: HouseholdRole;
  onInvite: (email: string) => void;
  onRemove: (id: string) => void;
  onRevoke: (id: string) => void;
  onTransfer: (id: string) => void;
}) {
  const [email, setEmail] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onInvite(email.trim());
    setEmail("");
  }
  return (
    <div className={styles.screenStack}>
      {role === "responsavel" && (
        <Card className={styles.inviteCard}>
          <div className={styles.sectionHeadingCompact}><h2>Convidar morador</h2><Mail size={19} aria-hidden="true" /></div>
          <p>{import.meta.env.MODE === "demo" ? "Este convite fica nesta demonstração. Nenhum e-mail será enviado." : "A pessoa receberá um link por e-mail para entrar nesta casa."}</p>
          <form className={styles.inviteForm} onSubmit={submit}>
            <TextField id="invite-email" label="E-mail" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@exemplo.com" />
            <Button type="submit"><Plus size={18} aria-hidden="true" /> {import.meta.env.MODE === "demo" ? "Criar convite de demonstração" : "Enviar convite"}</Button>
          </form>
        </Card>
      )}
      <section className={styles.contentSection} aria-labelledby="members-title">
        <div className={styles.sectionHeadingCompact}><h2 id="members-title">Moradores</h2><span>{data.members.length}</span></div>
        <Card className={styles.memberList}>
          {data.members.map((member) => (
            <article className={styles.memberRow} key={member.id}>
              <CardActions context={member.name} secondary={role === "responsavel" && member.id !== userId ? [
                ...(member.role !== "responsavel" ? [{ label: "Tornar responsável", icon: ShieldCheck, onClick: () => onTransfer(member.id) }] : []),
                { label: "Remover", icon: Trash2, destructive: true, onClick: () => onRemove(member.id) },
              ] : []}>
                <div className={styles.memberIdentity}>
                  <Avatar name={member.name} initials={initials(member.name)} tone={member.id === userId ? "blue" : "sun"} />
                  <div><strong>{member.name}{member.id === userId ? " · Você" : ""}</strong><span>{member.email ?? "Morador da casa"}</span><span className={styles.memberRole}>{member.role === "responsavel" ? "Responsável" : "Morador"}</span></div>
                </div>
              </CardActions>
            </article>
          ))}
        </Card>
      </section>
      <section className={styles.contentSection} aria-labelledby="invites-title">
        <div className={styles.sectionHeadingCompact}><h2 id="invites-title">Convites pendentes</h2><span>{data.invites.length}</span></div>
        {data.invites.length ? <Card className={styles.memberList}>{data.invites.map((invite) => <article className={styles.inviteRow} key={invite.id}>
          <CardActions context={invite.email} secondary={role === "responsavel" ? [{ label: "Revogar", icon: Ban, destructive: true, onClick: () => onRevoke(invite.id) }] : []}>
            <div className={styles.inviteCopy}><strong>{invite.email}</strong><StatusBadge tone="warning">{import.meta.env.MODE === "demo" ? "Não enviado · demonstração" : "Link enviado"}</StatusBadge></div>
          </CardActions>
        </article>)}</Card> : <p className={styles.helper}>Nenhum convite pendente.</p>}
      </section>
      {import.meta.env.MODE === "demo" && <p className={styles.infoNote}>Os moradores e convites acima são dados locais de demonstração; alterações não chegam a outras pessoas.</p>}
    </div>
  );
}
