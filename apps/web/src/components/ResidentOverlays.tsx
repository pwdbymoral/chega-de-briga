import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button, IconButton } from "./ui";
import styles from "./ResidentOverlays.module.css";

function ModalDialog({
  open,
  onClose,
  title,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={`${styles.dialog} ${className}`}
      aria-labelledby={titleId}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close();
      }}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <IconButton
            label="Fechar"
            icon={<X size={20} aria-hidden="true" />}
            onClick={() => dialog.current?.close()}
          />
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={title}
      className={styles.sheet}
    >
      {children}
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </ModalDialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={title}
      className={styles.confirm}
    >
      <p className={styles.description}>{description}</p>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </ModalDialog>
  );
}
