import { useEffect, useRef } from 'react';
import { driftBlobs } from '@/lib/motion';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The page background. Which layer renders is a user preference:
 * aurora mesh (default), flat gradient, solid, the ocean video, or a custom
 * image the user supplied. — issue #4
 */
export function Backdrop() {
  const { theme } = useTheme();
  const meshRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (theme.backdrop !== 'mesh' || !meshRef.current) return;
    const blobs = Array.from(meshRef.current.querySelectorAll<HTMLElement>('.backdrop__blob'));
    return driftBlobs(blobs);
  }, [theme.backdrop, theme.motion]);

  return (
    <div className="backdrop" aria-hidden="true">
      {theme.backdrop === 'mesh' && (
        <>
          <div className="backdrop__mesh" ref={meshRef}>
            <div className="backdrop__blob backdrop__blob--a" />
            <div className="backdrop__blob backdrop__blob--b" />
            <div className="backdrop__blob backdrop__blob--c" />
          </div>
          <div className="backdrop__grain" />
        </>
      )}

      {theme.backdrop === 'gradient' && (
        <div
          className="backdrop__image"
          style={{
            background:
              'radial-gradient(120% 90% at 12% 0%, color-mix(in oklab, var(--accent) 26%, transparent), transparent 60%),' +
              'radial-gradient(110% 80% at 92% 12%, color-mix(in oklab, var(--accent-2) 22%, transparent), transparent 62%),' +
              'linear-gradient(180deg, var(--bg-base), var(--bg-deep))',
          }}
        />
      )}

      {theme.backdrop === 'video' && (
        <>
          <video className="backdrop__video" autoPlay loop muted playsInline src="./ocean-bg.mp4" />
          <div className="backdrop__scrim" />
        </>
      )}

      {theme.backdrop === 'image' && theme.backdropImage && (
        <>
          <div className="backdrop__image" style={{ backgroundImage: `url(${theme.backdropImage})` }} />
          <div className="backdrop__scrim" />
        </>
      )}
    </div>
  );
}
