import { useState, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';
import Image from 'next/image';
import { Star } from '@/lib/icons';
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
      {src
        ? <Image src={src} alt="" width={size} height={size} unoptimized={src.startsWith('data:')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span>{initials(name)}</span>}
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
  return (
    <div className="stat">
      <div className="stat__label">
        {icon}
        {label}
      </div>
      <div className="stat__value">
        {value.toLocaleString()}{suffix}
      </div>
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

  useLayoutEffect(() => {
    wrap.current?.querySelector<HTMLElement>(`[data-tab="${value}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value, tabs.length]);

  return (
    <div className="tabs" role="tablist" ref={wrap}>
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

/* Renders one star: full fill, left-half fill (for N.5 ratings), or empty. */
function StarIcon({ size, fill, idx }: { size: number; fill: 'full' | 'half' | 'none'; idx: number }) {
  const clipId = `star-half-${idx}`;
  const pts = '12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0 }} aria-hidden="true">
      {fill === 'half' && (
        <defs>
          <clipPath id={clipId}><rect x="0" y="0" width="12" height="24" /></clipPath>
        </defs>
      )}
      <polygon points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {fill !== 'none' && (
        <polygon
          points={pts}
          fill="currentColor"
          stroke="none"
          clipPath={fill === 'half' ? `url(#${clipId})` : undefined}
        />
      )}
    </svg>
  );
}

/**
 * 5-star display with half-star precision.
 * Internal scale: 1–10 (stored in DB). Display: 0.5–5 stars.
 *   1 = ½★  2 = 1★  3 = 1½★  … 10 = 5★
 */
export function Stars({
  value, onChange, size = 16,
}: { value: number; onChange?: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;

  const fillFor = (i: number): 'full' | 'half' | 'none' => {
    const full = (i + 1) * 2;   // 2,4,6,8,10
    const half = full - 1;       // 1,3,5,7,9
    if (display >= full) return 'full';
    if (display >= half) return 'half';
    return 'none';
  };

  if (!onChange) {
    return (
      <span className="stars" aria-label={`${value / 2} out of 5`}>
        {Array.from({ length: 5 }, (_, i) => (
          <StarIcon key={i} size={size} fill={fillFor(i)} idx={i} />
        ))}
      </span>
    );
  }

  return (
    <span className="stars" role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHover(null)}>
      {Array.from({ length: 5 }, (_, i) => {
        const fullVal = (i + 1) * 2;
        const halfVal = fullVal - 1;
        return (
          <span key={i} style={{ position: 'relative', display: 'inline-flex', width: size, height: size }}>
            <StarIcon size={size} fill={fillFor(i)} idx={i} />
            {/* Left half click → half-star */}
            <button
              type="button"
              role="radio"
              aria-checked={value === halfVal}
              aria-label={`${halfVal / 2} stars`}
              style={{ position: 'absolute', inset: 0, right: '50%', opacity: 0, cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
              onMouseEnter={() => setHover(halfVal)}
              onClick={() => onChange(halfVal)}
            />
            {/* Right half click → full star */}
            <button
              type="button"
              role="radio"
              aria-checked={value === fullVal}
              aria-label={`${fullVal / 2} stars`}
              style={{ position: 'absolute', inset: 0, left: '50%', opacity: 0, cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
              onMouseEnter={() => setHover(fullVal)}
              onClick={() => onChange(fullVal)}
            />
          </span>
        );
      })}
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
