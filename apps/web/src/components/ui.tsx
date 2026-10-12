import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, Ref } from "react";
import { useId } from "react";
import { Link, type LinkProps } from "react-router";
import { CircleAlert, CircleCheck, Clock3 } from "lucide-react";
import styles from "./ui.module.css";
export { Select } from "./Select";
export type { SelectOption } from "./Select";
export { DatePicker } from "./DatePicker";
export type { DatePickerProps } from "./DatePicker";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
  ref?: Ref<HTMLButtonElement>;
};

export function Button({ variant = "primary", className = "", type = "button", ...props }: ButtonProps) {
  return <button {...props} type={type} className={`${styles.button} ${styles[variant]} ${className}`} />;
}

export function LinkButton({ className = "", ...props }: LinkProps) {
  return <Link {...props} className={`${styles.button} ${styles.primary} ${styles.linkButton} ${className}`} />;
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  label: string;
  icon: ReactNode;
};

export function IconButton({ label, icon, className = "", type = "button", ...props }: IconButtonProps) {
  return <button {...props} type={type} aria-label={label} data-tooltip={label} className={`${styles.iconButton} ${className}`}>{icon}</button>;
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({ id, label, hint, error, className = "", ...props }: TextFieldProps) {
  const descriptionId = useId();
  const describedBy = [props["aria-describedby"], hint || error ? descriptionId : null].filter(Boolean).join(" ") || undefined;
  return <div className={`${styles.field} ${className}`}>
    <label htmlFor={id}>{label}</label>
    <input {...props} id={id} aria-describedby={describedBy} aria-invalid={error ? true : undefined} className={error ? styles.inputError : ""} />
    {error ? <p id={descriptionId} className={styles.error}>{error}</p> : hint ? <p id={descriptionId} className={styles.hint}>{hint}</p> : null}
  </div>;
}

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  detail?: string;
};

export function Checkbox({ label, detail, className = "", ...props }: CheckboxProps) {
  return <label className={`${styles.checkbox} ${className}`}>
    <input {...props} type="checkbox" />
    <span><strong>{label}</strong>{detail && <small>{detail}</small>}</span>
  </label>;
}

export function Card({ children, className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <article {...props} className={`${styles.card} ${className}`}>{children}</article>;
}

const statusIcons = { success: CircleCheck, warning: Clock3, danger: CircleAlert };
type StatusTone = keyof typeof statusIcons;

export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  const Icon = statusIcons[tone];
  return <span className={`${styles.status} ${styles[tone]}`}><Icon size={16} strokeWidth={2.5} aria-hidden="true" />{children}</span>;
}

export function Avatar({ name, initials, tone = "blue" }: { name: string; initials: string; tone?: "blue" | "lilac" | "sun" }) {
  return <span className={`${styles.avatar} ${styles[tone]}`} role="img" aria-label={name}>{initials}</span>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <Card className={styles.empty}>
    <img src="/faisca.svg" alt="" width="82" height="82" />
    <h3>{title}</h3>
    <p>{description}</p>
  </Card>;
}
