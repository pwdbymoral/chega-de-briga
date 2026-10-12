import { useEffect, useId, useRef, type ReactNode } from "react";
import { ArrowUpRight, Menu, X, type LucideIcon } from "lucide-react";
import { NavLink } from "react-router";
import { Button, IconButton } from "./ui";
import styles from "./MobileMenu.module.css";

export type MobileMenuItem = {
  to: string;
  label: string;
  end?: boolean;
  icon?: LucideIcon;
  description?: string;
};

export function MobileMenu({
  title,
  eyebrow,
  navLabel,
  items,
  footer,
  triggerClassName = "",
}: {
  title: string;
  eyebrow: string;
  navLabel: string;
  items: MobileMenuItem[];
  footer?: ReactNode;
  triggerClassName?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const closeOnDesktop = () => {
      if (trigger.current && getComputedStyle(trigger.current).display === "none") dialog.current?.close();
    };
    window.addEventListener("resize", closeOnDesktop);
    return () => window.removeEventListener("resize", closeOnDesktop);
  }, []);

  return (
    <>
      <Button
        ref={trigger}
        variant="secondary"
        className={`${styles.trigger} ${triggerClassName}`}
        aria-haspopup="dialog"
        aria-controls={titleId}
        onClick={() => {
          if (!dialog.current) return;
          dialog.current.scrollTop = 0;
          dialog.current.showModal();
        }}
      >
        <Menu size={20} aria-hidden="true" /> <span>Menu</span>
      </Button>
      <dialog
        ref={dialog}
        id={titleId}
        className={styles.dialog}
        aria-labelledby={`${titleId}-title`}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className={styles.sheet}>
          <div className={styles.intro}>
            <div className={styles.introTop}>
              <span className={styles.eyebrow}>{eyebrow}</span>
              <IconButton
                className={styles.close}
                label="Fechar menu"
                icon={<X size={22} aria-hidden="true" />}
                onClick={() => dialog.current?.close()}
              />
            </div>
            <h2 id={`${titleId}-title`}>{title}</h2>
            <img src="/simbolo.svg" alt="" aria-hidden="true" />
          </div>
          <nav className={styles.links} aria-label={navLabel}>
            {items.map(({ to, label, end, icon: Icon, description }, index) => (
              <NavLink key={to} to={to} end={end} onClick={() => dialog.current?.close()}>
                <span className={styles.marker} aria-hidden="true">
                  {Icon ? <Icon size={22} /> : String(index + 1).padStart(2, "0")}
                </span>
                <span className={styles.linkText}>
                  <strong>{label}</strong>
                  {description && <small>{description}</small>}
                </span>
                <ArrowUpRight className={styles.arrow} size={20} aria-hidden="true" />
              </NavLink>
            ))}
          </nav>
          {footer && <div className={styles.footer}>{footer}</div>}
        </div>
      </dialog>
    </>
  );
}
