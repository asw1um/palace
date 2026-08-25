import { useRef, useState } from 'react';
import {
  Contrast, Image as ImageIcon, Monitor, Moon, RotateCcw, Sparkles, Sun, Type, Upload, Waves,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/theme/ThemeProvider';
import {
  isHex, normaliseHex, PRESETS, type Backdrop, type Density, type Mode, type MotionPref,
  type Surface,
} from '@/theme/themeConfig';
import { readFile } from '@/data/client';
import { staggerIn } from '@/lib/motion';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field, Input, Segmented, Slider, Switch } from './ui/Field';
import { Chip } from './ui/Bits';

/* -------------------------------------------------------------------------- */
/* Preset swatches                                                             */
/* -------------------------------------------------------------------------- */

function Presets() {
  const { theme, applyPreset } = useTheme();
  const gridRef = useRef<HTMLDivElement>(null);

  return (
    <div className="swatch-grid" ref={gridRef}>
      {PRESETS.map((p) => (
        <button
          key={p.id}
          className="swatch"
          aria-pressed={theme.preset === p.id && theme.accent === p.accent}
          onClick={() => {
            applyPreset(p.id);
            staggerIn(gridRef.current?.querySelectorAll('.swatch__chip'), { y: 4, each: 14, scale: 0.9 });
          }}
        >
          <span
            className="swatch__chip"
            style={{ background: `linear-gradient(135deg, ${p.accent}, ${p.accent2})` }}
          />
          <span className="swatch__name">{p.name}</span>
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Accent picker                                                               */
/* -------------------------------------------------------------------------- */

function AccentPicker() {
  const { theme, set } = useTheme();
  const [draft, setDraft] = useState(theme.accent);
  const [draft2, setDraft2] = useState(theme.accent2);

  const commit = (value: string, which: 'accent' | 'accent2') => {
    if (!isHex(value)) return;
    const hex = normaliseHex(value);
    set(which === 'accent' ? { accent: hex, preset: 'custom' } : { accent2: hex, preset: 'custom' });
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
      {([
        ['Primary accent', theme.accent, draft, setDraft, 'accent'],
        ['Secondary accent', theme.accent2, draft2, setDraft2, 'accent2'],
      ] as const).map(([label, current, value, setValue, key]) => (
        <Field key={key} label={label} hint="Used for highlights, charts and the backdrop.">
          <div className="row gap-2">
            <input
              type="color"
              aria-label={label}
              value={current}
              onChange={(e) => {
                setValue(e.target.value);
                commit(e.target.value, key);
              }}
              style={{
                width: 42, height: 'var(--control-h)', padding: 2, cursor: 'pointer',
                background: 'var(--surface-inset)', border: '1px solid var(--line)',
                borderRadius: 'var(--r-sm)',
              }}
            />
            <Input
              value={value}
              spellCheck={false}
              className="mono"
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => commit(value, key)}
              onKeyDown={(e) => e.key === 'Enter' && commit(value, key)}
            />
          </div>
        </Field>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Full control set                                                            */
/* -------------------------------------------------------------------------- */

export function ThemeControls({ compact = false }: { compact?: boolean }) {
  const { theme, set, reset } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const pickImage = async (file?: File) => {
    if (!file) return;
    if (file.size > 4_000_000) {
      toast.error('Pick an image under 4 MB — it is stored in your browser.');
      return;
    }
    const url = await readFile(file);
    set({ backdropImage: url, backdrop: 'image' });
    toast.success('Background updated');
  };

  return (
    <div className="stack gap-6">
      <section className="stack gap-3">
        <div className="eyebrow">Colour mode</div>
        <Segmented<Mode>
          ariaLabel="Colour mode"
          value={theme.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'light', label: 'Light', icon: <Sun /> },
            { value: 'dark', label: 'Dark', icon: <Moon /> },
            { value: 'system', label: 'System', icon: <Monitor /> },
          ]}
        />
      </section>

      <section className="stack gap-3">
        <div className="eyebrow">Themes</div>
        <Presets />
      </section>

      <section className="stack gap-3">
        <div className="eyebrow">Custom colours</div>
        <AccentPicker />
      </section>

      {!compact && (
        <>
          <section className="stack gap-3">
            <div className="eyebrow">Surface style</div>
            <Segmented<Surface>
              ariaLabel="Surface style"
              value={theme.surface}
              onChange={(surface) => set({ surface })}
              options={[
                { value: 'glass', label: 'Glass', icon: <Sparkles /> },
                { value: 'solid', label: 'Solid', icon: <Contrast /> },
                { value: 'flat', label: 'Flat', icon: <Type /> },
              ]}
            />
            <p className="faint" style={{ fontSize: 'var(--fs-12)' }}>
              Glass blurs whatever is behind panels. Solid is opaque and cheaper to render. Flat drops
              borders and shadows entirely.
            </p>
          </section>

          <section className="stack gap-3">
            <div className="eyebrow">Background</div>
            <Segmented<Backdrop>
              ariaLabel="Background"
              value={theme.backdrop}
              onChange={(backdrop) => set({ backdrop })}
              options={[
                { value: 'mesh', label: 'Aurora' },
                { value: 'gradient', label: 'Gradient' },
                { value: 'video', label: 'Ocean' },
                { value: 'image', label: 'Custom' },
              ]}
            />
            <div className="row gap-2 wrap">
              <Button
                icon={<Upload size={15} />}
                onClick={() => fileRef.current?.click()}
              >
                Upload image
              </Button>
              {theme.backdropImage && (
                <Button variant="ghost" onClick={() => set({ backdropImage: null, backdrop: 'mesh' })}>
                  Remove
                </Button>
              )}
              {theme.backdropImage && (
                <Chip tone="accent">
                  <ImageIcon size={12} /> Custom image saved
                </Chip>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => pickImage(e.target.files?.[0])}
              />
            </div>
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
                <div className="setting-row__desc">{Math.round(theme.fontScale * 100)}%</div>
              </div>
              <div style={{ width: 180 }}>
                <Slider
                  ariaLabel="Text size"
                  min={0.9}
                  max={1.2}
                  step={0.025}
                  value={theme.fontScale}
                  onChange={(fontScale) => set({ fontScale })}
                />
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-row__text">
                <div className="setting-row__title">Poster size</div>
                <div className="setting-row__desc">{theme.posterSize}px tiles</div>
              </div>
              <div style={{ width: 180 }}>
                <Slider
                  ariaLabel="Poster size"
                  min={110}
                  max={230}
                  step={5}
                  value={theme.posterSize}
                  onChange={(posterSize) => set({ posterSize })}
                />
              </div>
            </div>
          </section>

          <section className="stack gap-4">
            <div className="eyebrow">Motion &amp; time</div>

            <div className="setting-row">
              <div className="setting-row__text">
                <div className="setting-row__title">Animations</div>
                <div className="setting-row__desc">
                  Reduced keeps everything instant. System follows your OS setting.
                </div>
              </div>
              <Segmented<MotionPref>
                ariaLabel="Animations"
                value={theme.motion}
                onChange={(motion) => set({ motion })}
                options={[
                  { value: 'full', label: 'Full', icon: <Waves /> },
                  { value: 'reduced', label: 'Reduced' },
                  { value: 'system', label: 'System' },
                ]}
              />
            </div>

            <div className="setting-row">
              <div className="setting-row__text">
                <div className="setting-row__title">24-hour clock</div>
                <div className="setting-row__desc">Applies to timestamps across Palace.</div>
              </div>
              <Switch
                label="24-hour clock"
                checked={theme.timeFormat === '24'}
                onChange={(v) => set({ timeFormat: v ? '24' : '12' })}
              />
            </div>
          </section>

          <div>
            <Button variant="ghost" icon={<RotateCcw size={15} />} onClick={reset}>
              Reset appearance to defaults
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Quick panel from the top bar                                                */
/* -------------------------------------------------------------------------- */

export function ThemeQuickPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Appearance" width={560}>
      <ThemeControls />
    </Modal>
  );
}
