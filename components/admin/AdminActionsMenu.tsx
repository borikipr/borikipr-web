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

function menuItems(container: HTMLElement | null) {
  return container
    ? Array.from(container.querySelectorAll<HTMLElement>("[role='menuitem']:not([disabled])"))
    : [];
}

export function AdminActionsMenu({
  children,
  compact = false,
  label = "Acciones",
}: {
  children: ReactNode;
  compact?: boolean;
  label?: string;
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
    const menuHeight = menuRef.current?.getBoundingClientRect().height ?? 320;
    const width = Math.min(288, window.innerWidth - 24);
    const below = rect.bottom + 6;
    setPlacement({
      top:
        below + menuHeight > window.innerHeight - 12
          ? Math.max(12, rect.top - menuHeight - 6)
          : below,
      left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      place();
      menuItems(menuRef.current)[0]?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = menuItems(menuRef.current);
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !items.length) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown"
            ? (current + 1) % items.length
            : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div className="admin-actions-menu">
      <button
        ref={buttonRef}
        type="button"
        className="admin-actions-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={compact ? label : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {compact ? (
          <MoreHorizontal aria-hidden="true" size={19} />
        ) : (
          <>
            {label} <ChevronDown aria-hidden="true" size={15} />
          </>
        )}
      </button>
      {open &&
        placement &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            className="admin-actions-popover"
            style={{ position: "fixed", ...placement }}
            onKeyDown={onKeyDown}
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

export function AdminMenuItem({
  children,
  danger = false,
  disabled = false,
  icon,
  onSelect,
}: {
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`admin-actions-item ${danger ? "is-danger" : ""}`}
      disabled={disabled}
      onClick={onSelect}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{children}</span>
    </button>
  );
}

export function AdminActionDialog({
  children,
  description,
  danger = false,
  onClose,
  open,
  title,
}: {
  children: ReactNode;
  description: string;
  danger?: boolean;
  onClose: () => void;
  open: boolean;
  title: string;
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
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const items = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]",
        ) ?? [],
      );
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      previous?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;
  return createPortal(
    <div
      className="admin-action-dialog-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`admin-action-dialog ${danger ? "is-danger" : ""}`}
      >
        <header>
          <div>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar">
            <X aria-hidden="true" size={19} />
          </button>
        </header>
        <div className="admin-action-dialog-content">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
