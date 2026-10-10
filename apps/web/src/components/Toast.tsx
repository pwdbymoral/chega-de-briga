import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./Toast.module.css";

type ToastAction = { label: string; onClick: () => void };
type ToastOptions = { action?: ToastAction };
type ToastEntry = { id: number; message: string; action?: ToastAction };
type ToastContextValue = { showToast: (message: string, options?: ToastOptions) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastEntry | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    if (!message.trim()) return;
    nextId.current += 1;
    setHovered(false);
    setFocused(false);
    setToast({ id: nextId.current, message, action: options?.action });
  }, []);

  useEffect(() => {
    if (!toast || hovered || focused) return;
    const timer = window.setTimeout(() => {
      setToast((current) => current?.id === toast.id ? null : current);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [toast, hovered, focused]);

  const dismiss = (id: number) => {
    setToast((current) => current?.id === id ? null : current);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className={styles.viewport}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setFocused(false);
          }
        }}
      >
        {toast && (
          <div className={styles.toast} role="group" aria-label={`Aviso: ${toast.message}`}>
            <span className={styles.message} aria-hidden="true">{toast.message}</span>
            {toast.action && (
              <button
                className={styles.action}
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              className={styles.dismiss}
              type="button"
              aria-label="Dispensar aviso"
              onClick={() => dismiss(toast.id)}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        )}
        <p className={styles.screenReader} role="status" aria-atomic="true">
          {toast?.message ?? ""}
        </p>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast deve ser usado dentro de ToastProvider.");
  return context;
}
