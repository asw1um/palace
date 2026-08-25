import {
  forwardRef, useEffect, useLayoutEffect, useRef, type InputHTMLAttributes,
  type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { moveThumb } from '@/lib/motion';

export function Field({
  label, hint, children, htmlFor,
}: { label?: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      {label && (
        <label className="field__label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {hint && <div className="field__hint">{hint}</div>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return <input ref={ref} className={`input ${className}`} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...rest }, ref) {
    return <textarea ref={ref} className={`textarea ${className}`} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...rest }, ref) {
    return (
      <select ref={ref} className={`select ${className}`} {...rest}>
        {children}
      </select>
    );
  },
);

export function SearchInput({
  icon, trailing, className = '', ...rest
}: InputHTMLAttributes<HTMLInputElement> & { icon: ReactNode; trailing?: ReactNode }) {
  return (
    <div className={`input-group ${className}`}>
      {icon}
      <input className="input" {...rest} />
      {trailing && <div className="input-group__trailing">{trailing}</div>}
    </div>
  );
}

export function Switch({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={() => onChange(!checked)}
    />
  );
}

export function Slider({
  value, min, max, step = 1, onChange, ariaLabel,
}: {
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; ariaLabel: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="slider"
      aria-label={ariaLabel}
      style={{ ['--pct' as string]: `${pct}%` }}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/** Segmented control with a GSAP-driven thumb. */
export function Segmented<T extends string>({
  options, value, onChange, ariaLabel,
}: { options: SegmentOption<T>[]; value: T; onChange: (v: T) => void; ariaLabel: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useLayoutEffect(() => {
    const active = wrap.current?.querySelector<HTMLElement>(`[data-val="${value}"]`);
    moveThumb(thumb.current, active ?? null, first.current);
    first.current = false;
  }, [value, options.length]);

  useEffect(() => {
    const onResize = () => {
      const active = wrap.current?.querySelector<HTMLElement>(`[data-val="${value}"]`);
      moveThumb(thumb.current, active ?? null, true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [value]);

  return (
    <div className="segmented" ref={wrap} role="group" aria-label={ariaLabel}>
      <div className="segmented__thumb" ref={thumb} style={{ opacity: 0 }} />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          data-val={o.value}
          className="segmented__item"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
