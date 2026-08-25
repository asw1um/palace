import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
  type MouseEvent as ReactMouseEvent, type ReactNode, type TouchEvent as ReactTouchEvent,
} from 'react';
import { createPortal } from 'react-dom';

export interface MenuPoint { x: number; y: number }

/**
 * Floating menu used for both dropdowns and right-click context menus.
 * Positions itself against the viewport and never overflows.
 */
export function Menu({
  open, at, onClose, children, width = 220, align = 'start',
}: {
  open: boolean;
  at: MenuPoint | null;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  align?: 'start' | 'end';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<MenuPoint>({ x: -9999, y: -9999 });

  useLayoutEffect(() => {
    if (!open || !at || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const pad = 8;
    let x = align === 'end' ? at.x - rect.width : at.x;
    let y = at.y;
    // Clamp right edge first, then left — in that order a menu wider than the
    // viewport lands flush at the padding instead of off-screen negative.
    x = Math.max(pad, Math.min(x, window.innerWidth - rect.width - pad));
    if (y + rect.height > window.innerHeight - pad) y = Math.max(pad, at.y - rect.height);
    setPos({ x, y });
  }, [open, at, align]);

  useEffect(() => {
    if (!open) return;
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    // Scrolling the page dismisses the menu, but scrolling *inside* it must not.
    const onScroll = (e: Event) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !at) return null;

  return createPortal(
    <div
      className="menu"
      ref={ref}
      role="menu"
      // min-width beats max-width in CSS, so cap it here or a wide menu can
      // still force itself past the viewport edge on small screens.
      style={{ left: pos.x, top: pos.y, minWidth: Math.min(width, window.innerWidth - 16) }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function MenuItem({
  icon, children, onClick, danger, active, disabled,
}: {
  icon?: ReactNode; children: ReactNode; onClick?: () => void;
  danger?: boolean; active?: boolean; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      data-active={active || undefined}
      className={`menu__item ${danger ? 'menu__item--danger' : ''}`}
      style={disabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
      onClick={onClick}
    >
      {icon}
      <span className="grow truncate">{children}</span>
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="menu__label">{children}</div>;
}

export function MenuSep() {
  return <div className="menu__sep" />;
}

/** Wires up right-click (and long-press on touch) for a target. — issue #116 */
export function useContextMenu() {
  const [at, setAt] = useState<MenuPoint | null>(null);
  const timer = useRef<number | null>(null);

  const close = useCallback(() => setAt(null), []);

  const onContextMenu = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    setAt({ x: e.clientX, y: e.clientY });
  }, []);

  const onTouchStart = useCallback((e: ReactTouchEvent) => {
    const t = e.touches[0];
    timer.current = window.setTimeout(() => setAt({ x: t.clientX, y: t.clientY }), 480);
  }, []);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  return {
    at,
    open: at !== null,
    close,
    /** Spread on the element that should show the menu. */
    triggerProps: {
      onContextMenu,
      onTouchStart,
      onTouchEnd: clearTimer,
      onTouchMove: clearTimer,
    },
    /** Open the menu from a button click instead of a right-click. */
    openFrom(el: HTMLElement, align: 'start' | 'end' = 'start') {
      const r = el.getBoundingClientRect();
      setAt({ x: align === 'end' ? r.right : r.left, y: r.bottom + 6 });
    },
  };
}
