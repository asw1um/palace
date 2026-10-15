import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent,
} from 'react';
import { RotateCcw, Upload } from '@/lib/icons';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Slider } from './ui/Field';

export type CropKind = 'avatar' | 'banner';

/** Aspect ratio the profile banner is displayed at — keep in sync with `.profile-cover`. */
export const BANNER_ASPECT = 5;

const SPEC: Record<CropKind, { aspect: number; outW: number; title: string; hint: string }> = {
  avatar: { aspect: 1, outW: 512, title: 'Edit profile picture', hint: 'Drag to reposition. Scroll or use the slider to zoom.' },
  banner: { aspect: BANNER_ASPECT, outW: 1500, title: 'Edit banner', hint: 'The bright strip is your banner. Drag to move the image; zoom in to move it sideways too.' },
};

const MAX_ZOOM = 4;

/** What part of the image is in frame: its centre (image px) and the zoom over "cover". */
interface View { cx: number; cy: number; zoom: number }
interface Size { w: number; h: number }

/** Scale at which the image exactly covers a box, times the zoom. */
function scaleFor(img: Size, box: Size, zoom: number) {
  return Math.max(box.w / img.w, box.h / img.h) * zoom;
}

/** Keeps the frame inside the image so no empty edge can show. */
function clamp(view: View, img: Size, aspect: number): View {
  const zoom = Math.max(1, Math.min(MAX_ZOOM, view.zoom));
  // Visible region in image px, independent of how big the box is on screen.
  const visW = Math.min(img.w, img.h * aspect) / zoom;
  const visH = visW / aspect;
  return {
    zoom,
    cx: Math.max(visW / 2, Math.min(img.w - visW / 2, view.cx)),
    cy: Math.max(visH / 2, Math.min(img.h - visH / 2, view.cy)),
  };
}

/** Positions the image inside any box showing the same framing — stage and previews share it. */
function frameStyle(view: View, img: Size, box: Size): CSSProperties {
  const s = scaleFor(img, box, view.zoom);
  return {
    position: 'absolute',
    width: img.w * s,
    height: img.h * s,
    left: box.w / 2 - view.cx * s,
    top: box.h / 2 - view.cy * s,
    maxWidth: 'none',
  };
}

function Preview({
  src, view, img, w, h, round, className = '',
}: { src: string; view: View; img: Size; w: number; h: number; round?: boolean; className?: string }) {
  return (
    <div
      className={`crop-preview ${className}`}
      style={{ width: w, height: h, borderRadius: round ? '50%' : undefined }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} style={frameStyle(view, img, { w, h })} />
    </div>
  );
}

export function ImageCropDialog({
  file, kind, name, avatarUrl, bannerUrl, onClose, onSave,
}: {
  /** The picked image; the dialog is open while this is set. */
  file: File | null;
  kind: CropKind;
  /** Shown in the preview so it reads like the real profile header. */
  name?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  onClose: () => void;
  onSave: (cropped: File) => Promise<void>;
}) {
  const spec = SPEC[kind];
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const [current, setCurrent] = useState<File | null>(file);
  const [src, setSrc] = useState<string | null>(null);
  const [img, setImg] = useState<Size | null>(null);
  const [view, setView] = useState<View>({ cx: 0, cy: 0, zoom: 1 });
  const [stage, setStage] = useState<Size>({ w: 0, h: 0 });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setCurrent(file), [file]);

  // Decode the picked file and start centred at "cover".
  useEffect(() => {
    setImg(null);
    setError(null);
    imgRef.current = null;
    if (!current) {
      setSrc(null);
      return;
    }
    const url = URL.createObjectURL(current);
    setSrc(url);
    const el = new Image();
    el.onload = () => {
      imgRef.current = el;
      const size = { w: el.naturalWidth, h: el.naturalHeight };
      setImg(size);
      setView(clamp({ cx: size.w / 2, cy: size.h / 2, zoom: 1 }, size, spec.aspect));
    };
    el.onerror = () => setError('That file could not be read as an image.');
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [current, spec.aspect]);

  // `stage` is the size of the crop frame; the stage element around it only adds
  // dimmed margin so you can see what falls outside the crop.
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [img, kind]);

  const update = useCallback(
    (fn: (v: View) => View) => {
      if (img) setView((v) => clamp(fn(v), img, spec.aspect));
    },
    [img, spec.aspect],
  );

  // Wheel zoom needs a non-passive listener to stop the dialog scrolling underneath.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !img) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      update((v) => ({ ...v, zoom: v.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08) }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [img, update]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!img) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !img || !stage.w) return;
    const s = scaleFor(img, stage, view.zoom);
    update((v) => ({ ...v, cx: d.cx - (e.clientX - d.x) / s, cy: d.cy - (e.clientY - d.y) / s }));
  };
  const endDrag = () => { drag.current = null; };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!img || !stage.w) return;
    const step = (e.shiftKey ? 40 : 8) / scaleFor(img, stage, view.zoom);
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      update((v) => ({ ...v, cx: v.cx + move[0], cy: v.cy + move[1] }));
    } else if (e.key === '+' || e.key === '=') {
      update((v) => ({ ...v, zoom: v.zoom * 1.1 }));
    } else if (e.key === '-') {
      update((v) => ({ ...v, zoom: v.zoom / 1.1 }));
    }
  };

  const save = async () => {
    const el = imgRef.current;
    if (!el || !img) return;
    setSaving(true);
    try {
      const visW = Math.min(img.w, img.h * spec.aspect) / view.zoom;
      const visH = visW / spec.aspect;
      // Never upscale: a small source just produces a smaller file.
      const outW = Math.round(Math.min(spec.outW, visW));
      const outH = Math.round(outW / spec.aspect);
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is not available');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(el, view.cx - visW / 2, view.cy - visH / 2, visW, visH, 0, 0, outW, outH);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
      if (!blob) throw new Error('Could not export the image');
      // Browsers that can't encode WebP hand back a PNG instead.
      const ext = blob.type === 'image/webp' ? 'webp' : 'png';
      await onSave(new File([blob], `${kind}.${ext}`, { type: blob.type }));
      onClose();
    } catch {
      setError('Something went wrong saving that image. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const ready = !!(src && img);

  return (
    <Modal
      open={!!file}
      onClose={saving ? () => {} : onClose}
      title={spec.title}
      width={kind === 'banner' ? 720 : 560}
      footer={
        <>
          <Button variant="ghost" icon={<Upload size={15} />} disabled={saving} onClick={() => pickRef.current?.click()}>
            Choose another
          </Button>
          <div className="grow" />
          <Button disabled={saving} onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!ready || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="stack gap-4">
        <div
          ref={stageRef}
          className={`crop-stage crop-stage--${kind}`}
          tabIndex={0}
          role="application"
          aria-label="Reposition image: drag, or use arrow keys, plus and minus"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
        >
          <div ref={frameRef} className="crop-stage__frame" style={{ aspectRatio: String(spec.aspect) }}>
            {ready && stage.w > 0 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src!} alt="" draggable={false} style={frameStyle(view, img!, stage)} />
            )}
            <div className="crop-stage__mask" aria-hidden="true" />
          </div>
        </div>

        {error ? (
          <p style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>{error}</p>
        ) : (
          <p className="faint" style={{ fontSize: 'var(--text-xs)' }}>{spec.hint}</p>
        )}

        <div className="row gap-3">
          <span className="faint" style={{ fontSize: 'var(--text-xs)', width: 40 }}>Zoom</span>
          <div className="grow">
            <Slider
              ariaLabel="Zoom"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={view.zoom}
              onChange={(z) => update((v) => ({ ...v, zoom: z }))}
            />
          </div>
          <span className="mono faint" style={{ fontSize: 'var(--text-xs)', width: 44, textAlign: 'right' }}>
            {Math.round(view.zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw size={14} />}
            disabled={!ready}
            onClick={() => img && setView(clamp({ cx: img.w / 2, cy: img.h / 2, zoom: 1 }, img, spec.aspect))}
          >
            Reset
          </Button>
        </div>

        {ready && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>Preview</div>
            <div className="crop-mock">
              <div className="crop-mock__banner">
                {kind === 'banner' ? (
                  <Preview src={src!} view={view} img={img!} w={320} h={320 / BANNER_ASPECT} />
                ) : bannerUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bannerUrl} alt="" />
                ) : null}
              </div>
              <div className="crop-mock__row">
                {kind === 'avatar' ? (
                  <Preview src={src!} view={view} img={img!} w={56} h={56} round className="crop-mock__avatar" />
                ) : (
                  <div className="crop-preview crop-mock__avatar" style={{ width: 56, height: 56, borderRadius: '50%' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {avatarUrl && <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                )}
                <strong className="truncate" style={{ fontSize: 'var(--text-sm)' }}>{name ?? 'You'}</strong>
              </div>
            </div>
          </div>
        )}

        <input
          ref={pickRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const next = e.target.files?.[0];
            if (next) setCurrent(next);
            e.target.value = '';
          }}
        />
      </div>
    </Modal>
  );
}
