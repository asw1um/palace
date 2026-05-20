import React from 'react';

/**
 * Wrapper that applies example styling (slightly dimmed, badge overlay)
 */
export function ExampleWrapper(props: { children: React.ReactNode; label?: string; style?: React.CSSProperties }) {
  const { children, label, style } = props;
  return (
    <div style={{ position: 'relative', opacity: 0.75, ...style }}>
      {children}
      <div
        style={{
          position: 'absolute',
          top: '6px',
          right: '6px',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            padding: '1px 6px',
            borderRadius: '4px',
            fontSize: '9px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.5)',
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.1)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          {label || 'Example'}
        </span>
      </div>
    </div>
  );
}

/**
 * Small badge that marks example/placeholder content.
 */
export default function ExampleBadge(props: { style?: React.CSSProperties }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 6px',
        borderRadius: '4px',
        fontSize: '9px',
        fontWeight: 700,
        color: 'rgba(255,255,255,0.5)',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.1)',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        ...props.style,
      }}
    >
      Example
    </span>
  );
}
