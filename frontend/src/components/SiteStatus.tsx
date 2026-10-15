import { useEffect, useState, type ReactNode } from 'react';
import axios from 'axios';
import { Bug, Check, Code2, ExternalLink, GitBranch, Server, X } from '@/lib/icons';
import { currentMode } from '@/data/client';
import { timeAgo } from '@/lib/format';
import { Chip, Panel, Skeleton } from './ui/Bits';
import { Button } from './ui/Button';
import { Segmented } from './ui/Field';

const REPO = 'asw1um/palace';
const REPO_URL = `https://github.com/${REPO}`;

interface Health {
  api: 'up' | 'down' | 'checking';
  db: 'up' | 'down' | 'unknown';
}

interface GhIssue {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
}

/**
 * Everything the old "site info" box hinted at, spelled out properly:
 * separate API / database / frontend status, the exact build, a repo link,
 * and the live bug count. — issues #13, #15, #18, #21
 */
export function SiteStatus() {
  const [health, setHealth] = useState<Health>({ api: 'checking', db: 'unknown' });
  const [bugs, setBugs] = useState<GhIssue[] | null>(null);
  const [latestCommit, setLatestCommit] = useState<{ sha: string; message: string; url: string } | null>(null);

  useEffect(() => {
    axios
      .get('/api/', { timeout: 3000 })
      .then((res) => {
        const body = res.data ?? {};
        setHealth({
          api: 'up',
          db: body.database === false ? 'down' : body.database === true ? 'up' : 'unknown',
        });
      })
      .catch(() => setHealth({ api: 'down', db: 'unknown' }));

    // Public endpoints — fail quietly when offline.
    axios
      .get(`https://api.github.com/repos/${REPO}/issues`, {
        params: { state: 'open', labels: 'bug', per_page: 10 },
        timeout: 6000,
      })
      .then((res) => setBugs(res.data.filter((i: { pull_request?: unknown }) => !i.pull_request)))
      .catch(() => setBugs([]));

    axios
      .get(`https://api.github.com/repos/${REPO}/commits`, { params: { per_page: 1 }, timeout: 6000 })
      .then((res) => {
        const c = res.data?.[0];
        if (c) {
          setLatestCommit({
            sha: String(c.sha).slice(0, 7),
            message: String(c.commit?.message ?? '').split('\n')[0],
            url: c.html_url,
          });
        }
      })
      .catch(() => {});
  }, []);

  const rows: [string, ReactNode][] = [
    [
      'API',
      health.api === 'checking' ? (
        <Skeleton h={14} w={70} />
      ) : health.api === 'up' ? (
        <Chip tone="success">
          <Check size={12} /> Reachable
        </Chip>
      ) : (
        <Chip tone="warning">
          <X size={12} /> Not running
        </Chip>
      ),
    ],
    [
      'Database',
      health.db === 'up' ? (
        <Chip tone="success">Connected</Chip>
      ) : health.db === 'down' ? (
        <Chip tone="danger">Unavailable</Chip>
      ) : (
        <Chip>Backend</Chip>
      ),
    ],
    ['Frontend', <Chip tone="accent" key="fe">Running</Chip>],
    [
      'Build',
      <span className="mono faint" key="build" style={{ fontSize: 'var(--fs-12)' }}>
        {process.env.NEXT_PUBLIC_BUILD_COMMIT ?? 'local'} · {timeAgo(process.env.NEXT_PUBLIC_BUILD_TIME ?? '')}
      </span>,
    ],
    [
      'Latest commit',
      latestCommit ? (
        <a className="row gap-2" href={latestCommit.url} target="_blank" rel="noreferrer">
          <GitBranch size={14} />
          <span className="mono" style={{ fontSize: 'var(--fs-12)' }}>{latestCommit.sha}</span>
          <span className="truncate faint" style={{ fontSize: 'var(--fs-12)', maxWidth: 220 }}>
            {latestCommit.message}
          </span>
        </a>
      ) : (
        <span className="faint" style={{ fontSize: 'var(--fs-12)' }}>Offline</span>
      ),
    ],
  ];

  return (
    <div className="stack gap-5">
      <Panel title="Status" icon={<Server size={16} />}>
        <div className="stack">
          {rows.map(([label, value]) => (
            <div className="setting-row" key={label}>
              <div className="setting-row__text">
                <div className="setting-row__title">{label}</div>
              </div>
              <div className="setting-row__control">{value}</div>
            </div>
          ))}

          <div className="setting-row">
            <div className="setting-row__text">
              <div className="setting-row__title">Data source</div>
              <div className="setting-row__desc">Always the live backend.</div>
            </div>
            <Chip tone="success">Backend</Chip>
          </div>
        </div>
      </Panel>

      <Panel
        title="Open bugs"
        icon={<Bug size={16} />}
        actions={
          <Button
            size="sm"
            variant="ghost"
            icon={<Code2 size={15} />}
            onClick={() => window.open(`${REPO_URL}/issues`, '_blank', 'noopener')}
          >
            All issues
          </Button>
        }
      >
        {bugs === null ? (
          <div className="stack gap-2">
            <Skeleton h={16} />
            <Skeleton h={16} w="70%" />
          </div>
        ) : bugs.length === 0 ? (
          <p className="faint">No open bugs reported — or GitHub is unreachable right now.</p>
        ) : (
          <div className="stack gap-1">
            {bugs.map((b) => (
              <a key={b.number} className="list-row" href={b.html_url} target="_blank" rel="noreferrer">
                <span className="mono faint" style={{ fontSize: 'var(--fs-12)' }}>#{b.number}</span>
                <span className="grow truncate">{b.title}</span>
                <span className="faint nowrap" style={{ fontSize: 'var(--fs-11)' }}>
                  {timeAgo(b.created_at)}
                </span>
                <ExternalLink size={14} className="faint" />
              </a>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Project" icon={<Code2 size={16} />}>
        <div className="row gap-2 wrap">
          <Button
            icon={<Code2 size={15} />}
            onClick={() => window.open(REPO_URL, '_blank', 'noopener')}
          >
            Source code
          </Button>
          <Button
            variant="ghost"
            icon={<Bug size={15} />}
            onClick={() => window.open(`${REPO_URL}/issues/new/choose`, '_blank', 'noopener')}
          >
            Report a bug
          </Button>
        </div>
      </Panel>
    </div>
  );
}
