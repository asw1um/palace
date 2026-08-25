import { useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { Star } from 'lucide-react';
import { countUp, moveInk } from '@/lib/motion';
import { initials } from '@/lib/format';

/* ------------------------------------------------------------------ Panel -- */
export function Panel({
  title, icon, actions, children, flush, className = '',
}: {
  title?: ReactNode; icon?: ReactNode; actions?: ReactNode;
  children: ReactNode; flush?: boolean; className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="panel__head">
          <h2 className="panel__title">
            {icon}
            {title}
          </h2>
          {actions && <div className="row gap-2">{actions}</div>}
        </header>
      )}
      <div className={`panel__body ${flush ? 'panel__body--flush' : ''}`}>{children}</div>
    </section>
  );
}

/* ----------------------------------------------------------------- Avatar -- */
export function Avatar({
  src, name, size = 36, className = '',
}: { src?: string | null; name?: string | null; size?: number; className?: string }) {
  return (
    <div className={`avatar ${className}`} style={{ ['--size' as string]: `${size}px` }}>
      {src ? <img src={src} alt="" loading="lazy" /> : <span>{initials(name)}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ Chip ---- */
export function Chip({
  children, tone, className = '', ...rest
}: {
  children: ReactNode;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
  className?: string;
} & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`chip ${tone ? `chip--${tone}` : ''} ${className}`} {...rest}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------- Empty state -- */
export function Empty({
  icon, title, children, action,
}: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty__icon">{icon}</div>}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/* --------------------------------------------------------------- Skeleton --- */
export function Skeleton({ h = 16, w = '100%', r }: { h?: number | string; w?: number | string; r?: string }) {
  return (
    <div
      className="skeleton"
      style={{ height: typeof h === 'number' ? `${h}px` : h, width: typeof w === 'number' ? `${w}px` : w, borderRadius: r }}
    />
  );
}

/* --------------------------------------------------------------- Progress --- */
export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-label={label ?? 'progress'}>
      <div className="progress__bar" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Ring({ value, size = 44 }: { value: number; size?: number }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" style={{ ['--ring-size' as string]: `${size}px` }} viewBox={`0 0 ${size} ${size}`}>
      <circle className="ring__track" cx={size / 2} cy={size / 2} r={r} />
      <circle
        className="ring__value"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeDasharray={c}
        strokeDashoffset={c - (c * Math.max(0, Math.min(100, value))) / 100}
      />
    </svg>
  );
}

/* ------------------------------------------------------------- Stat tile ---- */
export function Stat({
  label, value, icon, foot, suffix,
}: { label: string; value: number; icon?: ReactNode; foot?: ReactNode; suffix?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Layout effect so the placeholder never paints before the counter starts.
  useLayoutEffect(() => {
    countUp(ref.current, value, { suffix });
  }, [value, suffix]);
  return (
    <div className="stat">
      <div className="stat__label">
        {icon}
        {label}
      </div>
      <div className="stat__value" ref={ref}>0</div>
      {foot && <div className="stat__foot">{foot}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Tabs ---- */
export interface TabDef<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function Tabs<T extends string>({
  tabs, value, onChange,
}: { tabs: TabDef<T>[]; value: T; onChange: (v: T) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const ink = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useLayoutEffect(() => {
    const active = wrap.current?.querySelector<HTMLElement>(`[data-tab="${value}"]`);
    moveInk(ink.current, active ?? null, first.current);
    first.current = false;
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value, tabs.length]);

  return (
    <div className="tabs" role="tablist" ref={wrap}>
      <div className="tabs__ink" ref={ink} style={{ opacity: 0 }} />
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          data-tab={t.value}
          className="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count !== undefined && <span className="faint"> {t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- Stars ---- */
export function Stars({
  value, onChange, size = 16, max = 10,
}: { value: number; onChange?: (v: number) => void; size?: number; max?: number }) {
  const filled = Math.round((value / max) * 5);
  if (!onChange) {
    return (
      <span className="stars" aria-label={`${value} out of ${max}`}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} size={size} fill={i < filled ? 'currentColor' : 'none'} strokeWidth={1.6} />
        ))}
      </span>
    );
  }
  return (
    <span className="stars" role="radiogroup" aria-label="Your rating">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i + 1}
          aria-label={`${i + 1} of ${max}`}
          onClick={() => onChange(i + 1)}
        >
          <Star size={size} fill={i < value ? 'currentColor' : 'none'} strokeWidth={1.6} />
        </button>
      ))}
    </span>
  );
}

/* -------------------------------------------------------------- Checkbox ---- */
export function CheckBox({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className="checkbox"
      onClick={() => onChange(!checked)}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </button>
  );
}
