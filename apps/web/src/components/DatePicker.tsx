import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import styles from "./DatePicker.module.css";

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAY_NAMES = [
  { short: "Dom", full: "Domingo" },
  { short: "Seg", full: "Segunda-feira" },
  { short: "Ter", full: "Terça-feira" },
  { short: "Qua", full: "Quarta-feira" },
  { short: "Qui", full: "Quinta-feira" },
  { short: "Sex", full: "Sexta-feira" },
  { short: "Sáb", full: "Sábado" },
];

function pad(num: number): string {
  return String(num).padStart(2, "0");
}

export function toDateString(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function parseDateString(value?: string): { year: number; month: number; day: number } | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const day = Number(dayStr);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  return { year, month, day };
}

export function getTodayString(): string {
  const now = new Date();
  return toDateString(now.getFullYear(), now.getMonth(), now.getDate());
}

export function formatFriendlyDate(value?: string): string {
  const parsed = parseDateString(value);
  if (!parsed) return "Escolher data";
  const todayStr = getTodayString();
  const todayParsed = parseDateString(todayStr)!;
  const todayDate = new Date(todayParsed.year, todayParsed.month, todayParsed.day);
  const targetDate = new Date(parsed.year, parsed.month, parsed.day);
  const diffDays = Math.round((targetDate.getTime() - todayDate.getTime()) / 86_400_000);

  if (diffDays === 0) return `Hoje (${parsed.day}/${pad(parsed.month + 1)})`;
  if (diffDays === 1) return `Amanhã (${parsed.day}/${pad(parsed.month + 1)})`;
  if (diffDays === -1) return `Ontem (${parsed.day}/${pad(parsed.month + 1)})`;

  return `${parsed.day} de ${MONTH_NAMES[parsed.month].slice(0, 3)}. de ${parsed.year}`;
}

export type DatePickerProps = {
  id: string;
  label: string;
  value?: string;
  onChange: (value: string) => void;
  required?: boolean;
  minDate?: string;
  maxDate?: string;
  hint?: string;
  error?: string;
  clearable?: boolean;
  className?: string;
};

export function DatePicker({
  id,
  label,
  value = "",
  onChange,
  required = false,
  minDate,
  maxDate,
  hint,
  error,
  clearable = true,
  className = "",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const descriptionId = useId();

  const todayStr = getTodayString();
  const parsedValue = parseDateString(value);
  const initialYear = parsedValue?.year ?? Number(todayStr.slice(0, 4));
  const initialMonth = parsedValue?.month ?? Number(todayStr.slice(5, 7)) - 1;

  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [focusedDay, setFocusedDay] = useState(parsedValue?.day ?? Number(todayStr.slice(8, 10)));

  useEffect(() => {
    if (parsedValue) {
      setViewYear(parsedValue.year);
      setViewMonth(parsedValue.month);
      setFocusedDay(parsedValue.day);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const closeOutside = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !root.current || !popover.current) return;

    const updatePosition = () => {
      const bounds = root.current?.getBoundingClientRect();
      const panel = popover.current;
      if (!bounds || !panel) return;
      if (window.innerWidth <= 639) {
        panel.style.top = "";
        panel.style.left = "";
        panel.style.right = "";
        panel.style.bottom = "";
        panel.style.maxHeight = "";
        return;
      }

      const above = bounds.top - 14;
      const below = window.innerHeight - bounds.bottom - 14;
      const placeAbove = below < panel.scrollHeight && above > below;
      panel.style.maxHeight = `${Math.max(0, placeAbove ? above : below)}px`;
      const height = panel.getBoundingClientRect().height;
      const rightAligned = bounds.left + panel.offsetWidth > window.innerWidth - 16;
      const left = rightAligned ? bounds.right - panel.offsetWidth : bounds.left;
      panel.style.top = `${placeAbove ? bounds.top - height - 6 : bounds.bottom + 6}px`;
      panel.style.left = `${Math.max(16, Math.min(left, window.innerWidth - panel.offsetWidth - 16))}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, viewMonth, viewYear]);

  function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function selectDate(dateString: string) {
    onChange(dateString);
    setOpen(false);
    trigger.current?.focus();
  }

  function clearDate() {
    onChange("");
    setOpen(false);
    trigger.current?.focus();
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  function isDateDisabled(dateStr: string): boolean {
    if (minDate && dateStr < minDate) return true;
    if (maxDate && dateStr > maxDate) return true;
    return false;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleOpen();
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
      return;
    }

    let nextDay = focusedDay;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      nextDay = Math.max(1, focusedDay - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      nextDay = Math.min(daysInMonth, focusedDay + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      nextDay = Math.max(1, focusedDay - 7);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      nextDay = Math.min(daysInMonth, focusedDay + 7);
    } else if (event.key === "PageUp") {
      event.preventDefault();
      prevMonth();
      return;
    } else if (event.key === "PageDown") {
      event.preventDefault();
      nextMonth();
      return;
    } else if (event.key === "Home") {
      event.preventDefault();
      nextDay = 1;
    } else if (event.key === "End") {
      event.preventDefault();
      nextDay = daysInMonth;
    } else if (event.key === "Enter") {
      event.preventDefault();
      const candidateStr = toDateString(viewYear, viewMonth, focusedDay);
      if (!isDateDisabled(candidateStr)) {
        selectDate(candidateStr);
      }
      return;
    }

    if (nextDay !== focusedDay) {
      setFocusedDay(nextDay);
      const cellId = `${id}-cell-${nextDay}`;
      document.getElementById(cellId)?.focus();
    }
  }

  const describedBy = [hint || error ? descriptionId : null].filter(Boolean).join(" ") || undefined;
  const showClearButton = clearable && Boolean(value) && !required;
  const isSelected = (day: number) => value === toDateString(viewYear, viewMonth, day);
  const isToday = (day: number) => todayStr === toDateString(viewYear, viewMonth, day);

  return (
    <div
      ref={root}
      className={`${styles.container} ${className}`}
      onKeyDown={handleKeyDown}
    >
      <label id={`${id}-label`} htmlFor={id} className={styles.label}>
        {label}
        {required && <span className={styles.requiredAsterisk} aria-hidden="true"> *</span>}
      </label>

      <div className={styles.inputWrapper}>
        <button
          ref={trigger}
          id={id}
          type="button"
          className={`${styles.trigger} ${error ? styles.triggerError : ""} ${showClearButton ? styles.triggerClearable : ""}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-labelledby={`${id}-label ${id}-display`}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          onClick={toggleOpen}
        >
          <CalendarIcon size={19} className={styles.icon} aria-hidden="true" />
          <span
            id={`${id}-display`}
            className={`${styles.displayValue} ${!value ? styles.placeholder : ""}`}
          >
            {value ? formatFriendlyDate(value) : "Escolher data"}
          </span>
        </button>

        {showClearButton && (
          <button
            type="button"
            className={styles.clearButton}
            aria-label={`Limpar data de ${label}`}
            onClick={clearDate}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {error ? (
        <p id={descriptionId} className={styles.error} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={descriptionId} className={styles.hint}>
          {hint}
        </p>
      ) : null}

      {open && (
        <>
          <div
            className={styles.backdrop}
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
            aria-hidden="true"
          />
          <div
            ref={popover}
            className={styles.popover}
            role="dialog"
            aria-modal="true"
            aria-label={`Escolher data: ${label}`}
          >
            <div className={styles.mobileSheetBar} aria-hidden="true">
              <span className={styles.mobileSheetHandle} />
            </div>
            {/* Barra de atalhos rápidos */}
          <div className={styles.shortcuts} role="group" aria-label="Atalhos rápidos de data">
            <button
              type="button"
              className={styles.shortcutBtn}
              onClick={() => selectDate(todayStr)}
            >
              Hoje
            </button>
            <button
              type="button"
              className={styles.shortcutBtn}
              onClick={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                selectDate(toDateString(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()));
              }}
            >
              Amanhã
            </button>
            <button
              type="button"
              className={styles.shortcutBtn}
              onClick={() => {
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                selectDate(toDateString(nextWeek.getFullYear(), nextWeek.getMonth(), nextWeek.getDate()));
              }}
            >
              Em 7 dias
            </button>
            {clearable && !required && value && (
              <button
                type="button"
                className={styles.shortcutBtn}
                onClick={clearDate}
              >
                Limpar
              </button>
            )}
          </div>

          {/* Cabeçalho de navegação do mês */}
          <div className={styles.header}>
            <button
              type="button"
              className={styles.navBtn}
              aria-label="Mês anterior"
              onClick={prevMonth}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <div className={styles.currentMonth}>
              <strong>{MONTH_NAMES[viewMonth]}</strong>
              <span>{viewYear}</span>
            </div>
            <button
              type="button"
              className={styles.navBtn}
              aria-label="Próximo mês"
              onClick={nextMonth}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>

          {/* Grade do calendário */}
          <table
            className={styles.grid}
            role="grid"
            aria-label={`${MONTH_NAMES[viewMonth]} de ${viewYear}`}
          >
            <thead>
              <tr>
                {WEEKDAY_NAMES.map((wd) => (
                  <th key={wd.short} scope="col" title={wd.full} className={styles.weekdayHeader}>
                    {wd.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.ceil((firstDayOfWeek + daysInMonth) / 7) }).map((_, weekIndex) => (
                <tr key={weekIndex}>
                  {Array.from({ length: 7 }).map((_, dayIndex) => {
                    const dayNumber = weekIndex * 7 + dayIndex - firstDayOfWeek + 1;
                    if (dayNumber < 1 || dayNumber > daysInMonth) {
                      return <td key={dayIndex} className={styles.emptyCell} aria-hidden="true" />;
                    }

                    const dateStr = toDateString(viewYear, viewMonth, dayNumber);
                    const disabled = isDateDisabled(dateStr);
                    const selected = isSelected(dayNumber);
                    const currentDay = isToday(dayNumber);

                    return (
                      <td key={dayIndex} className={styles.cell}>
                        <button
                          id={`${id}-cell-${dayNumber}`}
                          type="button"
                          role="gridcell"
                          className={`${styles.dayButton} ${selected ? styles.daySelected : ""} ${currentDay ? styles.dayToday : ""}`}
                          aria-selected={selected}
                          aria-current={currentDay ? "date" : undefined}
                          disabled={disabled}
                          tabIndex={focusedDay === dayNumber ? 0 : -1}
                          onClick={() => selectDate(dateStr)}
                        >
                          {dayNumber}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
