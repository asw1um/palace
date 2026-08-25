'use client';

import { useEffect, useState } from 'react';
import { RotateCcw } from '@/lib/icons';
import { useTheme } from '@/theme/ThemeProvider';
import {
  isHex, normaliseHex, PRESETS, type Density,
} from '@/theme/themeConfig';
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
