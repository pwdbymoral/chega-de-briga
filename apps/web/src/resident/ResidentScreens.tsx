import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
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
import type { AuthSession, HouseholdRole } from "../admin/contracts";
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  EmptyState,
  IconButton,
  Select,
  StatusBadge,
  TextField,
} from "../components/ui";
import { BottomSheet } from "../components/ResidentOverlays";
import { useToast } from "../components/Toast";
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
      <div className={styles.taskActions}>
        {!taskAssignee(task) && (
          <Button variant="secondary" onClick={() => onAssume(task.id)}>Assumir</Button>
        )}
        <Button variant="primary" onClick={() => onComplete(task.id)}>
          <Check size={17} aria-hidden="true" /> Concluir
        </Button>
      </div>
    </article>
  );
}

export function HomeScreen({
  name,
  tasks,
  items,
  members,
  onComplete,
  onAssume,
}: {
  name: string;
  tasks: ResidentTask[];
  items: ShoppingItem[];
  members: ResidentMember[];
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
        <div className={styles.summaryIcon}><ShoppingBasket size={24} aria-hidden="true" /></div>
        <div className={styles.summaryCopy}>
          <span className={styles.eyebrow}>REPOSIÇÃO DA CASA</span>
          <h2 id="home-shopping-title">{items.length} {items.length === 1 ? "item na lista" : "itens na lista"}</h2>
          <p>{urgentItems ? `${urgentItems} para comprar antes da próxima ida maior` : "Nenhum item marcado como urgente"}</p>
        </div>
        <Link className={styles.summaryLink} to="/casa/compras">Abrir lista <span aria-hidden="true">→</span></Link>
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
  if (!task) return <EmptyState title="Esta tarefa não está disponível." description="Ela pode ter sido removida desta demonstração." />;
  return (
    <div className={styles.screenStack}>
      <button className={styles.backButton} type="button" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" /> Voltar às tarefas</button>
      <Card className={styles.detailCard}>
        <div className={styles.detailHeading}>
          <span className={styles.eyebrow}>{task.repeat === "once" ? "TAREFA" : "ROTINA"}</span>
          <h2>{task.title}</h2>
          {task.completed && <StatusBadge tone="success">Concluída</StatusBadge>}
          {task.skipped && <StatusBadge tone="warning">Ocorrência pulada</StatusBadge>}
          {task.ended && <StatusBadge tone="warning">Rotina encerrada</StatusBadge>}
          <p>{task.completionScope || "Sem instruções adicionais."}</p>
        </div>
        <dl className={styles.detailFacts}>
          <div><dt>Próxima ocorrência</dt><dd>{task.dueDate ? fullDate(task.dueDate) : "Sem data"}</dd></div>
          <div><dt>Responsabilidade</dt><dd>{taskAssigneeLabel(task, members)}</dd></div>
          {task.repeat !== "once" && <div><dt>Frequência</dt><dd>{repeatLabel(task.repeat, task.weeklyDays)}</dd></div>}
          {task.activeTime && <div><dt>Tempo ativo típico</dt><dd>{task.activeTime}</dd></div>}
          {task.paused && <div><dt>Estado da rotina</dt><dd><StatusBadge tone="warning">Pausada</StatusBadge></dd></div>}
        </dl>
        <div className={styles.detailActions}>
          {!task.completed && !task.skipped && !taskAssignee(task) && <Button variant="secondary" onClick={onAssume}>Assumir tarefa</Button>}
          {!task.completed && !task.skipped && <Button onClick={onComplete}><Check size={18} aria-hidden="true" /> Concluir</Button>}
          <Button variant="secondary" onClick={onEdit}><Pencil size={17} aria-hidden="true" /> Editar</Button>
        </div>
      </Card>
      {task.repeat !== "once" && !task.ended && (
        <section className={styles.contentSection} aria-labelledby="routine-actions-title">
          <div className={styles.sectionHeadingCompact}><h2 id="routine-actions-title">Esta rotina</h2></div>
          <Card className={styles.actionList}>
            <Button variant="quiet" onClick={onSkip}><SkipForward size={17} aria-hidden="true" /> Pular esta ocorrência</Button>
            {task.paused
              ? <Button variant="quiet" onClick={onResume}><Play size={17} aria-hidden="true" /> Retomar rotina</Button>
              : <Button variant="quiet" onClick={onPause}><Pause size={17} aria-hidden="true" /> Pausar rotina</Button>}
            <Button variant="quiet" onClick={onEnd}><Trash2 size={17} aria-hidden="true" /> Encerrar rotina</Button>
          </Card>
          <p className={styles.helper}>Pular resolve só este ciclo; a próxima data segue a frequência programada.</p>
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
  onSave: (value: TaskInput) => void;
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
    });
  }

  return (
    <form className={styles.formStack} onSubmit={submit}>
      {scope && <p className={styles.infoNote}>{isOccurrenceEdit ? "As alterações serão aplicadas só a esta ocorrência." : "As alterações serão aplicadas a esta e às próximas ocorrências."} No protótipo, esse escopo vale para o registro local.</p>}
      <TextField id="task-title" label="Nome da tarefa" placeholder="Ex.: Lavar o banheiro" maxLength={100} required value={title} onChange={(event) => setTitle(event.target.value)} />
      <Select
        label="Repetição"
        value={repeat}
        options={repeatOptions.map((option) => ({ ...option, disabled: isOccurrenceEdit && option.value !== task?.repeat }))}
        onChange={(value) => setRepeat(value as Repeat)}
      />
      <TextField
        id="task-date"
        label={repeat === "once" ? "Data (opcional)" : "Primeira ocorrência"}
        type="date"
        required={repeat !== "once"}
        value={dueDate}
        onChange={(event) => setDueDate(event.target.value)}
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
                    <button className={styles.shoppingItemName} type="button" onClick={() => onEdit(item)}>
                      <strong>{item.name}</strong>
                      <span>{item.quantity || "Quantidade não informada"}</span>
                    </button>
                    <div className={styles.shoppingActions}>
                      <Button variant="quiet" onClick={() => onEdit(item)}><Pencil size={16} aria-hidden="true" /> Editar</Button>
                      <Button onClick={() => onBought(item.id)}><Check size={17} aria-hidden="true" /> Comprado</Button>
                    </div>
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
  onSave,
  onLogout,
}: {
  session: AuthSession;
  onSave: (name: string) => void;
  onLogout: () => void;
}) {
  const [name, setName] = useState(session.user.name);
  const { showToast } = useToast();
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim());
    showToast("Nome atualizado nesta demonstração.");
  }
  return (
    <div className={styles.screenStack}>
      <Card className={styles.profileCard}>
        <Avatar name={session.user.name} initials={initials(session.user.name)} tone="lilac" />
        <form className={styles.formStack} onSubmit={save}>
          <TextField id="profile-name" label="Seu nome" maxLength={100} required value={name} onChange={(event) => setName(event.target.value)} />
          <TextField id="profile-email" label="E-mail" type="email" value={session.user.email} readOnly hint="A edição da conta depende da integração de autenticação." />
          <Button type="submit">Salvar nome</Button>
        </form>
      </Card>
      <Card className={styles.preferenceCard}>
        <div className={styles.preferenceIntro}><Bell size={21} aria-hidden="true" /><div><h2>Lembrete diário</h2><p>Escolha ativar quando as notificações estiverem conectadas ao serviço da casa.</p></div></div>
        <Button variant="secondary" onClick={() => showToast("Notificações ainda não estão conectadas nesta demonstração.")}>Ativar notificações</Button>
      </Card>
      <Button variant="quiet" className={styles.logoutButton} onClick={onLogout}><LogOut size={18} aria-hidden="true" /> Sair da conta</Button>
      <p className={styles.helper}>A sessão e estas alterações são locais. Nenhum dado de conta é enviado.</p>
    </div>
  );
}

export function HouseScreen({
  name,
  role,
  canCreate,
  canLeave,
  responsibleCount,
  onRename,
  onMembers,
  onLeave,
  onDelete,
  onCreateHouse,
}: {
  name: string;
  role: HouseholdRole;
  canCreate: boolean;
  canLeave: boolean;
  responsibleCount: number;
  onRename: (name: string) => void;
  onMembers: () => void;
  onLeave: () => void;
  onDelete: () => void;
  onCreateHouse: () => void;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  return (
    <div className={styles.screenStack}>
      <Card className={styles.houseCard}>
        <span className={styles.eyebrow}>CASA COMPARTILHADA</span>
        <h2>{name}</h2>
        <p>Seu papel: {role === "responsavel" ? "Responsável" : "Morador"}</p>
        <Button variant="secondary" onClick={() => { setDraft(name); setRenameOpen(true); }}><Pencil size={17} aria-hidden="true" /> Editar nome</Button>
        <Button variant="secondary" onClick={onMembers}><UsersRound size={18} aria-hidden="true" /> Moradores e convites</Button>
      </Card>
      {canCreate && <Card className={styles.houseCard}><h2>Outra casa?</h2><p>Você pode criar uma segunda casa usando a mesma conta.</p><Button variant="secondary" onClick={onCreateHouse}><House size={18} aria-hidden="true" /> Criar outra casa</Button></Card>}
      <section className={styles.dangerZone} aria-labelledby="house-exit-title">
        <h2 id="house-exit-title">Ações da casa</h2>
        {!canLeave && <p>Antes de sair, transfira a responsabilidade para outro morador.</p>}
        <Button variant="quiet" disabled={!canLeave} onClick={onLeave}>Sair desta casa</Button>
        {role === "responsavel" && <Button variant="quiet" onClick={onDelete}><Trash2 size={17} aria-hidden="true" /> Excluir casa</Button>}
        {role === "responsavel" && responsibleCount < 2 && <small>Excluir a casa remove todos os dados compartilhados neste protótipo local.</small>}
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
          <p>Este convite fica nesta demonstração. Nenhum e-mail será enviado.</p>
          <form className={styles.inviteForm} onSubmit={submit}>
            <TextField id="invite-email" label="E-mail" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@exemplo.com" />
            <Button type="submit"><Plus size={18} aria-hidden="true" /> Criar convite de demonstração</Button>
          </form>
        </Card>
      )}
      <section className={styles.contentSection} aria-labelledby="members-title">
        <div className={styles.sectionHeadingCompact}><h2 id="members-title">Moradores</h2><span>{data.members.length}</span></div>
        <Card className={styles.memberList}>
          {data.members.map((member) => (
            <article className={styles.memberRow} key={member.id}>
              <Avatar name={member.name} initials={initials(member.name)} tone={member.id === userId ? "blue" : "sun"} />
              <div><strong>{member.name}{member.id === userId ? " · Você" : ""}</strong><span>{member.email ?? "Morador de demonstração"}</span></div>
              <span className={styles.memberRole}>{member.role === "responsavel" ? "Responsável" : "Morador"}</span>
              {role === "responsavel" && member.id !== userId && <div className={styles.memberActions}>
                {member.role !== "responsavel" && <Button variant="quiet" onClick={() => onTransfer(member.id)}>Tornar responsável</Button>}
                <IconButton label={`Remover ${member.name}`} icon={<Trash2 size={18} aria-hidden="true" />} onClick={() => onRemove(member.id)} />
              </div>}
            </article>
          ))}
        </Card>
      </section>
      <section className={styles.contentSection} aria-labelledby="invites-title">
        <div className={styles.sectionHeadingCompact}><h2 id="invites-title">Convites pendentes</h2><span>{data.invites.length}</span></div>
        {data.invites.length ? <Card className={styles.memberList}>{data.invites.map((invite) => <article className={styles.inviteRow} key={invite.id}><div><strong>{invite.email}</strong><StatusBadge tone="warning">Não enviado · demonstração</StatusBadge></div>{role === "responsavel" && <Button variant="quiet" onClick={() => onRevoke(invite.id)}>Revogar</Button>}</article>)}</Card> : <p className={styles.helper}>Nenhum convite pendente.</p>}
      </section>
      <p className={styles.infoNote}>Os moradores e convites acima são dados locais de demonstração; alterações não chegam a outras pessoas.</p>
    </div>
  );
}
