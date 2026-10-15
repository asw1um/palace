import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/theme/ThemeProvider';
import { clearBackgroundFile, loadBackgroundFile } from '@/theme/background';

/** The user's custom site background, fixed behind everything. */
export function Backdrop() {
  const { theme } = useTheme();
  const bg = theme.background;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!bg) {
      setSrc(null);
      // Covers "reset appearance", which drops the descriptor without touching the file.
      clearBackgroundFile().catch(() => {});
      return;
    }
    let url: string | null = null;
    let alive = true;
    loadBackgroundFile()
      .then((blob) => {
        if (!alive || !blob) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [bg?.id]);

  // A looping video is motion the user may have asked their system to avoid.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { if (query.matches) video.pause(); else video.play().catch(() => {}); };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [src, bg?.kind]);

  return (
    <div className="backdrop" aria-hidden="true">
      {bg && src && (
        bg.kind === 'video' ? (
          <video
            ref={videoRef}
            key={src}
            className="backdrop__media"
            style={{ opacity: theme.backgroundOpacity }}
            src={src}
            muted
            loop
            playsInline
            autoPlay
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="backdrop__media" style={{ opacity: theme.backgroundOpacity }} src={src} alt="" />
        )
      )}
    </div>
  );
}
