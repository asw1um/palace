import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTheme } from '@/data/ThemeContext';

interface GlassBoxProps {
  title?: string | React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  rightAction?: React.ReactNode;
}

export default function GlassBox({ title, children, style, className, collapsible, defaultCollapsed, rightAction }: GlassBoxProps) {
  const [hovered, setHovered] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? false);
  const { themeId } = useTheme();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultCollapsed !== undefined) {
      setCollapsed(defaultCollapsed);
    }
  }, [defaultCollapsed]);

  const toggleCollapsed = useCallback(() => {
    if (collapsible) setCollapsed(c => !c);
  }, [collapsible]);

  const primary = 'var(--t-primary)';
  const glow = 'var(--t-glow)';

  return (
    <div
      ref={boxRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`glass-box ${hovered ? 'glass-box--active' : ''} ${className || ''}`}
      data-theme={themeId}
      style={{
        borderRadius: '10px',
        overflow: 'hidden',
        border: hovered
          ? `1px solid ${primary}`
          : '1px solid rgba(255,255,255,0.18)',
        boxShadow: hovered
          ? `0 0 16px ${glow}55, 0 0 32px ${glow}33, 0 0 48px ${glow}18, inset 0 1px 0 rgba(255,255,255,0.4)`
          : '0 4px 12px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.12)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
        ...style,
      }}
    >
      {/* ====== LAYER 0: Edge pulse glow ring (outermost) ====== */}
      {hovered && (
        <div style={{
          position: 'absolute',
          inset: '-1px',
          borderRadius: '11px',
          pointerEvents: 'none',
          zIndex: 0,
          boxShadow: `0 0 12px ${glow}44, 0 0 24px ${glow}22, 0 0 48px ${glow}11, inset 0 0 12px ${glow}15`,
        }} />
      )}

      {/* ====== LAYER 1: Traveling sweep sheen (light leak across surface) ====== */}
      {hovered && (
        <div className="glass-box__sweep" style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: `linear-gradient(105deg,
            transparent 20%,
            ${glow}18 40%,
            ${glow}40 50%,
            ${glow}55 52%,
            ${glow}35 54%,
            ${glow}20 60%,
            transparent 80%)`,
          pointerEvents: 'none',
          zIndex: 2,
          willChange: 'transform',
        }} />
      )}

      {/* ====== LAYER 2: Internal fluid aurora — only mounted while hovered ====== */}
      {hovered && (
        <div style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
        }}>
          <div style={{
            position: 'absolute', width: '160%', height: '160%',
            top: '-30%', left: '-30%',
            background: `radial-gradient(circle at 30% 30%, ${glow}55 0%, transparent 40%),
                         radial-gradient(circle at 70% 60%, ${glow}38 0%, transparent 45%),
                         radial-gradient(circle at 50% 50%, ${glow}22 0%, transparent 50%)`,
            animation: 'boxAurora-drift 8s ease-in-out infinite, boxAurora-pulse 5s ease-in-out infinite',
            mixBlendMode: 'screen',
            filter: 'blur(2px)',
            willChange: 'transform',
          }} />
          <div style={{
            position: 'absolute', width: '130%', height: '130%',
            top: '-15%', left: '-15%',
            background: `radial-gradient(circle at 60% 40%, ${glow}35 0%, transparent 50%),
                         radial-gradient(circle at 40% 70%, ${glow}25 0%, transparent 45%)`,
            animation: 'boxAurora-drift-alt 10s ease-in-out infinite reverse',
            mixBlendMode: 'screen',
            filter: 'blur(2px)',
            willChange: 'transform',
          }} />
          <div style={{
            position: 'absolute', width: '60%', height: '60%',
            top: '-10%', left: '-10%',
            background: `radial-gradient(ellipse 80% 60% at 10% 10%, ${glow}50 0%, transparent 60%)`,
            animation: 'boxAurora-drift 12s ease-in-out infinite',
            mixBlendMode: 'screen',
            filter: 'blur(4px)',
            willChange: 'transform',
          }} />
          <div style={{
            position: 'absolute', width: '60%', height: '60%',
            bottom: '-10%', right: '-10%',
            background: `radial-gradient(ellipse 80% 60% at 90% 90%, ${glow}35 0%, transparent 60%)`,
            animation: 'boxAurora-drift-alt 14s ease-in-out infinite',
            mixBlendMode: 'screen',
            filter: 'blur(4px)',
            willChange: 'transform',
          }} />
        </div>
      )}

      {/* ====== LAYER 3: Top highlight bar ====== */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '50px',
        background: `linear-gradient(180deg, ${glow}22 0%, transparent 100%)`,
        borderRadius: '10px 10px 0 0',
        pointerEvents: 'none', zIndex: 1,
      }} />

      {/* ====== TITLE BAR ====== */}
      {title && (
        <div
          onClick={toggleCollapsed}
          style={{
            padding: '10px 16px', fontSize: '12px', fontWeight: 700, color: '#fff',
            borderBottom: collapsed && collapsible ? 'none' : '1px solid rgba(255,255,255,0.12)',
            background: `linear-gradient(180deg, ${primary}30 0%, ${primary}14 100%)`,
            textShadow: '0 1px 3px rgba(0,0,0,0.3)',
            position: 'relative', zIndex: 1,
            cursor: collapsible ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            ...(typeof title === 'string' ? { letterSpacing: '2px', textTransform: 'uppercase' } : {}),
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {collapsible && (
              <svg width="12" height="12" viewBox="0 0 12 12" style={{ transition: 'transform 0.2s', transform: collapsed ? 'rotate(-90deg)' : 'none', flexShrink: 0 }}>
                <path d="M4 2l4 4-4 4" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            )}
            {title}
          </span>
          {rightAction}
        </div>
      )}

      {/* ====== CONTENT ====== */}
      {(!collapsible || !collapsed) && (
        <div style={{ padding: '16px', position: 'relative', zIndex: 5, flex: 1, minHeight: 0, overflowY: 'auto', pointerEvents: 'auto' }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ====== Smaller glass card for list items, rows, etc. ====== */
export function GlassCard({ children, style, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 14px',
        background: 'rgba(255,255,255,0.08)',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.12)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.25s ease',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      onMouseEnter={e => {
        const glow = 'var(--t-glow)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
        e.currentTarget.style.borderColor = `${glow}`;
        e.currentTarget.style.boxShadow = `0 0 20px ${glow}55, 0 0 40px ${glow}33, 0 4px 16px rgba(0,0,0,0.15)`;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        e.currentTarget.style.transform = 'none';
      }}
    >
      {children}
    </div>
  );
}
