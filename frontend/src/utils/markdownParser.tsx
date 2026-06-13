import React, { useState } from 'react';

export type RawToken = { kind: 'delim'; delim: string } | { kind: 'text'; value: string };

export type Node =
  | { type: 'text';      value: string }
  | { type: 'spoiler';   children: Node[] }
  | { type: 'bold';      children: Node[] }
  | { type: 'italic';    children: Node[] }
  | { type: 'strike';    children: Node[] }
  | { type: 'underline'; children: Node[] }
  | { type: 'bolditalic'; children: Node[] };

type BranchNode = Exclude<Node, { type: 'text' }>;

// Longest matches go first so regex captures correctly
const SCAN_RE = /(\\\|\||\\(?:\*\*\*|\*\*|__|\|\||[*_~])|\|\||\*\*\*|\*\*|__|~~|`|\*|_)/g;
const BP: Record<string, number> = { '||': 40, '***': 35, '**': 30, '__': 20, '~~': 20, '*': 10, '_': 10 };
const DELIM_TYPE: Record<string, Node['type']> = { 
  '||': 'spoiler', 
  '***': 'bolditalic', 
  '**': 'bold', 
  '__': 'underline', 
  '~~': 'strike', 
  '*': 'italic', 
  '_': 'italic' 
};

function lex(text: string): RawToken[] {
  const tokens: RawToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  SCAN_RE.lastIndex = 0;
  while ((m = SCAN_RE.exec(text)) !== null) {
    if (m.index > last) tokens.push({ kind: 'text', value: text.slice(last, m.index) });
    const raw = m[0];
    if (raw.startsWith('\\')) tokens.push({ kind: 'text', value: raw.slice(1) });
    else tokens.push({ kind: 'delim', delim: raw });
    last = m.index + raw.length;
  }
  if (last < text.length) tokens.push({ kind: 'text', value: text.slice(last) });
  return tokens;
}

function parseExpr(tokens: RawToken[], openDelim: string | null = null): Node[] {
  const nodes: Node[] = [];
  while (tokens.length > 0) {
    const tok = tokens[0];
    if (tok.kind === 'text') { tokens.shift(); nodes.push({ type: 'text', value: tok.value }); continue; }
    const delim = tok.delim;
    if (delim === openDelim) { tokens.shift(); return nodes; }
    if (openDelim && (BP[delim] ?? 0) < (BP[openDelim] ?? 0)) { 
      const hasInnerClose = tokens.findIndex((t, i) => i > 0 && t.kind === 'delim' && t.delim === delim) !== -1;
      if (!hasInnerClose) {
        tokens.shift();
        nodes.push({ type: 'text', value: delim });
        continue;
      }
    }
    const closeIdx = tokens.findIndex((t, i) => i > 0 && t.kind === 'delim' && t.delim === delim);
    if (closeIdx === -1) { tokens.shift(); nodes.push({ type: 'text', value: delim }); continue; }
    tokens.shift();
    const children = parseExpr(tokens, delim);
    nodes.push({ type: DELIM_TYPE[delim], children } as BranchNode);
  }
  if (openDelim) nodes.unshift({ type: 'text', value: openDelim });
  return nodes;
}

function renderNodes(nodes: Node[], themeColor: string): React.ReactNode[] {
  return nodes.map((node, i) => {
    if (node.type === 'text') return node.value;
    const branch = node as BranchNode;
    const inner = renderNodes(branch.children, themeColor);
    switch (branch.type) {
      case 'spoiler':   return <InlineSpoiler key={i} themeColor={themeColor}>{inner}</InlineSpoiler>;
      case 'bold':      return <strong key={i} style={{ color: '#fff', fontWeight: 700 }}>{inner}</strong>;
      case 'bolditalic':return <strong key={i} style={{ color: '#fff', fontWeight: 700 }}><em style={{ fontStyle: 'italic' }}>{inner}</em></strong>;
      case 'italic':    return <em key={i} style={{ fontStyle: 'italic' }}>{inner}</em>;
      case 'strike':    return <span key={i} style={{ textDecoration: 'line-through', opacity: 0.6 }}>{inner}</span>;
      case 'underline': return <span key={i} style={{ textDecoration: 'underline' }}>{inner}</span>;
      default:          return inner;
    }
  });
}

export function InlineSpoiler({ children, themeColor }: { children: React.ReactNode; themeColor: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      onClick={(e) => { e.stopPropagation(); setRevealed(!revealed); }}
      title={revealed ? 'Click to hide' : 'Spoiler — click to reveal'}
      style={{
        // Reverted: Uses your exact layered gradient blocks when unrevealed
        background: revealed 
          ? 'rgba(25,25,25,0.5)' 
          : `linear-gradient(0deg, rgba(0,0,0,0.35), rgba(0,0,0,0.35)), linear-gradient(0deg, ${themeColor}30, ${themeColor}30)`,
        color: revealed ? 'inherit' : 'transparent',
        cursor: 'pointer',
        borderRadius: '4px',
        padding: '1px 6px',
        margin: '0 2px',
        transition: 'background-color 0.15s, color 0.15s',
        userSelect: revealed ? 'text' : 'none',
        // Reverted: Restores your original sharp border definition
        border: '1px solid rgba(255,255,255,0.3)',
      }}
    >
      {children}
    </span>
  );
}

export function ReviewContentRenderer({ text, themeColor }: { text: string; themeColor: string }) {
  if (!text) return null;
  return (
    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, margin: 0 }}>
      {renderNodes(parseExpr(lex(text)), themeColor)}
    </p>
  );
}