import { useState, type ReactNode } from 'react';

/* ---------------------------------------------------------------------------
   Review markup.

   Supported: **bold**  *italic*  __underline__  ~~strike~~  ||spoiler||
              `code`    \escape
   Spoilers stay blurred until clicked.
   ------------------------------------------------------------------------ */

interface Rule {
  token: string;
  render: (children: ReactNode[], key: number) => ReactNode;
}

const RULES: Rule[] = [
  { token: '**', render: (c, k) => <strong key={k}>{c}</strong> },
  { token: '__', render: (c, k) => <u key={k}>{c}</u> },
  { token: '~~', render: (c, k) => <s key={k}>{c}</s> },
  { token: '||', render: (c, k) => <Spoiler key={k}>{c}</Spoiler> },
  { token: '*', render: (c, k) => <em key={k}>{c}</em> },
  { token: '`', render: (c, k) => <code key={k}>{c}</code> },
];

function Spoiler({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setShown((s) => !s); }}
      title={shown ? 'Hide spoiler' : 'Reveal spoiler'}
      style={{
        display: 'inline',
        padding: '0 4px',
        borderRadius: 'var(--r-xs)',
        background: shown ? 'var(--accent-softer)' : 'var(--text-faint)',
        color: shown ? 'inherit' : 'transparent',
        textShadow: shown ? 'none' : '0 0 10px rgba(0,0,0,.6)',
        cursor: 'pointer',
        transition: 'color .2s, background .2s',
      }}
    >
      {children}
    </button>
  );
}

function parse(input: string, keyOffset = 0): ReactNode[] {
  const out: ReactNode[] = [];
  let buffer = '';
  let key = keyOffset;

  const flush = () => {
    if (buffer) {
      out.push(buffer);
      buffer = '';
    }
  };

  for (let i = 0; i < input.length; i++) {
    if (input[i] === '\\' && i + 1 < input.length) {
      buffer += input[i + 1];
      i++;
      continue;
    }

    const rule = RULES.find((r) => input.startsWith(r.token, i));
    if (rule) {
      const close = input.indexOf(rule.token, i + rule.token.length);
      if (close > -1) {
        flush();
        const inner = input.slice(i + rule.token.length, close);
        out.push(rule.render(parse(inner, key + 1000), key++));
        i = close + rule.token.length - 1;
        continue;
      }
    }
    buffer += input[i];
  }
  flush();
  return out;
}

export function Markdown({
  text, className = '', inline,
}: { text?: string | null; className?: string; inline?: boolean }) {
  const lines = (text ?? '').split('\n');
  const Tag = inline ? 'span' : 'div';
  return (
    <Tag className={className} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {lines.map((line, i) => (
        <span key={i}>
          {parse(line)}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </Tag>
  );
}

export const MARKDOWN_HELP: [string, string][] = [
  ['**bold**', 'bold'],
  ['*italic*', 'italic'],
  ['__underline__', 'underline'],
  ['~~strike~~', 'strikethrough'],
  ['||spoiler||', 'hidden until clicked'],
  ['`code`', 'monospace'],
];
