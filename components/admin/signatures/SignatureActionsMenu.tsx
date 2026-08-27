"use client";

import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronDown, MoreHorizontal, X } from "lucide-react";

type Placement = Readonly<{ top: number; left: number; width: number }>;

function focusableItems(container: HTMLElement | null) {
  return container
    ? Array.from(container.querySelectorAll<HTMLElement>("[role='menuitem']:not([disabled])"))
    : [];
}

export function SignatureActionsMenu({
  children,
  align = "end",
  compact = false,
  className = "",
}: {
  children: ReactNode;
  align?: "start" | "end";
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const place = useCallback(() => {
    const trigger = buttonRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(288, window.innerWidth - 24);
    const preferredLeft = align === "end" ? rect.right - width : rect.left;
    setPlacement({
      top: rect.bottom + 6,
      left: Math.max(12, Math.min(preferredLeft, window.innerWidth - width - 12)),
      width,
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    requestAnimationFrame(() => focusableItems(menuRef.current)[0]?.focus());
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    const update = () => place();
    document.addEventListener("pointerdown", close);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, place]);

  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = focusableItems(menuRef.current);
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
        : event.key === "ArrowDown" ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
      items[next]?.focus();
    }
  };

  return (
    <div className={`signature-actions ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        className="btn-secondary signature-actions-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {compact ? <MoreHorizontal aria-hidden="true" size={18} /> : <>Acciones <ChevronDown aria-hidden="true" size={15} /></>}
      </button>
      {open && placement && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Acciones de la solicitud"
          className="signature-actions-popover"
          style={{ position: "fixed", top: placement.top, left: placement.left, width: placement.width }}
          onKeyDown={keyboard}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("[role='menuitem']")) setOpen(false);
          }}
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}

export function SignatureMenuItem({
  children,
  icon,
  danger = false,
  onSelect,
}: {
  children: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`signature-actions-item ${danger ? "is-danger" : ""}`}
      onClick={onSelect}
    >
      <span aria-hidden="true">{icon}</span><span>{children}</span>
    </button>
  );
}

export function SignatureActionDialog({
  open,
  title,
  description,
  children,
  danger = false,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  children: ReactNode;
  danger?: boolean;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const keyboard = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") return onClose();
      if (event.key !== "Tab") return;
      const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]") ?? []);
      if (!items.length) return;
      const first = items[0]; const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("keydown", keyboard); previous?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="signature-action-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className={`signature-action-dialog ${danger ? "is-danger" : ""}`}>
        <header>
          <div><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar"><X aria-hidden="true" size={19} /></button>
        </header>
        <div className="signature-action-dialog-content">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
