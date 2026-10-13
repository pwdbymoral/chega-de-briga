import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Ellipsis, type LucideIcon } from "lucide-react";
import { Button, LinkButton } from "./ui";
import styles from "./CardActions.module.css";

export type CardAction = {
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  destructive?: boolean;
} & ({ onClick: () => void; to?: never } | { to: string; onClick?: never });

function Action({ action, context, primary = false, inMenu = false, onSelect }: {
  action: CardAction;
  context: string;
  primary?: boolean;
  inMenu?: boolean;
  onSelect?: () => void;
}) {
  const Icon = action.icon;
  const label = `${action.label}: ${context}`;
  const props = {
    variant: primary ? "primary" as const : "secondary" as const,
    className: `${styles.action} ${inMenu ? styles.menuItem : ""} ${action.destructive ? styles.destructive : ""}`,
    "aria-label": label,
    "data-tooltip": inMenu ? undefined : label,
    children: <><Icon size={20} aria-hidden="true" /><span className={styles.label}>{action.label}</span></>,
  };
  if (action.to !== undefined && !action.disabled) return <LinkButton {...props} to={action.to} onClick={onSelect} />;
  return <Button {...props} disabled={action.disabled} onClick={() => { onSelect?.(); action.onClick?.(); }} />;
}

function ActionsMenu({ actions, context }: { actions: CardAction[]; context: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const label = `Mais ações: ${context}`;
  const ordered = [...actions.filter((action) => !action.destructive), ...actions.filter((action) => action.destructive)];

  function close() {
    // Devolva o foco antes do callback, que pode abrir um diálogo ou navegar.
    trigger.current?.focus();
    setOpen(false);
  }

  useLayoutEffect(() => {
    const node = panel.current;
    const target = trigger.current;
    if (!open || !node || !target) return;
    node.showPopover?.();
    const place = () => {
      const anchor = target.getBoundingClientRect();
      const bounds = node.getBoundingClientRect();
      const left = Math.max(8, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 8));
      const below = anchor.bottom + 8;
      const preferredTop = below + bounds.height <= window.innerHeight - 8
        ? below : anchor.top - bounds.height - 8;
      const top = Math.max(8, Math.min(preferredTop, window.innerHeight - bounds.height - 8));
      setPosition({ left, top });
    };
    place();
    node.querySelector<HTMLElement>("button:not(:disabled), a[href]")?.focus();
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
      if (node.hidePopover && node.matches(":popover-open")) node.hidePopover();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);

  return <>
    <Button ref={trigger} variant="secondary" className={`${styles.action} ${styles.more}`} aria-label={label} data-tooltip={label} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((value) => !value)}>
      <Ellipsis size={20} aria-hidden="true" /><span className={styles.label}>Mais ações</span>
    </Button>
    {open && createPortal(<div ref={panel} id={id} role="group" aria-label={label} popover={typeof HTMLElement.prototype.showPopover === "function" ? "manual" : undefined} className={styles.menu} style={position} onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]"));
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault();
        close();
      } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
        close();
      }
    }}>
      {ordered.map((action) => <Action key={action.label} action={action} context={context} inMenu onSelect={close} />)}
    </div>, document.body)}
  </>;
}

export function CardActions({ context, primary, secondary = [], children }: {
  context: string;
  primary?: CardAction;
  secondary?: CardAction[];
  children?: ReactNode;
}) {
  const paired = Boolean(primary && secondary.length);
  return <div className={`${styles.row} ${children == null ? styles.groupOnly : ""}`}>
    {children != null && <div className={styles.copy}>{children}</div>}
    {(primary || secondary.length > 0) && <div className={`${styles.actions} ${paired ? styles.paired : ""}`} role="group" aria-label={`Ações: ${context}`}>
      {primary && <Action action={primary} context={context} primary />}
      {secondary.length === 1 && <Action action={secondary[0]} context={context} />}
      {secondary.length > 1 && <ActionsMenu actions={secondary} context={context} />}
    </div>}
  </div>;
}
