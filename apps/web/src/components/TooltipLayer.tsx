import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./TooltipLayer.module.css";

type ActiveTooltip = { target: HTMLElement; label: string };
type Position = { left: number; top: number };

function tooltipTarget(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element
    ? target.closest<HTMLElement>("[data-tooltip]")
    : null;
}

export function TooltipLayer() {
  const [active, setActive] = useState<ActiveTooltip | null>(null);
  const [position, setPosition] = useState<Position>({ left: 0, top: 0 });
  const tooltip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let hovered: HTMLElement | null = null;
    let focused: HTMLElement | null = null;
    const sync = () => {
      const target = hovered ?? focused;
      const label = target?.dataset.tooltip?.trim();
      setActive((current) =>
        target && label
          ? current?.target === target && current.label === label
            ? current
            : { target, label }
          : null,
      );
    };
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      hovered = tooltipTarget(event.target);
      sync();
    };
    const onPointerOut = (event: PointerEvent) => {
      if (tooltipTarget(event.target) !== hovered) return;
      hovered = tooltipTarget(event.relatedTarget);
      sync();
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = tooltipTarget(event.target);
      focused = target?.matches(":focus-visible") ? target : null;
      sync();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (tooltipTarget(event.target) !== focused) return;
      const target = tooltipTarget(event.relatedTarget);
      focused = target?.matches(":focus-visible") ? target : null;
      sync();
    };
    const onClick = () => {
      hovered = null;
      focused = null;
      setActive(null);
    };

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("click", onClick);
    };
  }, []);

  useLayoutEffect(() => {
    const target = active?.target;
    const node = tooltip.current;
    if (!target || !node) return;
    if (
      typeof node.showPopover === "function" &&
      !node.matches(":popover-open")
    ) {
      node.showPopover();
    }

    const place = () => {
      if (!target.isConnected) {
        setActive(null);
        return;
      }
      const anchor = target.getBoundingClientRect();
      const bubble = node.getBoundingClientRect();
      const edge = 8;
      const gap = 8;
      const left = Math.min(
        Math.max(edge, anchor.left + (anchor.width - bubble.width) / 2),
        Math.max(edge, window.innerWidth - bubble.width - edge),
      );
      const above = anchor.top - bubble.height - gap;
      const top =
        above >= edge
          ? above
          : Math.min(
              anchor.bottom + gap,
              window.innerHeight - bubble.height - edge,
            );
      setPosition((current) =>
        current.left === left && current.top === top
          ? current
          : { left, top },
      );
    };

    place();
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
      if (
        typeof node.hidePopover === "function" &&
        node.matches(":popover-open")
      ) {
        node.hidePopover();
      }
    };
  }, [active]);

  if (!active) return null;
  return createPortal(
    <div
      ref={tooltip}
      id="app-tooltip"
      className={styles.tooltip}
      popover="manual"
      aria-hidden="true"
      style={{ left: position.left, top: position.top }}
    >
      {active.label}
    </div>,
    document.body,
  );
}
