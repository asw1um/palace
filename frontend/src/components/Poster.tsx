const posterPatterns = [
  'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 8px)',
  'repeating-linear-gradient(-45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 8px)',
  'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.06) 1px, transparent 0)',
  'repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 6px)',
  'repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 6px)',
  'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
];

interface PosterProps {
  idx?: number;
  poster_url?: string | null;
  progress?: number;
  style?: React.CSSProperties;
  className?: string;
}

export default function Poster({ idx = 0, poster_url, progress, style, className }: PosterProps) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: '10px',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Aspect ratio spacer: paddingTop % = height/width * 100 = 3/2 * 100 = 150% */}
      <div style={{ paddingTop: '150%' }} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: '10px',
          backgroundImage: poster_url
            ? `url(${poster_url})`
            : posterPatterns[idx % posterPatterns.length],
          backgroundSize: poster_url ? 'cover' : '10px 10px',
          backgroundPosition: 'center',
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        }}
      >
        {!poster_url && (
          <div style={{ padding: '10px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '50%',
              }}
            />
          </div>
        )}
      </div>
      {progress !== undefined && progress > 0 && (
        <>
          {/* Subtle gradient overlay rising from bottom */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${Math.max(5, Math.min(35, progress))}%`,
            background: `linear-gradient(to top, var(--t-primary)66, transparent)`,
            borderRadius: '0 0 10px 10px',
            pointerEvents: 'none',
            zIndex: 2,
          }} />
          {/* Thin progress bar at the very bottom */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'rgba(0,0,0,0.4)',
            borderRadius: '0 0 10px 10px',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 3,
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: 'var(--t-primary)',
              boxShadow: '0 0 6px var(--t-primary)',
            }} />
          </div>
        </>
      )}
    </div>
  );
}
