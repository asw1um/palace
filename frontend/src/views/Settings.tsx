import { useEffect, useState, type ReactNode } from 'react';
import {
  Database, Info, Keyboard, ListVideo, Palette, RefreshCcw, Server, Trash2, User as UserIcon,
} from '@/lib/icons';
import { toast } from 'sonner';
import { auth as authApi, settings as settingsApi } from '@/data/api';
import { useAuth } from '@/data/AuthContext';
import { useAppData } from '@/components/AppData';
import { ThemeControls } from '@/components/ThemeStudio';
import { SiteStatus } from '@/components/SiteStatus';
import { ImportDialog } from '@/components/ImportDialog';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/Field';
import { Chip, Panel } from '@/components/ui/Bits';
import { useConfirm } from '@/components/ui/Modal';
import { emit } from '@/lib/bus';
import { titleCase } from '@/lib/format';
import { useLocalState } from '@/lib/hooks';

type Section = 'appearance' | 'profile' | 'library' | 'shortcuts' | 'data' | 'about';

const SECTIONS: { id: Section; label: string; icon: ReactNode }[] = [
  { id: 'appearance', label: 'Appearance', icon: <Palette size={18} /> },
  { id: 'profile', label: 'Profile', icon: <UserIcon size={18} /> },
  { id: 'library', label: 'Library', icon: <ListVideo size={18} /> },
  { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={18} /> },
  { id: 'data', label: 'Data & sync', icon: <Database size={18} /> },
  { id: 'about', label: 'About', icon: <Info size={18} /> },
];

export default function Settings() {
  const [section, setSection] = useLocalState<Section>('palace.settingsSection', 'appearance');
  const { user, patchUser } = useAuth();
  const { lists, cascadeEpisodes, setCascadeEpisodes } = useAppData();
  const confirm = useConfirm();

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [displayed, setDisplayed] = useState<number | ''>('');
  const [autoWatched, setAutoWatched] = useLocalState('palace.autoWatchedMove', true);
  const [confirmRemove, setConfirmRemove] = useLocalState('palace.confirmRemove', true);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    setNickname(user?.nickname ?? '');
    setBio(user?.bio ?? '');
  }, [user?.id]);

  useEffect(() => {
    settingsApi
      .get()
      .then((s) => setDisplayed(s.displayed_list ?? ''))
      .catch(() => {});
  }, []);

  const saveProfile = async () => {
    const updated = await authApi.updateProfile({ nickname: nickname.trim(), bio: bio.trim() });
    patchUser(updated);
    toast.success('Profile saved');
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="page-head__sub">Palace should look and behave the way you want it to.</p>
        </div>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`nav-item ${section === s.id ? 'is-active' : ''}`}
              onClick={() => setSection(s.id)}
            >
              {s.icon}
              <span className="grow">{s.label}</span>
            </button>
          ))}
        </nav>

        <div className="stack gap-5">
          {section === 'appearance' && (
            <Panel title="Appearance" icon={<Palette size={16} />}>
              <ThemeControls />
            </Panel>
          )}

          {section === 'profile' && (
            <Panel title="Your profile" icon={<UserIcon size={16} />}>
              <div className="stack gap-4">
                <Field label="Display name">
                  <Input value={nickname} onChange={(e) => setNickname(e.target.value)} />
                </Field>
                <Field label="Bio" hint="Shown on your profile. Markdown works.">
                  <Textarea value={bio} onChange={(e) => setBio(e.target.value)} />
                </Field>
                <div>
                  <Button variant="primary" onClick={saveProfile}>
                    Save profile
                  </Button>
                </div>
              </div>
            </Panel>
          )}

          {section === 'library' && (
            <>
              <Panel title="Lists" icon={<ListVideo size={16} />}>
                <div className="stack">
                  <div className="setting-row">
                    <div className="setting-row__text">
                      <div className="setting-row__title">Dashboard list</div>
                      <div className="setting-row__desc">
                        Which list leads your dashboard. Counts include films and series.
                      </div>
                    </div>
                    <Select
                      style={{ width: 200 }}
                      value={displayed}
                      onChange={async (e) => {
                        const value = e.target.value ? Number(e.target.value) : null;
                        setDisplayed(value ?? '');
                        await settingsApi.update({ displayed_list: value });
                        emit('lists');
                        toast.success('Dashboard updated');
                      }}
                    >
                      <option value="">None</option>
                      {lists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {titleCase(l.name)} ({(l.movie_count ?? 0) + (l.show_count ?? 0)})
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="setting-row">
                    <div className="setting-row__text">
                      <div className="setting-row__title">Fill in earlier episodes</div>
                      <div className="setting-row__desc">
                        Marking episode 8 watched also marks 1–7. Turn off if you skip seasons.
                      </div>
                    </div>
                    <Switch
                      label="Fill in earlier episodes"
                      checked={cascadeEpisodes}
                      onChange={setCascadeEpisodes}
                    />
                  </div>

                  <div className="setting-row">
                    <div className="setting-row__text">
                      <div className="setting-row__title">Move finished titles to Watched</div>
                      <div className="setting-row__desc">
                        Anything you finish leaves “Want to watch” and “Currently watching”.
                      </div>
                    </div>
                    <Switch label="Move finished titles" checked={autoWatched} onChange={setAutoWatched} />
                  </div>

                  <div className="setting-row">
                    <div className="setting-row__text">
                      <div className="setting-row__title">Confirm before removing</div>
                      <div className="setting-row__desc">Ask before a title leaves a list.</div>
                    </div>
                    <Switch label="Confirm before removing" checked={confirmRemove} onChange={setConfirmRemove} />
                  </div>
                </div>
              </Panel>

              <Panel title="Import" icon={<RefreshCcw size={16} />}>
                <div className="row gap-3 wrap between">
                  <p className="muted" style={{ fontSize: 'var(--text-sm)', maxWidth: '60ch' }}>
                    Bring a Letterboxd watchlist across in one go. Export your data from Letterboxd,
                    then drop the CSV in — matching happens in your browser.
                  </p>
                  <Button onClick={() => setImportOpen(true)}>Import from Letterboxd</Button>
                </div>
              </Panel>
            </>
          )}

          {section === 'shortcuts' && (
            <Panel title="Keyboard shortcuts" icon={<Keyboard size={16} />}>
              <div className="stack">
                {[
                  ['⌘ / Ctrl + K', 'Open the command palette'],
                  ['/', 'Search from anywhere'],
                  ['Esc', 'Close a dialog or the palette'],
                  ['↑ ↓', 'Move through palette results'],
                  ['Enter', 'Run the highlighted command'],
                  ['Right click', 'Poster actions — add, create list, mark watched'],
                  ['Long press', 'Same menu on touch devices'],
                ].map(([keys, what]) => (
                  <div className="setting-row" key={keys}>
                    <div className="setting-row__text">
                      <div className="setting-row__title">{what}</div>
                    </div>
                    <kbd className="key">{keys}</kbd>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {section === 'data' && (
            <Panel title="Data source" icon={<Server size={16} />}>
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                Palace talks to the live Palace API backend.
              </p>
            </Panel>
          )}

          {section === 'about' && <SiteStatus />}
        </div>
      </div>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
