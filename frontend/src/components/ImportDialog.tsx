import { useRef, useState } from 'react';
import { Check, FileUp, Loader2, X } from '@/lib/icons';
import { toast } from 'sonner';
import { discover, lists as listsApi } from '@/data/api';
import { emit } from '@/lib/bus';
import { titleCase } from '@/lib/format';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field, Select } from './ui/Field';
import { ProgressBar } from './ui/Bits';
import { useAppData } from './AppData';

interface Row {
  name: string;
  year?: string;
  status: 'pending' | 'matched' | 'missed' | 'added';
  match?: { tmdb_id: number; media_type: 'movie' | 'tv'; title: string; poster_url: string | null };
}

/** Minimal CSV reader that copes with quoted fields. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim()));
}

/**
 * Letterboxd exports a `watchlist.csv` / `films.csv` with Date, Name, Year, URI.
 * We read it locally, match each row against the catalogue, then bulk add.
 * — issue #112
 */
export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lists } = useAppData();
  const [rows, setRows] = useState<Row[]>([]);
  const [target, setTarget] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]);
    setProgress(0);
    setBusy(false);
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const table = parseCsv(text);
    if (!table.length) {
      toast.error('That file looks empty');
      return;
    }
    const header = table[0].map((h) => h.trim().toLowerCase());
    const nameIdx = header.indexOf('name') >= 0 ? header.indexOf('name') : 1;
    const yearIdx = header.indexOf('year');
    const body = table.slice(header.includes('name') ? 1 : 0);

    const parsed: Row[] = body
      .map((r) => ({
        name: (r[nameIdx] ?? '').trim(),
        year: yearIdx >= 0 ? (r[yearIdx] ?? '').trim() : undefined,
        status: 'pending' as const,
      }))
      .filter((r) => r.name);

    if (!parsed.length) {
      toast.error('No film titles found in that CSV');
      return;
    }
    setRows(parsed.slice(0, 200));
    match(parsed.slice(0, 200));
  };

  const match = async (input: Row[]) => {
    setBusy(true);
    const out = [...input];
    for (let i = 0; i < out.length; i++) {
      try {
        const results = await discover.search(out[i].name);
        const best = results[0];
        if (best) {
          out[i] = {
            ...out[i],
            status: 'matched',
            match: {
              tmdb_id: best.id,
              media_type: best.media_type,
              title: best.title,
              poster_url: best.poster_url,
            },
          };
        } else {
          out[i] = { ...out[i], status: 'missed' };
        }
      } catch {
        out[i] = { ...out[i], status: 'missed' };
      }
      setProgress(Math.round(((i + 1) / out.length) * 100));
      setRows([...out]);
    }
    setBusy(false);
  };

  const importAll = async () => {
    if (!target) {
      toast.error('Pick a list first');
      return;
    }
    setBusy(true);
    const out = [...rows];
    for (let i = 0; i < out.length; i++) {
      if (out[i].status !== 'matched' || !out[i].match) continue;
      await listsApi.add(Number(target), out[i].match!);
      out[i] = { ...out[i], status: 'added' };
      setRows([...out]);
    }
    setBusy(false);
    emit('lists');
    toast.success(`Imported ${out.filter((r) => r.status === 'added').length} titles`);
  };

  const matched = rows.filter((r) => r.status === 'matched').length;
  const added = rows.filter((r) => r.status === 'added').length;

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Import from Letterboxd"
      width={620}
      footer={
        <>
          <Button onClick={() => { reset(); onClose(); }}>Close</Button>
          <Button variant="primary" disabled={!matched || busy || !target} onClick={importAll}>
            Import {matched} title{matched === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="stack gap-4">
        <p className="muted">
          Export your data from Letterboxd (Settings → Import &amp; Export → Export your data), unzip
          it, and drop <code className="mono">watchlist.csv</code> or <code className="mono">films.csv</code> here.
          Nothing leaves your browser except the title lookups.
        </p>

        <div className="row gap-3 wrap">
          <Button icon={<FileUp size={15} />} onClick={() => fileRef.current?.click()}>
            Choose CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <div style={{ minWidth: 200 }}>
            <Field label="Import into">
              <Select value={target} onChange={(e) => setTarget(Number(e.target.value))}>
                <option value="">Choose a list…</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {titleCase(l.name)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        {rows.length > 0 && (
          <>
            <div className="stack gap-2">
              <div className="row between faint" style={{ fontSize: 'var(--fs-12)' }}>
                <span>
                  {matched} matched · {rows.filter((r) => r.status === 'missed').length} not found ·{' '}
                  {added} imported
                </span>
                <span>{progress}%</span>
              </div>
              <ProgressBar value={progress} label="Matching titles" />
            </div>

            <div className="panel panel--inset" style={{ maxHeight: 260, overflowY: 'auto', padding: 'var(--sp-2)' }}>
              {rows.map((r, i) => (
                <div key={`${r.name}-${i}`} className="list-row">
                  <span className="grow truncate">
                    {r.name} {r.year && <span className="faint">({r.year})</span>}
                  </span>
                  {r.status === 'pending' && <Loader2 size={14} className="faint" />}
                  {r.status === 'matched' && (
                    <span className="faint truncate" style={{ fontSize: 'var(--fs-12)', maxWidth: 180 }}>
                      → {r.match?.title}
                    </span>
                  )}
                  {r.status === 'added' && <Check size={14} color="var(--success)" />}
                  {r.status === 'missed' && <X size={14} color="var(--danger)" />}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
