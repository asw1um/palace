import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmDialogCtx {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<ConfirmDialogCtx>({ confirm: () => Promise.resolve(false) });

export function useConfirm() {
  return useContext(Ctx).confirm;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({ message: '' });
  const resolverRef = useRef<((val: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setOpts(options);
    setOpen(true);
    return new Promise(resolve => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleConfirm = () => {
    setOpen(false);
    if (resolverRef.current) resolverRef.current(true);
  };

  const handleCancel = () => {
    setOpen(false);
    if (resolverRef.current) resolverRef.current(false);
  };

  if (!open) {
    return <Ctx.Provider value={{ confirm }}>{children}</Ctx.Provider>;
  }

  const primary = 'var(--t-primary)';
  const dangerColor = opts.danger ? '#f56565' : primary;

  return (
    <Ctx.Provider value={{ confirm }}>
      {children}
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.15s ease',
        }}
        onClick={handleCancel}
      />
      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          width: '400px',
          maxWidth: 'calc(100vw - 32px)',
          animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Gloss */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%)',
            borderRadius: '12px 12px 0 0', pointerEvents: 'none',
          }} />

          {/* Content */}
          <div style={{ padding: '24px', position: 'relative', zIndex: 1 }}>
            {/* Icon + Title */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: `${dangerColor}22`,
                border: `1px solid ${dangerColor}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <AlertTriangle style={{ width: '20px', color: dangerColor }} />
              </div>
              <span style={{ fontSize: '17px', fontWeight: 700, color: '#fff', textAlign: 'center' }}>
                {opts.title || 'Confirm'}
              </span>
            </div>

            {/* Message */}
            <p style={{
              fontSize: '14px', color: 'rgba(255,255,255,0.7)',
              lineHeight: 1.5, margin: '0 0 20px 0', textAlign: 'center',
            }}>
              {opts.message}
            </p>

            {/* Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={handleCancel}
                style={{
                  padding: '8px 16px', borderRadius: '6px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              >
                {opts.cancelLabel || 'Cancel'}
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  padding: '8px 16px', borderRadius: '6px',
                  background: opts.danger
                    ? 'linear-gradient(180deg, #f56565cc 0%, #f5656599 100%)'
                    : `linear-gradient(180deg, ${primary}cc 0%, ${primary}99 100%)`,
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff', fontSize: '13px', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                  boxShadow: opts.danger
                    ? '0 2px 8px rgba(245,101,101,0.3)'
                    : '0 2px 8px rgba(0,0,0,0.15)',
                }}
                onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
              >
                {opts.confirmLabel || 'OK'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.92); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </Ctx.Provider>
  );
}
