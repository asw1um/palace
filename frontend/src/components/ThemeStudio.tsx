'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { RotateCcw, Trash2, Upload } from '@/lib/icons';
import { useTheme } from '@/theme/ThemeProvider';
import {
  isHex, normaliseHex, PRESETS, type Density,
} from '@/theme/themeConfig';
import {
  BACKGROUND_ACCEPT, clearBackgroundFile, formatBytes, inspectBackground, RECOMMENDED,
  saveBackgroundFile,
} from '@/theme/background';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field, Input, Segmented, Slider } from './ui/Field';

/* -------------------------------------------------------------------------- */
/* Preset swatches                                                             */
/* -------------------------------------------------------------------------- */

function Presets() {
  const { theme, set } = useTheme();

  return (
    <div className="swatch-grid">
      {PRESETS.map((p) => (
        <button
          key={p.id}
          className="swatch"
          aria-pressed={theme.accent === p.accent && theme.header === p.header}
          onClick={() => set({ accent: p.accent, header: p.header })}
        >
          <span
            className="swatch__chip"
            style={{ background: p.accent }}
          />
          <span className="swatch__name">{p.name}</span>
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Color picker                                                                */
/* -------------------------------------------------------------------------- */

function ColourPicker({
  label, hint, value, onChange,
}: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const commit = (v: string) => { if (isHex(v)) onChange(normaliseHex(v)); };
  return (
    <Field label={label} hint={hint}>
      <div className="row gap-2">
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(e) => { setDraft(e.target.value); commit(e.target.value); }}
          style={{
            width: 42, height: 36, padding: 2, cursor: 'pointer',
            background: 'var(--bg-subtle)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
          }}
        />
        <Input
          value={draft}
          spellCheck={false}
          className="mono"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => e.key === 'Enter' && commit(draft)}
        />
        <div style={{
          flex: 1, height: 36, borderRadius: 'var(--r-xs)', overflow: 'hidden',
          background: `linear-gradient(to right, color-mix(in srgb, ${value} 60%, #fff), ${value})`,
          border: '1px solid var(--line)',
        }} />
      </div>
    </Field>
  );
}

/* -------------------------------------------------------------------------- */
/* Custom background                                                           */
/* -------------------------------------------------------------------------- */

const KIND_LABEL = { image: 'Image', gif: 'GIF', video: 'Video' } as const;

function BackgroundPicker() {
  const { theme, set } = useTheme();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const bg = theme.background;

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const info = await inspectBackground(file);
      await saveBackgroundFile(file);
      set({ background: { ...info, id: Date.now() } });
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Could not use that file.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    set({ background: null });
    await clearBackgroundFile().catch(() => {});
  };

  const small = bg && (bg.width < RECOMMENDED.minWidth || bg.height < RECOMMENDED.minHeight);

  return (
    <div className="stack gap-4">
      <div className="setting-row">
        <div className="setting-row__text">
          <div className="setting-row__title">{bg ? bg.name : 'No custom background'}</div>
          <div className="setting-row__desc">
            {bg
              ? `${KIND_LABEL[bg.kind]} · ${bg.width} × ${bg.height} · ${formatBytes(bg.size)}`
              : 'Use your own image, GIF or video behind the whole site.'}
          </div>
        </div>
        <div className="row gap-2">
          <Button icon={<Upload size={15} />} disabled={busy} onClick={() => input.current?.click()}>
            {busy ? 'Loading…' : bg ? 'Replace' : 'Choose file'}
          </Button>
          {bg && (
            <Button variant="ghost" icon={<Trash2 size={15} />} onClick={remove}>
              Remove
            </Button>
          )}
        </div>
      </div>

      {small && (
        <p style={{ color: 'var(--warning)', fontSize: 'var(--text-xs)' }}>
          This is smaller than {RECOMMENDED.minWidth} × {RECOMMENDED.minHeight}, so it will be
          stretched to fill the screen and may look blurry.
        </p>
      )}

      {bg && (
        <div className="setting-row">
          <div className="setting-row__text">
            <div className="setting-row__title">Background visibility</div>
            <div className="setting-row__desc">
              {Math.round(theme.backgroundOpacity * 100)}% — lower keeps text easier to read.
            </div>
          </div>
          <div style={{ width: 180 }}>
            <Slider
              ariaLabel="Background visibility"
              min={0.05}
              max={1}
              step={0.05}
              value={theme.backgroundOpacity}
              onChange={(backgroundOpacity) => set({ backgroundOpacity })}
            />
          </div>
        </div>
      )}

      <div className="panel panel--inset stack gap-2" style={{ padding: 'var(--space-3)' }}>
        <div className="eyebrow">Recommended sizes</div>
        {RECOMMENDED.tips.map(([kind, tip]) => (
          <div key={kind} className="row gap-3" style={{ fontSize: 'var(--text-xs)', alignItems: 'baseline' }}>
            <strong style={{ width: 44, flexShrink: 0 }}>{kind}</strong>
            <span className="muted">{tip}</span>
          </div>
        ))}
        <div className="faint" style={{ fontSize: 'var(--text-xs)' }}>
          The background is cropped to fill the window, so keep anything important near the middle.
        </div>
        <div className="row gap-3" style={{ fontSize: 'var(--text-xs)', alignItems: 'baseline' }}>
          <strong style={{ width: 44, flexShrink: 0 }}>Saved</strong>
          <span className="muted">
            On this device only, not in the cloud. It is stored in this browser and never uploaded
            to your account, so it won&apos;t appear on your other devices or browsers. Keep the
            original file on your PC: clearing your browser data removes the background and
            you&apos;ll need the file to set it again.
          </span>
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept={BACKGROUND_ACCEPT}
        hidden
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Full control set                                                            */
/* -------------------------------------------------------------------------- */

export function ThemeControls() {
  const { theme, set, reset } = useTheme();

  return (
    <div className="stack gap-6">
      <section className="stack gap-3">
        <div className="eyebrow">Themes</div>
        <Presets />
      </section>

      <section className="stack gap-3">
        <div className="eyebrow">Accent color</div>
        <ColourPicker
          label="Accent color"
          hint="Used for buttons, links and highlights."
          value={theme.accent}
          onChange={(accent) => set({ accent })}
        />
      </section>

      <section className="stack gap-3">
        <div className="eyebrow">Header color</div>
        <ColourPicker
          label="Header color"
          hint="Color of the top bar, section headers, and panel titles."
          value={theme.header ?? '#1e4c80'}
          onChange={(header) => set({ header })}
        />
      </section>

      <section className="stack gap-3">
        <div className="eyebrow">Background</div>
        <BackgroundPicker />
      </section>

      <section className="stack gap-4">
        <div className="eyebrow">Layout &amp; type</div>

        <div className="setting-row">
          <div className="setting-row__text">
            <div className="setting-row__title">Density</div>
            <div className="setting-row__desc">Tighter rows fit more on screen.</div>
          </div>
          <Segmented<Density>
            ariaLabel="Density"
            value={theme.density}
            onChange={(density) => set({ density })}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
        </div>

        <div className="setting-row">
          <div className="setting-row__text">
            <div className="setting-row__title">Corner radius</div>
            <div className="setting-row__desc">{Math.round(theme.radius * 100)}%</div>
          </div>
          <div style={{ width: 180 }}>
            <Slider
              ariaLabel="Corner radius"
              min={0.2}
              max={1.5}
              step={0.05}
              value={theme.radius}
              onChange={(radius) => set({ radius })}
            />
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-row__text">
            <div className="setting-row__title">Text size</div>
            <div className="setting-row__desc">{Math.round(theme.textSize * 100)}%</div>
          </div>
          <div style={{ width: 180 }}>
            <Slider
              ariaLabel="Text size"
              min={0.9}
              max={1.2}
              step={0.025}
              value={theme.textSize}
              onChange={(textSize) => set({ textSize })}
            />
          </div>
        </div>
      </section>

      <div>
        <Button variant="ghost" icon={<RotateCcw size={15} />} onClick={reset}>
          Reset appearance to defaults
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Quick panel from the top bar                                                */
/* -------------------------------------------------------------------------- */

export function ThemeQuickPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Appearance" width={480}>
      <ThemeControls />
    </Modal>
  );
}
