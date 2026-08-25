import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'default' | 'primary' | 'ghost' | 'soft' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  block?: boolean;
  /** Adds a springy pop on click — nice for toggles and adds. */
  bounce?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', icon, block, bounce, className = '', children, onClick, ...rest },
  ref,
) {
  const classes = [
    'btn',
    variant !== 'default' && `btn--${variant}`,
    size !== 'md' && `btn--${size}`,
    !children && 'btn--icon',
    block && 'btn--block',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      className={classes}
      onClick={(e) => {
        onClick?.(e);
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button className={`icon-btn tip ${className}`} data-tip={label} aria-label={label} {...rest}>
      {children}
    </button>
  );
}
