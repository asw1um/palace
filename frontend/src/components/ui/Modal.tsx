import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef,
  useState, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from '@/lib/icons';
import { useDialog } from '@/lib/hooks';
import { Button } from './Button';

export function Modal({
  open, onClose, title, children, footer, width, className = '', hideHeader,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  className?: string;
  hideHeader?: boolean;
}) {
  const dialogRef = useDialog(open, onClose);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useLayoutEffect(() => {
    if (!mounted) return;
    const overlay = overlayRef.current;
    const panel = dialogRef.current;
    if (!overlay || !panel) return;

    if (open) {
      // Flush layout so the transition fires from the initial hidden state.
      void overlay.offsetHeight;
      overlay.setAttribute('data-open', '');
      panel.setAttribute('data-open', '');
      return;
    }

    // Closing: remove attribute to trigger out-transition, then unmount.
    overlay.removeAttribute('data-open');
    panel.removeAttribute('data-open');
    const t = window.setTimeout(() => setMounted(false), 160);
    // Belt and braces: never let a failed transition trap the dialog on screen.
    const failsafe = window.setTimeout(() => setMounted(false), 600);
    return () => {
      clearTimeout(t);
      clearTimeout(failsafe);
    };
  }, [open, mounted, dialogRef]);

  // Focus the first control when opening
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>('input, textarea, button:not([data-close])')
        ?.focus();
    }, 60);
    return () => clearTimeout(t);
  }, [open, dialogRef]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="overlay"
      ref={overlayRef}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${className}`}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        style={width ? { ['--modal-w' as string]: `${width}px` } : undefined}
      >
        {!hideHeader && (
          <header className="modal__head">
            <div className="modal__title">{title}</div>
            <Button variant="ghost" size="sm" data-close aria-label="Close" onClick={onClose}>
              <X size={16} />
            </Button>
          </header>
        )}
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */
/* Confirm dialog                                                              */
/* -------------------------------------------------------------------------- */

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

const ConfirmCtx = createContext<(opts: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  );

  const settle = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => settle(false)}
        title={state?.title}
        width={420}
        footer={
          <>
            <Button onClick={() => settle(false)}>{state?.cancelLabel ?? 'Cancel'}</Button>
            <Button
              variant={state?.danger ? 'danger' : 'primary'}
              onClick={() => settle(true)}
            >
              {state?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <p className="muted">{state?.message}</p>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  return useContext(ConfirmCtx);
}
