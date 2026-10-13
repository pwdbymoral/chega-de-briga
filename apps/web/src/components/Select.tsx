import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "./ui";
import styles from "./Select.module.css";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function Select({
  label,
  value,
  options,
  onChange,
  variant = "field",
  disabled = false,
  className = "",
  icon,
}: {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  variant?: "field" | "compact" | "action";
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuSpace, setMenuSpace] = useState({ up: false, right: false, height: 160 });
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const initialOption = useRef<HTMLButtonElement>(null);
  const id = useId();
  const current = options.find((option) => option.value === value);
  const focusValue =
    current && !current.disabled
      ? value
      : options.find((option) => !option.disabled)?.value;
  const canOpen = !disabled && options.some((option) => !option.disabled);

  useEffect(() => {
    if (!open) return;
    initialOption.current?.focus();
    const closeOutside = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    if (!canOpen || !root.current) return;
    const bounds = root.current.getBoundingClientRect();
    const below = window.innerHeight - bounds.bottom - 8;
    const above = bounds.top - 8;
    const visibleHeight = Math.min(options.length, 5) * 48 + 12;
    const up = below < visibleHeight && above > below;
    setMenuSpace({
      up,
      right: variant !== "field" && bounds.left > window.innerWidth / 2,
      height: Math.max(48, Math.min(visibleHeight, up ? above : below)),
    });
    setOpen(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!open) {
      if (canOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        toggle();
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const enabled = Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ??
        [],
    );
    if (!enabled.length) return;
    event.preventDefault();
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement);
    let next = 0;
    if (event.key === "End") next = enabled.length - 1;
    if (event.key === "ArrowDown") next = (index + 1) % enabled.length;
    if (event.key === "ArrowUp")
      next =
        index < 0
          ? enabled.length - 1
          : (index - 1 + enabled.length) % enabled.length;
    enabled[next].focus();
  }

  return (
    <div
      ref={root}
      className={`${styles.select} ${styles[variant]} ${className}`}
      onKeyDown={handleKeyDown}
    >
      <span id={`${id}-label`} className={styles.label}>
        {label}
      </span>
      <Button
        ref={trigger}
        type="button"
        variant="secondary"
        className={`${styles.trigger} ${variant === "action" ? styles.actionTrigger : ""}`}
        disabled={!canOpen}
        aria-label={
          variant !== "field"
            ? `${label}: ${current?.label ?? "Selecione"}`
            : undefined
        }
        aria-labelledby={
          variant === "field" ? `${id}-label ${id}-value` : undefined
        }
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-options` : undefined}
        data-tooltip={
          variant !== "field"
            ? `${label}: ${current?.label ?? "Selecione"}`
            : undefined
        }
        onClick={toggle}
      >
        {variant === "action" && <>{icon}<span className={styles.actionLabel}>{label}: {current?.label ?? "Selecione"}</span></>}
        {variant === "field" && (
          <span id={`${id}-value`} className={styles.value}>
            {current?.label ?? "Selecione"}
          </span>
        )}
        {variant !== "action" && <ChevronDown size={18} aria-hidden="true" />}
      </Button>
      {open && (
        <div
          ref={menu}
          id={`${id}-options`}
          className={`${styles.options} ${menuSpace.up ? styles.optionsUp : ""} ${menuSpace.right ? styles.optionsRight : ""}`}
          style={{ maxHeight: menuSpace.height }}
          role="listbox"
          aria-labelledby={`${id}-label`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              ref={option.value === focusValue ? initialOption : undefined}
              type="button"
              className={styles.option}
              role="option"
              aria-selected={option.value === value}
              tabIndex={option.value === focusValue ? 0 : -1}
              disabled={option.disabled}
              onClick={() => {
                if (option.value !== value) onChange(option.value);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
