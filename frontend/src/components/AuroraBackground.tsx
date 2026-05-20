/*
  Organic ocean-cloud background — visible flowing shapes.
  Stronger opacity, less blur, smaller blobs so they don't
  wash into a single flat color.
*/

export default function AuroraBackground() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        background: 'linear-gradient(170deg, #1d4e8a 0%, #163a6e 30%, #0e2752 60%, #091835 100%)',
      }}
    >
      {/* === LAYER 1: Large deep clouds (slowest) === */}
      <div
        style={{
          position: 'absolute',
          inset: '-30%',
          opacity: 0.9,
          background: `
            radial-gradient(ellipse 600px 400px at 15% 35%, rgba(50,130,230,0.75) 0%, transparent 70%),
            radial-gradient(ellipse 500px 500px at 85% 65%, rgba(35,100,210,0.7) 0%, transparent 65%),
            radial-gradient(ellipse 550px 350px at 50% 85%, rgba(25,80,190,0.65) 0%, transparent 60%)
          `,
          filter: 'blur(20px)',
          animation: 'cloud-drift-1 70s ease-in-out infinite alternate',
        }}
      />

      {/* === LAYER 2: Mid-size brighter clouds === */}
      <div
        style={{
          position: 'absolute',
          inset: '-25%',
          opacity: 0.85,
          background: `
            radial-gradient(ellipse 450px 350px at 75% 25%, rgba(75,155,245,0.8) 0%, transparent 65%),
            radial-gradient(ellipse 400px 450px at 20% 75%, rgba(55,125,225,0.75) 0%, transparent 60%),
            radial-gradient(ellipse 500px 300px at 65% 80%, rgba(40,105,215,0.7) 0%, transparent 55%)
          `,
          filter: 'blur(16px)',
          animation: 'cloud-drift-2 50s ease-in-out infinite alternate',
        }}
      />

      {/* === LAYER 3: Medium bright clouds (more active) === */}
      <div
        style={{
          position: 'absolute',
          inset: '-20%',
          opacity: 0.8,
          background: `
            radial-gradient(ellipse 350px 300px at 35% 20%, rgba(100,180,255,0.85) 0%, transparent 60%),
            radial-gradient(ellipse 300px 350px at 80% 50%, rgba(70,150,240,0.8) 0%, transparent 55%),
            radial-gradient(ellipse 400px 250px at 45% 70%, rgba(55,130,225,0.75) 0%, transparent 50%)
          `,
          filter: 'blur(12px)',
          animation: 'cloud-drift-3 40s ease-in-out infinite alternate',
        }}
      />

      {/* === LAYER 4: Bright highlights (most visible, fastest) === */}
      <div
        style={{
          position: 'absolute',
          inset: '-15%',
          opacity: 0.75,
          background: `
            radial-gradient(ellipse 280px 220px at 60% 30%, var(--t-primary-90) 0%, rgba(90,165,240,0.5) 50%, transparent 70%),
            radial-gradient(ellipse 250px 280px at 25% 60%, rgba(85,160,245,0.85) 0%, rgba(55,120,220,0.45) 50%, transparent 65%),
            radial-gradient(ellipse 300px 200px at 70% 75%, rgba(110,185,255,0.8) 0%, rgba(70,140,230,0.4) 50%, transparent 60%)
          `,
          filter: 'blur(8px)',
          animation: 'cloud-drift-4 30s ease-in-out infinite alternate',
        }}
      />

      {/* Top sheen */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(100,175,255,0.08) 0%, transparent 30%, rgba(8,20,50,0.2) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Subtle grain */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
          pointerEvents: 'none',
        }}
      />

      <style>{`
        @keyframes cloud-drift-1 {
          0%   { transform: translate(0, 0) rotate(0deg) scale(1); }
          33%  { transform: translate(5%, -4%) rotate(1.5deg) scale(1.06); }
          66%  { transform: translate(-3%, 3%) rotate(-1deg) scale(0.97); }
          100% { transform: translate(4%, -2%) rotate(0.5deg) scale(1.03); }
        }
        @keyframes cloud-drift-2 {
          0%   { transform: translate(0, 0) rotate(0deg) scale(1.03); }
          33%  { transform: translate(-4%, 3%) rotate(-1.5deg) scale(1); }
          66%  { transform: translate(3%, -4%) rotate(1deg) scale(1.07); }
          100% { transform: translate(-2%, 2%) rotate(-0.5deg) scale(0.98); }
        }
        @keyframes cloud-drift-3 {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(4%, -3%) scale(1.08) rotate(1deg); }
          100% { transform: translate(-3%, 2%) scale(0.96) rotate(-0.5deg); }
        }
        @keyframes cloud-drift-4 {
          0%   { transform: translate(0, 0) scale(0.97); }
          50%  { transform: translate(-4%, 4%) scale(1.06) rotate(-1deg); }
          100% { transform: translate(3%, -3%) scale(1) rotate(0.5deg); }
        }
      `}</style>
    </div>
  );
}
