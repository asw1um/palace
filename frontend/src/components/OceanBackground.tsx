import { useRef, useEffect } from 'react';
import { themeStore } from '@/data/themeStore';

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  const bigint = parseInt(v, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

export default function OceanBackground() {
  const tintRef = useRef<HTMLDivElement>(null);

  function applyTint(primary: string) {
    if (!tintRef.current) return;
    const [r, g, b] = hexToRgb(primary);
    tintRef.current.style.background = `rgba(${r}, ${g}, ${b}, 0.38)`;
  }

  useEffect(() => {
    const current = themeStore.list.find(t => t.id === themeStore.get()) ?? themeStore.list[0];
    applyTint(current.primary);

    const handleThemeChange = (e: Event) => {
      const theme = (e as CustomEvent).detail as { primary: string };
      applyTint(theme.primary);
    };
    window.addEventListener('themechange', handleThemeChange);
    return () => window.removeEventListener('themechange', handleThemeChange);
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden' }}>
      {/* Video — filter applied to wrapper so GPU doesn't re-blur each decoded frame */}
      <div style={{
        position: 'absolute', inset: '-5%',
        filter: 'blur(6px) brightness(0.45)',
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}>
        <video
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scale(1.04) translateZ(0)',
          }}
        >
          <source src="./ocean-bg.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Theme colour tint */}
      <div
        ref={tintRef}
        style={{
          position: 'absolute',
          inset: 0,
          mixBlendMode: 'color',
          pointerEvents: 'none',
          zIndex: 1,
          transition: 'background 0.6s ease',
        }}
      />

      {/* Dark base overlay to keep things readable */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.20)',
        pointerEvents: 'none',
        zIndex: 2,
      }} />

      {/* Vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 3,
        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.60) 100%)',
      }} />

      {/* Grain */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: 0.04,
        mixBlendMode: 'overlay',
        zIndex: 4,
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/></svg>")`,
      }} />
    </div>
  );
}
