import { useState, useRef, useCallback, useEffect } from 'react';
import { X, RotateCw } from 'lucide-react';

interface Props {
  src: string;
  shape: 'circle' | 'rect';
  aspectRatio: number; // width / height for rect shape
  onApply: (dataUrl: string) => void;
  onCancel: () => void;
}

// Canvas preview dimensions
const CANVAS_W = 520;

function getCropDims(shape: 'circle' | 'rect', aspectRatio: number) {
  if (shape === 'circle') {
    return { cropW: 240, cropH: 240, canvasH: 360 };
  }
  const cropW = 440;
  const cropH = Math.round(cropW / aspectRatio);
  return { cropW, cropH, canvasH: cropH + 80 };
}

export default function ImageCropModal({ src, shape, aspectRatio, onApply, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

  const { cropW, cropH, canvasH } = getCropDims(shape, aspectRatio);
  const centerX = CANVAS_W / 2;
  const centerY = canvasH / 2;

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      // Set initial zoom so image covers the crop area
      const rotRad = 0;
      const effW = Math.abs(img.naturalWidth * Math.cos(rotRad)) + Math.abs(img.naturalHeight * Math.sin(rotRad));
      const effH = Math.abs(img.naturalWidth * Math.sin(rotRad)) + Math.abs(img.naturalHeight * Math.cos(rotRad));
      const cover = Math.max(cropW / effW, cropH / effH);
      setZoom(Math.max(cover, 0.1));
      setOffset({ x: 0, y: 0 });
      setRotation(0);
      setImgLoaded(true);
    };
    img.src = src;
  }, [src, cropW, cropH]);

  // Draw frame
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, canvasH);

    const rotRad = (rotation * Math.PI) / 180;

    function applyTransform() {
      ctx.translate(centerX + offset.x, centerY + offset.y);
      ctx.rotate(rotRad);
      ctx.scale(zoom, zoom);
    }

    // 1. Draw dimmed image (full canvas, no clip)
    ctx.save();
    ctx.globalAlpha = 0.35;
    applyTransform();
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();

    // 2. Dark overlay outside crop
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, CANVAS_W, canvasH);
    ctx.globalCompositeOperation = 'destination-out';
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(centerX, centerY, cropW / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(centerX - cropW / 2, centerY - cropH / 2, cropW, cropH);
    }
    ctx.restore();

    // 3. Draw full-brightness image clipped to crop area
    ctx.save();
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(centerX, centerY, cropW / 2, 0, Math.PI * 2);
    } else {
      ctx.rect(centerX - cropW / 2, centerY - cropH / 2, cropW, cropH);
    }
    ctx.clip();
    ctx.globalAlpha = 1;
    applyTransform();
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();

    // 4. Draw crop border
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2.5;
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(centerX, centerY, cropW / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(centerX - cropW / 2, centerY - cropH / 2, cropW, cropH);
    }
    ctx.restore();
  }, [zoom, rotation, offset, imgLoaded, shape, cropW, cropH, canvasH, centerX, centerY]);

  useEffect(() => { draw(); }, [draw]);

  // Drag handlers
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setOffset({
        x: dragStart.current.ox + (e.clientX - dragStart.current.mx),
        y: dragStart.current.oy + (e.clientY - dragStart.current.my),
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Touch support
  const touchStart = useRef({ tx: 0, ty: 0, ox: 0, oy: 0 });
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { tx: t.clientX, ty: t.clientY, ox: offset.x, oy: offset.y };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    setOffset({
      x: touchStart.current.ox + (t.clientX - touchStart.current.tx),
      y: touchStart.current.oy + (t.clientY - touchStart.current.ty),
    });
  };

  const handleReset = () => {
    const img = imgRef.current;
    if (!img) return;
    const cover = Math.max(cropW / img.naturalWidth, cropH / img.naturalHeight);
    setZoom(Math.max(cover, 0.1));
    setOffset({ x: 0, y: 0 });
    setRotation(0);
  };

  const handleApply = () => {
    const img = imgRef.current;
    if (!img) return;

    const outW = shape === 'circle' ? 400 : 800;
    const outH = shape === 'circle' ? 400 : Math.round(800 / aspectRatio);
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d');
    if (!ctx) return;

    const scale = outW / cropW; // preview-to-output scale
    const rotRad = (rotation * Math.PI) / 180;

    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(outW / 2, outH / 2, outW / 2, 0, Math.PI * 2);
      ctx.clip();
    }

    ctx.translate(outW / 2 + offset.x * scale, outH / 2 + offset.y * scale);
    ctx.rotate(rotRad);
    ctx.scale(zoom * scale, zoom * scale);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

    onApply(out.toDataURL('image/jpeg', 0.93));
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
      onClick={onCancel}
    >
      <div
        className="modal-in"
        style={{ background: '#1e2433', borderRadius: '14px', padding: '24px', width: `${CANVAS_W + 48}px`, boxShadow: '0 32px 80px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff', fontFamily: 'inherit' }}>Edit Image</span>
          <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', padding: '6px', display: 'flex', alignItems: 'center' }}>
            <X style={{ width: '16px' }} />
          </button>
        </div>

        {/* Canvas */}
        <div style={{ borderRadius: '10px', overflow: 'hidden', background: '#111827', cursor: 'grab', userSelect: 'none' }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={canvasH}
            style={{ display: 'block', width: '100%', cursor: 'grab' }}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
          />
        </div>

        {/* Zoom + Rotate */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
          {/* small image icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <input
            type="range" min={0.1} max={4} step={0.01} value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--t-primary, #5865f2)', height: '4px', cursor: 'pointer' }}
          />
          {/* large image icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <button
            onClick={() => setRotation(r => (r + 90) % 360)}
            title="Rotate 90°"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          >
            <RotateCw style={{ width: '16px' }} />
          </button>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px' }}>
          <button
            onClick={handleReset}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: '14px', fontFamily: 'inherit', fontWeight: 600, padding: '4px' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
          >
            Reset
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onCancel}
              style={{ padding: '10px 24px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              style={{ padding: '10px 24px', borderRadius: '8px', background: 'var(--t-primary, #5865f2)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px var(--t-primary-40, rgba(88,101,242,0.4))' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
