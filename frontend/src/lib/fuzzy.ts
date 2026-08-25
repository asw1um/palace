/**
 * Typo-tolerant matching used by the command palette and by search
 * "did you mean" suggestions. — issues #51, #52
 */

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Classic Levenshtein, capped for speed. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * Scores `text` against `query`. Higher is better, 0 means "no match".
 * Handles: exact, prefix, word-prefix, substring, subsequence and 1–2 typos —
 * which is what makes partial titles like "pet" find "The Pet Girl of
 * Sakurasou" (#52).
 */
export function score(text: string, query: string): number {
  const t = normalise(text);
  const q = normalise(query);
  if (!q) return 1;
  if (!t) return 0;

  if (t === q) return 1000;
  if (t.startsWith(q)) return 900 - (t.length - q.length) * 0.1;

  const words = t.split(' ');
  if (words.some((w) => w.startsWith(q))) return 800 - (t.length - q.length) * 0.1;
  if (t.includes(q)) return 700 - t.indexOf(q);

  // Every query word must appear somewhere (order independent). Each word may
  // itself be slightly misspelled, so "gilded stattic" still finds
  // "Gilded Static".
  const qWords = q.split(' ');
  if (qWords.length > 1) {
    const wordMatches = (qw: string) => {
      const budget = qw.length <= 4 ? 1 : 2;
      return words.some(
        (w) =>
          w.startsWith(qw) ||
          (Math.abs(w.length - qw.length) <= budget && editDistance(w, qw) <= budget),
      );
    };
    if (qWords.every(wordMatches)) return 620;
  }

  // fuzzy: allow 1 typo for short queries, 2 for longer
  const budget = q.length <= 4 ? 1 : q.length <= 8 ? 2 : 3;
  for (const w of words) {
    if (Math.abs(w.length - q.length) <= budget && editDistance(w, q) <= budget) {
      return 500;
    }
  }

  // subsequence (e.g. "brkbd" → "breaking bad")
  let i = 0;
  for (const ch of t) {
    if (ch === q[i]) i++;
    if (i === q.length) return 300;
  }
  return 0;
}

export function rank<T>(items: T[], query: string, key: (item: T) => string): T[] {
  if (!query.trim()) return items;
  return items
    .map((item) => ({ item, s: score(key(item), query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.item);
}

/**
 * Best "did you mean …" rewrite, or null when the query is already good.
 * Corrects each word independently so multi-word queries are covered too.
 */
export function suggest(query: string, corpus: string[]): string | null {
  const qWords = normalise(query).split(' ').filter(Boolean);
  if (!qWords.length) return null;

  const vocabulary = new Set<string>();
  for (const entry of corpus) {
    for (const word of normalise(entry).split(' ')) {
      if (word.length > 2) vocabulary.add(word);
    }
  }

  let corrected = false;
  const fixed = qWords.map((qw) => {
    if (qw.length < 3 || vocabulary.has(qw)) return qw;
    let best: { word: string; d: number } | null = null;
    for (const word of vocabulary) {
      if (Math.abs(word.length - qw.length) > 2) continue;
      const d = editDistance(word, qw);
      if (d > 0 && d <= 2 && (!best || d < best.d)) best = { word, d };
    }
    if (best) {
      corrected = true;
      return best.word;
    }
    return qw;
  });

  return corrected ? fixed.join(' ') : null;
}
